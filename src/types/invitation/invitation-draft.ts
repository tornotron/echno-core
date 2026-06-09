/**
 * @module invitation-draft
 *
 * Draft variant of `Invitation` for pre-submission preview objects.
 *
 * Omits the `id` field, which is assigned by the backend on creation.
 */

// TODO: Phase 6 — use InvitationDraft for pre-submission preview objects (no id)
import { Invitation } from './invitation';

/**
 * An {@link Invitation} without a server-assigned `id`.
 *
 * Used for pre-submission form state before the invite code is generated
 * and a backend-assigned `id` is available.
 */
export type InvitationDraft = Omit<Invitation, 'id'>;
