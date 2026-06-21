import { IconBase } from "../IconBase";
import type { IconProps } from "../icon-props";

/**
 * `agent-hex` — original DS art (signed-off preview design): a hexagonal agent badge
 * with a two-eye face, in the 24-viewBox stroke idiom. No third-party source / IP.
 * currentColor-only.
 */
export function AgentHex(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m12 3 7.5 4.3v8.6L12 20.2 4.5 15.9V7.3z" />
      <circle cx="9.6" cy="11.4" r="1" />
      <circle cx="14.4" cy="11.4" r="1" />
      <path d="M9.6 15h4.8" />
    </IconBase>
  );
}
