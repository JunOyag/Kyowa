import {CarrierManagerBase} from './CarrierManagerBase.ts';
import CarrierManagerJPG from './CarrierManagerJPG.ts';
import CarrierManagerPNG from './CarrierManagerPNG.ts';

class CarrierFactory {


    private tabCarrierManager: Array<CarrierManagerBase> = [new CarrierManagerPNG(), new CarrierManagerJPG()];
    private allMimeTypes : string[];

    private static instance: CarrierFactory;

    constructor() {
        if (!CarrierFactory.instance) {
            CarrierFactory.instance = this;
            this.allMimeTypes = this.concatAcceptedMimeTypes();
        }
        return CarrierFactory.instance;
    }

    public getAllMimeTypes() : string[] {
        return this.allMimeTypes;
    }

    private concatAcceptedMimeTypes() : string[] {
        let ret : string[] = [];

        this.tabCarrierManager.forEach((element) => {
            ret = ret.concat(element.getAcceptedMimeTypes());
        });

        return ret;
    }

    public getCarrierManager(file) : CarrierManagerBase | undefined {
        if ((file === null) || (file.type === null))
            return undefined;

        const mimeType = file.type;

        let res = this.tabCarrierManager.find((value) => (value.accept(mimeType)));
        if (res === undefined) {
            return res;
        }
        
        return res.newInstance();
    }

}

const CarrierFactoryInstance = new CarrierFactory();
Object.freeze(CarrierFactoryInstance);

export default CarrierFactoryInstance;