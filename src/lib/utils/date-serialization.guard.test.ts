/**
 * Source-level guard on the two date conversions that cross the wire.
 *
 * Every timezone bug found in this package so far has been one of two lines of
 * code, and neither is detectable by typechecking or by any test of the module
 * that contains it, because both produce a plausible `Date` and a plausible
 * string. They are only visible as *shapes*, which is what this file checks.
 *
 * The reason the guard is a source scan rather than a set of unit tests is the
 * failure mode it exists for. The August pass wrote correct unit tests for the
 * parsers in `src/types/` and shipped, and the bug stayed live, because
 * `src/services/` held private `parse*` functions shadowing the ones under
 * test and nothing enumerated them. A test can only cover a call site somebody
 * remembered. A scan covers the ones nobody did.
 *
 * See `date-helpers.ts` for which conversion belongs to which kind of field.
 *
 * There is no lint step in this package (no ESLint, just `tsc` and `bun test`),
 * so this runs as a test. If ESLint is ever added, these two rules are the
 * first two custom rules to port, and this file can go.
 */
import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Repo-relative root of the two layers a wire value passes through. */
const SRC = join(import.meta.dir, '..', '..');

/** Both layers, because the last sweep checked one and declared the job done. */
const SCANNED_DIRS = ['types', 'services'];

/**
 * Escape hatch. A line carrying this comment is skipped by both rules, and the
 * text after the colon has to say why. It is deliberately shaped like the
 * `eslint-disable-next-line` comments already in this package.
 *
 * There are no uses of it today. If one appears, it should be read as a claim
 * that the field is genuinely an exception, not as a way past a red build.
 */
const EXEMPTION = 'wire-date-exempt:';

/** The conversions a value is allowed to arrive through. */
const SANCTIONED_PARSERS = [
  'parseUTCDate(',
  'parseLocalDateTime(',
  'parseLocalDate(',
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Blanks out block and line comments, preserving line numbering.
 *
 * Without this the guard fires on its own documentation: several modules
 * explain in a doc comment that they use `toLocalDateTimeString` rather than
 * `toISOString()`, which is exactly the prose that should be encouraged.
 */
function stripComments(source: string): string {
  let out = '';
  let inBlock = false;
  let inLine = false;
  let inString: string | null = null;

  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    const next = source[i + 1];
    const isNewline = c === '\n';

    if (inBlock) {
      if (c === '*' && next === '/') {
        inBlock = false;
        out += '  ';
        i++;
        continue;
      }
      out += isNewline ? c : ' ';
      continue;
    }
    if (inLine) {
      if (isNewline) {
        inLine = false;
        out += c;
        continue;
      }
      out += ' ';
      continue;
    }
    if (inString) {
      if (c === '\\') {
        out += c + (next ?? '');
        i++;
        continue;
      }
      if (c === inString) inString = null;
      out += c;
      continue;
    }
    if (c === '/' && next === '*') {
      inBlock = true;
      out += '  ';
      i++;
      continue;
    }
    if (c === '/' && next === '/') {
      inLine = true;
      out += '  ';
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') inString = c;
    out += c;
  }
  return out;
}

interface Finding {
  file: string;
  line: number;
  text: string;
}

/** Scans the two layers, calling `check` on every non-comment line. */
function scan(check: (code: string, raw: string) => boolean): Finding[] {
  const findings: Finding[] = [];
  for (const dir of SCANNED_DIRS) {
    for (const file of walk(join(SRC, dir))) {
      const raw = readFileSync(file, 'utf8').split('\n');
      const code = stripComments(raw.join('\n')).split('\n');
      code.forEach((codeLine, index) => {
        const rawLine = raw[index] ?? '';
        if (rawLine.includes(EXEMPTION)) return;
        if (check(codeLine, rawLine)) {
          findings.push({
            file: relative(SRC, file),
            line: index + 1,
            text: rawLine.trim(),
          });
        }
      });
    }
  }
  return findings;
}

const report = (findings: Finding[]) =>
  findings.map((f) => `  ${f.file}:${f.line}  ${f.text}`).join('\n');

describe('outbound: nothing reaches the wire as a UTC instant', () => {
  test('no serializer calls Date.toISOString()', () => {
    const findings = scan((code) => code.includes('.toISOString('));

    expect(
      findings.length === 0
        ? ''
        : `.toISOString() emits UTC with a trailing Z. A backend field declared\n` +
            `LocalDateTime or LocalDate carries no offset and its request DTOs are\n` +
            `annotated @JsonFormat(lenient = OptBoolean.FALSE), so the value is\n` +
            `rejected with a 400; where the annotation is missing it is truncated to\n` +
            `the UTC digits and silently shifted by the client's offset.\n\n` +
            `Use toLocalDateTimeString for a value with a time of day, or\n` +
            `toLocalDateAtMidnight for a calendar date. See date-helpers.ts.\n\n` +
            report(findings)
    ).toBe('');
  });
});

describe('inbound: nothing is read off the wire as local by accident', () => {
  test('no parser constructs a Date directly from a response value', () => {
    const findings = scan((code) => {
      if (!/new Date\(\s*[^)\s]/.test(code)) return false;
      // `x ?? new Date(y)` after a sanctioned parser is the established fallback
      // for an unparseable value: the parser returns null exactly when `new
      // Date()` would be invalid, so the branch is unreachable in practice.
      if (
        /\?\?\s*new Date\(/.test(code) &&
        SANCTIONED_PARSERS.some((p) => code.includes(p))
      ) {
        return false;
      }
      return true;
    });

    expect(
      findings.length === 0
        ? ''
        : `new Date(value) reads a naive backend timestamp as LOCAL time. That is\n` +
            `correct for exactly one of the three kinds of date on the wire, and the\n` +
            `other two are shifted by the client's offset with no error.\n\n` +
            `Use parseUTCDate for a server-set instant (createdAt, updatedAt,\n` +
            `verifiedAt, approvedAt), parseLocalDateTime for a wall clock the user\n` +
            `entered, or parseLocalDate for a bare LocalDate. See date-helpers.ts.\n\n` +
            report(findings)
    ).toBe('');
  });
});

describe('tests that can see a timezone bug', () => {
  test('every test touching a local-time conversion pins TZ', () => {
    // The runner defaults to UTC, where a local conversion and a UTC one produce
    // identical output, so an unpinned test passes against the bug it was
    // written to catch. Measured, not theoretical: the clock tests fail 5 of 12
    // under IST and 3 of 12 under UTC.
    const localTimeApi = [
      'toLocalDateTimeString',
      'toLocalDateAtMidnight',
      'parseLocalDateTime',
      'parseLocalDate',
      'formatDateForBackend',
    ];

    // walk() deliberately skips test files, so collect them separately.
    const allTests: string[] = [];
    const collectTests = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) collectTests(full);
        else if (entry.endsWith('.test.ts')) allTests.push(full);
      }
    };
    collectTests(SRC);

    const unpinned: string[] = [];
    for (const file of allTests) {
      // This file names the whole API in order to check for it.
      if (file === import.meta.path) continue;
      const source = readFileSync(file, 'utf8');
      if (!localTimeApi.some((name) => source.includes(name))) continue;
      // An assignment to a zone *literal*. Matching `process.env.TZ` loosely
      // would also match the `= originalTimeZone` restore, which is what a file
      // that has had its pin removed still contains.
      if (/process\.env\.TZ\s*=\s*['"`]/.test(source)) continue;
      unpinned.push(relative(SRC, file));
    }

    expect(
      unpinned.length === 0
        ? ''
        : `These tests exercise a local-time conversion without pinning TZ, so they\n` +
            `run in the runner's default UTC, where the conversion under test is\n` +
            `indistinguishable from the bug it replaces. Pin a non-UTC zone and\n` +
            `restore it, as clock-timestamp.test.ts does.\n\n` +
            unpinned.map((f) => `  ${f}`).join('\n')
    ).toBe('');
  });
});
