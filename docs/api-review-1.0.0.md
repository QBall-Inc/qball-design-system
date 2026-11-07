# `@qball-inc/elements` 1.0.0 — API review

The public surface frozen at 1.0.0. From 1.0.0 on, everything listed here follows the house
semver contract (`CAVEATS.md` → Versioning; `RELEASING.md`). Removing or renaming anything
below, or changing what it renders in a way a consumer can see, is a MAJOR change. Adding is a
MINOR change.

Inventory method: every `export` in the four entry files (`src/index.ts`, `src/trust/index.ts`,
`src/chat/index.ts`, `src/graph/index.ts`), every member of each exported options, handle and
event-map interface, and every CSS class that `docs/consumer-handback-elements.md` tells a
consumer to touch.

## Entry points

The `exports` map has exactly four entries. The `files` allowlist is `dist`, `package.json` and
`README.md`.

| Entry     | Pulls three.js                                                     | Purpose                                                                    |
| --------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `.`       | never                                                              | data contract, validator, claim helpers, locked strings, answer-turn model |
| `./trust` | never                                                              | claim card, source rows, provenance footer, verdict stamp, answer feedback |
| `./chat`  | never                                                              | launcher + overlay, transcript, answers, notices                           |
| `./graph` | lazily, at canvas mount (optional peer `three@>=0.186.0 <0.187.0`) | canvas, facet bar, entity panel, explorer, server-side layout              |

## `.` (root)

- **Values:** `ENTRY`, `isSourceUnavailable`, `BundleValidationError`, `validateSkeletonBundle`,
  `isSuperseded`, `resolveReplacement`, `confidenceMark`, `LOCKED_SEPARATOR`, `answerFooter`,
  `canvasStatus`, `groundedExplanation`, `panelFooter`, `refusedExplanation`, `sourcesLine`,
  `withheldExplanation`, `AnswerTurn`.
- **Types:** `BundleFacets`, `BundleLayout`, `BundleNode`, `BundleStats`, `Claim`, `ClaimSource`,
  `ComentionEdge`, `ConnectionDetail`, `FacetPair`, `SkeletonBundle`, `SourceRef`, `TypedEdge`,
  `UnavailableSource`, `Replacement`, `ConfidenceMark`, `ConfidenceTier`, `AbstainedMark`,
  `AnswerFooterInput`, `EvidenceLabels`, `PanelFooterInput`, `RefusalKind`, `AnswerBlock`,
  `AnswerBody`, `AnswerInline`, `AnswerListItem`, `AnswerProvenance`, `AnswerTurnOptions`
  (`earlyDisplay`, `onWarn`), `FinalTurn`, `GroundedTurn`, `RefusedTurn`, `SiteLink`,
  `SiteLinks`, `TurnError`, `TurnView`, `Verdict`, `WithheldTurn`.

## `./trust`

- **Values:** `ENTRY`, `safeInternalUrl`, `REPLACEMENT_UNAVAILABLE`, `renderClaimCard`,
  `SOURCE_UNAVAILABLE`, `renderReadingList`, `renderSourceRow`, `renderProvenanceFooter`,
  `markStampSeen`, `renderVerdictStamp`, `verdictExplanation`, `renderFeedback`.
- **Types and members:**
  - `ClaimCardOptions`: `replacement`, `sourceBadges`, `trustMarks` (new in 1.0)
  - `TrustMarks` (new in 1.0): `stamp`, `footer`, `endorsed`, `verified`, `superseded`,
    `confidence`. Every key defaults to `true`. An unknown key or a non-boolean value throws.
  - `SourceRowOptions`: `sourceBadges`, `openLinksInNewTab`, `newTabLabel`
  - `SourceBadge`; `SourceBadgeOptions`: `domains`
  - `VerdictInput`; `VerdictStampOptions`: `onOpen`, `labels`
  - `FeedbackChange`, `FeedbackValue`; `FeedbackOptions`: `onChange`, `initial`

## `./chat`

- **Values:** `ENTRY`, `isOpenHotkey`, `mount`, `MASCOT_SVG`, `defaultMascot`,
  `TRANSCRIPT_DEFAULTS`, `mountTranscript`, `ANSWER_DEFAULTS`, `renderAnswer`,
  `renderErrorAnswer`, `renderNotice`.
- **Types and members:**
  - `ChatMountOptions`: `title`, `hint`, `placeholder`, `disclaimer`, `label`, `mascot`,
    `variant`, `onStage`, `hotkey`, `suppressHotkey`, `onAsk`
  - `ChatHandle`: `open`, `close`, `toggle`, `isOpen`, `body`, `launcher`, `overlay`,
    `setHidden`, `setComposerDisabled`, `isComposerDisabled`, `relayFeedback`, `on`, `destroy`
  - `ChatEventMap` / `ChatEventType`: `open`, `close`, `ask`, `feedback` (dispatched on the host;
    they do not bubble)
  - `LauncherVariant`: `corner` | `post-page`
  - `TranscriptOptions`: `userPrompt`, `botPrompt`, `intro` (new in 1.0), `earlyDisplay`,
    `onWarn`, `errorText`, `onFeedback`, `answer`, `openLinksInNewTab`, `newTabLabel`
  - `TranscriptHandle`: `container`, `addUserTurn`, `addBotTurn`, `addNotice`, `clear`, `destroy`
  - `BotTurnOptions`: `turnRef`, `initialFeedback`; `TranscriptNoticeOptions`: `action`
  - `AnswerOptions`: `feedback`, `onStampOpen`, `labels`, `sourceBadges`, `allowedOrigins`,
    `explorerLinkLabel`, `withheldLead`, `onWarn`, `openLinksInNewTab`, `newTabLabel`,
    `trustMarks` (new in 1.0)
  - `AnswerFeedbackOptions`: `turnRef`, `onChange`, `initial`
  - `NoticeAction`; `NoticeOptions`: `action`, `allowedOrigins`, `openLinksInNewTab`,
    `newTabLabel`
  - `TrustMarks` (re-exported type)

## `./graph`

- **Values:** `ENTRY`, `loadThree`, `LAYOUT_VERSION` (= 1), `computeLayout`, `GraphCanvas`,
  `GRAPH_CANVAS_MARKER`, `DEFAULT_CANVAS_LABELS`, `GraphCanvasError`, `FacetFilterBar`,
  `EntityPanel`, `buildFacetModel`, `DEFAULT_FACET_BAR_LABELS`, `DEFAULT_PANEL_LABELS`,
  `GraphExplorer`, `DEFAULT_EXPLORER_LABELS`.
- **Types and members:**
  - `GraphCanvasOptions`: `data`, `labels`, `hint`, `legend`, `chip`, `draggable`,
    `neighborBudget`, `labelBudget`, `suppressKeys`, `errorUi`
  - `GraphCanvasHandle`: `select`, `clearSelection`, `expandNeighbors`, `setFilter`, `setData`,
    `settled`, `snapshotDate`, `on`, `destroy`
  - `GraphCanvasEventMap` / `GraphCanvasEventType`: `select`, `clear`, `filter`, `retry`, `error`
  - `GraphNeighbor`, `GraphSelectDetail`, `GraphCanvasErrorCode`, `CanvasLabels`, `ClassLabels`
  - `FacetFilterBarOptions`: `nodes`, `taxonomy`, `domainLabels`, `labels`, `onChange`
  - `FacetFilterBarHandle`: `active`, `activeCount`, `clear`, `setData`, `destroy`;
    `FacetFilterChange`
  - `EntityPanelOptions`: `stats`, `detail`, `labels`, `sourceBadges`, `trustMarks` (new in
    1.0), `onCrumb`, `onSelect`, `onShowMore`, `onWarn`, `headAction`
  - `EntityPanelHandle`: `show`, `setNeighbors`, `idle`, `setStats`, `destroy`;
    `EntityPanelView`, `HopRequest`
  - `ChipCount`, `FacetChip`, `FacetModel`, `FacetTaxonomy`, `FacetBarLabels`, `PanelLabels`
  - `GraphExplorerOptions`: `bundle`, `taxonomy`, `domainLabels`, `detail`, `labels`,
    `panelLabels`, `facetLabels`, `canvas`, `sourceBadges`, `trustMarks` (new in 1.0),
    `autoOpen`, `suppressKeys`, `onWarn`
  - `ExplorerCanvasOptions` = `GraphCanvasOptions` without `data`, `chip`, `suppressKeys`
  - `GraphExplorerHandle`: `select`, `clearSelection`, `setData`, `openPanel`, `closePanel`,
    `path`, `panelOpen`, `canvas`, `canvasError`, `on`, `destroy`
  - `GraphExplorerEventMap` / `GraphExplorerEventType`: `pathchange`, `panel`, `error`;
    `ExplorerPathDetail`
  - `TrustMarks` (re-exported type)

## CSS classes a consumer touches

All styling ships in `@qball-inc/tokens` (`colors_and_type.css` → `components.css` →
`graph.css`). The elements build the DOM; they hold no CSS. The hand-back tells consumers to touch
only these classes:

- `qlaunch--on-stage`: toggled by the consumer on `handle.launcher` when the launcher sits
  over the dark stage. The library never touches launcher classes after mount.
- `.graphcanvas` / `.gx`: the host containers that pin the dark stage (`graph.css`).
- `qnewtab`: the visually hidden new-tab label inside links (read, not set).

Every other class is internal styling, owned by the tokens CSS. The DOM class names that elements
emits are covered by the browser tests in `packages/elements/e2e/`. A consumer stylesheet that
selects them is relying on internals. 1.0 changes two of them (see `migration-1.0.md`).

## Deprecation disposition

- No `@deprecated` or provisional surface exists in the source (searched `src/` for
  `@deprecated`, `provisional`, `TODO`, `FIXME`, excluding tests). Nothing is removed at 1.0.
- `@qball-inc/tokens` keeps `.ground-wave--sources` for tokens 1.x compatibility, even though
  elements 1.0 no longer applies it (tokens is past 1.0; removing a class would be a tokens MAJOR).
- Carried forward on purpose: `GroundedTurn.abstained` stays opt-in. The consumer turns it on
  once its backend's abstained flag is reliable.
