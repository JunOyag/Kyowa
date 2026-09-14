import { BlockBase } from "./BlockBase.ts";
import BlockData from "./BlockData.ts";
import BlockHash from "./BlockHash.ts";
import BlockStop from "./BlockStop.ts";


class BlockFactory {

    private static instance: BlockFactory;

    private tabBlocks: BlockBase[] = [
        new BlockData(),
        new BlockHash(),
        new BlockStop(),
    ];

    public createFrom(type: number): BlockBase | undefined {
        let newBlock = this.tabBlocks.find((b => b.getBlockType() === type));
        return newBlock?.newInstance();
    }

    private constructor() {

    }

    public static getInstance(): BlockFactory {
        if (BlockFactory.instance === undefined) {
            BlockFactory.instance = new BlockFactory();
        }
        return BlockFactory.instance;
    }

}

const BlockFactoryInstance = BlockFactory.getInstance();
Object.freeze(BlockFactoryInstance);

export default BlockFactoryInstance;