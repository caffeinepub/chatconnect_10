/**
 * actorGuard.ts
 * Wraps a canister call with retry logic and error handling.
 * All components should use this instead of raw try/catch blocks.
 */

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 600,
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
      }
    }
  }
  throw lastError;
}

/**
 * Safely call a canister function. Returns undefined on failure instead of throwing.
 * Use for non-critical background operations.
 */
export async function safeCall<T>(
  fn: () => Promise<T>,
  fallback?: T,
): Promise<T | undefined> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}
