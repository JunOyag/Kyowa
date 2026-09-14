
import sha256 from 'crypto-js/sha256';


class Binary {

    public static arrayInt32ToUint8(tabIn: number[]): number[] {

        let output: number[] = [];

        let j = 0;

        for (let i = 0; i < tabIn.length; i++) {
            let w32 = tabIn[i];
            output[j++] = (w32 >>> 24) & 0xFF;
            output[j++] = (w32 >>> 16) & 0xFF;
            output[j++] = (w32 >>> 8) & 0xFF;
            output[j++] = w32 & 0xFF;
        }

        return output;
    }


    private static hex : String = "0123456789ABCDEF";

    public static arrayNumberToHex(tabIn: number[]) : String | undefined {
        let output : String = "";

        for (let i = 0; i < tabIn.length; i++) {
            let value : number = tabIn[i];

            if (value === undefined) {
                return undefined;
            }
            
            let q4 = Binary.hex.at(((value >> 4) & 0x0F));
            output += q4 || "";

            q4 = Binary.hex.at((value & 0x0F));
            output += q4 || "";
        }

        return output;
    }


    public static arrayUint8ToHex(tabIn: Uint8Array) : String | undefined {
        let output : String = "";

        for (let i = 0; i < tabIn.length; i++) {
            let value : number = tabIn[i];

            if (value === undefined) {
                return undefined;
            }
            
            let q4 = Binary.hex.at(((value >> 4) & 0x0F));
            output += q4 || "";

            q4 = Binary.hex.at((value & 0x0F));
            output += q4 || "";
        }

        return output;
    }

    public static computeSHA256(buf : Uint8Array) : Uint8Array {
        let sigBytes = (buf.length + 3) & 0xFFFFFFFC;
        let tmpI8 = new Uint8Array(sigBytes);
        tmpI8.set(buf, 0);

        let out = sha256({words:new Int32Array(tmpI8.buffer), sigBytes:sigBytes});
        let tabInt32 = out.words;
         return new Uint8Array(Binary.arrayInt32ToUint8(tabInt32));
    }

}

export default Binary;