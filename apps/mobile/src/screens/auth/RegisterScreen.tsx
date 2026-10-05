import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { getSupabaseClient } from '@cinecraft/api';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { AppLogo } from '../../components/common/AppLogo';
import { Icon } from '../../components/common/Icon';
import { TabletContainer } from '../../components/common/TabletContainer';
import { E2EERecoveryPinModal } from '../../components/security/E2EERecoveryPinModal';
import { useUserSettings } from '../../hooks/useUserSettings';
import { ENV } from '../../config/env';

// Configure Native Google Sign-In with Web Client ID
GoogleSignin.configure({
  webClientId: ENV.GOOGLE_WEB_CLIENT_ID,
});

const CREAM = '#F8F5F0';
const INK = '#0D0D0D';
const ORANGE = '#f97316';

const GoogleSvg = () => (
  <Svg width={18} height={18} viewBox="0 0 48 48">
    <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </Svg>
);

const AppleSvg = () => (
  <Svg width={18} height={18} viewBox="0 0 384 512">
    <Path fill="#FFFFFF" d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.1-44.6-35.9-2.8-74.3 22.7-93.1 22.7-18.9 0-50-22.3-80.1-21.7-41.1 .5-79.6 24-100.8 61.2-43.2 76.5-11 189.6 30.6 249.7 20.6 29.5 45.4 62.7 77.2 61.7 30.6-1 41.7-19.6 78.4-19.6 36.6 0 46.7 19.6 78.9 19 33.3-.6 54.4-30.8 74.8-60.6 23.9-35.1 33.7-69.1 34.3-70.9-1-1-66-24.8-66.1-112.5zM263.8 89.2c20.3-24.5 34-58.4 30.3-92.2-28.5 1.1-64.4 19-85.3 43.6-16.7 19.4-32.9 54.1-28.4 87.1 31.9 2.5 63.2-13.9 83.4-38.5z" />
  </Svg>
);

export const RegisterScreen = ({ navigation }: { navigation: any }) => {
  const { themeColors, isDark } = useUserSettings();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password) {
      setErrorMsg('Please fill in all registration fields.');
      return;
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (error) {
        setErrorMsg(error.message);
      } else if (data.user) {
        // Let App.tsx global boot handle E2EE Keystore checking & setup
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        });
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setOauthLoading(provider);
    setErrorMsg('');
    try {
      const supabase = getSupabaseClient();

      if (provider === 'google') {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        try {
          // Clear any cached Google account session so Google Play Services always displays the Account Chooser
          await GoogleSignin.signOut();
        } catch {
          // Non-fatal if no user was signed in
        }
        const response = await GoogleSignin.signIn();

        if (response.type === 'cancelled') {
          return;
        }

        const idToken = (response as any).data?.idToken || (response as any).idToken;
        if (!idToken) {
          throw new Error('Google Sign-In failed to retrieve ID token.');
        }

        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: idToken,
        });

        if (error) {
          setErrorMsg(error.message);
        } else if (data.user) {
          navigation.reset({
            index: 0,
            routes: [{ name: 'MainTabs' }],
          });
        }
        return;
      }

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: 'cinecraftconnect://auth-callback',
          skipBrowserRedirect: true,
        },
      });
      if (error) {
        setErrorMsg(error.message || 'Apple sign-up failed.');
      } else if (data?.url) {
        await Linking.openURL(data.url);
      }
    } catch (err: any) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        return;
      }
      if (err.code === statusCodes.IN_PROGRESS) {
        return;
      }
      if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        setErrorMsg('Google Play Services not available or outdated on this device.');
        return;
      }
      setErrorMsg(err.message || `${provider} sign-up failed.`);
    } finally {
      setOauthLoading(null);
    }
  };

  return (
    <TabletContainer backgroundColor={themeColors.bgScreen} maxWidth={540}>
      <ScrollView style={[styles.container, { backgroundColor: themeColors.bgScreen }]} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Brand Header */}
      <View style={styles.brandRow}>
        <AppLogo size="lg" textColor={isDark ? 'cream' : 'ink'} />
      </View>

      {/* Slug Eyebrow */}
      <View style={styles.slugRow}>
        <View style={styles.slugDot} />
        <Text style={[styles.slugText, { color: themeColors.textMuted }]}>INT. CREW ENTRY — CREATE ACCOUNT</Text>
      </View>

      {/* Heading */}
      <Text style={[styles.heading, { color: themeColors.textPrimary }]}>Join the network.</Text>
      <Text style={[styles.sub, { color: themeColors.textSecondary }]}>CREATE YOUR FREE CREATOR ACCOUNT</Text>

      {/* Error Alert */}
      {errorMsg ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      ) : null}

      {/* OAuth Buttons */}
      <View style={styles.oauthContainer}>
        <TouchableOpacity
          style={[styles.googleBtn, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}
          onPress={() => handleOAuth('google')}
          disabled={oauthLoading !== null || loading}
          activeOpacity={0.85}
        >
          <GoogleSvg />
          <Text style={[styles.googleBtnText, { color: themeColors.textPrimary }]}>
            {oauthLoading === 'google' ? 'Connecting...' : 'Continue with Google'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.appleBtn,
            { backgroundColor: isDark ? themeColors.chipBg : INK, borderColor: themeColors.border, borderWidth: isDark ? 1 : 0 },
          ]}
          onPress={() => handleOAuth('apple')}
          disabled={oauthLoading !== null || loading}
          activeOpacity={0.85}
        >
          <AppleSvg />
          <Text style={[styles.appleBtnText, { color: isDark ? themeColors.textPrimary : '#FFFFFF' }]}>
            {oauthLoading === 'apple' ? 'Connecting...' : 'Continue with Apple'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Divider */}
      <View style={styles.dividerRow}>
        <View style={[styles.dividerLine, { backgroundColor: themeColors.divider }]} />
        <Text style={[styles.dividerText, { color: themeColors.textMuted }]}>OR REGISTER WITH EMAIL</Text>
        <View style={[styles.dividerLine, { backgroundColor: themeColors.divider }]} />
      </View>

      {/* Full Name */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>CREATOR NAME</Text>
        <TextInput
          style={[styles.underlineInput, { borderBottomColor: themeColors.border, color: themeColors.textPrimary }]}
          placeholder="DIRECTOR / DP / PRODUCER"
          placeholderTextColor={themeColors.textMuted}
          value={fullName}
          onChangeText={setFullName}
          editable={!loading}
        />
      </View>

      {/* Email */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>CREW EMAIL</Text>
        <TextInput
          style={[styles.underlineInput, { borderBottomColor: themeColors.border, color: themeColors.textPrimary }]}
          placeholder="CREATOR@CINECRAFT.COM"
          placeholderTextColor={themeColors.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />
      </View>

      {/* Password */}
      <View style={styles.fieldGroup}>
        <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>STAGE PASSCODE (MIN 6 CHARS)</Text>
        <View style={styles.passwordRow}>
          <TextInput
            style={[styles.underlineInput, { flex: 1, borderBottomWidth: 0, color: themeColors.textPrimary }]}
            placeholder="••••••••••••"
            placeholderTextColor={themeColors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            editable={!loading}
          />
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Icon name={showPassword ? 'eye-off' : 'eye'} size={18} color={themeColors.textSecondary} />
          </TouchableOpacity>
        </View>
        <View style={[styles.passwordUnderline, { backgroundColor: themeColors.border }]} />
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitBtn, { backgroundColor: isDark ? '#FFFFFF' : INK }, loading && styles.submitBtnDisabled]}
        onPress={handleRegister}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color={isDark ? '#0D0D0D' : '#FFFFFF'} />
        ) : (
          <Text style={[styles.submitBtnText, { color: isDark ? '#0D0D0D' : '#FFFFFF' }]}>Create Creator Account →</Text>
        )}
      </TouchableOpacity>

      {/* Toggle to Login */}
      <TouchableOpacity
        style={styles.toggleRow}
        onPress={() => navigation.navigate('Login')}
      >
        <Text style={styles.toggleText}>→ ALREADY HAVE AN ACCOUNT? SIGN IN</Text>
      </TouchableOpacity>

      {/* Return to Home */}
      <TouchableOpacity
        style={styles.returnHomeTouch}
        onPress={() => navigation.navigate('Landing')}
      >
        <Text style={[styles.returnHomeText, { color: themeColors.textMuted }]}>← RETURN TO HOME</Text>
      </TouchableOpacity>
      </ScrollView>
    </TabletContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CREAM,
  },
  content: {
    padding: 24,
    paddingTop: 48,
    paddingBottom: 40,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
  },
  slugRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  slugDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ORANGE,
  },
  slugText: {
    color: 'rgba(13, 13, 13, 0.4)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  heading: {
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif' }),
    fontSize: 32,
    fontWeight: '300',
    color: INK,
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  sub: {
    color: 'rgba(13, 13, 13, 0.45)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 24,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 18,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
  },
  oauthContainer: {
    gap: 10,
    marginBottom: 20,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(13, 13, 13, 0.15)',
    height: 48,
    borderRadius: 8,
    gap: 10,
  },
  googleBtnText: {
    color: INK,
    fontSize: 13,
    fontWeight: '700',
  },
  appleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: INK,
    height: 48,
    borderRadius: 8,
    gap: 10,
  },
  appleBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(13, 13, 13, 0.1)',
  },
  dividerText: {
    color: 'rgba(13, 13, 13, 0.35)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  fieldLabel: {
    color: 'rgba(13, 13, 13, 0.45)',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  underlineInput: {
    height: 40,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(13, 13, 13, 0.2)',
    color: INK,
    fontSize: 13,
    paddingVertical: 6,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eyeBtn: {
    padding: 6,
  },
  passwordUnderline: {
    height: 1,
    backgroundColor: 'rgba(13, 13, 13, 0.2)',
  },
  submitBtn: {
    backgroundColor: INK,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 16,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: CREAM,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  toggleRow: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  toggleText: {
    color: ORANGE,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  returnHomeTouch: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  returnHomeText: {
    color: 'rgba(13, 13, 13, 0.4)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
});

export default RegisterScreen;
