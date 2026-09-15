/**
 * Lightweight singleton that increments every time sync delivers new data. UI
 * screens subscribe and re-read their data on bump — instant live refresh
 * without a full store re-fetch. React-free so it works everywhere.
 */
let version = 0;

type Listener = () => void;
const listeners = new Set<Listener>();

export function getDataVersion(): number {
  return version;
}

/**
 * Subscribe to data bumps. Returns an unsubscribe function safe to call
 * multiple times (React effect cleanup).
 */
export function subscribeDataChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/**
 * Call after any sync path applies one or more rows to the local SQLite DB.
 * Multiple rapid bumps (from push, pull, WS delta) collapse into a single
 * re-render in the same JS microtask tick thanks to React batching.
 */
export function bumpDataVersion(): void {
  version++;
  // Fire synchronously so UI updates land before the JS event loop yields.
  listeners.forEach((l) => { try { l(); } catch {} });
}
