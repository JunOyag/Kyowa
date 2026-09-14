import sha512 from 'crypto-js/sha512';
import sha256 from 'crypto-js/sha256';
import Binary from '../util/Binary.ts';

interface hashFct {
    (input : string) : any;
}

class HashAlgo {

    public static tabHashAlgos: HashAlgo[] = [
        new HashAlgo("SHA-512", sha512),
        new HashAlgo("SHA-256", sha256)
    ];

    private code: string;
    private fct: hashFct;

    constructor(code: string, fct: hashFct) {
        this.code = code;
        this.fct = fct;
    }

    public getCode(): string {
        return this.code;
    }

    public getFct(): hashFct {
        return this.fct;
    }

    public static fromCode(code:string) : HashAlgo | undefined {
        return this.tabHashAlgos.find((item) => item.getCode() === code);
    }
}

class Credentials {

    

    private hashAlgo: string;
    private passMaster: string;

    private hash: number[];
    private hashValid: boolean;

    constructor(hashAlgo?: string, passMaster?: string) {
        this.hashAlgo = hashAlgo || HashAlgo.tabHashAlgos[0].getCode();
        this.passMaster = passMaster || "";
        this.hashValid = false;
    }

    public getHashAlgo(): string {
        return this.hashAlgo;
    }

    public getPassMaster(): string {
        return this.passMaster;
    }

    public setHashAlgo(newHash: string) {
        this.hashAlgo = newHash;
        this.hashValid = false;
    }

    public setPassMaster(newPass: string) {
        this.passMaster = newPass;
        this.hashValid = false;
    }

    public getHash(): number[] {
        if (this.hashValid !== true) {
            let hashAlgoItem = HashAlgo.fromCode(this.hashAlgo);
            if (hashAlgoItem === undefined) {
                // Fall back to default hash algo
                hashAlgoItem = HashAlgo.tabHashAlgos[0];
            }

            let tabInt32 = hashAlgoItem.getFct()(this.getPassMaster()).words;
            this.hash = Binary.arrayInt32ToUint8(tabInt32);

            // console.log("hash : " + Binary.arrayUint8ToHex(this.hash));

            this.hashValid = true;
        }
        return this.hash;
    }

    public toString(): string {
        return "hash algo : " + this.hashAlgo + " ; pass : " + this.passMaster;
    }

    public equals(other: Credentials): boolean {
        return ((this.getHashAlgo() === other.getHashAlgo()) && (this.getPassMaster() === other.getPassMaster()));
    }
}

export default Credentials;