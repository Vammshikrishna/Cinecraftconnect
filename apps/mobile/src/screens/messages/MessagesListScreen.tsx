import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Image,
  ActivityIndicator,
  Modal,
  InteractionManager,
  Alert,
  Dimensions,
  GestureResponderEvent,
} from 'react-native';
import { useDropdownMenu, DropdownItem } from '../../components/common/DropdownMenu';
import { useMessageRequests } from '../../hooks/useMessageRequests';
import { useConversationPrefs, pinnedFirst } from '../../hooks/useConversationPrefs';
import { MessageRequestsEntry, MessageRequestsModal } from '../../components/chat/MessageRequestsParts';
import type { MessageRequestRow } from '../../utils/messageRequests';
import { Header } from '../../components/Header';
import { useFocusEffect } from '@react-navigation/native';
import { useIsOffline } from '../../hooks/useIsOffline';
import { OfflineEmptyState } from '../../components/common/OfflineEmptyState';
import { Icon } from '../../components/common/Icon';
import { TabletContainer } from '../../components/common/TabletContainer';
import { getSupabaseClient } from '@cinecraft/api';
import { decryptDirectMessage } from '@cinecraft/e2ee';
import { useE2EEChatKeys } from '../../hooks/useE2EEChatKeys';
import { confirmAndDeleteConversation } from '../../utils/deleteConversation';
import { fetchWithCache, getCache, saveCache, getCacheSync, getCurrentUserIdSync, resolveCurrentUserId, setCachedCurrentUserId } from '../../services/offlineCache';
import { useAutoRefreshOnReconnect } from '../../hooks/useAutoRefreshOnReconnect';
import { ConversationListSkeleton } from '../../components/common/Skeleton';
import { CachedImage } from '../../components/common/CachedImage';
import { FlashList } from '@shopify/flash-list';
import { useUserSettings } from '../../hooks/useUserSettings';
import { usePresence } from '../../hooks/usePresence';
import { requestE2EEPrompt } from '../../services/e2eeState';
import { E2EEOfferCard } from '../../components/security/E2EEOfferCard';
import { resolveChatParams, blockedBothWays } from '../../utils/chatParams';
import { getChatClearedAt, isAfterChatClear } from '../../utils/chatClearMarker';

const FlashListAny = FlashList as any;

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

interface ConversationItem {
  id: string;
  partner: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
    craft?: string | null;
  };
  lastMessage?: string;
  lastMessageTime?: string;
  updated_at: string;
  unreadCount?: number;
}

const cleanDisplayMessage = (content?: string | null) => {
  if (!content) return '';
  if (
    content.includes('__e2ee') ||
    content.includes('__e2ee_group') ||
    content.includes('__e2ee_thread') ||
    (content.startsWith('{') && (content.includes('"version":2') || content.includes('"type":"group"')))
  ) {
    return '🔒 Encrypted Message';
  }
  if (content.startsWith('POST_SHARE::')) return 'Shared a post';
  if (content.startsWith('MARKETPLACE_SHARE::')) return 'Shared a marketplace listing';
  if (content.startsWith('ANNOUNCEMENT_SHARE::')) return 'Shared an announcement';
  if (content.startsWith('VENDOR_SHARE::')) return 'Shared a vendor profile';
  if (content.startsWith('PROJECT_SHARE::')) return 'Shared a project';
  if (content.startsWith('DISCUSSION_SHARE::')) return 'Shared a discussion room';
  if (content.startsWith('JOB_SHARE::')) return 'Shared a job';
  if (content.startsWith('PROFILE_SHARE::')) return 'Shared a profile';
  if (content.startsWith('PITCH_SHARE::')) return 'Shared a pitch deck';
  if (content.startsWith('CONTENT_SHARE::')) return 'Shared a video/content';
  if (content.startsWith('FORWARDED::')) return content.replace('FORWARDED::', '');
  return content;
};

const generateDirectRoomId = (userId1: string, userId2: string): string => {
  const [id1, id2] = [userId1, userId2].sort();
  if (id1?.length === 36 && id2?.length === 36) {
    return id1.slice(0, 18) + id2.slice(18);
  }
  return `${id1}-${id2}`.slice(0, 36);
};

export const MessagesListScreen = ({ navigation, route }: { navigation: any; route?: any }) => {
  const isOffline = useIsOffline();
  const { requests, hiddenRequests, deletedRequests, hasV2, requestPartnerIds, refresh: refreshRequests } = useMessageRequests();
  const { prefs: convoPrefs, toggleMute, togglePin, migrateLegacyMutes } = useConversationPrefs();
  const [showRequests, setShowRequests] = useState(false);
  const { settings, themeColors, isDark } = useUserSettings();
  const { isUserOnline } = usePresence();
  const initialCached = getCacheSync<ConversationItem[]>('user_conversations');
  const [conversations, setConversations] = useState<ConversationItem[]>(() => initialCached || []);
  // "Clear chat" markers (this device only) per partner, so a cleared chat shows no old preview
  const [clearedMap, setClearedMap] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState<boolean>(() => !initialCached || initialCached.length === 0);
  const currentUserIdRef = useRef<string | null>(null);
  const isFetchingRef = useRef<boolean>(false);
  const lastFetchTimeRef = useRef<number>(0);

  // E2EE Keys
  const { privateKey } = useE2EEChatKeys();
  // ask for the PIN (only for people who turned encrypted messages on and need to unlock or set up)
  useEffect(() => { requestE2EEPrompt(); }, []);
  const privateKeyRef = useRef<string | null>(privateKey);
  useEffect(() => {
    privateKeyRef.current = privateKey;
  }, [privateKey]);

  // New Chat modal state
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [crewSearch, setCrewSearch] = useState('');
  const [crewResults, setCrewResults] = useState<any[]>([]);
  const [searchingCrew, setSearchingCrew] = useState(false);

  const fetchConversations = useCallback(async (isInitial = true, force = false) => {
    const now = Date.now();
    if (!force && !isInitial && now - lastFetchTimeRef.current < 4000) return;
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    lastFetchTimeRef.current = now;

    // 1. Instant local cache hydration from AsyncStorage if not in L1 yet
    const cached = await getCache<ConversationItem[]>('user_conversations');
    if (cached && cached.length > 0) {
      setConversations(cached);
      setLoading(false);
    }

    try {
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      let user = session?.user;
      if (!user) {
        const cachedSess = await getCache<any>('user_session');
        user = cachedSess?.user;
      }
      if (!user) return;
      currentUserIdRef.current = user.id;
      setCachedCurrentUserId(user.id);
      if (isInitial && (!cached || cached.length === 0)) setLoading(true);

      // 1. Try get_user_conversations_with_profiles RPC
      const { data: rpcData, error: rpcError } = await (supabase as any).rpc(
        'get_user_conversations_with_profiles',
        { p_user_id: user.id }
      );

      if (!rpcError && Array.isArray(rpcData)) {
        // Build sender map from recent direct messages to accurately identify if current user is sender or recipient
        const latestSenderMap = new Map<string, string>();
        try {
          const { data: latestDms } = await (supabase as any)
            .from('direct_messages')
            .select('sender_id, receiver_id')
            .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
            .order('created_at', { ascending: false })
            .limit(100);

          if (latestDms && Array.isArray(latestDms)) {
            for (const dm of latestDms) {
              const partnerId = dm.sender_id === user.id ? dm.receiver_id : dm.sender_id;
              if (partnerId && !latestSenderMap.has(partnerId)) {
                latestSenderMap.set(partnerId, dm.sender_id);
              }
            }
          }
        } catch (fetchSenderErr) {
          console.warn('[MessagesList] Could not fetch recent DM senders:', fetchSenderErr);
        }

        const enriched: ConversationItem[] = await Promise.all(
          rpcData.map(async (c: any) => {
            let decryptedPreview = c.last_message_content;
            if (c.last_message_content && (c.last_message_content.includes('__e2ee') || c.last_message_content.startsWith('{'))) {
              if (privateKeyRef.current) {
                try {
                  const lastSenderId = latestSenderMap.get(c.other_user_id);
                  const isSender = lastSenderId !== undefined
                    ? lastSenderId === user.id
                    : (Number(c.unread_count || 0) > 0 ? false : false);
                  decryptedPreview = await decryptDirectMessage(c.last_message_content, privateKeyRef.current, isSender);
                } catch {
                  decryptedPreview = '🔒 Encrypted Message';
                }
              } else {
                decryptedPreview = '🔒 Encrypted Message';
              }
            }

            return {
              id: c.other_user_id,
              partner: {
                id: c.other_user_id,
                full_name: c.other_user_full_name || 'Crew Member',
                username: null,
                avatar_url: c.other_user_avatar_url,
                craft: null,
              },
              lastMessage: cleanDisplayMessage(decryptedPreview),
              lastMessageTime: c.last_message_created_at,
              updated_at: c.last_message_created_at,
              unreadCount: Number(c.unread_count || 0),
            };
          })
        );
        setConversations(enriched);
        saveCache('user_conversations', enriched).catch(() => { });
        isFetchingRef.current = false;
        setLoading(false);
        return;
      }

      // 2. Direct fallback using direct_messages table
      const { data: dmData, error: dmError } = await (supabase as any)
        .from('direct_messages')
        .select(`
          id,
          content,
          created_at,
          sender_id,
          receiver_id,
          is_read,
          sender:profiles!direct_messages_sender_id_fkey(id, full_name, username, avatar_url, craft),
          receiver:profiles!direct_messages_receiver_id_fkey(id, full_name, username, avatar_url, craft)
        `)
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false })
        .limit(60);

      if (!dmError && dmData) {
        const map = new Map<string, ConversationItem>();
        for (const dm of dmData) {
          const isSender = dm.sender_id === user.id;
          const partner = isSender ? dm.receiver : dm.sender;
          const partnerId = partner?.id || (isSender ? dm.receiver_id : dm.sender_id);
          if (!partnerId) continue;

          let decryptedPreview = dm.content;
          if (dm.content && (dm.content.includes('__e2ee') || dm.content.startsWith('{'))) {
            if (privateKeyRef.current) {
              try {
                decryptedPreview = await decryptDirectMessage(dm.content, privateKeyRef.current, isSender);
              } catch {
                decryptedPreview = '🔒 Encrypted Message';
              }
            } else {
              decryptedPreview = '🔒 Encrypted Message';
            }
          }

          if (!map.has(partnerId)) {
            map.set(partnerId, {
              id: partnerId,
              partner: partner || { id: partnerId, full_name: 'Crew Member', username: 'user', avatar_url: null },
              lastMessage: cleanDisplayMessage(decryptedPreview),
              lastMessageTime: dm.created_at,
              updated_at: dm.created_at,
              unreadCount: !dm.is_read && dm.receiver_id === user.id ? 1 : 0,
            });
          } else {
            const existing = map.get(partnerId)!;
            if (!dm.is_read && dm.receiver_id === user.id) {
              existing.unreadCount = (existing.unreadCount || 0) + 1;
            }
          }
        }
        setConversations(Array.from(map.values()));
      }
    } catch (e) {
      console.warn('[MessagesList] Error fetching conversations:', e);
    } finally {
      isFetchingRef.current = false;
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        fetchConversations(false);
      });
      return () => task.cancel();
    }, [fetchConversations])
  );

  useEffect(() => {
    fetchConversations(true);

    let channel: any;
    const setupRt = async () => {
      const supabase = getSupabaseClient();
      const user = (await supabase.auth.getSession()).data.session?.user ?? null; // local session: getUser() is a network call
      if (!user) return;

      channel = supabase
        .channel(`dms-list-rt-${user.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'direct_messages' },
          () => { fetchConversations(false); }
        )
        .subscribe();
    };
    setupRt();

    return () => {
      if (channel) {
        try {
          channel.unsubscribe();
          const supabase = getSupabaseClient();
          supabase.removeChannel(channel);
        } catch { }
      }
    };
  }, [fetchConversations]);

  useAutoRefreshOnReconnect(() => fetchConversations(false));

  // Re-decrypt when private key is loaded
  useEffect(() => {
    if (privateKey) {
      fetchConversations(false, true);
    }
  }, [privateKey, fetchConversations]);

  // callers such as Network / PitchDetail open Messages with recipientId / recipientName (or partnerId, userId):
  // forward to the chat so the "Message" buttons keep working whichever key names they use
  const incomingRef = useRef<string | null>(null);
  useEffect(() => {
    const inc = resolveChatParams(route?.params);
    const key = inc.partnerId || inc.conversationId;
    if (!key || incomingRef.current === key) return;
    incomingRef.current = key;
    navigation.navigate('Conversation', inc);
  }, [route?.params, navigation]);

  const searchCrewMembers = async (q: string) => {
    setCrewSearch(q);
    if (!q.trim()) {
      setCrewResults([]);
      return;
    }
    setSearchingCrew(true);
    try {
      const supabase = getSupabaseClient();
      const user = (await supabase.auth.getSession()).data.session?.user ?? null; // local session: getUser() is a network call
      // hide people I blocked and people who blocked me
      let hidden = new Set<string>();
      if (user?.id) {
        try {
          const rpc = await (supabase as any).rpc('blocked_user_ids_both_ways');
          if (!rpc.error && Array.isArray(rpc.data)) {
            hidden = new Set<string>(rpc.data.map((r: any) => (typeof r === 'string' ? r : r?.blocked_user_ids_both_ways)).filter(Boolean));
          } else {
            const { data: rows } = await (supabase as any)
              .from('blocked_users')
              .select('user_id, blocked_user_id')
              .or(`user_id.eq.${user.id},blocked_user_id.eq.${user.id}`);
            hidden = blockedBothWays(user.id, rows);
          }
        } catch { /* keep searching even if the block list cannot be read */ }
      }
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, craft')
        .ilike('full_name', `%${q}%`)
        .neq('id', user?.id || '')
        .limit(20);

      setCrewResults((data || []).filter((p: any) => !hidden.has(p.id)).slice(0, 10));
    } catch (err) {
      console.warn('[MessagesList] Search error:', err);
    } finally {
      setSearchingCrew(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchConversations(false);
    setRefreshing(false);
  };

  const formatTime = (iso: string) => {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const list = conversations.filter((c) => {
      if (requestPartnerIds.has(c.partner?.id)) return false; // shown under Requests instead
      const name = (c.partner?.full_name || c.partner?.username || '').toLowerCase();
      const craft = (c.partner?.craft || '').toLowerCase();
      return name.includes(q) || craft.includes(q);
    });
    return pinnedFirst(list, convoPrefs);
  }, [conversations, searchQuery, requestPartnerIds, convoPrefs]);

  // one time: copy old per-phone mute choices into the synced table
  const migratedRef = useRef(false);
  useEffect(() => {
    if (migratedRef.current || conversations.length === 0) return;
    migratedRef.current = true;
    migrateLegacyMutes(conversations.map((c) => c.partner?.id).filter(Boolean));
  }, [conversations, migrateLegacyMutes]);

  const openRequest = useCallback((req: MessageRequestRow) => {
    setShowRequests(false);
    const userId = currentUserIdRef.current || getCurrentUserIdSync();
    navigation.navigate('Conversation', {
      conversationId: userId ? generateDirectRoomId(userId, req.partner_id) : undefined,
      partnerId: req.partner_id,
      partnerName: req.full_name || 'Member',
      partnerAvatar: req.avatar_url,
    });
  }, [navigation]);

  // long-press on a conversation: a dropdown next to the finger
  const chatMenu = useDropdownMenu();
  const [chatMenuItems, setChatMenuItems] = useState<DropdownItem[]>([]);
  const showChatMenu = useCallback((item: ConversationItem, e?: GestureResponderEvent) => {
    const pid = item.partner?.id;
    if (!pid) return;
    const p = convoPrefs[pid];
    const report = (r: { ok: boolean; message?: string }) => { if (!r.ok && r.message) Alert.alert('Chat', r.message); };
    setChatMenuItems([
      { label: p?.pinned ? 'Unpin' : 'Pin', icon: 'pin', onPress: async () => report(await togglePin(pid)) },
      { label: p?.muted ? 'Unmute' : 'Mute', icon: 'volume-x', onPress: async () => report(await toggleMute(pid)) },
      {
        label: 'Delete conversation',
        icon: 'trash-2',
        destructive: true,
        onPress: () => {
          const uid = currentUserIdRef.current || getCurrentUserIdSync();
          if (!uid) return;
          confirmAndDeleteConversation(uid, pid, item.partner?.full_name || item.partner?.username || '', () => {
            setConversations((prev) => prev.filter((c) => c.partner?.id !== pid));
            fetchConversations(false, true);
          });
        },
      },
    ]);
    const ne = e?.nativeEvent;
    if (ne && typeof ne.pageX === 'number') chatMenu.openAt(ne.pageX, ne.pageY);
    else chatMenu.openAt(Dimensions.get('window').width / 2, Dimensions.get('window').height / 2);
  }, [convoPrefs, togglePin, toggleMute, fetchConversations, chatMenu.openAt]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        const uid = currentUserIdRef.current || getCurrentUserIdSync();
        if (!uid) return;
        const next: Record<string, number> = {};
        for (const c of conversations) {
          const pid = c.partner?.id;
          if (!pid) continue;
          const at = await getChatClearedAt(uid, pid);
          if (at != null) next[pid] = at;
        }
        if (alive) setClearedMap((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      })();
      return () => { alive = false; };
    }, [conversations])
  );

  const renderItem = useCallback(({ item }: { item: ConversationItem }) => {
    const partnerName = item.partner?.full_name || item.partner?.username || 'Member';
    const initials = (Array.from(partnerName.trim())[0] || 'M').toUpperCase();
    const hasUnread = (item.unreadCount || 0) > 0;
    const clearedAt = item.partner?.id ? clearedMap[item.partner.id] ?? null : null;
    const previewCleared = clearedAt != null && !isAfterChatClear(item.lastMessageTime || item.updated_at, clearedAt);
    const pref = item.partner?.id ? convoPrefs[item.partner.id] : undefined;

    return (
      <TouchableOpacity
        style={[
          styles.convCard,
          { backgroundColor: themeColors.bgCard, borderBottomColor: themeColors.divider },
          hasUnread && [styles.convCardUnread, { backgroundColor: isDark ? 'rgba(255, 75, 51, 0.12)' : '#FFF7F5' }],
        ]}
        onLongPress={(e) => showChatMenu(item, e)}
        delayLongPress={350}
        onPress={() => {
          const userId = currentUserIdRef.current || getCurrentUserIdSync();
          const directRoomId = userId && item.partner?.id
            ? generateDirectRoomId(userId, item.partner.id)
            : undefined;
          navigation.navigate('Conversation', {
            conversationId: directRoomId,
            partnerId: item.partner?.id,
            partnerName,
            partnerAvatar: item.partner?.avatar_url,
          });
        }}
        activeOpacity={0.7}
      >
        <View style={styles.avatarWrapper}>
          {item.partner?.avatar_url ? (
            <CachedImage uri={item.partner.avatar_url} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{initials}</Text>
            </View>
          )}
          {settings.show_online_status !== false && item.partner?.id && isUserOnline(item.partner.id) ? (
            <View style={[styles.onlineDot, { borderColor: themeColors.bgCard }]} />
          ) : null}
        </View>

        <View style={styles.convBody}>
          <View style={styles.convTop}>
            <Text numberOfLines={1} style={[styles.partnerName, { color: themeColors.textPrimary, flexShrink: 1 }, hasUnread && styles.partnerNameBold]}>
              {partnerName}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {pref?.pinned ? <Icon name="pin" size={12} color={themeColors.textMuted} /> : null}
              {pref?.muted ? <Icon name="volume-x" size={12} color={themeColors.textMuted} /> : null}
              <Text style={[styles.timeText, { color: themeColors.textMuted }]}>
                {formatTime(item.lastMessageTime || item.updated_at)}
              </Text>
            </View>
          </View>
          <View style={styles.convBottom}>
            <Text
              style={[styles.lastMsg, { color: themeColors.textSecondary }, hasUnread && [styles.lastMsgBold, { color: themeColors.textPrimary }]]}
              numberOfLines={1}
            >
              {previewCleared ? '' : (item.lastMessage || 'Start a conversation')}
            </Text>
            {hasUnread && (
              <View style={[styles.unreadBadge, pref?.muted && { backgroundColor: themeColors.textMuted, opacity: 0.7 }]}>
                <Text style={styles.unreadCount}>{(item.unreadCount || 0) > 99 ? '99+' : item.unreadCount}</Text>
              </View>
            )}
          </View>
          {item.partner?.craft ? (
            <Text style={[styles.craftText, { color: themeColors.textMuted }]}>{item.partner.craft}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  }, [themeColors, isDark, navigation, settings.show_online_status, isUserOnline, clearedMap, convoPrefs, showChatMenu]);

  return (
    <TabletContainer
      backgroundColor={themeColors.bgScreen}
      maxWidth="content"
      header={
        <Header
          title="Messages"
          showLogo={false}
          onBack={() => navigation.goBack()}
          rightAction={
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="New message" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={() => setShowNewChatModal(true)} style={styles.newChatBtn}>
              <Icon name="edit" size={18} color={ORANGE} />
            </TouchableOpacity>
          }
        />
      }
    >

      <View style={[styles.searchBar, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
        <Icon name="search" size={16} color={themeColors.iconMuted} />
        <TextInput returnKeyType="search" accessibilityLabel="Search conversations"
          style={[styles.searchInput, { color: themeColors.textPrimary }]}
          placeholder="Search conversations..."
          placeholderTextColor={themeColors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="x" size={16} color={themeColors.iconMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <E2EEOfferCard />

      {loading ? (
        <ConversationListSkeleton count={7} />
      ) : (
        <FlashListAny
          data={filtered}
          renderItem={renderItem}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={styles.list}
          estimatedItemSize={76}
          extraData={convoPrefs}
          ListHeaderComponent={
            !searchQuery ? (
              <MessageRequestsEntry
                main={requests}
                hiddenCount={hasV2 ? hiddenRequests.length : 0}
                themeColors={themeColors}
                onPress={() => { refreshRequests(); setShowRequests(true); }}
              />
            ) : null
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ORANGE} colors={[ORANGE]} />
          }
          ListEmptyComponent={
            isOffline ? (
              <OfflineEmptyState />
            ) : (
              <View style={styles.emptyState}>
                <Icon name="message-circle" size={44} color={themeColors.iconMuted} />
                <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>No Conversations Yet</Text>
                <Text style={[styles.emptySub, { color: themeColors.textSecondary }]}>
                  Tap the edit button above to start a chat with any crew member.
                </Text>
                <TouchableOpacity
                  style={styles.startChatBtn}
                  onPress={() => setShowNewChatModal(true)}
                >
                  <Text style={styles.startChatBtnText}>New Message</Text>
                </TouchableOpacity>
              </View>
            )
          }
        />
      )}

      {/* Message requests */}
      <MessageRequestsModal
        visible={showRequests}
        onClose={() => setShowRequests(false)}
        main={requests}
        hidden={hiddenRequests}
        deleted={deletedRequests}
        hasV2={hasV2}
        privateKey={privateKey}
        themeColors={themeColors}
        onOpen={openRequest}
      />

      {/* New Conversation Search Modal */}
      <Modal
        visible={showNewChatModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowNewChatModal(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: themeColors.bgScreen }]}>
          <View style={[styles.modalHeader, { backgroundColor: themeColors.bgCard, borderBottomColor: themeColors.border }]}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={() => setShowNewChatModal(false)}
              style={styles.modalCloseBtn}
            >
              <Icon name="arrow-left" size={20} color={themeColors.textPrimary} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>New Message</Text>
            <View style={{ width: 36 }} />
          </View>

          <View style={[styles.modalSearchRow, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
            <Icon name="search" size={16} color={themeColors.iconMuted} />
            <TextInput returnKeyType="search" accessibilityLabel="Search people by name"
              style={[styles.modalSearchInput, { color: themeColors.textPrimary }]}
              placeholder="Search people by name..."
              placeholderTextColor={themeColors.textMuted}
              value={crewSearch}
              onChangeText={searchCrewMembers}
              autoFocus
            />
            {crewSearch ? (
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={() => searchCrewMembers('')}>
                <Icon name="x" size={16} color={themeColors.iconMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {searchingCrew ? (
            <View style={styles.center}>
              <ActivityIndicator color={ORANGE} size="small" />
            </View>
          ) : (
            <FlashListAny
              data={crewResults}
              keyExtractor={(item: any) => item.id}
              contentContainerStyle={{ paddingVertical: 10 }}
              estimatedItemSize={64}
              renderItem={({ item }: { item: any }) => (
                <TouchableOpacity
                  style={[styles.crewCard, { backgroundColor: themeColors.bgCard, borderBottomColor: themeColors.divider }]}
                  onPress={() => {
                    setShowNewChatModal(false);
                    const directRoomId = currentUserIdRef.current && item.id
                      ? generateDirectRoomId(currentUserIdRef.current, item.id)
                      : undefined;
                    navigation.navigate('Conversation', {
                      conversationId: directRoomId,
                      partnerId: item.id,
                      partnerName: item.full_name,
                      partnerAvatar: item.avatar_url,
                      partnerCraft: item.craft,
                    });
                  }}
                >
                  {item.avatar_url ? (
                    <CachedImage uri={item.avatar_url} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarInitial}>
                        {(item.full_name || 'C').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.crewName, { color: themeColors.textPrimary }]}>{item.full_name}</Text>
                    <Text style={[styles.crewCraft, { color: themeColors.textSecondary }]}>{item.craft || 'Film Professional'}</Text>
                  </View>
                  <Icon name="chevron-right" size={18} color={themeColors.iconMuted} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                crewSearch ? (
                  <View style={styles.emptyState}>
                    <Text style={[styles.emptySub, { color: themeColors.textSecondary }]}>No creators found matching "{crewSearch}"</Text>
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={[styles.emptySub, { color: themeColors.textSecondary }]}>Type a name to search and message</Text>
                  </View>
                )
              }
            />
          )}
        </View>
      </Modal>
      {chatMenu.render(chatMenuItems)}
    </TabletContainer>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  newChatBtn: {
    width: 36,
    height: 44,
    borderRadius: 18,
    backgroundColor: '#FFF1F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 10,
    marginHorizontal: 14, marginTop: 10, marginBottom: 6,
    paddingHorizontal: 12, height: 44,
    borderWidth: 1, borderColor: '#E5E7EB', gap: 8,
  },
  searchInput: { flex: 1, fontSize: 13, color: INK },
  list: { paddingBottom: 100 },
  convCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6', gap: 12,
  },
  convCardUnread: { backgroundColor: '#FFF7F5' },
  avatarWrapper: { position: 'relative' },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatar: { width: 48, height: 48, borderRadius: 24, overflow: 'hidden', backgroundColor: '#F3F4F6' },
  avatarFallback: {
    width: 48, height: 48, borderRadius: 24, overflow: 'hidden',
    backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  convBody: { flex: 1 },
  convTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  partnerName: { color: INK, fontSize: 14, fontWeight: '600' },
  partnerNameBold: { fontWeight: '700' },
  timeText: { color: '#9CA3AF', fontSize: 12 },
  convBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lastMsg: { color: '#9CA3AF', fontSize: 12, flex: 1 },
  lastMsgBold: { color: '#1F2937', fontWeight: '600' },
  unreadBadge: {
    backgroundColor: ORANGE, borderRadius: 10,
    minWidth: 18, height: 18, paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center',
  },
  unreadCount: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  craftText: { color: ORANGE, fontSize: 12, fontWeight: '700', marginTop: 2, textTransform: 'uppercase' },
  emptyState: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { color: INK, fontSize: 16, fontWeight: '700', marginTop: 14, marginBottom: 6 },
  emptySub: { color: '#64748B', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  startChatBtn: {
    marginTop: 18,
    backgroundColor: ORANGE,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  startChatBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  // Modal styles
  modalContainer: { flex: 1, backgroundColor: '#F8F9FA' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalCloseBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 16, fontWeight: '700', color: INK },
  modalSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    margin: 14,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  modalSearchInput: { flex: 1, fontSize: 14, color: INK },
  crewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 12,
  },
  crewName: { fontSize: 14, fontWeight: '700', color: INK },
  crewCraft: { fontSize: 12, color: '#64748B', marginTop: 2, textTransform: 'uppercase' },
});

export default MessagesListScreen;
