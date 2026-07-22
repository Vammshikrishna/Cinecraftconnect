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

  const checkBackupStatus = async (retryCount = 0) => {
    console.log(`🔐 [E2EE Context] checkBackupStatus called (attempt ${retryCount + 1}) for user ${user?.id}`);
    if (!user) {
      console.log("🔐 [E2EE Context] No user active, skipping status check.");
      setIsChecking(false);
      setIsSetupRequired(false);
      setIsRecoveryRequired(false);
      return;
    }

    // Don't re-run if already running or if we've already checked with this exact token
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
      console.log("🔐 [E2EE Context] Checking local private key...");
      const localPrivateKeyStr = await getLocalPrivateKey(user.id);

      // Verify local private key is valid if present
      let hasValidLocalKey = false;
      if (localPrivateKeyStr) {
        try {
          await importPrivateKey(localPrivateKeyStr);
          hasValidLocalKey = true;
          console.log("🔐 [E2EE Context] Valid local private key exists.");
          // Sync to native secure store
          await syncPrivateKeyToNative(user.id, localPrivateKeyStr);
        } catch (e) {
          console.error("🔐 [E2EE Context] Local private key is corrupted, treating as missing:", e);
        }
      } else {
        console.log("🔐 [E2EE Context] No local private key found.");
      }

      console.log("🔐 [E2EE Context] Fetching key backup and profile from database...");
      
      // Create a dedicated client instance with the explicit Authorization header
      // to completely eliminate any race condition with the global client's token storage.
      const { createClient } = await import('@supabase/supabase-js');
      const authClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        {
          global: {
            headers: {
              Authorization: `Bearer ${session?.access_token}`
            }
          }
        }
      );

      // Fetch both remote backup and the profile public key from Supabase in parallel
      const [backupResult, profileResult] = await Promise.all([
        authClient
          .from('key_backups')
          .select('encrypted_private_key, salt')
          .eq('user_id', user.id)
          .maybeSingle(),
        authClient
          .from('profiles')
          .select('public_key')
          .eq('id', user.id)
          .maybeSingle()
      ]);

      if (backupResult.error) {
        throw new Error(`Failed to fetch key backup: ${backupResult.error.message}`);
      }
      if (profileResult.error) {
        throw new Error(`Failed to fetch profile public key: ${profileResult.error.message}`);
      }

      const backupData = backupResult.data;
      const profileData = profileResult.data;
      const hasRemoteBackup = !!backupData?.encrypted_private_key;
      const profilePublicKey = profileData?.public_key;
      const hasVerifiedSessionPIN = sessionStorage.getItem(`e2ee_pin_verified_${user.id}`) === 'true';

      console.log(`🔐 [E2EE Context] DB results: hasRemoteBackup=${hasRemoteBackup}, profilePublicKeyExists=${!!profilePublicKey}, verifiedInSession=${hasVerifiedSessionPIN}`);

      if (hasRemoteBackup) {
        setBackupSalt(backupData.salt);
        setEncryptedPrivateKey(backupData.encrypted_private_key);

        if (!hasVerifiedSessionPIN) {
          console.log("🔐 [E2EE Context] Remote backup exists. Prompting PIN verification/recovery for login session.");
          setIsSetupRequired(false);
          setIsRecoveryRequired(true);
        } else {
          console.log("🔐 [E2EE Context] PIN verified for active session. Access granted.");
          setIsSetupRequired(false);
          setIsRecoveryRequired(false);
        }
      } else {
        // No remote backup exists yet
        if (hasValidLocalKey && profilePublicKey) {
          console.log("🔐 [E2EE Context] Local key exists but no backup. Prompting backup setup.");
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
      console.error(`🔐 [E2EE Context] Error checking E2EE backup status (attempt ${retryCount + 1}):`, err);
      if (retryCount < 3) {
        const retryDelay = (retryCount + 1) * 1500;
        console.log(`🔐 [E2EE Context] Scheduling retry in ${retryDelay}ms...`);
        setTimeout(() => {
          checkBackupStatus(retryCount + 1);
        }, retryDelay);
      } else {
        console.error("🔐 [E2EE Context] All E2EE backup checks failed. Stopping checking state.");
        setIsChecking(false);
        checkingRef.current = false;
      }
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

      sessionStorage.setItem(`e2ee_pin_verified_${user.id}`, 'true');
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

      sessionStorage.setItem(`e2ee_pin_verified_${user.id}`, 'true');
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
      lastCheckedTokenRef.current = null;
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
