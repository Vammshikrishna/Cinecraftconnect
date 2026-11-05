/* A one-bit hint, kept in localStorage: "this browser has signed in here before". The saved session itself is encrypted, so the app cannot tell
   synchronously whether it will find one. The landing page uses the hint to decide whether it may paint straight away (a first-time visitor)
   or must wait for the session check (a returning user, who is sent on to the feed, so they never see a landing-page flash). */
const KEY = 'cc_returning';

export const hasReturningHint = (): boolean => {
  try { return localStorage.getItem(KEY) === '1'; } catch { return true; } // storage blocked: be careful and wait
};

export const setReturningHint = (on: boolean): void => {
  try { if (on) localStorage.setItem(KEY, '1'); else localStorage.removeItem(KEY); } catch { /* ignore */ }
};
