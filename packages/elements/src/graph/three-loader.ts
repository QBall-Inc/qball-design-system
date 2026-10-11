// Loads the consumer-installed `three` peer on demand. Kept in its own module
// so the canvas can import it without a cycle through the entry barrel.

/**
 * Rejects with the bundler/runtime module-resolution error when `three` is not
 * installed — './graph' consumers must install it (documented prerequisite).
 */
export function loadThree(): Promise<typeof import("three")> {
  return import("three");
}
