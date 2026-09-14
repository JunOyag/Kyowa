import Credentials from "../model/Credentials.ts";
import { DataContainer } from "../model/data/DataContainer.ts";
import { Task } from "../util/Task.ts";


enum CarrierManager_Error {
    END_NO_MORE_DATA = "END_NO_MORE_DATA",
    END_NO_SPACE = "END_NO_SPACE",
    END_MISMATCH = "END_MISMATCH",
    END_CORRUPTED = "END_CORRUPTED"
}

type ProgressCallback = (progress: number) => void;

abstract class CarrierManagerBase extends Task {

    protected file: File;
    protected fileRead: boolean = false;

    public isFileRead(): boolean {
        return this.fileRead;
    }

    public abstract getAcceptedMimeTypes(): string[];

    public accept(mimeType: String): boolean {
        return this.getAcceptedMimeTypes().filter((v) => mimeType === v).length > 0;
    }

    public abstract read(file: File, onUpdate: ProgressCallback): Promise<void>;
    public abstract decode(creds: Credentials, onUpdate: ProgressCallback): Promise<DataContainer>;

    public abstract encode(creds: Credentials, data: DataContainer, onUpdate: ProgressCallback): Promise<void>;
    public abstract write(): Promise<Blob>;

    /**
     * Return a number[8] with the capacity (in bits) on each bit layer
     */
    public abstract getLayersCapacity(): number[];

    public abstract newInstance(): CarrierManagerBase;
}

export { CarrierManagerBase, CarrierManager_Error };