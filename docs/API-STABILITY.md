# API stability and versioning

From 1.0.0, `@tornotron/echno-core` follows [semantic versioning](https://semver.org/).
This document defines what counts as the public API, what each version bump means, and
how the snapshot gate keeps the two in sync.

## What is public

The public API is exactly the set of entry points declared in the `exports` map of
`package.json`:

| Import specifier | Resolves to |
| --- | --- |
| `@tornotron/echno-core` | the root barrel (`src/index.ts`) |
| `@tornotron/echno-core/<module>/types` | `src/types/<module>/index.ts` |
| `@tornotron/echno-core/<module>/services` | `src/services/<module>-service.ts` |
| `@tornotron/echno-core/<module>/hooks` | `src/hooks/<module>/index.ts` |
| `@tornotron/echno-core/<module>/hooks/keys` | `src/hooks/<module>/keys.ts` |

Everything reachable through one of those specifiers is public. Anything else, including
`lib/` internals such as `lib/validation/backend-schema`, is private: it may change or be
removed in any release, even a patch. Do not import from `dist/` paths directly or from
deep source paths that the `exports` map does not list.

The root barrel re-exports the same modules that the subpaths expose, so both styles reach
the same symbols. The subpaths are the preferred form for application code because they keep
imports narrow and tree-shakeable.

The package is ESM-only (`"type": "module"` semantics via the `import` condition). There is
no CommonJS build.

## What each version bump means

- **Patch** (`1.0.x`): bug fixes and internal changes that do not alter the public surface.
- **Minor** (`1.x.0`): additive changes. New modules, new exported symbols, new optional
  fields. Existing code keeps working.
- **Major** (`x.0.0`): a breaking change. Removing or renaming an exported symbol, changing
  a function signature or a required field, or removing an entry point.

Removing a symbol that is marked `@deprecated` is still a breaking change and only happens in
a major release.

## Deprecation

Symbols on the way out are marked with a `@deprecated` JSDoc tag naming the replacement. They
keep working for the rest of the current major version and are removed in the next major.
Deprecated and `@internal` symbols are labelled in the snapshot (see below) so the current set
is always visible at a glance.

## The public API snapshot

`etc/public-api.md` is a generated record of every exported symbol across every entry point.
It is the reviewed public contract. `scripts/api-snapshot.ts` produces it by walking the
`exports` map with the TypeScript compiler API.

```sh
bun run api:snapshot   # regenerate etc/public-api.md
bun run api:check      # fail if the committed snapshot is stale (runs in CI)
```

CI runs `api:check` on every pull request. If a change adds or removes a public symbol, the
check fails until `etc/public-api.md` is regenerated and committed. That makes every change to
the public surface visible in the diff, so a breaking change cannot land unnoticed:

- The snapshot diff shows an add only. That is a minor bump.
- The snapshot diff shows a remove or rename. That is a major bump, and it needs to be a
  deliberate decision, not an accident.

When you intend to change the public API, run `bun run api:snapshot`, review the diff, and
commit it alongside the code change.

## Releasing

Publishing is release-triggered. Bump `version` in `package.json`, add a `CHANGELOG.md`
entry, then create a GitHub release whose tag matches the version (for example `v1.0.0`).
The publish workflow verifies the tag against `package.json` and pushes to GitHub Packages.
