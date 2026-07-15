/**
 * @module types/attendance/movement-type
 *
 * The {@link MovementType} enum and its label / color / icon helpers. The
 * {@link MovementRecord} entity itself lives in `./movement.ts`.
 */

/** Category of an off-site movement logged during an attendance day. */
export enum MovementType {
  /** Travel between sites. */
  siteTravel = 'siteTravel',
  /** Meeting at or with a client. */
  clientMeeting = 'clientMeeting',
  /** Meeting at or with a vendor. */
  vendorMeeting = 'vendorMeeting',
  /** Working remotely from home. */
  workFromHome = 'workFromHome',
  /** General field work away from base. */
  onFieldWork = 'onFieldWork',
  /** Attending a training session. */
  training = 'training',
  /** Working at an office location. */
  officeWork = 'officeWork',
  /** On-site inspection visit. */
  inspection = 'inspection',
  /** Procuring materials off-site. */
  materialProcurement = 'materialProcurement',
  /** Supervisory site visit. */
  supervisoryVisit = 'supervisoryVisit',
  /** Any movement not covered by the other categories. */
  other = 'other',
}

/**
 * Returns the human-readable label for a movement type.
 *
 * @param type - The movement type to format.
 * @returns The display label (e.g. `'Site Travel'`).
 */
export function getMovementTypeLabel(type: MovementType): string {
  const labels: Record<MovementType, string> = {
    [MovementType.siteTravel]: 'Site Travel',
    [MovementType.clientMeeting]: 'Client Meeting',
    [MovementType.vendorMeeting]: 'Vendor Meeting',
    [MovementType.workFromHome]: 'Work From Home',
    [MovementType.onFieldWork]: 'On Field Work',
    [MovementType.training]: 'Training',
    [MovementType.officeWork]: 'Office Work',
    [MovementType.inspection]: 'Site Inspection',
    [MovementType.materialProcurement]: 'Material Procurement',
    [MovementType.supervisoryVisit]: 'Supervisory Visit',
    [MovementType.other]: 'Other',
  };
  return labels[type];
}

/**
 * Returns the Tailwind badge classes for a movement type.
 *
 * @param type - The movement type to map.
 * @returns A space-separated Tailwind class string (light + dark variants).
 */
export function getMovementTypeColor(type: MovementType): string {
  const colors: Record<MovementType, string> = {
    [MovementType.siteTravel]:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
    [MovementType.clientMeeting]:
      'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
    [MovementType.vendorMeeting]:
      'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400',
    [MovementType.workFromHome]:
      'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
    [MovementType.onFieldWork]:
      'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
    [MovementType.training]:
      'bg-teal-100 text-teal-700 dark:bg-teal-900/20 dark:text-teal-400',
    [MovementType.officeWork]:
      'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
    [MovementType.inspection]:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
    [MovementType.materialProcurement]:
      'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/20 dark:text-cyan-400',
    [MovementType.supervisoryVisit]:
      'bg-pink-100 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400',
    [MovementType.other]:
      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  };
  return colors[type];
}

/**
 * Returns the icon name for a movement type.
 *
 * @param type - The movement type to map.
 * @returns An icon identifier (e.g. `'Car'`).
 */
export function getMovementTypeIcon(type: MovementType): string {
  const icons: Record<MovementType, string> = {
    [MovementType.siteTravel]: 'Car',
    [MovementType.clientMeeting]: 'Users',
    [MovementType.vendorMeeting]: 'Package',
    [MovementType.workFromHome]: 'Home',
    [MovementType.onFieldWork]: 'MapPin',
    [MovementType.training]: 'GraduationCap',
    [MovementType.officeWork]: 'Building',
    [MovementType.inspection]: 'ClipboardCheck',
    [MovementType.materialProcurement]: 'ShoppingCart',
    [MovementType.supervisoryVisit]: 'Eye',
    [MovementType.other]: 'MoreHorizontal',
  };
  return icons[type];
}
