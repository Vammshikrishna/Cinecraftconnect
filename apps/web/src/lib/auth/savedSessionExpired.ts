/**
 * A saved sign-in (another account on this device) that can no longer be used. Switching to it fails with this error and
 * the app sends the person to the sign-in page, which shows the message and has the email filled in.
 */
export class SavedSessionExpiredError extends Error {
  readonly email: string;
  constructor(email: string) {
    super(`The saved sign-in for ${email} has expired. It was removed from this device; sign in again to add it back.`);
    this.name = 'SavedSessionExpiredError';
    this.email = email;
  }
}

export const SAVED_SESSION_EXPIRED_PARAM = 'saved_session_expired';

/** The sign-in page address that shows the expired message and fills in the email. */
export const savedSessionExpiredUrl = (email?: string | null): string =>
  `/auth?error=${SAVED_SESSION_EXPIRED_PARAM}${email ? `&email=${encodeURIComponent(email)}` : ''}`;

/** The message the sign-in page shows for that address. */
export const savedSessionExpiredMessage = (email?: string | null): string =>
  email
    ? `The saved sign-in for ${email} has expired. Please sign in again to add it back.`
    : 'A saved sign-in has expired. Please sign in again.';
