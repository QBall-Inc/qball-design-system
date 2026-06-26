# Dual-repo development — `pnpm.overrides` `link:` workflow

When you develop a consumer app **and** the design system at the same time, you want
edits in `qball-design-system/packages/*` to show up in the consumer **immediately**,
without a publish/pack/reinstall cycle. The mechanism is a pnpm `link:` override.

> **This is a local-development tool only.** The override MUST NOT reach CI, a
> Dockerfile, or a committed lockfile (see [CI safety](#ci-safety-rb-11)).

## Assumed layout

The two repos sit side-by-side:

```
your-workspace/
├── qball-design-system/        # this repo
│   └── packages/
│       ├── tokens/             # @qball-inc/tokens
│       └── react/              # @qball-inc/react
└── my-consumer-app/            # your app
    └── package.json
```

## Add the overrides

In the **consumer app's** `package.json`, point the `@qball-inc` packages at the local
package directories with the `link:` protocol (a live symlink — not a copy):

```json
{
  "dependencies": {
    "@qball-inc/tokens": "^1.0.0",
    "@qball-inc/react": "^1.0.0"
  },
  "pnpm": {
    "overrides": {
      "@qball-inc/tokens": "link:../qball-design-system/packages/tokens",
      "@qball-inc/react": "link:../qball-design-system/packages/react"
    }
  }
}
```

Then install so pnpm rewrites the dependency to the symlink:

```bash
pnpm install
```

Now edits to `packages/tokens/*.css` (or a rebuilt `packages/react/dist`) are picked
up directly. The token CSS is zero-build, so token edits are live on the next dev
reload; for `@qball-inc/react` run its build (`just build`, or
`pnpm --filter @qball-inc/react run build`) so `dist/` reflects your source changes.

### `link:` vs `file:`

- **`link:`** — a symlink to the live package directory. Edits are reflected without
  reinstalling. This is what you want for active dual-repo dev.
- **`file:`** — packs/copies the package at install time (a snapshot). Use this only
  when you specifically want to test the _packaged_ artifact (that is what the
  `fixtures/consumer` distribution gate does — it installs packed tarballs, never a
  `link:`).

## Remove before committing / running CI

**Before you commit or run CI, remove the `pnpm.overrides` block and reinstall** so
the lockfile resolves against the real published (or workspace) versions:

```bash
# 1. Delete the "pnpm": { "overrides": { ... } } block from package.json
# 2. Reinstall so the lockfile drops the link: resolution
pnpm install
# 3. Confirm no link: entry survived in the lockfile
grep -n "link:.*qball-design-system" pnpm-lock.yaml   # must print nothing
```

## CI safety (RB-11)

CI always builds against **published or workspace** versions — never a `link:`
override. Concretely:

- **No** `pnpm.overrides` `link:` block in any committed `package.json`.
- **No** `link:../qball-design-system/...` entry in a committed `pnpm-lock.yaml`.
- **No** `link:` override in any CI workflow (`.github/workflows/*`) or `Dockerfile`.

A `link:` that escapes into CI points at a path that does not exist on the runner and
breaks the build — or, worse, silently resolves to stale local state. Keep the override
in your working tree only.
