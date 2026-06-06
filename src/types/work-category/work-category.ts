/**
 * @module types/work-category/work-category
 *
 * Domain type and JSON converters for a work category — the
 * organization-defined classification (e.g. "Civil Engineering", "Plumbing")
 * used to group {@link Task} and related work entities.
 */
import { parsePositiveInt } from '../../lib/utils/parse-id';

/**
 * Represents a single work category.
 *
 * Flat domain type: no nested arrays or related entities. Cache writes can
 * use direct `setQueryData` without {@link mergePreservingNested}.
 */
export interface WorkCategory {
  /** Unique surrogate identifier assigned by the backend. */
  id: number;

  /** Human-readable category name (e.g. "Civil Engineering"). */
  name: string;

  /** Optional long-form description of the category. */
  description?: string;

  /**
   * Short text token rendered in compact UI affordances. Falls back to a
   * generated abbreviation of {@link WorkCategory.name} when the backend
   * omits this field — see {@link parseWorkCategory}.
   */
  icon?: string;

  /** Optional URL or storage key of an illustrative image. */
  image?: string;
}

/**
 * Parses a raw API payload into a typed {@link WorkCategory}.
 *
 * If `icon` is absent on the input, a 3-letter abbreviation of `name` is
 * generated and used as the fallback so consumers always have a renderable
 * token.
 *
 * @param json - The untyped JSON object received from the backend.
 * @returns A validated `WorkCategory` domain object.
 * @throws {TypeError} If `id` is missing or not a positive integer.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseWorkCategory(json: any): WorkCategory {
  const id = parsePositiveInt(json.id, 'parseWorkCategory.id');
  const name = json.name ?? '';
  return {
    id,
    name,
    description: json.description ?? undefined,
    icon: json.icon ?? generateAbbreviation(name),
    image: json.image ?? undefined,
  };
}

/**
 * Serializes a {@link WorkCategory} for transmission to the backend.
 *
 * @param cat - The domain object to serialize.
 * @returns A plain object matching the backend's expected request body shape.
 */
export function workCategoryToJson(cat: WorkCategory): Record<string, unknown> {
  return {
    id: cat.id,
    name: cat.name,
    description: cat.description,
    icon: cat.icon,
    image: cat.image,
  };
}

/**
 * Builds a short uppercase abbreviation from the category name.
 *
 * Excludes common short stop-words ("and", "or", "of", etc.) and punctuation,
 * then takes the first letter of up to three remaining words.
 *
 * @param cat - The work category to abbreviate.
 * @returns Up to three uppercase letters (e.g. "Civil Engineering" → "CE").
 */
export function abbreviatedName(cat: WorkCategory): string {
  const excluded = new Set([
    'and',
    'or',
    'the',
    'a',
    'an',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'from',
    'as',
    'is',
    'are',
    'was',
    'were',
    '&',
    '+',
    '-',
    'vs',
    'versus',
  ]);

  return cat.name
    .split(' ')
    .map((word) => word.replaceAll(/[^\w]/g, '').toLowerCase())
    .filter((word) => word && !excluded.has(word))
    .slice(0, 3)
    .map((word) => word[0].toUpperCase())
    .join('');
}

function generateAbbreviation(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 3);
}
