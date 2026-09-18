import sha512 from 'crypto-js/sha512';
import sha256 from 'crypto-js/sha256';
import { argon2id } from 'hash-wasm';
import Binary from '../util/Binary.ts';

interface hashFctAsync {
    (input: string): Promise<Uint8Array>;
}


function cryptoJsToUint8(wordArray): Uint8Array {
    return new Uint8Array(Binary.arrayInt32ToUint8(wordArray.words));
}

class HashAlgo {

    public static tabHashAlgos: HashAlgo[] = [
        new HashAlgo("Argon2id", async (input: string) => {
            const salt = cryptoJsToUint8(sha256(input)).slice(0,16);
            const hash = await argon2id({
                password: input,
                salt: salt,
                parallelism: 4,
                iterations: 3,
                memorySize: 64*1024, // 64 MiB
                hashLength: 32,
                outputType: 'binary',
            });
            return hash as Uint8Array;
        }),
        new HashAlgo("SHA-512", async (input: string) => cryptoJsToUint8(sha512(input))),
        new HashAlgo("SHA-256", async (input: string) => cryptoJsToUint8(sha256(input))),
    ];

    private code: string;
    private fct: hashFctAsync;

    constructor(code: string, fct: hashFctAsync) {
        this.code = code;
        this.fct = fct;
    }

    public getCode(): string {
        return this.code;
    }

    public getFct(): hashFctAsync {
        return this.fct;
    }

    public static fromCode(code: string): HashAlgo | undefined {
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

    public async getHash(): Promise<number[]> {
        if (this.hashValid !== true) {
            let hashAlgoItem = HashAlgo.fromCode(this.hashAlgo);
            if (hashAlgoItem === undefined) {
                // Fall back to default hash algo
                hashAlgoItem = HashAlgo.tabHashAlgos[0];
            }

            const bytes = await hashAlgoItem.getFct()(this.getPassMaster());
            this.hash = Array.from(bytes);

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