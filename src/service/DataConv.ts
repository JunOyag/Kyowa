import ItemData from "../model/component/ItemData.ts";
import BlockData from "../model/data/BlockData.ts";

class DataConv {


    public static fromBlockData(blk: BlockData): ItemData {
        let ret = new ItemData();
        ret.flagNameEdited = false;
        ret.flagDelete = false;
        ret.flagNew = false;
        ret.flagDecoded = blk.isDecoded();
        ret.encodedData = blk.getEncodedData();
        ret.decodedData = blk.getDecodedData();
        ret.contentType = blk.getContentType();
        ret.name = blk.getName();
        return ret;
    }

    public static toBlockData(item: ItemData): BlockData {
        let newBlk = new BlockData();
        if (item.encodedData !== null) {
            newBlk.setEncodedData(item.encodedData);
        }
        if (item.decodedData != null) {
            newBlk.setDecodedData(item.decodedData);
        } else {
            if (item.flagNew) {
                newBlk.setDecodedData(new Uint8Array(0));
            }
        }
        newBlk.setName(item.name);
        newBlk.setContentType(item.contentType);

        return newBlk;
    }
}

export default DataConv;