/**
 * @module hooks/employee/employee-keys
 *
 * TanStack Query key factory for the Employee domain.
 *
 * Key shapes:
 * - `['employees']` — namespace root (invalidation prefix only, never a query key).
 * - `['employees', 'list']` — full employee list (consumed by `useEmployees`).
 * - `['employees', 'detail', id]` — single employee.
 * - `['employees', 'subordinates', managerId]` — direct reports of one manager.
 * - `['employees', 'managers']` — every employee that acts as a manager.
 * - `['employees', 'managers', organizationId]` — manager list scoped to one org.
 *
 * The {@link isEmployeeListCache} predicate in
 * `hooks/employee/use-employee-mutations.ts` excludes `detail(id)` by
 * checking `key[1] !== 'detail'`; mutations rely on this distinction when
 * predicate-replacing across every list shape simultaneously.
 *
 * @see {@link useEmployees} canonical consumer of `lists()`.
 * @see {@link useEmployee} canonical consumer of `detail(id)`.
 */

export const employeeKeys = {
  all: ['employees'] as const,
  lists: () => [...employeeKeys.all, 'list'] as const,
  pages: () => [...employeeKeys.all, 'page'] as const,
  page: (page: number, size: number) =>
    [...employeeKeys.all, 'page', page, size] as const,
  detail: (id: number) => [...employeeKeys.all, 'detail', id] as const,
  subordinates: (managerId?: number) =>
    [...employeeKeys.all, 'subordinates', managerId] as const,
  managers: () => [...employeeKeys.all, 'managers'] as const,
  managersByOrg: (organizationId: number) =>
    [...employeeKeys.all, 'managers', organizationId] as const,
};
