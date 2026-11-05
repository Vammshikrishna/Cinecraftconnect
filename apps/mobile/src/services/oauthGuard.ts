/**
 * Guards the cinecraftconnect:// deep link that can carry an auth token (implicit OAuth flow).
 * Any app or web page can fire that URL at us, so a token in it is only accepted while an OAuth sign-in that
 * WE started is in flight, and only on the auth-callback link. Otherwise an attacker could silently log the victim
 * into the attacker's account.
 */
const WINDOW_MS = 3 * 60 * 1000;
const CALLBACK_PREFIX = 'cinecraftconnect://auth-callback';
let pendingUntil = 0;

export const markOAuthPending = (): void => {
  pendingUntil = Date.now() + WINDOW_MS;
};

/** True once, and only for the app's own auth-callback link while a sign-in we started is in progress. */
export const consumeOAuthPending = (url?: string): boolean => {
  const inWindow = Date.now() < pendingUntil;
  const rightLink = typeof url === 'string' && url.toLowerCase().startsWith(CALLBACK_PREFIX);
  if (!inWindow || !rightLink) return false;
  pendingUntil = 0;
  return true;
};
