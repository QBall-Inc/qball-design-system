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

/**
 * A fresh element from built-in, static SVG markup (never data). Parsed as
 * HTML in an inert document, so it lands in the SVG namespace without an
 * xmlns attribute, exactly as inline <svg> does; never innerHTML.
 */
export function staticSvg(markup: string, what: string): Element {
  const svg = new DOMParser().parseFromString(markup, "text/html").body.firstElementChild;
  if (svg === null) throw new Error(`The built-in ${what} failed to parse.`);
  return document.importNode(svg, true);
}
