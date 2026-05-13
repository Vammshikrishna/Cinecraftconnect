/**
 * Deterministic State Machine for the Authentication Lifecycle.
 * Prevents invalid state transitions (e.g., logging in while logging out)
 * and provides a single source of truth for the auth status.
 */

export type AuthState = 
  | 'BOOTSTRAPPING'
  | 'AUTHENTICATED'
  | 'VALIDATING'
  | 'REFRESHING'
  | 'RECOVERING'
  | 'EXPIRED'
  | 'LOGGING_OUT'
  | 'UNAUTHENTICATED';

let currentState: AuthState = 'BOOTSTRAPPING';
const stateListeners: ((state: AuthState) => void)[] = [];

/**
 * Valid transitions map to prevent illegal state jumps.
 */
const VALID_TRANSITIONS: Record<AuthState, AuthState[]> = {
  BOOTSTRAPPING: ['AUTHENTICATED', 'UNAUTHENTICATED'],
  AUTHENTICATED: ['VALIDATING', 'REFRESHING', 'LOGGING_OUT', 'EXPIRED'],
  VALIDATING: ['AUTHENTICATED', 'LOGGING_OUT', 'EXPIRED', 'RECOVERING'],
  REFRESHING: ['AUTHENTICATED', 'RECOVERING', 'LOGGING_OUT', 'EXPIRED'],
  RECOVERING: ['AUTHENTICATED', 'LOGGING_OUT', 'UNAUTHENTICATED'],
  EXPIRED: ['REFRESHING', 'LOGGING_OUT', 'UNAUTHENTICATED'],
  LOGGING_OUT: ['UNAUTHENTICATED'],
  UNAUTHENTICATED: ['BOOTSTRAPPING', 'AUTHENTICATED']
};

export const getAuthState = () => currentState;

export const transitionTo = (nextState: AuthState, reason: string) => {
  if (nextState === currentState) return;

  const allowed = VALID_TRANSITIONS[currentState].includes(nextState);
  
  if (!allowed) {
    console.error(`[AUTH MACHINE] Illegal transition attempt: ${currentState} -> ${nextState} (Reason: ${reason})`);
    // In production, we might want to force a logout here if it's a critical safety violation,
    // but for now we just log it to prevent bricking the app.
    return;
  }

  const previousState = currentState;
  currentState = nextState;

  console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: sessionStateMachine event: state_transition previousState: ${previousState} nextState: ${nextState} reason: ${reason}`);

  stateListeners.forEach(listener => listener(currentState));
};

export const onAuthStateChange = (listener: (state: AuthState) => void) => {
  stateListeners.push(listener);
  return () => {
    const index = stateListeners.indexOf(listener);
    if (index > -1) stateListeners.splice(index, 1);
  };
};
