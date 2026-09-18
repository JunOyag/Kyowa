import { CarrierManager_Error, CarrierManagerBase } from "./CarrierManagerBase.ts";
import Credentials from "../model/Credentials.ts";
import { Task } from "../util/Task.ts";
import { DataContainer, DataContainerParseCode } from "../model/data/DataContainer.ts";
import TabUtils from "../util/TabUtils.ts";
import UPNG from "upng";


enum StatusEncoder {
    PRINT_DATA_CONTAINER = 0,
    ENCODE_IMAGE,
}

class StateObject {

    // Encoding-specific status
    public encodeStatus: StatusEncoder;
    public encodedOutBuffer: Uint8Array;
    public byteIndex = 0;

    // Image path driver
    public hash: number[];
    public hashIndex = 0;

    // Image data indexes
    public pos = 0;
    public bitLayer = 1; // 1 << track
    public bitMap;

    // Byte reconstruction
    public curByte = 0;
    public curByteBitW = 1;

    // Data block container
    public data: DataContainer;

    // Global bit counter
    public bitCounter = 0;
    public bitTotal = 0;
    public bitsOnLayer = 0;

    public resetPos() {
        this.hashIndex %= this.hash.length;
        let h1 = this.hash[this.hashIndex++];
        this.hashIndex %= this.hash.length;
        let h2 = this.hash[this.hashIndex++];
        this.hashIndex %= this.hash.length;
        let h3 = this.hash[this.hashIndex++];

        this.pos = h1 + (h2 << 8) + (h3 << 16);
        this.pos %= this.bitsOnLayer;
        this.bitMap = new Uint32Array(Math.ceil(this.bitsOnLayer / 32));
    }

    public incPos(): boolean {
        this.hashIndex %= this.hash.length;
        this.pos += this.hash[this.hashIndex++];
        this.pos %= this.bitsOnLayer;
        this.pos = TabUtils.getNextFreePos(this.bitMap, this.pos, this.bitsOnLayer);

        if (this.pos < 0) {
            this.bitLayer <<= 1;
            if (this.bitLayer === 256) {
                return false;
            }
            this.resetPos();
            this.pos = TabUtils.getNextFreePos(this.bitMap, this.pos, this.bitsOnLayer);
        }
        return true;
    }
}


class CarrierManagerPNG extends CarrierManagerBase {

    private imageData: ImageData;

    constructor() {
        super();
        if (Task.LOG) console.log("inst " + this.taskInstanceNumber + " ; constructor");
    }

    public newInstance(): CarrierManagerBase {
        if (Task.LOG) console.log("inst " + this.taskInstanceNumber + " ; newInstance");
        const newInst = new CarrierManagerPNG();
        newInst.file = this.file;
        newInst.imageData = this.imageData;
        newInst.fileRead = this.fileRead;
        return newInst;
    }

    public getAcceptedMimeTypes(): string[] {
        return ["image/png"];
    }

    public read(file: File, onUpdate: (progress: number) => void): Promise<void> {
        this.file = file;
        if (Task.LOG) console.log("inst " + this.taskInstanceNumber + " ; call read : " + Date.now());
        onUpdate(0);
        return this.run<void>(new StateObject(), () => this.runRead(), onUpdate);
    }

    public async decode(creds: Credentials, onUpdate: (progress: number) => void): Promise<DataContainer> {
        if (Task.LOG) console.log("inst " + this.taskInstanceNumber + " ; call decode : " + Date.now());

        const state = new StateObject();
        state.data = new DataContainer();
        state.hash = await creds.getHash();
        state.bitsOnLayer = this.imageData.width * this.imageData.height * 4; // ARGB
        state.bitTotal = state.bitsOnLayer * 8; // 8-bits per channel
        state.resetPos();

        onUpdate(0);
        return this.run<DataContainer>(state, () => this.runDecode(), onUpdate);
    }

    /**
     * FileReader ne se laisse pas "trancher" en petits pas : on lance la
     * lecture et on règle la Promise de la tâche depuis ses callbacks, ce qui
     * remplace les anciens onSuccess/onError.
     */
    private runRead(): Promise<boolean> {
        return new Promise<boolean>((resolveStep) => {
            const reader = new FileReader();

            reader.onload = () => {
                try {
                    let img = UPNG.decode(reader.result as ArrayBuffer);
                    let imgRGBA = UPNG.toRGBA8(img);

                    this.imageData = { data: new Uint8ClampedArray(imgRGBA), width: img.width, height: img.height, colorSpace: 'srgb' };
                    this.fileRead = true;
                    this.resolveTask(undefined);
                } catch (err) {
                    this.rejectTask(err);
                }
                resolveStep(true); // interrompt la boucle incrémentale
            };

            reader.onerror = () => {
                this.rejectTask(reader.error);
                resolveStep(true);
            };

            reader.readAsArrayBuffer(this.file);
        });
    }

    private runDecode(): boolean {
        const incObj = this.getIncObj<StateObject>();
        const imgData = this.imageData.data;

        if (Task.LOG) console.log("inst " + this.taskInstanceNumber + " ; call runDecode : " + Date.now());

        let runCount = 0;

        while (runCount < 8 * 1024) {
            incObj.bitCounter++;
            runCount++;

            if (!incObj.incPos()) {
                this.rejectTask(CarrierManager_Error.END_NO_MORE_DATA);
                return true;
            }

            if (TabUtils.isBitSet(imgData, incObj.pos, incObj.bitLayer)) {
                incObj.curByte |= incObj.curByteBitW;
            }

            incObj.curByteBitW <<= 1;
            if (incObj.curByteBitW > 128) {
                let parseRet = incObj.data.parseInc(incObj.curByte);

                if (parseRet === DataContainerParseCode.OK_END) {
                    this.resolveTask(incObj.data);
                    return true;
                }
                if (parseRet === DataContainerParseCode.UNEXPECTED_END) {
                    this.rejectTask(CarrierManager_Error.END_NO_MORE_DATA);
                    return true;
                }
                if (parseRet === DataContainerParseCode.UNEXPECTED_DATA) {
                    this.rejectTask(CarrierManager_Error.END_MISMATCH);
                    return true;
                }
                if (parseRet === DataContainerParseCode.HASH_MISMATCH) {
                    this.rejectTask(CarrierManager_Error.END_CORRUPTED);
                    return true;
                }
                incObj.curByteBitW = 1;
                incObj.curByte = 0;
                incObj.byteIndex++;
            }
        }

        this.reportProgress(incObj.bitCounter * 100 / incObj.bitTotal);
        return false;
    }

    public async encode(creds: Credentials, data: DataContainer, onUpdate: (progress: number) => void): Promise<void> {
        if (Task.LOG) console.log("inst " + this.taskInstanceNumber + " ; call encode : " + Date.now());

        const state = new StateObject();
        state.data = data;
        state.encodeStatus = StatusEncoder.PRINT_DATA_CONTAINER;
        state.byteIndex = 0;
        state.hash = await creds.getHash();
        state.bitsOnLayer = this.imageData.width * this.imageData.height * 4; // ARGB
        state.bitTotal = state.bitsOnLayer * 8; // 8-bits per channel
        state.resetPos();

        onUpdate(0);
        return this.run<void>(state, () => this.runEncode(), onUpdate);
    }

    public async write(): Promise<Blob> {
        if (Task.LOG) console.log("inst " + this.taskInstanceNumber + " ; call write : " + Date.now());
        this.stop();
        let outBuf = UPNG.encode(this.imageData.data, this.imageData.width, this.imageData.height, 0);
        return new Blob([outBuf]);
    }

    /**
     * `await incObj.data.printOut()` remplace l'ancien état intermédiaire
     * PRINTING_DATA_CONTAINER : plus besoin de "return true" pour geler la
     * boucle pendant la sérialisation, l'await la fait naturellement puisque
     * runIncrementalInternal() attend chaque cran avant d'enchaîner.
     */
    private async runEncode(): Promise<boolean> {
        const incObj = this.getIncObj<StateObject>();
        const imgData = this.imageData.data;

        if (Task.LOG) console.log("inst " + this.taskInstanceNumber + " ; call runEncode : " + Date.now());

        if (incObj.encodeStatus === StatusEncoder.PRINT_DATA_CONTAINER) {
            incObj.encodedOutBuffer = await incObj.data.printOut();
            incObj.byteIndex = 0;
            incObj.curByte = incObj.encodedOutBuffer[incObj.byteIndex];
            incObj.curByteBitW = 1;
            incObj.encodeStatus = StatusEncoder.ENCODE_IMAGE;
            return false;
        }

        let runCount = 0;

        while (runCount < 8 * 1024) {
            incObj.bitCounter++;
            runCount++;

            if (!incObj.incPos()) {
                this.rejectTask(CarrierManager_Error.END_NO_SPACE);
                return true;
            }

            TabUtils.setBit(imgData, incObj.pos, incObj.bitLayer, (incObj.curByte & incObj.curByteBitW) !== 0);

            incObj.curByteBitW <<= 1;
            if (incObj.curByteBitW > 128) {
                incObj.byteIndex++;
                if (incObj.byteIndex >= incObj.encodedOutBuffer.length) {
                    this.resolveTask(undefined);
                    return true;
                }
                incObj.curByte = incObj.encodedOutBuffer[incObj.byteIndex];
                incObj.curByteBitW = 1;
            }
        }

        this.reportProgress(incObj.byteIndex * 100 / incObj.encodedOutBuffer.length);
        return false;
    }

    public getLayersCapacity(): number[] {
        let caps: number[] = [];

        for (let bit = 0; bit < 8; bit++) {
            let exploitableBits = this.imageData.width * this.imageData.height * 4; // 1 bit on each ARGB channel
            caps.push(exploitableBits);
        }

        for (let i = 0; i < 8; i++) {
            console.log("DCT exploitable capacity : Bit " + i + " -> " + caps[i] + " bits");
        }

        return caps;
    }

}

export default CarrierManagerPNG;