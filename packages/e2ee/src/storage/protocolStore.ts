import { getSecureItem, setSecureItem, removeSecureItem } from './keyStore';

export interface RatchetSessionState {
  conversationId: string;
  partnerDeviceId: string;
  rootKey: string;            // Base64 HKDF root key
  sendingChainKey: string;    // Base64 sending chain key
  receivingChainKey?: string; // Base64 receiving chain key
  dhSendingPublic: string;    // Ephemeral DH public key Base64
  dhSendingPrivate: string;   // Ephemeral DH private key Base64
  dhReceivingPublic?: string; // Partner DH public key Base64
  nMsg: number;               // Sender message index
  pnMsg: number;              // Previous chain message index
  skippedMessageKeys: Record<string, string>; // Keyed by `${n_msg}`, stores skipped message keys
  updatedAt: string;
}

export interface GroupState {
  groupId: string;            // spaceId or roomId
  targetType: 'project_space' | 'room';
  epoch: number;
  epochKey: string;           // Base64 current epoch symmetric key
  updatedAt: string;
}

export const saveRatchetSession = async (session: RatchetSessionState): Promise<void> => {
  const key = `ratchet_session_${session.conversationId}_${session.partnerDeviceId}`;
  await setSecureItem(key, JSON.stringify(session));
};

export const getRatchetSession = async (conversationId: string, partnerDeviceId: string): Promise<RatchetSessionState | null> => {
  const key = `ratchet_session_${conversationId}_${partnerDeviceId}`;
  const raw = await getSecureItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
};

export const saveGroupState = async (state: GroupState): Promise<void> => {
  const key = `group_state_${state.targetType}_${state.groupId}`;
  await setSecureItem(key, JSON.stringify(state));
};

export const getGroupState = async (targetType: string, groupId: string): Promise<GroupState | null> => {
  const key = `group_state_${targetType}_${groupId}`;
  const raw = await getSecureItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
};

export const clearProtocolStore = async (): Promise<void> => {
  // Clear protocol session state on logout
  const keys = ['ratchet_session_', 'group_state_'];
  for (const k of keys) {
    await removeSecureItem(k);
  }
};
