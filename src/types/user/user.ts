/**
 * @module types/user/user
 *
 * Domain type and parser for the {@link User} entity.
 *
 * Describes the authenticated user's profile as returned by `GET /user/web`
 * (`UserDto`). Includes attachment derivation helpers that surface the
 * latest `profilePicture` / `cv` references from the polymorphic
 * `attachments` array for convenient access by UI code.
 */

import { Attachment, parseAttachment } from '../attachment';
import { parseUTCDate } from '../../lib/utils/date-helpers';
import { parsePositiveInt } from '../../lib/utils/parse-id';

/**
 * Authenticated user profile.
 *
 * The shape mirrors the backend `UserDto` plus two derived fields
 * (`cv`, `profilePicture`) extracted from the polymorphic `attachments`
 * array by {@link parseUser}.
 */
export interface User {
  /** Surrogate primary key. */
  id: number;

  /** Full display name. Defaults to `'Not Specified'` when missing. */
  name: string;

  /** Postal address. Defaults to `'Not Specified'` when missing. */
  address: string;

  /** Blood group (e.g. `'O+'`); optional clinical metadata. */
  bloodGroup?: string;

  /** Primary email address. Defaults to `'Not Specified'` when missing. */
  email: string;

  /** Primary phone number. Defaults to `'Not Specified'` when missing. */
  phone: string;

  /** Reported gender; free-text per backend convention. */
  gender: string;

  /** Date of birth. Defaults to "now" when missing — caller must validate. */
  dateOfBirth: Date;

  /** Highest qualification. Defaults to `'Not Specified'` when missing. */
  qualification: string;

  /** Self-reported skills, normalised to a string array by {@link parseUser}. */
  skills?: string[];

  /** Years of professional experience. */
  experience?: number;

  /** Free-text emergency contact (name + phone). */
  emergencyContact?: string;

  /** Keycloak/role tags returned by the backend. */
  roles?: string[];

  /** Certification labels. */
  certifications?: string[];

  /**
   * Currently selected organization. Drives the active scope across the
   * app (attendance, projects, employees). Mutated via
   * `useUpdateUserOrganization`.
   */
  defaultOrganizationId?: number;

  /** Full attachment list returned by the backend. */
  attachments?: Attachment[];

  /**
   * Most recent attachment of type `USER_CV`, derived from
   * {@link User.attachments} by {@link parseUser}. Falls back to a legacy
   * top-level `cv` field if present.
   */
  cv?: Attachment;

  /**
   * Most recent attachment of type `USER_PROFILE_PICTURE`, derived from
   * {@link User.attachments} by {@link parseUser}. Falls back to a legacy
   * top-level `profilePicture` / `profilePictureUrl` field if present.
   */
  profilePicture?: Attachment;

  /** Record creation timestamp. */
  createdAt?: Date;

  /** Record last-modification timestamp. */
  updatedAt?: Date;
}

// ────── Helper Functions ──────

/**
 * Derives one or two uppercase initials from a user's display name.
 *
 * @param user - The user whose initials to compute.
 * @returns Up to two uppercase initials; an empty string for an empty name.
 */
export function userInitials(user: User): string {
  const words = user.name.trim().split(/\s+/);
  let initials = '';
  for (const w of words) if (w) initials += w[0].toUpperCase();
  return initials.length > 2 ? initials.slice(0, 2) : initials;
}

/**
 * Formats a `Date` into the backend's expected `YYYY-MM-DDTHH:mm:ss`
 * string. The time component is always `00:00:00`; the year/month/day are
 * read in UTC.
 *
 * @param date - The date to format.
 * @returns A date-only string with a zeroed time component.
 */
export function formatDateForBackend(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}T00:00:00`;
}

// ────── JSON Parsing & Serialization ──────
function parseSkills(data: unknown): string[] {
  if (!data) return [];
  if (typeof data === 'string') {
    return data
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (Array.isArray(data)) {
    return data
      .map(String)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [String(data)];
}

/**
 * Parses a raw `UserDto` payload into a typed {@link User} domain object.
 *
 * Also derives the {@link User.cv} and {@link User.profilePicture} fields
 * from {@link User.attachments} — when multiple attachments of the same
 * `entityType` exist, the most recent (by `createdAt`) is selected. Legacy
 * top-level `cv` / `profilePicture` / `profilePictureUrl` payloads are
 * accepted as a fallback.
 *
 * @param json - Raw JSON object received from the backend.
 * @returns A validated {@link User} domain object.
 * @throws {TypeError} If `json.id` is missing or not a positive integer.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseUser(json: any): User {
  const id = parsePositiveInt(json.id, 'parseUser.id');

  // Parse attachments array from backend
  const attachments: Attachment[] | undefined = json.attachments
    ? (json.attachments as unknown[]).map((att) => parseAttachment(att))
    : undefined;

  // Extract specific attachments - use latest by createdAt if multiple exist
  const profilePictureAttachments = attachments?.filter(
    (att) => att.entityType === 'USER_PROFILE_PICTURE'
  );
  const profilePicture =
    profilePictureAttachments && profilePictureAttachments.length > 0
      ? profilePictureAttachments.toSorted(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        )[0]
      : // Fallback for old API responses
        json.profilePicture || json.profilePictureUrl
        ? parseAttachment(json.profilePicture || json.profilePictureUrl)
        : undefined;

  const cvAttachments = attachments?.filter(
    (att) => att.entityType === 'USER_CV'
  );
  const cv =
    cvAttachments && cvAttachments.length > 0
      ? cvAttachments.toSorted(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        )[0]
      : // Fallback for old API responses
        json.cv
        ? parseAttachment(json.cv)
        : undefined;

  return {
    id,
    name: json.name ?? 'Not Specified',
    address: json.address ?? 'Not Specified',
    bloodGroup: json.bloodGroup ?? undefined,
    email: json.email ?? 'Not Specified',
    phone: json.phone ?? 'Not Specified',
    gender: json.gender ?? 'Not Specified',
    dateOfBirth: parseUTCDate(json.dateOfBirth) ?? new Date(),
    qualification: json.qualification ?? 'Not Specified',
    skills: json.skills ? parseSkills(json.skills) : undefined,
    experience: json.experience ?? undefined,
    emergencyContact: json.emergencyContact ?? undefined,
    roles: json.roles ? (json.roles as string[]) : undefined,
    certifications: json.certifications ? [...json.certifications] : undefined,
    defaultOrganizationId: json.defaultOrganizationId ?? undefined,
    attachments,
    cv,
    profilePicture,
    createdAt: parseUTCDate(json.createdAt) ?? undefined,
    updatedAt: parseUTCDate(json.updatedAt) ?? undefined,
  };
}

/**
 * Serializes a {@link User} into a plain object matching the backend's
 * write payload. Derived fields (`cv`, `profilePicture`) and timestamps
 * are intentionally omitted — file uploads use the multipart endpoint.
 *
 * @param user - The user to serialize.
 * @returns A plain object suitable for `PATCH /user/web/{id}`.
 */
export function userToJson(user: User): Record<string, unknown> {
  return {
    id: user.id,
    name: user.name,
    address: user.address,
    bloodGroup: user.bloodGroup,
    email: user.email,
    phone: user.phone,
    gender: user.gender,
    dateOfBirth: user.dateOfBirth
      ? formatDateForBackend(user.dateOfBirth)
      : undefined,
    qualification: user.qualification,
    skills: user.skills,
    experience: user.experience,
    emergencyContact: user.emergencyContact,
    roles: user.roles,
    certifications: user.certifications,
    // Note: cv and profilePicture are not sent - file uploads handled via multipart
  };
}
