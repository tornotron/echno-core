/**
 * Reads every write call in `src/services` and works out which field names it puts on the wire.
 *
 * This is the client half of the check tornotron/echno-core#49 asks for. The other half is
 * `etc/backend-request-fields.json`, derived from the backend's published document by
 * `scripts/backend-contract.ts`. The test in `src/services/request-contract.guard.test.ts` puts
 * the two together.
 *
 * ## Why it keys on the call site rather than on the serializer
 *
 * The issue's sketch walks the `*ToJson` serializers and maps each to an endpoint through a table
 * written by hand. Two things go wrong with that, both measured rather than guessed:
 *
 * - About a third of the write calls in this package build their body inline and never touch a
 *   serializer. `attendanceService.approve` posts `{ approvalStatus, remarks }` as a literal, and
 *   the finance submit/approve/cancel family is the same shape. A serializer walk cannot see any
 *   of them, and their field names can be wrong in exactly the way `wbs-element`'s were.
 * - Six call sites mutate the payload after serialising it. `taskService.create` does
 *   `payload.attachments = []` between calling `createTaskToJson` and posting. Checking what the
 *   serializer returned would not see that key at all.
 *
 * Keying on the call site closes both, and it removes the table: the endpoint is already sitting
 * in the call, as its first argument, so the mapping cannot drift out of date the way a
 * hand-written one does.
 *
 * ## Why it is static rather than run over fixtures
 *
 * The issue suggests running each serializer over a fully populated fixture and reading the keys
 * off the result. That means writing and maintaining a fixture for each of 92 serializers, and a
 * fixture that falls behind its input type quietly reduces coverage without failing anything.
 * A serializer here is a flat sequence of `payload.field = ...` assignments, so reading the
 * assigned names off the syntax gives the same answer with nothing to maintain. Where the syntax
 * defeats it (a spread, a computed key) the call site is reported as unresolved rather than
 * silently treated as empty.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';

const ROOT = path.resolve(import.meta.dir, '..');
const SERVICES = path.join(ROOT, 'src', 'services');

/**
 * The base URL every service path is appended to. `ApiClient` is constructed with
 * `NEXT_PUBLIC_API_URL`, which every deployment sets to the versioned API root, so a service
 * path of `/tasks/web` is `/api/v1/tasks/web` in the document.
 */
const API_BASE = '/api/v1';

/** The client methods that send a body, and the HTTP method each one uses. */
const WRITE_METHODS: Record<string, string> = {
  post: 'POST',
  put: 'PUT',
  patch: 'PATCH',
  postMultipart: 'POST',
  patchMultipart: 'PATCH',
};

/**
 * `postFormData` takes a `FormData` the caller assembled itself, so there is no object whose keys
 * can be read. Listed rather than ignored: the check reports these as uncovered so nobody reads a
 * green run as covering them.
 */
const OPAQUE_BODY_METHODS = ['postFormData'];

/** Why a call site could not be checked, in the words the report prints. */
export type Unresolved =
  | 'body built from a spread or a computed key'
  | 'body is a value this pass cannot follow'
  | 'endpoint path is not a literal'
  | 'body is a FormData assembled by the caller';

export interface WriteCall {
  /** `src/services/task-service.ts:201`, for the report. */
  location: string;
  /** `POST /api/v1/tasks/web`, matching the keys of the backend index. */
  operation: string;
  /** The path as written in the call, with each interpolation replaced by `{}`. */
  endpoint: string;
  method: string;
  /** Field names this call puts in the body, sorted. Empty when it sends no body. */
  fields: string[];
  /** Set when the body could not be read; `fields` is then meaningless. */
  unresolved?: Unresolved;
  /** True when the call passes no body at all (`api.post(path)` or `api.post(path, null)`). */
  bodyless: boolean;
}

/* ------------------------------------------------------------------ parsing */

function sourceFileOf(file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.ES2022,
    true
  );
}

function walk(node: ts.Node, visit: (node: ts.Node) => void): void {
  visit(node);
  node.forEachChild((child) => walk(child, visit));
}

function lineOf(file: ts.SourceFile, node: ts.Node): number {
  return file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;
}

/**
 * Renders a path argument as a template. `'/tasks/web'` stays as it is; `` `/tasks/web/${id}` ``
 * becomes `/tasks/web/{}`, which is matched against the document's `{id}` by shape rather than by
 * name, because the client's variable name and the backend's parameter name need not agree.
 */
function endpointOf(node: ts.Expression, file: ts.SourceFile): string | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isIdentifier(node)) {
    return constantString(node.text, file);
  }
  if (ts.isTemplateExpression(node)) {
    let rendered = node.head.text;
    for (const span of node.templateSpans) {
      // Most services keep their path prefix in a module constant and interpolate it, so
      // `${BASE}/${id}` has to resolve the first span to a path and the second to a parameter.
      // Without this every finance and inspection endpoint reads as `/api/v1{}/{}` and matches
      // nothing, which would report two dozen live endpoints as removed.
      const constant = ts.isIdentifier(span.expression)
        ? constantString(span.expression.text, file)
        : null;
      rendered += `${constant ?? '{}'}${span.literal.text}`;
    }
    // A path whose prefix came from something other than a string constant, such as
    // `${budgetBase(projectId)}/${id}`, renders as `{}/{}` and would otherwise be reported as an
    // endpoint the backend has removed. It is a path this pass cannot read, which is a different
    // thing and gets said differently.
    return rendered.startsWith('/') ? rendered : null;
  }
  return null;
}

/** The value of a module-level `const X = '...'`, when it is a plain string. */
function constantString(name: string, file: ts.SourceFile): string | null {
  let value: string | null = null;
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== name) continue;
      const initializer = declaration.initializer;
      if (
        initializer &&
        (ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer))
      ) {
        value = initializer.text;
      }
    }
  }
  return value;
}

/**
 * The property names an object literal sets, or null when something in it makes that unknowable.
 *
 * Conditional spreads are read rather than given up on, because they are how most of this package
 * writes an optional field:
 *
 * ```ts
 * return {
 *   grnNumber: dto.grnNumber,
 *   ...(dto.projectId !== undefined && { projectId: dto.projectId }),
 * };
 * ```
 *
 * The key is `projectId` whether or not the condition holds, and whether the field is present on
 * a given request is not what a name check is about: a field that is sometimes sent under a wrong
 * name is wrong every time it is sent. Spreading a variable is a different matter and still
 * returns null, because the keys are then somewhere this pass cannot see.
 */
function literalKeys(node: ts.ObjectLiteralExpression): string[] | null {
  const keys: string[] = [];
  for (const property of node.properties) {
    if (ts.isSpreadAssignment(property)) {
      const spread = spreadKeys(property.expression);
      if (spread === null) return null;
      keys.push(...spread);
      continue;
    }
    const name = property.name;
    if (!name) return null;
    if (ts.isIdentifier(name) || ts.isStringLiteral(name)) {
      keys.push(name.text);
    } else {
      return null;
    }
  }
  return keys;
}

/** Keys reachable through a spread expression: `{...}`, `cond && {...}`, `cond ? {...} : {...}`. */
function spreadKeys(node: ts.Expression): string[] | null {
  const expression = ts.isParenthesizedExpression(node) ? node.expression : node;

  if (ts.isObjectLiteralExpression(expression)) return literalKeys(expression);

  if (
    ts.isBinaryExpression(expression) &&
    (expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
      expression.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
      expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
  ) {
    // The left of `cond && {...}` is the condition, not a source of keys, so only the sides that
    // are themselves object-shaped contribute.
    const left = objectShaped(expression.left) ? spreadKeys(expression.left) : [];
    const right = objectShaped(expression.right) ? spreadKeys(expression.right) : [];
    if (left === null || right === null) return null;
    return [...left, ...right];
  }

  if (ts.isConditionalExpression(expression)) {
    const whenTrue = objectShaped(expression.whenTrue) ? spreadKeys(expression.whenTrue) : [];
    const whenFalse = objectShaped(expression.whenFalse) ? spreadKeys(expression.whenFalse) : [];
    if (whenTrue === null || whenFalse === null) return null;
    return [...whenTrue, ...whenFalse];
  }

  return null;
}

/** Whether an expression could contribute keys, as opposed to being a condition or a literal. */
function objectShaped(node: ts.Expression): boolean {
  const expression = ts.isParenthesizedExpression(node) ? node.expression : node;
  return (
    ts.isObjectLiteralExpression(expression) ||
    ts.isConditionalExpression(expression) ||
    (ts.isBinaryExpression(expression) &&
      (expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
        expression.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
        expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken))
  );
}

/* ------------------------------------------------- serializer key extraction */

/** Cache of `file -> exported function name -> its key set`, so a module is parsed once. */
const serializerCache = new Map<string, Map<string, string[] | null>>();

/**
 * Reads the field names a function puts on the object it returns.
 *
 * Covers the two shapes this package writes: a returned object literal, and the far more common
 * `const payload: Record<string, unknown> = { ... }` followed by conditional
 * `payload.field = ...` assignments. Returns null when the function does something else, so the
 * caller can report the call site as unresolved rather than as sending nothing.
 */
function keysReturnedBy(fn: ts.FunctionLikeDeclaration): string[] | null {
  const body = fn.body;
  if (!body || !ts.isBlock(body)) {
    if (body && ts.isObjectLiteralExpression(body)) return literalKeys(body);
    return null;
  }

  const returned: ts.Expression[] = [];
  walk(body, (node) => {
    if (ts.isReturnStatement(node) && node.expression) returned.push(node.expression);
  });
  if (returned.length !== 1) return null;

  const result = returned[0];
  if (ts.isObjectLiteralExpression(result)) return literalKeys(result);
  if (!ts.isIdentifier(result)) return null;

  return keysAssignedTo(result.text, body);
}

/**
 * Field names collected for a local object: the keys of the literal it was declared with, plus
 * every `name.field = ...` and `name['field'] = ...` in the same scope.
 *
 * The second half is what catches `payload.attachments = []` at a call site, which is a key on
 * the wire that the serializer never returned.
 */
function keysAssignedTo(name: string, scope: ts.Node): string[] | null {
  let declared: string[] | null = null;
  let sawDeclaration = false;
  let unknown = false;

  walk(scope, (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer
    ) {
      sawDeclaration = true;
      if (ts.isObjectLiteralExpression(node.initializer)) {
        const keys = literalKeys(node.initializer);
        if (keys === null) unknown = true;
        else declared = keys;
      } else if (ts.isCallExpression(node.initializer)) {
        const keys = keysFromSerializerCall(node.initializer, node.getSourceFile());
        if (keys === null) unknown = true;
        else declared = keys;
      } else {
        unknown = true;
      }
    }
  });

  const assigned = assignedKeys(name, scope, 0);
  if (unknown || !sawDeclaration || declared === null || assigned === null) return null;
  return [...new Set([...declared, ...assigned])].sort();
}

/**
 * Every field name written onto an object within a scope, following the helpers it is handed to.
 *
 * The direct half is `name.field = ...` and `name['field'] = ...`. The indirect half matters more
 * than it looks: `createInspectionToJson` is nothing but
 *
 * ```ts
 * const json: Record<string, unknown> = {};
 * inspectionCommonToJson(dto, json);
 * return json;
 * ```
 *
 * so reading only the declaration would report that the whole inspection module sends no fields
 * at all, and it would then report every required field on the endpoint as one the client can
 * never send. A wrong answer is worse here than no answer, so an object handed to a function that
 * cannot be followed makes the whole call site unresolved rather than empty.
 */
function assignedKeys(name: string, scope: ts.Node, depth: number): string[] | null {
  if (depth > 3) return null;

  const assigned: string[] = [];
  let unknown = false;

  walk(scope, (node) => {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left) &&
      ts.isIdentifier(node.left.expression) &&
      node.left.expression.text === name
    ) {
      assigned.push(node.left.name.text);
    }

    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isElementAccessExpression(node.left) &&
      ts.isIdentifier(node.left.expression) &&
      node.left.expression.text === name
    ) {
      const key = node.left.argumentExpression;
      if (ts.isStringLiteral(key)) assigned.push(key.text);
      else unknown = true;
    }

    if (!ts.isCallExpression(node)) return;
    const position = node.arguments.findIndex(
      (argument) => ts.isIdentifier(argument) && argument.text === name
    );
    if (position < 0) return;
    // The api client is where the payload is going, not somewhere it gets more fields.
    if (isApiClientCall(node)) return;

    const helper = resolveCalledFunction(node, node.getSourceFile());
    const parameter = helper?.parameters[position]?.name;
    if (!helper || !parameter || !ts.isIdentifier(parameter) || !helper.body) {
      unknown = true;
      return;
    }
    const inner = assignedKeys(parameter.text, helper.body, depth + 1);
    if (inner === null) unknown = true;
    else assigned.push(...inner);
  });

  return unknown ? null : assigned;
}

/** Whether a call is `api.post(...)` and friends, i.e. the request going out. */
function isApiClientCall(call: ts.CallExpression): boolean {
  return (
    ts.isPropertyAccessExpression(call.expression) &&
    ts.isIdentifier(call.expression.expression) &&
    ['api', 'apiClient'].includes(call.expression.expression.text)
  );
}

/** The function a plain `name(...)` call refers to, in this file or the module it comes from. */
function resolveCalledFunction(
  call: ts.CallExpression,
  from: ts.SourceFile
): ts.FunctionLikeDeclaration | null {
  if (!ts.isIdentifier(call.expression)) return null;
  const name = call.expression.text;
  const local = findFunction(from, name);
  if (local) return local;
  const moduleFile = resolveImport(from, name);
  return moduleFile ? findExportedFunction(moduleFile, name, new Set()) : null;
}

/** Resolves `someToJson(...)` to the key set of the function it names, following the import. */
function keysFromSerializerCall(call: ts.CallExpression, from: ts.SourceFile): string[] | null {
  if (!ts.isIdentifier(call.expression)) return null;
  const name = call.expression.text;

  const local = findFunction(from, name);
  if (local) return keysReturnedBy(local);

  const moduleFile = resolveImport(from, name);
  if (!moduleFile) return null;

  let cached = serializerCache.get(moduleFile);
  if (!cached) {
    cached = new Map();
    serializerCache.set(moduleFile, cached);
  }
  if (cached.has(name)) return cached.get(name) ?? null;

  const imported = findExportedFunction(moduleFile, name, new Set());
  const keys = imported ? keysReturnedBy(imported) : null;
  cached.set(name, keys);
  return keys;
}

/**
 * Finds a function by name in a module, following the barrel re-exports it is reached through.
 *
 * Services import from `../types/grn`, not from `../types/grn/grn-create`, so stopping at the
 * first module resolves an index file that declares nothing and the serializer reads as
 * unfollowable. Following `export ... from` is what makes the great majority of these calls
 * readable at all.
 */
function findExportedFunction(
  file: string,
  name: string,
  visited: Set<string>
): ts.FunctionLikeDeclaration | null {
  if (visited.has(file) || !fs.existsSync(file)) return null;
  visited.add(file);

  const source = sourceFileOf(file);
  const declared = findFunction(source, name);
  if (declared) return declared;

  for (const statement of source.statements) {
    if (!ts.isExportDeclaration(statement) || !statement.moduleSpecifier) continue;

    const bindings = statement.exportClause;
    let localName: string | null = name;
    if (bindings && ts.isNamedExports(bindings)) {
      const element = bindings.elements.find((each) => each.name.text === name);
      if (!element) continue;
      localName = (element.propertyName ?? element.name).text;
    }

    const target = resolveModulePath(
      file,
      (statement.moduleSpecifier as ts.StringLiteral).text
    );
    if (!target) continue;
    const found = findExportedFunction(target, localName, visited);
    if (found) return found;
  }

  return null;
}

/** Resolves a relative specifier to a file, trying `.ts` and `/index.ts`. */
function resolveModulePath(from: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  const base = path.resolve(path.dirname(from), specifier);
  for (const candidate of [`${base}.ts`, path.join(base, 'index.ts')]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function findFunction(file: ts.SourceFile, name: string): ts.FunctionLikeDeclaration | null {
  let found: ts.FunctionLikeDeclaration | null = null;
  walk(file, (node) => {
    if (found) return;
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
      found = node;
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      found = node.initializer;
    }
  });
  return found;
}

/** Finds the file an identifier was imported from, resolving `.ts` and `/index.ts`. */
function resolveImport(file: ts.SourceFile, name: string): string | null {
  let specifier: string | null = null;
  walk(file, (node) => {
    if (specifier) return;
    if (!ts.isImportDeclaration(node)) return;
    const bindings = node.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) return;
    if (bindings.elements.some((element) => element.name.text === name)) {
      specifier = (node.moduleSpecifier as ts.StringLiteral).text;
    }
  });
  if (!specifier) return null;

  return resolveModulePath(file.fileName, specifier);
}

/* ------------------------------------------------------------- the call scan */

/** The nearest enclosing function, which is the scope a payload local lives in. */
function enclosingFunction(node: ts.Node): ts.Node | null {
  let current: ts.Node | undefined = node.parent;
  while (current) {
    if (ts.isFunctionLike(current)) return current;
    current = current.parent;
  }
  return null;
}

function isBodyless(argument: ts.Expression | undefined): boolean {
  if (!argument) return true;
  if (argument.kind === ts.SyntaxKind.NullKeyword) return true;
  return ts.isIdentifier(argument) && argument.text === 'undefined';
}

/** Every write call in `src/services`, with the fields each one sends. */
export function collectWriteCalls(): WriteCall[] {
  const calls: WriteCall[] = [];

  for (const entry of fs.readdirSync(SERVICES).sort()) {
    if (!entry.endsWith('.ts') || entry.endsWith('.test.ts')) continue;
    const file = sourceFileOf(path.join(SERVICES, entry));
    const relative = path.relative(ROOT, file.fileName);

    walk(file, (node) => {
      if (!ts.isCallExpression(node)) return;
      if (!ts.isPropertyAccessExpression(node.expression)) return;
      const callee = node.expression.name.text;

      const isWrite = callee in WRITE_METHODS;
      const isOpaque = OPAQUE_BODY_METHODS.includes(callee);
      if (!isWrite && !isOpaque) return;

      const location = `${relative}:${lineOf(file, node)}`;
      const endpoint = node.arguments[0] ? endpointOf(node.arguments[0], file) : null;
      if (endpoint === null) {
        calls.push({
          location,
          operation: '(unknown)',
          endpoint: '(not a literal)',
          method: isOpaque ? 'POST' : WRITE_METHODS[callee],
          fields: [],
          bodyless: false,
          unresolved: 'endpoint path is not a literal',
        });
        return;
      }

      const method = isOpaque ? 'POST' : WRITE_METHODS[callee];
      const operation = `${method} ${API_BASE}${endpoint}`;

      if (isOpaque) {
        calls.push({
          location,
          operation,
          endpoint,
          method,
          fields: [],
          bodyless: false,
          unresolved: 'body is a FormData assembled by the caller',
        });
        return;
      }

      const bodyArgument = node.arguments[1];
      if (isBodyless(bodyArgument)) {
        calls.push({ location, operation, endpoint, method, fields: [], bodyless: true });
        return;
      }

      const fields = fieldsOf(bodyArgument, file, node);
      calls.push(
        fields === null
          ? {
              location,
              operation,
              endpoint,
              method,
              fields: [],
              bodyless: false,
              unresolved: ts.isObjectLiteralExpression(bodyArgument)
                ? 'body built from a spread or a computed key'
                : 'body is a value this pass cannot follow',
            }
          : { location, operation, endpoint, method, fields, bodyless: false }
      );
    });
  }

  return calls;
}

/** The field names one body argument puts on the wire, or null when it cannot be read. */
function fieldsOf(
  body: ts.Expression,
  file: ts.SourceFile,
  call: ts.CallExpression
): string[] | null {
  if (ts.isObjectLiteralExpression(body)) {
    const keys = literalKeys(body);
    return keys === null ? null : [...new Set(keys)].sort();
  }
  if (ts.isCallExpression(body)) {
    const keys = keysFromSerializerCall(body, file);
    return keys === null ? null : [...new Set(keys)].sort();
  }
  if (ts.isIdentifier(body)) {
    const scope = enclosingFunction(call);
    return scope ? keysAssignedTo(body.text, scope) : null;
  }
  return null;
}

/* ----------------------------------------------------------------- the check */

export type FindingKind = 'unknown-field' | 'unknown-endpoint' | 'unsendable-required-field';

export interface Finding {
  kind: FindingKind;
  location: string;
  operation: string;
  /** The field or endpoint at fault. */
  subject: string;
  /** The closest name on the other side, when there is one worth suggesting. */
  suggestion?: string;
  schema: string | null;
}

/** Levenshtein distance, used only to suggest the field somebody probably meant. */
function distance(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const carried = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      diagonal = carried;
    }
  }
  return previous[b.length];
}

function nearest(name: string, candidates: string[]): string | undefined {
  const lower = name.toLowerCase();

  // A rename usually keeps the old name inside the new one: `startDate` became
  // `plannedStartDate`, `type` became `issueType`. Containment is a stronger signal than edit
  // distance for exactly the case this check exists to report, so it is tried first.
  const contained = candidates
    .filter((candidate) => {
      const other = candidate.toLowerCase();
      return other.length > 2 && (lower.includes(other) || other.includes(lower));
    })
    .sort((a, b) => b.length - a.length)[0];
  if (contained) return contained;

  let best: string | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const d = distance(lower, candidate.toLowerCase());
    if (d < bestDistance) {
      bestDistance = d;
      best = candidate;
    }
  }
  // Only worth printing when it is close enough to be the thing that was meant.
  return best !== undefined && bestDistance <= Math.max(2, Math.ceil(name.length / 3))
    ? best
    : undefined;
}

/**
 * Matches a call's path against the document's paths by shape: the same number of segments, each
 * one either equal or a parameter on both sides. The client's `{}` carries no name, because the
 * variable it interpolates need not be called what the backend calls its path variable.
 */
export function matchOperation(
  operation: string,
  documented: string[]
): { matched: string | null; ambiguous: boolean } {
  if (documented.includes(operation)) return { matched: operation, ambiguous: false };

  const [method, urlPath] = operation.split(' ');
  if (!urlPath) return { matched: null, ambiguous: false };
  const wanted = urlPath.split('/');
  const matches = documented.filter((candidate) => {
    const [candidateMethod, candidatePath] = candidate.split(' ');
    if (candidateMethod !== method) return false;
    const segments = candidatePath.split('/');
    if (segments.length !== wanted.length) return false;
    return segments.every((segment, index) => {
      const other = wanted[index];
      if (segment === other) return true;
      return segment.includes('{') && other.includes('{');
    });
  });

  if (matches.length === 1) return { matched: matches[0], ambiguous: false };
  return { matched: null, ambiguous: matches.length > 1 };
}

/* ------------------------------------------------------------- the analysis */

/** What happened to one call site, for the coverage account. */
export type CallVerdict =
  | 'checked'
  | 'sends nothing'
  | 'endpoint documents no request body'
  | 'endpoint accepts any field name'
  | 'endpoint not in the document'
  | 'not readable';

export interface Analysis {
  findings: Finding[];
  coverage: Record<CallVerdict, number>;
  /** Every call site with its verdict, in source order, for the committed report. */
  calls: { location: string; operation: string; verdict: CallVerdict; detail?: string }[];
}

/**
 * Compares every write call against the backend index and reports what does not line up.
 *
 * ## What fails
 *
 * - **A field name the endpoint does not have.** The rename, the invented field, the field the
 *   backend dropped. This is the whole reason the check exists and it is the only class all three
 *   of the bugs behind tornotron/echno-core#49 belong to.
 * - **An endpoint the document does not have.** A path the backend has moved or removed. The
 *   request 404s, and nothing else in either repo notices.
 * - **A required field the call site can never send.** Not "did not send on this request", which
 *   a static pass cannot know and which is legitimate anyway: a field that appears nowhere in the
 *   call site's key set cannot be sent under any condition, so the request cannot succeed.
 *
 * ## What deliberately does not fail
 *
 * - **A schema field the client never sends.** Almost every field is optional, and a client that
 *   does not use a new capability is not broken. This is also why an additive backend change is
 *   free end to end: the parsers here are non-strict zod, so an unexpected response field is
 *   ignored rather than rejected.
 * - **Types.** The document carries them and comparing them is a reasonable second phase, but a
 *   type mismatch is a different failure with a different fix, and mixing the two would make the
 *   first phase's failures harder to read.
 * - **Meaning.** `eventTimestamp` matching `eventTimestamp` says nothing about whether one side
 *   is UTC and the other local. Every timezone bug found in this package was a perfect name
 *   match. `date-serialization.guard.test.ts` is the mechanism for that and neither replaces the
 *   other.
 * - **A field the backend accepts and then ignores.** Only a round trip against a running backend
 *   catches that, which is a different order of effort.
 */
export function analyse(contract: {
  operations: Record<string, OperationContract>;
}): Analysis {
  const documented = Object.keys(contract.operations);
  const findings: Finding[] = [];
  const calls: Analysis['calls'] = [];
  const coverage: Record<CallVerdict, number> = {
    checked: 0,
    'sends nothing': 0,
    'endpoint documents no request body': 0,
    'endpoint accepts any field name': 0,
    'endpoint not in the document': 0,
    'not readable': 0,
  };

  for (const call of collectWriteCalls()) {
    const record = (verdict: CallVerdict, detail?: string) => {
      coverage[verdict] += 1;
      calls.push({ location: call.location, operation: call.operation, verdict, detail });
    };

    if (call.unresolved) {
      record('not readable', call.unresolved);
      continue;
    }

    const { matched, ambiguous } = matchOperation(call.operation, documented);
    if (!matched) {
      if (ambiguous) {
        record('not readable', 'the path matches more than one documented endpoint');
        continue;
      }
      findings.push({
        kind: 'unknown-endpoint',
        location: call.location,
        operation: call.operation,
        subject: call.operation,
        schema: null,
      });
      record('endpoint not in the document');
      continue;
    }

    const operation = contract.operations[matched];

    if (call.bodyless || call.fields.length === 0) {
      record('sends nothing');
      continue;
    }
    if (operation.acceptsAnyField) {
      record('endpoint accepts any field name');
      continue;
    }
    if (operation.schema === null) {
      record('endpoint documents no request body', `sends ${call.fields.join(', ')}`);
      continue;
    }

    for (const field of call.fields) {
      if (operation.fields.includes(field)) continue;
      findings.push({
        kind: 'unknown-field',
        location: call.location,
        operation: matched,
        subject: field,
        suggestion: nearest(field, operation.fields),
        schema: operation.schema,
      });
    }
    for (const required of operation.required) {
      if (call.fields.includes(required)) continue;
      findings.push({
        kind: 'unsendable-required-field',
        location: call.location,
        operation: matched,
        subject: required,
        schema: operation.schema,
      });
    }

    record('checked');
  }

  findings.sort((a, b) =>
    `${a.location}${a.kind}${a.subject}`.localeCompare(`${b.location}${b.kind}${b.subject}`)
  );
  return { findings, coverage, calls };
}

/** A finding rendered as one line, which is what the committed record holds. */
export function describeFinding(finding: Finding): string {
  const suffix = finding.suggestion ? ` (did you mean "${finding.suggestion}"?)` : '';
  switch (finding.kind) {
    case 'unknown-field':
      return `${finding.location}  ${finding.operation}  sends "${finding.subject}", which is not a field of ${finding.schema}${suffix}`;
    case 'unsendable-required-field':
      return `${finding.location}  ${finding.operation}  never sends "${finding.subject}", which ${finding.schema} requires`;
    case 'unknown-endpoint':
      return `${finding.location}  ${finding.subject}  is not an endpoint in the document`;
  }
}

/* ---------------------------------------------------------------- the report */

const REPORT_FILE = path.join(ROOT, 'etc', 'request-contract.md');
const INDEX_FILE = path.join(ROOT, 'etc', 'backend-request-fields.json');

const VERDICT_ORDER: CallVerdict[] = [
  'checked',
  'sends nothing',
  'endpoint accepts any field name',
  'endpoint documents no request body',
  'endpoint not in the document',
  'not readable',
];

/**
 * Renders the whole result as the committed record.
 *
 * A committed report rather than a pass/fail alone, for the reason the issue gives about a test
 * that is oversold: this one covers most of the write surface and not all of it, and the part it
 * misses should be readable by anyone who sees the run go green. The file says which call sites
 * were checked, which were not, and why, so the coverage is a number somebody can argue with
 * rather than an impression.
 */
export function renderReport(analysis: Analysis, source: { repository: string; ref: string }): string {
  const total = analysis.calls.length;
  const lines: string[] = [];

  lines.push('# Request contract: what this package sends, against what the backend accepts');
  lines.push('');
  lines.push('<!-- GENERATED by scripts/request-contract.ts. Do not edit by hand.');
  lines.push('     Run `bun run contract:report` and commit the diff.');
  lines.push('     A NEW entry under Findings is a bug to fix, not a file to regenerate. -->');
  lines.push('');
  lines.push(
    `Checked against \`${source.repository}\` \`${source.ref}\`, reduced into ` +
      '`etc/backend-request-fields.json` by `scripts/backend-contract.ts`.'
  );
  lines.push('');
  lines.push(`Write calls in \`src/services\`: ${total}`);
  lines.push('');
  lines.push('## Coverage');
  lines.push('');
  lines.push('| outcome | calls |');
  lines.push('| --- | --- |');
  for (const verdict of VERDICT_ORDER) {
    lines.push(`| ${verdict} | ${analysis.coverage[verdict]} |`);
  }
  lines.push('');

  lines.push(`## Findings (${analysis.findings.length})`);
  lines.push('');
  if (analysis.findings.length === 0) {
    lines.push('None.');
  } else {
    for (const finding of analysis.findings) {
      lines.push(`- ${describeFinding(finding)}`);
    }
  }
  lines.push('');

  const unreadable = analysis.calls.filter((call) => call.verdict === 'not readable');
  lines.push(`## Call sites this pass cannot read (${unreadable.length})`);
  lines.push('');
  if (unreadable.length === 0) {
    lines.push('None.');
  } else {
    lines.push('Not checked, and not claimed to be. Each one is a place a wrong field name would');
    lines.push('go unnoticed.');
    lines.push('');
    for (const call of unreadable) {
      lines.push(`- ${call.location}  ${call.operation}  (${call.detail})`);
    }
  }
  lines.push('');

  const undescribed = analysis.calls.filter(
    (call) => call.verdict === 'endpoint documents no request body'
  );
  if (undescribed.length > 0) {
    lines.push(`## Endpoints the document gives no request body (${undescribed.length})`);
    lines.push('');
    lines.push('The call sends fields; the document names none, so no name can be checked.');
    lines.push('');
    for (const call of undescribed) {
      lines.push(`- ${call.location}  ${call.operation}  ${call.detail}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/** Reads the committed index and produces the report content, for the CLI and the test alike. */
export function currentReport(): string {
  const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  return renderReport(analyse(index), index.source);
}

export const reportPath = REPORT_FILE;

if (import.meta.main) {
  const report = currentReport();
  if (process.argv.includes('--check')) {
    const committed = fs.existsSync(REPORT_FILE) ? fs.readFileSync(REPORT_FILE, 'utf8') : '';
    if (committed !== report) {
      console.error('etc/request-contract.md is stale. Run `bun run contract:report`.');
      process.exit(1);
    }
    console.log('etc/request-contract.md is up to date.');
  } else {
    fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
    fs.writeFileSync(REPORT_FILE, report);
    console.log(`Wrote ${path.relative(ROOT, REPORT_FILE)}.`);
  }
}
