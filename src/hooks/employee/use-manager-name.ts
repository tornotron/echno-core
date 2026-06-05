/**
 * @module hooks/employee/use-manager-name
 *
 * Resolves manager IDs into display names by looking them up in the
 * organisation's cached employee list.
 *
 * Both hooks compose {@link useEmployees} — they do not issue their own
 * queries. They exist to centralise the lookup pattern used by invitation,
 * employee, and project UIs.
 */

import { useMemo } from 'react';
import { useEmployees } from './use-employee';

/**
 * Resolves a single manager ID to a display name.
 *
 * @param managerId - Surrogate ID of the manager, or `undefined` to skip the lookup.
 * @returns The manager's name, or `undefined` if the ID is absent or no
 *   matching employee is cached.
 */
export function useManagerName(managerId?: number): string | undefined {
  const { data: employees } = useEmployees();

  const managerName = useMemo(() => {
    if (!managerId || !employees) {
      return;
    }

    const manager = employees.find((emp) => emp.id === managerId);
    return manager?.name;
  }, [managerId, employees]);

  return managerName;
}

/**
 * Resolves a batch of manager IDs to a `{ id → name }` map.
 *
 * Convenient for rendering lists of invitations or employees where each
 * row carries a separate `managerId`. IDs that are `undefined` or have no
 * matching employee in the cache are silently skipped.
 *
 * @param managerIds - Manager IDs to resolve. `undefined` entries are ignored.
 * @returns A map keyed by manager ID, containing only entries that resolved.
 */
export function useManagerNames(
  managerIds: (number | undefined)[]
): Record<number, string> {
  const { data: employees } = useEmployees();

  const managerNamesMap = useMemo(() => {
    if (!employees || managerIds.length === 0) {
      return {};
    }

    const map: Record<number, string> = {};

    for (const managerId of managerIds) {
      if (managerId) {
        const manager = employees.find((emp) => emp.id === managerId);
        if (manager) {
          map[managerId] = manager.name;
        }
      }
    }

    return map;
  }, [managerIds, employees]);

  return managerNamesMap;
}
