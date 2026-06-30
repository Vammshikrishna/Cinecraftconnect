import { startRealtimeSessionMonitor, stopRealtimeSessionMonitor } from './realtimeSessionMonitor';
import { startLifecycleValidation, stopLifecycleValidation } from './lifecycleSessionValidation';
import { startFallbackPolling, stopFallbackPolling, executeSessionValidation } from './fallbackSessionPolling';
import { transitionTo } from './sessionStateMachine';
import { getCurrentGeneration } from './sessionGeneration';
import { awaitBootstrapReady } from './authBootstrapBarrier';

/**
 * Singleton orchestrator for the Hybrid Realtime Session Validation system.
 */
class SessionValidationManager {
  private isInitialized = false;
  private currentSession: any = null;
  private currentGeneration: string | null = null;

  /**
   * Called upon successful login or app cold start.
   */
  public async initialize(session: any) {
    const generation = getCurrentGeneration();
    
    // 1. Idempotency Check
    if (this.isInitialized && this.currentSession?.access_token === session?.access_token) {
        return;
    }

    this.currentSession = session;
    this.currentGeneration = generation;
    
    if (!this.currentSession?.refresh_token) {
        console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: sessionValidationManager event: init_abort reason: no_refresh_token`);
        transitionTo('UNAUTHENTICATED', 'missing_refresh_token');
        return;
    }

    console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: sessionValidationManager event: init_start generation: ${generation}`);
    this.isInitialized = true;
    transitionTo('VALIDATING', 'initial_security_check');

    try {
        // 2. Initial immediate validation check
        // Give the DB enough time to propagate the session record from bindSessionToDevice.
        // Hard refresh causes a cold re-bind followed immediately by validation — 500ms is
        // too short under normal network latency. 2s is safe and still imperceptible to the user.
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const isValid = await executeSessionValidation(session);
        
        // Ownership check: If generation changed while we were awaiting DB, abort this task.
        if (generation !== getCurrentGeneration()) {
            console.warn(`[AUTH TRACE] sessionValidationManager: Validation finished but generation is stale. Aborting.`);
            return;
        }

        if (!isValid) return; // forceSoftLogout handled inside executeSessionValidation

        transitionTo('AUTHENTICATED', 'validation_passed');

        // 3. Start Subsystems after full bootstrap (background wait to prevent deadlock)
        awaitBootstrapReady().then(() => {
            if (this.currentGeneration !== generation) return;
            
            // Start listeners only after the barrier is released
            startRealtimeSessionMonitor(session);
            startLifecycleValidation(session);
            startFallbackPolling(session);
        });

    } catch (err) {
        console.error('[SECURITY ORCHESTRATOR] Initialization failed:', err);
        transitionTo('UNAUTHENTICATED', 'init_error');
    }
  }

  /**
   * Called on logout or when the user session is explicitly destroyed.
   */
  public async destroy() {
    if (!this.isInitialized) return;
    
    console.log('[SECURITY ORCHESTRATOR] Tearing down validation architecture');
    this.isInitialized = false;
    this.currentSession = null;
    this.currentGeneration = null;

    await stopRealtimeSessionMonitor();
    stopLifecycleValidation();
    stopFallbackPolling();
  }

  /**
   * Called when Supabase refreshes the token.
   * Updates the active tracking mechanisms with the new token hash without requiring a full re-initialization.
   */
  public async updateSession(newSession: any) {
    if (!this.isInitialized || !newSession?.refresh_token) return;

    console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: sessionValidationManager event: update_session_start`);
    this.currentSession = newSession;

    try {
      // Import bindSessionToDevice dynamically or at the top of file
      const { bindSessionToDevice } = await import('./sessionBinding');
      
      // 1. Rebind device with the NEW token hash
      await bindSessionToDevice(newSession);

      // 2. Restart the realtime monitor with the NEW token hash
      // (This will disconnect the old channel and create a new one)
      await startRealtimeSessionMonitor(newSession);
      
      // 3. Update the session references for polling and lifecycle
      startLifecycleValidation(newSession);
      startFallbackPolling(newSession);
      
      console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: sessionValidationManager event: update_session_complete`);
    } catch (err) {
      console.error('[SECURITY ORCHESTRATOR] Failed to update session:', err);
    }
  }
}

export const sessionManager = new SessionValidationManager();
