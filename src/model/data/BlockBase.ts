import { DataContainerParseCode } from "./DataContainer.ts";


enum ParsingState {
    READ_LENGTH = 0,
    READ_DATA
}


enum BlockType {
    STOP = 0,
    DATA = 1,
    HASH = 2,
}

abstract class BlockBase {

    private parsingState: ParsingState = ParsingState.READ_LENGTH;
    private parsingIndex: number = 0;

    protected blockLength: number = 0;
    protected blockDataRaw: Uint8Array = new Uint8Array(0);
    private blockDataRawTab: number[] = [];

    public abstract getBlockType(): number;

    public parseInc(nextChar: number): DataContainerParseCode {

       //console.log("parseInc nextChar = " + nextChar + " ; parsingIndex = " + this.parsingIndex);

        if (this.parsingState === ParsingState.READ_LENGTH) {
            this.blockLength += nextChar << ((2 - this.parsingIndex) * 8);
            this.parsingIndex++;

            if (this.parsingIndex >= 3) {
                console.log("blockLength = " + this.blockLength);
                if (this.blockLength === 0) {
                    return DataContainerParseCode.OK_BLOCK_END;
                } else {
                    this.parsingState = ParsingState.READ_DATA;
                    this.parsingIndex = 0;
                }
            }
            return DataContainerParseCode.OK_CONTINUE;
        }

        let retCode: DataContainerParseCode = DataContainerParseCode.OK_CONTINUE;

        this.blockDataRawTab.push(nextChar);
        retCode = this.parseIncData(nextChar);
        this.parsingIndex++;

        if (this.parsingIndex === this.blockLength) {
            retCode = DataContainerParseCode.OK_BLOCK_END;
        }

        return retCode;
    }

    public endParse() {
        this.blockDataRaw = new Uint8Array(this.blockDataRawTab);
    }

    public abstract parseIncData(nextChar: number): DataContainerParseCode

    public async printOut(): Promise<Uint8Array> {
        let blkLen = this.blockDataRaw.length;

        let blkLen0 = (blkLen >>> 16) & 0xFF;
        let blkLen1 = (blkLen >>> 8) & 0xFF;
        let blkLen2 = blkLen & 0xFF;

        let out = new Uint8Array(this.blockDataRaw.length + 4);
        out.set([this.getBlockType(), blkLen0, blkLen1, blkLen2]);
        out.set(this.blockDataRaw, 4);
        return out;
    };

    public abstract newInstance(): BlockBase;

}

export { BlockBase, BlockType };