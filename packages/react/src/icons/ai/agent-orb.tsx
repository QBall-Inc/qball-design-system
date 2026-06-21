import { IconBase } from "../IconBase";
import type { IconProps } from "../icon-props";

/**
 * `agent-orb` — original DS art (signed-off preview design): a core node radiating
 * concentric signal arcs, in the 24-viewBox stroke idiom. No third-party source / IP.
 * currentColor-only.
 */
export function AgentOrb(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M6.6 7.6a8 8 0 0 0 0 8.8" />
      <path d="M17.4 7.6a8 8 0 0 1 0 8.8" />
      <path d="M3.8 5a12 12 0 0 0 0 14" />
      <path d="M20.2 5a12 12 0 0 1 0 14" />
    </IconBase>
  );
}
