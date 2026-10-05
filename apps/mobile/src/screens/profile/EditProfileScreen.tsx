import { CachedImage } from '../../components/common/CachedImage';
import { fetchProfileExtras, mergeProfileExtras, saveOwnProfileExtras } from '../../utils/profileExtras';
import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

const CRAFT_OPTIONS = [
  'Actor', 'Art Director', 'Casting Director', 'Cinematographer', 'Colorist',
  'Composer', 'Director', 'Editor', 'Executive Producer', 'Location Manager',
  'Makeup Artist', 'Producer', 'Production Designer', 'Screenwriter', 'Sound Designer',
  'VFX Supervisor', 'Writer'
];

export const EditProfileScreen = ({ route, navigation }: { route: any; navigation: any }) => {
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

  // Avatar & Cover
  const [avatarUrl, setAvatarUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');

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
          setCoverUrl(data.cover_image_url || '');

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
        }
      } catch (e) {
        console.warn('[EditProfile] Fetch error:', e);
      } finally {
        setLoading(false);
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
    if (!username.trim()) {
      Alert.alert('Validation Error', 'Username cannot be empty.');
      return;
    }
    if (bio.length > 300) {
      Alert.alert('Validation Error', 'Bio must be 300 characters or less.');
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

      const updatedCraft = selectedCrafts.join(', ');
      const payload: any = {
        full_name: fullName.trim() || null,
        username: username.trim().toLowerCase(),
        bio: bio.trim() || null,
        craft: updatedCraft || null,
        location: location.trim() || null,
        website: website.trim() || null,
        avatar_url: avatarUrl || null,
        cover_image_url: coverUrl || null,
        accept_direct_pitches: acceptDirectPitches,
        updated_at: new Date().toISOString(),
      };

      const { error } = await (supabase.from('profiles') as any)
        .update(payload)
        .eq('id', user.id);

      if (error) throw error;

      const { error: extrasError } = await saveOwnProfileExtras(user.id, {
        youtube_url: youtubeUrl.trim() || null,
        social_links: {
          ...((profile?.social_links as any) || {}),
          instagram: instagramUrl.trim() || null,
          linkedin: linkedinUrl.trim() || null,
          twitter: twitterUrl.trim() || null,
          facebook: facebookUrl.trim() || null,
        },
      });
      if (extrasError) throw extrasError;

      Alert.alert('Success', 'Profile updated successfully!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update profile.');
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

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Banner & Avatar Preview Card */}
          <View style={styles.bannerContainer}>
            <CachedImage uri={coverUrl || 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800'} style={styles.bannerImg} />
            <TouchableOpacity style={styles.changeBannerBtn}>
              <Icon name="camera" size={12} color="#FFFFFF" />
              <Text style={styles.changeBannerText}>Change Banner</Text>
            </TouchableOpacity>

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
            {/* Full Name & Username */}
            <Text style={[styles.label, { color: themeColors.textSecondary }]}>FULL NAME</Text>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
              placeholder="Your full legal name"
              placeholderTextColor={themeColors.textMuted}
              value={fullName}
              onChangeText={setFullName}
            />
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
              onChangeText={setUsername}
            />

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

            <Text style={[styles.label, { color: themeColors.textSecondary }]}>WEBSITE</Text>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
              placeholder="https://your-portfolio-website.com"
              placeholderTextColor={themeColors.textMuted}
              autoCapitalize="none"
              value={website}
              onChangeText={setWebsite}
            />

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
    </View>
  );
};

const styles = StyleSheet.create({
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
    fontWeight: '800',
  },
  content: {
    paddingBottom: 40,
  },
  bannerContainer: {
    height: 140,
    width: '100%',
    position: 'relative',
    backgroundColor: '#CBD5E1',
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
    fontSize: 11,
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
    fontWeight: '800',
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
    fontSize: 10.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
    marginTop: 12,
    marginBottom: 6,
  },
  fieldNote: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginBottom: 10,
    lineHeight: 14,
  },
  counterText: {
    fontSize: 11,
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
    fontSize: 13.5,
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
    fontSize: 11.5,
    fontWeight: '600',
    color: '#64748B',
  },
  chipTextActive: {
    color: ORANGE,
    fontWeight: '800',
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
    fontSize: 13.5,
    fontWeight: '800',
    color: INK,
  },
  switchSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '800',
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
    fontWeight: '800',
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
    fontWeight: '800',
  },
});

export default EditProfileScreen;
