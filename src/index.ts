// Core lib — foundational utilities used by every module.
// api-services is a barrel that re-exports from api-client; export from api-services only
// to avoid duplicate-export errors for ApiResponse, ApiError, etc.
export * from './lib/api/api-services';
export * from './lib/rbac/permissions';
export * from './lib/utils/error-helpers';
export * from './lib/utils/date-helpers';
export * from './lib/utils/parse-id';
// `api-utils` declares its own `ApiResponse` discriminated union which collides with
// the wrapper interface from api-client. Namespace-export to keep both available:
// `ApiResponse` at the top level is the api-client wrapper (used by services);
// consumers needing the discriminated union access it as `apiUtils.ApiResponse`.
export * as apiUtils from './lib/utils/api-utils';
export { logger } from './lib/logger';

// Query primitives — TanStack Query helpers (Phase 0 hotfix additions).
export * from './lib/query/retry';
export * from './lib/query/options';
export * from './lib/query/cache-merge';

// NOTE: lib/rbac/role-utils.ts is intentionally NOT exported. It depends on
// `OrgRole` from the employee module's types, which has not yet migrated.
// Add the export when the employee module lands.

// Module Exports

// Attachment
export * from './types/attachment';
export * from './services/attachment-service';
export * from './hooks/attachment';

// User
export * from './types/user';
export * from './services/user-service';
export * from './hooks/user';

// Employee
export * from './types/employee';
export * from './services/employee-service';
export * from './hooks/employee';

// Project
export * from './types/project';
export * from './services/project-service';
export * from './hooks/project';

