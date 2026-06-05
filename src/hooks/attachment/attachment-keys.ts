/**
 * hooks/attachment/attachment-keys.ts
 *
 * React Query key factory for attachment queries.
 *
 * Attachment caches come in two shapes that share the same prefix:
 *   - `byEntity` — a single attachment (e.g. profile picture, organization logo).
 *   - `listByEntity` — an array of attachments (e.g. task files, issue files).
 *
 * The two are distinguished by a literal `'all'` segment so a predicate or
 * prefix-match can target one without hitting the other.
 */

export const attachmentKeys = {
  all: ['attachments'] as const,

  byEntity: (entityId: number, entityType: string) =>
    [...attachmentKeys.all, 'entity', entityId, entityType] as const,

  listByEntity: (entityId: number, entityType: string) =>
    [...attachmentKeys.all, 'entity', 'all', entityId, entityType] as const,
};

/**
 * Parent entity namespaces whose detail and list caches may embed an
 * `attachments: Attachment[]` array. Used as the predicate scope when an
 * attachment delete needs to remove the row from every cached parent without
 * blast-invalidating the whole namespace.
 *
 * Shapes covered (verified via `grep "attachments\\?: Attachment\\[\\]"` over
 * `types/`):
 *   - `Project.attachments`
 *   - `Task.attachments`
 *   - `Issue.attachments`
 *   - `User.attachments`
 *   - `Organization.attachments`
 *   - `Employee.attachments`
 *
 * Key-shape note: `tasks` and `issues` detail caches still use the legacy
 * `['<ns>', id]` shape; `projects`, `user`, `organizations`, `employees` use
 * the canonical `['<ns>', 'detail', id]`. The recursive `stripAttachmentById`
 * helper walks any shape that has either an `attachments` array or a `content`
 * array of entities-with-attachments, so the key-shape difference is
 * irrelevant to the predicate.
 */
export const ATTACHMENT_PARENT_NAMESPACES = new Set([
  'projects',
  'tasks',
  'issues',
  'user',
  'organizations',
  'employees',
]);
