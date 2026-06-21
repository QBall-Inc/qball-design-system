import { IconBase } from "../IconBase";
import type { IconProps } from "../icon-props";

/**
 * `linkedin` — the LinkedIn mark (in-repo stroke glyph carried from the consumer;
 * Lucide removed brand icons, so it is NOT in lucide@1.17.0, §12). Stroke idiom —
 * a minor, owner-accepted inconsistency vs the filled brand marks. Nominative use
 * only — a trademark of its owner (see MARKS.md).
 */
export function LinkedIn(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </IconBase>
  );
}
