import type { ComponentPropsWithoutRef } from "react";

/**
 * Props shared by the canvas background primitives. Standard `<canvas>` attributes
 * (`className`, `style`, `id`, …) are spread onto the element so a consumer can
 * size and position it (the backgrounds fill their parent via CSS). The `ref` is
 * owned by the primitive (it drives the animation) and the canvas is always
 * `aria-hidden` — these decorative surfaces carry no semantic content.
 */
export type BackgroundProps = ComponentPropsWithoutRef<"canvas">;
