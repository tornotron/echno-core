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

// Task
export * from './types/task';
export * from './services/task-service';
export * from './hooks/task';

// Work Category
export * from './types/work-category';
export * from './services/work-category-service';
export * from './hooks/work-category';

// Issue
export * from './types/issue';
export * from './services/issue-service';
export * from './hooks/issue';

// Organization
export * from './types/organization';
export * from './services/organization-service';
export * from './hooks/organization';

// Invitation
export * from './types/invitation';
export * from './services/invitation-service';
export * from './hooks/invitation';

// Storage Locations
export * from './types/storage-locations';
export * from './services/storage-locations-service';
export * from './hooks/storage-locations';

// Labour
export * from './types/labour';
export * from './services/labour-service';
export * from './hooks/labour';

// Vendor
export * from './types/vendor';
export * from './services/vendor-service';
export * from './hooks/vendor';

// Materials
export * from './types/materials';
export * from './services/materials-service';
export * from './hooks/materials';

// Material Consumption
export * from './services/material-consumption-service';
export * from './hooks/material-consumption';

// Purchase Orders
export * from './types/purchase-orders';
export * from './services/purchase-orders-service';
export * from './hooks/purchase-orders';

// Indent
export * from './types/indents';
export * from './services/indents-service';
export * from './hooks/indents';

// Inventory Transactions
export * from './types/inventory-transactions';
export * from './services/inventory-transactions-service';
export * from './hooks/inventory-transactions';

// GRN
export * from './types/grn';
export * from './services/grn-service';
export * from './hooks/grn';

// Site Transfers
export * from './types/site-transfers';
export * from './services/site-transfers-service';
export * from './hooks/site-transfers';

// WBS Element
export * from './types/wbs-element';
export * from './services/wbs-element-service';
export * from './hooks/wbs-element';