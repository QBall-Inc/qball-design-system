import type { IconProps } from "./icon-props";
import { ICON_REGISTRY, type IconName } from "./generated/registry";

interface IconComponentProps extends IconProps {
  /** Icon name from the generated set — a canonical id or a recorded alias. */
  name: IconName;
}

/**
 * Dynamic, data-driven icon: `<Icon name="trending-up" />`. Use this when the icon
 * is chosen at runtime. For static use, prefer the per-icon named export
 * (`<TrendingUp />`) — it tree-shakes, whereas this registry intentionally retains
 * the whole set (importing `Icon` pulls every icon).
 */
export function Icon({ name, ...props }: IconComponentProps) {
  const Glyph = ICON_REGISTRY[name];
  // ICON_REGISTRY is exhaustive over IconName, so this is unreachable for a valid
  // name; the guard satisfies `noUncheckedIndexedAccess` and fails safe.
  if (!Glyph) return null;
  return <Glyph {...props} />;
}
