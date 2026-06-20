import Markdown, { defaultUrlTransform } from "react-markdown";
import type { Components } from "react-markdown";

/**
 * MarkdownRenderer — renders streamed assistant text (the Terminal's bot turns,
 * WP-B-4.1a) as sanitized, token-styled markdown. Scoped to assistant prose; NOT
 * a general-purpose HTML renderer (the element allowlist is the hard boundary).
 *
 * **Token styling is inherited, not declared (compose the shipped surface).** The
 * renderer emits BARE semantic elements (`<h1>`-`<h4>`, `<p>`, `<blockquote>`,
 * `<code>`, `<pre><code>`, `<a>`, `<em>`, `<strong>`, lists, `<hr>`). The shipped
 * `@qball-inc/tokens` `colors_and_type.css` already styles every one of those bare
 * elements token-backed (`h1,.h1` … `blockquote,.pullquote` … `pre,.codeblock` …
 * `a,.link`), exactly as the `preview/code-block.html` + `preview/pull-quote.html`
 * oracles do. So this component ships ZERO prose CSS, zero hardcoded hex, zero font
 * strings — the styling rides the global stylesheet the consumer already imports.
 * Anchors carry `.link` so the shared sage `:focus-visible` ring applies to prose
 * links (the ring was extended to `.link:focus-visible` in this WP).
 *
 * **Safe-rendering strategy (BINDING, AC-3/AC-4).** No `dangerouslySetInnerHTML`,
 * ever. Three layers, default-deny:
 *  1. No `rehype-raw` + `skipHtml` → raw HTML in the source (`<script>`,
 *     `<img onerror>`, `<iframe>`, `<style>`, `<svg onload>`) is never turned into
 *     live DOM; it is stripped, not escaped-and-shown.
 *  2. `allowedElements` (the {@link ALLOWED_ELEMENTS} allowlist) → only the scoped
 *     prose set can render; anything else is dropped (`unwrapDisallowed` keeps the
 *     inner text so content is never silently lost).
 *  3. `urlTransform` → react-markdown's own hardened `defaultUrlTransform`, applied
 *     at the prop AND re-applied defensively inside the anchor override. It tests the
 *     ENTIRE pre-colon slice against a safe-scheme set, so only http/https/mailto/
 *     irc/xmpp and scheme-less (relative/fragment/protocol-relative) URLs survive;
 *     `javascript:`/`data:`/`vbscript:` — and control-char or zero-width-prefixed
 *     scheme tricks a hand-rolled regex would miss — collapse to an empty href.
 * The dual-assert XSS suite (AC-9) verifies each payload BOTH does not execute
 * (`window.__xss` stays undefined) AND does not appear as a DOM element.
 *
 * **Streaming cursor is the shipped `.term__cursor` (compose, don't re-invent).**
 * When `streaming`, a `.term__cursor` block is appended after the content — the
 * same class the Terminal renders for an in-flight bot turn. Its blink keyframe and
 * the `@media (prefers-reduced-motion: reduce) { animation: none }` static fallback
 * (NFR5) are shipped CSS, so there is no `matchMedia` here and no new cursor rule.
 * (When this renderer is later wired INTO the Terminal in place of its plain-text
 * flatten, the Terminal's own cursor is de-duplicated against this one — a future
 * WP; out of scope here.)
 */

/** The hard scope boundary: only these elements may render. Everything else drops. */
export const ALLOWED_ELEMENTS = [
  "h1",
  "h2",
  "h3",
  "h4",
  "p",
  "code",
  "pre",
  "blockquote",
  "a",
  "em",
  "strong",
  "ol",
  "ul",
  "li",
  "hr",
] as const;

/**
 * Element overrides. Anchors get `.link` (focus-ring + the shipped link token) and a
 * defence-in-depth href re-sanitize. No other element is overridden — the bare tags
 * inherit the shipped prose styles.
 */
const MD_COMPONENTS: Components = {
  a: ({ children, href }) => (
    // `urlTransform` (defaultUrlTransform) already ran on this href upstream; we
    // re-apply it here so the anchor stays safe even if that prop is ever removed or
    // its contract changes — a self-contained second barrier on the link sink.
    <a
      className="link"
      href={href === undefined ? undefined : defaultUrlTransform(href)}
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
};

export interface MarkdownRendererProps {
  /** The markdown source to render (a streamed assistant turn's accumulated text). */
  content: string;
  /** While true, append the shipped `.term__cursor` after the content. Default false. */
  streaming?: boolean;
  /** className merged onto the wrapper. */
  className?: string;
}

export function MarkdownRenderer({ content, streaming = false, className }: MarkdownRendererProps) {
  return (
    <div className={className}>
      <Markdown
        allowedElements={ALLOWED_ELEMENTS}
        unwrapDisallowed
        skipHtml
        urlTransform={defaultUrlTransform}
        components={MD_COMPONENTS}
      >
        {content}
      </Markdown>
      {streaming ? (
        <span className="term__cursor" aria-hidden="true" data-testid="md-cursor" />
      ) : null}
    </div>
  );
}
