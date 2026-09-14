import Binary from "../../util/Binary.ts";
import { BlockBase, BlockType } from "./BlockBase.ts";
import { DataContainerParseCode } from "./DataContainer.ts";


class BlockData extends BlockBase {

    private static HEADER = [0xFF, 0xAF, 0xF1, 0xF7];

    private name: string = "";
    private contentType: string = "";
    private decoded: boolean = false;
    private encodedDataSync = false;
    private decodedData: Uint8Array = new Uint8Array(0);

    constructor() {
        super();

        // Init empty Data block with internal header
        this.blockDataRaw = new Uint8Array(6);
        this.blockDataRaw.set(BlockData.HEADER, 0);
        this.blockDataRaw.set([0x00, 0x00], 4);
    }

    public isDecoded(): boolean {
        return this.decoded;
    }

    public getDecodedData(): Uint8Array | null {
        if (!this.isDecoded()) {
            return null;
        }
        return this.decodedData;
    }

    public setDecodedData(data: Uint8Array) {
        this.decodedData = data;
        this.decoded = true;
        this.encodedDataSync = false;
    }

    public setEncodedData(data: Uint8Array) {
        this.blockDataRaw = data;
    }

    public getEncodedData(): Uint8Array {
        return this.blockDataRaw;
    }

    public setName(name: string) {
        this.name = name.substring(0, 255);
    }

    public getName(): string {
        return this.name;
    }

    public setContentType(s: string) {
        this.contentType = s;
    }

    public getContentType(): string {
        return this.contentType;
    }

    public parseIncData(nextChar: number): DataContainerParseCode {
        // encoded content, can't see/control anything here.
        return DataContainerParseCode.OK_CONTINUE;
    }


    private readString(inBuf: Uint8Array, ofs: number): any {
        let out = { value: "", idx: ofs };
        if (ofs >= inBuf.length) {
            return null;
        }
        let strlen = inBuf[ofs++];
        if (strlen + ofs > inBuf.length) {
            return null;
        }
        out.value = new TextDecoder().decode(inBuf.slice(ofs, ofs + strlen));
        out.idx = ofs + strlen;
        return out;
    }


    private async createAESKey(pass: string) {
        const encoder = new TextEncoder();
        const salt = new Uint8Array(16);
        const iterations = 65536;
        const hash = 'SHA-256';

        let baseKey = await crypto.subtle.importKey(
            'raw',
            encoder.encode(pass),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );

        let aesKey = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: iterations,
                hash: hash
            },
            baseKey,
            { name: 'AES-CBC', length: 256 },
            true,
            ['encrypt', 'decrypt']
        );

        return aesKey;
    }


    private createIV(): Uint8Array {
        return new Uint8Array(16);
    }


    private async encryptData(data, key, iv) {
        const encrypted = await crypto.subtle.encrypt(
            {
                name: 'AES-CBC',
                iv: iv,
            },
            key,
            data
        );
        return encrypted;
    };

    private async decryptData(data, key, iv) {
        const decrypted = await crypto.subtle.decrypt(
            {
                name: 'AES-CBC',
                iv: iv,
            },
            key,
            data
        );
        return decrypted;
    };


    public async tryDecode(pass: string) {
        if (this.isDecoded()) {
            return;
        }
        // Decode this.blockDataRaw into inBuf
        let key = await this.createAESKey(pass);
        let iv = this.createIV();
        let decryptedBuf;
        try {
            decryptedBuf = await this.decryptData(this.blockDataRaw, key, iv);
        }
        catch (error) {
            // console.log("BlockData : Wrong pass : " + pass);
            return;
        }
        // console.log("BlockData : Correct pass : " + pass);
        let inBuf = new Uint8Array(decryptedBuf);

        this.encodedDataSync = false;
        this.decodedData = new Uint8Array(0);
        this.name = "";

        if (inBuf.length >= 6) {
            // Check for internal header
            for (let i = 0; i < BlockData.HEADER.length; i++) {
                if (inBuf[i] !== BlockData.HEADER[i]) {
                    console.log("BlockData : Wrong header")
                    return;
                }
            }

            let idx = BlockData.HEADER.length;

            let reader = this.readString(inBuf, idx);
            if (reader === null) {
                console.log("BlockData : Malformed inBuf while reading Name");
                return;
            }
            this.name = reader.value;
            idx = reader.idx;

            reader = this.readString(inBuf, idx);
            if (reader === null) {
                console.log("BlockData : Malformed inBuf while reading ContentType");
                return;
            }
            this.contentType = reader.value;
            idx = reader.idx;

            this.decodedData = inBuf.slice(idx);

            let hash = Binary.computeSHA256(this.decodedData);
            console.log("BlockData::decode : decodedData hash : " + Binary.arrayUint8ToHex(hash));

            this.decoded = true;
            this.encodedDataSync = true;
        }

    }

    public async encode(pass: string) {
        if ((this.decoded) && (!this.encodedDataSync)) {

            let hash = Binary.computeSHA256(this.decodedData.slice(1));
            console.log("BlockData::encode : decodedData hash : " + Binary.arrayUint8ToHex(hash));

            let nameBin = new TextEncoder().encode(this.name);
            let contentTypeBin = new TextEncoder().encode(this.contentType);

            let blkSize = BlockData.HEADER.length + 1 + nameBin.length + 1 + contentTypeBin.length + this.decodedData.length;
            let outBuf = new Uint8Array(blkSize);
            let outOfs = 0;

            outBuf.set(BlockData.HEADER, outOfs);
            outOfs += BlockData.HEADER.length;

            let n0 = nameBin.length;
            outBuf.set([n0], outOfs);
            outOfs++;

            outBuf.set(nameBin, outOfs);
            outOfs += nameBin.length;

            let n1 = contentTypeBin.length;
            outBuf.set([n1], outOfs);
            outOfs++;

            outBuf.set(contentTypeBin, outOfs);
            outOfs += contentTypeBin.length;

            outBuf.set(this.decodedData, outOfs);
            outOfs += this.decodedData.length;

            // TODO : Encrypt outBuf with a this.pass derived key
            let key = await this.createAESKey(pass);
            let iv = this.createIV();
            this.blockDataRaw = new Uint8Array(await this.encryptData(outBuf, key, iv));

            // Test encryption / decryption reversion
            // let decryptedBuf;
            // try {
            //     decryptedBuf = await this.decryptData(this.blockDataRaw, key, iv);
            // }
            // catch (error) {
            //     console.log("BlockData : En/decryption test failed");
            // }

            // if (decryptedBuf.byteLength !== outBuf.length) {
            //     console.log("Len diff");
            // }

            // for (let i = 0; i < decryptedBuf.length; i++) {
            //     if (decryptedBuf[i] !== outBuf[i]) {
            //         console.log("buf diff");
            //     }
            // }

            this.encodedDataSync = true;
        }
    }

    public newInstance(): BlockBase {
        return new BlockData();
    }

    public getBlockType(): number {
        return BlockType.DATA;
    }

    public async printOut(): Promise<Uint8Array> {
        let out = new Uint8Array(4 + this.blockDataRaw.length);

        let d0 = (this.blockDataRaw.length >>> 16) & 0xff;
        let d1 = (this.blockDataRaw.length >>> 8) & 0xff;
        let d2 = this.blockDataRaw.length & 0xff;

        out.set([this.getBlockType(), d0, d1, d2], 0);
        out.set(this.blockDataRaw, 4);

        return out;
    }

}

export default BlockData;