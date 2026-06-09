// Typecheck-only input so the recursive `pnpm -r exec tsc --noEmit` gate has a
// source to compile in this package. @qball-inc/tokens is a zero-build,
// static-asset package: the published surface (theme.css, colors_and_type.css,
// components.css, tokens.json) ships verbatim from the package root via the
// `exports`/`files` map and is NOT emitted from here. This file is excluded from
// the npm tarball (`files` lists only the four assets).
export {};
