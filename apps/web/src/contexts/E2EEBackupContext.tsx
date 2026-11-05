import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getLocalPrivateKey, setLocalPrivateKey, removeLocalPrivateKey } from '@/lib/e2ee-storage';
import { syncPrivateKeyToNative } from '@/lib/e2ee-bridge';
import {
  generateUserKeyPair,
  exportPublicKey,
  exportPrivateKey,
  importPrivateKey,
  extractPublicKeyFromPrivateKey,
  decryptPrivateKeyWithPin
} from '@/lib/e2ee';
import {
  encryptPrivateKeyWithPinVault,
  decryptPrivateKeyWithPinVault,
  isVaultBackup,
  createPinVault,
  describePinVaultError,
} from '@cinecraft/e2ee';
import { toast } from '@/hooks/use-toast';
import { fetchE2EEProfileInfo } from '@/lib/e2eeProfiles';

interface E2EEBackupContextType {
  /** null until the first check finishes. false = the person has not turned encrypted messages on. */
  e2eeEnabled: boolean | null;
  /** this device holds a valid private key (i.e. encrypted messages are unlocked here) */
  hasLocalKey: boolean;
  /** true once a chat screen asked for the PIN dialog: it never appears on pages that are not about messages */
  promptRequested: boolean;
  /** soft request from a chat screen: shows the dialog unless the person already dismissed it this session */
  requestPrompt: () => void;
  cancelPrompt: () => void;
  /** explicit request (a button the person pressed): always shows the dialog */
  openPrompt: () => void;
  /** turn encrypted messages on: creates or restores the key, publishes it, then asks for the PIN */
  enableE2EE: () => Promise<void>;
  /** turn encrypted messages off. Keys and the PIN backup are kept so history stays readable and it can be turned on again */
  disableE2EE: () => Promise<void>;
  isChecking: boolean;
  isSetupRequired: boolean;
  isRecoveryRequired: boolean;
  isDismissed: boolean;
  dismissModal: () => void;
  backupSalt: string | null;
  encryptedPrivateKey: string | null;
  checkBackupStatus: () => Promise<void>;
  setupBackup: (pin: string) => Promise<void>;
  recoverBackup: (pin: string) => Promise<boolean>;
  performReset: () => Promise<void>;
  setupBackupWithMnemonic: (pin: string) => Promise<boolean>;
  recoverBackupWithMnemonic: (pin: string) => Promise<boolean>;
}

const E2EEBackupContext = createContext<E2EEBackupContextType | undefined>(undefined);

export const E2EEBackupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, session, profile } = useAuth();
  const [isChecking, setIsChecking] = useState(true);
  const [isSetupRequired, setIsSetupRequired] = useState(false);
  const [isRecoveryRequired, setIsRecoveryRequired] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [e2eeEnabled, setE2eeEnabled] = useState<boolean | null>(null);
  const [hasLocalKey, setHasLocalKey] = useState(false);
  const [promptRequested, setPromptRequested] = useState(false);
  const [backupSalt, setBackupSalt] = useState<string | null>(null);
  const [encryptedPrivateKey, setEncryptedPrivateKey] = useState<string | null>(null);
  const checkingRef = useRef(false);
  const lastCheckedTokenRef = useRef<string | null>(null);

  const dismissModal = () => setIsDismissed(true);
  const requestPrompt = () => setPromptRequested(true);
  // called when the person leaves the message screens: the PIN screen must not follow them to other pages
  const cancelPrompt = () => { setPromptRequested(false); setIsDismissed(false); };
  const openPrompt = () => { setIsDismissed(false); setPromptRequested(true); };

  const generateNewKeyPairAndSave = async (userId: string) => {
    console.log("Generating fresh E2EE key pair...");
    const keyPair = await generateUserKeyPair();
    const publicKeyStr = await exportPublicKey(keyPair.publicKey);
    const privateKeyStr = await exportPrivateKey(keyPair.privateKey);

    await setLocalPrivateKey(userId, privateKeyStr);
    await syncPrivateKeyToNative(userId, privateKeyStr);

    const { error } = await supabase
      .from('profiles')
      .update({ public_key: publicKeyStr })
      .eq('id', userId);

    if (error) {
      console.error("Failed to save new E2EE public key to Supabase:", error);
    }
    return privateKeyStr;
  };

  const checkBackupStatus = async (retryCount = 0) => {
    console.log(`🔐 [E2EE Context] checkBackupStatus called (attempt ${retryCount + 1}) for user ${user?.id}`);
    if (!user) {
      console.log("🔐 [E2EE Context] No user active, skipping status check.");
      setIsChecking(false);
      setIsSetupRequired(false);
      setIsRecoveryRequired(false);
      return;
    }

    if (profile && !(profile as any).onboarding_completed) {
      console.log("🔐 [E2EE Context] Profile onboarding incomplete. Skipping E2EE setup prompt.");
      setIsChecking(false);
      checkingRef.current = false;
      return;
    }

    const currentToken = session?.access_token ?? null;
    if (checkingRef.current && retryCount === 0) {
      console.log("🔐 [E2EE Context] Already checking backup status, skipping parallel call.");
      return;
    }
    if (lastCheckedTokenRef.current === currentToken && currentToken !== null && retryCount === 0) {
      console.log("🔐 [E2EE Context] Token has not changed, skipping redundant check.");
      return;
    }

    checkingRef.current = true;
    lastCheckedTokenRef.current = currentToken;
    setIsChecking(true);

    try {
      console.log("🔐 [E2EE Context] Fetching key status, backup, and profile in parallel...");
      
      const [localPrivateKeyStr, backupResult, profileResult] = await Promise.all([
        getLocalPrivateKey(user.id),
        (supabase as any)
          .from('key_backups')
          .select('encrypted_private_key, salt')
          .eq('user_id', user.id)
          .maybeSingle(),
        fetchE2EEProfileInfo([user.id])
          .then((m) => ({ data: m.get(user.id) ?? null, error: null as any }))
          .catch((error) => ({ data: null, error }))
      ]);

      let hasValidLocalKey = false;
      if (localPrivateKeyStr) {
        try {
          await importPrivateKey(localPrivateKeyStr);
          hasValidLocalKey = true;
          console.log("🔐 [E2EE Context] Valid local private key exists.");
          syncPrivateKeyToNative(user.id, localPrivateKeyStr).catch(() => {});
        } catch (e) {
          console.error("🔐 [E2EE Context] Local private key is corrupted, treating as missing:", e);
        }
      } else {
        console.log("🔐 [E2EE Context] No local private key found.");
      }

      if (backupResult.error) {
        throw new Error(`Failed to fetch key backup: ${backupResult.error.message}`);
      }
      if (profileResult.error) {
        throw new Error(`Failed to fetch profile public key: ${profileResult.error.message}`);
      }

      const backupData = backupResult.data as any;
      const profileData = profileResult.data as any;
      const hasRemoteBackup = !!backupData?.encrypted_private_key;
      const profilePublicKey = profileData?.public_key;
      const enabled = !!profileData?.e2ee_enabled;
      setE2eeEnabled(enabled);
      setHasLocalKey(hasValidLocalKey);

      // Opt-in: until the person turns encrypted messages on we do not create keys and we never show the PIN dialog.
      if (!enabled) {
        setIsSetupRequired(false);
        setIsRecoveryRequired(false);
        setIsChecking(false);
        checkingRef.current = false;
        return;
      }

      console.log(`🔐 [E2EE Context] DB results: hasRemoteBackup=${hasRemoteBackup}, profilePublicKeyExists=${!!profilePublicKey}`);

      if (hasRemoteBackup) {
        setBackupSalt(backupData.salt);
        setEncryptedPrivateKey(backupData.encrypted_private_key);

        if (hasValidLocalKey) {
          console.log("🔐 [E2EE Context] Valid local key present. PIN recovery not needed for app startup.");
          setIsSetupRequired(false);
          setIsRecoveryRequired(false);
        } else {
          console.log("🔐 [E2EE Context] Remote backup exists but local key is missing. Prompting PIN recovery.");
          setIsSetupRequired(false);
          setIsRecoveryRequired(true);
        }
      } else {
        if (hasValidLocalKey && profilePublicKey) {
          console.log("🔐 [E2EE Context] Local key exists but no backup. Prompting PIN backup setup.");
          setIsSetupRequired(true);
          setIsRecoveryRequired(false);
        } else {
          console.log("🔐 [E2EE Context] Fresh account/key required. Generating key pair and prompting backup setup.");
          await generateNewKeyPairAndSave(user.id);
          setIsSetupRequired(true);
          setIsRecoveryRequired(false);
        }
      }

      setIsChecking(false);
      checkingRef.current = false;
    } catch (err) {
      console.error(`🔐 [E2EE Context] Error checking E2EE backup status:`, err);
      setIsChecking(false);
      checkingRef.current = false;
    }
  };

  const setupBackup = async (pin: string) => {
    if (!user) throw new Error("User not authenticated");

    try {
      const localPrivateKeyStr = await getLocalPrivateKey(user.id);
      if (!localPrivateKeyStr) {
        throw new Error("No local private key found to back up");
      }

      // The backup key needs the PIN and a secret held by the server (key-vault), so a copy of the database alone cannot be
      // used to guess PINs.
      const { encryptedKey, salt } = await encryptPrivateKeyWithPinVault(localPrivateKeyStr, pin, createPinVault(supabase as any));

      const { error } = await (supabase as any)
        .from('key_backups')
        .upsert({
          user_id: user.id,
          encrypted_private_key: encryptedKey,
          salt: salt,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        });

      if (error) throw error;

      sessionStorage.setItem(`e2ee_pin_verified_${user.id}`, 'true');
      setIsSetupRequired(false);
      toast.success("E2EE key backup created successfully!");
    } catch (err) {
      console.error("Failed to setup E2EE key backup:", err);
      toast.error(describePinVaultError(err) ?? "Failed to create backup. Please try again.");
      throw err;
    }
  };

  const recoverBackup = async (pin: string): Promise<boolean> => {
    if (!user || !encryptedPrivateKey || !backupSalt) {
      toast.error("Recovery details are missing");
      return false;
    }

    try {
      let decryptedKeyStr: string;
      if (isVaultBackup(backupSalt)) {
        decryptedKeyStr = await decryptPrivateKeyWithPinVault(encryptedPrivateKey, pin, backupSalt, createPinVault(supabase as any));
      } else {
        // An older backup (PIN only). It opened, so upgrade it to the key-vault version right away.
        decryptedKeyStr = await decryptPrivateKeyWithPin(encryptedPrivateKey, pin, backupSalt);
        try {
          const upgraded = await encryptPrivateKeyWithPinVault(decryptedKeyStr, pin, createPinVault(supabase as any));
          const { error: upErr } = await (supabase as any).from('key_backups').upsert({
            user_id: user.id,
            encrypted_private_key: upgraded.encryptedKey,
            salt: upgraded.salt,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });
          if (!upErr) {
            setBackupSalt(upgraded.salt);
            setEncryptedPrivateKey(upgraded.encryptedKey);
          }
        } catch (upgradeErr) {
          console.warn('Could not upgrade the PIN backup yet:', upgradeErr);
        }
      }

      await importPrivateKey(decryptedKeyStr);
      await setLocalPrivateKey(user.id, decryptedKeyStr);
      await syncPrivateKeyToNative(user.id, decryptedKeyStr);

      sessionStorage.setItem(`e2ee_pin_verified_${user.id}`, 'true');
      setHasLocalKey(true);
      setIsRecoveryRequired(false);
      toast.success("E2EE secure chats restored successfully!");
      return true;
    } catch (err) {
      console.error("Failed to recover E2EE backup:", err);
      toast.error(describePinVaultError(err) ?? "Incorrect PIN. Please try again.");
      return false;
    }
  };

  const performReset = async () => {
    if (!user) return;

    const loadingToast = toast.loading("Resetting E2EE identity...");
    try {
      // 1. Delete remote backup
      await (supabase as any)
        .from('key_backups')
        .delete()
        .eq('user_id', user.id);

      // 2. Delete own group keys (to trigger self-healing sync from other members)
      await (supabase as any)
        .from('group_keys')
        .delete()
        .eq('user_id', user.id);

      // 3. Generate a new key pair and save locally + profile public key
      await generateNewKeyPairAndSave(user.id);
      setHasLocalKey(true);

      // 4. Force PIN setup for the new key pair
      setIsRecoveryRequired(false);
      setIsSetupRequired(true);
      setBackupSalt(null);
      setEncryptedPrivateKey(null);

      toast.dismiss(loadingToast);
      toast.success("E2EE keys reset successfully. Please create a new recovery PIN.");
    } catch (err) {
      toast.dismiss(loadingToast);
      console.error("Failed to reset E2EE keys:", err);
      toast.error("Failed to reset identity. Please try again.");
    }
  };

  const enableE2EE = async () => {
    if (!user) throw new Error('User not authenticated');
    const [localKeyStr, backup, prof] = await Promise.all([
      getLocalPrivateKey(user.id),
      (supabase as any).from('key_backups').select('user_id').eq('user_id', user.id).maybeSingle(),
      supabase.from('profiles').select('public_key').eq('id', user.id).maybeSingle(),
    ]);
    const hasRemoteBackup = !!backup?.data;
    const publicKey = (prof?.data as any)?.public_key as string | null | undefined;

    if (!localKeyStr && !hasRemoteBackup) {
      // brand new: create the key pair and publish the public half
      await generateNewKeyPairAndSave(user.id);
    } else if (localKeyStr && !publicKey) {
      // we hold a key but never published it
      const pub = await extractPublicKeyFromPrivateKey(localKeyStr);
      const { error } = await supabase.from('profiles').update({ public_key: pub }).eq('id', user.id);
      if (error) throw error;
    }
    // (a backup without a local key means: restore it with the PIN, never overwrite it with a new key)

    const { error } = await (supabase as any).rpc('set_e2ee_enabled', { p_enabled: true });
    if (error) throw error;

    setE2eeEnabled(true);
    lastCheckedTokenRef.current = null; // force a fresh check so the right dialog (create PIN / enter PIN) opens
    checkingRef.current = false;
    await checkBackupStatus();
    openPrompt();
  };

  const disableE2EE = async () => {
    if (!user) throw new Error('User not authenticated');
    const { error } = await (supabase as any).rpc('set_e2ee_enabled', { p_enabled: false });
    if (error) throw error;
    setE2eeEnabled(false);
    setIsSetupRequired(false);
    setIsRecoveryRequired(false);
  };

  // Fire when the session access_token changes, not just user.id.
  // This is critical: if we fire on user.id alone, the Supabase client may not yet
  // have the JWT applied, causing key_backups/profiles queries to 401 silently,
  // which swallows the result and means the PIN modal never shows.
  // a different account (or none) never inherits the previous account's request to ask for the PIN
  useEffect(() => {
    setPromptRequested(false);
    setIsDismissed(false);
  }, [user?.id]);

  useEffect(() => {
    if (user && session?.access_token && profile?.onboarding_completed) {
      // Ensure the realtime auth is up to date before querying
      supabase.realtime.setAuth(session.access_token);
      checkBackupStatus();
    } else if (!user) {
      setIsChecking(false);
      checkingRef.current = false;
      lastCheckedTokenRef.current = null;
      setIsSetupRequired(false);
      setIsRecoveryRequired(false);
      setE2eeEnabled(null);
      setHasLocalKey(false);
      setPromptRequested(false);
      setIsDismissed(false);
    } else if (user && profile && !profile.onboarding_completed) {
      setIsChecking(false);
      setIsSetupRequired(false);
      setIsRecoveryRequired(false);
    }
  }, [user?.id, session?.access_token, profile?.onboarding_completed]);

  return (
    <E2EEBackupContext.Provider value={{
      e2eeEnabled,
      hasLocalKey,
      promptRequested,
      requestPrompt,
      cancelPrompt,
      openPrompt,
      enableE2EE,
      disableE2EE,
      isChecking,
      isSetupRequired,
      isRecoveryRequired,
      isDismissed,
      dismissModal,
      backupSalt,
      encryptedPrivateKey,
      checkBackupStatus,
      setupBackup,
      recoverBackup,
      setupBackupWithMnemonic: async (pin: string) => { await setupBackup(pin); return true; },
      recoverBackupWithMnemonic: recoverBackup,
      performReset
    }}>
      {children}
    </E2EEBackupContext.Provider>
  );
};

export const useE2EEBackup = () => {
  const context = useContext(E2EEBackupContext);
  if (context === undefined) {
    throw new Error('useE2EEBackup must be used within an E2EEBackupProvider');
  }
  return context;
};
