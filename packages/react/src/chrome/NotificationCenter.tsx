import * as Popover from "@radix-ui/react-popover";
import type { KeyboardEvent, ReactNode } from "react";

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

function MarkIcon({ kind }: { kind?: NotificationKind | undefined }) {
  if (kind === "up") {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M7 17 17 7" />
        <path d="M7 7h10v10" />
      </svg>
    );
  }
  if (kind === "down") {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M7 7 17 17" />
        <path d="M17 7v10H7" />
      </svg>
    );
  }
  if (kind === "warn") {
    return (
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m10.3 3.9-8.2 14a2 2 0 0 0 1.7 3h16.4a2 2 0 0 0 1.7-3l-8.2-14a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
    );
  }
  // info (default)
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

function BellOffIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8.7 3A6 6 0 0 1 18 8c0 1.6.2 3 .6 4.2" />
      <path d="M17 17H3a2 2 0 0 0 2-2V8a6 6 0 0 1 1-3.3" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      <path d="m2 2 20 20" />
    </svg>
  );
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
                <BellOffIcon />
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
