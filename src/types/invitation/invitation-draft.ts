// TODO: Phase 6 — use InvitationDraft for pre-submission preview objects (no id)
import { Invitation } from './invitation';

export type InvitationDraft = Omit<Invitation, 'id'>;
