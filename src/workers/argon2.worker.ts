import { argon2id } from 'hash-wasm';

/**
 * Sel fixe (voir README, section Security notes) : l'app ne stocke aucun
 * sel séparément, le hash doit rester reproductible depuis la seule
 * passphrase.
 */
const ARGON2_FIXED_SALT = new Uint8Array(16);

self.onmessage = async (event: MessageEvent<{ id: number; password: string }>) => {
  const { id, password } = event.data;
  try {
    const hash = await argon2id({
      password,
      salt: ARGON2_FIXED_SALT,
      parallelism: 1,
      iterations: 2,
      memorySize: 19456, // 19 MiB
      hashLength: 32,
      outputType: 'binary',
    }) as Uint8Array;

    // Transfert sans copie du buffer sous-jacent.
    (self as any).postMessage({ id, hash }, [hash.buffer]);
  } catch (error) {
    (self as any).postMessage({ id, error: String(error) });
  }
};