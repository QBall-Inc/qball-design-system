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
