let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, { resolve: (v: Uint8Array) => void; reject: (e: any) => void }>();

function getWorker(): Worker {
  if (worker === null) {
    worker = new Worker(new URL('../workers/argon2.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<any>) => {
      const { id, hash, error } = event.data;
      const p = pending.get(id);
      if (!p) return;
      pending.delete(id);
      if (error) {
        p.reject(new Error(error));
      } else {
        p.resolve(hash as Uint8Array);
      }
    };
  }
  return worker;
}

/**
 * Calcule Argon2id dans un Web Worker dédié : le calcul, volontairement
 * coûteux, ne gèle jamais l'onglet principal, même avec des paramètres
 * plus élevés que ceux actuellement configurés.
 */
export function computeArgon2id(password: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, password });
  });
}