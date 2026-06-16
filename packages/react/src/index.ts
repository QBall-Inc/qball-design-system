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

// Data I — Stat + Meter + Badge + Card + Divider (Tabs deferred, WP-B-3.3).
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
