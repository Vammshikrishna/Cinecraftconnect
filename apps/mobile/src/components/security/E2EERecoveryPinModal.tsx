import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
} from 'react-native';
import { Icon } from '../common/Icon';
import { getSupabaseClient } from '@cinecraft/api';
import {
  generateUserKeyPair,
  exportPublicKey,
  exportPrivateKey,
  encryptPrivateKeyWithPin,
  decryptPrivateKeyWithPin,
  importPrivateKey
} from '@cinecraft/e2ee';
import { NativeSecureKeyStore } from '../../services/mobileStorage';
import { notifyKeyChanged } from '../../services/e2eeKeyEvents';

const TextInputCast = TextInput as any;

interface E2EERecoveryPinModalProps {
  visible: boolean;
  mode?: 'setup' | 'recovery';
  onClose: () => void;
  onSuccess?: () => void;
}

export const E2EERecoveryPinModal: React.FC<E2EERecoveryPinModalProps> = ({
  visible,
  mode = 'recovery',
  onClose,
  onSuccess,
}) => {
  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '', '', '']);
  const [setupStep, setSetupStep] = useState<'enter' | 'confirm'>('enter');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetInput, setResetInput] = useState('');

  const inputRefs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    setPin(['', '', '', '', '', '']);
    setConfirmPin(['', '', '', '', '', '']);
    setSetupStep('enter');
    setErrorMsg(null);
    setShowResetConfirm(false);
    setResetInput('');
  }, [visible, mode]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (lockoutTimer > 0) {
      interval = setInterval(() => {
        setLockoutTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [lockoutTimer]);

  const handleDigitChange = (val: string, index: number, isConfirm = false) => {
    const current = isConfirm ? [...confirmPin] : [...pin];
    current[index] = val;

    if (isConfirm) {
      setConfirmPin(current);
    } else {
      setPin(current);
    }

    if (val && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number, isConfirm = false) => {
    if (e.nativeEvent.key === 'Backspace' && index > 0) {
      const current = isConfirm ? confirmPin : pin;
      if (!current[index]) {
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const currentDigits = setupStep === 'confirm' ? confirmPin : pin;
  const pinString = currentDigits.join('');

  const handleSubmit = async () => {
    if (lockoutTimer > 0) {
      setErrorMsg(`Too many failed attempts. Please wait ${lockoutTimer}s.`);
      return;
    }

    if (pinString.length < 6) {
      setErrorMsg('Please enter all 6 digits.');
      return;
    }

    if (mode === 'setup') {
      if (setupStep === 'enter') {
        setSetupStep('confirm');
        setErrorMsg(null);
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
        return;
      }

      // Confirm step
      const enteredPin = pin.join('');
      const confirmedPin = confirmPin.join('');
      if (enteredPin !== confirmedPin) {
        setErrorMsg('PINs do not match. Please re-enter.');
        setConfirmPin(['', '', '', '', '', '']);
        setSetupStep('enter');
        setPin(['', '', '', '', '', '']);
        return;
      }

      setLoading(true);
      setErrorMsg(null);
      try {
        const supabase = getSupabaseClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // 1. Check if user already has a locally generated key, or generate fresh
        const secureStore = new NativeSecureKeyStore();
        let privateKeyStr = await secureStore.getKey(`e2ee_private_key_${user.id}`);
        if (!privateKeyStr) {
          privateKeyStr = await secureStore.getKey(`priv_${user.id}`);
        }
        let publicKeyStr: string | null = null;
        if (!privateKeyStr) {
          const keyPair = await generateUserKeyPair();
          publicKeyStr = await exportPublicKey(keyPair.publicKey);
          privateKeyStr = await exportPrivateKey(keyPair.privateKey);
          await secureStore.setKey(`e2ee_private_key_${user.id}`, privateKeyStr);
          await secureStore.setKey(`priv_${user.id}`, privateKeyStr);
        }

        // 2. Encrypt private key with PIN
        const { encryptedKey, salt } = await encryptPrivateKeyWithPin(privateKeyStr, enteredPin);

        // 3. Ensure local keys and broadcast to all mounted screens
        notifyKeyChanged(user.id, privateKeyStr);

        // 4. Update profiles public key if we generated one
        if (publicKeyStr) {
          const { error: profileError } = await supabase
            .from('profiles')
            .update({ public_key: publicKeyStr })
            .eq('id', user.id);
          if (profileError) console.warn('[E2EE Modal] profile public key update warning:', profileError);
        }

        // 5. Upsert remote backup in key_backups table
        const { error: backupError } = await (supabase.from as any)('key_backups').upsert({
          user_id: user.id,
          encrypted_private_key: encryptedKey,
          salt: salt,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        if (backupError) throw backupError;

        Alert.alert('E2EE Keystore Secured', 'Your E2EE recovery PIN has been saved securely.');
        if (onSuccess) onSuccess();
        onClose();
      } catch (err: any) {
        setErrorMsg(err?.message || 'Could not save recovery PIN.');
      } finally {
        setLoading(false);
      }
    } else {
      // Recovery Mode
      setLoading(true);
      setErrorMsg(null);
      try {
        const supabase = getSupabaseClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) throw new Error('User not authenticated');

        // 1. Fetch remote backup from key_backups table
        const { data: backupData, error: backupError } = await (supabase.from as any)('key_backups')
          .select('encrypted_private_key, salt')
          .eq('user_id', user.id)
          .maybeSingle();

        if (backupError) throw backupError;
        if (!backupData || !backupData.encrypted_private_key || !backupData.salt) {
          throw new Error('No remote E2EE key backup found. Please reset your keystore to generate new keys.');
        }

        // 2. Decrypt private key using PIN
        const decryptedKeyStr = await decryptPrivateKeyWithPin(
          backupData.encrypted_private_key,
          pinString,
          backupData.salt
        );

        // 3. Import key check (non-fatal on Hermes if subtle has minor quirks)
        try {
          await importPrivateKey(decryptedKeyStr);
        } catch (e) {
          console.warn('Subtle import check warning:', e);
        }

        // 4. Save locally and broadcast key change
        const secureStore = new NativeSecureKeyStore();
        await secureStore.setKey(`e2ee_private_key_${user.id}`, decryptedKeyStr);
        await secureStore.setKey(`priv_${user.id}`, decryptedKeyStr);
        notifyKeyChanged(user.id, decryptedKeyStr);

        setFailedAttempts(0);
        Alert.alert('Keys Restored', 'Your E2EE secure chats have been successfully restored.');
        if (onSuccess) onSuccess();
        onClose();
      } catch (err: any) {
        console.error('Recovery error:', err);
        const next = failedAttempts + 1;
        setFailedAttempts(next);
        const errMsg = (err?.message || '').toString();
        if (errMsg.includes('Unsupported state') || errMsg.includes('authenticate') || errMsg.includes('decrypt')) {
          if (next >= 5) {
            setLockoutTimer(30);
            setErrorMsg('Too many incorrect attempts (5/5). Locked out for 30s.');
          } else {
            setErrorMsg(`Incorrect PIN. (${next}/5 attempts)`);
          }
        } else {
          setErrorMsg(errMsg || `Incorrect PIN. (${next}/5 attempts)`);
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const handleResetKeystore = async () => {
    if (resetInput.trim().toUpperCase() !== 'RESET') {
      setErrorMsg('Please type "RESET" to confirm.');
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        // 1. Delete remote backup
        await (supabase.from as any)('key_backups').delete().eq('user_id', user.id);
        // 2. Delete own group keys
        await (supabase.from as any)('group_keys').delete().eq('user_id', user.id);

        // 3. Generate a new key pair
        const keyPair = await generateUserKeyPair();
        const publicKeyStr = await exportPublicKey(keyPair.publicKey);
        const privateKeyStr = await exportPrivateKey(keyPair.privateKey);
        
        // 4. Save locally and broadcast key change
        const secureStore = new NativeSecureKeyStore();
        await secureStore.setKey(`e2ee_private_key_${user.id}`, privateKeyStr);
        await secureStore.setKey(`priv_${user.id}`, privateKeyStr);
        notifyKeyChanged(user.id, privateKeyStr);

        // 5. Update profiles public key
        await supabase.from('profiles').update({ public_key: publicKeyStr }).eq('id', user.id);
      }
      Alert.alert('Keystore Reset', 'Previous keys wiped and new identity generated. You must set up a new recovery PIN now.');
      setShowResetConfirm(false);
      onClose();
      if (onSuccess) onSuccess();
    } catch (e: any) {
      setErrorMsg('Failed to reset keystore.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            {/* Top Shield Header */}
            <View style={styles.iconCircle}>
              <Icon name="lock" size={24} color="#FF4B33" />
            </View>

            <Text style={styles.modalTitle}>
              {showResetConfirm
                ? 'Reset E2EE Keystore'
                : mode === 'setup'
                ? setupStep === 'enter'
                  ? 'Set 6-Digit Recovery PIN'
                  : 'Confirm Recovery PIN'
                : 'E2EE Keystore Recovery'}
            </Text>

            <Text style={styles.modalSubtitle}>
              {showResetConfirm
                ? 'This will wipe your current remote backup. Type "RESET" below to confirm.'
                : mode === 'setup'
                ? setupStep === 'enter'
                  ? 'Protect your end-to-end encrypted direct messages and projectspaces across devices.'
                  : 'Re-enter the 6 digits to verify your security PIN.'
                : 'Enter your 6-digit recovery PIN to unlock your end-to-end encrypted chats and call history.'}
            </Text>

            {errorMsg && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            )}

            {!showResetConfirm ? (
              <>
                {/* 6 Digit Inputs */}
                <View style={styles.otpRow}>
                  {currentDigits.map((digit, i) => (
                    <TextInputCast
                      key={i}
                      ref={(el: any) => (inputRefs.current[i] = el)}
                      style={[
                        styles.otpBox,
                        digit ? styles.otpBoxFilled : undefined,
                        lockoutTimer > 0 ? styles.otpBoxDisabled : undefined,
                      ] as any}
                      keyboardType="number-pad"
                      maxLength={1}
                      value={digit}
                      onChangeText={(val: string) =>
                        handleDigitChange(val, i, setupStep === 'confirm')
                      }
                      onKeyPress={(e: any) => handleKeyPress(e, i, setupStep === 'confirm')}
                      editable={lockoutTimer === 0 && !loading}
                      secureTextEntry
                    />
                  ))}
                </View>

                {/* Submit Action */}
                <TouchableOpacity
                  style={[styles.submitBtn, (pinString.length < 6 || loading) && styles.submitBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={pinString.length < 6 || loading || lockoutTimer > 0}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.submitBtnText}>
                      {mode === 'setup'
                        ? setupStep === 'enter'
                          ? 'Next →'
                          : 'Save Keystore PIN'
                        : 'Unlock E2EE Messages'}
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Reset or Dismiss */}
                <View style={styles.actionRow}>
                  {mode === 'recovery' && (
                    <TouchableOpacity
                      onPress={() => setShowResetConfirm(true)}
                      style={styles.forgotBtn}
                    >
                      <Text style={styles.forgotBtnText}>Forgot PIN? Reset Keystore</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity onPress={onClose} style={styles.dismissBtn}>
                    <Text style={styles.dismissBtnText}>Maybe Later</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              /* Reset Confirmation View */
              <View style={styles.resetContainer}>
                <TextInput
                  style={styles.resetInput}
                  placeholder="Type RESET"
                  placeholderTextColor="#9CA3AF"
                  value={resetInput}
                  onChangeText={setResetInput}
                  autoCapitalize="characters"
                />

                <TouchableOpacity
                  style={[styles.dangerBtn, resetInput.trim() !== 'RESET' && styles.dangerBtnDisabled]}
                  onPress={handleResetKeystore}
                  disabled={resetInput.trim() !== 'RESET' || loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.dangerBtnText}>Permanently Reset Keys</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setShowResetConfirm(false)}
                  style={styles.dismissBtn}
                >
                  <Text style={styles.dismissBtnText}>← Back to PIN</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 75, 51, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    color: '#0D0D0D',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 6,
  },
  modalSubtitle: {
    color: '#6B7280',
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 11.5,
    fontWeight: '700',
    textAlign: 'center',
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
    gap: 6,
  },
  otpBox: {
    flex: 1,
    height: 48,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
    color: '#0D0D0D',
    backgroundColor: '#FAFAFA',
  },
  otpBoxFilled: {
    borderColor: '#FF4B33',
    backgroundColor: '#FFF1F0',
  },
  otpBoxDisabled: {
    opacity: 0.4,
  },
  submitBtn: {
    backgroundColor: '#FF4B33',
    width: '100%',
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 14,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  actionRow: {
    alignItems: 'center',
    gap: 10,
  },
  forgotBtn: {
    paddingVertical: 4,
  },
  forgotBtnText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  dismissBtn: {
    paddingVertical: 6,
  },
  dismissBtnText: {
    color: '#9CA3AF',
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  resetContainer: {
    width: '100%',
    alignItems: 'center',
  },
  resetInput: {
    width: '100%',
    height: 44,
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: '800',
    color: '#0D0D0D',
    textAlign: 'center',
    marginBottom: 14,
  },
  dangerBtn: {
    backgroundColor: '#EF4444',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  dangerBtnDisabled: {
    opacity: 0.4,
  },
  dangerBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
});

export default E2EERecoveryPinModal;
