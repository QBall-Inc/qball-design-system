# RELEASING.md — release & versioning runbook

How `@qball-inc/tokens`, `@qball-inc/elements` and `@qball-inc/react` are versioned and published to npm.

## Versioning contract

The core semver contract lives in **[CAVEATS.md → Versioning](./CAVEATS.md#versioning-so-tokens-dont-change-under-a-project-mid-build)** — it is the single source of truth and is **not** duplicated here. In brief: any **token value / type-stack / radius / spacing** change is **MAJOR**; **additive-only** changes (new component, new variant, new export) are **MINOR**; non-contract bug fixes are **PATCH**.

> The strict contract **takes effect at `1.0.0`**. `@qball-inc/tokens` and `@qball-inc/react` are past `1.0.0`, so it binds them now. `@qball-inc/elements` is unreleased (`0.0.0` placeholder) and will ship on `0.x` first: while on `0.x` its API can still adjust between minor versions, and it moves to `1.0.0` only once its data contract is final. (See `CHANGELOG.md` + `CAVEATS.md`.)

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

`scripts/publish-packages.sh` publishes **`@qball-inc/tokens` → `@qball-inc/elements` → `@qball-inc/react`**.

- **tokens before react is load-bearing:** react depends on tokens via `workspace:*` (rewritten to the published version on pack), so tokens must be live on npm before react resolves.
- **elements sits after tokens:** it has no package dependency on tokens (consumers install both and import the tokens CSS themselves), but a release that adds styles makes them live before the elements that paint them.
- tokens is static (no build); elements and react build via `tsup`, only when they will actually publish.
- Each package is **skipped** while at the `0.0.0` placeholder or when its version is already on npm, so a push with no changesets is a safe no-op.

## CI / workflows

- `.github/workflows/ci.yml` — quality + license gates on every push/PR.
- `.github/workflows/release.yml` — the Changesets release flow above.
- **All GitHub Actions are pinned to a full commit SHA** (with a `# vX.Y.Z` trailer), never a mutable tag — a supply-chain safeguard. When bumping an action, update both the SHA and the trailer.

## One-time precondition: npm OIDC trusted publishing (OWNER)

This release uses **npm OIDC trusted publishing** — there is **no `NPM_TOKEN`** anywhere. Trusted publishing is configured **per package** on npmjs.org, so the owner enables it once for **each** package (done for `@qball-inc/tokens` and `@qball-inc/react`; `@qball-inc/elements` after its first publish — see below):

1. Open the package on npmjs.org → **Settings** → **Trusted Publisher** → **GitHub Actions**, and set: Organization `QBall-Inc`, Repository `qball-design-system`, Workflow filename `release.yml` (filename only), Environment blank.
2. Under **Allowed actions**, enable **`npm publish`**. Configurations created after 3 Sep 2026 default to staged publishing only (`npm stage publish`), which this workflow does not use; without `npm publish` allowed, the CI publish fails.
3. Repeat for each package. Owner npm 2FA is already enabled.

The workflow grants `id-token: write`, so each publish carries a signed provenance attestation automatically (it also sets `NPM_CONFIG_PROVENANCE: true` belt-and-suspenders). Everything except the live publish (the build, the version PR, and `just release-dry-run`) is verifiable **without** this step.

### Publish client (resolves the pnpm/OIDC tooling caveat)

npm trusted publishing requires **npm CLI ≥ 11.5.1 on Node ≥ 22.14**, and `pnpm@9.15.0` (this repo's `packageManager`) cannot perform the OIDC token exchange. So `release.yml` runs on **Node 22**, **upgrades npm to `npm@latest`**, and the publish step (`scripts/publish-packages.sh`) **packs each package with `pnpm pack`** — the only client that rewrites `workspace:*` to a real version inside the tarball — and **publishes that tarball with `npm publish`**. pnpm stays at 9.15.0 for install/build/pack.

> **Proven live** with the `1.0.1` release of tokens + react (OIDC exchange + provenance). If it ever fails, the **fallback is a local publish**: `npm login`, then `bash scripts/publish-packages.sh` (uses the login token; no provenance).

### First publish of a new package (`@qball-inc/elements`)

**Finding (checked 2 Oct 2026):** npm trusted publishing **cannot** cover a package's first publish. The trusted-publisher form lives in the package's own settings page on npmjs.org, which only exists once the package does ([npm docs: trusted publishers](https://docs.npmjs.com/trusted-publishers/); [npm/cli#8544](https://github.com/npm/cli/issues/8544), still open). This is the same constraint `@qball-inc/react` hit at `1.0.0`.

So `@qball-inc/elements@0.1.0` uses the same **one-time local bootstrap** as react did, as the precondition of the first elements release:

1. A changeset versions elements `0.0.0 → 0.1.0` (`just release-dry-run` previews exactly this) and the version bump is applied.
2. The owner runs `npm login` (2FA) and then `bash scripts/publish-packages.sh` locally. Packages already on npm are skipped; elements builds and publishes.
3. Verify `npm view @qball-inc/elements version` returns `0.1.0`, then push the version-bump commit.
4. Configure trusted publishing for `@qball-inc/elements` (steps above, including **Allowed actions → `npm publish`**). Later elements releases then go through the normal OIDC flow.

Re-check this finding before that release. If npm has since added pre-publish configuration, use the normal Version PR + OIDC flow instead and record the change here.

**Outcome (10 Oct 2026):** the finding still held (npm/cli#8544 still open), so `@qball-inc/elements@0.1.0` was bootstrapped locally. Release A ran in two steps:

1. The Version PR (tokens `1.1.0` + react `1.0.2`, a dependency-only bump) was merged and published by CI through OIDC, with provenance. Elements stayed at `0.0.0` and was skipped.
2. Elements was versioned locally (`pnpm changeset version`). The elements changeset never sat in the Version PR: a CI publish would have published tokens, failed on elements (no trusted publisher yet) and never reached react.

`publish-packages.sh` stopped with `EOTP` when run from a non-interactive shell, because the owner's npm account requires 2FA on every publish. In an interactive terminal, npm instead prints a sign-in URL: the owner opens it in the browser and approves with their security key (passkey), and the publish then completes. So the fallback is to pack first, then have the owner publish the tarball from their own terminal:

```sh
(cd packages/elements && pnpm pack --pack-destination /tmp/elements-release)
npm publish /tmp/elements-release/qball-inc-elements-<version>.tgz --access public
# npm prints an authentication URL -> open it, approve with the security key
```

The local publish carries no provenance. Later elements releases get it through OIDC once its trusted publisher is configured (step 4 above).

## Changelogs

- **Per-package** `CHANGELOG.md` (`packages/tokens/`, `packages/react/`, and `packages/elements/` from its first release) are generated by Changesets at version time — the authoritative per-version record.
- The **root `CHANGELOG.md`** is a curated, human cross-package summary that ties the packages together. Keep it in sync manually when cutting a notable release.
