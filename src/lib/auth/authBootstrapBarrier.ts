/**
 * Gatekeeper for the application's authentication startup sequence.
 * Ensures that high-level systems (Realtime, Sync, UI) do not activate
 * until the session is fully hydrated, bound to the device, and validated.
 */

let bootstrapPromise: Promise<void> | null = null;
let resolveBootstrap: (() => void) | null = null;
let isReady = false;

/**
 * Returns a promise that resolves once the auth bootstrap sequence is complete.
 */
export const awaitBootstrapReady = async () => {
  if (isReady) return;
  if (!bootstrapPromise) {
    bootstrapPromise = new Promise((resolve) => {
      resolveBootstrap = resolve;
    });
  }
  return bootstrapPromise;
};

/**
 * Marks the bootstrap as complete, releasing any gated systems.
 */
export const markBootstrapReady = () => {
  console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: authBootstrapBarrier event: bootstrap_released reason: all_systems_hydrated`);
  isReady = true;
  if (resolveBootstrap) {
    resolveBootstrap();
  }
};

/**
 * Resets the barrier, used during logout or app restart.
 */
export const resetBootstrap = () => {
  isReady = false;
  bootstrapPromise = null;
  resolveBootstrap = null;
};

export const getBootstrapStatus = () => isReady;
