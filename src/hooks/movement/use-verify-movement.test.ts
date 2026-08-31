import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import type { useVerifyMovement } from './use-movement-mutations';

/**
 * What `useVerifyMovement` asks its caller for.
 *
 * echno-backend#635 took the movement verifier from the session, so the name
 * the client used to send is discarded. The consequence for a screen is not
 * cosmetic: `echno-web`'s movement list guarded the verify button on
 * `useCurrentUserEmployee()` having resolved, purely so it had a name to put in
 * the argument. With the argument gone the guard is dead weight, and the button
 * can be pressed as soon as the list renders.
 *
 * Asserted two ways because neither alone holds. The type test pins the mutate
 * argument, which is what a caller writes against; the source test pins the
 * call the hook makes, which is what reaches the wire. This package has no
 * React test renderer, so the second follows the pattern in
 * `hooks/task/use-tasks.test.ts` and reads the source.
 */
const source = readFileSync(
  new URL('./use-movement-mutations.ts', import.meta.url),
  'utf8'
);

/** The mutate function's variables, as a caller sees them. */
type VerifyVariables = Parameters<
  ReturnType<typeof useVerifyMovement>['mutate']
>[0];

describe('useVerifyMovement', () => {
  test('takes the id', () => {
    const variables: VerifyVariables = { id: 3 };
    expect(variables.id).toBe(3);
  });

  test('takes nothing else', () => {
    // Fails `typecheck:tests` if `verifiedBy` returns to the mutation
    // argument: the literal would stop being an excess property, the directive
    // would go unused, and the check reports that. A runtime assertion cannot
    // see this at all, because a re-added optional field that no caller sets
    // changes no behaviour until someone sets it.
    const variables: VerifyVariables = {
      id: 3,
      // @ts-expect-error the verifier comes from the session, not the caller
      verifiedBy: 'Anita Rao',
    };
    expect(variables.id).toBe(3);
  });

  test('passes only the id to the service', () => {
    const start = source.indexOf('export function useVerifyMovement(');
    expect(start).toBeGreaterThan(-1);
    const body = source.slice(start);

    expect(body).toInclude('movementService.verifyMovement(id)');
    expect(body).not.toInclude('verifyMovement(id, verifiedBy)');
  });
});
