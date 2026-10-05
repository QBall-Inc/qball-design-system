// DOM construction for the trust atoms (plan AD-4): data reaches the page only
// through textContent and setAttribute — never innerHTML. `document` is
// touched only when a render function runs, never at module evaluation.

/** An element with an optional class and plain-text content. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className !== undefined) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
