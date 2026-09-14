import { BlockBase, BlockType } from "./BlockBase.ts";
import BlockData from "./BlockData.ts";
import BlockHash from "./BlockHash.ts";
import BlockStop from "./BlockStop.ts";
import BlockFactoryInstance from "./BlockFactory.ts";



const enum DataContainerParseCode {
    OK_CONTINUE = 0,
    OK_BLOCK_END,
    UNEXPECTED_DATA,
    UNEXPECTED_END,
    HASH_MISMATCH,
    OK_END,
}

class DataContainer {

    private HEADER: number[] = [0xFF, 0x73, 0x78, 0x03, 0x06, 0x11];

    private curBlock: BlockBase | undefined;
    private curIdx = 0;
    private tabBlocks: BlockBase[] = [];

    public dataRaw: number[] = [];


    public getDataBlocks(): BlockData[] {
        return this.tabBlocks.filter((blk) => (blk.getBlockType() === BlockType.DATA)) as BlockData[];
    }

    public addDataBlock(blk: BlockData) {
        this.tabBlocks = this.getDataBlocks();
        this.tabBlocks.push(blk);
    }

    public parseInc(nextChar: number): DataContainerParseCode {
        let retCode: DataContainerParseCode = DataContainerParseCode.OK_CONTINUE;

        if (this.curBlock === undefined) {
            if (this.curIdx < this.HEADER.length) {
                if (nextChar !== this.HEADER[this.curIdx]) {
                    return DataContainerParseCode.UNEXPECTED_DATA;
                }
                this.curIdx++;
            } else {
                this.curBlock = BlockFactoryInstance.createFrom(nextChar);

                if (this.curBlock === undefined) {
                    retCode = DataContainerParseCode.UNEXPECTED_DATA;
                } else
                    if (this.curBlock.getBlockType() === BlockType.STOP) {
                        retCode = DataContainerParseCode.OK_END;
                    }
            }
        } else {
            retCode = this.curBlock.parseInc(nextChar);
            if (retCode === DataContainerParseCode.OK_BLOCK_END) {
                this.curBlock.endParse();
                this.tabBlocks.push(this.curBlock);

                if (this.curBlock?.getBlockType() === BlockType.HASH) {
                    const blkHash = this.curBlock as BlockHash;
                    if (!blkHash.check(new Uint8Array(this.dataRaw))) {
                        retCode = DataContainerParseCode.HASH_MISMATCH;
                    }
                } else
                    if (this.curBlock.getBlockType() === BlockType.STOP) {
                        retCode = DataContainerParseCode.OK_END;
                    } else {
                        retCode = DataContainerParseCode.OK_CONTINUE;
                    }
                this.curBlock = undefined;
            }
        }

        if (this.curBlock?.getBlockType() !== BlockType.HASH) {
            this.dataRaw.push(nextChar);
        }
        
        return retCode;
    }

    public async finalizeTabBlocks() {
        // keep only BlockData blocks
        this.tabBlocks = this.getDataBlocks();
        // serialize
        let tmpOut = await this.printOutInternal();
        let blkHash = new BlockHash();
        blkHash.computeHash(tmpOut);
        // Add hash block
        this.tabBlocks.push(blkHash);
        // Add stop block
        this.tabBlocks.push(new BlockStop());
    }

    private async printOutInternal() : Promise<Uint8Array> {

        let aBlks: Uint8Array[] = [];

        aBlks.push(new Uint8Array(this.HEADER));
        let size = aBlks[0].length;

        console.log("printOutInternal : this.tabBlocks.length = " + this.tabBlocks.length);
        for (const blk of this.tabBlocks) {
            let tmp = await blk.printOut();
            console.log("printOutInternal : adding block type " + blk.getBlockType() + " of size " + tmp.length);
            aBlks.push(tmp);
            size += tmp.length;
        };

        let aOut = new Uint8Array(size);
        let ofs = 0;
        aBlks.forEach(i8arr => {
            aOut.set(i8arr, ofs);
            ofs += i8arr.length;
        });

        return aOut;
    }

    public async printOut() : Promise<Uint8Array> {
        await this.finalizeTabBlocks();
        return await this.printOutInternal();
    }
}

export { DataContainer, DataContainerParseCode };