import { executeSessionValidation } from './fallbackSessionPolling';
import { getCurrentGeneration } from './sessionGeneration';

let isListening = false;
let currentSession: any = null;

let lastValidationTime = 0;
const THROTTLE_MS = 60000;

const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    handleLifecycleEvent('tab_visible');
  }
};

const handleOnline = () => {
  handleLifecycleEvent('window_online');
};

const handleLifecycleEvent = async (reason: string) => {
  if (!currentSession) return;
  
  const generation = getCurrentGeneration();
  const now = Date.now();
  if (now - lastValidationTime < THROTTLE_MS) return;
  
  console.log(`[SECURITY LIFECYCLE] Validating session due to: ${reason} generation: ${generation}`);
  lastValidationTime = now;
  
  await executeSessionValidation(currentSession);
  
  if (generation !== getCurrentGeneration()) {
    console.warn(`[AUTH TRACE] lifecycleSessionValidation: Validation finished but generation is stale. Aborting.`);
    return;
  }
};

export const startLifecycleValidation = (session: any) => {
  // Always update the current session reference, even if already listening.
  // This ensures token refreshes (TOKEN_REFRESHED) pass the new session to the validator.
  currentSession = session;
  
  if (isListening) return;
  isListening = true;

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
  }
};

export const stopLifecycleValidation = () => {
  currentSession = null;
  lastValidationTime = 0;

  // Bug fix: reset isListening so startLifecycleValidation properly re-attaches
  // on the next login. Also remove the named listeners to prevent accumulation
  // across login/logout cycles.
  if (isListening) {
    isListening = false;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
    }
  }
};
