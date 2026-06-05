# Changelog

All notable changes to `@tornotron/echno-core` will be documented in this file.

The project currently has released versions in git tags: `v0.0.0`, `v0.0.1`, `v0.1.0`, and `v0.1.1`.

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
