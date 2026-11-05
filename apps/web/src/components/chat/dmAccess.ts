/** Pure rules for deciding whether a direct-message URL (/messages/:id, /dm/:id) may open a chat. */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isValidUserId = (id: string | null | undefined): boolean => !!id && UUID_RE.test(id);

export type DmAccess = 'ok' | 'invalid' | 'self' | 'fan_restricted';

export interface DmAccessInput {
  selfId: string | null | undefined;
  partnerId: string | null | undefined;
  /** The signed-in user is a fan. */
  isFan: boolean;
  /** account_type of the partner once known (null while unknown). */
  partnerAccountType?: string | null;
  /** The two already have a conversation, so a fan may keep using it. */
  hasConversation?: boolean;
}

export const getDmAccess = (i: DmAccessInput): DmAccess => {
  if (!isValidUserId(i.partnerId)) return 'invalid';
  if (i.selfId && i.partnerId === i.selfId) return 'self';
  // The new-message search only offers fans to fans; the same rule applies to a pasted link.
  if (i.isFan && !i.hasConversation && i.partnerAccountType && i.partnerAccountType !== 'fan') return 'fan_restricted';
  return 'ok';
};

/** Case-insensitive filter of conversations by partner name. */
export const filterByPartnerName = <T extends { partner: { full_name?: string | null } }>(items: T[], term: string): T[] => {
  const t = term.trim().toLowerCase();
  if (!t) return items;
  return items.filter((c) => (c.partner.full_name || '').toLowerCase().includes(t));
};
