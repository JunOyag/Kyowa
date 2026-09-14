import Binary from "../../util/Binary.ts";
import TabUtils from "../../util/TabUtils.ts";
import { BlockBase, BlockType } from "./BlockBase.ts";
import { DataContainerParseCode } from "./DataContainer.ts";

class BlockHash extends BlockBase {

    public parseIncData(nextChar: number): DataContainerParseCode {
        if (this.blockDataRaw.length > 32) {
            return DataContainerParseCode.UNEXPECTED_DATA;
        }

        return DataContainerParseCode.OK_CONTINUE;
    }

    public newInstance(): BlockBase {
        return new BlockHash();
    }

    public getBlockType(): number {
        return BlockType.HASH;
    }

    public computeHash(rawData: Uint8Array) {
        this.blockDataRaw = Binary.computeSHA256(rawData);
        console.log("BlockHash::computeHash : " + Binary.arrayUint8ToHex(this.blockDataRaw));
    }

    public check(rawData: Uint8Array): boolean {
        const tmpHash = Binary.computeSHA256(rawData);

        console.log("BlockHash::check : Hash blockDataRaw = " + Binary.arrayUint8ToHex(this.blockDataRaw));
        console.log("BlockHash::check : Hash rawData      = " + Binary.arrayUint8ToHex(tmpHash));

        if ((this.blockDataRaw === undefined) || (tmpHash.length !== this.blockDataRaw.length)) {
            console.log("BlockHash::check : KO length !");
            // return false;
        } else {
            for (let i = 0; i < this.blockDataRaw.length; i++) {
                if (this.blockDataRaw[i] !== tmpHash[i]) {
                    console.log("BlockHash::check : KO data @" + i);
                    return false;
                }
            }
        }
        console.log("BlockHash::check : OK");
        return true;
    }

}

export default BlockHash;