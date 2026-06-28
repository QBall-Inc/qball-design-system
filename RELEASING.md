# RELEASING.md — release & versioning runbook

How `@qball-inc/tokens` and `@qball-inc/react` are versioned and published to npm.

## Versioning contract

The core semver contract lives in **[CAVEATS.md → Versioning](./CAVEATS.md#versioning-so-tokens-dont-change-under-a-project-mid-build)** — it is the single source of truth and is **not** duplicated here. In brief: any **token value / type-stack / radius / spacing** change is **MAJOR**; **additive-only** changes (new component, new variant, new export) are **MINOR**; non-contract bug fixes are **PATCH**.

> The strict contract **takes effect at `1.0.0`**. `@qball-inc/tokens` is currently `0.1.0` (early-access `0.x`); this release bumps tokens `0.1.0 → 1.0.0`, and `@qball-inc/react` is published for the first time at `1.0.0`. While on `0.x` the token surface could still adjust; from `1.0.0` it is pinned. (See `CHANGELOG.md` + `CAVEATS.md`.)

This file records only the two release-specific carve-outs CAVEATS.md does not spell out:

- **`--font-display` fallback stack = MAJOR.** A change to the `--font-display` token value (`'Fira Code', 'SF Mono', 'Cascadia Code', monospace` in `packages/tokens/colors_and_type.css`) — reordering, swapping, or replacing a fallback face — is a **MAJOR** bump: it is a token-value change and downstream type is tuned to it. (The deploy-time Berkeley Mono injection on the gallery is **not** a token change — it never touches the published CSS, so it is exempt from this rule.)
- **`$description`-only edits = EXEMPT (no bump).** The DTCG `$description` fields in `tokens.json` (e.g. the display face's "Public default is Fira Code … restore per README" note) are documentation, not token values. Editing only a `$description` requires **no** version bump.

## Tooling: Changesets

Versioning + changelog generation are driven by [Changesets](https://github.com/changesets/changesets) (config: `.changeset/config.json`).

1. **While developing** a change that ships, add a changeset describing it and its bump level:
   ```
   pnpm changeset
   ```
   This writes a markdown file under `.changeset/` (commit it with the change).
2. **On push to `main`**, the Release workflow opens (or updates) a **"Version Packages"** PR that runs `changeset version` — applying the pending changesets to bump versions and write per-package changelogs.
3. **Merging that PR** consumes the changesets and triggers the topological publish.

Dry-run the semver behaviour locally before relying on it:
```
just release-dry-run
```

## Publish order (topological)

`scripts/publish-packages.sh` publishes **`@qball-inc/tokens` first, then `@qball-inc/react`**. This order is load-bearing: react depends on tokens via `workspace:*` (rewritten to the published version on pack), so tokens must be live on npm before react resolves. tokens is static (no build); react builds via `tsup`.

## CI / workflows

- `.github/workflows/ci.yml` — quality + license gates on every push/PR.
- `.github/workflows/release.yml` — the Changesets release flow above.
- **All GitHub Actions are pinned to a full commit SHA** (with a `# vX.Y.Z` trailer), never a mutable tag — a supply-chain safeguard. When bumping an action, update both the SHA and the trailer.

## One-time precondition: npm OIDC trusted publishing (OWNER)

This release uses **npm OIDC trusted publishing** — there is **no `NPM_TOKEN`** anywhere. Trusted publishing is configured **per package** on npmjs.org, so the owner enables it once for **each** of `@qball-inc/tokens` and `@qball-inc/react`:

1. Open the package on npmjs.org → **Settings** → **Trusted Publisher** → **GitHub Actions**, and set: Organization `QBall-Inc`, Repository `qball-design-system`, Workflow filename `release.yml` (filename only), Environment blank.
2. Repeat for the second package. Owner npm 2FA is already enabled.

The workflow grants `id-token: write`, so each publish carries a signed provenance attestation automatically (it also sets `NPM_CONFIG_PROVENANCE: true` belt-and-suspenders). Everything except the live publish (the build, the version PR, and `just release-dry-run`) is verifiable **without** this step.

### Publish client (resolves the pnpm/OIDC tooling caveat)

npm trusted publishing requires **npm CLI ≥ 11.5.1 on Node ≥ 22.14**, and `pnpm@9.15.0` (this repo's `packageManager`) cannot perform the OIDC token exchange. So `release.yml` runs on **Node 22**, **upgrades npm to `npm@latest`**, and the publish step (`scripts/publish-packages.sh`) **packs each package with `pnpm pack`** — the only client that rewrites `workspace:*` to a real version inside the tarball — and **publishes that tarball with `npm publish`**. pnpm stays at 9.15.0 for install/build/pack.

> **Unexercised until the first real publish.** The live OIDC token exchange only runs when a package actually publishes; no-changeset pushes skip both packages idempotently. If it ever fails, the **fallback is a local publish**: `npm login`, then `bash scripts/publish-packages.sh` (uses the login token; no provenance).

## Changelogs

- **Per-package** `CHANGELOG.md` (`packages/tokens/`, `packages/react/`) are generated by Changesets at version time — the authoritative per-version record.
- The **root `CHANGELOG.md`** is a curated, human cross-package summary that ties the two together. Keep it in sync manually when cutting a notable release.
