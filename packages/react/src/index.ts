// Public barrel for @qball-inc/react. Each component family is re-exported here
// as it lands; `Surface` is the token-only smoke primitive that proves the dual
// ESM/CJS + dts + consumer-import path.
export { Surface } from "./smoke/Surface";
export type { SurfaceProps } from "./smoke/Surface";

// Primitives I — Button + Input + Field.
export { Button } from "./primitives/Button";
export type { ButtonProps, ButtonVariant } from "./primitives/Button";
export { Input } from "./primitives/Input";
export type { InputProps } from "./primitives/Input";
export { Field } from "./primitives/Field";
export type { FieldProps } from "./primitives/Field";

// Primitives II — Select + Switch + Segmented.
export { Select, SelectItem } from "./primitives/Select";
export type { SelectProps, SelectItemProps } from "./primitives/Select";
export { Switch } from "./primitives/Switch";
export type { SwitchProps } from "./primitives/Switch";
export { Segmented, SegmentedItem } from "./primitives/Segmented";
export type { SegmentedProps, SegmentedItemProps } from "./primitives/Segmented";

// Primitives III — SecretInput + Search.
export { SecretInput } from "./primitives/SecretInput";
export type { SecretInputProps } from "./primitives/SecretInput";
export { Search } from "./primitives/Search";
export type { SearchProps, SearchItem } from "./primitives/Search";

// Overlays I — Modal + Toast + Callout.
export {
  Modal,
  ModalTrigger,
  ModalContent,
  ModalTitle,
  ModalDescription,
  ModalClose,
  AlertModal,
} from "./overlay/Modal";
export type { ModalContentProps, AlertModalProps } from "./overlay/Modal";
export { Toaster, toast } from "./overlay/Toast";
export type { ToastOptions, ToasterProps } from "./overlay/Toast";
export { Callout } from "./overlay/Callout";
export type { CalloutProps, CalloutVariant } from "./overlay/Callout";

// Overlays II — Skeleton + Spinner + StateFig (Empty/Error).
export { Skeleton } from "./overlay/Skeleton";
export type { SkeletonProps, SkeletonShape } from "./overlay/Skeleton";
export { Spinner } from "./overlay/Spinner";
export type { SpinnerProps, SpinnerSize } from "./overlay/Spinner";
export { EmptyStateFig, ErrorStateFig } from "./overlay/StateFig";
export type { EmptyStateFigProps, ErrorStateFigProps } from "./overlay/StateFig";

// Data I — Stat + Meter + Badge + Card + Divider (Tabs split to WP-B-3.3a — see Data I-b below).
export { Stat } from "./data/Stat";
export type { StatProps, StatDirection } from "./data/Stat";
export { Meter } from "./data/Meter";
export type { MeterProps, MeterVariant } from "./data/Meter";
export { Badge } from "./data/Badge";
export type { BadgeProps, BadgeVariant } from "./data/Badge";
export { Card } from "./data/Card";
export type { CardProps } from "./data/Card";
export { Divider } from "./data/Divider";
export type { DividerProps } from "./data/Divider";

// Data I-b — Tabs (Radix Tabs over the shipped .tab* surface + the shared sage
// focus ring; deferred from WP-B-3.3, landed WP-B-3.3a).
export { Tabs, TabsList, TabsTrigger, TabsContent } from "./data/Tabs";
export type { TabsProps, TabsListProps, TabsTriggerProps, TabsContentProps } from "./data/Tabs";

// Data II — Sparkline + Tooltip + Avatar.
export { Sparkline } from "./data/Sparkline";
export type { SparklineProps, SparklineDirection } from "./data/Sparkline";
export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "./data/Tooltip";
export type { TooltipContentProps } from "./data/Tooltip";
export { Avatar, AvatarGroup } from "./data/Avatar";
export type { AvatarProps, AvatarGroupProps, AvatarSize, AvatarStatus } from "./data/Avatar";

// Data III — DataTable (TanStack Table headless core + the shipped .dt surface).
// `ColumnDef` is intentionally NOT re-exported: it belongs to the optional
// `@tanstack/react-table` peer, so consumers import it from there directly.
export { DataTable } from "./data/DataTable";
export type { DataTableProps, DataTableColumnMeta } from "./data/DataTable";

// Data IV — Candlestick (D3 island over the optional `d3` peer; token-driven color).
export { Candlestick } from "./data/Candlestick";
export type { CandlestickProps, CandlestickDatum, CandlestickRange } from "./data/Candlestick";

// Chrome I — AppBar (+ NotificationBell) + UserMenu + ThemeToggle + Scrim.
export { AppBar, NotificationBell } from "./chrome/AppBar";
export type { AppBarProps, NotificationBellProps } from "./chrome/AppBar";
export {
  UserMenu,
  UserMenuTrigger,
  UserMenuContent,
  UserMenuHeader,
  UserMenuGroup,
  UserMenuItem,
  UserMenuSeparator,
} from "./chrome/UserMenu";
export type {
  UserMenuTriggerProps,
  UserMenuContentProps,
  UserMenuHeaderProps,
  UserMenuGroupProps,
  UserMenuItemProps,
  UserMenuSeparatorProps,
} from "./chrome/UserMenu";
export { ThemeToggle } from "./chrome/ThemeToggle";
export type { ThemeToggleProps, Theme } from "./chrome/ThemeToggle";
export { Scrim } from "./chrome/Scrim";
export type { ScrimProps } from "./chrome/Scrim";

// Chrome II — CommandDock (floating command island) + NotificationCenter (bell dropdown).
export { CommandDock } from "./chrome/CommandDock";
export type { CommandDockProps, CommandAction } from "./chrome/CommandDock";
export { NotificationCenter } from "./chrome/NotificationCenter";
export type {
  NotificationCenterProps,
  NotificationItemData,
  NotificationKind,
} from "./chrome/NotificationCenter";

// AI I — Terminal (conversation transcript) + Composer (input + send) + the
// useStreaming SSE state machine (WP-B-4.1a). GroundingFlag is WP-B-4.1b.
export { Terminal } from "./ai/Terminal";
export type {
  TerminalProps,
  TerminalMessage,
  TerminalRole,
  StreamToken,
  StreamError,
} from "./ai/Terminal";
export { Composer } from "./ai/Composer";
export type { ComposerProps } from "./ai/Composer";
export { useStreaming, parseStreamFrame, streamFromResponse } from "./ai/Streaming";
export type { StreamEvent, UseStreamingResult } from "./ai/Streaming";
export { GroundingFlag } from "./ai/GroundingFlag";
export type { GroundingFlagProps, GroundingVariant } from "./ai/GroundingFlag";
// AI II — MarkdownRenderer: sanitized, token-styled markdown for streamed
// assistant text (WP-B-4.2). Allowlist + urlTransform safe-rendering boundary.
export { MarkdownRenderer, ALLOWED_ELEMENTS } from "./ai/MarkdownRenderer";
export type { MarkdownRendererProps } from "./ai/MarkdownRenderer";
// AI IV — ToolUseIndicator: the skill/tool-call lifecycle chip in the terminal
// transcript (WP-B-4.4, built from the WP-B-4.3 signed-off design). Token-CSS
// .tuf wrapper; reuses the shipped .spinner / .term__cursor for the running loop.
export { ToolUseIndicator } from "./ai/ToolUseIndicator";
export type { ToolUseIndicatorProps, ToolUseState } from "./ai/ToolUseIndicator";

// Briefings — DigestCard: the LLM market-briefing card over the shipped .digest
// family (WP-B-4.4). Composes Skeleton (loading) + EmptyStateFig (empty); hosts
// GroundingFlag markers inline in the body prose.
export { DigestCard } from "./briefings/DigestCard";
export type { DigestCardProps, DigestState } from "./briefings/DigestCard";

// Site & Media Primitives I — Canvas background primitives (WP-B-4b.1). Token-driven
// animated <canvas> backgrounds (GridBg dot matrix / AsciiBg falling streams /
// GlyphsBg drifting glyphs) + the useCanvas2D driver. SSR-safe (inert <canvas> on
// the server); reads --color-signal / --color-highlight / --font-display at paint
// time (no hardcoded color fallbacks); honors prefers-reduced-motion as a true
// short-circuit (one static frame, no animation loop).
export { GridBg } from "./primitives/backgrounds/GridBg";
export { AsciiBg } from "./primitives/backgrounds/AsciiBg";
export { GlyphsBg } from "./primitives/backgrounds/GlyphsBg";
export { useCanvas2D } from "./primitives/backgrounds/useCanvas2D";
export type { BackgroundProps } from "./primitives/backgrounds/types";
export type { CanvasDraw, CanvasFrame } from "./primitives/backgrounds/useCanvas2D";

// Icon System — three tracks (WP-B-4b.2). Build-time codegen from lucide-react
// (UI + AI marks, ISC) and simple-icons (brand marks, CC0) — both devDeps — into our
// OWN committed inline-SVG components, ZERO runtime icon-pack dependency; plus
// hand-authored AI original art + converted brand assets. Per-icon named exports
// (`import { TrendingUp }`) tree-shake off the single barrel. currentColor-only;
// `aria-hidden` by default, `title`/`aria-label` flips to `role="img"` + `<title>`.
// Single barrel — NO `./icons` subpath in v1. AC-4 registry split: the UI + AI tracks
// own the dynamic `<Icon name>` registry + the canonical `IconName` union; brand marks
// are named exports under their own `BrandIconName` union (logos are not icons).
export * from "./icons/generated";
export { Icon } from "./icons/Icon";
export { ICON_NAMES } from "./icons/generated/registry";
export type { IconName } from "./icons/generated/registry";
export { BRAND_ICON_NAMES } from "./icons/generated/registry";
export type { BrandIconName } from "./icons/generated/registry";
export type { IconProps } from "./icons/icon-props";

// Site & Media Primitives III — MediaSlot (WP-B-4b.3). A pure-React, SSR/static-safe
// DISPLAY container for heterogeneous media (image / gif / video / embed-facade) over
// the shipped `.media-slot` token surface; native <img>/<video>/<iframe>, zero heavy
// deps. The embed facade loads the real <iframe> only on click (no network until then).
// The authoring layer (upload / crop / persist / oEmbed) is the deferred WP-B-4b.3a;
// `adapter` is a reserved no-op seam for it.
export { MediaSlot } from "./media/MediaSlot";
export type {
  MediaSlotProps,
  MediaSlotType,
  MediaSlotShape,
  MediaSlotFit,
  MediaSlotAdapter,
} from "./media/MediaSlot";
