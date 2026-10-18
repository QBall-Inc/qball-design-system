// Development warnings shared by the answer model and the chat renderer:
// printed with console.warn outside production, silent in production builds.

/**
 * Bundlers replace the literal `process.env.NODE_ENV` at build time, so it is
 * read with dot access; a bare browser without `process` counts as development.
 */
function isProduction(): boolean {
  try {
    return (process.env as { NODE_ENV?: string }).NODE_ENV === "production";
  } catch {
    return false;
  }
}

/** console.warn outside production; a no-op in production builds. */
export function defaultWarn(message: string): void {
  if (!isProduction()) console.warn(message);
}
