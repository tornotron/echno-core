import { Invitation } from './invitation';

export interface ValidateInviteCodeRequest {
  code: string;
}

export interface ValidateInviteCodeResponse {
  valid: boolean;
  invitation?: Invitation;
  message?: string;
}
