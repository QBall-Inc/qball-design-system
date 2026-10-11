// Esc ownership for the canvas. The prototype listened on `window` and fired
// whatever else was open; here Esc is the canvas's only when the visitor is on
// it, and it yields to every overlay: a visible aria-modal dialog (the ./chat
// overlay sets one), an inert-ed page, a typing target, a handler that already
// claimed the event, or the consumer's `suppressKeys`. The canvas binds no
// other key (Q belongs to ./chat).

const TYPING = 'input,textarea,select,[contenteditable]:not([contenteditable="false"])';
const DIALOG = '[aria-modal="true"],[role="dialog"],dialog[open]';

export interface EscContext {
  host: HTMLElement;
  /** Whether the pointer is currently over the host. */
  pointerInside: boolean;
  suppressKeys: (() => boolean) | undefined;
}

/** True while any aria-modal dialog in the document is actually shown. */
export function hasOpenModal(doc: Document): boolean {
  const view = doc.defaultView;
  for (const node of doc.querySelectorAll<HTMLElement>('[aria-modal="true"]')) {
    if (node.closest("[hidden]")) continue;
    const style = view?.getComputedStyle(node);
    if (style && (style.display === "none" || style.visibility === "hidden")) continue;
    return true;
  }
  return false;
}

/** Whether a keydown is an Esc the canvas should act on. */
export function isCanvasEscape(event: KeyboardEvent, ctx: EscContext): boolean {
  if (event.key !== "Escape" || event.isComposing) return false;
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return false;
  const doc = ctx.host.ownerDocument;
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest(TYPING) || target?.closest(DIALOG)) return false;
  if (ctx.host.closest("[inert]") || hasOpenModal(doc)) return false;
  if (ctx.suppressKeys?.() === true) return false;
  const focusInside = target !== null && ctx.host.contains(target);
  const nothingFocused = target === null || target === doc.body || target === doc.documentElement;
  return focusInside || (nothingFocused && ctx.pointerInside);
}
