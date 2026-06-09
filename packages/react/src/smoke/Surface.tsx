import type { CSSProperties, PropsWithChildren } from "react";

export interface SurfaceProps extends PropsWithChildren {
  /** Inline style overrides merged after the token-driven base. */
  style?: CSSProperties;
}

/**
 * Smoke primitive that proves the build harness end-to-end: the JSX transform,
 * the DOM lib, the dual ESM/CJS emit, the `.d.ts` output, and the consumer
 * import path (RB-3). It is styled ONLY via `@qball-inc/tokens` CSS custom
 * properties — no hardcoded hex, no box-shadow, no pill radius (DESIGN.md FR4).
 * The custom properties resolve at runtime from the consumer's token CSS import.
 */
export function Surface({ children, style }: SurfaceProps) {
  const base: CSSProperties = {
    background: "var(--bg-surface)",
    color: "var(--text-primary)",
    border: "1px solid var(--border-default)",
  };
  return <div style={{ ...base, ...style }}>{children}</div>;
}
