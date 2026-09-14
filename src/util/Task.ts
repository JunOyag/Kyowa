enum TaskStatus {
    WAITING = 0,
    RUNNING
}

/**
 * Un "cran" d'exécution incrémentale.
 * Retourne (ou résout vers) `true` pour interrompre la boucle du morceau de
 * temps en cours : job terminé, erreur gérée, ou opération externe async
 * (FileReader, printOut...) déjà prise en charge via resolveTask/rejectTask.
 */
type IncrementalStepFn = () => boolean | Promise<boolean>;

class TaskCancelledError extends Error {
    constructor() {
        super("Task was stopped/cancelled");
        this.name = "TaskCancelledError";
    }
}

abstract class Task {

    public static LOG = false;

    public static s_taskInstanceCounter = 0;
    public taskInstanceNumber = Task.s_taskInstanceCounter++;

    private taskStatus: TaskStatus = TaskStatus.WAITING;

    private incObj: any;
    private incFn: IncrementalStepFn;
    private onUpdateFn: (progress: number) => void;
    private resolveFn: ((value: any) => void) | undefined;
    private rejectFn: ((reason?: any) => void) | undefined;
    private settled = true;

    private MIN_DELAY = 5;
    private DEFAULT_TIME_FRAME = 100; // ms
    private DEFAULT_TIME_RATE = 0.8; // 80% of time used for this task
    private timeFrame = this.DEFAULT_TIME_FRAME;
    private taskTimeFrame = 0;
    private timeOutHandle: string | number | NodeJS.Timeout | undefined;

    constructor(_timeFrame?, _timeRate?) {
        this.timeFrame = _timeFrame || this.DEFAULT_TIME_FRAME;
        let timeRate = _timeRate || this.DEFAULT_TIME_RATE;
        this.taskTimeFrame = this.timeFrame * timeRate;
    }

    public setTimeRate(_timeRate) {
        this.taskTimeFrame = this.timeFrame * _timeRate;
    }

    public isRunning(): boolean {
        return this.taskStatus === TaskStatus.RUNNING;
    }

    private launchRun(remainingTimeInFrame?: number | undefined): void {
        if (Task.LOG) console.log("inst " + this.taskInstanceNumber + " ; launchRun");
        this.killRun();
        this.timeOutHandle = setTimeout(() => { void this.runIncrementalInternal(); },
            (remainingTimeInFrame !== undefined) ? remainingTimeInFrame : this.MIN_DELAY);
        if (Task.LOG) console.log("inst " + this.taskInstanceNumber + " ; setTimeout " + this.timeOutHandle);
    }

    private killRun(): void {
        if (this.timeOutHandle !== undefined) {
            if (Task.LOG) console.log("inst " + this.taskInstanceNumber + " ; clearTimeout " + this.timeOutHandle);
            clearTimeout(this.timeOutHandle);
            this.timeOutHandle = undefined;
        }
    }

    /**
     * Démarre une boucle incrémentale et retourne une Promise réglée
     * (resolve/reject) via resolveTask()/rejectTask(), appelés depuis `incFn`.
     * Toute Promise déjà en attente sur cette instance est annulée (stop()).
     */
    protected run<T>(state: any, incFn: IncrementalStepFn, onUpdate: (progress: number) => void): Promise<T> {
        this.stop();

        this.incObj = state;
        this.incFn = incFn;
        this.onUpdateFn = onUpdate;
        this.settled = false;

        return new Promise<T>((resolve, reject) => {
            this.resolveFn = resolve;
            this.rejectFn = reject;
            this.taskStatus = TaskStatus.RUNNING;
            this.launchRun();
        });
    }

    private settle(kind: "resolveFn" | "rejectFn", value: any): void {
        if (this.settled) {
            return;
        }
        this.settled = true;
        this.taskStatus = TaskStatus.WAITING;
        this.killRun();

        const settler = this[kind];
        this.resolveFn = undefined;
        this.rejectFn = undefined;
        settler?.(value);

        if (Task.LOG) console.log("inst " + this.taskInstanceNumber + " ; Task " + kind);
    }

    protected resolveTask(value: any): void {
        this.settle("resolveFn", value);
    }

    protected rejectTask(reason?: any): void {
        this.settle("rejectFn", reason);
    }

    protected reportProgress(progress: number): void {
        this.onUpdateFn?.(progress);
    }

    protected getIncObj<T = any>(): T {
        return this.incObj as T;
    }

    /**
     * Arrête la tâche. Si une Promise créée par run() est encore en attente,
     * elle est rejetée avec une TaskCancelledError pour qu'un `await` en
     * cours ne reste jamais bloqué indéfiniment.
     */
    public stop(): void {
        if (!this.settled) {
            this.settle("rejectFn", new TaskCancelledError());
            return;
        }
        this.taskStatus = TaskStatus.WAITING;
        this.killRun();
        if (Task.LOG) console.log("inst " + this.taskInstanceNumber + " ; Task Stop");
    }

    private async runIncrementalInternal(): Promise<void> {
        if (!this.isRunning()) {
            if (Task.LOG) console.log("inst " + this.taskInstanceNumber + " ; Task interrupted");
            return;
        }

        let currentTimeStart = Date.now();
        let currentTimeEnd;
        if (Task.LOG) console.log("inst " + this.taskInstanceNumber + " ; runIncrementalInternal start : " + currentTimeStart);
        let spentTime = 0;
        let breakThisLoop = false;

        do {
            try {
                breakThisLoop = await this.incFn();
            } catch (err) {
                // Une erreur non gérée levée par un cran async fait
                // automatiquement échouer la Promise retournée par run().
                this.rejectTask(err);
                return;
            }
            currentTimeEnd = Date.now();
            spentTime = currentTimeEnd - currentTimeStart;
        } while (this.isRunning() && !breakThisLoop && spentTime < this.taskTimeFrame);

        if (Task.LOG) console.log("inst " + this.taskInstanceNumber + " ; runIncrementalInternal end / spentTime : " + currentTimeEnd + " / " + spentTime);

        if (this.isRunning()) {
            let remainingTimeInFrame = Math.max(this.MIN_DELAY, this.timeFrame - spentTime);
            this.launchRun(remainingTimeInFrame);
        } else {
            if (Task.LOG) console.log("inst " + this.taskInstanceNumber + " ; Task terminated");
        }
    }

}

export { Task, TaskCancelledError };