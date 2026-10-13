import { SRGBColorSpace, NoColorSpace, TextureLoader, type Texture } from 'three';

/**
 * Carregamento progressivo de texturas com cache partilhada e tratamento de falhas.
 * Primeiro a versão de 512 px (rápida); depois, se pedido, a de 2048 px.
 */

const loader = new TextureLoader();
const cache = new Map<string, Promise<Texture>>();

export interface TextureLoadOptions {
  color?: boolean;
  anisotropy?: number;
}

export function textureUrl(name: string): string {
  return `textures/${name}`;
}

export function loadTexture(file: string, opts: TextureLoadOptions = {}): Promise<Texture> {
  const key = `${file}|${opts.color ? 'c' : 'l'}`;
  let p = cache.get(key);
  if (!p) {
    p = new Promise<Texture>((resolve, reject) => {
      loader.load(
        textureUrl(file),
        (tex) => {
          tex.colorSpace = opts.color ? SRGBColorSpace : NoColorSpace;
          if (opts.anisotropy) tex.anisotropy = opts.anisotropy;
          resolve(tex);
        },
        undefined,
        () => {
          cache.delete(key);
          reject(new Error(`Falha ao carregar a textura ${file}`));
        },
      );
    });
    cache.set(key, p);
  }
  return p;
}

/** Liberta todas as texturas em cache (ao desmontar a aplicação 3D). */
export async function disposeTextureCache(): Promise<void> {
  const entries = [...cache.values()];
  cache.clear();
  await Promise.allSettled(entries.map(async (p) => (await p).dispose()));
}

/** Executa tarefas assíncronas com concorrência limitada. */
export async function runLimited<T>(tasks: Array<() => Promise<T>>, concurrency = 2): Promise<void> {
  let i = 0;
  const worker = async () => {
    while (i < tasks.length) {
      const task = tasks[i];
      i += 1;
      if (task) await task().catch(() => undefined);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
}
