import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { getSupabaseClient } from '@cinecraft/api';
import { Icon } from '../../components/common/Icon';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useUsernameCheck } from '../../hooks/useUsernameCheck';
import { sanitizeUsername, USERNAME_MAX, USERNAME_STATUS_TEXT, friendlyError } from '@cinecraft/core';
import { TabletColumn } from '../../components/common/TabletContainer';
import { saveCache, getCache } from '../../services/offlineCache';
import { loadSavedAccounts, persistSavedAccounts } from '../../services/accountManager';

const CRAFT_OPTIONS = [
  'Director', 'Producer', 'Actor', 'Cinematographer', 'Editor', 'Writer',
  'Sound Designer', 'Production Designer', 'Costume Designer', 'Makeup Artist',
  'VFX Artist', 'Composer', 'Gaffer', 'Grip', 'Other'
];

type AccountType = 'fan' | 'creator' | 'studio';

const ViewCast = View as any;
const TouchableOpacityCast = TouchableOpacity as any;

export const CompleteProfileScreen = ({ navigation }: { navigation: any }) => {
  const { themeColors, isDark } = useUserSettings();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Form Fields
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [craft, setCraft] = useState('');
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');

  const usernameStatus = useUsernameCheck(username);
  // same rule as Edit Profile / web: 2 to 50 characters
  const trimmedName = fullName.trim();
  const nameError = trimmedName.length > 50 ? 'Name is too long' : trimmedName.length > 0 && trimmedName.length < 2 ? 'Name is too short' : '';
  const scrollRef = React.useRef<ScrollView>(null);
  const scrollToEnd = () => { setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250); };

  // sign-in with Google or Apple already gives us a name: start from it
  useEffect(() => {
    getSupabaseClient().auth.getUser().then(({ data }) => {
      const meta: any = data?.user?.user_metadata;
      const known = meta?.full_name || meta?.name;
      if (known) setFullName((prev) => prev || String(known));
    }).catch(() => {});
  }, []);

  const handleNextStep = () => {
    if (step === 0) {
      if (!accountType) {
        Alert.alert('Selection Required', 'Please select an account type to proceed.');
        return;
      }
      setStep(1);
    } else if (step === 1) {
      if (!username.trim() || !fullName.trim()) {
        Alert.alert('Required Fields', 'Please fill in your username and full name.');
        return;
      }
      if (nameError) {
        Alert.alert('Check your name', nameError);
        return;
      }
      if (usernameStatus !== 'available') {
        Alert.alert('Check your username', USERNAME_STATUS_TEXT[usernameStatus === 'idle' ? 'checking' : usernameStatus]);
        return;
      }
      setStep(2);
    }
  };

  const handleCompleteOnboarding = async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not found');

      const updateData: any = {
        username: username.toLowerCase(),
        full_name: fullName.trim(),
        onboarding_completed: true,
        account_type: accountType || 'fan',
        updated_at: new Date().toISOString(),
      };

      if (bio) updateData.bio = bio;
      if (craft) updateData.craft = craft;
      if (location) updateData.location = location;
      if (website.trim()) updateData.website = /^https?:\/\//i.test(website.trim()) ? website.trim() : `https://${website.trim()}`;

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) {
        // someone took the username while this form was open: send them back to pick another
        if ((error as any).code === '23505' || /duplicate|unique/i.test(error.message)) {
          setStep(1);
          Alert.alert('Username just taken', 'Someone else claimed it a moment ago. Please choose another.');
          return;
        }
        throw error;
      }

      if (phone) {
        const { error: phoneError } = await (supabase as any).from('profile_private').upsert(
          { user_id: user.id, phone, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );
        if (phoneError) console.warn('[CompleteProfile] phone save failed:', phoneError.message);
      }

      // Refresh the cached profile and the saved-account entry NOW, so closing the app right after this can never bring
      // the old "onboarding unfinished" copy back (and a stale copy can never say finished before this point).
      try {
        const cacheKey = `profile_${user.id}`;
        const existing = (await getCache<any>(cacheKey)) || { id: user.id };
        await saveCache(cacheKey, {
          ...existing,
          username: updateData.username,
          full_name: updateData.full_name,
          account_type: updateData.account_type,
          onboarding_completed: true,
        });
        const accounts = await loadSavedAccounts();
        if (accounts.some((a) => a.userId === user.id)) {
          await persistSavedAccounts(accounts.map((a) => a.userId === user.id
            ? { ...a, username: updateData.username, fullName: updateData.full_name, accountType: updateData.account_type, onboardingCompleted: true }
            : a));
        }
      } catch (cacheErr) {
        console.warn('[CompleteProfile] cache refresh failed:', cacheErr);
      }

      Alert.alert('Success', 'Profile completed successfully!', [
        {
          text: 'Get Started',
          onPress: () => {
            navigation.reset({
              index: 0,
              routes: [{ name: 'MainTabs' }],
            });
          },
        },
      ]);
    } catch (e: any) {
      Alert.alert('Error', friendlyError(e, 'Failed to complete profile onboarding.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.bgScreen }]}>
      <TabletColumn maxWidth={560}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false}>
          
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: themeColors.textPrimary }]}>Complete Your Profile</Text>
            <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>Step {step + 1} of 3</Text>
            
            {/* Progress Bar */}
            <View style={styles.progressBar}>
              {[0, 1, 2].map((s) => (
                <ViewCast
                  key={s}
                  style={[
                    styles.progressDot,
                    { backgroundColor: themeColors.border },
                    s <= step ? styles.progressDotActive : undefined,
                  ] as any}
                />
              ))}
            </View>
          </View>

          {/* Step Contents */}
          <View style={[styles.card, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
            {step === 0 && (
              <View style={styles.stepContainer}>
                <Text style={[styles.stepTitle, { color: themeColors.textPrimary }]}>How will you use CineCraft?</Text>
                <Text style={[styles.stepSubtitle, { color: themeColors.textSecondary }]}>Choose your account type — you can switch it later in Settings.</Text>

                <View style={styles.typeOptions}>
                  {/* Fan Account */}
                  <TouchableOpacity
                    style={[
                      styles.typeBtn,
                      { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
                      accountType === 'fan' ? [styles.typeBtnActive, { backgroundColor: isDark ? 'rgba(255, 75, 51, 0.15)' : '#FFF1F0' }] : undefined,
                    ] as any}
                    onPress={() => setAccountType('fan')}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: accountType === 'fan' }}
                    accessibilityLabel="Fan account"
                  >
                    <View style={[
                      styles.iconCircle,
                      { backgroundColor: themeColors.chipBg },
                      accountType === 'fan' ? styles.iconCircleActive : undefined,
                    ] as any}>
                      <Icon name="star" size={24} color={accountType === 'fan' ? '#FFFFFF' : themeColors.textSecondary} />
                    </View>
                    <Text style={[styles.typeText, { color: themeColors.textPrimary }]}>Fan</Text>
                    <Text style={[styles.typeDesc, { color: themeColors.textSecondary }]}>Rate films, follow creators, and support projects.</Text>
                  </TouchableOpacity>

                  {/* Creator Account */}
                  <TouchableOpacity
                    style={[
                      styles.typeBtn,
                      { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
                      accountType === 'creator' ? [styles.typeBtnActive, { backgroundColor: isDark ? 'rgba(255, 75, 51, 0.15)' : '#FFF1F0' }] : undefined,
                    ] as any}
                    onPress={() => setAccountType('creator')}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: accountType === 'creator' }}
                    accessibilityLabel="Creator account"
                  >
                    <View style={[
                      styles.iconCircle,
                      { backgroundColor: themeColors.chipBg },
                      accountType === 'creator' ? styles.iconCircleActive : undefined,
                    ] as any}>
                      <Icon name="film" size={24} color={accountType === 'creator' ? '#FFFFFF' : themeColors.textSecondary} />
                    </View>
                    <Text style={[styles.typeText, { color: themeColors.textPrimary }]}>Creator</Text>
                    <Text style={[styles.typeDesc, { color: themeColors.textSecondary }]}>Showcase portfolio, apply for jobs, and connect.</Text>
                  </TouchableOpacity>

                  {/* Studio Account */}
                  <TouchableOpacity
                    style={[
                      styles.typeBtn,
                      { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
                      accountType === 'studio' ? [styles.typeBtnActive, { backgroundColor: isDark ? 'rgba(255, 75, 51, 0.15)' : '#FFF1F0' }] : undefined,
                    ] as any}
                    onPress={() => setAccountType('studio')}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: accountType === 'studio' }}
                    accessibilityLabel="Studio or team account"
                  >
                    <View style={[
                      styles.iconCircle,
                      { backgroundColor: themeColors.chipBg },
                      accountType === 'studio' ? styles.iconCircleActive : undefined,
                    ] as any}>
                      <Icon name="users" size={24} color={accountType === 'studio' ? '#FFFFFF' : themeColors.textSecondary} />
                    </View>
                    <Text style={[styles.typeText, { color: themeColors.textPrimary }]}>Studio / Team</Text>
                    <Text style={[styles.typeDesc, { color: themeColors.textSecondary }]}>Post job vacancies, fund pitches, and hire crew.</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {step === 1 && (
              <View style={styles.stepContainer}>
                <Text style={[styles.stepTitle, { color: themeColors.textPrimary }]}>{accountType === 'studio' ? 'Basic Studio Details' : accountType === 'fan' ? 'Basic Details' : 'Basic Creator Details'}</Text>
                <Text style={[styles.stepSubtitle, { color: themeColors.textSecondary }]}>Set up your username and display name.</Text>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: themeColors.textPrimary }]}>Display Name *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                    placeholder="John Doe"
                    placeholderTextColor={themeColors.textMuted}
                    value={fullName}
                    onChangeText={setFullName}
                    maxLength={60}
                    onFocus={scrollToEnd}
                  />
                  {nameError ? <Text style={[styles.helperText, { color: '#DC2626' }]}>{nameError}</Text> : null}
                </View>

                <View style={styles.formGroup}>
                  <View style={styles.labelRow}>
                    <Text style={[styles.label, { color: themeColors.textPrimary }]}>Username *</Text>
                    {usernameStatus === 'checking' && <ActivityIndicator size="small" color="#FF4B33" />}
                  </View>
                  <TextInput
                    style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                    placeholder="johndoe"
                    placeholderTextColor={themeColors.textMuted}
                    value={username}
                    onChangeText={(val) => setUsername(sanitizeUsername(val))}
                    maxLength={USERNAME_MAX}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="username"
                    textContentType="username"
                  />
                  <Text
                    accessibilityLiveRegion="polite"
                    style={[
                      styles.helperText,
                      { color: usernameStatus === 'available' ? '#16A34A' : usernameStatus === 'taken' || usernameStatus === 'reserved' || usernameStatus === 'error' ? '#DC2626' : themeColors.textMuted },
                      { minHeight: 18 },
                    ]}
                  >
                    {usernameStatus === 'available' ? '✓ ' : usernameStatus === 'taken' || usernameStatus === 'reserved' ? '✗ ' : ''}
                    {usernameStatus === 'idle' && username.length === 0 ? USERNAME_STATUS_TEXT.idle : usernameStatus === 'idle' ? '' : USERNAME_STATUS_TEXT[usernameStatus]}
                  </Text>
                </View>
              </View>
            )}

            {step === 2 && (
              <View style={styles.stepContainer}>
                <Text style={[styles.stepTitle, { color: themeColors.textPrimary }]}>Tell Us About Yourself</Text>
                <Text style={[styles.stepSubtitle, { color: themeColors.textSecondary }]}>Add additional details to complete onboarding.</Text>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: themeColors.textPrimary }]}>Short Bio</Text>
                  <TextInput
                    style={[styles.input, styles.multilineInput, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                    placeholder="Share your film background..."
                    placeholderTextColor={themeColors.textMuted}
                    multiline
                    numberOfLines={3}
                    value={bio}
                    maxLength={300}
                    onChangeText={setBio}
                  />
                </View>

                {accountType === 'creator' && (
                  <View style={styles.formGroup}>
                    <Text style={[styles.label, { color: themeColors.textPrimary }]}>Primary Craft</Text>
                    <View style={styles.craftContainer}>
                      {CRAFT_OPTIONS.map((option) => (
                        <TouchableOpacityCast
                          key={option}
                          style={[
                            styles.craftChip,
                            { backgroundColor: themeColors.chipBg, borderColor: themeColors.border },
                            craft === option ? [styles.craftChipActive, { backgroundColor: isDark ? 'rgba(255, 75, 51, 0.15)' : '#FFF1F0' }] : undefined,
                          ] as any}
                          onPress={() => setCraft(option)}
                        >
                          <Text style={[
                            styles.craftChipText,
                            { color: themeColors.textSecondary },
                            craft === option ? styles.craftChipTextActive : undefined,
                          ] as any}>{option}</Text>
                        </TouchableOpacityCast>
                      ))}
                    </View>
                  </View>
                )}

                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: themeColors.textPrimary }]}>Location</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                    placeholder="Los Angeles, CA"
                    placeholderTextColor={themeColors.textMuted}
                    value={location}
                    onChangeText={setLocation}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: themeColors.textPrimary }]}>Website / IMDb Link</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                    placeholder="https://imdb.com"
                    placeholderTextColor={themeColors.textMuted}
                    value={website}
                    onChangeText={setWebsite}
                    autoCapitalize="none"
                    keyboardType="url"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: themeColors.textPrimary }]}>Phone Number</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                    placeholder="+1 (555) 019-2834"
                    placeholderTextColor={themeColors.textMuted}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>
            )}
          </View>

          {/* Navigation Action Buttons */}
          <View style={styles.actions}>
            {step > 0 && (
              <TouchableOpacity
                style={[styles.backBtn, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}
                onPress={() => setStep(step - 1)}
                disabled={loading}
              >
                <Text style={[styles.backBtnText, { color: themeColors.textPrimary }]}>Back</Text>
              </TouchableOpacity>
            )}

            {step < 2 ? (
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  ((step === 0 && !accountType) || (step === 1 && (!username || !fullName.trim() || !!nameError || usernameStatus !== 'available'))) && styles.primaryBtnDisabled,
                ]}
                onPress={handleNextStep}
              >
                <Text style={styles.primaryBtnText}>Next →</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleCompleteOnboarding}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryBtnText}>Complete Onboarding</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
      </TabletColumn>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 240,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    color: '#0D0D0D',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 16,
  },
  progressBar: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
  },
  progressDotActive: {
    backgroundColor: '#FF4B33',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  stepContainer: {
    width: '100%',
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0D0D0D',
    marginBottom: 4,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 24,
    textAlign: 'center',
  },
  typeOptions: {
    gap: 12,
  },
  typeBtn: {
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  typeBtnActive: {
    borderColor: '#FF4B33',
    backgroundColor: '#FFF1F0',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  iconCircleActive: {
    backgroundColor: '#FF4B33',
  },
  typeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0D0D0D',
    marginBottom: 4,
  },
  typeDesc: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 20,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 6,
  },
  availText: {
    fontSize: 12,
    color: '#16A34A',
    fontWeight: '700',
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '700',
  },
  input: {
    height: 48,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#0D0D0D',
    backgroundColor: '#FAFAFA',
  },
  multilineInput: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  craftContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  craftChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 99,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FAFAFA',
  },
  craftChipActive: {
    borderColor: '#FF4B33',
    backgroundColor: '#FFF1F0',
  },
  craftChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  craftChipTextActive: {
    color: '#FF4B33',
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#FF4B33',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  backBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    color: '#4B5563',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default CompleteProfileScreen;
