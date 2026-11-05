/**
 * Encrypted-messages policy shared by web and mobile (see docs/E2EE_OPT_IN_DESIGN.md).
 * Pure functions only: no network, no storage, easy to unit-test. Both apps call these so the rules never drift.
 */

/** Marker the apps put in every encrypted payload (`{"__e2ee":true,...}`). Anything without it is plain text. */
export const isEncryptedPayload = (raw: string | null | undefined): boolean =>
  !!raw && (raw.includes('"__e2ee"') || raw.includes('__e2ee_thread') || (raw.startsWith('{') && raw.includes('for_recipient')));

// ── direct messages ─────────────────────────────────────────────────────────────────────────────────────────────

export type DmEncryptionMode = 'encrypt' | 'plaintext' | 'blocked_locked';
export type DmPolicyReason = 'both_ready' | 'self_off' | 'self_locked' | 'partner_off' | 'partner_not_ready';

export interface DmPolicyInput {
  /** I turned encrypted messages on (profiles.e2ee_enabled) */
  selfEnabled: boolean;
  /** this device holds my private key and I have a published public key */
  selfHasKeys: boolean;
  /** the other person turned it on */
  partnerEnabled: boolean;
  /** the other person has a public key we can encrypt to */
  partnerHasPublicKey: boolean;
}

/**
 * Decide how the next message in a 1:1 chat is sent.
 *  - encrypt:        both sides are ready
 *  - plaintext:      encryption is not possible (one side off or not set up); the UI must say so, never silently
 *  - blocked_locked: I am opted in but this device is locked: ask for the PIN instead of sending anything
 */
export const decideDmEncryption = (i: DmPolicyInput): { mode: DmEncryptionMode; reason: DmPolicyReason } => {
  if (!i.selfEnabled) return { mode: 'plaintext', reason: 'self_off' };
  if (!i.selfHasKeys) return { mode: 'blocked_locked', reason: 'self_locked' };
  if (!i.partnerEnabled) return { mode: 'plaintext', reason: 'partner_off' };
  if (!i.partnerHasPublicKey) return { mode: 'plaintext', reason: 'partner_not_ready' };
  return { mode: 'encrypt', reason: 'both_ready' };
};

/**
 * Anti-downgrade: if the conversation has encrypted messages in it and the next one would go out as plain text,
 * the sender must confirm first. Otherwise a server that hides the other person's key could quietly strip encryption.
 */
export const needsDowngradeConfirmation = (mode: DmEncryptionMode, threadHasEncryptedHistory: boolean): boolean =>
  mode === 'plaintext' && threadHasEncryptedHistory;

export interface DmBanner {
  kind: 'encrypted' | 'not_encrypted' | 'locked';
  title: string;
  detail: string;
  /** what the person can do about it, if anything */
  action?: 'turn_on' | 'unlock';
}

export const dmBanner = (reason: DmPolicyReason, partnerName = 'This person'): DmBanner => {
  switch (reason) {
    case 'both_ready':
      return { kind: 'encrypted', title: 'Messages are end-to-end encrypted', detail: `Only you and ${partnerName} can read them.` };
    case 'self_off':
      return { kind: 'not_encrypted', title: 'Messages in this chat are not encrypted', detail: 'Turn on encrypted messages in Settings to protect your chats with people who also have it on.', action: 'turn_on' };
    case 'self_locked':
      return { kind: 'locked', title: 'Unlock your encrypted messages', detail: 'Enter your PIN to read and send encrypted messages on this device.', action: 'unlock' };
    case 'partner_off':
      return { kind: 'not_encrypted', title: `${partnerName} hasn't turned on encrypted messages`, detail: 'Messages you send in this chat are not encrypted yet.' };
    case 'partner_not_ready':
      return { kind: 'not_encrypted', title: `${partnerName} hasn't finished setting up encryption`, detail: 'Messages you send in this chat are not encrypted yet.' };
  }
};

// ── groups ──────────────────────────────────────────────────────────────────────────────────────────────────────

export type GroupEncryptionKind = 'public' | 'encrypted';

/** Public discussion rooms are open to everyone, so there is no one to share a key with: never encrypted. */
export const groupEncryptionKind = (target: { type: 'room'; roomType?: string | null } | { type: 'project_space' }): GroupEncryptionKind => {
  if (target.type === 'project_space') return 'encrypted';
  return target.roomType === 'private' || target.roomType === 'secret' ? 'encrypted' : 'public';
};

/** Everyone in an encrypted group must be able to read it: members need encrypted messages on and unlocked. */
export const canJoinEncryptedGroup = (i: { selfEnabled: boolean; selfHasKeys: boolean }): { ok: boolean; reason?: 'turn_on' | 'unlock' } => {
  if (!i.selfEnabled) return { ok: false, reason: 'turn_on' };
  if (!i.selfHasKeys) return { ok: false, reason: 'unlock' };
  return { ok: true };
};
