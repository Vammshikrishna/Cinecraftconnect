interface Entry {
  promise: Promise<unknown>;
  at: number;
  pending: boolean;
}

const entries = new Map<string, Entry>();

/**
 * Runs `load` once per key: callers that ask while it is still running share the same request, and for `ttlMs` after it
 * finished they get the same answer. A failed load is forgotten so the next caller tries again. Pass `force` to skip the
 * saved answer (for example right after the person changed something).
 */
export function sharedFetch<T>(key: string, load: () => Promise<T>, ttlMs = 0, force = false): Promise<T> {
  const existing = entries.get(key);
  if (existing && !(force && !existing.pending) && (existing.pending || Date.now() - existing.at < ttlMs)) {
    return existing.promise as Promise<T>;
  }
  const entry: Entry = { promise: load(), at: Date.now(), pending: true };
  entries.set(key, entry);
  entry.promise.then(
    () => {
      entry.pending = false;
      entry.at = Date.now();
    },
    () => {
      if (entries.get(key) === entry) entries.delete(key);
    },
  );
  return entry.promise as Promise<T>;
}

/** Forget saved answers whose key starts with `prefix` (all of them when empty). */
export function clearShared(prefix = ''): void {
  for (const k of Array.from(entries.keys())) if (k.startsWith(prefix)) entries.delete(k);
}
