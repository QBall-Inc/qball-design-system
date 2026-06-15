import type { ReactNode } from "react";
import { Button } from "../primitives/Button";

/**
 * StateFig — empty- and error-state figures, painted with the shipped
 * `@qball-inc/tokens` `.state-fig` classes from the `preview/states.html` oracle.
 *
 * A centered figure: an icon chip, a headline, an optional supporting line, and
 * an actions row. Every visual comes from the token CSS — `.state-fig` +
 * `.state-fig__{icon,title,msg,actions}` + the `--error` modifier; there is no
 * component CSS, no hardcoded color, no box-shadow.
 *
 * Two named exports share the anatomy:
 * - {@link EmptyStateFig} — the base `.state-fig` (neutral). For "nothing here
 *   yet" / "no results". The consumer supplies the CTA via `action`.
 * - {@link ErrorStateFig} — `.state-fig--error` (red icon chip). For a genuine
 *   failure. A `retry` callback is MANDATORY and renders the primary Retry CTA;
 *   an optional `onDismiss` renders a secondary Dismiss CTA.
 *
 * The icon is a consumer-provided React node (e.g. a `lucide-react` icon) so the
 * figure stays token-only and icon-swappable. There is no default icon. The
 * title renders as a `<p class="state-fig__title">` (consistent with the sibling
 * `Callout`) rather than a fixed heading level, so it never disturbs the
 * consumer's document outline.
 */

interface StateFigBaseProps {
  /** Icon node rendered in the `.state-fig__icon` chip (e.g. a lucide-react icon). Optional. */
  icon?: ReactNode;
  /** Headline (`.state-fig__title`). */
  title: ReactNode;
  /** Optional supporting line (`.state-fig__msg`). */
  body?: ReactNode;
  /** className merged onto the `.state-fig` root. */
  className?: string;
}

export interface EmptyStateFigProps extends StateFigBaseProps {
  /** CTA slot rendered in `.state-fig__actions` (e.g. a `<Button>` or a link). Optional. */
  action?: ReactNode;
}

export interface ErrorStateFigProps extends StateFigBaseProps {
  /** REQUIRED. Fired when the Retry CTA is activated. */
  retry: () => void;
  /** Label for the Retry CTA. Default `"Retry"`. */
  retryLabel?: string;
  /** Optional. When provided, renders a secondary Dismiss CTA. */
  onDismiss?: () => void;
  /** Label for the Dismiss CTA. Default `"Dismiss"`. */
  dismissLabel?: string;
}

function StateFigBody({ icon, title, body }: Pick<StateFigBaseProps, "icon" | "title" | "body">) {
  return (
    <>
      {/* `!== undefined` (not a falsy `icon ?` guard like Callout uses for its
          boolean `icon` prop): here `icon` is a ReactNode slot, so absence is the
          only skip condition — a provided node always renders. */}
      {icon !== undefined ? <span className="state-fig__icon">{icon}</span> : null}
      <p className="state-fig__title">{title}</p>
      {body !== undefined ? <p className="state-fig__msg">{body}</p> : null}
    </>
  );
}

export function EmptyStateFig({ icon, title, body, action, className }: EmptyStateFigProps) {
  const cls = ["state-fig", className].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      <StateFigBody icon={icon} title={title} body={body} />
      {action !== undefined ? <div className="state-fig__actions">{action}</div> : null}
    </div>
  );
}

export function ErrorStateFig({
  icon,
  title,
  body,
  retry,
  retryLabel = "Retry",
  onDismiss,
  dismissLabel = "Dismiss",
  className,
}: ErrorStateFigProps) {
  const cls = ["state-fig", "state-fig--error", className].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      <StateFigBody icon={icon} title={title} body={body} />
      <div className="state-fig__actions">
        <Button variant="secondary" onClick={retry}>
          {retryLabel}
        </Button>
        {onDismiss !== undefined ? (
          <Button variant="ghost" onClick={onDismiss}>
            {dismissLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
