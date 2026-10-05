import { CreateAnnouncementModal } from '../../components/modals/CreateAnnouncementModal';
import { AvailabilityModal } from '../../components/modals/NetworkModals';
import { AwardsPanel, ProfileCompletenessCard, ProfileHighlightsModal, ProfileHighlightsView, useProfileHighlights, useSkillEndorsements, RecommendationsPanel } from '../../components/profile/ProfileExtras';
import { AnnouncementMenuButton } from '../../components/announcements/AnnouncementParts';
import { CachedImage } from '../../components/common/CachedImage';
import { fetchProfileExtras, mergeProfileExtras } from '../../utils/profileExtras';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  TextInput,
  ActivityIndicator,
  Alert,
  Share,
  Linking,
  Modal,
  TouchableWithoutFeedback,
  Platform,
  Dimensions,
  InteractionManager,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Polyline, Circle, Line, G } from 'react-native-svg';
import { Icon } from '../../components/common/Icon';
import { VerificationBadge } from '../../components/common/VerificationBadge';
import { TabletContainer } from '../../components/common/TabletContainer';
import { saveCache, getCache, getCacheSync, getCurrentUserIdSync, resolveCurrentUserId, setCachedCurrentUserId } from '../../services/offlineCache';
import { performMobileSignOut } from '../../services/authService';
import { NativeSecureKeyStore } from '../../services/mobileStorage';
import { notifyKeyChanged } from '../../services/e2eeKeyEvents';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useResponsive } from '../../hooks/useResponsive';
import { useAccountType } from '../../hooks/useAccountType';
import LinearGradient from 'react-native-linear-gradient';
import {
  loadSavedAccounts as amLoadSavedAccounts,
  getSavedAccountsSync,
  switchToAccount,
  prepareAddAccount,
  SavedAccount as ManagedSavedAccount,
  saveCurrentAccount as amSaveCurrentAccount,
  signOutSingleAccount,
  signOutAllAccounts,
} from '../../services/accountManager';
import { useAccountSwitch } from '../../contexts/AccountSwitchContext';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

export const ProfileScreen = ({ navigation }: { navigation: any }) => {
  const { themeColors, isDark } = useUserSettings();
  const { isTablet } = useResponsive();
  const { accountType, isFan: hookIsFan, isStudio: hookIsStudio, isCreator } = useAccountType();
  // Account switch callback from App.tsx root (via context), used by AccountManager
  const { onAccountSwitch } = useAccountSwitch();
  const [profile, setProfile] = useState<any>(null);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [highlightsOpen, setHighlightsOpen] = useState(false);
  const [completenessKey, setCompletenessKey] = useState(0);
  const { highlights, reload: reloadHighlights } = useProfileHighlights(profile?.id);
  const { info: skillEndorsements } = useSkillEndorsements(profile?.id);
  const [activeTab, setActiveTab] = useState<
    'posts' | 'portfolio' | 'projects' | 'announcements' | 'analytics' | 'saved' | 'credits' | 'skills' | 'experience' | 'awards' | 'recommendations'
  >(hookIsFan ? 'saved' : 'posts');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Stats
  const [postCount, setPostCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [connectionsCount, setConnectionsCount] = useState(0);

  // Tab Data States
  const [posts, setPosts] = useState<any[]>([]);
  const [portfolioItems, setPortfolioItems] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [editingAnn, setEditingAnn] = useState<any | null>(null);
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [credits, setCredits] = useState<any[]>([]);
  const [skills, setSkills] = useState<any[]>([]);
  const [experience, setExperience] = useState<any[]>([]);

  // Real-Time Analytics Stats (Web Parity)
  const [totalLikes, setTotalLikes] = useState(0);
  const [totalComments, setTotalComments] = useState(0);
  const [profileViewsCount, setProfileViewsCount] = useState(0);
  const [activeAnalyticsRange, setActiveAnalyticsRange] = useState<'7d' | '30d' | '90d' | '1y'>('7d');
  const [historicalAnalytics, setHistoricalAnalytics] = useState<Record<string, any[]>>({});


  // Skill Creation
  const [newSkill, setNewSkill] = useState('');
  const [addingSkill, setAddingSkill] = useState(false);

  // Experience Creation
  const [showExpForm, setShowExpForm] = useState(false);
  const [expTitle, setExpTitle] = useState('');
  const [expCompany, setExpCompany] = useState('');
  const [expStartDate, setExpStartDate] = useState('');
  const [expEndDate, setExpEndDate] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const [submittingExp, setSubmittingExp] = useState(false);

  // Portfolio Item Creation
  const [showPortfolioModal, setShowPortfolioModal] = useState(false);
  const [portTitle, setPortTitle] = useState('');
  const [portMediaUrl, setPortMediaUrl] = useState('');
  const [portRole, setPortRole] = useState('');
  const [portDesc, setPortDesc] = useState('');
  const [submittingPort, setSubmittingPort] = useState(false);

  // Account & Profile Switcher (Web Parity)
  // Initialise from L1 in-module sync cache so the modal renders with zero I/O.
  const [isAccountSwitcherOpen, setIsAccountSwitcherOpen] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<any[]>(() => getSavedAccountsSync());
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(null);
  const [bookmarkedProjects, setBookmarkedProjects] = useState<Record<string, boolean>>({});

  const toggleProjectBookmark = (id: string) => {
    setBookmarkedProjects((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleShareProject = async (item: any) => {
    try {
      await Share.share({
        message: `🎬 ProjectSpace: ${item.title}\n\n${item.description || ''}\n\nVia CineCraft Connect`,
      });
    } catch (e) { }
  };

  const handleShareAnnouncement = async (item: any) => {
    try {
      await Share.share({
        message: `📢 Announcement: ${item.title}\n\n${item.content || ''}\n\nVia CineCraft Connect`,
      });
    } catch (e) { }
  };

  const getTimeAgo = (dateStr?: string) => {
    if (!dateStr) return 'Just now';
    try {
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 30) return `${diffDays}d ago`;
      const diffMonths = Math.floor(diffDays / 30);
      return `${diffMonths}mo ago`;
    } catch {
      return 'Recently';
    }
  };


  const loadSavedAccounts = useCallback(async () => {
    try {
      const accounts = await amLoadSavedAccounts();
      setSavedAccounts(accounts);
      return accounts;
    } catch {
      return [];
    }
  }, []);

  /**
   * Saves the current account with a FULL session (access_token + refresh_token).
   * Reads the live session directly from Supabase to guarantee the latest tokens
   * after any auto-rotations.
   */
  const saveCurrentAccount = useCallback(async (currentProfile: any) => {
    if (!currentProfile?.id) return;
    try {
      const supabase = getSupabaseClient();
      const { data: { session: liveSession } } = await supabase.auth.getSession();
      if (liveSession?.access_token && liveSession?.refresh_token) {
        const updated = await amSaveCurrentAccount(currentProfile, liveSession);
        setSavedAccounts(updated);
      }
    } catch (e) {
      console.warn('[ProfileScreen] saveCurrentAccount error:', e);
    }
  }, []);

  /**
   * Instagram-style account switch via AccountManager.
   * Saves the current account FIRST (with live tokens), then activates the target.
   * Calls onAccountSwitch (from App.tsx root) to reset bootstrap state and update
   * root session — so the entire navigation tree re-renders as the new user.
   */
  const handleSwitchAccount = async (targetAccount: any) => {
    if (targetAccount.userId === profile?.id || switchingAccountId) return;
    setSwitchingAccountId(targetAccount.userId);
    setIsAccountSwitcherOpen(false);
    try {
      await switchToAccount(
        targetAccount as ManagedSavedAccount,
        profile,
        onAccountSwitch,
        (errMsg) => {
          Alert.alert(
            'Session Expired',
            `${errMsg}\n\nPlease sign in again.`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign In', onPress: () => navigation.navigate('Login') },
            ]
          );
          // Refresh the saved accounts list to remove the stale entry
          amLoadSavedAccounts().then(setSavedAccounts);
        }
      );
    } catch (e: any) {
      Alert.alert('Switch Failed', e.message || 'Could not switch account.');
    } finally {
      setSwitchingAccountId(null);
    }
  };

  /**
   * Saves the current account first, then navigates to Login with the
   * add_account=true param so LoginScreen merges the new account instead
   * of overwriting @cc_saved_accounts.
   */
  const handleAddAccount = async () => {
    setIsAccountSwitcherOpen(false);
    await prepareAddAccount(profile, ({ addAccount, previousUserId }) => {
      navigation.navigate('Login', { addAccount, previousUserId });
    });
  };

  const handleSignOutConfirm = () => {
    setIsAccountSwitcherOpen(false);
    const otherAccounts = savedAccounts.filter((acc) => acc.userId !== profile?.id);

    if (otherAccounts.length > 0) {
      Alert.alert(
        'Sign Out',
        `You have ${savedAccounts.length} accounts on this device. What would you like to do?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: `Sign Out of @${profile?.username || 'current'}`,
            style: 'destructive',
            onPress: async () => {
              if (profile?.id) {
                await signOutSingleAccount(
                  profile.id,
                  onAccountSwitch,
                  () => navigation.reset({ index: 0, routes: [{ name: 'Landing' }] })
                );
              }
            },
          },
          {
            text: 'Sign Out of All Accounts',
            style: 'destructive',
            onPress: async () => {
              await signOutAllAccounts(() => {
                navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
              });
            },
          },
        ]
      );
    } else {
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign Out',
            style: 'destructive',
            onPress: async () => {
              if (profile?.id) {
                await signOutSingleAccount(
                  profile.id,
                  onAccountSwitch,
                  () => navigation.reset({ index: 0, routes: [{ name: 'Landing' }] })
                );
              } else {
                await performMobileSignOut(() => {
                  navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
                });
              }
            },
          },
        ]
      );
    }
  };

  const fetchHistoricalAnalytics = useCallback(async (currentUserId: string, userPostIds: string[]) => {
    try {
      const supabase = getSupabaseClient();
      const ranges = ['7d', '30d', '90d', '1y'] as const;
      const dataByRange: Record<string, any[]> = {};

      for (const range of ranges) {
        const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const startDateISO = startDate.toISOString();

        const queries: Promise<any>[] = [
          (supabase
            .from('profile_views' as any)
            .select('created_at')
            .eq('profile_id', currentUserId)
            .gt('created_at', startDateISO) as any),
        ];

        if (userPostIds && userPostIds.length > 0) {
          queries.push(
            Promise.resolve(
              supabase
                .from('post_likes')
                .select('created_at')
                .in('post_id', userPostIds)
                .gt('created_at', startDateISO)
            )
          );
          queries.push(
            Promise.resolve(
              supabase
                .from('post_comments')
                .select('created_at')
                .in('post_id', userPostIds)
                .gt('created_at', startDateISO)
            )
          );
        } else {
          queries.push(Promise.resolve({ data: [] }));
          queries.push(Promise.resolve({ data: [] }));
        }

        const [viewsRes, likesRes, commentsRes] = await Promise.all(queries);

        const dayMap = new Map();
        const numPoints = Math.min(days, 14);
        for (let i = 0; i < numPoints; i++) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateKey = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          dayMap.set(dateKey, { name: dateKey, views: 0, likes: 0, comments: 0 });
        }

        viewsRes.data?.forEach((v: any) => {
          if (!v.created_at) return;
          const dateKey = new Date(v.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          if (dayMap.has(dateKey)) dayMap.get(dateKey).views++;
        });

        likesRes.data?.forEach((l: any) => {
          if (!l.created_at) return;
          const dateKey = new Date(l.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          if (dayMap.has(dateKey)) dayMap.get(dateKey).likes++;
        });

        commentsRes.data?.forEach((c: any) => {
          if (!c.created_at) return;
          const dateKey = new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          if (dayMap.has(dateKey)) dayMap.get(dateKey).comments++;
        });

        dataByRange[range] = Array.from(dayMap.values()).reverse();
      }

      setHistoricalAnalytics(dataByRange);
    } catch (e) {
      console.warn('Error fetching historical analytics:', e);
    }
  }, []);

  const fetchProfileData = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      let userId: string | null = null;
      let userObj: any = null;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        userObj = session?.user || null;
        userId = userObj?.id || null;
      } catch { }
      if (!userId) {
        userId = await resolveCurrentUserId();
      }
      if (!userId) return;

      // Secondary sections (saved posts, credits, skills, experience, view count) and the privacy-aware extras
      // don't depend on the main queries: start them at the same time instead of one after another.
      const extrasPromise = fetchProfileExtras(userId as string);
      const secondaryPromise = Promise.all([
        (supabase.from('post_bookmarks') as any)
          .select(`
            post_id,
            posts (
              id,
              content,
              media_urls,
              media_items,
              media_url,
              like_count,
              comment_count,
              created_at,
              author:profiles (full_name, username, avatar_url, craft)
            )
          `)
          .eq('user_id', userId),
        (supabase.from('project_credits') as any)
          .select(`*, profiles:verifier_id (full_name, username)`)
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        (supabase.from('user_skills') as any).select('*').eq('user_id', userId),
        (supabase.from('user_experience') as any)
          .select('*')
          .eq('user_id', userId)
          .order('start_date', { ascending: false }),
        Promise.resolve(
          (supabase.from('profile_views' as any) as any)
            .select('*', { count: 'exact', head: true })
            .eq('profile_id', userId)
        ).catch(() => ({ count: 0 })),
      ]);
      secondaryPromise.catch(() => { });

      // Execute all independent profile queries in parallel
      const [
        { data: profileDataRaw },
        { data: postsData },
        { data: portData },
        { data: rawConnections },
        { data: rawFollows },
        { data: rawFollowing },
        { data: projectsData },
        { data: annData },
      ] = await Promise.all([
        (supabase.from('profiles') as any)
          .select('*')
          .eq('id', userId)
          .maybeSingle(),
        (supabase.from('posts') as any)
          .select(`
            *,
            profiles (id, full_name, username, avatar_url, craft, is_verified)
          `)
          .eq('author_id', userId)
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false }),
        (supabase.from('portfolio_items') as any)
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false }),
        (supabase.from('user_connections') as any)
          .select('*')
          .or(`follower_id.eq.${userId},following_id.eq.${userId}`)
          .eq('status', 'accepted'),
        (supabase.from('user_follows') as any)
          .select('*')
          .eq('following_id', userId),
        (supabase.from('user_follows') as any)
          .select('*')
          .eq('follower_id', userId),
        (supabase.from('projects') as any)
          .select('*')
          .eq('creator_id', userId)
          .order('created_at', { ascending: false }),
        (supabase.from('announcements') as any)
          .select(`
            *,
            company_pages:publisher_page_id(id, name, logo_url, slug),
            profiles:author_id(full_name, username, avatar_url)
          `)
          .eq('author_id', userId)
          .order('posted_at', { ascending: false }),
      ]);

      const profileData = profileDataRaw
        ? mergeProfileExtras(profileDataRaw, await extrasPromise)
        : profileDataRaw;

      if (profileData) {
        setProfile(profileData);
        if (profileData.avatar_url) {
          saveCache('user_avatar_url', profileData.avatar_url);
        }
        // Save with LIVE session tokens (not the partial userObj from getSession headers)
        saveCurrentAccount(profileData);
      }

      if (postsData) {
        setPosts(postsData);
        setPostCount(postsData.length);
        const likes = postsData.reduce((sum: number, p: any) => sum + (p.like_count || 0), 0);
        const comments = postsData.reduce((sum: number, p: any) => sum + (p.comment_count || 0), 0);
        setTotalLikes(likes);
        setTotalComments(comments);

        const postIds = postsData.map((p: any) => p.id);
        fetchHistoricalAnalytics(userId, postIds);
      } else {
        fetchHistoricalAnalytics(userId, []);
      }

      if (portData) setPortfolioItems(portData);
      if (rawConnections) setConnectionsCount(rawConnections.length);
      if (rawFollows) setFollowersCount(rawFollows.length);
      if (rawFollowing) setFollowingCount(rawFollowing.length);
      if (projectsData) setProjects(projectsData);

      let combinedAnnouncements: any[] = annData || [];
      if (postsData && Array.isArray(postsData)) {
        const postAnnouncements = postsData.filter(
          (p: any) =>
            p.category?.toLowerCase() === 'announcement' ||
            p.post_type?.toLowerCase() === 'announcement' ||
            p.type?.toLowerCase() === 'announcement'
        );
        if (postAnnouncements.length > 0) {
          const existingIds = new Set(combinedAnnouncements.map((a: any) => a.id));
          postAnnouncements.forEach((p: any) => {
            if (!existingIds.has(p.id)) {
              combinedAnnouncements.push({
                ...p,
                title: p.title || (p.content ? (p.content.length > 50 ? p.content.slice(0, 50) + '...' : p.content) : 'Announcement'),
              });
            }
          });
        }
      }
      setAnnouncements(combinedAnnouncements);

      // Save to local cache for instant 0ms retrieval on future opens
      saveCache('user_profile_data', {
        profile: profileData,
        postCount: postsData?.length ?? postCount,
        followersCount: rawFollows?.length ?? followersCount,
        followingCount: rawFollowing?.length ?? followingCount,
        connectionsCount: rawConnections?.length ?? connectionsCount,
        posts: postsData ?? posts,
        announcements: combinedAnnouncements,
      });

      if (profileData?.avatar_url) {
        AsyncStorage.setItem('@cinecraft_current_user_avatar', profileData.avatar_url).catch(() => { });
        const { NativeModules } = require('react-native');
        if (NativeModules.NotificationBridge?.setCurrentUserAvatar) {
          NativeModules.NotificationBridge.setCurrentUserAvatar(profileData.avatar_url);
        }
      }

      setLoading(false);

      // 7-11. Saved posts, credits, skills, experience and view count (already requested in parallel above)
      const [savedRes, creditsRes, skillsRes, expRes, viewsRes]: any[] = await secondaryPromise;
      if (savedRes?.data) setSavedPosts(savedRes.data.map((s: any) => s.posts).filter(Boolean));
      if (creditsRes?.data) setCredits(creditsRes.data);
      if (skillsRes?.data) setSkills(skillsRes.data);
      if (expRes?.data) setExperience(expRes.data);
      setProfileViewsCount(viewsRes?.count || 0);

    } catch (e) {
      console.warn('[ProfileScreen] Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 0ms instant display from cache
    const loadCached = async () => {
      try {
        const cached = await getCache<any>('user_profile_data');
        // 'user_profile_data' is a single shared key: ignore it if it belongs to a different (previously active) account.
        const activeUid = getCurrentUserIdSync();
        if (cached && (!activeUid || !cached.profile?.id || cached.profile.id === activeUid)) {
          if (cached.profile) setProfile(cached.profile);
          if (cached.postCount !== undefined) setPostCount(cached.postCount);
          if (cached.followersCount !== undefined) setFollowersCount(cached.followersCount);
          if (cached.connectionsCount !== undefined) setConnectionsCount(cached.connectionsCount);
          if (cached.posts) setPosts(cached.posts);
          if (cached.announcements) setAnnouncements(cached.announcements);
          setLoading(false);
        }
      } catch (e) {
        console.warn('[ProfileScreen] Cache read error:', e);
      }
    };
    loadCached();
    const task = InteractionManager.runAfterInteractions(() => {
      fetchProfileData();
    });
    return () => task.cancel();
  }, [fetchProfileData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfileData();
    setRefreshing(false);
  };

  const handleShareProfile = async () => {
    if (!profile) return;
    try {
      await Share.share({
        message: `Check out ${profile.full_name || profile.username}'s profile on CineCraft Connect: https://cinecraftconnect.com/@${profile.username}`,
      });
    } catch (err) {
      console.warn('Share error:', err);
    }
  };

  const handleAddSkill = async () => {
    if (!newSkill.trim()) return;
    setAddingSkill(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await (supabase.from('user_skills') as any)
        .insert({ user_id: user.id, skill_name: newSkill.trim() })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setSkills((prev) => [...prev, data]);
        setNewSkill('');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save skill.');
    } finally {
      setAddingSkill(false);
    }
  };

  const handleDeleteSkill = async (id: number) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await (supabase.from('user_skills') as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
      setSkills((prev) => prev.filter((s) => s.id !== id));
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not delete skill.');
    }
  };

  const handleAddExperience = async () => {
    if (!expTitle.trim() || !expCompany.trim() || !expStartDate.trim()) {
      Alert.alert('Validation Error', 'Title, Company, and Start Date are required.');
      return;
    }
    setSubmittingExp(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await (supabase.from('user_experience') as any)
        .insert({
          user_id: user.id,
          title: expTitle.trim(),
          company: expCompany.trim(),
          start_date: expStartDate.trim(),
          end_date: expEndDate.trim() || null,
          description: expDesc.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setExperience((prev) => [data, ...prev]);
        setExpTitle('');
        setExpCompany('');
        setExpStartDate('');
        setExpEndDate('');
        setExpDesc('');
        setShowExpForm(false);
        Alert.alert('Success', 'Work experience recorded.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not save experience.');
    } finally {
      setSubmittingExp(false);
    }
  };

  const handleAddPortfolioItem = async () => {
    if (!portTitle.trim()) {
      Alert.alert('Validation Error', 'Portfolio item title is required.');
      return;
    }
    setSubmittingPort(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be signed in to add portfolio items.');

      const isVid = portMediaUrl.endsWith('.mp4') || portMediaUrl.includes('youtube') || portMediaUrl.includes('vimeo');

      const { data, error } = await (supabase.from('portfolio_items') as any)
        .insert({
          user_id: user.id,
          title: portTitle.trim(),
          media_url: portMediaUrl.trim() || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800',
          media_type: isVid ? 'video' : 'image',
          role: portRole.trim() || null,
          description: portDesc.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        setPortfolioItems((prev) => [data, ...prev]);
        setPortTitle('');
        setPortMediaUrl('');
        setPortRole('');
        setPortDesc('');
        setShowPortfolioModal(false);
        Alert.alert('Success!', 'Portfolio showcase item added.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not add portfolio item.');
    } finally {
      setSubmittingPort(false);
    }
  };

  const defaultProfile = {
    full_name: 'MANCHIKANTI VAMSHI KRISHNA',
    username: 'vamshikrishna',
    craft: 'Director, Actor, Writer',
    location: 'HYDERABAD, TELANGANA, IND',
    bio: 'Entrepreneur • Product Builder • Community Creator\n\nFounder of CineCraft Connect, a creator-focused platform connecting filmmakers, artists, media professionals, and storytellers through networking, collaboration, project spaces, and creative communities.',
    avatar_url: null,
    cover_image_url: null,
    is_verified: true,
    account_type: 'creator',
  };

  const p = profile || defaultProfile;
  const isStudio = p.account_type === 'studio' || hookIsStudio;
  const isFan = p.account_type === 'fan' || hookIsFan;
  const effectiveIsFan = isFan;
  const effectiveIsStudio = isStudio;

  // Analytics Chart calculations
  const currentViewsHistory: number[] = historicalAnalytics[activeAnalyticsRange] || [12, 18, 25, 30, 45, 60, 85];
  const chartHeight = 110;
  const chartWidth = 300;
  const maxVal = Math.max(...currentViewsHistory, 10);
  const chartPoints = currentViewsHistory
    .map((val: number, idx: number) => {
      const x = (idx / Math.max(currentViewsHistory.length - 1, 1)) * (chartWidth - 20) + 10;
      const y = chartHeight - (val / maxVal) * (chartHeight - 30) - 15;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <TabletContainer
      backgroundColor={themeColors.bgScreen}
      maxWidth={960}
      header={
        <View style={[styles.igTopHeader, { backgroundColor: themeColors.bgScreen, borderBottomColor: themeColors.border }]}>
          <TouchableOpacity
            style={styles.igTopUserRow}
            activeOpacity={0.7}
            onPress={() => {
              loadSavedAccounts();
              setIsAccountSwitcherOpen(true);
            }}
          >
            <Text style={[styles.igTopUsername, { color: themeColors.textPrimary }]} numberOfLines={1}>
              {String(p.username || 'profile').toLowerCase()}
            </Text>
            <Icon name="chevron-down" size={14} color={themeColors.textPrimary} style={{ marginLeft: 4 }} />
          </TouchableOpacity>

          <View style={styles.igTopActionsRow}>
            <TouchableOpacity
              style={styles.igTopActionBtn}
              onPress={() => navigation.navigate('AvailabilityCalendar')}
              accessibilityLabel="Crew Availability"
            >
              <Icon name="calendar" size={22} color={themeColors.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.igTopActionBtn}
              onPress={() => navigation.navigate('Settings')}
              accessibilityLabel="Settings"
            >
              <Icon name="settings" size={22} color={themeColors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>
      }
    >
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ORANGE}
            colors={[ORANGE]}
          />
        }
      >
        {/* LinkedIn-Style Cover Banner */}
        <View style={[styles.linkedinBannerContainer, { height: isTablet ? 190 : 145 }]}>
          <Image
            source={{
              uri:
                p.cover_image_url ||
                'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=1200&auto=format&fit=crop&q=80',
            }}
            style={styles.linkedinBannerImg}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.25)', 'transparent', 'rgba(0,0,0,0.5)']}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Edit Cover Photo Camera Button */}
          <TouchableOpacity
            style={styles.linkedinBannerCameraBtn}
            onPress={() => navigation.navigate('EditProfile')}
            activeOpacity={0.8}
            accessibilityLabel="Edit cover photo"
          >
            <Icon name="camera" size={15} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Profile Info Section with Overlapping Avatar */}
        <View style={styles.linkedinProfileSection}>
          {/* Avatar Row */}
          <View style={styles.linkedinAvatarRow}>
            {/* Overlapping Avatar */}
            <View style={[styles.linkedinAvatarWrapper, { marginTop: isTablet ? -84 : -72 }]}>
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
                  <Image
                    source={{ uri: p.avatar_url, cache: 'force-cache' }}
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
          <View style={styles.linkedinBioSection}>
            <View style={styles.linkedinNameRow}>
              <Text style={[styles.linkedinFullName, { color: themeColors.textPrimary }]}>
                {p.full_name || p.username}
              </Text>
              {p.is_verified && <VerificationBadge size="sm" />}
            </View>

            {!effectiveIsFan && p.craft ? (
              <Text style={[styles.linkedinHeadline, { color: themeColors.textPrimary }]}>
                {p.craft}
              </Text>
            ) : null}

            {/* Badges & Location Row */}
            <View style={styles.linkedinBadgesRow}>
              {effectiveIsFan ? (
                <View style={styles.igFanBadge}>
                  <Icon name="star" size={10} color="#D97706" />
                  <Text style={styles.igFanBadgeText}>FAN ACCOUNT</Text>
                </View>
              ) : (
                <View style={styles.igProBadge}>
                  <Icon name="zap" size={10} color={ORANGE} />
                  <Text style={styles.igProBadgeText}>{effectiveIsStudio ? 'STUDIO' : 'PRO'}</Text>
                </View>
              )}

              {p.location ? (
                <View style={styles.linkedinLocRow}>
                  <Icon name="map-pin" size={11} color={themeColors.textSecondary} />
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

            {/* Website Link */}
            {p.website ? (
              <TouchableOpacity
                style={styles.igLinkRow}
                onPress={() => Linking.openURL(p.website)}
                activeOpacity={0.7}
              >
                <Icon name="globe" size={12} color="#0A66C2" />
                <Text style={[styles.igLinkText, { color: '#0A66C2' }]} numberOfLines={1}>
                  {p.website.replace(/^(https?|ftp):\/\//, '')}
                </Text>
              </TouchableOpacity>
            ) : null}

            {/* Social Links */}
            {(p.instagram_url || p.social_links?.instagram || p.youtube_url || p.social_links?.youtube || p.spotify_url || p.social_links?.spotify || p.social_links?.linkedin) ? (
              <View style={styles.igSocialRow}>
                {p.instagram_url || p.social_links?.instagram ? (
                  <TouchableOpacity
                    style={[styles.igSocialIconBtn, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}
                    onPress={() => Linking.openURL(p.instagram_url || p.social_links?.instagram)}
                  >
                    <Icon name="instagram" size={14} color="#E1306C" />
                  </TouchableOpacity>
                ) : null}

                {p.youtube_url || p.social_links?.youtube ? (
                  <TouchableOpacity
                    style={[styles.igSocialIconBtn, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}
                    onPress={() => Linking.openURL(p.youtube_url || p.social_links?.youtube)}
                  >
                    <Icon name="youtube" size={16} />
                  </TouchableOpacity>
                ) : null}

                {p.spotify_url || p.social_links?.spotify ? (
                  <TouchableOpacity
                    style={[styles.igSocialIconBtn, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}
                    onPress={() => Linking.openURL(p.spotify_url || p.social_links?.spotify)}
                  >
                    <Icon name="spotify" size={16} />
                  </TouchableOpacity>
                ) : null}

                {p.social_links?.linkedin ? (
                  <TouchableOpacity
                    style={[styles.igSocialIconBtn, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}
                    onPress={() => Linking.openURL(p.social_links?.linkedin)}
                  >
                    <Icon name="linkedin" size={14} color="#0A66C2" />
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>

          {/* Neat Posts, Followers & Connections Stats Box (Placed directly ABOVE Edit profile buttons) */}
          <View
            style={[
              styles.neatStatsRow,
              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8FAFC', borderColor: themeColors.border },
            ]}
          >
            {!effectiveIsFan && (
              <>
                <TouchableOpacity
                  style={styles.neatStatItem}
                  onPress={() => setActiveTab('posts')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.neatStatNum, { color: themeColors.textPrimary }]}>
                    {postCount}
                  </Text>
                  <Text style={[styles.neatStatLbl, { color: themeColors.textSecondary }]}>
                    Posts
                  </Text>
                </TouchableOpacity>

                <View style={[styles.neatStatDivider, { backgroundColor: themeColors.border }]} />
              </>
            )}

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
                {effectiveIsFan ? followingCount : connectionsCount}
              </Text>
              <Text style={[styles.neatStatLbl, { color: themeColors.textSecondary }]}>
                {effectiveIsFan ? 'Following' : connectionsCount === 1 ? 'Connection' : 'Connections'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Simple Action Buttons: Edit profile, Share profile & Crew Availability */}
          <View style={styles.simpleActionButtonsRow}>
            <TouchableOpacity
              style={[
                styles.simpleActionButton,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                  borderColor: themeColors.border,
                },
              ]}
              onPress={() => navigation.navigate('EditProfile')}
              activeOpacity={0.7}
            >
              <Text style={[styles.simpleActionButtonText, { color: themeColors.textPrimary }]}>
                Edit profile
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.simpleActionButton,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                  borderColor: themeColors.border,
                },
              ]}
              onPress={handleShareProfile}
              activeOpacity={0.7}
            >
              <Text style={[styles.simpleActionButtonText, { color: themeColors.textPrimary }]}>
                Share profile
              </Text>
            </TouchableOpacity>

            {!effectiveIsFan && (
              <TouchableOpacity
                style={[styles.simpleActionButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9', borderColor: themeColors.border }]}
                onPress={() => Share.share({ message: `My crew sheet on CineCraft Connect\nhttps://cinecraftconnect.com/crew-sheet/${profile?.username || profile?.id}` }).catch(() => {})}
                activeOpacity={0.7}
              >
                <Text style={[styles.simpleActionButtonText, { color: themeColors.textPrimary }]}>Crew sheet</Text>
              </TouchableOpacity>
            )}

            {!effectiveIsFan && (
              <TouchableOpacity
                style={[styles.simpleActionButton, { backgroundColor: isDark ? 'rgba(5,150,105,0.15)' : '#ECFDF5', borderColor: '#05966955' }]}
                onPress={() => setAvailabilityOpen(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.simpleActionButtonText, { color: '#059669' }]}>Availability</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {!effectiveIsFan && (
          <View style={{ marginTop: 6 }}>
            <ProfileCompletenessCard
              refreshKey={completenessKey}
              onAction={(key) => {
                if (['avatar', 'cover', 'bio', 'craft', 'location', 'link'].includes(key)) navigation.navigate('EditProfile');
                else if (key === 'showreel') setHighlightsOpen(true);
                else if (key === 'availability') setAvailabilityOpen(true);
                else setActiveTab(key as any);
              }}
            />
            <ProfileHighlightsView highlights={highlights} isOwn onEdit={() => setHighlightsOpen(true)} />
          </View>
        )}

        {/* Instagram-Style Horizontal Tabs Bar */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.igTabsScrollView, { borderTopColor: themeColors.border, borderBottomColor: themeColors.border }]}
          contentContainerStyle={[styles.igTabsContainer, effectiveIsFan && { justifyContent: 'center' }]}
        >
          {(effectiveIsFan
            ? [{ id: 'saved', label: 'SAVED', icon: 'bookmark' }]
            : ([
              { id: 'posts', label: 'POSTS', icon: 'grid' },
              { id: 'portfolio', label: 'PORTFOLIO', icon: 'film' },
              { id: 'projects', label: 'PROJECTS', icon: 'folder' },
              { id: 'announcements', label: 'ANNOUNCEMENTS', icon: 'zap' },
              { id: 'analytics', label: 'ANALYTICS', icon: 'sliders' },
              { id: 'saved', label: 'SAVED', icon: 'bookmark' },
              { id: 'credits', label: 'CREDITS', icon: 'award' },
              { id: 'skills', label: 'SKILLS', icon: 'star' },
              { id: 'experience', label: 'EXPERIENCE', icon: 'briefcase' },
              { id: 'awards', label: 'AWARDS', icon: 'award' },
              { id: 'recommendations', label: 'RECOMMENDATIONS', icon: 'message-square' },
            ] as const)
          ).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.igTabBtn,
                  isActive && [styles.igTabBtnActive, { borderBottomColor: isDark ? '#FFFFFF' : '#0D0D0D' }],
                ]}
                onPress={() => setActiveTab(tab.id as any)}
                activeOpacity={0.7}
              >
                <Icon
                  name={tab.icon}
                  size={15}
                  color={isActive ? (isDark ? '#FFFFFF' : '#0D0D0D') : themeColors.textSecondary}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
                <Text
                  style={[
                    styles.igTabBtnText,
                    { color: themeColors.textSecondary },
                    isActive && [styles.igTabBtnTextActive, { color: isDark ? '#FFFFFF' : '#0D0D0D' }],
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Tab Content Body */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={ORANGE} size="large" />
          </View>
        ) : (
          <View style={styles.tabContentArea}>
            {/* 1. POSTS TAB - 3-Column Grid Matching True Aspect Ratios */}
            {activeTab === 'posts' && (
              <View>
                {posts.length === 0 ? (
                  <View style={[styles.emptyCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                    <Icon name="grid" size={32} color={themeColors.textMuted} />
                    <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>No Posts Yet</Text>
                    <Text style={[styles.emptySub, { color: themeColors.textSecondary }]}>
                      When you share posts on CineCraft Connect, they'll appear here.
                    </Text>
                  </View>
                ) : (
                  <View>
                    {/* Post count header */}
                    <View style={styles.gridModeBar}>
                      <Text style={[styles.gridCountText, { color: themeColors.textSecondary }]}>{posts.length} Posts</Text>
                    </View>

                    <View style={styles.threeColumnGrid}>
                      {posts.map((post) => {
                        // Robust multi-format media resolution
                        let mediaUrl: string | null = null;
                        let isVideo = false;
                        let isMulti = false;
                        let mediaAspect: string | undefined = undefined;

                        if (post.media_items) {
                          let items = post.media_items;
                          if (typeof items === 'string') {
                            try {
                              items = JSON.parse(items);
                            } catch (e) { }
                          }
                          if (Array.isArray(items) && items.length > 0) {
                            const first = items[0];
                            mediaUrl = typeof first === 'string' ? first : first?.url || first?.media_url || null;
                            mediaAspect = typeof first === 'object' ? first?.aspectRatio : undefined;
                            isVideo =
                              (typeof first === 'object' && first?.type === 'video') ||
                              post.media_type === 'video' ||
                              !!(mediaUrl && (mediaUrl.includes('.mp4') || mediaUrl.includes('video')));
                            isMulti = items.length > 1;
                          }
                        }

                        if (!mediaUrl && Array.isArray(post.media_urls) && post.media_urls.length > 0) {
                          mediaUrl = post.media_urls[0];
                          isVideo =
                            post.media_type === 'video' ||
                            !!(mediaUrl && (mediaUrl.includes('.mp4') || mediaUrl.includes('video')));
                          isMulti = post.media_urls.length > 1;
                        }

                        if (!mediaUrl) {
                          mediaUrl = post.media_url || post.image_url || null;
                          if (mediaUrl) {
                            isVideo =
                              post.media_type === 'video' ||
                              mediaUrl.includes('.mp4') ||
                              mediaUrl.includes('video');
                          }
                        }

                        return (
                          <TouchableOpacity
                            key={post.id}
                            style={[styles.gridSquareCell, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}
                            activeOpacity={0.9}
                            onPress={() =>
                              navigation.navigate('PostDetail', {
                                postId: post.id,
                              })
                            }
                          >
                            {mediaUrl ? (
                              <View style={{ width: '100%', height: '100%', position: 'relative' }}>
                                <CachedImage uri={mediaUrl} style={styles.gridCellImg} />
                                {!!post.is_pinned && (
                                  <View style={styles.gridCellPinBadge}>
                                    <Icon name="pin" size={12} color="#FFFFFF" fill="#FFFFFF" />
                                  </View>
                                )}
                                {isVideo && (
                                  <View style={styles.gridCellVideoBadge}>
                                    <Icon name="play" size={11} color="#FFFFFF" />
                                  </View>
                                )}
                                {isMulti && !isVideo && (
                                  <View style={styles.gridCellMultiBadge}>
                                    <Icon name="copy" size={11} color="#FFFFFF" />
                                  </View>
                                )}
                              </View>
                            ) : post.content?.includes('JOB_SHARE::') ? (
                              (() => {
                                try {
                                  const parts = post.content.split('JOB_SHARE::');
                                  const jobData = JSON.parse(parts[1]?.trim() || '{}');
                                  return (
                                    <View style={[styles.gridJobBox, { backgroundColor: isDark ? 'rgba(255, 75, 51, 0.12)' : '#FFF7F5', borderColor: isDark ? 'rgba(255, 75, 51, 0.25)' : '#FFE5DF' }]}>
                                      <View style={styles.gridJobPill}>
                                        <Text style={styles.gridJobPillText}>HIRING</Text>
                                      </View>
                                      <Text style={[styles.gridJobTitle, { color: themeColors.textPrimary }]} numberOfLines={2}>
                                        {jobData.title || parts[0]?.trim() || 'Job Opening'}
                                      </Text>
                                      <Text style={[styles.gridJobCompany, { color: themeColors.textSecondary }]} numberOfLines={1}>
                                        {jobData.company || 'Studio'}
                                      </Text>
                                    </View>
                                  );
                                } catch (e) {
                                  return (
                                    <View style={[styles.gridCellTextFallback, { backgroundColor: themeColors.bgCard }]}>
                                      <Text style={[styles.gridCellTextContent, { color: themeColors.textPrimary }]} numberOfLines={4}>
                                        {post.content.split('JOB_SHARE::')[0].trim()}
                                      </Text>
                                    </View>
                                  );
                                }
                              })()
                            ) : (
                              <View style={[styles.gridCellTextFallback, { backgroundColor: themeColors.bgCard }]}>
                                {!!post.is_pinned && (
                                  <View style={styles.gridCellPinBadge}>
                                    <Icon name="pin" size={11} color={ORANGE} />
                                  </View>
                                )}
                                <Text style={[styles.gridCellTextContent, { color: themeColors.textPrimary }]} numberOfLines={4}>
                                  {post.content}
                                </Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* 2. PORTFOLIO TAB - Dedicated Showcase Portfolio Items */}
            {activeTab === 'portfolio' && (
              <View>
                <TouchableOpacity style={styles.addPortfolioBtn} onPress={() => setShowPortfolioModal(true)}>
                  <Icon name="plus" size={14} color="#FFFFFF" />
                  <Text style={styles.addPortfolioBtnText}>Add Portfolio Showcase Item</Text>
                </TouchableOpacity>

                {portfolioItems.length === 0 ? (
                  <View style={[styles.emptyCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                    <Icon name="image" size={32} color={themeColors.textMuted} />
                    <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>Portfolio Showcase Empty</Text>
                    <Text style={[styles.emptySub, { color: themeColors.textSecondary }]}>
                      Add high-res stills, film posters, and reel clips to showcase your craft.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.threeColumnGrid}>
                    {portfolioItems.map((item) => (
                      <View key={item.id} style={[styles.gridSquareCell, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
                        <CachedImage uri={item.image_url} style={styles.gridCellImg} />
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* 3. PROJECTS TAB - Native Mobile APK Card Layout */}
            {activeTab === 'projects' && (
              <View>
                <View style={styles.tabSectionHeaderRow}>
                  <Text style={[styles.tabSectionHeaderTitle, { color: themeColors.textPrimary }]}>
                    Film & TV Projects
                  </Text>
                  <TouchableOpacity
                    style={styles.tabSectionAddBtn}
                    onPress={() => navigation.navigate('CreateProject')}
                    activeOpacity={0.8}
                  >
                    <Icon name="plus" size={12} color="#FFFFFF" />
                    <Text style={styles.tabSectionAddBtnText}>Create Project</Text>
                  </TouchableOpacity>
                </View>

                {projects.length === 0 ? (
                  <View style={[styles.emptyCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                    <View style={styles.emptyIconCircle}>
                      <Icon name="film" size={28} color={ORANGE} />
                    </View>
                    <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>No Active Projects</Text>
                    <Text style={[styles.emptySub, { color: themeColors.textSecondary }]}>
                      Initialize a production workspace for your film, TV show, or web series to track tasks, call sheets, and crew.
                    </Text>
                    <TouchableOpacity
                      style={styles.emptyCtaBtn}
                      onPress={() => navigation.navigate('CreateProject')}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.emptyCtaBtnText}>Create Project Workspace</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  projects.map((item) => {
                    const isBookmarked = !!bookmarkedProjects[item.id];
                    const statusDisplay = (item.status_display || item.status || 'ACTIVE').toUpperCase();
                    const rolesCount = item.roles_count || (Array.isArray(item.required_roles) ? item.required_roles.length : 0);
                    const genreDisplay = item.genre_display || (Array.isArray(item.genre) ? item.genre[0] : item.genre) || item.category;

                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.apkProjectCard,
                          { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
                        ]}
                        activeOpacity={0.9}
                        onPress={() => navigation.navigate('ProjectSpace', { projectId: item.id })}
                      >
                        {/* Visual Header / Cover Media */}
                        <View style={[styles.apkCardImageContainer, { backgroundColor: themeColors.chipBg }]}>
                          <Image
                            source={{
                              uri:
                                item.cover_url ||
                                item.image_url ||
                                'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&auto=format&fit=crop&q=80',
                            }}
                            style={styles.apkCardImage}
                            resizeMode="cover"
                          />

                          {/* Top Right Bookmark Button */}
                          <TouchableOpacity
                            style={[
                              styles.apkBookmarkBadge,
                              { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.65)' : 'rgba(255, 255, 255, 0.92)' },
                            ]}
                            onPress={() => toggleProjectBookmark(item.id)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Icon
                              name="bookmark"
                              size={16}
                              color={isBookmarked ? ORANGE : (isDark ? '#FFFFFF' : '#1E1611')}
                              fill={isBookmarked ? ORANGE : 'none'}
                              strokeWidth={isBookmarked ? 2.5 : 1.8}
                            />
                          </TouchableOpacity>

                          {/* Bottom Left Slug: [SCENE: ACTIVE] */}
                          <View
                            style={[
                              styles.apkSceneBadge,
                              {
                                backgroundColor: isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(255, 255, 255, 0.92)',
                                borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(229, 231, 235, 0.8)',
                              },
                            ]}
                          >
                            <Text style={[styles.apkSceneBadgeText, { color: isDark ? '#34D399' : '#059669' }]}>
                              [SCENE: {statusDisplay}]
                            </Text>
                          </View>

                          {/* Bottom Right Share Button */}
                          <TouchableOpacity
                            style={[
                              styles.apkCardMenuBtn,
                              { backgroundColor: isDark ? 'rgba(0, 0, 0, 0.65)' : 'rgba(255, 255, 255, 0.92)' },
                            ]}
                            onPress={() => handleShareProject(item)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Icon name="share" size={15} color={isDark ? '#FFFFFF' : '#1E1611'} />
                          </TouchableOpacity>
                        </View>

                        {/* Content Body */}
                        <View style={styles.apkCardBody}>
                          {/* Serif Title */}
                          <Text style={[styles.apkProjectTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
                            {item.title}
                          </Text>

                          {/* Synopsis / Description */}
                          {item.description ? (
                            <Text style={[styles.apkProjectLogline, { color: themeColors.textSecondary }]} numberOfLines={2}>
                              {item.description}
                            </Text>
                          ) : null}

                          {/* Metadata Slug Tags */}
                          <View style={styles.apkSlugTagsContainer}>
                            {item.location ? (
                              <View style={styles.apkSlugTagLocationRow}>
                                <View style={[styles.apkSlugTagGray, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC', borderColor: themeColors.border }]}>
                                  <Text style={[styles.apkSlugTagGrayText, { color: themeColors.textSecondary }]}>LOC // {item.location}</Text>
                                </View>
                              </View>
                            ) : null}

                            <View style={styles.apkSlugTagsSecondaryRow}>
                              {rolesCount > 0 ? (
                                <View style={styles.apkSlugTagRed}>
                                  <Text style={styles.apkSlugTagRedText}>ROLES // {rolesCount} OPEN</Text>
                                </View>
                              ) : null}

                              {genreDisplay ? (
                                <View style={[styles.apkSlugTagGray, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F8FAFC', borderColor: themeColors.border }]}>
                                  <Text style={[styles.apkSlugTagGrayText, { color: themeColors.textSecondary }]}>GENRE // {String(genreDisplay).toUpperCase()}</Text>
                                </View>
                              ) : null}
                            </View>
                          </View>

                          {/* Action Footer */}
                          <View style={[styles.apkCardFooterRow, { borderTopColor: themeColors.border }]}>
                            <Text style={[styles.apkTimeAgoText, { color: themeColors.textMuted }]}>
                              {getTimeAgo(item.created_at)}
                            </Text>
                            <View style={styles.apkViewProjectCTA}>
                              <Text style={styles.apkViewProjectCTAText}>Open ProjectSpace</Text>
                              <Icon name="chevron-right" size={13} color="#FF8A7A" />
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            )}

            {/* 4. ANNOUNCEMENTS TAB - Native Mobile APK Card Layout */}
            {activeTab === 'announcements' && (
              <View>
                <View style={styles.tabSectionHeaderRow}>
                  <Text style={[styles.tabSectionHeaderTitle, { color: themeColors.textPrimary }]}>
                    Recent Announcements & Updates
                  </Text>
                  <TouchableOpacity
                    style={styles.tabSectionAddBtn}
                    onPress={() => navigation.navigate('CreatePost', { defaultCategory: 'Announcement' })}
                    activeOpacity={0.8}
                  >
                    <Icon name="plus" size={12} color="#FFFFFF" />
                    <Text style={styles.tabSectionAddBtnText}>Post Update</Text>
                  </TouchableOpacity>
                </View>

                {announcements.length === 0 ? (
                  <View style={[styles.emptyCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                    <View style={styles.emptyIconCircle}>
                      <Icon name="zap" size={28} color={ORANGE} />
                    </View>
                    <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>No Announcements</Text>
                    <Text style={[styles.emptySub, { color: themeColors.textSecondary }]}>
                      Share casting calls, press releases, and production milestones with the CineCraft community.
                    </Text>
                    <TouchableOpacity
                      style={styles.emptyCtaBtn}
                      onPress={() => navigation.navigate('CreatePost', { defaultCategory: 'Announcement' })}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.emptyCtaBtnText}>Post Announcement</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  announcements.map((item) => {
                    const timeAgo = getTimeAgo(item.posted_at || item.created_at);
                    const publisherName =
                      item.company_pages?.name ||
                      p.full_name ||
                      p.username ||
                      'Official Announcement';
                    const publisherLogo = item.company_pages?.logo_url;

                    return (
                      <View
                        key={item.id}
                        style={[
                          styles.apkAnnouncementCard,
                          { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
                        ]}
                      >
                        {/* Card Header Row */}
                        <View style={styles.apkCardHeaderRow}>
                          {publisherLogo ? (
                            <CachedImage uri={publisherLogo} style={styles.apkCompanyLogoImg} />
                          ) : (
                            <View style={styles.apkMegaphoneBadgeBox}>
                              <Icon name="megaphone" size={20} color="#FFFFFF" />
                            </View>
                          )}

                          <View style={{ flex: 1 }}>
                            <Text style={[styles.apkCardTitleText, { color: themeColors.textPrimary }]} numberOfLines={2}>
                              {item.title}
                            </Text>
                            <View style={styles.apkTimeRow}>
                              <Icon name="clock" size={11} color={themeColors.textSecondary} />
                              <Text style={[styles.apkTimeText, { color: themeColors.textSecondary }]}>{timeAgo}</Text>
                              {item.is_pinned ? <Text style={[styles.apkTimeText, { color: ORANGE, fontWeight: '800' }]}>  ·  PINNED</Text> : null}
                            </View>
                          </View>
                          <AnnouncementMenuButton item={item} force onEdit={setEditingAnn} onChanged={fetchProfileData} />
                        </View>

                        {/* Content Body Text */}
                        {item.content ? (
                          <Text style={[styles.apkContentBodyText, { color: themeColors.textSecondary }]} numberOfLines={4}>
                            {item.content}
                          </Text>
                        ) : null}

                        {/* Optional Image Attachment */}
                        {item.image_url || item.media_url ? (
                          <CachedImage uri={item.image_url || item.media_url} style={styles.apkAnnouncementMediaImg} resizeMode="cover" />
                        ) : null}

                        {/* Card Footer Row */}
                        <View style={[styles.apkCardFooterRow, { borderTopColor: themeColors.border }]}>
                          <View style={[styles.apkFromTagBox, { backgroundColor: isDark ? 'rgba(255, 75, 51, 0.15)' : '#FFF7F5', borderColor: isDark ? 'rgba(255, 75, 51, 0.3)' : '#FFE5DF' }]}>
                            <Text style={styles.apkFromTagText}>FROM // {publisherName.toUpperCase()}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto', marginRight: 10 }}>
                            <Icon name="eye" size={13} color={themeColors.textMuted} />
                            <Text style={{ color: themeColors.textMuted, fontSize: 11.5 }}>{item.view_count || 0} views</Text>
                          </View>

                          <TouchableOpacity style={styles.apkShareBtn} onPress={() => handleShareAnnouncement(item)}>
                            <Icon name="share" size={15} color={themeColors.textSecondary} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {/* 5. ANALYTICS TAB - Real-Time Dashboard Parity with Web */}
            {activeTab === 'analytics' && (
              <View style={styles.analyticsContainer}>
                <View style={styles.analyticsTitleHeader}>
                  <View style={styles.analyticsIconBadge}>
                    <Icon name="sliders" size={18} color={ORANGE} />
                  </View>
                  <View>
                    <Text style={[styles.analyticsHeaderTitle, { color: themeColors.textPrimary }]}>
                      Analytics Overview
                    </Text>
                    <Text style={[styles.analyticsHeaderSub, { color: themeColors.textSecondary }]}>
                      Real-time insights into your activity
                    </Text>
                  </View>
                </View>

                {/* 7 Metric Cards Grid (Matching Web App) */}
                <View style={styles.analyticsMetricGrid}>
                  {/* Total Views */}
                  <View style={[styles.analyticsMetricCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                    <View style={styles.metricCardTop}>
                      <Text style={[styles.metricCardLabel, { color: themeColors.textSecondary }]}>TOTAL VIEWS</Text>
                      <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
                        <Icon name="eye" size={14} color="#3B82F6" />
                      </View>
                    </View>
                    <Text style={[styles.metricCardValue, { color: themeColors.textPrimary }]}>
                      {profileViewsCount.toLocaleString()}
                    </Text>
                    <Text style={[styles.metricSubLabel, { color: themeColors.textSecondary }]}>Profile visits</Text>
                  </View>

                  {/* Total Posts */}
                  <View style={[styles.analyticsMetricCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                    <View style={styles.metricCardTop}>
                      <Text style={[styles.metricCardLabel, { color: themeColors.textSecondary }]}>TOTAL POSTS</Text>
                      <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(99, 102, 241, 0.12)' }]}>
                        <Icon name="grid" size={14} color="#6366F1" />
                      </View>
                    </View>
                    <Text style={[styles.metricCardValue, { color: themeColors.textPrimary }]}>
                      {posts.length.toLocaleString()}
                    </Text>
                    <Text style={[styles.metricSubLabel, { color: themeColors.textSecondary }]}>Published posts</Text>
                  </View>

                  {/* Total Likes */}
                  <View style={[styles.analyticsMetricCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                    <View style={styles.metricCardTop}>
                      <Text style={[styles.metricCardLabel, { color: themeColors.textSecondary }]}>TOTAL LIKES</Text>
                      <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                        <Icon name="heart" size={14} color="#EF4444" />
                      </View>
                    </View>
                    <Text style={[styles.metricCardValue, { color: themeColors.textPrimary }]}>
                      {totalLikes.toLocaleString()}
                    </Text>
                    <Text style={[styles.metricSubLabel, { color: themeColors.textSecondary }]}>Across all posts</Text>
                  </View>

                  {/* Total Comments */}
                  <View style={[styles.analyticsMetricCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                    <View style={styles.metricCardTop}>
                      <Text style={[styles.metricCardLabel, { color: themeColors.textSecondary }]}>TOTAL COMMENTS</Text>
                      <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                        <Icon name="message-circle" size={14} color="#10B981" />
                      </View>
                    </View>
                    <Text style={[styles.metricCardValue, { color: themeColors.textPrimary }]}>
                      {totalComments.toLocaleString()}
                    </Text>
                    <Text style={[styles.metricSubLabel, { color: themeColors.textSecondary }]}>Audience discussions</Text>
                  </View>

                  {/* Connections */}
                  <View style={[styles.analyticsMetricCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                    <View style={styles.metricCardTop}>
                      <Text style={[styles.metricCardLabel, { color: themeColors.textSecondary }]}>CONNECTIONS</Text>
                      <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(139, 92, 246, 0.12)' }]}>
                        <Icon name="users" size={14} color="#8B5CF6" />
                      </View>
                    </View>
                    <Text style={[styles.metricCardValue, { color: themeColors.textPrimary }]}>
                      {connectionsCount.toLocaleString()}
                    </Text>
                    <Text style={[styles.metricSubLabel, { color: themeColors.textSecondary }]}>Peer network</Text>
                  </View>

                  {/* Followers */}
                  <View style={[styles.analyticsMetricCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                    <View style={styles.metricCardTop}>
                      <Text style={[styles.metricCardLabel, { color: themeColors.textSecondary }]}>FOLLOWERS</Text>
                      <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(6, 182, 212, 0.12)' }]}>
                        <Icon name="trending-up" size={14} color="#06B6D4" />
                      </View>
                    </View>
                    <Text style={[styles.metricCardValue, { color: themeColors.textPrimary }]}>
                      {followersCount.toLocaleString()}
                    </Text>
                    <Text style={[styles.metricSubLabel, { color: themeColors.textSecondary }]}>Audience growth</Text>
                  </View>

                  {/* Projects */}
                  <View style={[styles.analyticsMetricCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                    <View style={styles.metricCardTop}>
                      <Text style={[styles.metricCardLabel, { color: themeColors.textSecondary }]}>PROJECTS</Text>
                      <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(255, 75, 51, 0.12)' }]}>
                        <Icon name="film" size={14} color={ORANGE} />
                      </View>
                    </View>
                    <Text style={[styles.metricCardValue, { color: themeColors.textPrimary }]}>
                      {projects.length.toLocaleString()}
                    </Text>
                    <Text style={[styles.metricSubLabel, { color: themeColors.textSecondary }]}>Active productions</Text>
                  </View>
                </View>

                {/* Time Range Filter Bar (7D, 30D, 90D, 1Y) */}
                <View style={styles.analyticsRangeBarRow}>
                  <View style={styles.analyticsRangePillsGroup}>
                    {(['7d', '30d', '90d', '1y'] as const).map((rangeKey) => {
                      const isSelected = activeAnalyticsRange === rangeKey;
                      return (
                        <TouchableOpacity
                          key={rangeKey}
                          style={[
                            styles.analyticsRangePill,
                            isSelected && { backgroundColor: ORANGE },
                          ]}
                          onPress={() => setActiveAnalyticsRange(rangeKey)}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.analyticsRangePillText,
                              { color: isSelected ? '#FFFFFF' : themeColors.textSecondary },
                            ]}
                          >
                            {rangeKey.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View style={styles.analyticsUpdatedBadge}>
                    <Icon name="clock" size={10} color={ORANGE} />
                    <Text style={styles.analyticsUpdatedText}>Just now</Text>
                  </View>
                </View>

                {/* Performance Overview Interactive Chart */}
                <View style={[styles.chartCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                  <View style={styles.chartCardHeaderRow}>
                    <Text style={[styles.chartTitle, { color: themeColors.textPrimary, fontSize: 14, fontWeight: '800' }]}>
                      Performance Overview
                    </Text>
                    <Text style={[styles.analyticsHeaderSub, { color: themeColors.textSecondary }]}>
                      Views, likes, and comments over time
                    </Text>
                  </View>

                  {(() => {
                    const currentData = historicalAnalytics[activeAnalyticsRange] || [];
                    const chartW = Dimensions.get('window').width - 64;
                    const chartH = 150;

                    if (currentData.length === 0) {
                      return (
                        <View style={{ height: chartH, alignItems: 'center', justifyContent: 'center' }}>
                          <ActivityIndicator color={ORANGE} size="small" />
                        </View>
                      );
                    }

                    const maxViews = Math.max(...currentData.map((d) => d.views || 0), 1);
                    const maxLikes = Math.max(...currentData.map((d) => d.likes || 0), 1);
                    const maxComments = Math.max(...currentData.map((d) => d.comments || 0), 1);
                    const globalMax = Math.max(maxViews, maxLikes, maxComments, 4);

                    const viewPts = currentData
                      .map((d, i) => {
                        const x = (i / Math.max(1, currentData.length - 1)) * (chartW - 30) + 15;
                        const y = chartH - ((d.views || 0) / globalMax) * (chartH - 45) - 25;
                        return `${x},${y}`;
                      })
                      .join(' ');

                    const likePts = currentData
                      .map((d, i) => {
                        const x = (i / Math.max(1, currentData.length - 1)) * (chartW - 30) + 15;
                        const y = chartH - ((d.likes || 0) / globalMax) * (chartH - 45) - 25;
                        return `${x},${y}`;
                      })
                      .join(' ');

                    const commentPts = currentData
                      .map((d, i) => {
                        const x = (i / Math.max(1, currentData.length - 1)) * (chartW - 30) + 15;
                        const y = chartH - ((d.comments || 0) / globalMax) * (chartH - 45) - 25;
                        return `${x},${y}`;
                      })
                      .join(' ');

                    return (
                      <View>
                        <Svg height={chartH} width={chartW} style={{ alignSelf: 'center', marginTop: 10 }}>
                          {/* Horizontal Y-Axis Guidelines */}
                          {[0, 0.33, 0.66, 1].map((ratio, idx) => {
                            const y = chartH - ratio * (chartH - 45) - 25;
                            return (
                              <Line key={`guide-${idx}`} x1="15" y1={y} x2={chartW - 15} y2={y} stroke={isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0'} strokeWidth="1" strokeDasharray="3 3" />
                            );
                          })}

                          <Polyline points={viewPts} fill="none" stroke="#3B82F6" strokeWidth="2.5" />
                          <Polyline points={likePts} fill="none" stroke={ORANGE} strokeWidth="2.5" />
                          <Polyline points={commentPts} fill="none" stroke="#10B981" strokeWidth="2.5" />

                          {currentData.map((d, i) => {
                            const x = (i / Math.max(1, currentData.length - 1)) * (chartW - 30) + 15;
                            const yV = chartH - ((d.views || 0) / globalMax) * (chartH - 45) - 25;
                            const yL = chartH - ((d.likes || 0) / globalMax) * (chartH - 45) - 25;
                            const yC = chartH - ((d.comments || 0) / globalMax) * (chartH - 45) - 25;
                            return (
                              <G key={`pts-${i}`}>
                                <Circle cx={x} cy={yV} r="3" fill="#3B82F6" />
                                <Circle cx={x} cy={yL} r="3" fill={ORANGE} />
                                <Circle cx={x} cy={yC} r="3" fill="#10B981" />
                              </G>
                            );
                          })}
                        </Svg>

                        {/* X-Axis Date Labels */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, marginTop: 4 }}>
                          {currentData.map((d, i) => (
                            <Text key={i} style={{ fontSize: 9, color: themeColors.textMuted, fontWeight: '600' }}>
                              {d.name}
                            </Text>
                          ))}
                        </View>

                        {/* Chart Legend */}
                        <View style={styles.chartLegendRow}>
                          <View style={styles.chartLegendItem}>
                            <View style={[styles.chartLegendDot, { backgroundColor: '#3B82F6' }]} />
                            <Text style={[styles.chartLegendText, { color: themeColors.textSecondary }]}>Views</Text>
                          </View>
                          <View style={styles.chartLegendItem}>
                            <View style={[styles.chartLegendDot, { backgroundColor: ORANGE }]} />
                            <Text style={[styles.chartLegendText, { color: themeColors.textSecondary }]}>Likes</Text>
                          </View>
                          <View style={styles.chartLegendItem}>
                            <View style={[styles.chartLegendDot, { backgroundColor: '#10B981' }]} />
                            <Text style={[styles.chartLegendText, { color: themeColors.textSecondary }]}>Comments</Text>
                          </View>
                        </View>
                      </View>
                    );
                  })()}
                </View>

                {/* Engagement Distribution Card (Matching Web App) */}
                <View style={[styles.analyticsSummaryCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border, marginTop: 14 }]}>
                  <Text style={[styles.analyticsSummaryTitle, { color: themeColors.textPrimary }]}>Engagement Distribution</Text>
                  <Text style={[styles.analyticsHeaderSub, { color: themeColors.textSecondary, marginBottom: 12 }]}>
                    Breakdown of user interactions
                  </Text>

                  {(() => {
                    const totalActivity = posts.length + totalLikes + totalComments;
                    const postsPct = totalActivity > 0 ? Math.round((posts.length / totalActivity) * 100) : 0;
                    const likesPct = totalActivity > 0 ? Math.round((totalLikes / totalActivity) * 100) : 0;
                    const commentsPct = totalActivity > 0 ? Math.round((totalComments / totalActivity) * 100) : 0;

                    return (
                      <View>
                        <View style={{ height: 10, borderRadius: 5, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0', flexDirection: 'row', overflow: 'hidden', marginBottom: 12 }}>
                          {postsPct > 0 && <View style={{ width: `${postsPct}%`, backgroundColor: '#6366F1' }} />}
                          {likesPct > 0 && <View style={{ width: `${likesPct}%`, backgroundColor: '#EF4444' }} />}
                          {commentsPct > 0 && <View style={{ width: `${commentsPct}%`, backgroundColor: '#10B981' }} />}
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#6366F1' }} />
                            <Text style={{ fontSize: 11, fontWeight: '700', color: themeColors.textSecondary }}>
                              Posts ({posts.length})
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }} />
                            <Text style={{ fontSize: 11, fontWeight: '700', color: themeColors.textSecondary }}>
                              Likes ({totalLikes})
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }} />
                            <Text style={{ fontSize: 11, fontWeight: '700', color: themeColors.textSecondary }}>
                              Comments ({totalComments})
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })()}
                </View>

                {/* Performance Summary Banner (Matching Web App) */}
                <View style={[styles.analyticsSummaryCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC', borderColor: themeColors.border, marginTop: 14 }]}>
                  <Text style={[styles.analyticsSummaryTitle, { color: themeColors.textPrimary }]}>Performance Summary</Text>
                  <View style={styles.summaryMetricsRow}>
                    <View style={styles.summaryItem}>
                      <Text style={[styles.summaryItemLabel, { color: themeColors.textSecondary }]}>Total Reach</Text>
                      <Text style={[styles.summaryItemValue, { color: themeColors.textPrimary }]}>
                        {(totalLikes + totalComments + followersCount + connectionsCount + profileViewsCount).toLocaleString()}
                      </Text>
                      <Text style={[styles.summaryItemSub, { color: themeColors.textSecondary }]}>Combined reach</Text>
                    </View>

                    <View style={[styles.summaryDivider, { backgroundColor: themeColors.border }]} />

                    <View style={styles.summaryItem}>
                      <Text style={[styles.summaryItemLabel, { color: themeColors.textSecondary }]}>Content Created</Text>
                      <Text style={[styles.summaryItemValue, { color: themeColors.textPrimary }]}>
                        {posts.length + projects.length}
                      </Text>
                      <Text style={[styles.summaryItemSub, { color: themeColors.textSecondary }]}>Posts & Projects</Text>
                    </View>

                    <View style={[styles.summaryDivider, { backgroundColor: themeColors.border }]} />

                    <View style={styles.summaryItem}>
                      <Text style={[styles.summaryItemLabel, { color: themeColors.textSecondary }]}>Engagement Rate</Text>
                      <Text style={[styles.summaryItemValue, { color: ORANGE }]}>
                        {posts.length > 0 ? Math.round(((totalLikes + totalComments) / posts.length) * 100) : 0}%
                      </Text>
                      <Text style={[styles.summaryItemSub, { color: themeColors.textSecondary }]}>Interaction rate</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* 6. SAVED TAB */}
            {activeTab === 'saved' && (
              <View>
                {savedPosts.length === 0 ? (
                  <View style={[styles.emptyCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                    <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>No Saved Posts</Text>
                  </View>
                ) : (
                  savedPosts.map((post) => (
                    <View key={post.id} style={[styles.postCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                      <Text style={[styles.postContent, { color: themeColors.textPrimary }]}>{post.content}</Text>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* 7. CREDITS TAB */}
            {activeTab === 'credits' && (
              <View>
                {credits.filter((cr) => cr.status === 'pending').length > 0 && (
                  <View style={[styles.creditCard, { backgroundColor: themeColors.bgCard, borderColor: ORANGE, gap: 10 }]}>
                    <Text style={[styles.creditTitle, { color: themeColors.textPrimary }]}>Credits waiting for your answer</Text>
                    {credits.filter((cr) => cr.status === 'pending').map((cr) => (
                      <View key={cr.id} style={{ gap: 6 }}>
                        <Text style={{ color: themeColors.textPrimary, fontWeight: '800' }}>{cr.role} · {cr.project_title}</Text>
                        <Text style={{ color: themeColors.textMuted, fontSize: 12 }}>Added by {cr.profiles?.full_name || (cr.profiles?.username ? '@' + cr.profiles.username : 'a project creator')}</Text>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                          <TouchableOpacity
                            onPress={async () => {
                              const { error } = await (getSupabaseClient() as any).rpc('respond_credit', { p_id: cr.id, p_accept: true });
                              if (error) return Alert.alert('Could not update the credit', error.message);
                              fetchProfileData();
                            }}
                          >
                            <Text style={{ color: ORANGE, fontWeight: '800' }}>Confirm</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={async () => {
                              const { error } = await (getSupabaseClient() as any).rpc('respond_credit', { p_id: cr.id, p_accept: false });
                              if (error) return Alert.alert('Could not update the credit', error.message);
                              fetchProfileData();
                            }}
                          >
                            <Text style={{ color: themeColors.textSecondary, fontWeight: '700' }}>Decline</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
                {credits.filter((cr) => (cr.status || 'accepted') === 'accepted').length === 0 ? (
                  <View style={[styles.emptyCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                    <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>No Verified Credits</Text>
                  </View>
                ) : (
                  credits.filter((cr) => (cr.status || 'accepted') === 'accepted').map((cred) => (
                    <View key={cred.id} style={[styles.creditCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                      <Text style={[styles.creditTitle, { color: themeColors.textPrimary }]}>{cred.project_title}</Text>
                      <Text style={styles.creditRole}>{cred.role}</Text>
                    </View>
                  ))
                )}
              </View>
            )}

            {activeTab === 'awards' && profile?.id && <AwardsPanel userId={profile.id} isOwner />}
            {activeTab === 'recommendations' && profile?.id && <RecommendationsPanel userId={profile.id} isOwner />}

            {/* 8. SKILLS TAB */}
            {activeTab === 'skills' && (
              <View>
                <View style={styles.addInputRow}>
                  <TextInput
                    style={[styles.addInput, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                    placeholder="Add professional skill (e.g. Color Grading)..."
                    placeholderTextColor={themeColors.textMuted}
                    value={newSkill}
                    onChangeText={setNewSkill}
                  />
                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={handleAddSkill}
                    disabled={addingSkill}
                  >
                    <Text style={styles.addBtnText}>+ Add</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.skillsChipRow}>
                  {skills.map((s) => (
                    <View key={s.id} style={[styles.skillChip, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
                      <Text style={[styles.skillChipText, { color: themeColors.textPrimary }]}>{s.skill_name}{(skillEndorsements[s.id]?.endorsements || 0) > 0 ? `  👍 ${skillEndorsements[s.id].endorsements}` : ''}</Text>
                      <TouchableOpacity onPress={() => handleDeleteSkill(s.id)}>
                        <Icon name="x" size={12} color={themeColors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* 9. EXPERIENCE TAB */}
            {activeTab === 'experience' && (
              <View>
                {!showExpForm ? (
                  <TouchableOpacity
                    style={styles.addExpTriggerBtn}
                    onPress={() => setShowExpForm(true)}
                  >
                    <Icon name="plus" size={14} color="#FFFFFF" />
                    <Text style={styles.addExpTriggerText}>Add Work Experience</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.expFormCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                    <Text style={[styles.expFormTitle, { color: themeColors.textPrimary }]}>Record Work Experience</Text>
                    <TextInput
                      style={[styles.addInput, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                      placeholder="Title (e.g. Lead Director)"
                      placeholderTextColor={themeColors.textMuted}
                      value={expTitle}
                      onChangeText={setExpTitle}
                    />
                    <TextInput
                      style={[styles.addInput, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                      placeholder="Company / Studio"
                      placeholderTextColor={themeColors.textMuted}
                      value={expCompany}
                      onChangeText={setExpCompany}
                    />
                    <View style={styles.btnRow}>
                      <TouchableOpacity
                        style={[styles.cancelBtn, { backgroundColor: themeColors.chipBg }]}
                        onPress={() => setShowExpForm(false)}
                      >
                        <Text style={[styles.cancelBtnText, { color: themeColors.textSecondary }]}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.saveBtn}
                        onPress={handleAddExperience}
                        disabled={submittingExp}
                      >
                        <Text style={styles.saveBtnText}>Save</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {experience.map((exp) => (
                  <View key={exp.id} style={[styles.expCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                    <Text style={[styles.expTitle, { color: themeColors.textPrimary }]}>{exp.title}</Text>
                    <Text style={styles.expCompany}>{exp.company}</Text>
                    <Text style={[styles.expDate, { color: themeColors.textMuted }]}>
                      {exp.start_date} - {exp.end_date || 'Present'}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Account & Profile Switcher Bottom Sheet Modal (Web App Parity) */}
      <Modal
        visible={isAccountSwitcherOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAccountSwitcherOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setIsAccountSwitcherOpen(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.modalContainer,
                  {
                    backgroundColor: themeColors.bgCard,
                    borderColor: themeColors.border,
                  },
                ]}
              >
                {/* Handle Bar */}
                <View style={[styles.modalHandle, { backgroundColor: themeColors.border }]} />

                {/* Header Row */}
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>
                    Switch Profile
                  </Text>
                  <TouchableOpacity
                    onPress={() => setIsAccountSwitcherOpen(false)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.modalCloseBtn}
                  >
                    <Icon name="x" size={18} color={themeColors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={styles.modalScroll}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.modalScrollContent}
                >
                  {/* Current Active Account Card */}
                  <Text style={[styles.modalSectionLabel, { color: themeColors.textSecondary }]}>
                    ACTIVE PROFILE
                  </Text>
                  <View
                    style={[
                      styles.modalActiveCard,
                      {
                        backgroundColor: isDark ? 'rgba(255, 75, 51, 0.08)' : 'rgba(255, 75, 51, 0.05)',
                        borderColor: ORANGE,
                      },
                    ]}
                  >
                    <View style={styles.modalActiveCardLeft}>
                      <View style={styles.modalAvatarBox}>
                        {p.avatar_url ? (
                          <CachedImage uri={p.avatar_url} style={styles.modalAvatarImg} />
                        ) : (
                          <View style={[styles.modalAvatarImg, styles.modalAvatarFallback]}>
                            <Text style={styles.modalAvatarFallbackText}>
                              {(p.full_name || p.username || 'C').charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={styles.modalOnlineDot} />
                      </View>
                      <View style={styles.modalActiveDetails}>
                        <View style={styles.modalActiveNameRow}>
                          <Text
                            style={[styles.modalActiveName, { color: themeColors.textPrimary }]}
                            numberOfLines={1}
                          >
                            {p.full_name || p.username}
                          </Text>
                          {p.is_verified && <VerificationBadge size="sm" />}
                        </View>
                        <Text
                          style={[styles.modalActiveHandle, { color: themeColors.textSecondary }]}
                          numberOfLines={1}
                        >
                          @{p.username}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.modalActiveCheckBadge}>
                      <Icon name="check" size={14} color="#FFFFFF" strokeWidth={3} />
                    </View>
                  </View>

                  {/* Saved Accounts on Device */}
                  {savedAccounts.filter((acc) => acc.userId !== p.id).length > 0 && (
                    <>
                      <Text style={[styles.modalSectionLabel, { color: themeColors.textSecondary, marginTop: 18 }]}>
                        OTHER ACCOUNTS ON THIS DEVICE
                      </Text>
                      {savedAccounts
                        .filter((acc) => acc.userId !== p.id)
                        .map((acc) => {
                          const isSwitchingThis = switchingAccountId === acc.userId;
                          return (
                            <TouchableOpacity
                              key={acc.userId}
                              style={[
                                styles.modalSavedAccCard,
                                {
                                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : '#F8FAFC',
                                  borderColor: themeColors.border,
                                },
                              ]}
                              activeOpacity={0.7}
                              onPress={() => handleSwitchAccount(acc)}
                              disabled={switchingAccountId !== null}
                            >
                              <View style={styles.modalAvatarBox}>
                                {acc.avatarUrl ? (
                                  <CachedImage uri={acc.avatarUrl} style={styles.modalAvatarImg} />
                                ) : (
                                  <View style={[styles.modalAvatarImg, styles.modalAvatarFallback]}>
                                    <Text style={styles.modalAvatarFallbackText}>
                                      {(acc.fullName || acc.username || 'C').charAt(0).toUpperCase()}
                                    </Text>
                                  </View>
                                )}
                              </View>
                              <View style={styles.modalActiveDetails}>
                                <Text
                                  style={[styles.modalActiveName, { color: themeColors.textPrimary }]}
                                  numberOfLines={1}
                                >
                                  {acc.fullName || acc.username}
                                </Text>
                                <Text
                                  style={[styles.modalActiveHandle, { color: themeColors.textSecondary }]}
                                  numberOfLines={1}
                                >
                                  @{acc.username}
                                </Text>
                              </View>
                              {isSwitchingThis ? (
                                <ActivityIndicator size="small" color={ORANGE} />
                              ) : (
                                <View style={[styles.modalSwitchBtn, { borderColor: themeColors.border }]}>
                                  <Text style={[styles.modalSwitchBtnText, { color: themeColors.textPrimary }]}>
                                    Switch
                                  </Text>
                                </View>
                              )}
                            </TouchableOpacity>
                          );
                        })}
                    </>
                  )}

                  {/* Action Buttons */}
                  <View style={styles.modalActionsSection}>
                    <TouchableOpacity
                      style={[styles.modalAddAccountBtn, { borderColor: ORANGE }]}
                      onPress={handleAddAccount}
                      activeOpacity={0.7}
                    >
                      <Icon name="plus" size={16} color={ORANGE} strokeWidth={2.5} />
                      <Text style={[styles.modalAddAccountBtnText, { color: ORANGE }]}>
                        Add or Link Another Account
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.modalSignOutBtn}
                      onPress={handleSignOutConfirm}
                      activeOpacity={0.7}
                    >
                      <Icon name="log-out" size={16} color="#EF4444" />
                      <Text style={styles.modalSignOutBtnText}>
                        Sign Out of @{p.username}
                      </Text>
                    </TouchableOpacity>

                    {savedAccounts.filter((acc) => acc.userId !== p.id).length > 0 && (
                      <TouchableOpacity
                        style={[styles.modalSignOutBtn, { marginTop: -4 }]}
                        onPress={() => {
                          setIsAccountSwitcherOpen(false);
                          Alert.alert(
                            'Sign Out of All Accounts',
                            'Are you sure you want to sign out of all accounts on this device?',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Sign Out of All',
                                style: 'destructive',
                                onPress: async () => {
                                  await signOutAllAccounts(() => {
                                    navigation.reset({ index: 0, routes: [{ name: 'Landing' }] });
                                  });
                                },
                              },
                            ]
                          );
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.modalSignOutBtnText, { color: '#94A3B8', fontSize: 12.5 }]}>
                          Sign Out of All Accounts
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Add Portfolio Item Modal */}
      <Modal
        visible={showPortfolioModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPortfolioModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowPortfolioModal(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalContainer, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border, maxHeight: '80%' }]}>
                <View style={[styles.modalHandle, { backgroundColor: themeColors.border }]} />
                <View style={styles.modalHeader}>
                  <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>Add Portfolio Showcase Item</Text>
                  <TouchableOpacity onPress={() => setShowPortfolioModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Icon name="x" size={20} color={themeColors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <ScrollView contentContainerStyle={{ padding: 16 }}>
                  <Text style={{ color: themeColors.textSecondary, marginBottom: 4, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>ITEM TITLE *</Text>
                  <TextInput
                    style={{ backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12, fontSize: 13 }}
                    placeholder="e.g. Director's Cut Showcase / Feature Poster"
                    placeholderTextColor={themeColors.textMuted}
                    value={portTitle}
                    onChangeText={setPortTitle}
                  />

                  <Text style={{ color: themeColors.textSecondary, marginBottom: 4, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>MEDIA / IMAGE / VIDEO URL</Text>
                  <TextInput
                    style={{ backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12, fontSize: 13 }}
                    placeholder="https://..."
                    placeholderTextColor={themeColors.textMuted}
                    value={portMediaUrl}
                    onChangeText={setPortMediaUrl}
                  />

                  <Text style={{ color: themeColors.textSecondary, marginBottom: 4, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>ROLE / CRAFT</Text>
                  <TextInput
                    style={{ backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12, fontSize: 13 }}
                    placeholder="e.g. Lead Director / Cinematographer"
                    placeholderTextColor={themeColors.textMuted}
                    value={portRole}
                    onChangeText={setPortRole}
                  />

                  <Text style={{ color: themeColors.textSecondary, marginBottom: 4, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>DESCRIPTION</Text>
                  <TextInput
                    style={{ backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, height: 80, textAlignVertical: 'top', marginBottom: 16, fontSize: 13 }}
                    placeholder="Describe technical specs, camera gear used, or production awards..."
                    placeholderTextColor={themeColors.textMuted}
                    value={portDesc}
                    onChangeText={setPortDesc}
                    multiline
                  />

                  <TouchableOpacity
                    style={[styles.modalAddAccountBtn, { backgroundColor: ORANGE, borderColor: ORANGE, height: 44, justifyContent: 'center' }]}
                    onPress={handleAddPortfolioItem}
                    disabled={submittingPort}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>
                      {submittingPort ? 'Adding Item...' : 'Add to Portfolio Showcase →'}
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      <AvailabilityModal visible={availabilityOpen} onClose={() => { setAvailabilityOpen(false); setCompletenessKey((k) => k + 1); }} userId={profile?.id || null} />
      {!!profile?.id && (
        <ProfileHighlightsModal visible={highlightsOpen} onClose={() => setHighlightsOpen(false)} userId={profile.id} current={highlights} onSaved={() => { reloadHighlights(); setCompletenessKey((k) => k + 1); }} />
      )}
      <CreateAnnouncementModal visible={!!editingAnn} editing={editingAnn} onClose={() => setEditingAnn(null)} onSuccess={fetchProfileData} />
    </TabletContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  content: {
    paddingBottom: 80,
    paddingTop: 0,
  },
  // Instagram-style Profile Header & Info
  igTopHeader: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  igTopUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '70%',
  },
  igTopUsername: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  igTopActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  igTopActionBtn: {
    padding: 4,
  },
  // LinkedIn-style Profile Header & Info
  linkedinBannerContainer: {
    width: '100%',
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  linkedinBannerImg: {
    width: '100%',
    height: '100%',
  },
  linkedinBannerCameraBtn: {
    position: 'absolute',
    top: 12,
    right: 14,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  linkedinProfileSection: {
    paddingBottom: 4,
  },
  linkedinAvatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  linkedinAvatarWrapper: {
    position: 'relative',
    zIndex: 5,
  },
  linkedinAvatarRing: {
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  linkedinAvatarImg: {
    width: '100%',
    height: '100%',
  },
  linkedinAvatarFallback: {
    backgroundColor: 'rgba(255, 75, 51, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkedinAvatarFallbackText: {
    color: '#FF4B33',
    fontWeight: '800',
  },
  linkedinAvatarPlusBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#0095F6',
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  headerAvatarStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
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
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  headerInlineStatLbl: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 1,
  },
  linkedinBioSection: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  linkedinNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  linkedinFullName: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  linkedinHeadline: {
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 18,
    marginTop: 2,
    marginBottom: 4,
  },
  linkedinBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: 4,
  },
  linkedinLocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  linkedinLocText: {
    fontSize: 12,
    fontWeight: '600',
  },
  neatStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginTop: 6,
    marginBottom: 10,
  },
  neatStatItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  neatStatNum: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 1,
  },
  neatStatLbl: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  neatStatDivider: {
    width: 1,
    height: 22,
  },
  igProBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 75, 51, 0.1)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  igProBadgeText: {
    color: ORANGE,
    fontSize: 10,
    fontWeight: '800',
  },
  igFanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  igFanBadgeText: {
    color: '#D97706',
    fontSize: 10,
    fontWeight: '800',
  },
  igBioText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 6,
  },
  igLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
    marginBottom: 4,
  },
  igLinkText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  igSocialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  igSocialIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simpleActionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 8,
  },
  simpleActionButton: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  simpleActionButtonText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  igTabsScrollView: {
    maxHeight: 46,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginVertical: 4,
  },
  igTabsContainer: {
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  igTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 44,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  igTabBtnActive: {
    borderBottomWidth: 2,
  },
  igTabBtnText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  igTabBtnTextActive: {
    fontWeight: '800',
  },
  webGlassCardContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 14,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
  webCoverHeader: {
    height: 140,
    width: '100%',
    position: 'relative',
    backgroundColor: '#CBD5E1',
  },
  webCoverImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  webCoverGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  webAvatarCenterWrapper: {
    alignSelf: 'center',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    marginTop: -65,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  webAvatarCenterImg: {
    width: '100%',
    height: '100%',
  },
  webAvatarCenterFallback: {
    backgroundColor: 'rgba(255, 75, 51, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webAvatarCenterFallbackText: {
    color: '#FF4B33',
    fontSize: 42,
    fontWeight: '900',
  },
  webCardBody: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  webBadgesCenterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  proBadgeText: {
    color: ORANGE,
    fontSize: 10,
    fontWeight: '800',
  },
  fanBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  fanBadgeText: {
    color: '#D97706',
    fontSize: 10,
    fontWeight: '800',
  },
  craftBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  craftBadgeText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
  },
  nameCenterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 2,
  },
  webFullNameCentered: {
    fontSize: 19,
    fontWeight: '900',
    color: INK,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  verifiedBadgeCircle: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleCenterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 10,
  },
  webHandleText: {
    fontSize: 12,
    fontWeight: '800',
    color: ORANGE,
    letterSpacing: 0.5,
    textTransform: 'lowercase',
  },
  webBioCentered: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
    marginBottom: 14,
  },
  socialCenterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  socialIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  websitePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  websiteText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  statsCenterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 14,
    marginBottom: 16,
  },
  statCenterItem: {
    alignItems: 'center',
  },
  statCenterVal: {
    fontSize: 20,
    fontWeight: '900',
    color: INK,
  },
  statCenterLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.6,
    marginTop: 2,
  },
  actionsCenterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  webEditBtnLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORANGE,
    height: 38,
    paddingHorizontal: 22,
    borderRadius: 10,
    gap: 6,
  },
  webEditBtnLargeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  actionIconRoundBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsScrollView: {
    maxHeight: 44,
    marginVertical: 14,
  },
  tabsContainer: {
    paddingHorizontal: 14,
    gap: 8,
    alignItems: 'center',
  },
  webTabBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  webTabBtnActive: {
    backgroundColor: ORANGE,
    borderColor: ORANGE,
  },
  webTabBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  webTabBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  loadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  tabContentArea: {
    paddingHorizontal: 14,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: INK,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 280,
  },
  gridModeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  gridCountText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.3,
  },
  gridModeToggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  gridModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  gridModeBtnActive: {
    backgroundColor: INK,
  },
  gridModeBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  gridModeBtnTextActive: {
    color: '#FFFFFF',
  },
  threeColumnGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  gridSquareCell: {
    width: '32%',
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
  gridJobBox: {
    flex: 1,
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  gridJobPill: {
    backgroundColor: 'rgba(255, 75, 51, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  gridJobPillText: {
    color: ORANGE,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  gridJobTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: INK,
    textAlign: 'center',
    lineHeight: 13,
  },
  gridJobCompany: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
  gridCellVideoBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCellMultiBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.65)',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCellTextFallback: {
    flex: 1,
    padding: 8,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridCellTextContent: {
    fontSize: 10,
    color: INK,
    lineHeight: 13,
    textAlign: 'center',
  },
  addPortfolioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORANGE,
    borderRadius: 12,
    height: 42,
    gap: 6,
    marginBottom: 12,
  },
  addPortfolioBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  postCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  postContent: {
    fontSize: 13.5,
    color: INK,
    lineHeight: 19,
  },
  // ── Native APK Project Card Styles ──────────────────────────────────────────
  apkProjectCard: {
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.8)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  apkCardImageContainer: {
    width: '100%',
    height: 180,
    position: 'relative',
    overflow: 'hidden',
  },
  apkCardImage: {
    width: '100%',
    height: '100%',
  },
  apkBookmarkBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  apkSceneBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  apkSceneBadgeText: {
    fontSize: 9.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  apkCardMenuBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  apkCardBody: {
    padding: 16,
    gap: 8,
  },
  apkProjectTitle: {
    fontSize: 17,
    fontFamily: Platform.OS === 'ios' ? 'Lora-Bold' : 'serif',
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  apkProjectLogline: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '400',
  },
  apkSlugTagsContainer: {
    gap: 7,
    marginTop: 4,
    marginBottom: 4,
  },
  apkSlugTagLocationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  apkSlugTagsSecondaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  apkSlugTagGray: {
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 6,
  },
  apkSlugTagGrayText: {
    fontSize: 9.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  apkSlugTagRed: {
    backgroundColor: '#FFF5F4',
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 51, 0.25)',
    paddingHorizontal: 9,
    paddingVertical: 4.5,
    borderRadius: 6,
  },
  apkSlugTagRedText: {
    color: ORANGE,
    fontSize: 9.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  apkCardFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 4,
  },
  apkTimeAgoText: {
    fontSize: 12,
    fontWeight: '400',
  },
  apkViewProjectCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  apkViewProjectCTAText: {
    color: '#FF8A7A',
    fontSize: 12.5,
    fontWeight: '700',
  },

  // ── Native APK Announcement Card Styles ──────────────────────────────────
  apkAnnouncementCard: {
    marginBottom: 16,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  apkCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  apkMegaphoneBadgeBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  apkCompanyLogoImg: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  apkCardTitleText: {
    fontSize: 15,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Lora-Bold' : 'serif',
    lineHeight: 20,
  },
  apkTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  apkTimeText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  apkMoreOptionsBtn: {
    padding: 6,
  },
  apkContentBodyText: {
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 10,
  },
  apkAnnouncementMediaImg: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginBottom: 12,
  },
  apkFromTagBox: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  apkFromTagText: {
    color: ORANGE,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  apkShareBtn: {
    padding: 6,
  },
  projectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  projectTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: INK,
  },
  projectCategory: {
    fontSize: 10,
    fontWeight: '800',
    color: ORANGE,
    marginTop: 2,
    marginBottom: 6,
  },
  projectDesc: {
    fontSize: 13,
    color: '#475569',
  },
  announcementCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  announcementTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: INK,
  },
  announcementBody: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
  },
  analyticsContainer: {
    gap: 14,
  },
  analyticsHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: INK,
  },
  analyticsStatsGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  analyticsStatBox: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  analyticsVal: {
    fontSize: 22,
    fontWeight: '900',
    color: ORANGE,
  },
  analyticsLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    marginTop: 2,
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chartTitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  creditCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  creditTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: INK,
  },
  creditRole: {
    fontSize: 12,
    color: ORANGE,
    fontWeight: '700',
    marginTop: 2,
  },
  addInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  addInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    fontSize: 13,
    color: INK,
    marginBottom: 8,
  },
  addBtn: {
    backgroundColor: ORANGE,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  skillsChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  skillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  skillChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: INK,
  },
  addExpTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORANGE,
    borderRadius: 12,
    height: 42,
    gap: 6,
    marginBottom: 14,
  },
  addExpTriggerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  expFormCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  expFormTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: INK,
    marginBottom: 10,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '800',
  },
  saveBtn: {
    flex: 1,
    backgroundColor: ORANGE,
    borderRadius: 8,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  expCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  expTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: INK,
  },
  expCompany: {
    fontSize: 12,
    color: ORANGE,
    fontWeight: '700',
    marginTop: 2,
  },
  expDate: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  // Profile & Account Switcher Modal Styles (Web Parity)
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    maxHeight: '82%',
    paddingTop: 10,
    paddingBottom: 28,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 20,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    maxHeight: 520,
  },
  modalScrollContent: {
    paddingBottom: 16,
  },
  modalSectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  modalActiveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  modalActiveCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  modalAvatarBox: {
    position: 'relative',
    width: 44,
    height: 44,
  },
  modalAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  modalAvatarFallback: {
    backgroundColor: 'rgba(255, 75, 51, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAvatarFallbackText: {
    color: '#FF4B33',
    fontWeight: '800',
    fontSize: 18,
  },
  modalOnlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22C55E',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  modalActiveDetails: {
    flex: 1,
  },
  modalActiveNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modalActiveName: {
    fontSize: 15,
    fontWeight: '800',
  },
  modalActiveHandle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 1,
  },
  modalActiveCheckBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FF4B33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSavedAccCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    marginBottom: 8,
  },
  modalSwitchBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  modalSwitchBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalActionsSection: {
    marginTop: 16,
    gap: 10,
  },
  modalAddAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    gap: 8,
  },
  modalAddAccountBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  modalSignOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    borderRadius: 12,
    gap: 8,
  },
  modalSignOutBtnText: {
    color: '#EF4444',
    fontSize: 13.5,
    fontWeight: '700',
  },
  tabSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tabSectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
    marginRight: 8,
  },
  tabSectionAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ORANGE,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  tabSectionAddBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  emptyIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 75, 51, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyCtaBtn: {
    backgroundColor: ORANGE,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 12,
  },
  emptyCtaBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  richProjectCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  projectCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  projectBadgesGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  projectStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  projectStatusText: {
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  projectGenrePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  projectGenreText: {
    fontSize: 9.5,
    fontWeight: '700',
  },
  richProjectTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  richProjectDesc: {
    fontSize: 12.5,
    lineHeight: 17,
    marginBottom: 10,
  },
  projectMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    marginBottom: 12,
  },
  projectMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  projectMetaText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  projectCardActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  openProjectSpaceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#8B5CF6',
    borderRadius: 10,
    paddingVertical: 9,
  },
  openProjectSpaceBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  viewProjectDetailBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 9,
  },
  viewProjectDetailBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  richAnnouncementCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  announcementHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  announcementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 75, 51, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  announcementBadgeText: {
    color: ORANGE,
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  announcementDateText: {
    fontSize: 11,
  },
  richAnnouncementTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  richAnnouncementBody: {
    fontSize: 12.5,
    lineHeight: 18,
    marginBottom: 10,
  },
  announcementMediaImg: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    marginBottom: 10,
    resizeMode: 'cover',
  },
  announcementFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  announcementStatsGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  announcementStatPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  announcementStatText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  announcementShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  announcementShareText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  analyticsTitleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  analyticsIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 75, 51, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyticsHeaderSub: {
    fontSize: 11,
    marginTop: 1,
  },
  analyticsMetricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  analyticsMetricCard: {
    width: '48%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  metricCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  metricCardLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  metricIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricCardValue: {
    fontSize: 20,
    fontWeight: '900',
  },
  metricGrowthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  metricGrowthText: {
    color: '#10B981',
    fontSize: 10,
    fontWeight: '800',
  },
  metricSubLabel: {
    fontSize: 10,
    marginTop: 4,
  },
  analyticsSummaryCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  analyticsSummaryTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 10,
  },
  summaryMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryItemLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  summaryItemValue: {
    fontSize: 16,
    fontWeight: '900',
    marginVertical: 2,
  },
  summaryItemSub: {
    fontSize: 9.5,
  },
  summaryDivider: {
    width: 1,
    height: 28,
  },
  analyticsRangeBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 6,
  },
  analyticsRangePillsGroup: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    padding: 3,
    borderRadius: 10,
  },
  analyticsRangePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  analyticsRangePillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  analyticsUpdatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 75, 51, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  analyticsUpdatedText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: ORANGE,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chartCardHeaderRow: {
    marginBottom: 8,
  },
  chartLegendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 10,
  },
  chartLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chartLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chartLegendText: {
    fontSize: 10,
    fontWeight: '700',
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

export default ProfileScreen;
