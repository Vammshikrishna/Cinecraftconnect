/**
 * Manages unique generation IDs for each authentication lifecycle.
 * Used to detect and cancel stale async tasks that belong to a previous session.
 */

let currentGenerationId = crypto.randomUUID();

/**
 * Returns the current auth generation ID.
 */
export const getCurrentGeneration = () => currentGenerationId;

/**
 * Generates a new ID, effectively invalidating all current async auth tasks.
 */
export const rotateGeneration = () => {
  const oldId = currentGenerationId;
  currentGenerationId = crypto.randomUUID();
  console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: sessionGeneration event: generation_rotated previousId: ${oldId} nextId: ${currentGenerationId}`);
  return currentGenerationId;
};

/**
 * Utility to check if a task's generation is still current.
 */
export const isGenerationValid = (taskId: string) => taskId === currentGenerationId;
