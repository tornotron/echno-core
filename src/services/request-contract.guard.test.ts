/**
 * The contract check asked for in #49: every field name this package puts on the wire has to be
 * a field the endpoint it is sent to actually has.
 *
 * ## Why nothing else catches this
 *
 * There is no code generation anywhere between the two repositories. The domain types here are
 * hand-written on purpose, because `Issue` is a curated object that deliberately differs from
 * `IssueDto`, and the request bodies are assembled by hand to match. Nothing checks the match. A
 * `*ToJson` can emit a field name no endpoint reads and every signal says it is fine: it
 * typechecks, it passes review, the request returns 200, and the value is silently dropped. Three
 * separate bugs of that shape were found by hand in one week (#46, #47), which is not a method
 * that repeats.
 *
 * The parsers here are non-strict zod, which is the other half of why this is invisible. An
 * unexpected field in a response is ignored rather than rejected, so an additive backend change
 * costs nothing end to end. That is a good property and this check preserves it: a schema field
 * the client never sends is not a finding.
 *
 * ## What fails, and what does not
 *
 * See `analyse` in `scripts/request-contract.ts` for the full argument. In short, it fails on a
 * field name the endpoint does not have, on an endpoint the document does not have, and on a
 * required field a call site can never send. It does not fail on unused schema fields, on types,
 * or on meaning: `eventTimestamp` matching `eventTimestamp` says nothing about whether one side
 * is UTC and the other local, and every timezone bug found in this package was a perfect name
 * match. `date-serialization.guard.test.ts` is the mechanism for that one.
 *
 * ## One way it can be wrong
 *
 * A backend field carrying `@JsonAlias` accepts a name the document does not publish, because
 * OpenAPI has one property name per field and springdoc publishes the canonical one. So a client
 * sending the alias is reported as sending a field that does not exist, and it works anyway.
 * There are exactly two aliases in the backend today, `IssueCreationDto.type` accepting
 * `issueType` and `AssetCreationDto.assetCondition` accepting `condition`.
 *
 * Neither is reached from here any more, and the way the first one stopped being is worth keeping.
 * The alias saves a bean-bound body and nothing else. A partial update takes a `Map` and switches
 * over its keys, and there is no property for an alias to attach to, so the same name that worked
 * on create was dropped on update: changing an issue's type through the product returned 200 and
 * did nothing. That was three entries in the record, two of them false positives on create and
 * one of them the live bug on update, and leaving the false positives in rather than excusing
 * them is what kept the real one in view. The client now sends `type` on both paths, so all three
 * went together. `issue-wire-name.test.ts` is what holds it there.
 *
 * ## The committed record
 *
 * `etc/request-contract.md` holds the result: the coverage account, the findings, and the call
 * sites this pass cannot read. It is committed for the same reason the backend commits its
 * OpenAPI document, which is that a change to any of those three should be visible in review
 * rather than only in a log.
 *
 * The findings list is not empty today, and that is the point of the issue rather than a defect
 * in the check. `development` carries live drift: endpoints whose paths the backend moved, and
 * half a dozen create and update bodies carrying fields no DTO has. Each needs its own decision,
 * some of them on the backend, so they are recorded rather than fixed here. What this test
 * enforces is that the list does not grow, and #57 carries the triage of what is left.
 */
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { currentReport, reportPath } from '../../scripts/request-contract';

/** The `- ...` lines under the Findings heading, which is the part that must not grow. */
function findingsIn(report: string): string[] {
  const lines = report.split('\n');
  const start = lines.findIndex((line) => line.startsWith('## Findings'));
  if (start < 0) return [];
  const findings: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) break;
    if (line.startsWith('- ')) findings.push(line.slice(2));
  }
  return findings;
}

/**
 * What makes two findings the same finding, which is everything except where it sits in the file.
 *
 * A finding reads `path:line  OPERATION  ...`. Comparing that whole string means an edit anywhere
 * above a call site shifts its line and the same finding then counts as newly appeared and as
 * resolved at once, so both of the first two tests fire and the first one says "this is a bug to
 * fix, not a file to regenerate", which is the wrong instruction for a line that moved. That is
 * not hypothetical: it happened on this branch when a create payload above
 * `siteTransfersService.create` grew by five lines.
 *
 * Dropping the line number from the comparison leaves the third test to catch the shift, which it
 * does, with the instruction that is actually right for it.
 */
function identityOf(finding: string): string {
  return finding.replace(/^(\S+?):\d+/, '$1');
}

/**
 * Findings present in one list and not the other, compared as multisets on identity but reported
 * in their own words.
 *
 * Multisets rather than sets because two call sites in one file can produce findings that differ
 * only in the line, as `projectService.create` and `createWithFiles` both do. Treating those as
 * one would let a fix to either go unnoticed.
 */
function findingsOnlyIn(source: string[], other: string[]): string[] {
  const remaining = new Map<string, number>();
  for (const finding of other) {
    const identity = identityOf(finding);
    remaining.set(identity, (remaining.get(identity) ?? 0) + 1);
  }

  const only: string[] = [];
  for (const finding of source) {
    const identity = identityOf(finding);
    const left = remaining.get(identity) ?? 0;
    if (left === 0) only.push(finding);
    else remaining.set(identity, left - 1);
  }
  return only;
}

const generated = currentReport();
const committed = readFileSync(reportPath, 'utf8');

describe('request contract', () => {
  test('no write call sends a field name the endpoint does not have', () => {
    const appeared = findingsOnlyIn(findingsIn(generated), findingsIn(committed));

    expect(
      appeared,
      'A write call no longer lines up with the backend contract:\n\n' +
        `${appeared.map((finding) => `  ${finding}`).join('\n')}\n\n` +
        'This is a bug to fix, not a file to regenerate. Either the field name here is wrong, ' +
        'or the backend renamed or removed something and this package has to follow. ' +
        'etc/backend-request-fields.json is derived from the backend\'s committed OpenAPI ' +
        'document, so it says what the endpoint accepts today.'
    ).toEqual([]);
  });

  test('a finding that has been fixed is removed from the record', () => {
    const gone = findingsOnlyIn(findingsIn(committed), findingsIn(generated));

    expect(
      gone,
      'These findings no longer occur, so the committed record overstates the problem:\n\n' +
        `${gone.map((finding) => `  ${finding}`).join('\n')}\n\n` +
        'Run `bun run contract:report` and commit the diff. Keeping fixed findings on the list ' +
        'is how a list stops being read.'
    ).toEqual([]);
  });

  test('the committed record matches what the check produces', () => {
    expect(
      generated,
      `${reportPath} is out of date, in its coverage account or its list of unreadable call ` +
        'sites. Run `bun run contract:report` and commit the diff. A drop in the checked count ' +
        'means a call site that used to be readable no longer is, which is a quiet loss of ' +
        'coverage and worth a look before it is accepted.'
    ).toEqual(committed);
  });
});
