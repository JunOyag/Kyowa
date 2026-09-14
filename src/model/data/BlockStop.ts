import {BlockBase, BlockType} from "./BlockBase.ts";
import {DataContainerParseCode} from "./DataContainer.ts";

class BlockStop extends BlockBase {
    public parseIncData(nextChar: number): DataContainerParseCode {
        return DataContainerParseCode.UNEXPECTED_DATA;
    }

    public newInstance(): BlockBase {
        return new BlockStop();
    }

    public getBlockType(): number {
        return BlockType.STOP;
    }
   
    public async printOut(): Promise<Uint8Array> {
        return new Uint8Array([this.getBlockType(), 0, 0, 0]);
    }

}

export default BlockStop;