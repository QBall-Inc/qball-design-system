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
