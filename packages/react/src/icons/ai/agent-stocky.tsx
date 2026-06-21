import { IconBase } from "../IconBase";
import type { IconProps } from "../icon-props";

/**
 * `agent-stocky` — original DS art: the Stocky CRT-bot mascot rendered STATIC. A
 * faithful 0.75-scale of the signed-off preview design (the preview drew it at the
 * mascot's native 32-viewBox; the icon system is a fixed 24-viewBox), in the stroke
 * idiom (antenna + screen + eyes + legs, no animation). A distinct, tree-shakeable
 * icon; the animated `StockyIcon` in `CommandDock` stays unmigrated (§10).
 * currentColor-only.
 */
export function AgentStocky(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 6 8.6 2.25" />
      <path d="M12 6 15.4 2.25" />
      <circle cx="8.6" cy="2.25" r="1.05" fill="currentColor" />
      <circle cx="15.4" cy="2.25" r="1.05" fill="currentColor" />
      <rect x="3" y="6" width="18" height="15" rx="3.4" />
      <rect
        x="5.25"
        y="8.25"
        width="13.5"
        height="10.1"
        rx="1.9"
        fill="currentColor"
        opacity="0.12"
      />
      <circle cx="9.45" cy="13.2" r="1.46" fill="currentColor" />
      <circle cx="14.55" cy="13.2" r="1.46" fill="currentColor" />
      <path d="M7.1 21v1.5M16.9 21v1.5" />
    </IconBase>
  );
}
