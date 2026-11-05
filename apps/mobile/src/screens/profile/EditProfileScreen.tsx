import { CachedImage } from '../../components/common/CachedImage';
import { fetchProfileExtras, mergeProfileExtras, saveOwnProfileExtras } from '../../utils/profileExtras';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Image,
  Switch,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  DeviceEventEmitter,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveCache } from '../../services/offlineCache';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';
import { friendlyError, sanitizeUsername, usernameIssue, USERNAME_MAX, USERNAME_STATUS_TEXT } from '@cinecraft/core';
import { ImagePickerBox } from '../../components/common/ImagePickerBox';
import { TabletColumn } from '../../components/common/TabletContainer';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

const CRAFT_OPTIONS = [
  'Actor', 'Art Director', 'Casting Director', 'Cinematographer', 'Colorist',
  'Composer', 'Director', 'Editor', 'Executive Producer', 'Location Manager',
  'Makeup Artist', 'Producer', 'Production Designer', 'Screenwriter', 'Sound Designer',
  'VFX Supervisor', 'Writer'
];

// same lenient check as web: http(s):// or a plain domain
const isValidUrl = (v: string) => {
  const s = v.trim();
  return !s || /^(https?:\/\/)/.test(s) || /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}/.test(s);
};

const MAX_CUSTOM_LINKS = 10;

export const EditProfileScreen =({ route, navigation }: { route: any; navigation: any }) => {
  const { themeColors, isDark } = useUserSettings();
  const { profile: initialProfile } = route.params || {};

  const [profile, setProfile] = useState<any>(initialProfile || null);
  const [loading, setLoading] = useState(!initialProfile);
  const [saving, setSaving] = useState(false);

  // Form Fields State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [selectedCrafts, setSelectedCrafts] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [website, setWebsite] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');

  // Social Links
  const [instagramUrl, setInstagramUrl] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [twitterUrl, setTwitterUrl] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [acceptDirectPitches, setAcceptDirectPitches] = useState(true);
  const [customLinks, setCustomLinks] = useState<{ title: string; url: string }[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Avatar & Cover
  const [avatarUrl, setAvatarUrl] = useState('');

  // discard-changes prompt: remember the loaded values and compare
  const [loaded, setLoaded] = useState(false);
  const baselineRef = useRef<string | null>(null);
  const savedRef = useRef(false);
  const snapshot = JSON.stringify([fullName, username, bio, selectedCrafts, location, website, youtubeUrl, instagramUrl, linkedinUrl, twitterUrl, facebookUrl, acceptDirectPitches, avatarUrl, customLinks]);
  useEffect(() => {
    if (loaded && baselineRef.current === null) baselineRef.current = snapshot;
  }, [loaded, snapshot]);
  const isDirty = baselineRef.current !== null && baselineRef.current !== snapshot;
  const dirtyRef = useRef(false);
  dirtyRef.current = isDirty && !savedRef.current;
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e: any) => {
      if (!dirtyRef.current || savedRef.current) return; // savedRef is set just before goBack(), before dirtyRef re-renders
      e.preventDefault();
      Alert.alert('Discard changes?', 'You have unsaved changes to your profile.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
    return unsub;
  }, [navigation]);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: dataRaw } = await (supabase.from('profiles') as any)
          .select('*')
          .eq('id', user.id)
          .single();
        const data = dataRaw ? mergeProfileExtras(dataRaw, await fetchProfileExtras(user.id)) : dataRaw;

        if (data) {
          setProfile(data);
          setFullName(data.full_name || '');
          setUsername(data.username || '');
          setBio(data.bio || '');
          setLocation(data.location || '');
          setWebsite(data.website || '');
          setYoutubeUrl(data.youtube_url || '');
          setAvatarUrl(data.avatar_url || '');

          const craftStr = data.craft || '';
          if (craftStr) {
            setSelectedCrafts(craftStr.split(', ').map((s: string) => s.trim()).filter(Boolean));
          }

          const socials = data.social_links || {};
          setInstagramUrl(socials.instagram || data.instagram_url || '');
          setLinkedinUrl(socials.linkedin || '');
          setTwitterUrl(socials.twitter || '');
          setFacebookUrl(socials.facebook || '');
          setAcceptDirectPitches(socials.accept_direct_pitches ?? true);
          if (Array.isArray(socials.custom_links)) {
            setCustomLinks(socials.custom_links.map((l: any) => ({ title: String(l?.title || ''), url: String(l?.url || '') })));
          }
        }
      } catch (e) {
        console.warn('[EditProfile] Fetch error:', e);
      } finally {
        setLoading(false);
        setLoaded(true);
      }
    };

    fetchUser();
  }, []);

  const toggleCraft = (craft: string) => {
    setSelectedCrafts((prev) =>
      prev.includes(craft) ? prev.filter((c) => c !== craft) : [...prev, craft]
    );
  };

  const handleSave = async () => {
    const issue = usernameIssue(username.trim().toLowerCase());
    if (issue) {
      Alert.alert('Check your username', USERNAME_STATUS_TEXT[issue === 'empty' ? 'idle' : issue]);
      return;
    }
    if (bio.length > 300) {
      Alert.alert('Validation Error', 'Bio must be 300 characters or less.');
      return;
    }
    // same rules as web EditProfileForm
    const errs: Record<string, string> = {};
    const nm = fullName.trim();
    if (nm && nm.length < 2) errs.fullName = 'Name is too short';
    if (nm.length > 50) errs.fullName = 'Name is too long';
    if (location.trim().length > 100) errs.location = 'Location must be 100 characters or less';
    const urlFields: [string, string][] = [
      ['website', website], ['youtube', youtubeUrl], ['instagram', instagramUrl],
      ['linkedin', linkedinUrl], ['twitter', twitterUrl], ['facebook', facebookUrl],
    ];
    urlFields.forEach(([k, v]) => { if (v.trim() && !isValidUrl(v)) errs[k] = 'Please enter a valid URL'; });
    customLinks.forEach((l, i) => {
      const t = l.title.trim();
      const u = l.url.trim();
      if (!t && !u) return;
      if (!t) errs[`custom_title_${i}`] = 'Add a title for this link';
      if (!u) errs[`custom_url_${i}`] = 'Please enter a valid URL';
      else if (!isValidUrl(u)) errs[`custom_url_${i}`] = 'Please enter a valid URL';
    });
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      Alert.alert('Check your details', Object.values(errs)[0]);
      return;
    }

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Authentication', 'Please sign in to save profile.');
        return;
      }

      // the username must still be free (the database enforces it too)
      const wanted = username.trim().toLowerCase();
      if (wanted !== String(profile?.username || '').toLowerCase()) {
        const { data: clash } = await (supabase.from('profiles') as any).select('id').eq('username', wanted).neq('id', user.id).limit(1);
        if (clash && clash.length > 0) {
          Alert.alert('Check your username', USERNAME_STATUS_TEXT.taken);
          return;
        }
      }

      const updatedCraft = selectedCrafts.join(', ');
      const payload: any = {
        full_name: fullName.trim() || null,
        username: username.trim().toLowerCase(),
        bio: bio.trim() || null,
        craft: updatedCraft || null,
        location: location.trim() || null,
        website: website.trim() || null,
        avatar_url: avatarUrl || null,
        accept_direct_pitches: acceptDirectPitches,
        updated_at: new Date().toISOString(),
      };

      // .select() returns the saved row: an update that matched nothing (blocked by a policy) gives no error, only no row
      const { data: savedRows, error } = await (supabase.from('profiles') as any)
        .update(payload)
        .eq('id', user.id)
        .select('id, avatar_url');

      if (error) throw error;
      if (!savedRows || savedRows.length === 0) throw new Error('Your profile could not be saved. Please try again.');
      const savedAvatar: string | null = savedRows[0].avatar_url || null;

      const { error: extrasError } = await saveOwnProfileExtras(user.id, {
        youtube_url: youtubeUrl.trim() || null,
        social_links: {
          ...((profile?.social_links as any) || {}),
          instagram: instagramUrl.trim() || null,
          linkedin: linkedinUrl.trim() || null,
          twitter: twitterUrl.trim() || null,
          facebook: facebookUrl.trim() || null,
          custom_links: customLinks
            .map((l) => ({ title: l.title.trim(), url: l.url.trim() }))
            .filter((l) => l.title && l.url),
        },
      });
      if (extrasError) throw extrasError;

      // refresh what shows the photo: header avatar caches, then tell the profile screen and header to reload
      if (savedAvatar) {
        saveCache('user_avatar_url', savedAvatar);
        AsyncStorage.setItem('@cinecraft_current_user_avatar', savedAvatar).catch(() => {});
      }
      DeviceEventEmitter.emit('cinecraft:profile-updated', { avatar_url: savedAvatar, full_name: fullName.trim(), username: username.trim().toLowerCase() });

      savedRef.current = true;
      navigation.goBack();
      Alert.alert('Profile saved', 'Your profile was updated.');
    } catch (err: any) {
      Alert.alert('Error', friendlyError(err, 'Failed to update profile.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={ORANGE} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bgScreen }]}>
      <Header
        title="Edit Profile"
        showLogo={false}
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Save profile"
            style={styles.headerSaveBtn}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.headerSaveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        }
      />
      <TabletColumn maxWidth={840}>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Banner & Avatar Preview Card */}
          <View style={styles.bannerContainer}>
            <View style={[styles.avatarWrapper, { borderColor: themeColors.bgScreen }]}>
              {avatarUrl ? (
                <CachedImage uri={avatarUrl} style={styles.avatarImg} />
              ) : (
                <View style={[styles.avatarImg, styles.avatarFallback]}>
                  <Text style={styles.avatarFallbackText}>
                    {(fullName || 'C').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Form Content Body */}
          <View style={styles.formSection}>
            <ImagePickerBox
              imageUrl={avatarUrl}
              onImageSelected={setAvatarUrl}
              label="PROFILE PHOTO"
              bucket="portfolios"
              folder="avatars"
              errorTitle="Avatar Upload Failed"
            />

            {/* Full Name & Username */}
            <Text style={[styles.label, { color: themeColors.textSecondary }]}>FULL NAME</Text>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
              placeholder="Your full legal name"
              placeholderTextColor={themeColors.textMuted}
              value={fullName}
              onChangeText={(v) => {
                setFullName(v);
                const t = v.trim();
                if (fieldErrors.fullName && (!t || (t.length >= 2 && t.length <= 50))) {
                  setFieldErrors((prev) => { const n = { ...prev }; delete n.fullName; return n; });
                }
              }}
            />
            {fieldErrors.fullName ? <Text style={styles.fieldError}>{fieldErrors.fullName}</Text> : null}
            <Text style={[styles.fieldNote, { color: themeColors.textMuted }]}>
              Enter your individual name. To represent a studio, create a Studio Page instead.
            </Text>

            <Text style={[styles.label, { color: themeColors.textSecondary }]}>USERNAME *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
              placeholder="e.g. vamshikrishna"
              placeholderTextColor={themeColors.textMuted}
              autoCapitalize="none"
              value={username}
              onChangeText={(v) => setUsername(sanitizeUsername(v))}
              maxLength={USERNAME_MAX}
            />
            <Text style={[styles.fieldNote, { color: themeColors.textMuted }]}>
              {USERNAME_STATUS_TEXT.idle}
            </Text>

            {/* Bio with Counter */}
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: themeColors.textSecondary }]}>BIO</Text>
              <Text style={[styles.counterText, { color: themeColors.textMuted }, bio.length > 300 && { color: '#EF4444' }]}>
                {bio.length} / 300
              </Text>
            </View>
            <TextInput
              style={[styles.input, styles.textarea, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }, bio.length > 300 && { borderColor: '#EF4444' }]}
              placeholder="Tell filmmakers and studios about yourself..."
              placeholderTextColor={themeColors.textMuted}
              multiline
              numberOfLines={4}
              value={bio}
              maxLength={300}
              onChangeText={setBio}
            />

            {/* Primary Crafts Selection */}
            <Text style={[styles.label, { color: themeColors.textSecondary }]}>PRIMARY CRAFT(S)</Text>
            <View style={styles.chipRow}>
              {CRAFT_OPTIONS.map((craft) => {
                const active = selectedCrafts.includes(craft);
                return (
                  <TouchableOpacity
                    key={craft}
                    style={[
                      styles.chip,
                      { backgroundColor: themeColors.chipBg, borderColor: themeColors.border },
                      active && [styles.chipActive, { backgroundColor: isDark ? 'rgba(255, 75, 51, 0.15)' : '#FFF7F5' }],
                    ]}
                    onPress={() => toggleCraft(craft)}
                  >
                    <Text style={[
                      styles.chipText,
                      { color: themeColors.textSecondary },
                      active && styles.chipTextActive,
                    ]}>{craft}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Location & Website */}
            <Text style={[styles.label, { color: themeColors.textSecondary }]}>LOCATION</Text>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
              placeholder="e.g. Hyderabad, India"
              placeholderTextColor={themeColors.textMuted}
              value={location}
              onChangeText={setLocation}
            />
            {fieldErrors.location ? <Text style={styles.fieldError}>{fieldErrors.location}</Text> : null}

            <Text style={[styles.label, { color: themeColors.textSecondary }]}>WEBSITE</Text>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
              placeholder="https://your-portfolio-website.com"
              placeholderTextColor={themeColors.textMuted}
              autoCapitalize="none"
              value={website}
              onChangeText={setWebsite}
            />
            {fieldErrors.website ? <Text style={styles.fieldError}>{fieldErrors.website}</Text> : null}

            {/* Direct Pitch Toggle */}
            <View style={[styles.switchBox, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={[styles.switchTitle, { color: themeColors.textPrimary }]}>Accept Direct Pitches</Text>
                <Text style={[styles.switchSub, { color: themeColors.textSecondary }]}>
                  Allow screenwriters to pitch concepts directly to your profile.
                </Text>
              </View>
              <Switch
                value={acceptDirectPitches}
                accessibilityLabel="Accept Direct Pitches"
                onValueChange={setAcceptDirectPitches}
                trackColor={{ true: ORANGE }}
              />
            </View>

            {/* Social Media Links */}
            <Text style={[styles.sectionHeader, { color: themeColors.textPrimary }]}>SOCIAL MEDIA</Text>

            <Text style={[styles.label, { color: themeColors.textSecondary }]}>INSTAGRAM PROFILE URL</Text>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
              placeholder="https://instagram.com/yourhandle"
              placeholderTextColor={themeColors.textMuted}
              autoCapitalize="none"
              value={instagramUrl}
              onChangeText={setInstagramUrl}
            />

            <Text style={[styles.label, { color: themeColors.textSecondary }]}>LINKEDIN PROFILE URL</Text>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
              placeholder="https://linkedin.com/in/yourprofile"
              placeholderTextColor={themeColors.textMuted}
              autoCapitalize="none"
              value={linkedinUrl}
              onChangeText={setLinkedinUrl}
            />

            <Text style={[styles.label, { color: themeColors.textSecondary }]}>TWITTER / X PROFILE URL</Text>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
              placeholder="https://x.com/yourhandle"
              placeholderTextColor={themeColors.textMuted}
              autoCapitalize="none"
              value={twitterUrl}
              onChangeText={setTwitterUrl}
            />

            <Text style={[styles.label, { color: themeColors.textSecondary }]}>FACEBOOK PROFILE URL</Text>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
              placeholder="https://facebook.com/yourprofile"
              placeholderTextColor={themeColors.textMuted}
              autoCapitalize="none"
              value={facebookUrl}
              onChangeText={setFacebookUrl}
            />

            <Text style={[styles.label, { color: themeColors.textSecondary }]}>YOUTUBE CHANNEL URL</Text>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
              placeholder="https://youtube.com/@yourchannel"
              placeholderTextColor={themeColors.textMuted}
              autoCapitalize="none"
              value={youtubeUrl}
              onChangeText={setYoutubeUrl}
            />
            {fieldErrors.youtube ? <Text style={styles.fieldError}>{fieldErrors.youtube}</Text> : null}
            {(['instagram', 'linkedin', 'twitter', 'facebook'] as const).map((k) =>
              fieldErrors[k] ? <Text key={k} style={styles.fieldError}>{k.charAt(0).toUpperCase() + k.slice(1)}: {fieldErrors[k]}</Text> : null
            )}

            {/* Custom links */}
            <Text style={[styles.label, { color: themeColors.textSecondary }]}>OTHER LINKS</Text>
            {customLinks.map((l, i) => (
              <View key={i} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0, backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                    placeholder="Title (e.g. Showreel)"
                    placeholderTextColor={themeColors.textMuted}
                    accessibilityLabel={`Link ${i + 1} title`}
                    value={l.title}
                    maxLength={40}
                    onChangeText={(v) => setCustomLinks((prev) => prev.map((x, j) => (j === i ? { ...x, title: v } : x)))}
                  />
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Remove link ${i + 1}`}
                    onPress={() => setCustomLinks((prev) => prev.filter((_, j) => j !== i))}
                    style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Text style={{ color: '#EF4444', fontWeight: '700' }}>Remove</Text>
                  </TouchableOpacity>
                </View>
                {fieldErrors[`custom_title_${i}`] ? <Text style={styles.fieldError}>{fieldErrors[`custom_title_${i}`]}</Text> : null}
                <TextInput
                  style={[styles.input, { marginTop: 8, marginBottom: 0, backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  placeholder="https://..."
                  placeholderTextColor={themeColors.textMuted}
                  autoCapitalize="none"
                  keyboardType="url"
                  accessibilityLabel={`Link ${i + 1} address`}
                  value={l.url}
                  onChangeText={(v) => setCustomLinks((prev) => prev.map((x, j) => (j === i ? { ...x, url: v } : x)))}
                />
                {fieldErrors[`custom_url_${i}`] ? <Text style={styles.fieldError}>{fieldErrors[`custom_url_${i}`]}</Text> : null}
              </View>
            ))}
            {customLinks.length < MAX_CUSTOM_LINKS && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Add a link"
                onPress={() => setCustomLinks((prev) => [...prev, { title: '', url: '' }])}
                style={{ minHeight: 44, justifyContent: 'center', marginBottom: 8 }}
              >
                <Text style={{ color: ORANGE, fontWeight: '700', fontSize: 13 }}>+ Add a link</Text>
              </TouchableOpacity>
            )}

            {/* Submit Action Row */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.cancelBtn, { backgroundColor: themeColors.chipBg }]}
                onPress={() => navigation.goBack()}
              >
                <Text style={[styles.cancelBtnText, { color: themeColors.textPrimary }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      </TabletColumn>
    </View>
  );
};

const styles = StyleSheet.create({
  fieldError: { color: '#EF4444', fontSize: 12, marginTop: 4, marginBottom: 6 },
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSaveBtn: {
    backgroundColor: ORANGE,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  headerSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    paddingBottom: 40,
  },
  bannerContainer: {
    height: 90,
    width: '100%',
    position: 'relative',
    backgroundColor: 'transparent',
    alignItems: 'center',
  },
  bannerImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  changeBannerBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  changeBannerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  avatarWrapper: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    position: 'absolute',
    bottom: -45,
    backgroundColor: '#F1F5F9',
    elevation: 3,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    backgroundColor: 'rgba(255, 75, 51, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#FF4B33',
    fontSize: 32,
    fontWeight: '700',
  },
  formSection: {
    marginTop: 55,
    paddingHorizontal: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.6,
    marginTop: 12,
    marginBottom: 6,
  },
  fieldNote: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 10,
    lineHeight: 14,
  },
  counterText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '700',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: INK,
  },
  textarea: {
    height: 90,
    textAlignVertical: 'top',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: '#FFF7F5',
    borderColor: ORANGE,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  chipTextActive: {
    color: ORANGE,
    fontWeight: '700',
  },
  switchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: INK,
  },
  switchSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: INK,
    marginTop: 20,
    marginBottom: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1,
    backgroundColor: ORANGE,
    borderRadius: 12,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});

export default EditProfileScreen;
