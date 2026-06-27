import * as Popover from "@radix-ui/react-popover";
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentPropsWithoutRef, FormEvent, ReactNode } from "react";

import { Plus, SearchIcon } from "../icons/generated";

/**
 * CommandDock — the floating command island (the app's bottom-center action cluster).
 *
 * Faithful to the real Stocky prototype (`preview/app-chrome-island.html` + the shipped
 * `.dock` / `.dock-pop` token CSS): a PERSISTENT bar of actions — Search · Ask Stocky · Add —
 * each its OWN trigger that opens its OWN popover ABOVE the dock (NOT a single collapsed pill
 * that expands to one panel). Painted with the shipped classes; ZERO token-CSS change.
 *
 *   - `.dock`        — the floating island bar. It is `position: absolute` (shipped CSS), so the
 *                      host shell must be `position: relative; overflow: hidden` (like the
 *                      prototype `.shell` and AppBar's floating mode). Glass + radius + the
 *                      translucent surface all live in the shipped `.dock` class.
 *   - `.dock--hidden`— the hide transform (`translateY(165%)` + fade). Applied via class when
 *                      `hidden` is set or while `hideOnScroll` is actively scrolling.
 *   - `.dock-pop`    — each action's popover wrapper (caret + z-index); Radix's popper owns
 *                      placement (`side="top"`), so the class's own absolute positioning is
 *                      overridden by Radix inline styles — same portal-escape pattern as the
 *                      React `<Tooltip>` (`.tip-pop`).
 *
 * Behavior is Radix `Popover` (portal to `<body>`, focus management, Escape/outside-click). Only
 * ONE popover is open at a time (a single controlled `openId`); scrolling closes the open popover
 * and hides the dock, matching the prototype.
 *
 * Hide-on-scroll mirrors the AppBar mechanism exactly: hide WHILE scrolling (either
 * direction), spring back 220ms after scroll STOPS — NOT a directional down-past-threshold.
 * `scrollContainer` selects the scroll source (default `window`). The listener is cleaned up on
 * unmount (no leak).
 *
 * The "Ask Stocky" popover is a MINIMAL composer + the BYO-key gate (`aiEnabled`); the full
 * conversation terminal (transcript, streaming) composes in later.
 */

/**
 * The Stocky CRT-bot mascot, painted with the shipped `.stocky-icon` family (the screen tone, the
 * sage phosphor eyes, and the scanline animation come from the token CSS — no color in source).
 */
function StockyIcon() {
  return (
    <span className="stocky-icon" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none">
        <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M16 8 11.5 3" />
          <path d="M16 8 20.5 3" />
        </g>
        <circle cx="11.5" cy="3" r="1.4" fill="currentColor" />
        <circle cx="20.5" cy="3" r="1.4" fill="currentColor" />
        <rect x="4" y="8" width="24" height="20" rx="4.5" stroke="currentColor" strokeWidth="1.6" />
        <rect className="stocky-screen" x="7" y="11" width="18" height="13.5" rx="2.5" />
        <rect className="stocky-scan" x="7.6" y="11.4" width="16.8" height="1.3" rx="0.6" />
        <circle className="stocky-eye" cx="12.6" cy="17.6" r="1.95" />
        <circle className="stocky-eye stocky-eye--r" cx="19.4" cy="17.6" r="1.95" />
        <path
          d="M9.5 28v2M22.5 28v2"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

/** A discrete command surfaced in the dock's Search popover (and reused for Add suggestions). */
export interface CommandAction {
  /** Stable identity. */
  id: string;
  /** Human label; the Search filter matches a case-insensitive substring of this. */
  label: string;
  /** Optional leading icon node. */
  icon?: ReactNode;
  /** Invoked when the row is chosen (click / Enter); the dock closes afterward. */
  onSelect: () => void;
}

type DockPopId = "search" | "ai" | "add";

export interface CommandDockProps extends Omit<ComponentPropsWithoutRef<"div">, "hidden"> {
  /** The filterable command list shown in the Search popover. */
  actions?: CommandAction[];
  /** Search input placeholder. */
  searchPlaceholder?: string;
  /** Message shown in the Search popover when the filter matches nothing. */
  noResultsLabel?: string;
  /** Enable the AI composer. When `false` (default) the composer is disabled with a BYO-key message. */
  aiEnabled?: boolean;
  /** Called with the trimmed prompt when the AI composer is submitted; clears the input. */
  onAiSubmit?: (prompt: string) => void;
  /** AI composer placeholder. */
  aiPlaceholder?: string;
  /** BYO-key gate message shown when `aiEnabled` is false. */
  aiDisabledLabel?: string;
  /** Suggestions shown in the Add popover (filtered by the add input, case-insensitive). */
  addSuggestions?: CommandAction[];
  /** Add input placeholder. */
  addPlaceholder?: string;
  /** Notified as the user types in the Add input. */
  onAddQueryChange?: (query: string) => void;
  /** Self-manage hide-while-scrolling + 220ms idle spring-back (mirrors AppBar). */
  hideOnScroll?: boolean;
  /** Scroll source for `hideOnScroll`. Default `window`. */
  scrollContainer?: HTMLElement | Window | null;
  /** Manually apply the `.dock--hidden` hide transform. */
  hidden?: boolean;
}

const POP_SIDE_OFFSET = 14;

export const CommandDock = forwardRef<HTMLDivElement, CommandDockProps>(function CommandDock(
  {
    actions = [],
    searchPlaceholder = "Search symbols & briefings…",
    noResultsLabel = "No results",
    aiEnabled = false,
    onAiSubmit,
    aiPlaceholder = "type a question…",
    aiDisabledLabel = "Add your API key to enable AI",
    addSuggestions = [],
    addPlaceholder = "Add a ticker — name or symbol…",
    onAddQueryChange,
    hideOnScroll,
    scrollContainer,
    hidden,
    className,
    ...rest
  },
  ref,
) {
  const [openId, setOpenId] = useState<DockPopId | null>(null);
  const [scrolling, setScrolling] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [addQuery, setAddQuery] = useState("");
  const [prompt, setPrompt] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (hideOnScroll !== true) return;
    const target: HTMLElement | Window = scrollContainer ?? window;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function onScroll() {
      setScrolling(true);
      setOpenId(null); // scrolling closes the open popover (prototype parity)
      // Scrolling bypasses handleOpenChange, so reset the transient search/add filters
      // here too — otherwise a stale query persists into the next open (CR-1).
      setSearchQuery("");
      setAddQuery("");
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => setScrolling(false), 220);
    }
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      target.removeEventListener("scroll", onScroll);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [hideOnScroll, scrollContainer]);

  const isHidden = hidden === true || scrolling;

  const filteredActions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q === "") return actions;
    return actions.filter((a) => a.label.toLowerCase().includes(q));
  }, [actions, searchQuery]);

  const filteredAdd = useMemo(() => {
    const q = addQuery.trim().toLowerCase();
    if (q === "") return addSuggestions;
    return addSuggestions.filter((a) => a.label.toLowerCase().includes(q));
  }, [addSuggestions, addQuery]);

  const handleOpenChange = useCallback((id: DockPopId, open: boolean) => {
    setOpenId(open ? id : null);
    // Reset the transient search/add filters on close. The AI `prompt` is authored
    // content and is INTENTIONALLY preserved across close so a half-typed question
    // isn't lost on an accidental dismiss (CR-3 — documented draft-preservation).
    if (!open && id === "search") setSearchQuery("");
    if (!open && id === "add") setAddQuery("");
  }, []);

  function runAction(action: CommandAction) {
    action.onSelect();
    setOpenId(null);
  }

  function handleAiSubmit(event: FormEvent) {
    event.preventDefault();
    if (!aiEnabled) return;
    const text = prompt.trim();
    if (text === "") return;
    onAiSubmit?.(text);
    setPrompt("");
  }

  return (
    <div
      ref={ref}
      className={["dock", isHidden ? "dock--hidden" : "", className].filter(Boolean).join(" ")}
      data-hidden={isHidden ? "true" : undefined}
      {...rest}
    >
      {/* Search — a command palette: a search input over the filterable actions list. */}
      <Popover.Root open={openId === "search"} onOpenChange={(o) => handleOpenChange("search", o)}>
        <Popover.Trigger className="btn btn--ghost btn--icon" aria-label="Search">
          <SearchIcon size={21} />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="dock-pop"
            side="top"
            sideOffset={POP_SIDE_OFFSET}
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              searchInputRef.current?.focus();
            }}
          >
            <div className="dropdown" style={{ width: "min(440px, 86vw)" }}>
              <div style={{ padding: "12px 14px" }}>
                <div className="input-wrap">
                  <input
                    ref={searchInputRef}
                    className="input"
                    type="text"
                    placeholder={searchPlaceholder}
                    value={searchQuery}
                    aria-label="Search"
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <span className="input-wrap__affix" aria-hidden="true">
                    <SearchIcon size={21} />
                  </span>
                </div>
              </div>
              {actions.length > 0 ? (
                filteredActions.length > 0 ? (
                  <div className="dropdown__sec">
                    {filteredActions.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className="dropdown__row"
                        onClick={() => runAction(a)}
                      >
                        {a.icon}
                        {a.label}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="dropdown__sec">
                    <div
                      className="dropdown__row"
                      role="status"
                      style={{ color: "var(--text-muted)", cursor: "default" }}
                    >
                      {noResultsLabel}
                    </div>
                  </div>
                )
              ) : null}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      {/* Ask Stocky — minimal AI composer + BYO-key gate (full terminal composes in later). */}
      <Popover.Root open={openId === "ai"} onOpenChange={(o) => handleOpenChange("ai", o)}>
        <Popover.Trigger
          className="btn btn--ghost btn--icon iconbtn--stocky"
          aria-label="Ask Stocky"
        >
          <StockyIcon />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="dock-pop" side="top" sideOffset={POP_SIDE_OFFSET}>
            <form
              className="dropdown"
              style={{
                width: "min(440px, 86vw)",
                padding: "12px 14px",
                display: "grid",
                gap: "10px",
              }}
              onSubmit={handleAiSubmit}
            >
              <textarea
                className="input"
                rows={2}
                placeholder={aiPlaceholder}
                aria-label="Ask Stocky"
                value={prompt}
                disabled={!aiEnabled}
                onChange={(e) => setPrompt(e.target.value)}
                style={{ resize: "none" }}
              />
              {!aiEnabled ? (
                <p style={{ margin: 0, fontSize: "11.5px", color: "var(--text-muted)" }}>
                  {aiDisabledLabel}
                </p>
              ) : null}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="submit" className="btn btn--primary" disabled={!aiEnabled}>
                  Ask
                </button>
              </div>
            </form>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <span className="dock__div" />

      {/* Add — the primary action; an add input + optional filtered suggestions. */}
      <Popover.Root open={openId === "add"} onOpenChange={(o) => handleOpenChange("add", o)}>
        <Popover.Trigger className="btn btn--primary btn--icon" aria-label="Add stock">
          <Plus size={22} strokeWidth={1.8} />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="dock-pop" side="top" sideOffset={POP_SIDE_OFFSET}>
            <div className="dropdown" style={{ width: "min(440px, 86vw)" }}>
              <div
                style={{
                  padding: "12px 14px",
                  borderBottom:
                    filteredAdd.length > 0 ? "0.5px solid var(--border-default)" : undefined,
                }}
              >
                <div className="input-wrap">
                  <input
                    className="input"
                    type="text"
                    placeholder={addPlaceholder}
                    value={addQuery}
                    aria-label="Add stock"
                    onChange={(e) => {
                      setAddQuery(e.target.value);
                      onAddQueryChange?.(e.target.value);
                    }}
                  />
                  <span className="input-wrap__affix" aria-hidden="true">
                    <Plus size={22} strokeWidth={1.8} />
                  </span>
                </div>
              </div>
              {filteredAdd.length > 0 ? (
                <div className="dropdown__sec">
                  {filteredAdd.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="dropdown__row"
                      onClick={() => runAction(a)}
                    >
                      {a.icon}
                      {a.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
});
