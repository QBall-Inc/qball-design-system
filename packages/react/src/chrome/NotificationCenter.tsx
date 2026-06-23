import * as Popover from "@radix-ui/react-popover";
import type { KeyboardEvent, ReactNode } from "react";

import { ArrowDownRight, ArrowUpRight, BellOff, Info, TriangleAlert } from "../icons/generated";
import { NotificationBell } from "./AppBar";

/**
 * NotificationCenter — the app-bar bell dropdown, built on Radix `Popover`.
 *
 * The shipped `NotificationBell` (WP-B-3.7) is the Popover trigger; the panel paints the shipped
 * `.dropdown` / `.notif` token classes (matching `preview/app-chrome-island.html`). ZERO token-CSS
 * change. Radix supplies the behavior (portal to `<body>`, focus management, Escape/outside-click).
 *
 * Per-item visual treatment is SEMANTIC (owner sign-off, S84): each item's `kind`
 * (`up` | `down` | `warn` | `info`) drives the shipped `.notif__mark--*` left mark — finance/status
 * meaning, NOT a source-identity tag. Unread items are the sage-tinted `.notif__item--unread` row;
 * clicking an unread row marks it read (`onMarkRead(id)`). The unread count is derived from `items`
 * here (no shared store) and drives the bell's `.badge-count` badge — empty `items` → count 0 → no
 * badge (the WP-B-3.7 contract).
 */

/** Semantic meaning of a notification — drives the shipped `.notif__mark--*` left mark. */
export type NotificationKind = "up" | "down" | "warn" | "info";

export interface NotificationItemData {
  /** Stable identity (passed to `onMarkRead`). */
  id: string;
  /** Semantic meaning → `.notif__mark--{kind}`. Omit for a neutral mark. */
  kind?: NotificationKind;
  /** Primary message (rich nodes allowed, e.g. a bold ticker + `.notif__num`). */
  title: ReactNode;
  /** Optional secondary detail, rendered after the title. */
  body?: ReactNode;
  /** Display timestamp (e.g. "2 min ago"). */
  timestamp: ReactNode;
  /** Read state. Unread renders the `.notif__item--unread` tint + the mark-read affordance. */
  read: boolean;
  /** Invoked with the item id when an unread row is marked read (click / Enter / Space). */
  onMarkRead: (id: string) => void;
}

// Semantic mark → B2 generated glyph (15px): up → arrow-up-right, down →
// arrow-down-right (1.8 stroke); warn → triangle-alert, info → info-circle (1.7
// stroke). The glyph is the non-color cue; the `.notif__mark--{kind}` wrapper owns
// the semantic color + tint. The exact per-kind glyph mapping is preserved (S84).
function MarkIcon({ kind }: { kind?: NotificationKind | undefined }) {
  if (kind === "up") return <ArrowUpRight size={15} strokeWidth={1.8} />;
  if (kind === "down") return <ArrowDownRight size={15} strokeWidth={1.8} />;
  if (kind === "warn") return <TriangleAlert size={15} strokeWidth={1.7} />;
  // info (default)
  return <Info size={15} strokeWidth={1.7} />;
}

function NotificationRow({ item }: { item: NotificationItemData }) {
  const { id, kind, title, body, timestamp, read, onMarkRead } = item;
  const markClass = kind !== undefined ? `notif__mark notif__mark--${kind}` : "notif__mark";
  const inner = (
    <>
      <span className={markClass} aria-hidden="true">
        <MarkIcon kind={kind} />
      </span>
      <div>
        <div className="notif__txt">
          {title}
          {body !== undefined && body !== null ? <> {body}</> : null}
        </div>
        <span className="notif__time">{timestamp}</span>
      </div>
    </>
  );

  if (read) {
    return <div className="notif__item">{inner}</div>;
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onMarkRead(id);
    }
  }

  const ariaLabel = typeof title === "string" ? `Mark read: ${title}` : "Mark notification read";
  return (
    <div
      className="notif__item notif__item--unread"
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      onClick={() => onMarkRead(id)}
      onKeyDown={onKeyDown}
    >
      {inner}
    </div>
  );
}

export interface NotificationCenterProps {
  /** The notifications to show. Unread count (drives the bell badge) is derived from this. */
  items: NotificationItemData[];
  /** Panel head title. Default "Notifications". */
  title?: string;
  /** When provided, a "Mark all read" head action renders and calls this. */
  onMarkAllRead?: () => void;
  /** "Mark all read" label. */
  markAllLabel?: string;
  /** Empty-state message when `items` is empty. Default "No notifications". */
  emptyLabel?: string;
  /** When provided, a footer "View all" link renders pointing here. */
  viewAllHref?: string;
  /** Footer link label. */
  viewAllLabel?: string;
  /** Bell trigger aria-label. Defaults to NotificationBell's "Notifications". */
  bellLabel?: string;
  /** Popover alignment relative to the bell. Default "end". */
  align?: "start" | "center" | "end";
  /** Popover distance from the bell, in px. Default 6. */
  sideOffset?: number;
}

export function NotificationCenter({
  items,
  title = "Notifications",
  onMarkAllRead,
  markAllLabel = "Mark all read",
  emptyLabel = "No notifications",
  viewAllHref,
  viewAllLabel = "View all",
  bellLabel,
  align = "end",
  sideOffset = 6,
}: NotificationCenterProps) {
  const unreadCount = items.filter((i) => !i.read).length;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <NotificationBell unreadCount={unreadCount} aria-label={bellLabel} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="dropdown notif" align={align} sideOffset={sideOffset}>
          <div className="notif__head">
            <span className="notif__title">{title}</span>
            {onMarkAllRead !== undefined ? (
              <button type="button" className="notif__clear" onClick={onMarkAllRead}>
                {markAllLabel}
              </button>
            ) : null}
          </div>
          <div className="notif__list">
            {items.length === 0 ? (
              <div
                style={{
                  display: "grid",
                  placeItems: "center",
                  gap: "10px",
                  padding: "34px 16px",
                  color: "var(--text-muted)",
                }}
              >
                <BellOff size={26} strokeWidth={1.4} />
                <span style={{ fontSize: "12.5px" }}>{emptyLabel}</span>
              </div>
            ) : (
              items.map((item) => <NotificationRow key={item.id} item={item} />)
            )}
          </div>
          {viewAllHref !== undefined ? (
            <div className="notif__foot">
              <a href={viewAllHref}>{viewAllLabel}</a>
            </div>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
