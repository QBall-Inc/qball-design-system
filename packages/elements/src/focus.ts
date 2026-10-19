// Focus helpers shared by the chat overlay and the graph explorer.

/**
 * Focuses `node` without a keyboard-focus ring; the ring comes back when the
 * visitor next presses Tab. Uses the `focusVisible: false` focus option where
 * the browser supports it (detected by whether it reads the option), else a
 * temporary inline `outline: none` on `node` alone, cleared on its blur or the
 * next Tab. Returns null when focus did not land on `node` (detached, hidden,
 * not focusable), else a function that clears any pending suppression.
 */
export function focusWithoutRing(node: HTMLElement): (() => void) | null {
  let native = false;
  // `focusVisible` is newer than the TypeScript DOM lib's FocusOptions.
  const options: FocusOptions & { readonly focusVisible: boolean } = {
    get focusVisible(): boolean {
      native = true;
      return false;
    },
  };
  node.focus(options);
  const doc = node.ownerDocument;
  if (doc.activeElement !== node) return null;
  if (native) return () => {};

  const { style } = node;
  const previousValue = style.getPropertyValue("outline");
  const previousPriority = style.getPropertyPriority("outline");
  style.setProperty("outline", "none", "important");
  let cleared = false;
  const clear = (): void => {
    if (cleared) return;
    cleared = true;
    node.removeEventListener("blur", clear);
    doc.removeEventListener("keydown", onKey, true);
    if (previousValue === "") style.removeProperty("outline");
    else style.setProperty("outline", previousValue, previousPriority);
  };
  const onKey = (event: KeyboardEvent): void => {
    if (event.key === "Tab") clear();
  };
  node.addEventListener("blur", clear);
  doc.addEventListener("keydown", onKey, true);
  return clear;
}
