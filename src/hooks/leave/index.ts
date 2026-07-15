/**
 * @module hooks/leave
 *
 * Barrel export for the leave module — the key factory (`leaveKeys`),
 * query hooks, approver-scoped queries, and mutation hooks. The
 * `useLeaveRole` next-auth adapter is web-only and lives in echno-web.
 */
export * from './use-leave';
export * from './use-leave-mutations';
export * from './use-approvals-for-approver';
