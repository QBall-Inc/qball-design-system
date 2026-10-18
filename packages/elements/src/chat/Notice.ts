// Notice: a designed system note inside the thread — usage limits, pauses —
// with no verdict stamp. The DS owns no limit copy: the consumer passes the
// text (a `\n` starts a new line) and an optional action. Everything lands
// through textContent / setAttribute, never innerHTML.

import { el } from "../trust/dom";
import { openInNewTab, resolveNewTab, safeInternalUrl, type NewTab } from "../trust/url";

/** A link into the consumer's own site, or a button it handles. */
export type NoticeAction = { label: string; href: string } | { label: string; onClick: () => void };

export interface NoticeOptions {
  action?: NoticeAction;
  /** Origins an absolute `href` may point at (root-relative paths are always allowed). */
  allowedOrigins?: readonly string[];
  /** Open an `href` action in a new tab (default false). */
  openLinksInNewTab?: boolean;
  /** With the switch on: words read out (visually hidden) after the link. No default. */
  newTabLabel?: string;
}

function requireText(name: string, value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new TypeError(`${name} must be a non-empty string.`);
  }
  return value;
}

function renderAction(
  action: NoticeAction,
  allowedOrigins: readonly string[],
  newTab: NewTab | null,
): HTMLElement {
  const label = requireText("action.label", action.label);
  if ("onClick" in action) {
    if (typeof action.onClick !== "function") {
      throw new TypeError("action.onClick must be a function.");
    }
    const button = el("button", "qnotice__act", label);
    button.type = "button";
    button.addEventListener("click", () => {
      action.onClick();
    });
    return button;
  }
  const href = safeInternalUrl(requireText("action.href", action.href), allowedOrigins);
  // A link that fails the internal-link policy stays visible as inert text.
  if (href === null) return el("span", "qnotice__act", label);
  const link = el("a", "qnotice__act", label);
  link.setAttribute("href", href);
  if (newTab !== null) openInNewTab(link, newTab);
  return link;
}

/** `<div class="qnotice" role="status">` with the consumer's lines and optional action. */
export function renderNotice(text: string, options: NoticeOptions = {}): HTMLElement {
  const newTab = resolveNewTab(options.openLinksInNewTab, options.newTabLabel);
  const notice = el("div", "qnotice");
  notice.setAttribute("role", "status");
  requireText("text", text)
    .split("\n")
    .forEach((lineText, index) => {
      if (index > 0) notice.append(el("br"));
      notice.append(document.createTextNode(lineText));
    });
  if (options.action !== undefined) {
    notice.append(el("br"), renderAction(options.action, options.allowedOrigins ?? [], newTab));
  }
  return notice;
}
