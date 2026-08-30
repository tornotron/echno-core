/**
 * The backend calls an issue's category `type`. This package used to send it as `issueType` on
 * both paths, and a doc comment above the create serializer asserted that name matched.
 *
 * Create survived that anyway, because `IssueCreationDto` carries `@JsonAlias("issueType")` and a
 * bean-bound body honours an alias. Update did not: it takes a `Map` and switches over the keys,
 * and a map never goes through property binding, so there is nothing for an alias to attach to.
 * The key fell through a switch with no default, the caller got a 200, and changing an issue's
 * type through the product did nothing at all.
 *
 * So the two paths have to be pinned together. Testing only the update would leave create free to
 * drift back to the alias, which is the arrangement that hid this in the first place.
 */
import { describe, expect, test } from 'bun:test';

import { createIssueToJson } from './issue-create';
import { updateIssueToJson } from './issue-update';
import { IssueType } from './issue-type';

describe('the name an issue category travels under', () => {
  test('create sends it as type, which is what the backend field is called', () => {
    const payload = createIssueToJson({
      title: 'Honeycombing on the block A raft',
      issueType: IssueType.quality,
      projectId: 3,
      creatorId: 5,
    });

    expect(payload.type).toBe(IssueType.quality);
    expect(payload).not.toHaveProperty('issueType');
  });

  test('update sends it as type, where no alias would have saved it', () => {
    const payload = updateIssueToJson({ issueType: IssueType.safety });

    expect(payload.type).toBe(IssueType.safety);
    expect(payload).not.toHaveProperty('issueType');
  });

  test('update still omits the category when the caller is not changing it', () => {
    // The whole point of the update payload is that an absent key means "leave it alone".
    // Renaming the key must not turn it into one that is always present.
    const payload = updateIssueToJson({ title: 'Honeycombing along the north edge' });

    expect(payload).not.toHaveProperty('type');
    expect(payload).not.toHaveProperty('issueType');
  });

  test('the caller-facing field keeps its name, so no call site has to change', () => {
    // `issueType` is the name echno-web passes; only the wire name moved. If this ever needs to
    // change it is a breaking release, not a fix.
    const payload = updateIssueToJson({ issueType: IssueType.material, status: undefined });

    expect(payload.type).toBe(IssueType.material);
  });
});
