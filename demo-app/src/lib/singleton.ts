// Next.js can load a module more than once (per route bundle, and on dev reloads).
// Anything that must exist once per process lives on globalThis.
export function singleton<T>(key: string, init: () => T): T {
  const g = globalThis as unknown as Record<string, unknown>;
  const k = `__demobank_${key}`;
  if (g[k] === undefined) g[k] = init();
  return g[k] as T;
}
