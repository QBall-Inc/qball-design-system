import { Command } from "cmdk";
import { useMemo } from "react";

/**
 * Search — command-palette search/autocomplete built on `cmdk`.
 *
 * cmdk supplies the headless behavior (built-in fuzzy filtering, roving
 * keyboard navigation, combobox/listbox ARIA), and the visuals come entirely
 * from the shipped `@qball-inc/tokens` classes: the input is painted with
 * `.input`, the results panel with `.menu`, and each result with `.menu__item`
 * (the same dropdown surface `Select` paints). cmdk is additive — it ships no
 * conflicting CSS, so applying the token classes on top is sufficient and no
 * component CSS is authored (the loading/empty rows use structural padding +
 * the `--text-muted` token only, mirroring the oracle's inline-token style).
 *
 * Filtering is cmdk's built-in matcher over each item's `label`; selecting a
 * result (click or Enter) fires `onSelect` with the full item object.
 */
export interface SearchItem {
  /** Stable identity; used as the React key. */
  id: string;
  /** Visible text; also the value cmdk filters against. */
  label: string;
  /** Optional group heading the item is bucketed under. */
  group?: string;
}

export interface SearchProps {
  /** The selectable items. */
  items: SearchItem[];
  /** Fired with the selected item when a result is chosen (click or Enter). */
  onSelect: (item: SearchItem) => void;
  /** Placeholder for the search input. */
  placeholder?: string;
  /** Text shown when the query matches no items. Default `"No results found."`. */
  emptyText?: string;
  /** Show a loading row instead of (or alongside) results. */
  isLoading?: boolean;
  /** Disable the input and all results. */
  disabled?: boolean;
  /** Accessible label for the search input + command region. Default `"Search"`. */
  label?: string;
}

const mutedRowStyle = { padding: "var(--space-sm)", color: "var(--text-muted)" } as const;

export function Search({
  items,
  onSelect,
  placeholder,
  emptyText = "No results found.",
  isLoading = false,
  disabled = false,
  label = "Search",
}: SearchProps) {
  // Partition into ungrouped items + named groups, preserving first-seen order.
  const { ungrouped, groups } = useMemo(() => {
    const ungroupedItems: SearchItem[] = [];
    const grouped = new Map<string, SearchItem[]>();
    for (const item of items) {
      if (item.group === undefined || item.group === "") {
        ungroupedItems.push(item);
      } else {
        const bucket = grouped.get(item.group) ?? [];
        bucket.push(item);
        grouped.set(item.group, bucket);
      }
    }
    return { ungrouped: ungroupedItems, groups: grouped };
  }, [items]);

  const renderItem = (item: SearchItem) => (
    // cmdk keys an item's selection/highlight identity on `value`; using the
    // unique `id` (not `label`) keeps two same-label items distinct, while
    // `keywords` preserves label-based filtering through cmdk's default matcher.
    <Command.Item
      key={item.id}
      value={item.id}
      keywords={[item.label]}
      disabled={disabled}
      className="menu__item"
      onSelect={() => {
        onSelect(item);
      }}
    >
      {item.label}
    </Command.Item>
  );

  return (
    <Command label={label}>
      <Command.Input
        className="input"
        placeholder={placeholder}
        aria-label={label}
        disabled={disabled}
      />
      <Command.List className="menu">
        {isLoading ? (
          <Command.Loading>
            <div style={mutedRowStyle}>Loading…</div>
          </Command.Loading>
        ) : null}
        <Command.Empty>
          <div style={mutedRowStyle}>{emptyText}</div>
        </Command.Empty>
        {ungrouped.map(renderItem)}
        {[...groups.entries()].map(([groupName, groupItems]) => (
          <Command.Group key={groupName} heading={groupName}>
            {groupItems.map(renderItem)}
          </Command.Group>
        ))}
      </Command.List>
    </Command>
  );
}
