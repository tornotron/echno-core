/**
 * @module types/user/user-files
 *
 * File-upload payload shape for the multipart user-profile endpoint.
 */

/**
 * Optional binary attachments uploaded alongside a user-profile update.
 *
 * Consumed by `userService.updateCurrentUserWithFiles`; each present field
 * becomes a multipart part keyed by the field name.
 */
export interface UserFiles {
  /** New profile picture; replaces the latest `USER_PROFILE_PICTURE` attachment. */
  profilePicture?: File;

  /** New CV; replaces the latest `USER_CV` attachment. */
  cv?: File;
}
