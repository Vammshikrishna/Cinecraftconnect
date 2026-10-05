import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Share,
  Linking,
  InteractionManager,
  DeviceEventEmitter,
} from 'react-native';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { TabletContainer } from '../../components/common/TabletContainer';
import { useUserSettings } from '../../hooks/useUserSettings';
import { CachedImage } from '../../components/common/CachedImage';
import { getSupabaseClient } from '@cinecraft/api';
import { CreatePitchModal } from '../../components/pitch/CreatePitchModal';
import { UniversalShareSheet } from '../../components/common/UniversalShareSheet';
import { resolveCurrentUserId, getCacheSync, saveCache } from '../../services/offlineCache';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

const FORMAT_LABELS: Record<string, string> = {
  film: 'Feature Film', series: 'Web Series', short: 'Short Film',
  documentary: 'Documentary', youtube: 'YouTube / Digital',
  animation: 'Animation', branded: 'Branded Content', other: 'Other',
};

const BUDGET_LABELS: Record<string, string> = {
  micro: 'Micro Budget (<10L)', low: 'Low Budget (10L-50L)', mid: 'Mid Budget (50L-5Cr)',
  high: 'High Budget (5Cr-50Cr)', studio: 'Studio Scale (50Cr+)', undisclosed: 'Undisclosed',
};

const COMPENSATION_LABELS: Record<string, string> = {
  paid: 'Paid Scale', unpaid: 'Unpaid', development_deal: 'Development Deal',
  revenue_share: 'Revenue Share', negotiable: 'Negotiable',
};

const COMP_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  paid: { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
  development_deal: { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
  revenue_share: { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' },
  negotiable: { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' },
  unpaid: { bg: '#F8FAFC', text: '#64748B', border: '#E2E8F0' },
};

export const PitchDetailScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  const { themeColors, isDark } = useUserSettings();
  const { pitchId, pitchTitle } = route.params || {};
  const [pitchCall, setPitchCall] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    const task = InteractionManager.runAfterInteractions(async () => {
      if (!pitchId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const supabase = getSupabaseClient();
        let currentUser: any = null;
        try {
          const { data: { session } } = await supabase.auth.getSession();
          currentUser = session?.user || null;
        } catch {}
        if (!currentUser) {
          try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            currentUser = authUser;
          } catch {}
        }
        if (!currentUser) {
          const uid = await resolveCurrentUserId();
          if (uid) currentUser = { id: uid };
        }

        if (isCancelled) return;
        if (currentUser) setUser(currentUser);

        // Immediate check from local cache for instant zero-latency status
        const cachedInfo = getCacheSync<any>('pitch_user_info');
        if (cachedInfo?.savedPitchIds?.includes(pitchId) && !isCancelled) {
          setIsSaved(true);
        }

        // The pitch, saved flag and submitted flag only need the pitch id and the user id: fetch together.
        const uid = currentUser?.id;
        const [pitchRes, savedRes, subRes]: any[] = await Promise.all([
          (supabase.from('pitch_calls') as any)
            .select(`
            *,
            profiles:creator_id (id, full_name, avatar_url, username, craft, location, is_verified)
          `)
            .eq('id', pitchId)
            .single(),
          uid
            ? (supabase.from('saved_pitch_calls') as any).select('id').eq('pitch_call_id', pitchId).eq('user_id', uid).maybeSingle()
            : Promise.resolve(null),
          uid
            ? (supabase.from('pitch_submissions') as any).select('id').eq('pitch_call_id', pitchId).eq('submitter_id', uid).maybeSingle()
            : Promise.resolve(null),
        ]);

        if (isCancelled) return;
        if (!pitchRes.error && pitchRes.data) {
          setPitchCall(pitchRes.data);
          if (uid) {
            setIsSaved(!!savedRes?.data);
            if (subRes?.data) setAlreadySubmitted(true);
          }
        }
      } catch (e) {
        console.warn('[PitchDetailScreen] Error:', e);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    });

    return () => {
      isCancelled = true;
      task.cancel();
    };
  }, [pitchId]);

  // Real-time listener across screens
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('pitchSavedChanged', (event) => {
      if (event?.pitchId === pitchId) {
        setIsSaved(event.isSaved);
      }
    });
    return () => sub.remove();
  }, [pitchId]);

  // Supabase Realtime channel for saved_pitch_calls
  useEffect(() => {
    if (!pitchId) return;
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`pitch_detail_saved_${pitchId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'saved_pitch_calls' },
        async (payload: any) => {
          const currentUserId = user?.id || (await resolveCurrentUserId());
          if (!currentUserId) return;
          if (payload.eventType === 'DELETE') {
            const { data } = await (supabase.from('saved_pitch_calls') as any)
              .select('id')
              .eq('pitch_call_id', pitchId)
              .eq('user_id', currentUserId)
              .maybeSingle();
            const isNowSaved = !!data;
            setIsSaved(isNowSaved);
            DeviceEventEmitter.emit('pitchSaveChanged', { pitchId, isSaved: isNowSaved });
          } else if (payload.eventType === 'INSERT') {
            if (payload.new?.user_id === currentUserId && payload.new?.pitch_call_id === pitchId) {
              setIsSaved(true);
              DeviceEventEmitter.emit('pitchSaveChanged', { pitchId, isSaved: true });
            }
          }
        }
      )
      .subscribe();

    return () => {
      try {
        channel.unsubscribe();
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [pitchId, user?.id]);

  const handleToggleSave = async () => {
    let currentUserId = user?.id;
    if (!currentUserId) {
      currentUserId = await resolveCurrentUserId();
      if (currentUserId) setUser({ id: currentUserId });
    }
    if (!currentUserId) {
      Alert.alert('Sign In Required', 'Please sign in to save pitch calls.');
      return;
    }

    const newSaved = !isSaved;
    setIsSaved(newSaved);

    // Update cached pitch_user_info if present
    const cachedInfo = getCacheSync<any>('pitch_user_info');
    if (cachedInfo) {
      const existing = cachedInfo.savedPitchIds || [];
      const updatedIds = newSaved
        ? Array.from(new Set([...existing, pitchId]))
        : existing.filter((id: string) => id !== pitchId);
      saveCache('pitch_user_info', { ...cachedInfo, savedPitchIds: updatedIds });
    }

    // Broadcast across screens in real-time
    DeviceEventEmitter.emit('pitchSavedChanged', { pitchId, isSaved: newSaved });

    const supabase = getSupabaseClient();
    try {
      if (!newSaved) {
        const { error } = await (supabase.from('saved_pitch_calls') as any)
          .delete()
          .eq('user_id', currentUserId)
          .eq('pitch_call_id', pitchId);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from('saved_pitch_calls') as any)
          .upsert({ user_id: currentUserId, pitch_call_id: pitchId }, { onConflict: 'user_id,pitch_call_id' });
        if (error) throw error;
      }
    } catch (e) {
      console.warn('Save toggle error:', e);
      setIsSaved(!newSaved);
      DeviceEventEmitter.emit('pitchSavedChanged', { pitchId, isSaved: !newSaved });
    }
  };

  const handleShare = () => {
    setShowShareSheet(true);
  };

  if (loading) {
    return (
      <View style={styles.centerLoading}>
        <ActivityIndicator size="large" color={ORANGE} />
      </View>
    );
  }

  if (!pitchCall) {
    return (
      <View style={styles.container}>
        <Header title="Pitch Call" showLogo={false} onBack={() => navigation.goBack()} />
        <View style={styles.emptyState}>
          <Icon name="lightbulb" size={40} color="#9CA3AF" />
          <Text style={styles.emptyTitle}>Pitch Call Not Found</Text>
        </View>
      </View>
    );
  }

  const isOwner = user?.id === pitchCall.creator_id;
  const isExpired = pitchCall.deadline && new Date(pitchCall.deadline) < new Date();
  const creatorName = pitchCall.profiles?.full_name || 'Call Creator';
  const creatorAvatar = pitchCall.profiles?.avatar_url;
  const creatorCraft = pitchCall.profiles?.craft || 'Call Creator';
  const creatorLocation = pitchCall.profiles?.location;
  const isVerified = pitchCall.profiles?.is_verified;
  const isGuildMember = !!pitchCall.attachments?.producers_guild_member_id;

  const languages: string[] = Array.isArray(pitchCall.language)
    ? pitchCall.language
    : typeof pitchCall.language === 'string'
    ? pitchCall.language.split(',').map((s: string) => s.trim()).filter(Boolean)
    : [];

  const genres: string[] = Array.isArray(pitchCall.genre)
    ? pitchCall.genre
    : typeof pitchCall.genre === 'string'
    ? pitchCall.genre.split(',').map((s: string) => s.trim()).filter(Boolean)
    : [];

  const compColor = COMP_COLORS[pitchCall.compensation] || {
    bg: '#F8FAFC',
    text: '#64748B',
    border: '#E2E8F0',
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bgScreen }]}>
      <Header
        title="Pitch Details"
        showLogo={false}
        onBack={() => navigation.goBack()}
        rightAction={
          <View style={styles.headerRightActions}>
            <TouchableOpacity
              style={[
                styles.headerActionBtn,
                { backgroundColor: themeColors.chipBg, borderColor: themeColors.border },
              ]}
              onPress={handleShare}
              accessibilityLabel="Share Pitch Call"
            >
              <Icon name="share" size={17} color={themeColors.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.headerActionBtn,
                { backgroundColor: themeColors.chipBg, borderColor: themeColors.border },
              ]}
              onPress={handleToggleSave}
              accessibilityLabel="Save Pitch Call"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Icon
                name="bookmark"
                size={17}
                color={isSaved ? ORANGE : themeColors.textPrimary}
                fill={isSaved ? ORANGE : 'none'}
              />
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TabletContainer maxWidth={720}>
          {/* Hero Card */}
          <View
            style={[
              styles.heroCard,
              { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
            ]}
          >
            <View style={styles.topAccentStripe} />

            {/* Title (at top) */}
            <Text style={[styles.heroTitle, { color: themeColors.textPrimary }]}>{pitchCall.title}</Text>

            {/* Status & Format Badges */}
            <View style={styles.statusBadgesRow}>
              {pitchCall.project_type && (
                <View style={[styles.formatTagBadge, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
                  <Icon name="film" size={10} color={ORANGE} />
                  <Text style={[styles.formatTagBadgeText, { color: themeColors.textSecondary }]}>
                    {FORMAT_LABELS[pitchCall.project_type] || pitchCall.project_type}
                  </Text>
                </View>
              )}

              {genres.length > 0 && (
                <View style={[styles.genreBadge, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
                  <Text style={[styles.genreBadgeText, { color: themeColors.textSecondary }]}>
                    GENRE // {genres.join(', ').toUpperCase()}
                  </Text>
                </View>
              )}

              {languages.length > 0 && (
                <View style={[styles.langBadge, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
                  <Icon name="globe" size={10} color={themeColors.textSecondary} />
                  <Text style={[styles.langBadgeText, { color: themeColors.textSecondary }]}>
                    LANGUAGE // {languages.join(', ').toUpperCase()}
                  </Text>
                </View>
              )}

              {isGuildMember && (
                <View style={styles.guildTagBadge}>
                  <Icon name="award" size={10} color="#D97706" />
                  <Text style={styles.guildTagBadgeText}>GUILD VERIFIED</Text>
                </View>
              )}

              {isExpired ? (
                <View style={styles.closedTagBadge}>
                  <Text style={styles.closedTagBadgeText}>CALL CLOSED</Text>
                </View>
              ) : (
                <View style={styles.openTagBadge}>
                  <View style={styles.greenDot} />
                  <Text style={styles.openTagBadgeText}>OPEN NOW</Text>
                </View>
              )}

              {pitchCall.nda_required && (
                <View style={styles.ndaTagBadge}>
                  <Icon name="shield" size={10} color="#D97706" />
                  <Text style={styles.ndaTagBadgeText}>NDA REQUIRED</Text>
                </View>
              )}
            </View>

            {/* Posted Date (at last) */}
            {pitchCall.created_at && (
              <View style={styles.heroPostedRow}>
                <Icon name="clock" size={12} color={themeColors.textSecondary} />
                <Text style={[styles.heroPostedText, { color: themeColors.textSecondary }]}>
                  Posted {new Date(pitchCall.created_at).toLocaleDateString()}
                </Text>
              </View>
            )}
          </View>

          {/* Creator Profile Card */}
          <View
            style={[
              styles.creatorCard,
              { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
            ]}
          >
            <TouchableOpacity
              style={styles.creatorInfoGroup}
              onPress={() => navigation.navigate('Profile', { userId: pitchCall.creator_id })}
            >
              {creatorAvatar ? (
                <CachedImage uri={creatorAvatar} style={styles.creatorAvatar} />
              ) : (
                <View style={styles.creatorAvatarFallback}>
                  <Text style={styles.creatorAvatarText}>{creatorName.charAt(0).toUpperCase()}</Text>
                </View>
              )}

              <View style={{ flex: 1 }}>
                <View style={styles.creatorNameRow}>
                  <Text style={[styles.creatorName, { color: themeColors.textPrimary }]}>{creatorName}</Text>
                  {isVerified && <Icon name="badge-check" size={14} color={ORANGE} />}
                </View>
                <Text style={styles.creatorCraftText}>{creatorCraft}</Text>
                {creatorLocation && (
                  <Text style={[styles.creatorLocationText, { color: themeColors.textSecondary }]}>
                    📍 {creatorLocation}
                  </Text>
                )}
              </View>
            </TouchableOpacity>

            <View style={styles.creatorBtnRow}>
              <TouchableOpacity
                style={[
                  styles.msgBtn,
                  { backgroundColor: isDark ? themeColors.chipBg : '#F1F5F9' },
                ]}
                onPress={() => navigation.navigate('Messages', { recipientId: pitchCall.creator_id })}
              >
                <Icon name="message-square" size={14} color={themeColors.textPrimary} />
                <Text style={[styles.msgBtnText, { color: themeColors.textPrimary }]}>Send Message</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.profileBtn,
                  { borderColor: themeColors.border },
                ]}
                onPress={() => navigation.navigate('Profile', { userId: pitchCall.creator_id })}
              >
                <Text style={[styles.profileBtnText, { color: themeColors.textSecondary }]}>View Profile</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Spec Cards Grid */}
          <View style={styles.specCardsGrid}>
            <View
              style={[
                styles.specCard,
                { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
              ]}
            >
              <Text style={[styles.specCardLabel, { color: themeColors.textMuted }]}>BUDGET</Text>
              <Text style={[styles.specCardVal, { color: themeColors.textPrimary }]}>
                {BUDGET_LABELS[pitchCall.budget_range] || 'Undisclosed'}
              </Text>
            </View>

            <View
              style={[
                styles.specCard,
                { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
              ]}
            >
              <Text style={[styles.specCardLabel, { color: themeColors.textMuted }]}>COMPENSATION</Text>
              <Text style={[styles.specCardVal, { color: compColor.text }]}>
                {COMPENSATION_LABELS[pitchCall.compensation] || 'Negotiable'}
              </Text>
            </View>

            <View
              style={[
                styles.specCard,
                { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
              ]}
            >
              <Text style={[styles.specCardLabel, { color: themeColors.textMuted }]}>NDA STATUS</Text>
              <Text style={[styles.specCardVal, { color: themeColors.textPrimary }]}>
                {pitchCall.nda_required ? 'Required' : 'Not Required'}
              </Text>
            </View>
          </View>

          {/* What They're Looking For (Creative Brief) */}
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
            ]}
          >
            <View style={styles.sectionHeaderRow}>
              <View style={styles.orangeStripe} />
              <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Requirement & Creative Brief</Text>
            </View>
            <Text style={[styles.bodyText, { color: themeColors.textSecondary }]}>
              {pitchCall.requirement_description || pitchCall.description || 'No detailed description provided.'}
            </Text>
          </View>

          {/* Optional Creative Details */}
          {(pitchCall.tone || pitchCall.target_audience || pitchCall.ref_films) && (
            <View
              style={[
                styles.sectionCard,
                { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
              ]}
            >
              <View style={styles.sectionHeaderRow}>
                <View style={styles.purpleStripe} />
                <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Creative Specifications</Text>
              </View>

              {pitchCall.tone && (
                <View
                  style={[
                    styles.detailItemBox,
                    { backgroundColor: isDark ? themeColors.chipBg : '#F9FAFB' },
                  ]}
                >
                  <Text style={styles.detailItemLabel}>TONE & STYLE</Text>
                  <Text style={[styles.detailItemVal, { color: themeColors.textPrimary }]}>{pitchCall.tone}</Text>
                </View>
              )}

              {pitchCall.target_audience && (
                <View
                  style={[
                    styles.detailItemBox,
                    { backgroundColor: isDark ? themeColors.chipBg : '#F9FAFB' },
                  ]}
                >
                  <Text style={styles.detailItemLabel}>TARGET AUDIENCE</Text>
                  <Text style={[styles.detailItemVal, { color: themeColors.textPrimary }]}>{pitchCall.target_audience}</Text>
                </View>
              )}

              {pitchCall.ref_films && (
                <View
                  style={[
                    styles.detailItemBox,
                    { backgroundColor: isDark ? themeColors.chipBg : '#F9FAFB' },
                  ]}
                >
                  <Text style={styles.detailItemLabel}>REFERENCE FILMS / SHOWS</Text>
                  <Text style={[styles.detailItemVal, { color: themeColors.textPrimary }]}>"{pitchCall.ref_films}"</Text>
                </View>
              )}
            </View>
          )}

          {/* Who Can Apply & Specifications */}
          <View
            style={[
              styles.sectionCard,
              { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Eligibility & Target Writers</Text>
            <View style={styles.eligibilityPills}>
              {pitchCall.is_open_to_debut && (
                <View style={styles.debutBadge}>
                  <Icon name="users" size={12} color="#16A34A" />
                  <Text style={styles.debutBadgeText}>Debut Writers Welcome</Text>
                </View>
              )}

              {pitchCall.is_regional_welcome && (
                <View style={styles.regionalBadge}>
                  <Icon name="map-pin" size={12} color="#2563EB" />
                  <Text style={styles.regionalBadgeText}>Regional Stories Welcome</Text>
                </View>
              )}
            </View>

            {languages.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.langListLabel, { color: themeColors.textMuted }]}>ACCEPTED LANGUAGES</Text>
                <View style={styles.langListRow}>
                  <View
                    style={[
                      styles.langBadge,
                      { backgroundColor: themeColors.chipBg, borderColor: themeColors.border },
                    ]}
                  >
                    <Icon name="globe" size={11} color={themeColors.textSecondary} />
                    <Text style={[styles.langBadgeText, { color: themeColors.textSecondary }]}>
                      LANGUAGE // {languages.join(', ').toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {/* Trust & Protection Panel */}
          <View
            style={[
              styles.trustBox,
              { backgroundColor: isDark ? themeColors.chipBg : '#F8FAFC', borderColor: themeColors.border },
            ]}
          >
            <Text style={[styles.trustTitle, { color: themeColors.textMuted }]}>CINECRAFT PITCH PROTECTION</Text>
            <View style={styles.trustRow}>
              <Icon name="shield" size={14} color="#16A34A" />
              <Text style={[styles.trustText, { color: themeColors.textSecondary }]}>
                Your pitch is protected — only the verified call creator can view details.
              </Text>
            </View>
            <View style={styles.trustRow}>
              <Icon name="award" size={14} color="#D97706" />
              <Text style={[styles.trustText, { color: themeColors.textSecondary }]}>
                Every submission is timestamped under Indian IT Act 2000 for IP proof.
              </Text>
            </View>
          </View>

          {/* Bottom CTA Action Bar */}
          <View style={styles.bottomCtaSection}>
            {isOwner ? (
              <TouchableOpacity
                style={[
                  styles.editCallBtn,
                  { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
                ]}
                onPress={() => setShowEditModal(true)}
              >
                <Icon name="edit" size={16} color={themeColors.textPrimary} />
                <Text style={[styles.editCallBtnText, { color: themeColors.textPrimary }]}>Edit This Call</Text>
              </TouchableOpacity>
            ) : alreadySubmitted ? (
              <View style={styles.submittedBanner}>
                <Icon name="check-circle" size={18} color="#16A34A" />
                <Text style={styles.submittedBannerText}>
                  Pitch Submitted — Awaiting Creator Review
                </Text>
              </View>
            ) : isExpired ? (
              <View
                style={[
                  styles.closedBanner,
                  { backgroundColor: isDark ? themeColors.chipBg : '#F1F5F9' },
                ]}
              >
                <Text style={[styles.closedBannerText, { color: themeColors.textMuted }]}>This Pitch Call is Closed</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.submitPitchBtn}
                onPress={() =>
                  navigation.navigate('SubmitPitch', {
                    pitchId: pitchCall.id,
                    pitchTitle: pitchCall.title,
                  })
                }
              >
                <Icon name="sparkles" size={18} color="#FFFFFF" />
                <Text style={styles.submitPitchBtnText}>Submit Your Pitch Proposal</Text>
              </TouchableOpacity>
            )}
          </View>
        </TabletContainer>
      </ScrollView>

      {/* Edit Pitch Call Modal */}
      <CreatePitchModal
        visible={showEditModal}
        onClose={() => setShowEditModal(false)}
        initialData={pitchCall}
        pitchCallId={pitchCall.id}
        onCreated={() => {
          setShowEditModal(false);
          // Refetch
        }}
      />
      <UniversalShareSheet
        visible={showShareSheet}
        onClose={() => setShowShareSheet(false)}
        title={pitchCall?.title || 'Pitch Call'}
        shareUrl={`https://cinecraftconnect.com/pitch/${pitchId}`}
        itemType="pitch"
        itemData={pitchCall}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  centerLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: 14,
    paddingBottom: 40,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginBottom: 10,
  },
  iconCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
  },
  topAccentStripe: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: ORANGE,
  },
  statusBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  formatTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  formatTagBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  genreBadge: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  genreBadgeText: {
    color: '#64748B',
    fontSize: 9.5,
    fontWeight: '700',
  },
  langBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    gap: 4,
  },
  langBadgeText: {
    color: '#475569',
    fontSize: 9.5,
    fontWeight: '700',
  },
  guildTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  guildTagBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#D97706',
  },
  openTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 5,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  openTagBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#16A34A',
  },
  closedTagBadge: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  closedTagBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#DC2626',
  },
  ndaTagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  ndaTagBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#D97706',
  },
  heroTitle: {
    color: INK,
    fontSize: 21,
    fontFamily: 'Lora-Bold',
    fontWeight: '700',
    lineHeight: 28,
    marginTop: 2,
    marginBottom: 10,
  },
  heroPostedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  heroPostedText: {
    fontSize: 12,
    fontWeight: '600',
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaItemText: {
    fontSize: 12.5,
    color: '#64748B',
    fontWeight: '600',
  },
  creatorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  creatorInfoGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  creatorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
  },
  creatorAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorAvatarText: {
    color: ORANGE,
    fontSize: 18,
    fontWeight: '800',
  },
  creatorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  creatorName: {
    fontSize: 15,
    fontWeight: '800',
    color: INK,
  },
  creatorCraftText: {
    fontSize: 12,
    color: ORANGE,
    fontWeight: '700',
    marginTop: 1,
  },
  creatorLocationText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  creatorBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  msgBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    height: 38,
    borderRadius: 10,
    gap: 6,
  },
  msgBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: INK,
  },
  profileBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    height: 38,
    borderRadius: 10,
  },
  profileBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#64748B',
  },
  specCardsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  specCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
  },
  specCardLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  specCardVal: {
    fontSize: 12,
    fontWeight: '800',
    color: INK,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  orangeStripe: {
    width: 4,
    height: 16,
    borderRadius: 2,
    backgroundColor: ORANGE,
  },
  purpleStripe: {
    width: 4,
    height: 16,
    borderRadius: 2,
    backgroundColor: '#7C3AED',
  },
  sectionTitle: {
    color: INK,
    fontSize: 16,
    fontWeight: '800',
  },
  bodyText: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 21,
  },
  detailItemBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  detailItemLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: ORANGE,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  detailItemVal: {
    fontSize: 13,
    color: INK,
    lineHeight: 18,
  },
  eligibilityPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  debutBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 5,
  },
  debutBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#16A34A',
  },
  regionalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 5,
  },
  regionalBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
  },
  langListLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  langListRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  langPillText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '700',
  },
  trustBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    gap: 8,
  },
  trustTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trustText: {
    flex: 1,
    fontSize: 12,
    color: '#475569',
    lineHeight: 16,
  },
  bottomCtaSection: {
    marginTop: 10,
  },
  submitPitchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORANGE,
    height: 50,
    borderRadius: 14,
    gap: 8,
    elevation: 3,
  },
  submitPitchBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  submittedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 14,
    height: 48,
    gap: 8,
  },
  submittedBannerText: {
    color: '#16A34A',
    fontSize: 13.5,
    fontWeight: '800',
  },
  closedBanner: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 14,
    height: 48,
  },
  closedBannerText: {
    color: '#64748B',
    fontSize: 13.5,
    fontWeight: '800',
  },
  editCallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    height: 48,
    gap: 8,
  },
  editCallBtnText: {
    color: INK,
    fontSize: 14,
    fontWeight: '800',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: INK,
  },
});

export default PitchDetailScreen;
