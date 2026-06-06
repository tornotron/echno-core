# Changelog

All notable changes to `@tornotron/echno-core` will be documented in this file.

The project currently has released versions in git tags: `v0.0.0`, `v0.0.1`, `v0.1.0`, and `v0.1.1`.

## [v0.4.1] - 2026-06-06

### Added

- Hook exports for project list, detail, organization, employee, and project-member queries.
- Project prefetch helper for warming detail caches on hover or focus.

### Changed

- Project service and type handling now preserve richer nested project data across partial responses.
- Project and employee model definitions were expanded to support member, issue, task, and work-category relationships.
- Package version bumped to `0.4.1`.

## [v0.4.0] - 2026-06-06

### Added

- Project domain types for project metadata, statuses, file uploads, and create/update payloads.
- Issue, task, and work-category domain types used by the new project graph model.
- Project service functions for list/detail reads, organization filtering, employee membership, CRUD, and file-aware writes.
- TanStack Query hooks for project list/detail queries, prefetching, and mutation workflows.
- Public module exports for the new project APIs.

### Changed

- Package version bumped to `0.4.0`.

## [v0.3.3] - 2026-06-06

### Added

- `useEmployeeRoles()` for deriving the current employee's organisation-scope roles from the cached employee profile.
- Public export for the employee roles hook.

### Changed

- Package version bumped to `0.3.3`.
- Package license changed from `UNLICENSED` to `MIT`.

## [v0.3.2] - 2026-06-06

### Added

- GitHub Actions workflow for publishing releases to GitHub Packages.
- Package metadata for repository, homepage, issues, author, license, and published files.

### Changed

- Package version bumped to `0.3.2`.
- Publish flow now uses `prepublishOnly` to build before packaging.
- Publish configuration was added for the GitHub Packages registry.

## [v0.3.1] - 2026-06-06

### Added

- `userService.getUserEmployees()` for fetching the current user's employee memberships.
- `useUserEmployees()` for querying the current user's memberships across organizations.

### Changed

- User service parsing now handles employee membership responses with dedicated validation and error handling.
- Documentation and inline comments were refreshed across the user and attachment mutation hooks.
- Package version bumped to `0.3.1`.

## [v0.3.0] - 2026-06-06

### Added

- Employee domain types for profiles, statuses, departments, org roles, and create/update payloads.
- Employee service functions for reading, updating, deleting, and linking employees to organizations.
- TanStack Query hooks for employee queries, mutations, and manager-name lookup helpers.
- Organization query key factories for employee-related cache coordination.
- Public module exports for the employee APIs.

### Changed

- Package version bumped to `0.3.0`.
- Added `@types/react` to devDependencies to support the new hook typings.

## [v0.2.0] - 2026-06-05

### Added

- User domain types for profiles, roles, update payloads, and file-upload metadata.
- User service functions for reading and updating the current user profile.
- TanStack Query hooks for user queries and mutations.
- Public module exports for the new user APIs.

### Changed

- The TypeScript target was updated to `ES2023`.
- User-related attachment, service, and hook imports were normalized to relative paths.

## [v0.1.1] - 2026-06-05

### Fixed

- Updated attachment-related import paths to use relative imports.
- Removed the now-unneeded path alias entry from `tsconfig.json`.

## [v0.1.0] - 2026-06-05

### Added

- Initial changelog documenting the first published versions of `@tornotron/echno-core`.

## [v0.0.1] - 2026-06-05

### Added

- Attachment domain types and upload payload models.
- Attachment service functions for file handling operations.
- TanStack Query hooks for attachment queries and mutations.
- Public module exports for attachment types and services.
- Date parsing helpers and ID parsing utilities for payload normalization.

### Changed

- The package entrypoint now re-exports attachment-related APIs.

## [v0.0.0] - 2026-06-05

### Added

- Project setup for the shared `echno-core` package.
- TypeScript build and `prepare` workflow for publishing.
- Foundation utilities and module exports in `src/index.ts`.
- Error handling helpers with field-level validation support.
- Cache merge utilities and TanStack Query option profiles.
- API client and shared API service helpers.
- Structured logging with PII sanitization and environment-aware output.
- Client-side role-check utilities.
- Project README with overview, architecture, and usage guidance.

### Fixed

- `package.json` now includes a `prepare` script for TypeScript compilation.
