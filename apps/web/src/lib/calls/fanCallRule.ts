/** Fan accounts can answer and join calls other people start, but cannot start one (enforced in the database by part GG). */
export const FAN_CALL_TOOLTIP = 'Calls are available on creator and studio accounts';

export const canStartCalls = (accountType: string | null | undefined): boolean => accountType !== 'fan';
