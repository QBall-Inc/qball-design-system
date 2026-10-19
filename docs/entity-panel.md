---
title: Facet bar and entity panel — FacetFilterBar, EntityPanel
package: "@qball-inc/elements/graph"
tokens_source: "@qball-inc/tokens (components.css: .facetbar*, .fchip*, .epanel*, .nrow*; graph.css: the .gx dark stage)"
preview: preview/facet-filter-bar.html, preview/entity-panel.html
---

# Facet bar and entity panel

Two pieces of the knowledge-graph explorer, from `@qball-inc/elements/graph`:

- `FacetFilterBar`: the facet chips over the canvas.
- `EntityPanel`: the reading surface beside it.

Both are renderers. They hold no canvas and never fetch. You pass data in and
they report what the visitor does. The explorer organism (or your own page)
wires them to a `GraphCanvas`.

```ts
import { EntityPanel, FacetFilterBar, GraphCanvas } from "@qball-inc/elements/graph";

const graph = await GraphCanvas.mount(canvasHost, { data: bundle, chip: false });

const facets = FacetFilterBar.mount(facetHost, {
  nodes: bundle.nodes,
  taxonomy, // your backend's vocab: { domains: { [domain]: sub_domain[] } }
  domainLabels: { "ai-engineering": "AI engineering" },
  onChange: ({ predicate }) => graph.setFilter(predicate),
});

let path = [];
const panel = EntityPanel.mount(panelHost, {
  stats: bundle.stats,
  detail: ({ from, to, signal }) => loadHop(from, to, { signal }), // → ConnectionDetail
  labels: { idleTitle: "my graph" },
  onCrumb: (index) => {
    path = path.slice(0, index + 1);
    graph.select(path[index].id);
  },
  onSelect: (node) => graph.select(node.id),
  onShowMore: () => graph.expandNeighbors(),
});

graph.on("select", (e) => {
  const { node, neighbors, total } = e.detail;
  if (path.at(-1)?.id !== node.id) path = [...path, node];
  panel.show({ path, neighbors, total });
});
graph.on("clear", () => {
  path = [];
  panel.idle();
});
```

Load `colors_and_type.css`, `components.css` and, inside an explorer,
`graph.css` from `@qball-inc/tokens`.

## FacetFilterBar

`FacetFilterBar.mount(host, options) → handle`. The host's previous content is
replaced.

| Option         | Type                                  | Notes                                                                            |
| -------------- | ------------------------------------- | -------------------------------------------------------------------------------- |
| `nodes`        | `BundleNode[]`                        | The bundle's nodes; their `facets` decide each chip's matches.                   |
| `taxonomy`     | `FacetTaxonomy`                       | `{ domains: { [domain]: sub_domain[] } }`, in display order; extra keys ignored. |
| `domainLabels` | `Record<string, string>`              | Display name per domain id. A domain without one shows its id.                   |
| `labels`       | `Partial<FacetBarLabels>`             | Your wording for any string (below).                                             |
| `onChange`     | `(change: FacetFilterChange) => void` | After every chip toggle or clear.                                                |

`FacetFilterChange` is `{ active, matches, predicate }`:

- `active`: the active chips, in taxonomy order.
- `matches`: how many entities match any of them.
- `predicate`: pass it straight to `GraphCanvas.setFilter`. It is `null` when no
  chip is active, which means no filter.

The taxonomy is an option, not a bundle field. When you swap in a new revision,
pass its taxonomy too: `handle.setData(nodes, taxonomy)`.

Behaviour:

- **Chips.** There is one chip per `(domain, sub_domain)` in the taxonomy, grouped by domain. Each chip is a
  `button.fchip` with `aria-pressed`. Active chips OR together: an entity
  matches if it carries any of them.
- **Count and clear.** While at least one chip is active, `N entities match`
  and `× clear` appear. Clear resets every chip and reports a `null` predicate.
- **No search field.** Entities are found on the canvas.
- **No collapse toggle.** The `filters ▾ / ▴` toggle with its `N active` count
  belongs to the explorer frame. Read `handle.activeCount` for it.

Handle:

- `active` and `activeCount`.
- `clear()`: reports a change only if a chip was active.
- `setData(nodes, taxonomy?, domainLabels?)`: rebuilds the chips with none
  active and reports no change, because the canvas clears its own filter on
  `setData`. Omitted taxonomy or labels keep the current ones.
- `destroy()`.

### Incomplete facet data

Matching uses an entity's `facets.pairs` when present. Without pairs, a
sub-topic that several of the entity's domains share (for example `other`)
cannot be placed in one domain. That entity is counted as **unassignable** for
those chips, never guessed into one.

The design system's owner chose this disclosure form.
The chips stay usable and the gap is shown, rather than disabling the affected
chips:

- **A marked chip.** A chip with unassignable entities gets a mark (`≈`) and
  the class `is-incomplete`. Its accessible name says how many are unassignable:
  `other, incomplete: 8 unassignable`.
- **A qualified count.** When any active chip has unassignable entities, the
  count reads `N match · K unassignable`. K counts each entity once, however
  many active chips it is unassignable for.

The reason for this form: it never hides a filter and never shows a silently
incomplete count. Disabling the chips would have taken filters away from
visitors until the data improves. When every node carries `pairs`, nothing
extra renders.

## EntityPanel

`EntityPanel.mount(host, options) → handle`. It starts idle, and the host's
previous content is replaced.

| Option         | Type                                             | Notes                                                                             |
| -------------- | ------------------------------------------------ | --------------------------------------------------------------------------------- |
| `stats`        | `BundleStats`                                    | The idle meta line (`episodes`) and the footer's revision date (`snapshot_date`). |
| `detail`       | `(hop: HopRequest) => Promise<ConnectionDetail>` | Required. The detail for a hop. The panel never fetches.                          |
| `labels`       | `Partial<PanelLabels>`                           | Your wording for any string (below).                                              |
| `sourceBadges` | `SourceBadgeOptions`                             | Domain badges for claim cards and the reading list.                               |
| `onCrumb`      | `(index, node) => void`                          | A breadcrumb before the current one was activated.                                |
| `onSelect`     | `(node) => void`                                 | A connection row was activated.                                                   |
| `onShowMore`   | `() => void`                                     | The "show more" row was activated.                                                |
| `onWarn`       | `(message) => void`                              | Development warnings, e.g. why a hop's detail could not be shown.                 |
| `headAction`   | `HTMLElement`                                    | One control of yours (e.g. a hide button) at the right of the header's top row.   |

Handle:

- `show({ path, neighbors?, total? })`: `path` is the click path, oldest first.
  `neighbors` and `total` are the selection's neighbour list, for example from
  the canvas `select` event.
- `setNeighbors(neighbors, total?)`: after "show more". Only the connection rows
  are re-rendered.
- `idle()`.
- `setStats(stats)`: for a revision swap.
- `destroy()`.

Keyboard focus survives redraws: a crumb or row that changes the selection hands
focus to the new current crumb, "show more" keeps it (or moves it to the last
row once every row is shown), and a new selection scrolls the body to the top.

With `headAction`, the header's first row holds the click path (or the idle
title) on the left and your control on the right. The panel re-appends the same
element on every redraw and keeps its focus; its clicks are yours, not panel
actions. The explorer puts its `hide` control there.

The panel owns no click path. Push, truncate and re-select in your code, as in
the example above.

What it renders:

- **Idle.** Your optional `idleTitle`, the meta line (`N episodes`) and the
  idle body.
- **Header.** A breadcrumb trail where every crumb is a button and the current
  one has `aria-current`. Then the entity name and class, `N episodes`, the
  first alias (`aka “…”`), and up to five facet tags, the first in sage.
- **Hop.** With two or more entities in the path, the panel shows the hop
  between the last two, resolved through `detail`. It shows exactly one of:
  - a typed hop: `A → B · the graph asserts` and a `ClaimCard` per claim;
  - a co-mention hop: the note `no asserted relationship: these entities were
discussed together in N sources. association, not assertion.`, where N is
    the number of shared sources.

  Superseded claims are never hidden. Each shows what replaced it when the
  replacing claim is in the same hop, and "replacement not available" when it
  is not.

- **Connections.** `connections · showing N of M` heads the rows. A typed row
  reads `k claims` in sage; a co-mention row reads `discussed together · n src`
  in grey. A "show more" row appears while M > N.
- **Reading list.** The hop's sources, deduplicated by episode. Unavailable
  sources are listed as "source unavailable", never dropped.
- **Footer.** The locked panel line `N claims · M sources · revision <date> · K
superseded shown`. It sits outside the scrolling body, so it stays pinned.

### The detail callback and stale responses

The panel calls `detail({ from, to, signal })` when the last two entities of the
path change. It does not call it again for the same hop, for example when only
the neighbours grew.

- **Pending.** The hop section shows a loading line (`role="status"`).
- **Rejected or malformed.** The hop section shows an error line
  (`role="alert"`) and a retry button. A rejection, a thrown error, or a value
  that is not `{ kind: "typed", claims: [≥1] }` or `{ kind: "comention",
shared_sources: [] }` all count. Retry calls `detail` again for the same hop.
- **Stale.** A response for a hop that is no longer shown is discarded: when it
  arrives after a newer selection, it never overwrites the panel. The request's
  `signal` is aborted as soon as the selection moves to another hop (or back to
  one entity, or idle), and on `destroy()`, so you can cancel the fetch.
- **Why it failed.** Each failure (but not a stale or aborted one) is reported
  through `onWarn` (default: `console.warn` outside production) with the hop
  and the reason. A malformed claim or source inside an otherwise valid answer
  is caught the same way: the panel shows its error state rather than a
  half-drawn hop.

## Dark stage

Neither component pins a theme. A bare mount follows the page theme. Inside the
explorer root `.gx` (graph.css), every colour resolves to the dark stage
whatever the page theme: chips, panel, claim cards, source rows and the footer.
That one scope is the whole rule. The components add no stage classes of their
own.

## Labels

Every default string is lowercase, has no em-dashes, and can be replaced
through `labels`. Unknown keys and wrongly typed values throw. Function labels
receive the numbers or names shown.

`FacetBarLabels` (`DEFAULT_FACET_BAR_LABELS`):

| Key                 | Default                                         |
| ------------------- | ----------------------------------------------- |
| `group`             | `filter by facet` (accessible name)             |
| `matches`           | `(n) => "N entities match"`                     |
| `matchesIncomplete` | `(n, k) => "N match · K unassignable"`          |
| `incompleteMark`    | `≈`                                             |
| `incompleteChip`    | `(sub, k) => "sub, incomplete: K unassignable"` |
| `clear`             | `× clear`                                       |

`PanelLabels` (`DEFAULT_PANEL_LABELS`):

| Key             | Default                                                                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `idleTitle`     | empty (no title; pass your product's name)                                                                                                                  |
| `idleMeta`      | `(n) => "N episodes"`                                                                                                                                       |
| `idleBody`      | `click an entity on the canvas to begin. click a connected entity next and this panel narrates the hop with the actual claim sentences, never bare counts.` |
| `pickHop`       | `click a connected entity on the canvas, or a connection below, to narrate the hop in claims.`                                                              |
| `crumbs`        | `click path` (accessible name)                                                                                                                              |
| `classes`       | the canvas class names (merged with yours)                                                                                                                  |
| `episodes`      | `(n) => "N episodes"`                                                                                                                                       |
| `aka`           | `(alias) => "aka “alias”"`                                                                                                                                  |
| `hopAsserts`    | `(a, b) => "A → B · the graph asserts"`                                                                                                                     |
| `hopComention`  | `(a, b) => "A · B"` (also the heading while loading or failed)                                                                                              |
| `comentionNote` | `(n) => "no asserted relationship: … in N sources. association, not assertion."`                                                                            |
| `hopLoading`    | `loading the claims…`                                                                                                                                       |
| `hopError`      | `the claims could not be loaded.`                                                                                                                           |
| `retry`         | `retry`                                                                                                                                                     |
| `connections`   | `(n, m) => "connections · showing N of M"`                                                                                                                  |
| `rowClaims`     | `(k) => "k claims"`                                                                                                                                         |
| `rowComention`  | `(n) => "discussed together · n src"`                                                                                                                       |
| `showMore`      | `show more`                                                                                                                                                 |
| `remaining`     | `(n) => "n remaining"`                                                                                                                                      |
| `readingList`   | `reading list`                                                                                                                                              |

## Safety

All data (entity names, aliases, tags, taxonomy ids, domain labels, claim text,
source titles) lands through `textContent` or attributes, never as markup.
Source links follow the reading-list URL policy.

## Status

This is a renderer hand-off: it is built and tested against the input-model
fixtures (`fixtures/qubrain/taxonomy.json`, `fixtures/qubrain/detail/*.json`).
Integration with a certified backend contract is not yet proven.
