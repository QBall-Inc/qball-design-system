import { IconBase } from "../IconBase";
import type { IconProps } from "../icon-props";

/**
 * `agent-droid` — original DS art (signed-off preview design): a domed droid head
 * with a single antenna and a visor band, in the 24-viewBox stroke idiom. No
 * third-party source / IP. currentColor-only.
 */
export function AgentDroid(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M5 12a7 7 0 0 1 14 0v5a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" />
      <path d="M12 5V3.5" />
      <circle cx="12" cy="2.6" r="1" />
      <rect x="8" y="11.5" width="8" height="3.6" rx="1.8" />
    </IconBase>
  );
}
