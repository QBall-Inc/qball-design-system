import { forwardRef, useEffect, useState } from "react";
import type { ComponentPropsWithoutRef, CSSProperties, ReactNode } from "react";

import { Bell } from "../icons/generated";

/**
 * AppBar — the application top bar.
 *
 * Painted with the shipped `@qball-inc/tokens` classes `.appbar` / `.appbar__brand` /
 * `.appnav` / `.appbar__spacer` / `.appbar__right` (matching the
 * `preview/app-chrome-traditional.html` oracle). All content is injected via slots
 * (`brand`, `nav`, `actions`) — no hardcoded brand assets or nav items.
 *
 * Hybrid chrome (owner decision, S83) — defaults to a plain in-flow bar; opts into the
 * Stocky prototype's glass-floating + hide-on-scroll behavior:
 *   - `floating`     — glass overlay (position:absolute top:0, z-index, backdrop-filter
 *                      blur + translucent bg, transition). Mirrors
 *                      docs/stocky-app/prototype/dashboard.css `.appbar`. The host shell
 *                      should be `position: relative; overflow: hidden`. The shipped
 *                      `.appbar` bottom hairline persists in float mode (the prototype
 *                      keeps it too).
 *   - `hidden`       — applies the hide transform (`translateY(-130%)` + fade). Use with
 *                      `floating`. Drives the same `.appbar--hidden` look as the prototype.
 *   - `hideOnScroll` — opt-in self-managed behavior reproducing the prototype: hide WHILE
 *                      scrolling (either direction), spring back 220ms after scroll STOPS.
 *                      Implies `floating`. `scrollContainer` selects the scroll source
 *                      (default `window`; the prototype scrolls an inner `.main` pane).
 *                      The listener is cleaned up on unmount (no leak).
 *
 * Glass + hide styles are applied as inline structural styles (no hex, no box-shadow) —
 * DESIGN_DENY clean; `backdrop-filter` here is the sanctioned chrome-glass use.
 */

export interface NotificationBellProps extends ComponentPropsWithoutRef<"button"> {
  /**
   * Unread count. Renders the `.badge-count` overlay when `>= 1`; omits it when `0` or
   * `undefined`. The live value is produced by NotificationCenter (WP-B-3.8); this is the
   * passive data surface.
   */
  unreadCount?: number;
  /** Custom bell icon node; defaults to the shipped outline bell SVG. */
  children?: ReactNode;
}

/**
 * The bell icon button + unread-count badge, for the AppBar `actions` cluster. A `.iconbtn`
 * hosting the bell SVG; the `unreadCount` prop drives the overlaid `.badge-count` span.
 */
export const NotificationBell = forwardRef<HTMLButtonElement, NotificationBellProps>(
  function NotificationBell(
    { className, unreadCount, children, "aria-label": ariaLabel, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type="button"
        className={["iconbtn", className].filter(Boolean).join(" ")}
        aria-label={ariaLabel ?? "Notifications"}
        {...rest}
      >
        {children ?? <Bell size={19} />}
        {unreadCount !== undefined && unreadCount >= 1 ? (
          <span className="badge-count">{unreadCount}</span>
        ) : null}
      </button>
    );
  },
);

export interface AppBarProps extends Omit<ComponentPropsWithoutRef<"header">, "hidden"> {
  /** Brand slot (logo / wordmark) — rendered in `.appbar__brand`. */
  brand?: ReactNode;
  /** Primary navigation slot — wrapped in `<nav className="appnav">`. */
  nav?: ReactNode;
  /** Right-cluster slot (search, NotificationBell, ThemeToggle, UserMenu) — `.appbar__right`. */
  actions?: ReactNode;
  /** Render as a glass floating overlay (position:absolute, z-index, backdrop blur). */
  floating?: boolean;
  /** Apply the hide transform (`translateY(-130%)` + fade). Use with `floating`. */
  hidden?: boolean;
  /** Self-manage hide-while-scrolling + 220ms spring-back (implies `floating`). */
  hideOnScroll?: boolean;
  /** Scroll source for `hideOnScroll`. Default `window`. */
  scrollContainer?: HTMLElement | Window | null;
}

export const AppBar = forwardRef<HTMLElement, AppBarProps>(function AppBar(
  {
    brand,
    nav,
    actions,
    floating,
    hidden,
    hideOnScroll,
    scrollContainer,
    className,
    style,
    ...rest
  },
  ref,
) {
  const [scrolling, setScrolling] = useState(false);

  useEffect(() => {
    if (hideOnScroll !== true) return;
    const target: HTMLElement | Window = scrollContainer ?? window;
    let timer: ReturnType<typeof setTimeout> | undefined;
    function onScroll() {
      setScrolling(true);
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => setScrolling(false), 220);
    }
    target.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      target.removeEventListener("scroll", onScroll);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [hideOnScroll, scrollContainer]);

  const isFloating = floating === true || hideOnScroll === true;
  const isHidden = hidden === true || scrolling;

  const floatStyle: CSSProperties = isFloating
    ? {
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 30,
        background: "color-mix(in oklab, var(--bg-primary) 80%, transparent)",
        backdropFilter: "blur(14px) saturate(1.15)",
        WebkitBackdropFilter: "blur(14px) saturate(1.15)",
        transition: "transform 0.34s var(--ease-out), opacity 0.28s var(--ease-out)",
      }
    : {};
  const hiddenStyle: CSSProperties = isHidden
    ? { transform: "translateY(-130%)", opacity: 0, pointerEvents: "none" }
    : {};

  return (
    <header
      ref={ref}
      className={["appbar", className].filter(Boolean).join(" ")}
      style={{ ...floatStyle, ...hiddenStyle, ...style }}
      data-hidden={isHidden ? "true" : undefined}
      {...rest}
    >
      {brand !== undefined ? <div className="appbar__brand">{brand}</div> : null}
      {nav !== undefined ? <nav className="appnav">{nav}</nav> : null}
      <span className="appbar__spacer" />
      {actions !== undefined ? <div className="appbar__right">{actions}</div> : null}
    </header>
  );
});
