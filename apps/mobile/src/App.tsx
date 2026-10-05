import React, { useEffect, useState, useRef } from 'react';
import { StatusBar, Linking, View, StyleSheet, Text, TextInput, AppState, TouchableOpacity, ActivityIndicator, BackHandler } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import { NavigationContainer, useNavigationContainerRef, getStateFromPath } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { initializeSupabase, getSupabaseClient, Session } from '@cinecraft/api';
import { setupMobileStorage, NativeSecureKeyStore, clearAllDeviceE2EEKeys, secureGetItem } from './services/mobileStorage';
import messaging from '@react-native-firebase/messaging';
import { registerForPushNotifications, setupFCMListeners, handleNotificationNavigation, getPendingNotificationData, flushPendingNotification, resolveNotificationDeepLink } from './services/mobilePush';
import { consumeOAuthPending } from './services/oauthGuard';
import { setupNotificationActionListener } from './services/notificationActionHandler';
import { setActiveChatContext, clearActiveChatContext } from './services/activeScreenTracker';
import { AppNavigator } from './navigation/AppNavigator';
import { E2EERecoveryPinModal } from './components/security/E2EERecoveryPinModal';
import { Icon } from './components/common/Icon';
import { FeedSkeletonScreen } from './components/common/Skeleton';
import { ENV } from './config/env';
import {
  saveCache,
  getCache,
  clearCache,
  clearAllOfflineCaches,
  withTimeout,
  setCachedCurrentUserId,
  getCurrentUserIdSync,
  resolveCurrentUserId,
  warmAllSavedAccountCaches,
} from './services/offlineCache';
import {
  notifyKeyChanged,
  setSyncPrivateKey,
  generateAndStoreFreshKeyPair,
} from './services/e2eeKeyEvents';
import { CallProvider } from './contexts/CallContext';
import { SettingsProvider, useUserSettings } from './contexts/SettingsContext';
import { PresenceProvider } from './contexts/PresenceContext';
import { ToastProvider, installAlertInterceptor } from './contexts/ToastContext';
import { GlobalCallPipOverlay } from './components/calls/GlobalCallPipOverlay';
import { CallLifecycle } from './components/calls/CallLifecycle';
import { AccountSwitchProvider } from './contexts/AccountSwitchContext';
import {
  saveCurrentAccount as amSaveCurrentAccount,
  updateSavedAccountTokens,
} from './services/accountManager';

// Install Universal Alert Interceptor to upgrade all standard alerts to CineCraft Toasts & Dialogs
installAlertInterceptor();

// ── Apply Global Web-Matched Typography (Lora Serif for Total App) ────────────────────────
const applyGlobalFont = () => {
  const customTextProps = {
    style: {
      fontFamily: 'Lora-Regular',
    },
  };
  // @ts-ignore
  if (Text.defaultProps) {
    // @ts-ignore
    Text.defaultProps.style = [{ fontFamily: 'Lora-Regular' }, Text.defaultProps.style];
  } else {
    // @ts-ignore
    Text.defaultProps = customTextProps;
  }

  // @ts-ignore
  if (TextInput.defaultProps) {
    // @ts-ignore
    TextInput.defaultProps.style = [{ fontFamily: 'Lora-Regular' }, TextInput.defaultProps.style];
  } else {
    // @ts-ignore
    TextInput.defaultProps = customTextProps;
  }
};
applyGlobalFont();

// Initialize Mobile Storage Bridge
setupMobileStorage();

// Initialize Shared Supabase Client
initializeSupabase(ENV.SUPABASE_URL, ENV.SUPABASE_ANON_KEY, {
  detectSessionInUrl: true,
});

const normalizeDeepLink = (url: string | null): string | null => {
  if (!url) return null;
  let normalized = url;
  if (normalized.includes('/discussion-rooms/')) {
    normalized = normalized.replace('/discussion-rooms/', '/discussions/');
  }
  if (normalized.includes('/project-space/')) {
    normalized = normalized.replace('/project-space/', '/projects/');
  }
  return normalized;
};

const linking: any = {
  prefixes: ['cinecraftconnect://', 'https://cinecraftconnect.com'],
  async getInitialURL() {
    try {
      const fcm = messaging();
      if (fcm) {
        const initialMsg = await fcm.getInitialNotification();
        if (initialMsg?.data) {
          console.log('[Linking] Initial notification data from quit state:', initialMsg.data);
          const link = resolveNotificationDeepLink(initialMsg.data);
          if (link) return normalizeDeepLink(link);
        }
      }
    } catch (e) {
      console.warn('[Linking] getInitialNotification error:', e);
    }

    try {
      const { NativeModules } = require('react-native');
      if (NativeModules.NotificationBridge?.getInitialNotificationData) {
        const bridgeData = await NativeModules.NotificationBridge.getInitialNotificationData();
        if (bridgeData) {
          console.log('[Linking] NotificationBridge initial data:', bridgeData);
          if (bridgeData.url) {
            return normalizeDeepLink(bridgeData.url);
          }
          if (bridgeData.screen === 'DiscussionRoomDetail' && bridgeData.partnerId) {
            return `cinecraftconnect://discussions/${bridgeData.partnerId}`;
          }
          if (bridgeData.screen === 'ProjectSpace' && bridgeData.partnerId) {
            return `cinecraftconnect://projects/${bridgeData.partnerId}`;
          }
          if (bridgeData.screen === 'Conversation' && bridgeData.partnerId) {
            return `cinecraftconnect://messages/${bridgeData.partnerId}`;
          }
        }
      }
    } catch (bridgeErr) {
      console.warn('[Linking] NotificationBridge getInitialNotificationData error:', bridgeErr);
    }

    const url = await Linking.getInitialURL();
    return normalizeDeepLink(url);
  },
  subscribe(listener: (url: string) => void) {
    const onReceiveURL = ({ url }: { url: string }) => {
      console.log('[Linking] Deep link received:', url);
      const normalized = normalizeDeepLink(url);
      if (normalized) {
        listener(normalized);
      }
    };
    const linkSub = Linking.addEventListener('url', onReceiveURL);

    let unsubscribeFCM = () => {};
    try {
      const fcm = messaging();
      if (fcm) {
        unsubscribeFCM = fcm.onNotificationOpenedApp((remoteMessage) => {
          console.log('[Linking] FCM opened from background:', remoteMessage);
          if (remoteMessage?.data) {
            const link = resolveNotificationDeepLink(remoteMessage.data);
            if (link) {
              const normalized = normalizeDeepLink(link);
              if (normalized) {
                listener(normalized);
              }
            }
          }
        });
      }
    } catch (e) {
      console.warn('[Linking] onNotificationOpenedApp error:', e);
    }

    return () => {
      linkSub.remove();
      unsubscribeFCM();
    };
  },
  config: {
    screens: {
      MainTabs: {
        screens: {
          Feed: 'feed',
          Messages: 'messages',
          Projects: 'projects',
          Discussions: 'discussions',
          Jobs: 'jobs',
          Network: 'network',
        },
      },
      Landing: 'landing',
      Login: 'login',
      Register: 'register',
      Conversation: 'messages/:conversationId',
      ProjectSpace: 'projects/:projectId',
      DiscussionRoomDetail: 'discussions/:roomId',
      Search: 'search',
      Notifications: 'notifications',
    },
  },
  getStateFromPath(path: string, options: any) {
    const normalized = normalizeDeepLink(path) || path;
    const defaultState = getStateFromPath(normalized, options);
    if (!defaultState || !defaultState.routes || defaultState.routes.length === 0) {
      return defaultState;
    }
    const topRoute = defaultState.routes[defaultState.routes.length - 1];
    const isDetailScreen =
      topRoute.name === 'DiscussionRoomDetail' ||
      topRoute.name === 'ProjectSpace' ||
      topRoute.name === 'Conversation' ||
      topRoute.name === 'PitchDetail' ||
      topRoute.name === 'JobDetail' ||
      topRoute.name === 'PostDetail' ||
      topRoute.name === 'ProjectDetail' ||
      topRoute.name === 'PublicProfile' ||
      topRoute.name === 'Notifications';

    if (isDetailScreen && defaultState.routes[0]?.name !== 'MainTabs') {
      let initialTab = 'Feed';
      if (topRoute.name === 'DiscussionRoomDetail') initialTab = 'Discussions';
      if (topRoute.name === 'ProjectSpace' || topRoute.name === 'ProjectDetail') initialTab = 'Projects';
      if (topRoute.name === 'Conversation') initialTab = 'Messages';

      return {
        routes: [
          {
            name: 'MainTabs',
            state: {
              routes: [{ name: initialTab }],
              index: 0,
            },
          },
          ...defaultState.routes,
        ],
        index: defaultState.routes.length,
      };
    }
    return defaultState;
  },
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [isOnboardingRequired, setIsOnboardingRequired] = useState(false);
  const [showE2EEBackup, setShowE2EEBackup] = useState(false);
  const [e2eeMode, setE2eeMode] = useState<'setup' | 'recovery'>('setup');
  const navigationRef = useNavigationContainerRef();
  const bootstrappedUserRef = useRef<string | null>(null);
  const isBootstrappingRef = useRef(false);

  /**
   * Zero-latency account switch callback — called by AccountManager's Phase 0
   * (before setSession even runs) with a synthetic session that already has
   * access + refresh tokens. ProfileScreen will read the skeleton profile from L1
   * cache instantly and show content with zero wait.
   */
  const handleAccountSwitch = (newSession: Session) => {
    // Reset bootstrap guards so the new user's profile/E2EE setup runs fresh
    bootstrappedUserRef.current = null;
    isBootstrappingRef.current = false;

    // Update root session state synchronously
    setSession(newSession);
    setIsBanned(false);
    setIsOnboardingRequired(false);
    setShowE2EEBackup(false);

    // Drive navigation to main content as the new user immediately
    if (navigationRef.isReady()) {
      navigationRef.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    }

    // Run a lightweight background bootstrap (non-blocking — will update profile
    // data from network without blocking the new account's UI from displaying).
    // The skeleton profile pre-warmed in L1 cache ensures instant initial render.
    bootstrapSession(newSession);
  };

  const preloadFeedInBackground = async () => {
    try {
      const supabase = getSupabaseClient();
      const fetchPosts = (supabase.from('posts') as any)
        .select(`
          *,
          profiles:author_id (id, full_name, username, avatar_url, craft, is_verified, account_type)
        `)
        .order('created_at', { ascending: false })
        .limit(20);
      const postsRes: any = await withTimeout(fetchPosts, 5000);
      const posts = postsRes?.data;
      if (posts && posts.length > 0) {
        await saveCache('feed_posts_For You', posts);
      }
    } catch (e) {
      console.warn('[App] Background feed preloader error:', e);
    }
  };

  const bootstrapSession = async (currentSession: Session) => {
    if (!currentSession?.user?.id) return;
    setCachedCurrentUserId(currentSession.user.id);
    if (bootstrappedUserRef.current === currentSession.user.id) return;
    if (isBootstrappingRef.current) return;
    isBootstrappingRef.current = true;

    try {
      // Save session in local cache for offline instant startup
      await saveCache('user_session', currentSession);

      // Instant hydration from local profile cache (0ms)
      const cachedProfile = await getCache<any>(`profile_${currentSession.user.id}`);
      if (cachedProfile) {
        if (cachedProfile.avatar_url) {
          AsyncStorage.setItem('@cinecraft_current_user_avatar', cachedProfile.avatar_url).catch(() => {});
          const { NativeModules } = require('react-native');
          if (NativeModules.NotificationBridge?.setCurrentUserAvatar) {
            NativeModules.NotificationBridge.setCurrentUserAvatar(cachedProfile.avatar_url);
          }
        }
        if (cachedProfile.is_banned) {
          setIsBanned(true);
          setIsOnboardingRequired(false);
          setIsAuthReady(true);
          bootstrappedUserRef.current = currentSession.user.id;
          if (navigationRef.isReady()) {
            navigationRef.reset({ index: 0, routes: [{ name: 'Suspended' }] });
          }
          return;
        }
        if (!cachedProfile.onboarding_completed) {
          setIsOnboardingRequired(true);
          setIsBanned(false);
          setIsAuthReady(true);
          bootstrappedUserRef.current = currentSession.user.id;
          if (navigationRef.isReady()) {
            navigationRef.reset({ index: 0, routes: [{ name: 'CompleteProfile' }] });
          }
          return;
        }
        setIsBanned(false);
        setIsOnboardingRequired(false);
        setIsAuthReady(true);
        if (navigationRef.isReady()) {
          const currentRoute = navigationRef.getCurrentRoute()?.name;
          const pending = getPendingNotificationData();
          if (pending) {
            flushPendingNotification(navigationRef);
          } else if (currentRoute === 'Landing' && !getPendingNotificationData()) {
            navigationRef.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
          }
        }
      }

      // Preload feed in background (non-blocking)
      preloadFeedInBackground().catch(() => { });

      const supabase = getSupabaseClient();
      let profileData: any = cachedProfile;

      // On a fresh login nothing is cached, so the E2EE lookups (key backup + public key) used to run
      // strictly after the profile round-trip. They are read-only, so start them now, in parallel.
      const e2eePrefetch = (async () => {
        const secureStore = new NativeSecureKeyStore();
        let localKey = await secureStore.getKey(`e2ee_private_key_${currentSession.user.id}`);
        if (!localKey) localKey = await secureStore.getKey(`priv_${currentSession.user.id}`);
        if (localKey) return { localKey, backupRes: null as any, profileRes: null as any };
        const [backupRes, profileRes]: any[] = await Promise.all([
          withTimeout(
            Promise.resolve((supabase as any).from('key_backups').select('user_id').eq('user_id', currentSession.user.id).maybeSingle()),
            3500
          ),
          Promise.resolve(supabase.from('profiles').select('public_key').eq('id', currentSession.user.id).maybeSingle()),
        ]);
        return { localKey: null as string | null, backupRes, profileRes };
      })();
      e2eePrefetch.catch(() => { });
      // Pull every chat's encrypted group key in one query so opening a project space / room is instant.
      require('./hooks/useGroupEncryption').prefetchGroupKeys(currentSession.user.id);

      // Refresh profile in background with network timeout
      try {
        const fetchProfilePromise = (async () => {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, onboarding_completed, is_banned, account_type, craft, is_verified, full_name, username, avatar_url')
            .eq('id', currentSession.user.id)
            .maybeSingle();
          return !error && data ? data : null;
        })();
        const freshProfile = await withTimeout(fetchProfilePromise, 2000);
        if (freshProfile) {
          profileData = freshProfile;
          await saveCache(`profile_${currentSession.user.id}`, freshProfile);
          if (freshProfile.avatar_url) {
            AsyncStorage.setItem('@cinecraft_current_user_avatar', freshProfile.avatar_url).catch(() => {});
            const { NativeModules } = require('react-native');
            if (NativeModules.NotificationBridge?.setCurrentUserAvatar) {
              NativeModules.NotificationBridge.setCurrentUserAvatar(freshProfile.avatar_url);
            }
          }
          // Automatically save account with live tokens into @cc_saved_accounts
          if (currentSession?.access_token && currentSession?.refresh_token) {
            amSaveCurrentAccount(freshProfile, currentSession).catch(() => {});
          }
        }
      } catch (timeoutErr) {
        console.warn('[App] Profile fetch network timeout/offline. Using cached profile.');
      }

      if (profileData) {
        if (profileData.is_banned) {
          setIsBanned(true);
          setIsOnboardingRequired(false);
          if (navigationRef.isReady()) {
            navigationRef.reset({ index: 0, routes: [{ name: 'Suspended' }] });
          }
          return;
        }
        if (!profileData.onboarding_completed) {
          setIsOnboardingRequired(true);
          setIsBanned(false);
          if (navigationRef.isReady()) {
            navigationRef.reset({ index: 0, routes: [{ name: 'CompleteProfile' }] });
          }
          return;
        }
      }

      setIsBanned(false);
      setIsOnboardingRequired(false);

      // Check E2EE Keystore with timeout protection
      try {
        const { localKey, backupRes, profileRes } = await e2eePrefetch;

        if (localKey) {
          // Key already on device — cache synchronously and broadcast to all screens
          setSyncPrivateKey(currentSession.user.id, localKey);
          notifyKeyChanged(currentSession.user.id, localKey);
        } else {
          // No local key on device: check if user has a remote backup
          const backup = backupRes?.data;

          if (backup) {
            // Existing user with PIN backup: prompt PIN recovery
            setE2eeMode('recovery');
            setShowE2EEBackup(true);
          } else {
            // Check if user already has an active public_key (e.g. from Web or prior session)
            const profile = profileRes?.data;

            if (profile?.public_key) {
              // User has an existing public key from another device (e.g. Web).
              // Prompt recovery mode so they can enter PIN or choose explicit reset,
              // rather than silently overwriting their profile.public_key and breaking Web.
              setE2eeMode('recovery');
              setShowE2EEBackup(true);
            } else {
              // Truly fresh account with no existing public key:
              // Generate local key pair so chats work immediately, then prompt PIN backup setup
              try {
                const freshKey = await generateAndStoreFreshKeyPair(currentSession.user.id);
                if (freshKey) {
                  setSyncPrivateKey(currentSession.user.id, freshKey);
                  notifyKeyChanged(currentSession.user.id, freshKey);
                }
              } catch (genErr) {
                console.warn('[App] Key generation error:', genErr);
              }
              setE2eeMode('setup');
              setShowE2EEBackup(true);
            }
          }
        }
      } catch (e2eeErr) {
        console.warn('[App] E2EE key check skipped due to timeout/offline');
      }

      bootstrappedUserRef.current = currentSession.user.id;
      setIsAuthReady(true);
      if (navigationRef.isReady()) {
        const currentRoute = navigationRef.getCurrentRoute()?.name;
        const pending = getPendingNotificationData();
        if (pending) {
          flushPendingNotification(navigationRef);
        } else if (currentRoute === 'Landing' && !getPendingNotificationData()) {
          navigationRef.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
        }
      }
    } catch (e) {
      console.warn('[App] bootstrapSession error:', e);
      setIsAuthReady(true);
    } finally {
      isBootstrappingRef.current = false;
    }
  };

  useEffect(() => {
    if (!session?.user) return;
    try {
      const supabase = getSupabaseClient();
      const channel = supabase
        .channel(`profile_realtime_${session.user.id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}` },
          (payload: any) => {
            if (payload.new?.is_banned) {
              setIsBanned(true);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch (e) {
      console.warn('[App] Error setting up profile real-time update listener:', e);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    let isMounted = true;
    let authSub: any = null;
    let linkSub: any = null;
    let cleanupFCM: any = null;
    let cleanupNotificationAction: any = null;

    const initAuth = async () => {
      try {
        const supabase = getSupabaseClient();

        // Step 0: Pre-warm L1 cache for all saved accounts so switching is instant
        try {
          const { loadSavedAccounts: loadAccs } = require('./services/accountManager');
          const savedAccs = await loadAccs();
          if (savedAccs.length > 0) {
            warmAllSavedAccountCaches(savedAccs);
          }
        } catch {
          // Non-fatal
        }

        // Step 1: Immediately read offline cache (0ms)
        let activeSession = await getCache<Session>('user_session');

        // Fallback: If user_session was not in cache, check saved accounts or current_user_id
        if (!activeSession?.user?.id) {
          const uid = await resolveCurrentUserId();
          if (uid) {
            try {
              const savedAccsRaw = await secureGetItem('@cc_saved_accounts');
              if (savedAccsRaw) {
                const savedAccs = JSON.parse(savedAccsRaw);
                const currentAcc = Array.isArray(savedAccs)
                  ? savedAccs.find((a: any) => a.userId === uid) || savedAccs[0]
                  : null;
                if (currentAcc?.session?.access_token) {
                  activeSession = {
                    access_token: currentAcc.session.access_token,
                    refresh_token: currentAcc.session.refresh_token,
                    user: {
                      id: currentAcc.userId,
                      email: currentAcc.email,
                      user_metadata: {
                        full_name: currentAcc.fullName,
                        username: currentAcc.username,
                      },
                    } as any,
                  } as Session;
                  await saveCache('user_session', activeSession);
                }
              }
            } catch { }
          }
        }

        // Also check Supabase local storage if activeSession is still null
        if (!activeSession?.user?.id) {
          try {
            const { data: { session: localSupabaseSession } } = await supabase.auth.getSession();
            if (localSupabaseSession?.user?.id) {
              activeSession = localSupabaseSession;
              await saveCache('user_session', activeSession);
            }
          } catch { }
        }

        if (activeSession?.user?.id && isMounted) {
          setCachedCurrentUserId(activeSession.user.id);
          setSession(activeSession);
          setIsAuthReady(true);
          bootstrapSession(activeSession);
        } else if (isMounted) {
          // No session found anywhere -> show Landing
          setIsAuthReady(true);
        }

        // Step 2: Query remote Supabase session with timeout protection (never blocks if offline)
        try {
          const { data: { session: remoteSession } }: any = await withTimeout(
            supabase.auth.getSession(),
            2500
          );
          if (remoteSession?.user && isMounted) {
            setCachedCurrentUserId(remoteSession.user.id);
            setSession(remoteSession);
            await saveCache('user_session', remoteSession);
            registerForPushNotifications(remoteSession.user.id).catch(() => { });
            bootstrapSession(remoteSession);
          } else if (!activeSession?.user?.id && isMounted) {
            setCachedCurrentUserId(null);
            setSession(null);
            setIsAuthReady(true);
          }
        } catch (netErr) {
          console.log('[App] Auth network check skipped (offline mode). Retaining local session.');
        }

        // Step 3: Listen to auth state changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
          if (!isMounted) return;

          if (newSession?.user) {
            setCachedCurrentUserId(newSession.user.id);
            setSession(newSession);
            saveCache('user_session', newSession).catch(() => { });
            registerForPushNotifications(newSession.user.id).catch(() => { });
            bootstrapSession(newSession);
            if (newSession.access_token && newSession.refresh_token) {
              updateSavedAccountTokens(newSession.user.id, newSession.access_token, newSession.refresh_token).catch(() => {});
            }
          } else if (event === 'SIGNED_OUT') {
            // Guard against spurious SIGNED_OUT events that fire when Supabase's
            // auto-refresh fails due to a temporary network error or app-background resume.
            // Attempt to recover the session before committing to a full logout.
            (async () => {
              if (!isMounted) return;
              console.log('[App] SIGNED_OUT received — attempting session recovery before logout...');

              try {
                // First try: read the locally persisted session
                const { data: { session: localSession } } = await supabase.auth.getSession();
                if (localSession?.user && isMounted) {
                  console.log('[App] Session recovery succeeded via getSession(). Staying logged in.');
                  setCachedCurrentUserId(localSession.user.id);
                  setSession(localSession);
                  saveCache('user_session', localSession).catch(() => {});
                  bootstrapSession(localSession);
                  return;
                }

                // Second try: force a token refresh
                const { data: refreshData } = await supabase.auth.refreshSession();
                if (refreshData?.session?.user && isMounted) {
                  console.log('[App] Session recovery succeeded via refreshSession(). Staying logged in.');
                  setCachedCurrentUserId(refreshData.session.user.id);
                  setSession(refreshData.session);
                  saveCache('user_session', refreshData.session).catch(() => {});
                  bootstrapSession(refreshData.session);
                  return;
                }
              } catch (recoveryErr) {
                console.warn('[App] Session recovery attempt failed:', recoveryErr);
              }

              // Recovery exhausted — commit to actual logout
              if (!isMounted) return;
              console.log('[App] Session recovery failed. Committing to logout.');
              setCachedCurrentUserId(null);
              bootstrappedUserRef.current = null;
              isBootstrappingRef.current = false;
              setSession(null);
              notifyKeyChanged('', null);
              clearAllOfflineCaches().catch(() => { });
              clearAllDeviceE2EEKeys().catch(() => { });
              setIsBanned(false);
              setIsOnboardingRequired(false);
              setShowE2EEBackup(false);
              if (navigationRef.isReady()) {
                navigationRef.reset({
                  index: 0,
                  routes: [{ name: 'Landing' }],
                });
              }
            })();
          }
        });
        authSub = subscription;

        // Setup FCM Foreground & Background Listeners
        cleanupFCM = setupFCMListeners(navigationRef);
        cleanupNotificationAction = setupNotificationActionListener();

        // Deep linking OAuth handler for Google Sign In & auth callbacks
        const handleDeepLink = async (event: { url: string }) => {
          if (!event.url) return;
          try {
            const urlStr = event.url;

            if (urlStr.includes('cinecraftconnect://notification') || urlStr.includes('/notification')) {
              const queryPart = urlStr.includes('?') ? urlStr.split('?')[1] : '';
              if (queryPart) {
                const params = new URLSearchParams(queryPart);
                const dataObj: Record<string, string> = {};
                params.forEach((val, key) => {
                  dataObj[key] = val;
                });
                handleNotificationNavigation(dataObj, navigationRef);
                return;
              }
            }

            // Check for access_token in hash or query
            if (urlStr.includes('access_token')) {
              // Only accept a token handed to us by an OAuth flow this app started (see oauthGuard).
              if (!consumeOAuthPending()) {
                console.warn('[DeepLink] Ignoring access_token link: no OAuth sign-in in progress.');
                return;
              }
              const separator = urlStr.includes('#') ? '#' : '?';
              const paramsStr = urlStr.split(separator)[1];
              if (paramsStr) {
                const hashParams = new URLSearchParams(paramsStr);
                const accessToken = hashParams.get('access_token');
                const refreshToken = hashParams.get('refresh_token');
                if (accessToken && refreshToken) {
                  const { data } = await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                  });
                  if (data.session) {
                    setSession(data.session);
                    if (navigationRef.isReady()) {
                      navigationRef.reset({
                        index: 0,
                        routes: [{ name: 'MainTabs' }],
                      });
                    }
                  }
                }
              }
            } else if (urlStr.includes('code=')) {
              // PKCE code exchange flow
              const searchPart = urlStr.includes('?') ? urlStr.split('?')[1] : '';
              const code = new URLSearchParams(searchPart).get('code');
              if (code) {
                const { data } = await supabase.auth.exchangeCodeForSession(code);
                if (data.session) {
                  setSession(data.session);
                  if (navigationRef.isReady()) {
                    navigationRef.reset({
                      index: 0,
                      routes: [{ name: 'MainTabs' }],
                    });
                  }
                }
              }
            }
          } catch (e) {
            console.warn('[DeepLink] OAuth exchange error:', e);
          }
        };

        linkSub = Linking.addEventListener('url', handleDeepLink);

        // Also inspect initial URL if cold launched from OAuth redirect
        Linking.getInitialURL().then((url) => {
          if (url) {
            handleDeepLink({ url });
          }
        });
      } catch (err) {
        console.warn('[App] Error initializing auth:', err);
        if (isMounted) setIsAuthReady(true);
      } finally {
        if (isMounted) setIsAuthReady(true);
      }
    };

    initAuth();

    return () => {
      isMounted = false;
      if (authSub?.unsubscribe) {
        authSub.unsubscribe();
      }
      if (cleanupFCM) {
        cleanupFCM();
      }
      if (cleanupNotificationAction) {
        cleanupNotificationAction();
      }
      if (linkSub?.remove) {
        linkSub.remove();
      }
    };
  }, []);

  const getInitialRoute = () => {
    if (isBanned) return 'Suspended';
    if (isOnboardingRequired) return 'CompleteProfile';
    if (session?.user || getCurrentUserIdSync()) return 'MainTabs';
    return 'Landing';
  };

  if (!isAuthReady) {
    return (
      <SettingsProvider>
        <FeedSkeletonScreen />
      </SettingsProvider>
    );
  }

  const initialRouteName = getInitialRoute();

  return (
    <SettingsProvider>
      <CallProvider>
        <PresenceProvider>
          <AccountSwitchProvider value={{ onAccountSwitch: handleAccountSwitch }}>
            <AppShell
              navigationRef={navigationRef}
              initialRouteName={initialRouteName}
              showE2EEBackup={showE2EEBackup}
              e2eeMode={e2eeMode}
              setShowE2EEBackup={setShowE2EEBackup}
              onAccountSwitch={handleAccountSwitch}
            />
          </AccountSwitchProvider>
        </PresenceProvider>
      </CallProvider>
    </SettingsProvider>
  );
}

const AppShell = ({
  navigationRef,
  initialRouteName,
  showE2EEBackup,
  e2eeMode,
  setShowE2EEBackup,
  onAccountSwitch,
}: any) => {
  const { settings, themeColors, isDark } = useUserSettings();
  const isLight = !isDark;

  // Biometric App Lock State
  const [isAppLocked, setIsAppLocked] = useState(false);

  useEffect(() => {
    if (settings.biometric_lock) {
      setIsAppLocked(true);
    }
  }, [settings.biometric_lock]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && settings.biometric_lock) {
        setIsAppLocked(true);
      }
    });
    return () => subscription.remove();
  }, [settings.biometric_lock]);

  useEffect(() => {
    const onHardwareBackPress = () => {
      if (!navigationRef || typeof navigationRef.isReady !== 'function' || !navigationRef.isReady()) {
        return false;
      }
      try {
        if (navigationRef.canGoBack()) {
          navigationRef.goBack();
          return true;
        }

        const currentRoute = navigationRef.getCurrentRoute();
        const routeName = currentRoute?.name;

        // If user is at root Landing, Feed, or Suspended, let system back action close app
        if (!routeName || routeName === 'Landing' || routeName === 'Feed' || routeName === 'Suspended') {
          return false;
        }

        if (routeName === 'DiscussionRoomDetail' || routeName === 'Discussions') {
          navigationRef.reset({
            index: 0,
            routes: [{ name: 'MainTabs', state: { routes: [{ name: 'Discussions' }], index: 0 } }],
          });
          return true;
        }

        if (routeName === 'ProjectSpace' || routeName === 'Projects' || routeName === 'ProjectDetail' || routeName === 'CreateProject') {
          navigationRef.reset({
            index: 0,
            routes: [{ name: 'MainTabs', state: { routes: [{ name: 'Projects' }], index: 0 } }],
          });
          return true;
        }

        if (routeName === 'Conversation' || routeName === 'Messages') {
          navigationRef.reset({
            index: 0,
            routes: [{ name: 'MainTabs', state: { routes: [{ name: 'Messages' }], index: 0 } }],
          });
          return true;
        }

        // Any other detail screen -> fall back to MainTabs Feed
        navigationRef.reset({
          index: 0,
          routes: [{ name: 'MainTabs' }],
        });
        return true;
      } catch (e) {
        return false;
      }
    };

    const backSub = BackHandler.addEventListener('hardwareBackPress', onHardwareBackPress);
    return () => backSub.remove();
  }, [navigationRef]);

  const handleUnlockApp = async () => {
    try {
      await Keychain.getGenericPassword({
        authenticationPrompt: {
          title: 'Unlock CineCraft Connect',
          subtitle: 'Verify biometric identity to open application',
        },
      });
      setIsAppLocked(false);
    } catch {
      // Fallback for emulators without configured fingerprint
      setIsAppLocked(false);
    }
  };

  const navTheme = {
    dark: !isLight,
    colors: {
      primary: '#FF4B33',
      background: themeColors.bgScreen,
      card: themeColors.bgCard,
      text: themeColors.textPrimary,
      border: themeColors.border,
      notification: '#FF4B33',
    },
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider style={{ backgroundColor: themeColors.bgScreen }}>
        <ToastProvider>
          <StatusBar
            barStyle={isLight ? 'dark-content' : 'light-content'}
            backgroundColor={themeColors.bgScreen}
          />
          <NavigationContainer
            ref={navigationRef}
            linking={linking}
            theme={navTheme}
            onReady={() => {
              console.log('[App] NavigationContainer is ready. Flushing queued pending notification.');
              flushPendingNotification(navigationRef);
            }}
            onStateChange={() => {
              try {
                const currentRoute = navigationRef.getCurrentRoute();
                if (currentRoute) {
                  const name = currentRoute.name;
                  const params: any = currentRoute.params || {};
                  if (name === 'DiscussionRoomDetail') {
                    setActiveChatContext({
                      screen: 'DiscussionRoomDetail',
                      roomId: params.roomId || params.room_id || params.relatedId || params.id,
                    });
                  } else if (name === 'ProjectSpace') {
                    setActiveChatContext({
                      screen: 'ProjectSpace',
                      projectId: params.projectId || params.project_id || params.relatedId || params.id,
                      spaceId: params.spaceId || params.space_id || params.project_space_id,
                    });
                  } else if (name === 'Conversation') {
                    setActiveChatContext({
                      screen: 'Conversation',
                      partnerId: params.partnerId || params.partner_id || params.senderId || (params.conversationId && typeof params.conversationId === 'string' && params.conversationId.includes('-') ? params.conversationId : undefined),
                      conversationId: params.conversationId || params.channelId,
                    });
                  } else {
                    clearActiveChatContext();
                  }
                }
              } catch {}
            }}
            children={React.createElement(AppNavigator as any, {
              key: 'root-app-nav',
              initialRoute: initialRouteName,
            })}
          />

          {/* Global Floating PiP Call Overlay (persists across all navigation) */}
          <GlobalCallPipOverlay navigationRef={navigationRef} />
          <CallLifecycle />

          {/* Cryptographic E2EE PIN Recovery/Setup Modal */}
          <E2EERecoveryPinModal
            visible={showE2EEBackup}
            mode={e2eeMode}
            onClose={() => setShowE2EEBackup(false)}
            onSuccess={() => setShowE2EEBackup(false)}
          />

          {/* Biometric App Lock Screen Overlay */}
          {isAppLocked && (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: themeColors.bgScreen, zIndex: 99999, justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
              <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255, 75, 51, 0.12)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                <Icon name="shield" size={36} color="#FF4B33" strokeWidth={2.2} />
              </View>
              <Text style={{ fontSize: 20, fontFamily: 'Lora-Bold', fontWeight: '700', color: themeColors.textPrimary, marginBottom: 8, textAlign: 'center' }}>
                CineCraft Protected
              </Text>
              <Text style={{ fontSize: 13, fontFamily: 'WorkSans-Regular', color: themeColors.textSecondary, textAlign: 'center', marginBottom: 28, maxWidth: 280, lineHeight: 18 }}>
                Biometric authentication is required to access your filmmaker workspace and encrypted messages.
              </Text>
              <TouchableOpacity
                style={{ backgroundColor: '#FF4B33', paddingHorizontal: 28, paddingVertical: 13, borderRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                activeOpacity={0.8}
                onPress={handleUnlockApp}
              >
                <Icon name="lock" size={16} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
                  Unlock Application
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
});
