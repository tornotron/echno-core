# Changelog

All notable changes to `@tornotron/echno-core` will be documented in this file.

The project currently has released versions in git tags: `v0.0.0`, `v0.0.1`, `v0.1.0`, and `v0.1.1`.

## [v0.26.1] - 2026-07-15

### Changed

- Removed the unused `use-attendance-settings-page` hook and the corresponding attendance-settings barrel export.
- Package version bumped to `0.26.1`.

## [v0.26.0] - 2026-07-15

### Added

- Leave-management domain types for policies, balances, requests, approvals, calendar views, notifications, and related helper enums/parsers.
- Leave service methods for policy, balance, request, approval, calendar, and notification workflows.
- TanStack Query hooks for leave policy, balance, request, approval, calendar, and notification queries.
- Leave mutation hooks for policy CRUD, balance adjustments, request workflows, approval actions, and notification updates.
- Derived approver-dashboard hook for urgent and non-urgent pending approvals.
- Public module exports for the leave-management APIs.

### Changed

- Leave query and mutation caches now use dedicated key namespaces for policies, balances, requests, approvals, calendar views, and notifications.
- Leave mutations patch cached policy and request lists directly where possible and update approver pending counts without a refetch.
- Package version bumped to `0.26.0`.

## [v0.25.0] - 2026-07-15

### Added

- Attendance domain types for check-ins, clock events, summaries, reports, profiles, status, movements, regularizations, and work-duration calculations.
- Attendance service methods for core attendance reads and writes, including check-in, clock events, approvals, absences, deletes, and summary retrieval.
- Attendance-settings service methods for attendance profiles and resolved organization/project settings.
- Attendance-regularization service methods for request processing and queue access.
- Movement service methods for movement logging, retrieval, and verification.
- TanStack Query hooks for attendance, attendance settings, attendance regularization, and movement queries plus mutation workflows.
- Attendance settings page orchestration helpers for managing profile and shift dialogs.
- Public module exports for the attendance-related APIs.

### Changed

- Attendance mutations now patch detail and list caches in place where possible, while invalidating dependent summary caches that are recomputed server-side.
- Movement mutations now patch the parent attendance's embedded movement list directly instead of forcing a parent refetch.
- Regularization mutations preserve enriched cached context fields while syncing the parent attendance's embedded regularization state.
- Package version bumped to `0.25.0`.

## [v0.24.1] - 2026-07-15

### Added

- Invitation service methods for organization-scoped invite generation, validation, and listing.
- TanStack Query hooks for fetching invitations by organization and validating invite codes.
- Invitation create/request serializers for organization invite payloads.
- Rich invitation domain types, status helpers, and share-message builders for employee invite codes.
- Public module exports for the invitation APIs.

### Changed

- Invitation validation now normalizes backend responses into a typed invitation shape and treats invalid or expired codes as non-fatal validation results.
- Invitation mutations now invalidate the affected user, employee, and invitation caches after a successful validation.
- Invite-code generation now serializes optional employee details, status defaults, and date fields consistently for the backend.
- Package version bumped to `0.24.1`.

## [v0.24.0] - 2026-06-20

### Added

- Role-management service methods for assigning and unassigning organization roles via the Keycloak group endpoints.
- TanStack Query hooks for derived role-management reads and role assignment mutations.
- Public module exports for the role-management APIs.

### Changed

- Role assignments now patch the employee detail and list caches directly from request parameters instead of refetching.
- `useRoleManagement` now derives current and available roles from the shared employees cache without its own query namespace.
- Package version bumped to `0.24.0`.

## [v0.23.0] - 2026-06-20

### Added

- Shift timing domain types, create/update payloads, service methods, and query hooks for scheduling and attendance rules.
- Public module exports for the shift-timing APIs.

### Changed

- Shift timing serialization now normalizes `HH:MM` inputs to backend `LocalTime` strings and preserves server defaults for omitted thresholds.
- Package version bumped to `0.23.0`.

## [v0.22.0] - 2026-06-11

### Added

- WBS-element domain types for hierarchical work-breakdown structures, including create/update/move payloads and tree/leaf nodes.
- WBS-element service methods for project-scoped writes and reads: single/bulk create, hierarchical tree reads, flat list reads, leaf filtering, move (reparenting), and recalculation.
- TanStack Query hooks for WBS-element reads and mutation workflows, with integrated cross-namespace cache invalidation.
- Public module exports for the WBS-element APIs.

### Changed

- WBS-element mutations now automatically invalidate derived tree and leaf views while patching flat list and detail caches from full DTO responses.
- Package version bumped to `0.22.0`.

## [v0.21.0] - 2026-06-11

### Added

- Site-transfer domain types for transfers, line items, and create payloads.
- Site-transfer service methods for list/detail reads, paginated access, status filtering, and sending/receiving project filtering.
- TanStack Query hooks for site-transfer reads and mutation workflows (create, status transition).
- Public module exports for the site-transfers APIs.

### Changed

- Site-transfer mutations now invalidate material-stock and inventory-transaction caches to propagate stock movements and ledger writes.
- Package version bumped to `0.21.0`.

## [v0.20.0] - 2026-06-11

### Added

- GRN domain types for goods-received notes, line items, and create/update payloads.
- GRN service methods for list/detail reads, paginated access, vendor/date-range filtering, and CRUD operations.
- TanStack Query hooks for GRN reads and mutation workflows.
- Public module exports for the GRN APIs.

### Changed

- GRN create mutations now invalidate material-stock, purchase-order, and inventory-transaction caches to propagate stock increments and PO advancement.
- Package version bumped to `0.20.0`.

## [v0.19.0] - 2026-06-11

### Added

- Inventory-transaction domain types for ledger entries, transaction types, and stock-status summaries.
- Inventory-transaction service methods for read-only ledger access: list, detail, paginated, and filtered reads (by material, type, date-range, and storage-location).
- Material and Storage-Location stock methods to retrieve current inventory levels.
- TanStack Query hooks for inventory-transaction list/detail queries and stock-level tracking.
- Public module exports for the inventory-transactions APIs.

### Changed

- Renamed `MaterialStock` to `MaterialWithStock` in the materials module to avoid collision with inventory-transaction stock models and improve clarity.
- Updated materials service, hooks, and types to use the new `MaterialWithStock` interface.
- Package version bumped to `0.19.0`.

## [v0.18.0] - 2026-06-10

### Added

- Indent domain types for requisitions, statuses, and create/update payloads.
- Indent item domain types and serializers for line items on requisitions.
- Indent service methods for list/detail reads, paginated reads, create, update, and delete operations.
- Indent item service methods for direct line-item reads, create, update, delete, and conversion operations.
- TanStack Query hooks for indent and indent-item reads plus mutation workflows.
- Public module exports for the indent APIs.

### Changed

- Indent and indent-item mutations now patch parent-indent item arrays directly and invalidate dependent purchase-order caches where needed.
- Package version bumped to `0.18.0`.

## [v0.17.1] - 2026-06-10

### Added

- Per-domain `keys.ts` barrels for every hook module so query-key factories share a consistent import path.

### Changed

- Replaced the remaining `*-keys.ts` hook key files with `keys.ts` and updated imports across all hook modules.
- Removed the deprecated hook, service, and type root barrels to keep imports domain-local.
- Package version bumped to `0.17.1`.

## [v0.17.0] - 2026-06-10

### Added

- Local `keys.ts` barrel files for each hook module so query-key factories can be imported from a consistent module path.

### Changed

- Removed the top-level `hooks/index.ts`, `hooks/keys.ts`, `services/index.ts`, and `types/index.ts` barrels in favour of per-domain imports.
- Package version bumped to `0.17.0`.

## [v0.16.0] - 2026-06-10

### Added

- Purchase order domain types for purchase orders, line items, statuses, and create/update payloads.
- Purchase order service methods for list/detail reads, vendor/indent/status filters, CRUD operations, and status transitions.
- Purchase order item service methods for line-item reads and create/update/delete operations.
- TanStack Query hooks for purchase order and line-item query variants plus mutation workflows.
- Public module exports for the purchase order APIs.

### Changed

- Purchase order parsing now normalizes legacy `createdBy` shapes and embedded line items into a canonical domain object.
- Purchase order and line-item mutation hooks now keep embedded `items` arrays and vendor summary caches consistent across writes.
- Package version bumped to `0.16.0`.

## [v0.15.0] - 2026-06-10

### Added

- Barrel files for top-level type, service, hook, and query-key exports.
- Package entrypoint exports for the new barrel files.

### Changed

- Package exports now centralize module access through `types/index.ts`, `services/index.ts`, `hooks/index.ts`, and `hooks/keys.ts`.
- Package version bumped to `0.15.0`.

## [v0.14.0] - 2026-06-10

### Added

- Material-consumption domain types for consumption events, consumption types, and create payloads.
- Material-consumption service methods for list/detail reads, filtered queries, paginated reads, and create operations.
- TanStack Query hooks for material-consumption reads and create mutations.
- Public module exports for the material-consumption APIs.

### Changed

- Material-consumption parsing now normalizes append-only ledger responses into canonical domain objects with denormalized display fields.
- Material-consumption create mutations invalidate the full consumption namespace and the affected material stock cache so downstream views refetch correctly.
- Package version bumped to `0.14.0`.

## [v0.13.0] - 2026-06-10

### Added

- Materials domain types for inventory records, stock-aware reads, consumption events, enums, and create/update payloads.
- Materials service methods for list/detail reads, paginated reads, search, stock reads, CRUD operations, and material consumption handling.
- TanStack Query hooks for material list/detail/query variants and create/update/delete mutations.
- Public module exports for the materials APIs.

### Changed

- Materials parsing now normalizes stock-aware and consumption payloads into canonical domain objects with denormalized display fields.
- Materials mutation hooks now keep list, detail, and stock caches consistent across create, update, and delete flows.
- Package version bumped to `0.13.0`.

## [v0.12.1] - 2026-06-10

### Added

- Detailed vendor documentation for types, services, hooks, query keys, and request serializers.
- Public re-exports for the full vendor hook surface.

### Changed

- Vendor service, hook, and type comments were expanded to document nested sub-resource normalization, summary caching, and payment-terms handling.
- Package version bumped to `0.12.1`.

## [v0.12.0] - 2026-06-10

### Added

- Vendor domain types for vendor profiles, summaries, contacts, tax identifiers, bank accounts, payment terms, and create/update payloads.
- Vendor service methods for CRUD operations plus contact, tax identifier, bank account, payment term, search, paginated, and summary endpoints.
- TanStack Query hooks for vendor list/detail queries and vendor-related mutation workflows.
- Public module exports for the vendor APIs.

### Changed

- Vendor parsing now normalizes nested contact, tax identifier, bank account, and payment term shapes into a single canonical vendor model.
- Package version bumped to `0.12.0`.

## [v0.11.1] - 2026-06-10

### Added

- Detailed labour documentation for types, services, hooks, and query keys.
- Public re-exports for the full labour hook surface.

### Changed

- Labour service, hook, and type comments were expanded to document backend DTO differences, cache behavior, and optimistic delete rollback.
- Package version bumped to `0.11.1`.

## [v0.11.0] - 2026-06-10

### Added

- Labour domain types for labour records, create/update payloads, and employment-related enums.
- Labour service methods for list/detail reads, create, update, and delete operations.
- TanStack Query hooks for labour list/detail queries and create/update/delete mutations.
- Public module exports for the labour APIs.

### Changed

- Labour create/update flows now document the mixed DTO response shapes and the cache invalidation strategy used after writes.
- Labour delete mutations now preserve and restore cached list/detail state on error.
- Package version bumped to `0.11.0`.

## [v0.10.2] - 2026-06-09

### Added

- Relative `baseURL` support in the API client for browser-based apps.
- Centralized URL resolution logic for JSON, multipart, and form-data requests.

### Changed

- API client request builders now resolve relative `baseURL` values against `globalThis.location.origin` at request time.
- API client documentation now distinguishes browser-only relative URLs from absolute base URLs.
- Package version bumped to `0.10.2`.

## [v0.10.1] - 2026-06-09

### Added

- Detailed storage-location documentation for types, services, hooks, cache keys, and payload serializers.
- Public re-exports for the full storage-location hook surface.

### Changed

- Storage location comments were expanded to document flat DTO handling, list-cache coverage, and backend response shapes.
- Package version bumped to `0.10.1`.

## [v0.10.0] - 2026-06-09

### Added

- Storage location domain types for location metadata, create/update payloads, and location type labels.
- Storage location service methods for list/detail reads, create, update, and delete operations.
- TanStack Query hooks for storage location list/detail queries and create/update/delete mutations.
- Public module exports for the storage location APIs.

### Changed

- Storage location mutations now seed and update cache entries directly from full DTO responses, including every list cache under the namespace.
- Package version bumped to `0.10.0`.

## [v0.9.1] - 2026-06-09

### Added

- Detailed invitation documentation for types, services, hooks, and query keys.
- Public re-exports for the full invitation hook surface.

### Changed

- Invitation service and hook comments were expanded to clearly describe the current backend path mismatches and the required integration follow-up.
- Package version bumped to `0.9.1`.

## [v0.9.0] - 2026-06-09

### Added

- Invitation domain types for invite-code records, drafts, validation requests, and generate-code payloads.
- Invitation service methods for generating, listing, reading, and deleting invite codes.
- TanStack Query hooks for invitation reads and invite-code mutations.
- Public module exports for the invitation APIs.

### Changed

- Invitation query keys, service paths, and hook comments now document the current backend alignment caveats for the invitation flow.
- Package version bumped to `0.9.0`.

## [v0.8.1] - 2026-06-09

### Added

- Detailed organization documentation for types, services, query hooks, and cache keys.
- Public re-exports for the full organization hook surface.

### Changed

- Organization service, hook, and type comments were expanded to describe API shapes, multipart logo handling, and cache behavior.
- Package version bumped to `0.8.1`.

## [v0.8.0] - 2026-06-09

### Added

- Organization domain types for organization profiles, create/update payloads, and optional logo file uploads.
- Organization service methods for list/detail reads, create, update, and delete operations.
- TanStack Query hooks for organization list/detail queries and create/update/delete mutations.
- Public module exports for the organization APIs.

### Changed

- Organization parsing now preserves nested employees, projects, attachments, and derived logo data from backend responses.
- Organization mutations now preserve nested cache data where possible and invalidate related user and employee caches after writes.
- Package version bumped to `0.8.0`.

## [v0.7.1] - 2026-06-07

### Added

- Detailed issue documentation for types, services, hooks, and cache keys.
- Public re-exports for the full issue hook surface.

### Changed

- Issue service and hook comments were expanded to describe API shapes, cache behavior, and author resolution.
- Package version bumped to `0.7.1`.

## [v0.7.0] - 2026-06-07

### Added

- Issue domain types for issue metadata, status, type, comments, and file uploads.
- Issue comment domain types and serializers for issue discussion.
- Issue service functions for list/detail reads, project/task filtering, CRUD operations, and comment handling.
- TanStack Query hooks for issue reads, mutations, comments, comment mutations, and detail prefetching.
- Public module exports for the issue APIs.

### Changed

- Package version bumped to `0.7.0`.

## [v0.6.1] - 2026-06-07

### Added

- Detailed work-category documentation for types, services, hooks, and cache keys.
- Public re-exports for the full work-category hook surface.

### Changed

- Work-category service and hook comments were expanded to describe API shapes and cache behavior.
- Package version bumped to `0.6.1`.

## [v0.6.0] - 2026-06-06

### Added

- Work-category domain types for category metadata and create/update payloads.
- Work-category service functions for list/detail reads and CRUD operations.
- TanStack Query hooks for work-category reads, mutations, and cache keys.
- Public module exports for the work-category APIs.

### Changed

- Package version bumped to `0.6.0`.

## [v0.5.1] - 2026-06-06

### Added

- Expanded task module exports for the task query hooks and prefetch helper.
- Detailed documentation for task types, statuses, service methods, and hooks.

### Changed

- Task service and hook comments were normalized and expanded for the current task module surface.
- Package version bumped to `0.5.1`.

## [v0.5.0] - 2026-06-06

### Added

- Task domain types, services, and hooks for task management and project-scoped task queries.
- Task prefetch helper for warming detail caches on hover or focus.
- Public module exports for the task APIs.

### Changed

- Package version bumped to `0.5.0`.

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
