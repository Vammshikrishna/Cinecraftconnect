/**
 * Cross-Tab Authentication Coordination Engine.
 * Uses the BroadcastChannel API to synchronize auth events across multiple tabs,
 * preventing redundant validation storms or inconsistent logout states.
 */

const AUTH_CHANNEL_NAME = 'cinecraft_auth_sync';
let broadcastChannel: BroadcastChannel | null = null;

export type AuthBroadcastMessage = 
  | { type: 'LOGIN_DETECTED'; userId: string; generation: string }
  | { type: 'LOGOUT_DETECTED'; reason: string }
  | { type: 'REFRESH_STARTED'; generation: string }
  | { type: 'REFRESH_COMPLETED'; generation: string }
  | { type: 'VALIDATION_STATE'; isValid: boolean; generation: string };

/**
 * Initializes the broadcast channel for the current tab.
 */
export const initAuthBroadcast = (onMessage: (msg: AuthBroadcastMessage) => void) => {
  if (typeof window === 'undefined' || !window.BroadcastChannel) return;
  
  if (!broadcastChannel) {
    broadcastChannel = new BroadcastChannel(AUTH_CHANNEL_NAME);
    broadcastChannel.onmessage = (event) => {
      onMessage(event.data);
    };
  }
};

/**
 * Sends an auth event to all other open tabs.
 */
export const broadcastAuthEvent = (message: AuthBroadcastMessage) => {
  if (!broadcastChannel) return;
  
  console.log(`[AUTH TRACE] timestamp: ${new Date().toISOString()} source: authBroadcast event: broadcast_sent type: ${message.type}`);
  broadcastChannel.postMessage(message);
};

/**
 * Tears down the broadcast channel.
 */
export const destroyAuthBroadcast = () => {
  if (broadcastChannel) {
    broadcastChannel.close();
    broadcastChannel = null;
  }
};
