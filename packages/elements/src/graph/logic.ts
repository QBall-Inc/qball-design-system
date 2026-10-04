// Internal barrel of the pure (DOM-free, three-free) graph logic. Not a public
// entry: the derived-fixture script (scripts/generate-with-layout-fixture.mjs)
// bundles this file directly. Public exports land with the canvas (Release C).

export * from "./prng";
export * from "./sim";
export * from "./scales";
export * from "./neighbors";
export * from "./labels";
export * from "./resolveByName";
export * from "./facets";
