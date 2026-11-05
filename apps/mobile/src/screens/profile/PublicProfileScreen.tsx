import { fetchProfileExtras, mergeProfileExtras } from '../../utils/profileExtras';
import React, { useState, useEffect, useRef } from 'react';
import { scrollChrome } from '../../components/common/scrollChrome';
import { Toast } from '../../contexts/ToastContext';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Linking,
  Share,
  InteractionManager,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Icon } from '../../components/common/Icon';
import { VerificationBadge } from '../../components/common/VerificationBadge';
import { TabletContainer } from '../../components/common/TabletContainer';
import { CreditLine } from '../../components/common/CreditLine';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useAppRole } from '../../hooks/useAppRole';
import { useResponsive } from '../../hooks/useResponsive';
import { useHeaderInset } from '../../hooks/useHeaderInset';
import { useAccountType } from '../../hooks/useAccountType';
import { CachedImage } from '../../components/common/CachedImage';

import { ReportModal } from '../../components/modals/ReportModal';
import { ConnectNoteModal } from '../../components/modals/ConnectNoteModal';
import { IntroductionModal } from '../../components/modals/NetworkModals';
import { AvailabilityBadge } from '../../components/network/NetworkParts';
import { AwardsPanel, ProfileContextStrip, ProfileHighlightsView, RecommendationsPanel, useProfileHighlights, useSkillEndorsements } from '../../components/profile/ProfileExtras';
import { RequestDatesModal, InviteToProjectModal, RecommendModal, AddToShortlistModal } from '../../components/modals/CollaborationModals';
import { SocialLinksRow } from '../../components/profile/SocialLinksRow';
import { UniversalShareSheet } from '../../components/common/UniversalShareSheet';
import { friendlyError } from '@cinecraft/core';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

export const PublicProfileScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  const { themeColors, isDark } = useUserSettings();
  const { isTablet, isLandscape, width: winW, maxContentWidth } = useResponsive();
  const headerInset = useHeaderInset();
  const colW = isTablet ? Math.min(winW, maxContentWidth) : winW;
  const tabPad = isTablet ? 24 : 16;
  const gridCols = isTablet ? (isLandscape ? 5 : 4) : 3;
  const gridGap = isTablet ? 10 : 8;
  const gridCellW = Math.floor((colW - tabPad * 2 - gridGap * (gridCols - 1)) / gridCols) - 1;
  const sideBySide = isTablet && isLandscape;
  const { isFan: isViewerFan } = useAccountType();
  const { isInternal } = useAppRole(); // staff accounts do not connect, follow or message
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);

  const {
    creatorId,
    userId,
    id,
    username: initialUsername,
    creatorName: initialName,
    craft: initialCraft,
    location: initialLocation,
    bio: initialBio,
    avatarUrl: initialAvatar,
    tab: initialTab,
  } = route.params || {};

  const targetUserId = creatorId || userId || id;

  // Profile Data State
  const [profileData, setProfileData] = useState<any>({
    id: targetUserId,
    full_name: initialName || 'Profile',
    username: initialUsername || 'user',
    craft: initialCraft || 'Filmmaker',
    location: initialLocation || '',
    bio: initialBio || '',
    avatar_url: initialAvatar || null,
    is_verified: false,
    website: '',
    social_links: {},
    account_type: 'creator',
  });

  const [isConnected, setIsConnected] = useState(false);
  const [requestState, setRequestState] = useState<'none' | 'sent' | 'received'>('none');
  const [noteOpen, setNoteOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);
  const [availability, setAvailability] = useState<any>(null);
  // what the viewer may see: ok | private | unavailable | blocked_by_me | self | not_found
  const [access, setAccess] = useState<any>(null);
  const { highlights } = useProfileHighlights(targetUserId);
  const { info: skillEndorsements, toggle: toggleEndorsement } = useSkillEndorsements(targetUserId);
  const [connectionRowId, setConnectionRowId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followersCount, setFollowersCount] = useState(0);
  const [connectionsCount, setConnectionsCount] = useState(0);

  // Tab & Grid state
  const [activeTab, setActiveTab] = useState<'posts' | 'portfolio' | 'credits' | 'skills' | 'experience' | 'awards' | 'recommendations'>(
    (['posts', 'portfolio', 'credits', 'skills', 'experience', 'awards', 'recommendations'].includes(initialTab) ? initialTab : 'posts') as any
  );
  const [canMessage, setCanMessage] = useState(false);
  const [workModal, setWorkModal] = useState<null | 'dates' | 'invite' | 'recommend' | 'shortlist'>(null);
  const [recKey, setRecKey] = useState(0);

  // Tab Data States
  const [posts, setPosts] = useState<any[]>([]);
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [credits, setCredits] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [experience, setExperience] = useState<any[]>([]);

  // availability: the database only returns it when this person lets me see it
  useEffect(() => {
    if (!targetUserId) return;
    (getSupabaseClient() as any).rpc('get_profile_availability', { p_user: targetUserId })
      .then(({ data }: any) => setAvailability(data || null));
  }, [targetUserId]);

  // may I message this person? (same rules the server enforces on send)
  useEffect(() => {
    if (!targetUserId) return;
    (getSupabaseClient() as any).rpc('can_message_user', { p_user: targetUserId }).then(({ data }: any) => setCanMessage(!!data));
  }, [targetUserId]);

  // access state and real counts from the server
  useEffect(() => {
    if (!targetUserId) return;
    let alive = true;
    const db = getSupabaseClient() as any;
    setAccess(null);
    db.rpc('get_profile_access', { p_user: targetUserId }).then(({ data }: any) => {
      if (!alive) return;
      setAccess(data || null);
      if (data?.state === 'self') navigation.navigate('Profile');
    });
    db.rpc('get_profile_counts', { p_user: targetUserId }).then(({ data }: any) => {
      if (!alive || !data) return;
      setConnectionsCount(Number(data.connections || 0));
      setFollowersCount(Number(data.followers || 0));
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId]);

  useEffect(() => {
    if (!targetUserId) {
      setLoading(false);
      return;
    }

    let active = true;
    const task = InteractionManager.runAfterInteractions(async () => {
      try {
        setLoading(true);
        const supabase = getSupabaseClient();

        // Every section below is independent: request them all at once instead of one after another.
        const viewerPromise = supabase.auth.getSession().then((r) => r?.data?.session?.user || null).catch(() => null);

        const profilePromise = (async () => {
          const { data: profDataRaw } = await supabase.from('profiles').select('id, updated_at, username, full_name, avatar_url, website, bio, location, experience, craft, account_type, accept_direct_pitches, onboarding_completed, is_internal, public_key, is_verified, is_banned, is_official_team').eq('id', targetUserId).maybeSingle();
          return profDataRaw
            ? mergeProfileExtras(profDataRaw as any, await fetchProfileExtras(targetUserId))
            : profDataRaw;
        })();

        // Record profile view (fire and forget)
        viewerPromise.then((user) => {
          // only signed-in views of other people's profiles are counted (the server dedupes)
          if (targetUserId && user && user.id !== targetUserId) {
            Promise.resolve((supabase as any).rpc('record_profile_view', { p_profile: targetUserId })).catch(() => { });
          }
        });

        const relationPromise = (async () => {
          const user = await viewerPromise;
          if (!user) return null;
          const [connRes, followRes]: any[] = await Promise.all([
            (supabase.from('user_connections') as any)
              .select('id, status, follower_id')
              .or(`follower_id.eq.${user.id},following_id.eq.${user.id}`)
              .or(`follower_id.eq.${targetUserId},following_id.eq.${targetUserId}`)
              .maybeSingle(),
            (supabase.from('user_follows') as any)
              .select('id')
              .eq('follower_id', user.id)
              .eq('following_id', targetUserId)
              .maybeSingle(),
          ]);
          const row = connRes?.data;
          return {
            connected: row?.status === 'accepted',
            pending: row?.status === 'pending' ? (row.follower_id === user.id ? 'sent' : 'received') : null,
            rowId: row?.id || null,
            following: !!followRes?.data,
          };
        })();

        const sectionsPromise = Promise.all([
          (supabase.from('posts') as any).select('*').eq('author_id', targetUserId).order('created_at', { ascending: false }),
          (supabase.from('portfolio_items') as any).select('*').eq('user_id', targetUserId).order('created_at', { ascending: false }),
          ((supabase as any).from('project_credits') as any)
            .select('*, profiles:verifier_id (full_name, username)')
            .eq('user_id', targetUserId)
            .eq('status', 'accepted')
            .order('created_at', { ascending: false }),
          (supabase.from('user_skills') as any).select('*').eq('user_id', targetUserId),
          (supabase.from('user_experience') as any).select('*').eq('user_id', targetUserId).order('start_date', { ascending: false }),
          (supabase.from('user_follows') as any).select('id', { count: 'exact', head: true }).eq('following_id', targetUserId),
          (supabase as any).rpc('get_connection_counts', { p_user: targetUserId }),
        ]);

        // Show the header as soon as the profile row is back; fill the tabs as their data arrives.
        const profData: any = await profilePromise;
        if (profData && active) {
          setProfileData((prev: any) => ({
            ...prev,
            ...profData,
            full_name: profData.full_name || prev.full_name,
            username: profData.username || prev.username,
            craft: profData.craft || prev.craft,
            bio: profData.bio || prev.bio,
            location: profData.location || prev.location,
            avatar_url: profData.avatar_url || prev.avatar_url,
            account_type: profData.account_type || 'creator',
          }));
        }
        if (active) setLoading(false);

        const [postsRes, portRes, credRes, skillRes, expRes, followsRes, connsRes]: any[] = await sectionsPromise;
        if (active) {
          if (postsRes?.data) setPosts(postsRes.data);
          if (portRes?.data) setPortfolio(portRes.data);
          if (credRes?.data) setCredits(credRes.data);
          if (skillRes?.data) setSkills(skillRes.data);
          if (expRes?.data) setExperience(expRes.data);
          if (typeof followsRes?.count === 'number') setFollowersCount(followsRes.count);
          if (connsRes?.data && typeof connsRes.data.connections === 'number') setConnectionsCount(connsRes.data.connections);
        }

        const relation = await relationPromise;
        if (relation && active) {
          if (relation.connected) setIsConnected(true);
          if (relation.pending) setRequestState(relation.pending as 'sent' | 'received');
          if (relation.rowId) setConnectionRowId(relation.rowId);
          if (relation.following) setIsFollowing(true);
        }
      } catch (e) {
        console.warn('[PublicProfile] Error loading data:', e);
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
      task.cancel();
    };
  }, [targetUserId]);

  const p = profileData;
  const isTargetFan = (p.account_type || p.user_type) === 'fan';
  const isTargetStudio = (p.account_type || p.user_type) === 'studio';
  const isFan = isTargetFan;
  const isStudio = isTargetStudio;
  const isFollowRelationship = isViewerFan || isTargetFan;

  // one connect/follow action at a time: a double tap must not send two writes
  const connectBusyRef = useRef(false);

  const performDisconnect = async (userId: string) => {
    if (connectBusyRef.current) return;
    connectBusyRef.current = true;
    try {
      const db = getSupabaseClient().from('user_connections') as any;
      const { error } = await db.delete().or(`follower_id.eq.${userId},following_id.eq.${userId}`).or(`follower_id.eq.${targetUserId},following_id.eq.${targetUserId}`);
      if (error) throw error;
      setIsConnected(false);
      setRequestState('none');
      setConnectionRowId(null);
      setConnectionsCount(prev => Math.max(0, prev - 1));
      Toast.success('Connection removed');
    } catch (e: any) {
      Alert.alert('Error', friendlyError(e, 'Could not remove the connection.'));
    } finally {
      connectBusyRef.current = false;
    }
  };

  const handleConnectOrFollow = async () => {
    if (connectBusyRef.current) return;
    connectBusyRef.current = true;
    try {
      const supabase = getSupabaseClient();
      // the saved session is read locally (getUser() is a network call and made the button feel slow)
      const user = (await supabase.auth.getSession()).data.session?.user ?? null;
      if (!user) {
        Alert.alert('Authentication required', 'Please sign in to continue.');
        return;
      }

      if (isFollowRelationship) {
        // Follow/unfollow: the button flips at once and goes back if the write fails.
        const wasFollowing = isFollowing;
        setIsFollowing(!wasFollowing);
        setFollowersCount(prev => (wasFollowing ? Math.max(0, prev - 1) : prev + 1));
        const { error } = wasFollowing
          ? await (supabase.from('user_follows') as any).delete().eq('follower_id', user.id).eq('following_id', targetUserId)
          : await (supabase.from('user_follows') as any).insert({ follower_id: user.id, following_id: targetUserId });
        if (error && error.code !== '23505') {
          setIsFollowing(wasFollowing);
          setFollowersCount(prev => (wasFollowing ? prev + 1 : Math.max(0, prev - 1)));
          throw error;
        }
      } else {
        const db = supabase.from('user_connections') as any;
        if (isConnected) {
          // removing a connection cannot simply be undone (they would have to accept again), so this one asks first
          const userId = user.id;
          Alert.alert('Remove connection?', 'You will no longer be connected. To connect again, a new request is needed.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => { void performDisconnect(userId); } },
          ]);
        } else if (requestState === 'sent' && connectionRowId) {
          const rowId = connectionRowId;
          Alert.alert('Request pending', 'Your connection request is waiting for a reply. Withdraw it?', [
            { text: 'Keep request', style: 'cancel' },
            {
              text: 'Withdraw',
              style: 'destructive',
              onPress: async () => {
                try {
                  const { error: delErr } = await db.delete().eq('id', rowId);
                  if (delErr) throw delErr;
                  setRequestState('none');
                  setConnectionRowId(null);
                  Toast.success('Request withdrawn', 'Your connection request was withdrawn.');
                } catch (e2: any) {
                  Alert.alert('Error', friendlyError(e2, 'Could not withdraw request.'));
                }
              },
            },
          ]);
        } else if (requestState === 'received' && connectionRowId) {
          const { error } = await db.update({ status: 'accepted' }).eq('id', connectionRowId);
          if (error) throw error;
          setIsConnected(true);
          setRequestState('none');
          setConnectionsCount(prev => prev + 1);
          Toast.success('Connected', 'You are now connected.');
        } else {
          setNoteOpen(true);
        }
      }
    } catch (e: any) {
      Alert.alert('Error', friendlyError(e, 'Could not update connection status.'));
    } finally {
      connectBusyRef.current = false;
    }
  };

  const sendConnectionRequest = async (note?: string) => {
    if (connectBusyRef.current) return;
    connectBusyRef.current = true;
    try {
      const supabase = getSupabaseClient();
      const user = (await supabase.auth.getSession()).data.session?.user ?? null;
      if (!user) return;
      const { data, error } = await (supabase.from('user_connections') as any)
        .insert({ follower_id: user.id, following_id: targetUserId, status: 'pending', note: note || null })
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (data?.id) {
        setRequestState('sent');
        setConnectionRowId(data.id);
        Alert.alert('Request sent', 'They will be notified. You are connected once they accept.');
      } else {
        // they had already asked you: your request simply accepted theirs
        setIsConnected(true);
        setRequestState('none');
        setConnectionsCount(prev => prev + 1);
        Alert.alert('Connected', 'You are now connected.');
      }
    } catch (e: any) {
      Alert.alert('Error', friendlyError(e, 'Could not send the request.'));
    } finally {
      connectBusyRef.current = false;
    }
  };

  const handleMessage = () => {
    navigation.navigate('Conversation', {
      partnerId: targetUserId,
      partnerName: profileData.full_name || profileData.username,
      partnerAvatar: profileData.avatar_url,
      partnerCraft: profileData.craft,
    });
  };

  const handleDirectPitch = () => {
    navigation.navigate('SubmitPitch', {
      pitchId: 'direct',
      targetProducerId: targetUserId,
      targetProducerName: profileData.full_name || profileData.username,
    });
  };

  const handleShareProfile = () => {
    setShowShareSheet(true);
  };

  if (access && (access.state === 'unavailable' || access.state === 'not_found' || access.state === 'private' || access.state === 'blocked_by_me')) {
    const name = p.full_name || p.username || 'this person';
    const unblock = async () => {
      const db = getSupabaseClient() as any;
      const { data: { session } } = await db.auth.getSession();
      if (!session) return;
      const { error } = await db.from('blocked_users').delete().eq('user_id', session.user.id).eq('blocked_user_id', targetUserId);
      if (error) return Alert.alert('Could not unblock', friendlyError(error));
      setAccess(null);
      navigation.replace('PublicProfile', { userId: targetUserId });
    };
    return (
      <View style={{ flex: 1, backgroundColor: themeColors.bgScreen }}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ padding: 16, paddingTop: 48 }} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Icon name="arrow-left" size={20} color={themeColors.textPrimary} />
        </TouchableOpacity>
        <View style={{ alignItems: 'center', paddingHorizontal: 28, gap: 8, marginTop: 24 }}>
          {access.state !== 'unavailable' && access.state !== 'not_found' && (
            <>
              {p.avatar_url ? <CachedImage uri={p.avatar_url} style={{ width: 96, height: 96, borderRadius: 48 }} /> : null}
              <Text style={{ color: themeColors.textPrimary, fontSize: 20, fontWeight: '700' }}>{name}</Text>
              {!!p.craft && <Text style={{ color: themeColors.textSecondary }}>{p.craft}</Text>}
            </>
          )}
          <Text style={{ color: themeColors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 14, textAlign: 'center' }}>
            {access.state === 'private' ? 'This profile is private' : access.state === 'blocked_by_me' ? 'You blocked ' + name : 'This profile is unavailable'}
          </Text>
          <Text style={{ color: themeColors.textMuted, textAlign: 'center', fontSize: 14 }}>
            {access.state === 'private'
              ? (access.visibility === 'connections' ? 'Connect with ' + name + ' to see their work, skills and credits.' : name + ' keeps their work private.')
              : access.state === 'blocked_by_me'
                ? 'They cannot message you or send you requests. Unblock them to see their work and connect again.'
                : 'It may have been removed or is not visible to you.'}
          </Text>
          {access.state === 'private' && !isTargetFan && !isViewerFan && !isConnected && requestState === 'none' && (
            <TouchableOpacity onPress={() => sendConnectionRequest()} style={{ marginTop: 10, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 12, backgroundColor: ORANGE }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Connect</Text>
            </TouchableOpacity>
          )}
          {access.state === 'private' && requestState === 'sent' && <Text style={{ color: themeColors.textMuted, marginTop: 8 }}>Request sent</Text>}
          {access.state === 'blocked_by_me' && (
            <TouchableOpacity onPress={unblock} style={{ marginTop: 10, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: themeColors.border }}>
              <Text style={{ color: themeColors.textPrimary, fontWeight: '700' }}>Unblock</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  return (
    <TabletContainer
      backgroundColor={themeColors.bgScreen}
      maxWidth="content"
      header={
        <View style={[styles.igTopHeader, { backgroundColor: themeColors.bgScreen, borderBottomColor: themeColors.border, paddingHorizontal: 16 + headerInset }]}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Icon name="arrow-left" size={20} color={themeColors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.igTopUserRow}>
            <Text style={[styles.igTopUsername, { color: themeColors.textPrimary }]} numberOfLines={1}>
              {String(p.username || 'profile').toLowerCase()}
            </Text>
            {p.is_verified && (
              <View style={{ marginLeft: 4 }}>
                <VerificationBadge size="sm" />
              </View>
            )}
          </View>

          <View style={styles.igTopActionsRow}>
            {profileData?.account_type !== 'fan' && (
              <TouchableOpacity
                style={styles.igTopActionBtn}
                onPress={() => navigation.navigate('AvailabilityCalendar', { userId: targetUserId, userName: profileData?.full_name || profileData?.username })}
                accessibilityLabel="View availability calendar"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="calendar" size={20} color={ORANGE} strokeWidth={2} />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.igTopActionBtn}
              onPress={handleShareProfile}
              accessibilityLabel="Share profile"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="share" size={20} color={themeColors.textPrimary} strokeWidth={2} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.igTopActionBtn}
              onPress={() => setIsReportOpen(true)}
              accessibilityLabel="Report user"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="flag" size={20} color={themeColors.textPrimary} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>
      }
    >
      <ScrollView {...scrollChrome} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Info Section with Overlapping Avatar */}
        <View style={[styles.linkedinProfileSection, isTablet && styles.tabletProfileSection, sideBySide && styles.tabletProfileSectionRow]}>
         <View style={[isTablet && styles.tabletHeaderLeft, sideBySide && { flex: 1 }]}>
          {/* Avatar Row */}
          <View style={[styles.linkedinAvatarRow, isTablet && { marginBottom: 0 }]}>
            <View style={[styles.linkedinAvatarWrapper, { marginTop: 20 }]}>
              <View
                style={[
                  styles.linkedinAvatarRing,
                  {
                    width: isTablet ? 128 : 108,
                    height: isTablet ? 128 : 108,
                    borderRadius: isTablet ? 64 : 54,
                    borderColor: themeColors.bgScreen,
                  },
                ]}
              >
                {p.avatar_url ? (
                  <CachedImage
                    source={{ uri: p.avatar_url }}
                    style={styles.linkedinAvatarImg}
                  />
                ) : (
                  <View style={[styles.linkedinAvatarImg, styles.linkedinAvatarFallback]}>
                    <Text style={[styles.linkedinAvatarFallbackText, { fontSize: isTablet ? 42 : 36 }]}>
                      {(p.full_name || p.username || 'C').charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Name & Headline Area */}
          <View style={[styles.linkedinBioSection, isTablet && styles.tabletBioSection]}>
            <View style={styles.linkedinNameRow}>
              <Text style={[styles.linkedinFullName, { color: themeColors.textPrimary }]}>
                {p.full_name || p.username}
              </Text>
              {p.is_verified && <VerificationBadge size="sm" />}
            </View>

            {p.craft ? (
              <Text style={[styles.linkedinHeadline, { color: themeColors.textPrimary }]}>
                {p.craft}
              </Text>
            ) : null}

            {/* Badges & Location Row */}
            <View style={styles.linkedinBadgesRow}>
              {isFan ? (
                <View style={styles.igFanBadge}>
                  <Icon name="star" size={10} color="#D97706" />
                  <Text style={styles.igFanBadgeText}>FAN ACCOUNT</Text>
                </View>
              ) : (
                <View style={styles.igProBadge}>
                  <Icon name="zap" size={10} color={ORANGE} />
                  <Text style={styles.igProBadgeText}>{isStudio ? 'STUDIO' : 'PRO'}</Text>
                </View>
              )}

              {p.location ? (
                <View style={styles.linkedinLocRow}>
                  <Icon name="map-pin" size={11} color={themeColors.iconSecondary} />
                  <Text style={[styles.linkedinLocText, { color: themeColors.textSecondary }]} numberOfLines={1}>
                    {p.location}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Bio Text */}
            {p.bio ? (
              <Text style={[styles.igBioText, { color: themeColors.textPrimary }]}>
                {p.bio}
              </Text>
            ) : null}

            {/* Website + social links as icon buttons */}
            <SocialLinksRow profile={p} />
          </View>

         </View>
         <View style={sideBySide ? styles.tabletHeaderRight : undefined}>
          {/* Neat Posts, Followers & Connections Stats Box (Placed directly ABOVE action buttons) */}
          <View
            style={[
              styles.neatStatsRow,
              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC', borderColor: themeColors.border },
            ]}
          >
            <TouchableOpacity
              style={styles.neatStatItem}
              onPress={() => setActiveTab('posts')}
              activeOpacity={0.7}
            >
              <Text style={[styles.neatStatNum, { color: themeColors.textPrimary }]}>
                {posts.length}
              </Text>
              <Text style={[styles.neatStatLbl, { color: themeColors.textSecondary }]}>
                Posts
              </Text>
            </TouchableOpacity>

            <View style={[styles.neatStatDivider, { backgroundColor: themeColors.border }]} />

            <TouchableOpacity style={styles.neatStatItem} activeOpacity={0.7}>
              <Text style={[styles.neatStatNum, { color: themeColors.textPrimary }]}>
                {followersCount}
              </Text>
              <Text style={[styles.neatStatLbl, { color: themeColors.textSecondary }]}>
                {followersCount === 1 ? 'Follower' : 'Followers'}
              </Text>
            </TouchableOpacity>

            <View style={[styles.neatStatDivider, { backgroundColor: themeColors.border }]} />

            <TouchableOpacity style={styles.neatStatItem} activeOpacity={0.7}>
              <Text style={[styles.neatStatNum, { color: themeColors.textPrimary }]}>
                {connectionsCount}
              </Text>
              <Text style={[styles.neatStatLbl, { color: themeColors.textSecondary }]}>
                {connectionsCount === 1 ? 'Connection' : 'Connections'}
              </Text>
            </TouchableOpacity>
          </View>

            {!!availability && availability.status !== 'not_looking' && (
              <View style={{ alignItems: 'center', marginBottom: 8, gap: 4 }}>
                <AvailabilityBadge status={availability.status} />
                {availability.status === 'booked' && !!availability.booked_until && (
                  <Text style={{ color: themeColors.textMuted, fontSize: 12 }}>Booked until {new Date(availability.booked_until).toLocaleDateString()}</Text>
                )}
                {availability.status === 'open' && (availability.rate_min != null || availability.rate_max != null) && (
                  <Text style={{ color: themeColors.textSecondary, fontSize: 12 }}>
                    {availability.rate_currency} {availability.rate_min ?? ''}{availability.rate_max != null ? ` – ${availability.rate_max}` : '+'} / day
                  </Text>
                )}
                {(availability.cities || []).length > 0 && (
                  <Text style={{ color: themeColors.textMuted, fontSize: 12 }}>{(availability.cities || []).join(' · ')}</Text>
                )}
              </View>
            )}

            {!isFan && <View style={{ marginHorizontal: -14, marginBottom: 6 }}><ProfileHighlightsView highlights={highlights} isOwn={false} /></View>}
            <View style={{ marginHorizontal: -14 }}>
              <ProfileContextStrip
                userId={targetUserId}
                showContext
                onOpenProfile={(id, name) => navigation.push ? navigation.push('PublicProfile', { userId: id, creatorName: name }) : navigation.navigate('PublicProfile', { userId: id, creatorName: name })}
                onOpenPage={(slug) => navigation.navigate('CompanyPageDetail', { pageSlug: slug })}
              />
            </View>

            {!isFan && !isViewerFan && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 6, marginBottom: 6 }}>
                {/* Introduce: original rule, not connected and no pending request (outer wrapper already excludes fans) */}
                {!isFan && !isViewerFan && !isConnected && requestState === 'none' && (
                  <TouchableOpacity onPress={() => setIntroOpen(true)} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Ask for an introduction"
                    style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: themeColors.border, backgroundColor: themeColors.chipBg }}>
                    <Text style={{ color: themeColors.textPrimary, fontSize: 12, fontWeight: '700' }}>Introduce</Text>
                  </TouchableOpacity>
                )}
                {([['dates', 'Request dates'], ['invite', 'Invite to project'], ...(isConnected ? [['recommend', 'Recommend']] : []), ['shortlist', 'Shortlist']] as [string, string][]).map(([k, l]) => (
                  <TouchableOpacity key={k} onPress={() => setWorkModal(k as any)} activeOpacity={0.8}
                    style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: themeColors.border, backgroundColor: themeColors.chipBg }}>
                    <Text style={{ color: themeColors.textPrimary, fontSize: 12, fontWeight: '700' }}>{l}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Action Buttons Row: Connect / Message / Direct Pitch, evenly sized, no scrolling */}
            <View style={styles.simpleActionButtonsRow}>
              {!isInternal && (
              <TouchableOpacity
                style={[
                  styles.simpleActionButton,
                  styles.connectPillBtn,
                  (isFan || isViewerFan ? isFollowing : (isConnected || requestState === 'sent')) && styles.connectedPillBtn,
                ]}
                onPress={handleConnectOrFollow}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={!(isFan || isViewerFan) && !isConnected && requestState === 'sent' ? 'Requested' : undefined}
                accessibilityHint={!(isFan || isViewerFan) && !isConnected && requestState === 'sent' ? 'Tap to cancel the request' : undefined}
              >
                <Icon
                  name={(isFan || isViewerFan ? isFollowing : (isConnected || requestState === 'sent')) ? (requestState === 'sent' ? 'clock' : 'check') : 'user-plus'}
                  size={14}
                  color={(isFan || isViewerFan ? isFollowing : (isConnected || requestState === 'sent')) ? '#059669' : '#FFFFFF'}
                  strokeWidth={2.5}
                />
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[styles.connectPillText, styles.actionLabel, (isFan || isViewerFan ? isFollowing : (isConnected || requestState === 'sent')) && styles.connectedPillText]}>
                  {isFan || isViewerFan ? (isFollowing ? 'Following' : 'Follow') : isConnected ? 'Connected' : requestState === 'sent' ? 'Requested' : requestState === 'received' ? 'Accept' : 'Connect'}
                </Text>
              </TouchableOpacity>
              )}

              {!isInternal && (canMessage || isConnected) && (
              <TouchableOpacity
                style={[
                  styles.simpleActionButton,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                    borderColor: themeColors.border,
                  },
                ]}
                onPress={handleMessage}
                activeOpacity={0.7}
              >
                <Icon name="message-square" size={14} color={themeColors.textPrimary} />
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[styles.simpleActionButtonText, styles.actionLabel, { color: themeColors.textPrimary }]}>
                  Message
                </Text>
              </TouchableOpacity>
              )}



              {/* Direct Pitch: not for fans or staff, and only if this person accepts direct pitches */}
              {!isViewerFan && !isInternal && !isTargetFan && profileData.accept_direct_pitches !== false && (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Send a direct pitch"
                  style={[styles.simpleActionButton, styles.directPitchPillBtn]}
                  onPress={handleDirectPitch}
                  activeOpacity={0.8}
                >
                  <Icon name="zap" size={14} color="#FFFFFF" strokeWidth={2.5} />
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[styles.directPitchPillText, styles.actionLabel]}>Direct Pitch</Text>
                </TouchableOpacity>
              )}
            </View>
         </View>
        </View>

          {/* Horizontal Scroll Tabs Bar */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={[styles.igTabsScrollView, { borderTopColor: themeColors.border, borderBottomColor: themeColors.border }]}
            contentContainerStyle={styles.igTabsContainer}
          >
            {([
              { id: 'posts', label: 'POSTS', icon: 'grid', count: posts.length },
              ...(!isFan ? [
                { id: 'portfolio', label: 'PORTFOLIO', icon: 'image', count: portfolio.length },
                { id: 'credits', label: 'CREDITS', icon: 'award', count: credits.length },
                { id: 'skills', label: 'SKILLS', icon: 'zap', count: skills.length },
                { id: 'experience', label: 'EXPERIENCE', icon: 'briefcase', count: experience.length },
                { id: 'awards', label: 'AWARDS', icon: 'award', count: 0 },
                { id: 'recommendations', label: 'RECOMMENDATIONS', icon: 'message-square', count: 0 },
              ] : []),
            ] as const).filter((t) => !highlights.hidden_sections.includes(t.id)).map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[
                    styles.igTabItem,
                    isActive && styles.igTabItemActive,
                  ]}
                  onPress={() => setActiveTab(tab.id as any)}
                  activeOpacity={0.7}
                >
                  <Icon
                    name={tab.icon}
                    size={15}
                    color={isActive ? ORANGE : themeColors.textSecondary}
                    strokeWidth={isActive ? 2.3 : 1.8}
                  />
                  <Text
                    style={[
                      styles.igTabLabel,
                      { color: isActive ? ORANGE : themeColors.textSecondary },
                      isActive && styles.igTabLabelActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                  {tab.count > 0 && (
                    <View
                      style={[
                        styles.igTabBadge,
                        {
                          backgroundColor: isActive
                            ? ORANGE
                            : isDark
                            ? 'rgba(255,255,255,0.1)'
                            : '#E2E8F0',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.igTabBadgeText,
                          { color: isActive ? '#FFFFFF' : themeColors.textSecondary },
                        ]}
                      >
                        {tab.count}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Active Tab Content Area */}
          <View style={[styles.tabContentArea, { paddingHorizontal: tabPad }]}>
            {loading ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color={ORANGE} />
              </View>
            ) : (
              <>
                {/* POSTS TAB */}
                {activeTab === 'posts' && (
                  <View>
                    {posts.length > 0 && (
                      <View style={styles.gridModeBar}>
                        <Text style={styles.gridCountText}>{posts.length} Posts</Text>
                      </View>
                    )}

                    {posts.length === 0 ? (
                      <View style={styles.emptyStateBox}>
                        <Icon name="camera" size={32} color={themeColors.iconMuted} />
                        <Text style={[styles.emptyStateTitle, { color: themeColors.textPrimary }]}>No Posts Yet</Text>
                        <Text style={[styles.emptyStateDesc, { color: themeColors.textSecondary }]}>
                          This creator hasn't published any public posts.
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.threeColumnGrid, { gap: gridGap }]}>
                        {posts.map(post => {
                          const mediaUrl = post.media_url || (Array.isArray(post.media_urls) ? post.media_urls[0] : null);
                          return (
                            <TouchableOpacity
                              key={post.id}
                              accessibilityRole="button"
                              accessibilityLabel={`Post by ${profileData?.full_name || profileData?.username || 'this user'}: ${String(post.content || '').trim().slice(0, 60) || (mediaUrl ? 'photo' : 'text post')}`}
                              style={[styles.gridSquareCell, { width: gridCellW }, isDark && styles.gridSquareCellDark]}
                              onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
                              activeOpacity={0.8}
                            >
                              {mediaUrl ? (
                                <View style={{ width: '100%', height: '100%', position: 'relative' }}>
                                  <CachedImage uri={mediaUrl} style={styles.gridCellImg} />
                                  {!!post.is_pinned && (
                                    <View style={styles.gridCellPinBadge}>
                                      <Icon name="pin" size={12} color="#FFFFFF" fill="#FFFFFF" />
                                    </View>
                                  )}
                                </View>
                              ) : (
                                <View style={styles.gridCellTextFallback}>
                                  {!!post.is_pinned && (
                                    <View style={styles.gridCellPinBadge}>
                                      <Icon name="pin" size={11} color={ORANGE} />
                                    </View>
                                  )}
                                  <Text style={styles.gridCellTextContent} numberOfLines={4}>
                                    {post.content}
                                  </Text>
                                </View>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}

                {/* PORTFOLIO TAB */}
                {activeTab === 'portfolio' && (
                  <View>
                    {portfolio.length === 0 ? (
                      <View style={styles.emptyStateBox}>
                        <Icon name="image" size={32} color={themeColors.iconMuted} />
                        <Text style={[styles.emptyStateTitle, { color: themeColors.textPrimary }]}>No Portfolio Assets</Text>
                        <Text style={[styles.emptyStateDesc, { color: themeColors.textSecondary }]}>
                          No media assets added to portfolio.
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.threeColumnGrid, { gap: gridGap }]}>
                        {portfolio.map((item, i) => {
                          const mediaUri = item?.image_url || item?.media_url || item?.file_url || (typeof item === 'string' ? item : null);
                          return (
                            <View key={item?.id || i} accessible accessibilityLabel={`Portfolio item ${item?.title || i + 1}`} style={[styles.gridSquareCell, { width: gridCellW }, isDark && styles.gridSquareCellDark]}>
                              {mediaUri ? (
                                <CachedImage uri={mediaUri} style={styles.gridCellImg} />
                              ) : (
                                <View style={styles.gridCellTextFallback}>
                                  <Text style={styles.gridCellTextContent} numberOfLines={2}>
                                    {item?.title || 'Portfolio'}
                                  </Text>
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                )}

                {/* CREDITS TAB */}
                {activeTab === 'awards' && <AwardsPanel userId={targetUserId} isOwner={false} />}
                {activeTab === 'recommendations' && <RecommendationsPanel userId={targetUserId} isOwner={false} refreshKey={recKey} />}

                {activeTab === 'credits' && (
                  <View>
                    {credits.length === 0 ? (
                      <View style={styles.emptyStateBox}>
                        <Icon name="award" size={32} color={themeColors.iconMuted} />
                        <Text style={[styles.emptyStateTitle, { color: themeColors.textPrimary }]}>No Credits Locked</Text>
                        <Text style={[styles.emptyStateDesc, { color: themeColors.textSecondary }]}>
                          No verified production credits found.
                        </Text>
                      </View>
                    ) : (
                      credits.map(credit => {
                        const verifier = credit.profiles?.username || credit.verifier?.username;
                        return (
                          <View key={credit.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                            <View style={{ flex: 1 }}>
                              <CreditLine
                                serifLead
                                lead={credit.project_title || credit.title}
                                trail={credit.role}
                                note={verifier ? `Verified by @${verifier}` : undefined}
                              />
                            </View>
                            <Icon name="award" size={16} color="#D97706" style={{ marginTop: 18 }} />
                          </View>
                        );
                      })
                    )}
                  </View>
                )}

                {/* SKILLS TAB */}
                {activeTab === 'skills' && (
                  <View style={styles.skillsGrid}>
                    {skills.length === 0 ? (
                      <View style={styles.emptyStateBox}>
                        <Icon name="zap" size={32} color={themeColors.iconMuted} />
                        <Text style={[styles.emptyStateTitle, { color: themeColors.textPrimary }]}>No Skills Declared</Text>
                        <Text style={[styles.emptyStateDesc, { color: themeColors.textSecondary }]}>
                          Skills and crafts will appear here.
                        </Text>
                      </View>
                    ) : (
                      skills.map(s => (
                        <View key={s.id} style={[styles.skillPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9', borderColor: themeColors.border }]}>
                          <Text style={[styles.skillPillText, { color: themeColors.textPrimary }]}>{s.skill_name || s.name}{(skillEndorsements[s.id]?.endorsements || 0) > 0 ? `  ${skillEndorsements[s.id].endorsements}` : ''}</Text>
                          <TouchableOpacity onPress={() => toggleEndorsement(s.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Endorse this skill">
                            <Icon name="thumbs-up" size={13} color={skillEndorsements[s.id]?.endorsed_by_me ? ORANGE : themeColors.textMuted} />
                          </TouchableOpacity>
                        </View>
                      ))
                    )}
                  </View>
                )}

                {/* EXPERIENCE TAB */}
                {activeTab === 'experience' && (
                  <View>
                    {experience.length === 0 ? (
                      <View style={styles.emptyStateBox}>
                        <Icon name="briefcase" size={32} color={themeColors.iconMuted} />
                        <Text style={[styles.emptyStateTitle, { color: themeColors.textPrimary }]}>No Work Experience</Text>
                        <Text style={[styles.emptyStateDesc, { color: themeColors.textSecondary }]}>
                          Professional experience history.
                        </Text>
                      </View>
                    ) : (
                      experience.map(exp => (
                        <View key={exp.id} style={[styles.expCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC', borderColor: themeColors.border }]}>
                          <Text style={[styles.expTitleText, { color: themeColors.textPrimary }]}>{exp.title}</Text>
                          <Text style={styles.expCompanyText}>{exp.company}</Text>
                          <Text style={[styles.expDateText, { color: themeColors.textSecondary }]}>
                            {exp.start_date} — {exp.end_date || 'Present'}
                          </Text>
                          {exp.description && (
                            <Text style={[styles.expDescText, { color: themeColors.textSecondary }]}>{exp.description}</Text>
                          )}
                        </View>
                      ))
                    )}
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>
        <ReportModal
          visible={isReportOpen}
          onClose={() => setIsReportOpen(false)}
          targetTitle={`@${profileData?.username || 'user'}`}
          targetType="user"
          targetId={profileData?.id}
        />
        <RequestDatesModal visible={workModal === 'dates'} onClose={() => setWorkModal(null)} targetId={targetUserId} targetName={profileData?.full_name || profileData?.username || 'this person'} />
        <InviteToProjectModal visible={workModal === 'invite'} onClose={() => setWorkModal(null)} targetId={targetUserId} targetName={profileData?.full_name || profileData?.username || 'this person'} />
        <RecommendModal visible={workModal === 'recommend'} onClose={() => setWorkModal(null)} targetId={targetUserId} targetName={profileData?.full_name || profileData?.username || 'this person'} onDone={() => setRecKey((k) => k + 1)} />
        <AddToShortlistModal visible={workModal === 'shortlist'} onClose={() => setWorkModal(null)} targetId={targetUserId} targetName={profileData?.full_name || profileData?.username || 'this person'} />
        <IntroductionModal
          visible={introOpen}
          onClose={() => setIntroOpen(false)}
          targetId={targetUserId}
          targetName={profileData?.full_name || profileData?.username || 'this person'}
        />
        <ConnectNoteModal
          visible={noteOpen}
          onClose={() => setNoteOpen(false)}
          name={profileData?.full_name || profileData?.username || 'this person'}
          onSend={sendConnectionRequest}
        />
        <UniversalShareSheet
          visible={showShareSheet}
          onClose={() => setShowShareSheet(false)}
          title={profileData?.full_name || profileData?.username || 'Profile'}
          shareUrl={`https://cinecraftconnect.com/u/${profileData?.username || targetUserId}`}
          itemType="profile"
          itemData={profileData}
        />
      </TabletContainer>
  );
};

const styles = StyleSheet.create({
  igTopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
  },
  igTopUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 8,
  },
  igTopUsername: {
    fontSize: 16,
    fontWeight: '700',
  },
  igTopActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  igTopActionBtn: {
    padding: 6,
  },
  content: {
    paddingBottom: 40,
  },
  linkedinBannerContainer: {
    width: '100%',
    position: 'relative',
    backgroundColor: '#0D0D0D',
  },
  linkedinBannerImg: {
    width: '100%',
    height: '100%',
  },
  linkedinProfileSection: {
    paddingHorizontal: 16,
  },
  tabletProfileSection: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  tabletProfileSectionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 28,
  },
  tabletHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 20,
  },
  tabletBioSection: {
    flex: 1,
    marginTop: 20,
  },
  tabletHeaderRight: {
    width: 380,
    paddingTop: 20,
  },
  headerAvatarStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  headerStatsInlineContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginLeft: 12,
    marginTop: 10,
  },
  headerInlineStatItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  headerInlineStatNum: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerInlineStatLbl: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  linkedinAvatarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  linkedinAvatarWrapper: {
    position: 'relative',
  },
  linkedinAvatarRing: {
    borderWidth: 4,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  linkedinAvatarImg: {
    width: '100%',
    height: '100%',
  },
  linkedinAvatarFallback: {
    backgroundColor: '#FF4B33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkedinAvatarFallbackText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  linkedinBioSection: {
    marginTop: 8,
  },
  linkedinNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  linkedinFullName: {
    fontSize: 20,
    fontWeight: '700',
  },
  linkedinHeadline: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  linkedinBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  igProBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 75, 51, 0.1)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  igProBadgeText: {
    color: ORANGE,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  igFanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(217, 119, 6, 0.1)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  igFanBadgeText: {
    color: '#D97706',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  linkedinLocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  linkedinLocText: {
    fontSize: 12,
  },
  neatStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    marginTop: 14,
    marginBottom: 12,
  },
  neatStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  neatStatNum: {
    fontSize: 16,
    fontWeight: '700',
  },
  neatStatLbl: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  neatStatDivider: {
    width: 1,
    height: 24,
  },
  igBioText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  igLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  igLinkText: {
    fontSize: 12,
    fontWeight: '600',
  },
  igSocialRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  igSocialIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simpleActionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    marginBottom: 16,
  },
  simpleActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 6,
    minWidth: 0,
    borderRadius: 10,
    borderWidth: 1,
    gap: 5,
  },
  actionLabel: {
    flexShrink: 1,
  },
  simpleActionButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  connectPillBtn: {
    backgroundColor: ORANGE,
    borderColor: ORANGE,
  },
  connectPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  connectedPillBtn: {
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    borderColor: 'rgba(5, 150, 105, 0.4)',
  },
  connectedPillText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '700',
  },
  directPitchPillBtn: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  directPitchPillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  igTabsScrollView: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  igTabsContainer: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  igTabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 2.5,
    borderBottomColor: 'transparent',
  },
  igTabItemActive: {
    borderBottomColor: ORANGE,
  },
  igTabLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  igTabLabelActive: {
    fontWeight: '700',
  },
  igTabBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  igTabBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  tabContentArea: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  loadingBox: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  gridModeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  gridCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  threeColumnGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridSquareCell: {
    width: '31.5%',
    aspectRatio: 0.75,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  gridSquareCellDark: {
    backgroundColor: '#000000',
    borderColor: '#1E293B',
  },
  gridCellImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  gridCellTextFallback: {
    flex: 1,
    padding: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridCellTextContent: {
    fontSize: 12,
    color: INK,
    lineHeight: 13,
    textAlign: 'center',
  },
  emptyStateBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyStateDesc: {
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 240,
  },
  creditCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  creditIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(217, 119, 6, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  creditRole: {
    fontSize: 12,
    color: ORANGE,
    fontWeight: '700',
    marginTop: 1,
  },
  creditVerifier: {
    fontSize: 12,
    marginTop: 2,
  },
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  skillPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  expCard: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  expTitleText: {
    fontSize: 14,
    fontWeight: '700',
  },
  expCompanyText: {
    fontSize: 12,
    fontWeight: '700',
    color: ORANGE,
    marginTop: 2,
  },
  expDateText: {
    fontSize: 12,
    marginTop: 4,
  },
  expDescText: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
  },
  projectCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  projectTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  projectCategory: {
    fontSize: 12,
    fontWeight: '700',
    color: ORANGE,
    marginTop: 2,
    marginBottom: 4,
  },
  projectDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  gridCellPinBadge: {
    position: 'absolute',
    top: 5,
    left: 5,
    backgroundColor: ORANGE,
    borderRadius: 12,
    padding: 4.5,
    zIndex: 3,
  },
});

export default PublicProfileScreen;
