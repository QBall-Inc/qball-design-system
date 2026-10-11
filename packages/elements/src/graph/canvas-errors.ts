// The typed failure a GraphCanvas mount rejects with. Consumers branch on
// `code` to show their own message (or keep the canvas error figure).

export type GraphCanvasErrorCode =
  /** The optional `three` peer could not be imported (not installed, or the chunk failed to load). */
  | "three-unavailable"
  /** The browser could not create a WebGL context, or lost it after mount. */
  | "webgl-unavailable"
  /** The `data` option is not a valid SkeletonBundle (see `cause`, a BundleValidationError). */
  | "invalid-bundle"
  /** The canvas colour tokens did not resolve: `@qball-inc/tokens/graph.css` is not loaded. */
  | "missing-styles";

export class GraphCanvasError extends Error {
  readonly code: GraphCanvasErrorCode;

  constructor(code: GraphCanvasErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "GraphCanvasError";
    this.code = code;
  }
}
