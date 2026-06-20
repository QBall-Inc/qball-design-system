import type { ReactNode } from "react";

import { EmptyStateFig } from "../overlay/StateFig";
import { Skeleton } from "../overlay/Skeleton";

/**
 * DigestCard — the LLM market-briefing / digest card, painted with the shipped
 * `@qball-inc/tokens` `.digest` family from the `preview/briefing.html` oracle.
 *
 * A briefing is a self-contained `<article>` with an eyebrow period, a headline,
 * a prose body, and a footer (timestamp + actions). Four states, controlled by
 * `state`:
 * - `unread` — `.digest--unread` (sage left-border) + a visible sage `.digest__dot`.
 * - `read` — `.digest--read` (dimmed); NO dot.
 * - `loading` — composes the shipped {@link Skeleton} placeholders in the digest layout.
 * - `empty` — composes the shipped {@link EmptyStateFig} ("no briefings yet").
 *
 * **Pure className wrapper (S70 D-08).** Every visual comes from the shipped
 * `.digest*` token CSS — there is no component CSS and no hardcoded color (FR4 /
 * DESIGN_DENY-clean — flat tonal tints, no elevation). The sage accent (dot +
 * border) is delivered by the `.digest__dot`
 * / `.digest--unread` classes (which resolve `var(--color-signal)`, the sage
 * token), so the component inlines no color of its own.
 *
 * **The sage dot is the non-color cue (FR4).** It is rendered ONLY in the `unread`
 * state — its DOM presence/absence (not its color) signals unread vs read, so the
 * status survives a monochrome rendering. (The oracle hides the read dot via CSS,
 * but jsdom can't observe external CSS, so we render it conditionally instead.)
 *
 * **Grounding is composed by the caller, not owned here.** A narrated number in the
 * body is annotated by dropping a {@link GroundingFlag} marker inline in `children`,
 * NEXT TO the value (the oracle: `NVDA leads [source] at +8.4%`). DigestCard is the
 * host; it does not wrap values itself.
 *
 *   <DigestCard state="unread" period="Morning briefing · 30 May"
 *     title="Your watchlist is up 1.8% pre-open" time="Generated 7:02am ET">
 *     <b>NVDA</b> leads{" "}
 *     <GroundingFlag variant="source" explainer="Live last-sale quote.">
 *       <span className="gtip__src">Nasdaq · 3:42pm ET</span>
 *     </GroundingFlag>{" "}
 *     at <b>+8.4%</b> on the week.
 *   </DigestCard>
 */

export type DigestState = "unread" | "read" | "loading" | "empty";

export interface DigestCardProps {
  /** Display state. */
  state: DigestState;
  /** Eyebrow line, e.g. `"Morning briefing · 30 May"` (`.digest__period`). unread/read. */
  period?: ReactNode;
  /** Headline (`.digest__title`). unread/read. */
  title?: ReactNode;
  /** Body prose (`.digest__body`). Compose `<GroundingFlag>` markers inline. unread/read. */
  children?: ReactNode;
  /** Footer timestamp (`.digest__time`). unread/read. */
  time?: ReactNode;
  /** Footer actions slot (`.digest__actions`) — e.g. ghost icon buttons. unread/read. */
  actions?: ReactNode;
  /** `empty` state: icon node for the EmptyStateFig (e.g. an inline SVG). */
  emptyIcon?: ReactNode;
  /** `empty` state: headline. Default `"No briefings yet"`. */
  emptyTitle?: ReactNode;
  /** `empty` state: supporting line. */
  emptyBody?: ReactNode;
  /** `empty` state: optional CTA (e.g. a `<Button>`). */
  emptyAction?: ReactNode;
  /** Merged onto the `.digest` root. */
  className?: string;
}

function join(...parts: (string | false | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function DigestCard({
  state,
  period,
  title,
  children,
  time,
  actions,
  emptyIcon,
  emptyTitle,
  emptyBody,
  emptyAction,
  className,
}: DigestCardProps) {
  if (state === "loading") {
    // Composes the shipped Skeleton (which inherits the token reduced-motion rule),
    // mirroring the digest layout so the card doesn't jump on load. aria-busy
    // announces the loading region (Skeletons are individually aria-hidden).
    return (
      <article className={join("digest", className)} aria-busy>
        <div className="digest__head">
          <Skeleton shape="circle" width={7} height={7} />
          <Skeleton width={140} height={9} />
        </div>
        <Skeleton shape="title" width="70%" />
        <div className="digest__skel">
          <Skeleton shape="text" width="100%" />
          <Skeleton shape="text" width="96%" />
          <Skeleton shape="text" width="62%" />
        </div>
        {/* footer-timestamp placeholder — mirrors the oracle so the card height
            (and the footer row) doesn't jump when the real briefing loads. */}
        <Skeleton width={120} height={9} style={{ marginTop: 2 }} />
      </article>
    );
  }

  if (state === "empty") {
    // Composes the shipped EmptyStateFig (self-centered figure) inside the card.
    return (
      <article className={join("digest", className)}>
        <EmptyStateFig
          icon={emptyIcon}
          title={emptyTitle ?? "No briefings yet"}
          body={emptyBody}
          action={emptyAction}
        />
      </article>
    );
  }

  const isUnread = state === "unread";
  const hasFoot = time !== undefined || actions !== undefined;

  return (
    <article className={join("digest", isUnread ? "digest--unread" : "digest--read", className)}>
      <div className="digest__head">
        {/* Dot rendered ONLY for unread — its presence is the non-color cue (FR4). */}
        {isUnread ? <span className="digest__dot" data-testid="digest-dot" aria-hidden /> : null}
        {period !== undefined ? <span className="digest__period">{period}</span> : null}
      </div>
      {/* `<p>` (not a fixed heading level) so the card never disturbs the consumer's
          document outline — the StateFig title precedent; the class styles it. */}
      {title !== undefined ? <p className="digest__title">{title}</p> : null}
      {children !== undefined ? <p className="digest__body">{children}</p> : null}
      {hasFoot ? (
        <div className="digest__foot">
          {time !== undefined ? <span className="digest__time">{time}</span> : null}
          {actions !== undefined ? <div className="digest__actions">{actions}</div> : null}
        </div>
      ) : null}
    </article>
  );
}
