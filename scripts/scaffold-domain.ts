/**
 * Scaffolds a new domain in this package: types with a non-strict parser,
 * a service against the module's `/web` twin controller, query keys, query
 * and mutation hooks, the root barrel entries, and a test per layer.
 *
 *   bun run scaffold:domain <id> ["<Name>"]
 *   bun run scaffold:domain toolbox-talks "Toolbox Talks"
 *
 * `<id>` is the module id from the backend manifest (`[a-z][a-z0-9-]*`) and
 * names every path: `src/types/<id>/`, `src/services/<id>-service.ts`,
 * `src/hooks/<id>/`, which is what makes the `<id>/types`, `<id>/services`
 * and `<id>/hooks` subpaths in package.json resolve. `<Name>` is the display
 * name; it defaults to the id in title case.
 *
 * Templates live in `scripts/scaffold/templates/` and are plain files with
 * `__MODULE_ID__`, `__MODULE_PASCAL__`, `__MODULE_CAMEL__`, `__MODULE_NAME__`
 * and `__FEATURE_KEY__` placeholders, no template engine. The `scaffold-check`
 * CI job generates the id `ci-probe` from them and typechecks and tests it,
 * so a template that drifts from the package fails the PR that broke it.
 *
 * The generator refuses an id that fails the pattern or already exists.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(import.meta.dir, '..');
const TEMPLATES = path.join(ROOT, 'scripts', 'scaffold', 'templates');
const SRC = path.join(ROOT, 'src');

export const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

export function pascalOf(id: string): string {
  return id
    .split('-')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join('');
}

export function camelOf(id: string): string {
  const pascal = pascalOf(id);
  return pascal[0].toLowerCase() + pascal.slice(1);
}

export function featureKeyOf(id: string): string {
  return `MODULE_${id.toUpperCase().replace(/-/g, '_')}`;
}

export function nameOf(id: string): string {
  return id
    .split('-')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

export interface ScaffoldPlan {
  id: string;
  name: string;
  /** Files to create, relative to the repo root, with their rendered content. */
  files: Array<{ path: string; content: string }>;
  /** The block appended to `src/index.ts`. */
  indexBlock: string;
}

function render(template: string, id: string, name: string): string {
  return template
    .replace(/__MODULE_ID__/g, id)
    .replace(/__MODULE_PASCAL__/g, pascalOf(id))
    .replace(/__MODULE_CAMEL__/g, camelOf(id))
    .replace(/__MODULE_NAME__/g, name)
    .replace(/__FEATURE_KEY__/g, featureKeyOf(id));
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out.sort();
}

/** What already exists for this id, if anything. */
export function existingPathsFor(id: string): string[] {
  return [
    path.join('src', 'types', id),
    path.join('src', 'services', `${id}-service.ts`),
    path.join('src', 'hooks', id),
  ].filter((rel) => fs.existsSync(path.join(ROOT, rel)));
}

export function plan(id: string, name: string): ScaffoldPlan {
  if (!ID_PATTERN.test(id)) {
    throw new Error(`id "${id}" must match ${ID_PATTERN} (the backend manifest pattern)`);
  }
  const taken = existingPathsFor(id);
  if (taken.length > 0) {
    throw new Error(`id "${id}" already exists: ${taken.join(', ')}`);
  }

  const files: ScaffoldPlan['files'] = [];
  let indexBlock = '';
  for (const file of walk(TEMPLATES)) {
    const rel = path.relative(TEMPLATES, file).replace(/\.tmpl$/, '');
    const content = render(fs.readFileSync(file, 'utf8'), id, name);
    if (rel === 'index-block.ts') {
      indexBlock = content;
      continue;
    }
    files.push({ path: path.join('src', render(rel, id, name)), content });
  }
  return { id, name, files, indexBlock };
}

export function apply(p: ScaffoldPlan): void {
  for (const file of p.files) {
    const full = path.join(ROOT, file.path);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, file.content);
  }
  const index = path.join(SRC, 'index.ts');
  const current = fs.readFileSync(index, 'utf8');
  fs.writeFileSync(index, current.replace(/\n*$/, '\n') + p.indexBlock);
}

function main(argv: string[]): void {
  const [id, nameArg] = argv;
  if (!id) {
    console.error('usage: bun run scaffold:domain <id> ["<Name>"]');
    process.exit(2);
  }
  const p = plan(id, nameArg ?? nameOf(id));
  apply(p);
  console.log(`Scaffolded domain "${p.id}" (${p.name}, ${featureKeyOf(p.id)}):`);
  for (const file of p.files) console.log(`  ${file.path}`);
  console.log('  src/index.ts (exports appended)');
  console.log('');
  console.log('Next:');
  console.log('  bun run typecheck && bun run typecheck:tests && bun test');
  console.log('  bun run api:snapshot        # the public API grew');
  console.log('  bun run contract:refresh    # once the backend endpoints are on development');
}

if (import.meta.main) main(process.argv.slice(2));
