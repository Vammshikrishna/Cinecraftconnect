/**
 * Guards the cinecraftconnect:// deep link that can carry an auth token (implicit OAuth flow).
 * Any app or web page can fire that URL at us, so a token in it is only accepted while an OAuth sign-in that
 * WE started is in flight. Otherwise an attacker could silently log the victim into the attacker's account.
 */
const WINDOW_MS = 5 * 60 * 1000;
let pendingUntil = 0;

export const markOAuthPending = (): void => {
  pendingUntil = Date.now() + WINDOW_MS;
};

export const consumeOAuthPending = (): boolean => {
  const ok = Date.now() < pendingUntil;
  pendingUntil = 0;
  return ok;
};
