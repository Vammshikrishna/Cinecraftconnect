/** Fan accounts can answer and join calls other people start, but cannot start one (enforced in the database too). */
export const FAN_CALL_TOOLTIP = 'Calls are available on creator and studio accounts';

export const canStartCalls = (accountType: string | null | undefined): boolean => accountType !== 'fan';

/** Maps the raw server error for a fan starting a call to the clean message; returns null for any other error. */
export const fanCallErrorMessage = (err: unknown): string | null => {
  const msg = String((err as any)?.message || err || '');
  return msg.toLowerCase().includes('calls are available on creator and studio accounts') ? FAN_CALL_TOOLTIP : null;
};
