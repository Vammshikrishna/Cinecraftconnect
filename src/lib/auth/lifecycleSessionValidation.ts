import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { Capacitor } from '@capacitor/core';
import { executeSessionValidation } from './fallbackSessionPolling';
import { getCurrentGeneration } from './sessionGeneration';

let isListening = false;
let currentSession: any = null;

// Throttling to prevent multiple rapid validations
let lastValidationTime = 0;
const THROTTLE_MS = 5000;

const handleLifecycleEvent = async (reason: string) => {
    if (!currentSession) return;
    
    const generation = getCurrentGeneration();
    const now = Date.now();
    if (now - lastValidationTime < THROTTLE_MS) return;
    
    console.log(`[SECURITY LIFECYCLE] Validating session due to: ${reason} generation: ${generation}`);
    lastValidationTime = now;
    
    await executeSessionValidation(currentSession);
    
    // Ownership check: If generation changed while we were awaiting DB, abort.
    if (generation !== getCurrentGeneration()) {
        console.warn(`[AUTH TRACE] lifecycleSessionValidation: Validation finished but generation is stale. Aborting.`);
        return;
    }
};

/**
 * Binds device lifecycle events (app resume, network reconnect) to trigger session validation.
 * This ensures security validations happen right when the user opens the app,
 * rather than waiting for an arbitrary 3-minute poll interval.
 */
export const startLifecycleValidation = (session: any) => {
    currentSession = session;
    
    if (isListening) return; // Prevent duplicate listeners
    isListening = true;

    // Capacitor Native App State (Foreground/Background)
    if (Capacitor.isNativePlatform()) {
        App.addListener('appStateChange', (state) => {
            if (state.isActive) {
                handleLifecycleEvent('app_resume');
            }
        });
    }

    // Network Reconnection (Both Native and Web Capacitor Plugin handles this)
    Network.addListener('networkStatusChange', (status: any) => {
        if (status.connected) {
            handleLifecycleEvent('network_reconnected');
        }
    });

    // Web/PWA Fallbacks
    if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                handleLifecycleEvent('tab_visible');
            }
        });
        
        window.addEventListener('online', () => {
            handleLifecycleEvent('window_online');
        });
    }
};

/**
 * Clears the active session from lifecycle checks.
 * We keep the listeners bound as they are extremely lightweight and safely return early.
 */
export const stopLifecycleValidation = () => {
    currentSession = null;
};
