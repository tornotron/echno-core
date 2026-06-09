/**
 * @module invitation-validate
 *
 * Request and response shapes for invite-code validation.
 */

import { Invitation } from './invitation';

/**
 * Payload for validating an invite code before accepting it.
 */
export interface ValidateInviteCodeRequest {
  /** The invite code string to validate. */
  code: string;
}

/**
 * Response from invite-code validation.
 */
export interface ValidateInviteCodeResponse {
  /** Whether the invite code is valid and currently usable. */
  valid: boolean;
  /** The associated invitation record; present when `valid` is `true`. */
  invitation?: Invitation;
  /** Human-readable message describing the validation result or failure reason. */
  message?: string;
}
