/**
 * @module module
 *
 * Frontend module registry types: the descriptor the backend publishes per
 * module (spec `echno-backend/docs/specs/2026-08-26-modular-plugin-architecture.md`
 * section 8), and its JSON parser.
 *
 * Shared by the backend-shaped response and the web loader, so
 * `GET /api/v1/modules/web` and `GET /api/v1/modules/web/enabled` have a
 * typed client.
 */

import { z } from 'zod';
import { nullableString } from '../../lib/validation/backend-schema';

/** A module's stable identifier, e.g. `'inspections'`. */
export type ModuleId = string;

/**
 * A single nav entry a module contributes to the sidebar. Composed onto the
 * core nav tree by the web loader; a module absent from the enabled set
 * contributes none of its `nav` entries.
 */
export interface ModuleNavDescriptor {
  /** Display label for the nav item. */
  label: string;
  /** Sidebar section this item is grouped under. */
  section: string;
  /** Route path the item links to. */
  path: string;
  /** Optional icon identifier. */
  icon?: string;
  /** Permissions a user must hold to see/use this item, on top of entitlement. */
  requiredPermissions: string[];
}

/**
 * A module as published by the backend registry. `enabled` reflects whether
 * the module is switched on for the org at all; `entitled` reflects whether
 * the org's plan includes it. Both must be true for the module to be usable.
 */
export interface ModuleDescriptor {
  /** Stable module identifier, e.g. `'inspections'`. */
  id: ModuleId;
  /** Human-readable module name. */
  name: string;
  /** Module version, tracks the core version it was released against. */
  version: string;
  /** Entitlement/plan key gating this module, e.g. `'MODULE_INSPECTIONS'`. */
  entitlementFeatureKey: string;
  /** Whether the module is switched on. */
  enabled: boolean;
  /** Whether the org's entitlement covers this module. */
  entitled: boolean;
  /** Nav entries this module contributes. */
  nav: ModuleNavDescriptor[];
  /** Permission strings this module defines. */
  permissions: string[];
}

const ModuleNavDescriptorResponseSchema = z.object({
  label: nullableString,
  section: nullableString,
  path: nullableString,
  icon: nullableString,
  requiredPermissions: z.array(z.string()).nullish(),
});

const ModuleDescriptorResponseSchema = z.object({
  id: z.string().min(1),
  name: nullableString,
  version: nullableString,
  entitlementFeatureKey: nullableString,
  enabled: z.boolean().nullish(),
  entitled: z.boolean().nullish(),
  nav: z.array(ModuleNavDescriptorResponseSchema).nullish(),
  permissions: z.array(z.string()).nullish(),
});

function parseModuleNavDescriptor(raw: unknown): ModuleNavDescriptor {
  const parsed = ModuleNavDescriptorResponseSchema.parse(raw);
  return {
    label: parsed.label ?? '',
    section: parsed.section ?? '',
    path: parsed.path ?? '',
    icon: parsed.icon ?? undefined,
    requiredPermissions: parsed.requiredPermissions ?? [],
  };
}

/**
 * Parses a raw API payload into a typed {@link ModuleDescriptor}.
 *
 * Non-strict: unknown/extra keys are stripped rather than rejected, so a
 * backend that adds a field never breaks the client. Only `id` is required;
 * every other field defaults when absent so a partial descriptor still
 * parses into something the loader can reason about.
 *
 * @param json - The untyped JSON object received from the backend.
 * @returns A validated `ModuleDescriptor` domain object.
 * @throws {Error} If `id` is missing or empty.
 */
export function parseModuleDescriptor(json: unknown): ModuleDescriptor {
  const raw = ModuleDescriptorResponseSchema.parse(json);
  return {
    id: raw.id,
    name: raw.name ?? raw.id,
    version: raw.version ?? '',
    entitlementFeatureKey: raw.entitlementFeatureKey ?? '',
    enabled: raw.enabled ?? false,
    entitled: raw.entitled ?? false,
    nav: raw.nav ? raw.nav.map((n) => parseModuleNavDescriptor(n)) : [],
    permissions: raw.permissions ?? [],
  };
}
