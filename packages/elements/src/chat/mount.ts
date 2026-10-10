// mount(): wires the launcher and the overlay into a host element — the Q
// hotkey, open/close, the composer, and typed CustomEvents on the host
// (plan AD-5). Data-agnostic: no fetching; the consumer answers `ask`.
// Touches the DOM only when called, never at module evaluation (AD-6).

import type { FeedbackChange } from "../trust/Feedback";
import {
  assertVariant,
  defaultMascot,
  renderLauncher,
  setLauncherHidden,
  type LauncherVariant,
} from "./Launcher";
import { autoGrow, lockBackground, renderOverlay, trapTab } from "./Overlay";

export interface ChatMountOptions {
  /** Panel title and dialog name (default `assistant`). */
  title?: string;
  /** Launcher caption before the Q keycap (default `ask`). */
  hint?: string;
  /** Composer placeholder (default `ask a question…`). */
  placeholder?: string;
  /** Line under the composer (default empty — the site supplies its own). */
  disclaimer?: string;
  /** Launcher accessible name (default `open <title> — or press Q`). */
  label?: string;
  /** Builds a mascot node; called for the launcher and the panel head. */
  mascot?: () => Element;
  /** `corner` (default) or the compact bottom-left `post-page` layout. */
  variant?: LauncherVariant;
  /** Light launcher ink over the dark graph stage (needs graph.css). */
  onStage?: boolean;
  /** Listen for the Q hotkey on the document (default true). */
  hotkey?: boolean;
  /** Return true to ignore Q, e.g. while another dialog of yours is open. */
  suppressHotkey?: () => boolean;
  /** Called on every submitted question (after the `ask` event). */
  onAsk?: (text: string, handle: ChatHandle) => void;
}

/** Events dispatched on the host element (they do not bubble). */
export interface ChatEventMap {
  open: CustomEvent<Record<string, never>>;
  close: CustomEvent<Record<string, never>>;
  ask: CustomEvent<{ text: string }>;
  feedback: CustomEvent<FeedbackChange>;
}

export type ChatEventType = keyof ChatEventMap;

export interface ChatHandle {
  open(): void;
  close(): void;
  toggle(): void;
  isOpen(): boolean;
  /** The overlay's message container — answer turns render here. */
  readonly body: HTMLElement;
  readonly launcher: HTMLButtonElement;
  /** The `.qoverlay` dialog root. */
  readonly overlay: HTMLElement;
  /** Hides or shows the launcher (the overlay and hotkey are unaffected). */
  setHidden(hidden: boolean): void;
  /** Re-emits an answer-feedback change as this handle's `feedback` event. */
  relayFeedback(change: FeedbackChange): void;
  /** Typed listener on the host; returns the remover. */
  on<K extends ChatEventType>(type: K, listener: (event: ChatEventMap[K]) => void): () => void;
  /** Removes both nodes and every listener; releases any open-state locks. */
  destroy(): void;
}

const DEFAULTS = {
  title: "assistant",
  hint: "ask",
  placeholder: "ask a question…",
  disclaimer: "",
} as const;

/** True when `target` is somewhere the user types (Q must stay a letter). */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return (
    target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])') !==
    null
  );
}

/** Whether a document keydown should open the overlay. */
export function isOpenHotkey(event: KeyboardEvent): boolean {
  if (event.key !== "q" && event.key !== "Q") return false;
  if (event.isComposing || event.keyCode === 229) return false;
  if (event.metaKey || event.ctrlKey || event.altKey) return false;
  if (event.repeat || event.defaultPrevented) return false;
  return !isTypingTarget(event.target);
}

function requireString(name: string, value: unknown, fallback: string): string {
  if (value === undefined) return fallback;
  if (typeof value !== "string") throw new TypeError(`${name} must be a string.`);
  return value;
}

/** Mounts the launcher + overlay into `host` and returns its handle. */
export function mount(host: HTMLElement, options: ChatMountOptions = {}): ChatHandle {
  if (!(host instanceof HTMLElement)) throw new TypeError("mount() needs a host HTMLElement.");
  const title = requireString("title", options.title, DEFAULTS.title);
  const variant = options.variant ?? "corner";
  assertVariant(variant);
  const mascot = options.mascot ?? defaultMascot;
  if (typeof mascot !== "function") throw new TypeError("mascot must be a function.");
  for (const name of ["suppressHotkey", "onAsk"] as const) {
    if (options[name] !== undefined && typeof options[name] !== "function") {
      throw new TypeError(`${name} must be a function.`);
    }
  }

  const launcher = renderLauncher({
    hint: requireString("hint", options.hint, DEFAULTS.hint),
    label: requireString("label", options.label, `open ${title} — or press Q`),
    mascot,
    variant,
    onStage: options.onStage === true,
  });
  const parts = renderOverlay({
    title,
    placeholder: requireString("placeholder", options.placeholder, DEFAULTS.placeholder),
    disclaimer: requireString("disclaimer", options.disclaimer, DEFAULTS.disclaimer),
    mascot,
  });
  const { root: overlay, input } = parts;
  const doc = host.ownerDocument;

  let opened = false;
  let destroyed = false;
  let release: (() => void) | null = null;

  const emit = <K extends ChatEventType>(type: K, detail: ChatEventMap[K]["detail"]): void => {
    host.dispatchEvent(new CustomEvent(type, { detail }));
  };

  const open = (): void => {
    if (opened || destroyed) return;
    opened = true;
    overlay.classList.add("open");
    launcher.setAttribute("aria-expanded", "true");
    release = lockBackground(overlay);
    input.focus();
    emit("open", {});
  };

  const close = (): void => {
    if (!opened || destroyed) return;
    opened = false;
    overlay.classList.remove("open");
    launcher.setAttribute("aria-expanded", "false");
    release?.();
    release = null;
    if (!launcher.hidden) launcher.focus();
    emit("close", {});
  };

  const handle: ChatHandle = {
    open,
    close,
    toggle: () => (opened ? close() : open()),
    isOpen: () => opened,
    body: parts.body,
    launcher,
    overlay,
    setHidden: (hidden) => setLauncherHidden(launcher, hidden),
    relayFeedback: (change) => emit("feedback", { value: change.value, turnRef: change.turnRef }),
    on: (type, listener) => {
      const wrapped = listener as EventListener;
      host.addEventListener(type, wrapped);
      return () => host.removeEventListener(type, wrapped);
    },
    destroy: () => {
      if (destroyed) return;
      doc.removeEventListener("keydown", onDocumentKey);
      release?.();
      release = null;
      opened = false;
      destroyed = true;
      launcher.remove();
      overlay.remove();
    },
  };

  const hotkey = options.hotkey !== false;
  const suppress = options.suppressHotkey;
  // One document listener. Closed: Q opens (when enabled). Open: Esc closes and
  // Tab stays in the panel — handled here, not on the overlay, because a click
  // on blank panel space drops focus to <body>, outside the overlay. Esc that
  // only cancels an IME composition is left alone.
  const onDocumentKey = (event: KeyboardEvent): void => {
    if (opened) {
      if (event.key === "Escape" && !event.isComposing) {
        event.preventDefault();
        close();
      } else if (event.key === "Tab" && trapTab(overlay, event)) {
        event.preventDefault();
      }
      return;
    }
    if (!hotkey || !isOpenHotkey(event)) return;
    if (suppress?.() === true) return;
    event.preventDefault();
    open();
  };
  doc.addEventListener("keydown", onDocumentKey);

  launcher.addEventListener("click", open);
  parts.scrim.addEventListener("click", close);
  parts.closeButton.addEventListener("click", close);
  input.addEventListener("input", () => autoGrow(input));
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    const text = input.value.trim();
    if (text.length === 0) return;
    input.value = "";
    autoGrow(input);
    emit("ask", { text });
    options.onAsk?.(text, handle);
  });

  host.append(launcher, overlay);
  return handle;
}
