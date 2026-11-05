import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '../common/Icon';
import { useUserSettings } from '../../hooks/useUserSettings';
import { getSupabaseClient } from '@cinecraft/api';
import {
  generateUserKeyPair,
  exportPublicKey,
  exportPrivateKey,
  decryptPrivateKeyWithPin,
  encryptPrivateKeyWithPinVault,
  decryptPrivateKeyWithPinVault,
  isVaultBackup,
  createPinVault,
  describePinVaultError,
  importPrivateKey
} from '@cinecraft/e2ee';
import { NativeSecureKeyStore } from '../../services/mobileStorage';
import { notifyKeyChanged } from '../../services/e2eeKeyEvents';

const TextInputCast = TextInput as any;
const PIN_INDEXES = [0, 1, 2, 3, 4, 5];

interface PinBoxProps {
  index: number;
  char: string;
  active: boolean;
  reveal: boolean;
  confirm: boolean;
  borderColor: string;
  bgColor: string;
  textColor: string;
  filledBorder: string;
  filledBg: string;
}

// One display-only digit box. Memoised on primitives: typing a digit re-renders only the box that changed.
const PinBox = memo(function PinBox({ index, char, active, reveal, confirm, borderColor, bgColor, textColor, filledBorder, filledBg }: PinBoxProps) {
  return (
    <View
      pointerEvents="none"
      accessible
      accessibilityLabel={confirm ? `Confirm PIN digit ${index + 1} of 6` : `PIN digit ${index + 1} of 6`}
      accessibilityValue={{ text: char ? 'filled' : 'empty' }}
      style={[
        styles.otpBox,
        { borderColor: char || active ? filledBorder : borderColor, backgroundColor: char ? filledBg : bgColor },
      ]}
    >
      <Text style={[styles.otpChar, { color: textColor, fontFamily: 'WorkSans-Regular' }]}>{char ? (reveal ? char : '•') : ''}</Text>
    </View>
  );
});

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
  const { themeColors, isDark } = useUserSettings();
  // The digits live here as two plain strings (never lifted to a parent). One hidden input types into them.
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [setupStep, setSetupStep] = useState<'enter' | 'confirm'>('enter');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutTimer, setLockoutTimer] = useState(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetInput, setResetInput] = useState('');

  const inputRef = useRef<TextInput | null>(null);
  const [inputFocused, setInputFocused] = useState(false);

  useEffect(() => {
    setPin('');
    setConfirmPin('');
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

  // Typing, backspace, paste and autofill all arrive here as one string: just keep the digits, nothing else runs.
  const isConfirmStep = setupStep === 'confirm';
  const handlePinText = useCallback((val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 6);
    if (isConfirmStep) setConfirmPin(digits);
    else setPin(digits);
  }, [isConfirmStep]);

  const pinString = isConfirmStep ? confirmPin : pin;

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
        setTimeout(() => inputRef.current?.focus(), 100);
        return;
      }

      // Confirm step
      const enteredPin = pin;
      const confirmedPin = confirmPin;
      if (enteredPin !== confirmedPin) {
        setErrorMsg('PINs do not match. Please re-enter.');
        setConfirmPin('');
        setSetupStep('enter');
        setPin('');
        setTimeout(() => inputRef.current?.focus(), 100);
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
        // The backup key needs the PIN and a secret held by the server (key-vault): a copy of the database alone cannot be
        // used to guess PINs.
        const { encryptedKey, salt } = await encryptPrivateKeyWithPinVault(privateKeyStr, enteredPin, createPinVault(supabase as any));

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
        setErrorMsg(describePinVaultError(err) || err?.message || 'Could not save recovery PIN.');
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
        let decryptedKeyStr: string;
        if (isVaultBackup(backupData.salt)) {
          decryptedKeyStr = await decryptPrivateKeyWithPinVault(
            backupData.encrypted_private_key,
            pinString,
            backupData.salt,
            createPinVault(supabase as any)
          );
        } else {
          decryptedKeyStr = await decryptPrivateKeyWithPin(
            backupData.encrypted_private_key,
            pinString,
            backupData.salt
          );
          // An older backup (PIN only). It opened, so upgrade it to the key-vault version right away.
          try {
            const upgraded = await encryptPrivateKeyWithPinVault(decryptedKeyStr, pinString, createPinVault(supabase as any));
            await (supabase.from as any)('key_backups').upsert({
              user_id: user.id,
              encrypted_private_key: upgraded.encryptedKey,
              salt: upgraded.salt,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });
          } catch (upgradeErr) {
            console.warn('[E2EE Modal] could not upgrade the PIN backup yet:', upgradeErr);
          }
        }

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
        const vaultMsg = describePinVaultError(err);
        if (vaultMsg) {
          // The server counts the tries (10 wrong = 1 hour pause), so show its message instead of a local counter.
          setErrorMsg(vaultMsg);
          return;
        }
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


  const [showDigits, setShowDigits] = useState(false);
  const insets = useSafeAreaInsets();
  const fontBold = { fontFamily: 'Lora-Bold' } as const;
  const fontBody = { fontFamily: 'WorkSans-Regular' } as const;

  const focusFirst = () => setTimeout(() => inputRef.current?.focus(), 350);
  // error / "Forgot PIN" red that stays >= 4.5:1 on both the light and dark screen
  const errorColor = isDark ? themeColors.danger : '#B91C1C';

  const title = showResetConfirm
    ? 'Reset E2EE Keystore'
    : mode === 'setup'
    ? setupStep === 'enter'
      ? 'Set 6-Digit Recovery PIN'
      : 'Confirm Recovery PIN'
    : 'E2EE Keystore Recovery';

  const subtitle = showResetConfirm
    ? 'This permanently wipes your remote key backup and creates a new identity. Older encrypted messages will not be readable. Type "RESET" below to confirm.'
    : mode === 'setup'
    ? setupStep === 'enter'
      ? 'Protect your end-to-end encrypted direct messages and projectspaces across devices.'
      : 'Re-enter the 6 digits to verify your security PIN.'
    : 'Enter your 6-digit recovery PIN to unlock your end-to-end encrypted chats and call history.';

  const handleBack = () => {
    if (showResetConfirm) {
      setShowResetConfirm(false);
      setErrorMsg(null);
      focusFirst();
    } else {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={handleBack}
      onShow={focusFirst}
    >
      <View
        style={[styles.screen, { backgroundColor: themeColors.bgScreen, paddingTop: insets.top, paddingBottom: insets.bottom }]}
        accessibilityViewIsModal
      >
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />
        {/* same bar as the other stack screens (components/Header.tsx): 52 high, card colour, line under it, back arrow + left title */}
        <View style={[styles.headerRow, { backgroundColor: themeColors.bgCard, borderBottomColor: themeColors.border }]}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel={showResetConfirm ? 'Back to PIN' : 'Close'}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="arrow-left" size={20} color={themeColors.textPrimary} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, fontBold, { color: themeColors.textPrimary }]} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.iconCircle, { backgroundColor: themeColors.primarySoft }]}>
              <Icon name={showResetConfirm ? 'shield' : 'lock'} size={36} color={showResetConfirm ? themeColors.danger : themeColors.primary} />
            </View>

            <Text style={[styles.subtitle, fontBody, { color: themeColors.textSecondary }]}>{subtitle}</Text>

            {!showResetConfirm ? (
              <>
                <View style={[styles.otpRow, lockoutTimer > 0 ? styles.otpBoxDisabled : undefined]}>
                  {PIN_INDEXES.map((i) => (
                    <PinBox
                      key={i}
                      index={i}
                      char={pinString[i] || ''}
                      active={inputFocused && i === Math.min(pinString.length, 5)}
                      reveal={showDigits}
                      confirm={isConfirmStep}
                      borderColor={themeColors.border}
                      bgColor={themeColors.inputBg}
                      textColor={themeColors.textPrimary}
                      filledBorder={themeColors.primary}
                      filledBg={themeColors.primarySoft}
                    />
                  ))}
                  {/* One real input sits invisibly over the six boxes: tap, type, delete, paste and autofill all go through it */}
                  <TextInputCast
                    ref={inputRef}
                    style={styles.hiddenInput}
                    value={pinString}
                    onChangeText={handlePinText}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={lockoutTimer === 0 && !loading}
                    caretHidden
                    contextMenuHidden
                    autoCorrect={false}
                    autoComplete="off"
                    importantForAutofill="no"
                    blurOnSubmit={false}
                    textContentType="oneTimeCode"
                    underlineColorAndroid="transparent"
                    accessibilityLabel={isConfirmStep ? 'Confirm recovery PIN, 6 digits' : 'Recovery PIN, 6 digits'}
                  />
                </View>

                <TouchableOpacity
                  onPress={() => setShowDigits((v) => !v)}
                  style={styles.showToggle}
                  accessibilityRole="button"
                  accessibilityLabel={showDigits ? 'Hide PIN digits' : 'Show PIN digits'}
                >
                  <Icon name={showDigits ? 'eye-off' : 'eye'} size={16} color={themeColors.textMuted} />
                  <Text style={[styles.linkText, fontBody, { color: themeColors.textMuted }]}>{showDigits ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TextInput
                style={[styles.resetInput, { borderColor: errorColor, color: themeColors.textPrimary, backgroundColor: themeColors.inputBg }]}
                placeholder="Type RESET"
                accessibilityLabel="Type RESET to confirm"
                placeholderTextColor={themeColors.textMuted}
                value={resetInput}
                onChangeText={setResetInput}
                autoCapitalize="characters"
                autoCorrect={false}
              />
            )}

            {errorMsg ? (
              <View style={[styles.errorBanner, { backgroundColor: themeColors.danger + '1A', borderColor: themeColors.danger + '66' }]}>
                <Text style={[styles.errorText, fontBody, { color: errorColor }]} accessibilityLiveRegion="polite">{errorMsg}</Text>
              </View>
            ) : null}

            {!showResetConfirm ? (
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: themeColors.primary }, (pinString.length < 6 || loading || lockoutTimer > 0) && styles.btnDisabled]}
                onPress={handleSubmit}
                disabled={pinString.length < 6 || loading || lockoutTimer > 0}
                accessibilityRole="button"
              >
                {loading ? (
                  <ActivityIndicator color={themeColors.onPrimary} />
                ) : (
                  <Text style={[styles.primaryBtnText, { color: themeColors.onPrimary }]}>
                    {mode === 'setup' ? (setupStep === 'enter' ? 'Next' : 'Save PIN') : 'Unlock'}
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: themeColors.danger }, (resetInput.trim().toUpperCase() !== 'RESET' || loading) && styles.btnDisabled]}
                onPress={handleResetKeystore}
                disabled={resetInput.trim().toUpperCase() !== 'RESET' || loading}
                accessibilityRole="button"
              >
                {loading ? (
                  <ActivityIndicator color={themeColors.onPrimary} />
                ) : (
                  <Text style={[styles.primaryBtnText, { color: themeColors.onPrimary }]}>Permanently Reset Keys</Text>
                )}
              </TouchableOpacity>
            )}

            <View style={styles.linksRow}>
              {!showResetConfirm && mode === 'recovery' && (
                <TouchableOpacity onPress={() => { setShowResetConfirm(true); setErrorMsg(null); }} style={styles.linkBtn} accessibilityRole="button">
                  <Text style={[styles.linkText, fontBody, { color: errorColor }]}>Forgot PIN?</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleBack} style={styles.linkBtn} accessibilityRole="button">
                <Text style={[styles.linkText, fontBody, { color: themeColors.textMuted }]}>
                  {showResetConfirm ? 'Back to PIN' : 'Maybe later'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerRow: { height: 52, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  closeBtn: { width: 30, height: 30, marginRight: 8, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  hiddenInput: { ...StyleSheet.absoluteFillObject, color: 'transparent', backgroundColor: 'transparent', opacity: 0.02, fontSize: 1 },
  otpChar: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  content: { flexGrow: 1, alignItems: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 },
  iconCircle: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 28, maxWidth: 360 },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, width: '100%', maxWidth: 380 },
  otpBox: {
    flex: 1,
    maxWidth: 52,
    height: 52,
    borderWidth: 1.5,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpBoxDisabled: { opacity: 0.4 },
  showToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 12 },
  errorBanner: { borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginTop: 8, marginBottom: 8, width: '100%', maxWidth: 380 },
  errorText: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  primaryBtn: { width: '100%', maxWidth: 380, minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  btnDisabled: { opacity: 0.5 },
  primaryBtnText: { fontSize: 16, fontWeight: '700' },
  linksRow: { alignItems: 'center', marginTop: 12, gap: 4 },
  linkBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  linkText: { fontSize: 14, fontWeight: '600' },
  resetInput: { width: '100%', maxWidth: 380, height: 52, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 12, fontSize: 18, fontWeight: '700', textAlign: 'center' },
});

export default E2EERecoveryPinModal;
