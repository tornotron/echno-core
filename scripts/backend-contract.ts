/**
 * Derives `etc/backend-request-fields.json` from the backend's published OpenAPI document.
 *
 *   bun run contract:refresh                     # from tornotron/echno-backend@development
 *   bun run contract:refresh -- --ref v1.2.3     # from a tag or commit
 *   bun run contract:refresh -- --from ../echno-backend/docs/openapi.json
 *
 * The backend commits its document at `docs/openapi.json` and a CI check keeps it matching the
 * code that serves it, so a copy taken at a ref is a real contract rather than someone's curl of
 * whatever was deployed that afternoon. See tornotron/echno-backend, `./gradlew openApiSnapshot`.
 *
 * What lands here is an index, not the document. The document is three megabytes of response
 * schemas, examples and prose, and none of that is what the contract test reads: it needs the
 * field names each write endpoint accepts. Reducing it to that makes the committed file small
 * enough to read, and makes its diffs say what changed about the contract rather than burying it.
 * The whole document stays one `git show` away in the backend repo when the detail is wanted.
 *
 * Top-level field names only. The client builds its request bodies one assignment at a time
 * (`payload.title = ...`), so a nested object arrives as an opaque value and there is nothing to
 * check inside it. Recording depth the check cannot use would overstate what it covers.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(import.meta.dir, '..');
const INDEX_FILE = path.join(ROOT, 'etc', 'backend-request-fields.json');

const BACKEND_REPO = 'tornotron/echno-backend';
const BACKEND_DOCUMENT = 'docs/openapi.json';
const DEFAULT_REF = 'development';

/** The methods that carry a request body. A GET or DELETE has no payload to check. */
const WRITE_METHODS = ['post', 'put', 'patch'] as const;

/**
 * One write endpoint, reduced to what a field-name check needs.
 */
export interface OperationContract {
  /** Name of the request DTO in the document, or null when the endpoint takes no body. */
  schema: string | null;
  /** Top-level field names the endpoint accepts. */
  fields: string[];
  /** Of those, the ones the document marks required. */
  required: string[];
  /**
   * True when the schema accepts keys it does not name, so no field name can be wrong. The one
   * case in the backend today is the Keycloak realm-role endpoint, whose keys are the role names
   * the caller is creating. Recorded rather than dropped, so the check can say "not checkable"
   * instead of "checked and fine".
   */
  acceptsAnyField: boolean;
}

export interface BackendContract {
  source: {
    repository: string;
    ref: string;
    path: string;
    /**
     * Digest of the document this was derived from. Recorded instead of a retrieval date so a
     * refresh that finds nothing changed produces no diff, and so the index can be traced back to
     * exactly one version of the document.
     */
    sha256: string;
  };
  operations: Record<string, OperationContract>;
}

type Json = Record<string, any>;

/** Resolves a local `$ref` against the document, one hop at a time, tolerating cycles. */
function deref(document: Json, node: Json | undefined, seen = new Set<string>()): Json | undefined {
  let current = node;
  while (current && typeof current.$ref === 'string') {
    const ref: string = current.$ref;
    if (seen.has(ref)) return undefined;
    seen.add(ref);
    const segments = ref.replace(/^#\//, '').split('/');
    let target: any = document;
    for (const segment of segments) {
      target = target?.[segment.replace(/~1/g, '/').replace(/~0/g, '~')];
    }
    current = target;
  }
  return current;
}

/**
 * Finds the schema that describes an operation's payload.
 *
 * Two shapes reach here. A plain JSON body is `requestBody.content['application/json'].schema`.
 * A multipart endpoint cannot take a JSON body, because the body is the multipart envelope, so
 * its payload travels as a `data` part alongside the files; the backend declares that part's real
 * DTO (tornotron/echno-backend#575), which is what made this check possible at all. The client
 * serialises the whole payload object into that one part, so the part's schema is what its field
 * names have to satisfy.
 */
function payloadSchema(document: Json, operation: Json): Json | undefined {
  const content = operation?.requestBody?.content;
  if (!content) return undefined;

  const json = content['application/json']?.schema;
  if (json) return deref(document, json);

  const multipart = content['multipart/form-data']?.schema;
  if (multipart) {
    const envelope = deref(document, multipart);
    const data = envelope?.properties?.data;
    if (data) return deref(document, data);
    return envelope;
  }

  const first = Object.values(content)[0] as Json | undefined;
  return deref(document, first?.schema);
}

/** Collects a schema's own properties plus those of every branch of an allOf/oneOf/anyOf. */
function propertiesOf(document: Json, schema: Json | undefined, depth = 0): Json {
  if (!schema || depth > 5) return {};
  const collected: Json = { ...(schema.properties ?? {}) };
  for (const key of ['allOf', 'oneOf', 'anyOf']) {
    for (const branch of schema[key] ?? []) {
      Object.assign(collected, propertiesOf(document, deref(document, branch), depth + 1));
    }
  }
  return collected;
}

function requiredOf(document: Json, schema: Json | undefined, depth = 0): string[] {
  if (!schema || depth > 5) return [];
  const collected = [...(schema.required ?? [])];
  for (const key of ['allOf', 'oneOf', 'anyOf']) {
    for (const branch of schema[key] ?? []) {
      collected.push(...requiredOf(document, deref(document, branch), depth + 1));
    }
  }
  return collected;
}

function schemaName(schema: Json | undefined, raw: Json | undefined): string | null {
  const ref = raw?.$ref ?? schema?.$ref;
  if (typeof ref === 'string') return ref.split('/').pop() ?? null;
  return null;
}

/** Builds the index from a parsed OpenAPI document. */
export function buildContract(
  document: Json,
  source: BackendContract['source']
): BackendContract {
  const operations: Record<string, OperationContract> = {};

  for (const [urlPath, pathItem] of Object.entries<Json>(document.paths ?? {})) {
    for (const method of WRITE_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;

      const raw =
        operation.requestBody?.content?.['application/json']?.schema ??
        operation.requestBody?.content?.['multipart/form-data']?.schema?.properties?.data;
      const schema = payloadSchema(document, operation);
      const properties = propertiesOf(document, schema);
      const required = requiredOf(document, schema);

      operations[`${method.toUpperCase()} ${urlPath}`] = {
        schema: schemaName(schema, raw),
        fields: Object.keys(properties).sort(),
        required: [...new Set(required)].sort(),
        acceptsAnyField:
          schema !== undefined &&
          Object.keys(properties).length === 0 &&
          schema.additionalProperties !== undefined &&
          schema.additionalProperties !== false,
      };
    }
  }

  return { source, operations };
}

/**
 * Reads the document, from GitHub by default.
 *
 * `--from` changes where the bytes come from; `--ref` is the label recorded either way, so a
 * document read out of a local checkout still says which version of the backend it represents.
 */
async function readDocument(): Promise<{ document: Json; source: BackendContract['source'] }> {
  const args = process.argv.slice(2);
  const fromIndex = args.indexOf('--from');
  const refIndex = args.indexOf('--ref');
  const ref = refIndex >= 0 ? args[refIndex + 1] : DEFAULT_REF;

  let raw: string;
  if (fromIndex >= 0) {
    raw = fs.readFileSync(path.resolve(args[fromIndex + 1]), 'utf8');
  } else {
    const url = `https://raw.githubusercontent.com/${BACKEND_REPO}/${ref}/${BACKEND_DOCUMENT}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `Could not read ${url} (HTTP ${response.status}). The backend publishes its document at ` +
          `${BACKEND_DOCUMENT}; check the ref, or pass --from <path> to read a local checkout.`
      );
    }
    raw = await response.text();
  }

  return {
    document: JSON.parse(raw),
    source: {
      repository: BACKEND_REPO,
      ref,
      path: BACKEND_DOCUMENT,
      sha256: new Bun.CryptoHasher('sha256').update(raw).digest('hex'),
    },
  };
}

if (import.meta.main) {
  const { document, source } = await readDocument();
  const contract = buildContract(document, source);
  fs.mkdirSync(path.dirname(INDEX_FILE), { recursive: true });
  fs.writeFileSync(INDEX_FILE, `${JSON.stringify(contract, null, 2)}\n`);
  const count = Object.keys(contract.operations).length;
  console.log(`Wrote ${path.relative(ROOT, INDEX_FILE)}: ${count} write endpoints from ${source.ref}.`);
}
