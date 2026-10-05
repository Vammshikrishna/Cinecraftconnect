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

  // Username validation state
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);

  // Debounced username checker
  useEffect(() => {
    if (username.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    if (!/^[a-z0-9_]{3,20}$/.test(username)) {
      setUsernameAvailable(false);
      return;
    }

    setCheckingUsername(true);
    const timer = setTimeout(async () => {
      try {
        const supabase = getSupabaseClient();
        const { data, error } = await supabase
          .from('profiles')
          .select('username')
          .eq('username', username.toLowerCase())
          .maybeSingle();

        if (error) throw error;
        setUsernameAvailable(!data);
      } catch (e) {
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username]);

  const handleNextStep = () => {
    if (step === 0) {
      if (!accountType) {
        Alert.alert('Selection Required', 'Please select an account type to proceed.');
        return;
      }
      setStep(1);
    } else if (step === 1) {
      if (!username || !fullName) {
        Alert.alert('Required Fields', 'Please fill in all required fields.');
        return;
      }
      if (usernameAvailable === false) {
        Alert.alert('Unavailable Username', 'Please choose an available username.');
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
        full_name: fullName,
        onboarding_completed: true,
        account_type: accountType || 'fan',
        updated_at: new Date().toISOString(),
      };

      if (bio) updateData.bio = bio;
      if (craft) updateData.craft = craft;
      if (location) updateData.location = location;
      if (website) updateData.website = website;

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;

      if (phone) {
        const { error: phoneError } = await (supabase as any).from('profile_private').upsert(
          { user_id: user.id, phone, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );
        if (phoneError) console.warn('[CompleteProfile] phone save failed:', phoneError.message);
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
      Alert.alert('Error', e.message || 'Failed to complete profile onboarding.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.bgScreen }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
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
                <Text style={[styles.stepSubtitle, { color: themeColors.textSecondary }]}>Choose your account type — you can't change this later.</Text>

                <View style={styles.typeOptions}>
                  {/* Fan Account */}
                  <TouchableOpacity
                    style={[
                      styles.typeBtn,
                      { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
                      accountType === 'fan' ? [styles.typeBtnActive, { backgroundColor: isDark ? 'rgba(255, 75, 51, 0.15)' : '#FFF1F0' }] : undefined,
                    ] as any}
                    onPress={() => setAccountType('fan')}
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
                <Text style={[styles.stepTitle, { color: themeColors.textPrimary }]}>Basic Creator Details</Text>
                <Text style={[styles.stepSubtitle, { color: themeColors.textSecondary }]}>Set up your username and display name.</Text>

                <View style={styles.formGroup}>
                  <Text style={[styles.label, { color: themeColors.textPrimary }]}>Display Name *</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                    placeholder="John Doe"
                    placeholderTextColor={themeColors.textMuted}
                    value={fullName}
                    onChangeText={setFullName}
                  />
                </View>

                <View style={styles.formGroup}>
                  <View style={styles.labelRow}>
                    <Text style={[styles.label, { color: themeColors.textPrimary }]}>Username *</Text>
                    {checkingUsername && <ActivityIndicator size="small" color="#FF4B33" />}
                    {usernameAvailable === true && (
                      <Text style={styles.availText}>✓ Available</Text>
                    )}
                    {usernameAvailable === false && (
                      <Text style={styles.errorText}>✗ Taken or invalid</Text>
                    )}
                  </View>
                  <TextInput
                    style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                    placeholder="johndoe"
                    placeholderTextColor={themeColors.textMuted}
                    value={username}
                    onChangeText={(val) => setUsername(val.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    autoCapitalize="none"
                  />
                  <Text style={[styles.helperText, { color: themeColors.textMuted }]}>3 to 20 lowercase letters, numbers, or underscores.</Text>
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
                  ((step === 0 && !accountType) || (step === 1 && (!username || !fullName || !usernameAvailable))) && styles.primaryBtnDisabled,
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
    paddingBottom: 48,
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    color: '#0D0D0D',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    color: '#6B7280',
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
    fontWeight: '800',
    color: '#0D0D0D',
    marginBottom: 4,
    textAlign: 'center',
  },
  stepSubtitle: {
    fontSize: 12,
    color: '#6B7280',
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
    fontWeight: '800',
    color: '#0D0D0D',
    marginBottom: 4,
  },
  typeDesc: {
    fontSize: 11,
    color: '#6B7280',
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
    fontSize: 10,
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
    fontWeight: '800',
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
    fontWeight: '800',
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
    fontWeight: '800',
  },
});

export default CompleteProfileScreen;
