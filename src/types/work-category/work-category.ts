// types/task/work-category.ts
import { parsePositiveInt } from '../../lib/utils/parse-id';

export interface WorkCategory {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  image?: string;
}

/** JSON → WorkCategory */
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

export function workCategoryToJson(cat: WorkCategory): Record<string, unknown> {
  return {
    id: cat.id,
    name: cat.name,
    description: cat.description,
    icon: cat.icon,
    image: cat.image,
  };
}

/** Abbreviated name (e.g., "Civil Engineering" → "CE") */
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

/** Generate icon from name if missing */
function generateAbbreviation(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 3);
}
