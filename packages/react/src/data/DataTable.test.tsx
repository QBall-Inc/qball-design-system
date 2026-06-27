import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { ColumnDef } from "@tanstack/react-table";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { componentsCss, ruleBody } from "../test-utils/css-source";
import { DataTable } from "./DataTable";

interface Stock {
  sym: string;
  last: number;
  day: number;
}

const DATA: Stock[] = [
  { sym: "AAPL", last: 198.42, day: 1.24 }, // up
  { sym: "TSLA", last: 178.1, day: -2.34 }, // down
  { sym: "MSFT", last: 432.55, day: 0.04 }, // flat
];

const COLUMNS: ColumnDef<Stock, unknown>[] = [
  { accessorKey: "sym", header: "Symbol" },
  { accessorKey: "last", header: "Last", meta: { numeric: true } },
  { accessorKey: "day", header: "Day", meta: { finance: true } },
];

describe("DataTable", () => {
  it("renders the header and one row per datum with cell content (AC-10a)", () => {
    const { container, getByText } = render(<DataTable columns={COLUMNS} data={DATA} />);
    // header renders
    expect(getByText("Symbol")).toBeTruthy();
    expect(getByText("Day")).toBeTruthy();
    // one body row per datum
    expect(container.querySelectorAll("tbody tr")).toHaveLength(3);
    // cell content present
    expect(getByText("AAPL")).toBeTruthy();
    expect(getByText("TSLA")).toBeTruthy();
    // the table carries the shipped .dt surface
    expect(container.querySelector("table")?.classList.contains("dt")).toBe(true);
  });

  it("finance up-cell pairs the .up color class with a leading '+' sign cue (AC-4 / FR4)", () => {
    const { getByText } = render(<DataTable columns={COLUMNS} data={DATA} />);
    const upCell = getByText("+1.24%").closest("td");
    expect(upCell).not.toBeNull();
    expect(upCell?.classList.contains("num")).toBe(true);
    expect(upCell?.classList.contains("up")).toBe(true);
    // the non-color cue: a leading '+'
    expect(upCell?.textContent?.startsWith("+")).toBe(true);
  });

  it("finance down-cell pairs the .down color class with a leading '-' sign cue (AC-4 / FR4)", () => {
    const { getByText } = render(<DataTable columns={COLUMNS} data={DATA} />);
    const downCell = getByText("-2.34%").closest("td");
    expect(downCell).not.toBeNull();
    expect(downCell?.classList.contains("num")).toBe(true);
    expect(downCell?.classList.contains("down")).toBe(true);
    // the non-color cue: a leading '-'
    expect(downCell?.textContent?.startsWith("-")).toBe(true);
  });

  it("finance flat-cell uses the .flat color class", () => {
    const { getByText } = render(<DataTable columns={COLUMNS} data={DATA} />);
    const flatCell = getByText("+0.04%").closest("td");
    expect(flatCell?.classList.contains("num")).toBe(true);
    expect(flatCell?.classList.contains("flat")).toBe(true);
    // the sign cue is present on flat values too (regression guard)
    expect(flatCell?.textContent?.startsWith("+")).toBe(true);
  });

  it("finance column with a non-number value falls back gracefully but keeps .num", () => {
    interface Mixed {
      sym: string;
      day: number | null;
    }
    const cols: ColumnDef<Mixed, unknown>[] = [
      { accessorKey: "sym", header: "Symbol" },
      { accessorKey: "day", header: "Day", meta: { finance: true } },
    ];
    const { getByText } = render(<DataTable columns={cols} data={[{ sym: "AAPL", day: null }]} />);
    // null is not a number → no directional class, no crash, but still right-aligned.
    const cell = getByText("AAPL").closest("tr")?.querySelectorAll("td")[1];
    expect(cell?.classList.contains("num")).toBe(true);
    expect(cell?.classList.contains("up")).toBe(false);
    expect(cell?.classList.contains("down")).toBe(false);
  });

  it("accepts an Error object and renders its message (AC-7)", () => {
    const { container, getByText } = render(
      <DataTable columns={COLUMNS} data={DATA} error={new Error("network down")} />,
    );
    expect(container.querySelector(".state-fig--error")).not.toBeNull();
    expect(getByText("network down")).toBeTruthy();
  });

  it("renders a trailing actions cell per row (AC-3c)", () => {
    const { container } = render(
      <DataTable
        columns={COLUMNS}
        data={DATA}
        actions={(row) => (
          <button className="dt__remove" aria-label={`Remove ${row.sym}`}>
            x
          </button>
        )}
      />,
    );
    expect(container.querySelectorAll("tbody .dt__remove")).toHaveLength(3);
    // a trailing header cell is added for the actions column
    expect(container.querySelectorAll("thead th")).toHaveLength(4);
  });

  it("actionsAlwaysVisible pins the actions visible via the .dt--actions-visible modifier (D-08)", () => {
    const { container } = render(
      <DataTable
        columns={COLUMNS}
        data={DATA}
        actionsAlwaysVisible
        actions={(row) => <button className="dt__remove">{row.sym}</button>}
      />,
    );
    expect(container.querySelector("table")?.classList.contains("dt--actions-visible")).toBe(true);
    expect(ruleBody(componentsCss, ".dt--actions-visible .dt__remove")).toMatch(/opacity:\s*1/);
  });

  it("toggles aria-selected on a row when selection is enabled (AC-3b, real toggle)", async () => {
    const user = userEvent.setup();
    const selectColumns: ColumnDef<Stock, unknown>[] = [
      {
        id: "select",
        header: "",
        cell: ({ row }) => (
          <button onClick={() => row.toggleSelected()}>sel {row.original.sym}</button>
        ),
      },
      ...COLUMNS,
    ];
    const { container, getByText } = render(
      <DataTable
        columns={selectColumns}
        data={DATA}
        enableRowSelection
        getRowId={(_, index) => String(index)}
      />,
    );
    // nothing selected initially
    expect(container.querySelector('tbody tr[aria-selected="true"]')).toBeNull();
    await user.click(getByText("sel AAPL"));
    const selected = container.querySelector('tbody tr[aria-selected="true"]');
    expect(selected).not.toBeNull();
    expect(selected?.textContent).toContain("AAPL");
  });

  it("loading=true renders Skeleton cells in place of data, header still renders, aria-busy set (AC-5)", () => {
    const { container, getByText, queryByText } = render(
      <DataTable columns={COLUMNS} data={DATA} loading skeletonRowCount={4} />,
    );
    // header still renders
    expect(getByText("Symbol")).toBeTruthy();
    // data is hidden behind skeletons
    expect(queryByText("AAPL")).toBeNull();
    // one Skeleton per cell: 4 rows × 3 columns
    expect(container.querySelectorAll("tbody .skel")).toHaveLength(12);
    // the loading region is announced
    expect(container.querySelector("table")?.getAttribute("aria-busy")).toBe("true");
  });

  it("renders EmptyStateFig for empty data while keeping the header (AC-6)", () => {
    const { container, getByText, queryByText } = render(<DataTable columns={COLUMNS} data={[]} />);
    expect(getByText("Symbol")).toBeTruthy(); // header still renders
    expect(container.querySelector(".state-fig")).not.toBeNull();
    expect(queryByText("No data")).toBeTruthy();
  });

  it("emptyMessage overrides the default empty headline (AC-10g)", () => {
    const { getByText, queryByText } = render(
      <DataTable columns={COLUMNS} data={[]} emptyMessage="Nothing on your watchlist" />,
    );
    expect(getByText("Nothing on your watchlist")).toBeTruthy();
    expect(queryByText("No data")).toBeNull();
  });

  it("renders ErrorStateFig and fires onRetry on the Retry CTA (AC-7)", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { container, getByText } = render(
      <DataTable columns={COLUMNS} data={DATA} error="fetch failed" onRetry={onRetry} />,
    );
    expect(container.querySelector(".state-fig--error")).not.toBeNull();
    expect(getByText("fetch failed")).toBeTruthy(); // the error message renders as the body
    await user.click(getByText("Retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("loading wins over error (skeletons, not the error figure)", () => {
    const { container } = render(<DataTable columns={COLUMNS} data={DATA} loading error="boom" />);
    expect(container.querySelector(".state-fig--error")).toBeNull();
    expect(container.querySelectorAll("tbody .skel").length).toBeGreaterThan(0);
  });

  // ---- CSS-source contracts (jsdom does not load external stylesheets) ----

  it("CSS contract: finance color classes map to the --data-* tokens", () => {
    expect(ruleBody(componentsCss, ".dt .up")).toMatch(/color:\s*var\(--data-up\)/);
    expect(ruleBody(componentsCss, ".dt .down")).toMatch(/color:\s*var\(--data-down\)/);
    expect(ruleBody(componentsCss, ".dt .flat")).toMatch(/color:\s*var\(--data-flat\)/);
  });

  it("CSS contract: row hover uses the --bg-surface token", () => {
    expect(ruleBody(componentsCss, ".dt tbody tr:hover")).toMatch(
      /background:\s*var\(--bg-surface\)/,
    );
  });

  it("CSS contract: a selected row uses the sage --signal-bg token (D-03)", () => {
    expect(componentsCss).toMatch(
      /tr\[aria-selected="true"\][^{]*\{[^}]*background:\s*var\(--signal-bg\)/,
    );
  });

  it("CSS contract: numeric cells use the display font with tabular-nums (AC-2)", () => {
    const body = ruleBody(componentsCss, ".dt .num");
    expect(body).toMatch(/font-family:\s*var\(--font-display\)/);
    expect(body).toMatch(/font-variant-numeric:\s*tabular-nums/);
  });

  it("package contract: @tanstack/react-table is an OPTIONAL peerDependency, not a dependency (AC-1)", () => {
    const pkg = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
      peerDependenciesMeta?: Record<string, { optional?: boolean }>;
    };
    expect(pkg.peerDependencies?.["@tanstack/react-table"]).toBeTruthy();
    expect(pkg.peerDependenciesMeta?.["@tanstack/react-table"]?.optional).toBe(true);
    expect(pkg.dependencies?.["@tanstack/react-table"]).toBeUndefined();
  });

  // ---- Mobile card-list reflow ----

  it("wraps the table in a .dt-wrap container host without breaking table resolution (AC-8 / AC-10e)", () => {
    const { container } = render(<DataTable columns={COLUMNS} data={DATA} />);
    // the new host wraps the table...
    expect(container.querySelector(".dt-wrap > table.dt")).not.toBeNull();
    // ...and the descendant query still resolves (regression guard)
    expect(container.querySelector("table")?.classList.contains("dt")).toBe(true);
  });

  it("sets data-label on each body cell from its string column header (AC-10a)", () => {
    const { getByText } = render(<DataTable columns={COLUMNS} data={DATA} />);
    const cells = getByText("AAPL").closest("tr")?.querySelectorAll("td");
    expect(cells?.[0]?.getAttribute("data-label")).toBe("Symbol");
    expect(cells?.[1]?.getAttribute("data-label")).toBe("Last");
    expect(cells?.[2]?.getAttribute("data-label")).toBe("Day");
  });

  it("uses meta.label as the data-label when the header is a non-string ReactNode (AC-10b)", () => {
    interface PriceRow {
      sym: string;
      px: number;
    }
    const cols: ColumnDef<PriceRow, unknown>[] = [
      { accessorKey: "sym", header: "Symbol" },
      // non-string (ReactNode) header → mobile label must come from meta.label
      {
        accessorKey: "px",
        header: () => <span>Price</span>,
        meta: { numeric: true, label: "Price" },
      },
    ];
    const { getByText } = render(<DataTable columns={cols} data={[{ sym: "AAPL", px: 198.42 }]} />);
    expect(getByText("198.42").closest("td")?.getAttribute("data-label")).toBe("Price");
  });

  it("omits data-label when a non-string header has no meta.label (documented empty-label case)", () => {
    interface PriceRow {
      sym: string;
      px: number;
    }
    const cols: ColumnDef<PriceRow, unknown>[] = [
      { accessorKey: "sym", header: "Symbol" },
      { accessorKey: "px", header: () => <span>Price</span> }, // no meta.label
    ];
    const { getByText } = render(<DataTable columns={cols} data={[{ sym: "AAPL", px: 198.42 }]} />);
    expect(getByText("198.42").closest("td")?.hasAttribute("data-label")).toBe(false);
  });

  it("keeps the finance dual-signal (color + sign) alongside its data-label in card mode (AC-4)", () => {
    const { getByText } = render(<DataTable columns={COLUMNS} data={DATA} />);
    const upCell = getByText("+1.24%").closest("td");
    expect(upCell?.classList.contains("up")).toBe(true); // color class retained
    expect(upCell?.textContent?.startsWith("+")).toBe(true); // sign cue retained
    expect(upCell?.getAttribute("data-label")).toBe("Day"); // mobile label present
  });

  it("the actions cell carries no data-label (its header is empty) (AC-5)", () => {
    const { container } = render(
      <DataTable
        columns={COLUMNS}
        data={DATA}
        actions={(row) => <button className="dt__remove">{row.sym}</button>}
      />,
    );
    const actionsCell = container.querySelector("tbody .dt__remove")?.closest("td");
    expect(actionsCell).not.toBeNull();
    expect(actionsCell?.hasAttribute("data-label")).toBe(false);
  });

  // ---- CSS-source contracts for the reflow (jsdom does not apply @container) ----

  it("CSS contract: the .dt-wrap host establishes an inline-size container (AC-8)", () => {
    expect(ruleBody(componentsCss, ".dt-wrap")).toMatch(/container-type:\s*inline-size/);
  });

  it("CSS contract: the reflow is keyed to a <=640px container query (AC-8)", () => {
    expect(componentsCss).toMatch(/@container\s*\(max-width:\s*640px\)/);
  });

  it("CSS contract: the reflow surfaces the header via td[data-label]::before content: attr(data-label) (AC-8)", () => {
    expect(ruleBody(componentsCss, ".dt tbody td[data-label]::before")).toMatch(
      /content:\s*attr\(data-label\)/,
    );
  });

  it("CSS contract: the reflow hides the thead (AC-8)", () => {
    expect(ruleBody(componentsCss, ".dt thead")).toMatch(/display:\s*none/);
  });

  it("CSS contract: the reflow pins the row actions visible — no hover on touch (AC-5)", () => {
    expect(ruleBody(componentsCss, ".dt tbody .dt__remove")).toMatch(/opacity:\s*1/);
  });
});
