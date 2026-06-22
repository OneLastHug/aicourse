/**
 * Minimal, dependency-free concurrency limiter (a la p-limit).
 *
 * The user requires codex sub-agents to run with a concurrency cap of 5.
 * `createLimiter(5)` returns a function that gates any async task so that at
 * most `n` run at once.
 */
export interface Limiter {
  <T>(fn: () => Promise<T>): Promise<T>;
  readonly active: number;
  readonly pending: number;
}

export function createLimiter(n: number): Limiter {
  if (n < 1) throw new Error(`concurrency must be >= 1, got ${n}`);
  let active = 0;
  const queue: Array<() => void> = [];

  const next = () => {
    if (active >= n) return;
    const run = queue.shift();
    if (run) {
      active++;
      run();
    }
  };

  const limiter = <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const exec = () =>
        fn()
          .then(resolve, reject)
          .finally(() => {
            active--;
            next();
          });
      queue.push(exec);
      // Defer so callers can enqueue several before any start.
      Promise.resolve().then(next);
    });

  Object.defineProperty(limiter, "active", { get: () => active });
  Object.defineProperty(limiter, "pending", { get: () => queue.length });
  return limiter as Limiter;
}


/** Global shared limiter — all jobs share one pool of N concurrent slots. */
export function getGlobalLimiter(n: number): Limiter {
  const g = globalThis as { __r2lLimiter?: Limiter };
  if (!g.__r2lLimiter) g.__r2lLimiter = createLimiter(n);
  return g.__r2lLimiter;
}