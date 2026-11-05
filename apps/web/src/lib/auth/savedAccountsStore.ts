/**
 * Saved accounts for the web account switcher (AUTH-F-09).
 *
 * localStorage["cc_saved_accounts"] holds a JSON array. Metadata (userId, email, username, avatarUrl) stays readable.
 * Tokens are only stored as a tokenVault envelope in `vault`; plain `session` / `access_token` / `refresh_token` fields are
 * never written. If the vault is unavailable, no tokens are stored at all and switching asks the user to sign in again.
 */
import { decrypt, encrypt, isEnvelope } from './tokenVault';

export const SAVED_ACCOUNTS_KEY = 'cc_saved_accounts';

export interface SavedAccountMeta {
  userId: string;
  email: string;
  username: string;
  avatarUrl: string;
  /** True when an encrypted token envelope is stored for this account. */
  hasTokens: boolean;
}

export interface SavedTokens {
  access_token: string;
  refresh_token: string;
}

interface StoredEntry {
  userId: string;
  email: string;
  username: string;
  avatarUrl: string;
  vault?: string;
}

const ls = (): Storage | null => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
};

// Serialise read-modify-write cycles (encryption is async, concurrent updates would otherwise lose writes).
let chain: Promise<unknown> = Promise.resolve();
const locked = <T>(fn: () => Promise<T>): Promise<T> => {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
};

const tokensOf = (o: any): SavedTokens | null =>
  o && typeof o.access_token === 'string' && typeof o.refresh_token === 'string' && o.access_token && o.refresh_token
    ? { access_token: o.access_token, refresh_token: o.refresh_token }
    : null;

const readEntries = (): { entries: StoredEntry[]; dirty: boolean; legacyTokens: Map<string, SavedTokens> } => {
  const legacyTokens = new Map<string, SavedTokens>();
  const store = ls();
  if (!store) return { entries: [], dirty: false, legacyTokens };
  let parsed: unknown;
  try {
    const raw = store.getItem(SAVED_ACCOUNTS_KEY);
    if (!raw) return { entries: [], dirty: false, legacyTokens };
    parsed = JSON.parse(raw);
  } catch {
    return { entries: [], dirty: false, legacyTokens };
  }
  if (!Array.isArray(parsed)) return { entries: [], dirty: false, legacyTokens };

  let dirty = false;
  const entries: StoredEntry[] = [];
  for (const item of parsed as any[]) {
    if (!item || typeof item.userId !== 'string' || !item.userId) { dirty = true; continue; }
    const entry: StoredEntry = {
      userId: item.userId,
      email: typeof item.email === 'string' ? item.email : '',
      username: typeof item.username === 'string' ? item.username : '',
      avatarUrl: typeof item.avatarUrl === 'string' ? item.avatarUrl : '',
    };
    if (isEnvelope(item.vault)) entry.vault = item.vault;
    // Legacy plain-text entry ({ session: { access_token, refresh_token, ... } }) or loose token fields.
    const legacy = tokensOf(item.session) || tokensOf(item);
    if (legacy) { legacyTokens.set(entry.userId, legacy); dirty = true; }
    if ('session' in item || 'access_token' in item || 'refresh_token' in item) dirty = true;
    entries.push(entry);
  }
  return { entries, dirty, legacyTokens };
};

const writeEntries = (entries: StoredEntry[]): void => {
  const store = ls();
  if (!store) return;
  try {
    store.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(entries));
  } catch (e) {
    console.error('Failed to save accounts:', e);
  }
};

const toMeta = (e: StoredEntry): SavedAccountMeta => ({
  userId: e.userId,
  email: e.email,
  username: e.username,
  avatarUrl: e.avatarUrl,
  hasTokens: !!e.vault,
});

/**
 * Reads the list; first call after an upgrade migrates plain-text entries: tokens are encrypted into `vault` and the plain
 * copy is removed from storage. If encryption is impossible the plain tokens are dropped (the user signs in again).
 */
const readAndMigrate = async (): Promise<StoredEntry[]> => {
  const { entries, dirty, legacyTokens } = readEntries();
  if (!dirty) return entries;
  for (const entry of entries) {
    const legacy = legacyTokens.get(entry.userId);
    if (!legacy) continue;
    const env = await encrypt(JSON.stringify(legacy), entry.userId);
    if (env) entry.vault = env;
  }
  writeEntries(entries); // no plain tokens are included in StoredEntry
  return entries;
};

export const listSavedAccounts = (): Promise<SavedAccountMeta[]> =>
  locked(async () => (await readAndMigrate()).map(toMeta));

/** Decrypts the tokens of one account. null = none stored, vault unavailable, or the envelope was tampered with. */
export const getSavedAccountTokens = (userId: string): Promise<SavedTokens | null> =>
  locked(async () => {
    const entry = (await readAndMigrate()).find((e) => e.userId === userId);
    if (!entry?.vault) return null;
    const plain = await decrypt(entry.vault, userId);
    if (!plain) return null;
    try {
      return tokensOf(JSON.parse(plain));
    } catch {
      return null;
    }
  });

/**
 * Creates or updates an account. `tokens` are encrypted before they touch storage; if that is not possible the account is
 * kept without tokens. Only creates a new entry when userId and email are present.
 */
export const upsertSavedAccount = (
  userId: string,
  patch: Partial<Pick<SavedAccountMeta, 'email' | 'username' | 'avatarUrl'>>,
  tokens?: SavedTokens | null
): Promise<SavedAccountMeta[]> =>
  locked(async () => {
    const entries = await readAndMigrate();
    const idx = entries.findIndex((e) => e.userId === userId);
    let entry: StoredEntry;
    if (idx > -1) {
      entry = { ...entries[idx] };
      if (patch.email !== undefined) entry.email = patch.email;
      if (patch.username !== undefined) entry.username = patch.username;
      if (patch.avatarUrl !== undefined) entry.avatarUrl = patch.avatarUrl;
    } else {
      if (!patch.email) return entries.map(toMeta);
      entry = { userId, email: patch.email, username: patch.username || '', avatarUrl: patch.avatarUrl || '' };
    }
    const t = tokensOf(tokens);
    if (t) {
      const env = await encrypt(JSON.stringify(t), userId);
      if (env) entry.vault = env;
      else delete entry.vault; // never fall back to plain text
    }
    if (idx > -1) entries[idx] = entry; else entries.push(entry);
    writeEntries(entries);
    return entries.map(toMeta);
  });

/** Removes an account together with its encrypted tokens. */
export const removeSavedAccount = (userId: string): Promise<SavedAccountMeta[]> =>
  locked(async () => {
    const entries = (await readAndMigrate()).filter((e) => e.userId !== userId);
    writeEntries(entries);
    return entries.map(toMeta);
  });
