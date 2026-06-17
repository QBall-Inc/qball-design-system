import { type ReactNode, useMemo } from "react";

import {
  type ColumnDef,
  type ColumnMeta,
  type OnChangeFn,
  type Row,
  type RowData,
  type RowSelectionState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";

import { EmptyStateFig, ErrorStateFig } from "../overlay/StateFig";
import { Skeleton } from "../overlay/Skeleton";

/**
 * DataTable — a compact, finance-aware data table, painted with the shipped
 * `@qball-inc/tokens` `.dt` classes from the `preview/data-table.html` oracle and
 * built on **TanStack Table** (`@tanstack/react-table`) as the headless core.
 *
 * The visual surface is entirely the token CSS — `.dt` + `.dt thead th`,
 * `.dt td.num`, `.dt .up/.down/.flat`, the `:hover` tint, the `[aria-selected]`
 * sage selection, and `.dt__remove` actions — so there is no component CSS, no
 * hardcoded color, no box-shadow. The component only wires the headless row model
 * to that surface and composes the WP-B-3.2 state figures.
 *
 * Headless-only for v1: it renders the core row model (no built-in sorting or
 * filtering UI — the oracle shows none). Consumers drive sorting/selection via
 * TanStack's APIs through the pass-through props.
 *
 * Three binding rules from DESIGN.md (FR4) carried by this surface:
 * - **Finance color is always paired with a non-color cue.** A column marked
 *   `meta.finance` renders the `.num .up/.down/.flat` color AND a leading `+`/`−`
 *   sign (mirroring the oracle's `+1.24%` / `−2.34%`), so color is never the sole
 *   signal (RB-8). The cue is the sign, not an arrow — matching `data-table.html`.
 * - **One Skeleton, one StateFig.** Loading composes {@link Skeleton}; empty/error
 *   compose {@link EmptyStateFig} / {@link ErrorStateFig} — never re-implemented.
 * - **Reduced-motion is inherited**, not overridden: the only animation is the
 *   Skeleton shimmer, whose `prefers-reduced-motion` rule lives in the token CSS.
 */

// Augment TanStack's (otherwise-empty) ColumnMeta so `column.meta` is typed with
// the DataTable display fields everywhere a ColumnDef is used. The TData/TValue
// type params are required to mirror TanStack's generic signature for declaration
// merging (TS6205 "unused" is a non-fatal hint under noUnusedParameters:false).
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- type params mirror TanStack's generic signature for declaration merging
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Right-aligned tabular `.num` cell (display font + tabular-nums). */
    numeric?: boolean;
    /**
     * Directional finance cell: pairs the `--data-up/down/flat` color (`.up/.down/.flat`)
     * with a leading `+`/`−` sign cue (FR4). Implies {@link numeric}. The column's
     * accessor value MUST be a number; non-numbers fall back to the default cell.
     */
    finance?: boolean;
    /**
     * Formats a finance cell's number into its display string. The result must keep
     * the directional sign as the non-color cue. Default: signed 2-decimal percent
     * (`+1.24%` / `−2.34%`), matching the oracle's `sign()`.
     */
    financeFormat?: (value: number) => string;
  }
}

/** Public alias for a DataTable column's `meta` shape (the augmented ColumnMeta). */
export type DataTableColumnMeta = ColumnMeta<unknown, unknown>;

export interface DataTableProps<TData> {
  /** TanStack column definitions. Mark numeric/finance columns via `meta`. */
  columns: ColumnDef<TData, unknown>[];
  /** Row data. An empty array (with `loading=false`, no `error`) renders the empty figure. */
  data: TData[];
  /** When true, the header renders but each body cell shows a {@link Skeleton}. Wins over error/empty. */
  loading?: boolean;
  /** Number of skeleton rows rendered while `loading`. Default `4`. */
  skeletonRowCount?: number;
  /** When set (and `loading=false`), renders {@link ErrorStateFig} in the body. */
  error?: string | Error;
  /** Title for the error figure. Default `"Couldn't load data"`. */
  errorTitle?: ReactNode;
  /**
   * Wired to the error figure's Retry CTA. If omitted, the Retry button still
   * renders but does nothing — provide it whenever an `error` is possible.
   */
  onRetry?: () => void;
  /** Headline for the empty figure (overrides the default). */
  emptyMessage?: ReactNode;
  /**
   * Optional trailing actions cell per row (e.g. a `.dt__remove` button),
   * right-aligned. Adds a synthetic column with the reserved id `__actions` — do
   * not define a column with that id.
   */
  actions?: (row: TData) => ReactNode;
  /** Pin the hover-reveal actions visible (default: reveal on row hover). */
  actionsAlwaysVisible?: boolean;
  /** Enable TanStack row selection; selected rows get `aria-selected="true"` (sage tint). */
  enableRowSelection?: boolean | ((row: Row<TData>) => boolean);
  /**
   * Controlled row-selection state. For controlled mode pass BOTH `rowSelection`
   * AND `onRowSelectionChange`; passing only one freezes selection (TanStack's
   * controlled-state contract). Omit both to let TanStack manage selection
   * internally (uncontrolled).
   */
  rowSelection?: RowSelectionState;
  /** Controlled row-selection change handler. Pair with `rowSelection`. */
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  /** Stable row id (TanStack `getRowId`). Defaults to the row index. */
  getRowId?: (originalRow: TData, index: number) => string;
  /** className merged onto the `.dt` table root. */
  className?: string;
}

const FINANCE_EPSILON = 0.05; // mirror the oracle's dirClass() flat band

type FinanceDirection = "up" | "down" | "flat";

function financeDirection(value: number): FinanceDirection {
  if (value > FINANCE_EPSILON) return "up";
  if (value < -FINANCE_EPSILON) return "down";
  return "flat";
}

// Signed 2-decimal percent. The leading +/- IS the FR4 non-color cue paired with
// the .up/.down/.flat color. Mirrors the oracle's sign(): "+1.24%" / "-2.34%".
function defaultFinanceFormat(value: number): string {
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

const ACTIONS_COLUMN_ID = "__actions";

// Stable no-op for the error figure's required `retry` when no `onRetry` is given.
const NOOP = (): void => undefined;

export function DataTable<TData>({
  columns,
  data,
  loading = false,
  skeletonRowCount = 4,
  error,
  errorTitle = "Couldn't load data",
  onRetry,
  emptyMessage,
  actions,
  actionsAlwaysVisible = false,
  enableRowSelection,
  rowSelection,
  onRowSelectionChange,
  getRowId,
  className,
}: DataTableProps<TData>) {
  // Append a synthetic, right-aligned actions column so colSpan/header alignment
  // stay correct (vs. hand-appending a <td>). Only when `actions` is provided.
  const allColumns = useMemo<ColumnDef<TData, unknown>[]>(() => {
    if (!actions) return columns;
    const actionsColumn: ColumnDef<TData, unknown> = {
      id: ACTIONS_COLUMN_ID,
      header: "",
      cell: ({ row }) => actions(row.original),
      meta: { numeric: true },
      enableSorting: false,
    };
    return [...columns, actionsColumn];
  }, [columns, actions]);

  const table = useReactTable<TData>({
    data,
    columns: allColumns,
    getCoreRowModel: getCoreRowModel(),
    ...(enableRowSelection !== undefined ? { enableRowSelection } : {}),
    ...(getRowId !== undefined ? { getRowId } : {}),
    ...(rowSelection !== undefined ? { state: { rowSelection } } : {}),
    ...(onRowSelectionChange !== undefined ? { onRowSelectionChange } : {}),
  });

  const leafColumns = table.getAllLeafColumns();
  const colCount = leafColumns.length;
  const selectable = enableRowSelection !== undefined && enableRowSelection !== false;

  const tableClass = ["dt", actionsAlwaysVisible ? "dt--actions-visible" : null, className]
    .filter(Boolean)
    .join(" ");

  // Per-leaf-column numeric flag (for header alignment + skeleton-cell alignment).
  const columnIsNumeric = leafColumns.map(
    (col) => col.columnDef.meta?.numeric === true || col.columnDef.meta?.finance === true,
  );

  function renderBody(): ReactNode {
    if (loading) {
      return Array.from({ length: skeletonRowCount }, (_, rowIndex) => (
        <tr key={`skeleton-${String(rowIndex)}`}>
          {leafColumns.map((col, colIndex) => (
            <td key={col.id} className={columnIsNumeric[colIndex] ? "num" : undefined}>
              <Skeleton />
            </td>
          ))}
        </tr>
      ));
    }

    if (error !== undefined) {
      const message = typeof error === "string" ? error : error.message;
      return (
        <tr>
          <td colSpan={colCount}>
            <ErrorStateFig title={errorTitle} body={message} retry={onRetry ?? NOOP} />
          </td>
        </tr>
      );
    }

    if (data.length === 0) {
      return (
        <tr>
          <td colSpan={colCount}>
            <EmptyStateFig title={emptyMessage ?? "No data"} />
          </td>
        </tr>
      );
    }

    return table.getRowModel().rows.map((row) => (
      <tr key={row.id} aria-selected={selectable ? row.getIsSelected() : undefined}>
        {row.getVisibleCells().map((cell) => {
          const meta = cell.column.columnDef.meta;
          if (meta?.finance) {
            const raw = cell.getValue();
            if (typeof raw === "number") {
              const direction = financeDirection(raw);
              const format = meta.financeFormat ?? defaultFinanceFormat;
              return (
                <td key={cell.id} className={`num ${direction}`}>
                  {format(raw)}
                </td>
              );
            }
          }
          // Default / fallback cell. A `finance` column lands here when its value
          // is not a number — keep the right-aligned `.num` treatment in that case.
          return (
            <td key={cell.id} className={meta?.numeric || meta?.finance ? "num" : undefined}>
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </td>
          );
        })}
      </tr>
    ));
  }

  return (
    <table className={tableClass} aria-busy={loading || undefined}>
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header, colIndex) => (
              <th key={header.id} className={columnIsNumeric[colIndex] ? "num" : undefined}>
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>{renderBody()}</tbody>
    </table>
  );
}
