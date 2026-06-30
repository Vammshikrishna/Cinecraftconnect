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
  encryptPrivateKeyWithPin,
  decryptPrivateKeyWithPin
} from '@/lib/e2ee';
import { toast } from 'sonner';

interface E2EEBackupContextType {
  isChecking: boolean;
  isSetupRequired: boolean;
  isRecoveryRequired: boolean;
  backupSalt: string | null;
  encryptedPrivateKey: string | null;
  checkBackupStatus: () => Promise<void>;
  setupBackup: (pin: string) => Promise<void>;
  recoverBackup: (pin: string) => Promise<boolean>;
  performReset: () => Promise<void>;
}

const E2EEBackupContext = createContext<E2EEBackupContextType | undefined>(undefined);

export const E2EEBackupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, session } = useAuth();
  const [isChecking, setIsChecking] = useState(true);
  const [isSetupRequired, setIsSetupRequired] = useState(false);
  const [isRecoveryRequired, setIsRecoveryRequired] = useState(false);
  const [backupSalt, setBackupSalt] = useState<string | null>(null);
  const [encryptedPrivateKey, setEncryptedPrivateKey] = useState<string | null>(null);
  const checkingRef = useRef(false);
  const lastCheckedTokenRef = useRef<string | null>(null);

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

  const checkBackupStatus = async () => {
    if (!user) {
      setIsChecking(false);
      setIsSetupRequired(false);
      setIsRecoveryRequired(false);
      return;
    }

    // Don't re-run if already running or if we've already checked with this exact token
    const currentToken = session?.access_token ?? null;
    if (checkingRef.current) return;
    if (lastCheckedTokenRef.current === currentToken && currentToken !== null) return;

    checkingRef.current = true;
    lastCheckedTokenRef.current = currentToken;
    setIsChecking(true);

    try {
      const localPrivateKeyStr = await getLocalPrivateKey(user.id);

      // Verify local private key is valid if present
      let hasValidLocalKey = false;
      if (localPrivateKeyStr) {
        try {
          await importPrivateKey(localPrivateKeyStr);
          hasValidLocalKey = true;
          // Sync to native secure store
          await syncPrivateKeyToNative(user.id, localPrivateKeyStr);
        } catch (e) {
          console.error("Local private key is corrupted, treating as missing:", e);
        }
      }

      // Fetch both remote backup and the profile public key from Supabase in parallel
      const [backupResult, profileResult] = await Promise.all([
        (supabase as any)
          .from('key_backups')
          .select('encrypted_private_key, salt')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('public_key')
          .eq('id', user.id)
          .maybeSingle()
      ]);

      if (backupResult.error) {
        // If we get a 401/JWT error, the auth token hasn't been applied to the client yet.
        // Throw so the outer catch can handle it, and the caller can retry.
        if (backupResult.error.code === 'PGRST301' || backupResult.error.message?.includes('JWT') || backupResult.error.message?.includes('401')) {
          throw new Error(`Auth token not ready: ${backupResult.error.message}`);
        }
        throw new Error(`Failed to fetch key backup: ${backupResult.error.message}`);
      }
      if (profileResult.error) {
        if (profileResult.error.code === 'PGRST301' || profileResult.error.message?.includes('JWT') || profileResult.error.message?.includes('401')) {
          throw new Error(`Auth token not ready: ${profileResult.error.message}`);
        }
        throw new Error(`Failed to fetch profile public key: ${profileResult.error.message}`);
      }

      const backupData = backupResult.data;
      const profileData = profileResult.data;
      const hasRemoteBackup = !!backupData?.encrypted_private_key;
      const profilePublicKey = profileData?.public_key;

      if (hasValidLocalKey) {
        if (!profilePublicKey) {
          // Desynced state: Local key exists but public key is missing from profile.
          // Since we can't extract the public key from the WebCrypto private key easily, we must regenerate.
          console.warn("Local key exists but profile public key missing. Forcing key regeneration.");
          await generateNewKeyPairAndSave(user.id);
          setIsSetupRequired(true);
          setIsRecoveryRequired(false);
        } else if (hasRemoteBackup) {
          // Perfectly synced and backed up
          setIsSetupRequired(false);
          setIsRecoveryRequired(false);
        } else {
          // Key exists locally but has no backup. Prompt setup.
          setIsSetupRequired(true);
          setIsRecoveryRequired(false);
        }
      } else {
        // No valid local key
        if (!profilePublicKey) {
          // 1. New user (no public key on profiles)
          await generateNewKeyPairAndSave(user.id);
          setIsSetupRequired(true);
          setIsRecoveryRequired(false);
        } else {
          // 2. Existing user (public key exists on profiles)
          if (hasRemoteBackup) {
            // Backup exists! Prompt recovery.
            setBackupSalt(backupData.salt);
            setEncryptedPrivateKey(backupData.encrypted_private_key);
            setIsSetupRequired(false);
            setIsRecoveryRequired(true);
          } else {
            // Public key exists on profiles, but no local key and no backup.
            // Private key is unrecoverable, we must generate fresh.
            console.warn("E2EE key is unrecoverable. Generating fresh key pair.");
            await generateNewKeyPairAndSave(user.id);
            setIsSetupRequired(true);
            setIsRecoveryRequired(false);
          }
        }
      }
    } catch (err) {
      console.error("Error checking E2EE backup status:", err);
    } finally {
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

      const { encryptedKey, salt } = await encryptPrivateKeyWithPin(localPrivateKeyStr, pin);

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

      setIsSetupRequired(false);
      toast.success("E2EE key backup created successfully!");
    } catch (err) {
      console.error("Failed to setup E2EE key backup:", err);
      toast.error("Failed to create backup. Please try again.");
      throw err;
    }
  };

  const recoverBackup = async (pin: string): Promise<boolean> => {
    if (!user || !encryptedPrivateKey || !backupSalt) {
      toast.error("Recovery details are missing");
      return false;
    }

    try {
      const decryptedKeyStr = await decryptPrivateKeyWithPin(encryptedPrivateKey, pin, backupSalt);
      
      // Verify the decrypted key can be imported
      await importPrivateKey(decryptedKeyStr);

      await setLocalPrivateKey(user.id, decryptedKeyStr);
      await syncPrivateKeyToNative(user.id, decryptedKeyStr);

      setIsRecoveryRequired(false);
      toast.success("E2EE secure chats restored successfully!");
      return true;
    } catch (err) {
      console.error("Failed to recover E2EE backup:", err);
      toast.error("Incorrect PIN. Please try again.");
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

  // Fire when the session access_token changes, not just user.id.
  // This is critical: if we fire on user.id alone, the Supabase client may not yet
  // have the JWT applied, causing key_backups/profiles queries to 401 silently,
  // which swallows the result and means the PIN modal never shows.
  useEffect(() => {
    if (user && session?.access_token) {
      // Ensure the realtime auth is up to date before querying
      supabase.realtime.setAuth(session.access_token);
      checkBackupStatus();
    } else if (!user) {
      setIsChecking(false);
      checkingRef.current = false;
      setIsSetupRequired(false);
      setIsRecoveryRequired(false);
    }
  }, [user?.id, session?.access_token]);

  return (
    <E2EEBackupContext.Provider value={{
      isChecking,
      isSetupRequired,
      isRecoveryRequired,
      backupSalt,
      encryptedPrivateKey,
      checkBackupStatus,
      setupBackup,
      recoverBackup,
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
