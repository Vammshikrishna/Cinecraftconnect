import { CachedImage } from './CachedImage';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Pressable,
  TextInput,
  Share,
  Clipboard,
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Icon } from './Icon';
import { useSheetMetrics } from './useSheetMetrics';
import { showToast } from '../../contexts/ToastContext';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useGroupEncryption } from '../../hooks/useGroupEncryption';
import { useAccountType } from '../../hooks/useAccountType';
import { friendlyError, loadContactSignals, contactScore, directChannelId } from '@cinecraft/core';

interface ShareSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  shareUrl?: string;
  url?: string;
  itemType?: 'project' | 'post' | 'job' | 'profile' | 'marketplace' | 'pitch' | 'room' | 'announcement' | 'vendor' | 'company' | 'content';
  itemData?: any;
  /** When given, a "To feed" action is shown: it should open Create Post with the item attached. */
  onShareToFeed?: () => void;
}

type TabId = 'Creators' | 'Rooms' | 'Spaces';
type TargetKind = 'user' | 'room' | 'space';

/** One person, room or project space that the item can be sent to. */
interface ShareTarget {
  id: string;
  key: string;
  kind: TargetKind;
  name: string;
  /** craft / room type; only used for search and accessibility, the grid shows names like web */
  sub: string;
  username?: string;
  avatar: string | null;
  isPrivate?: boolean;
  disabledReason?: string | null;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'Creators', label: 'People' },
  { id: 'Rooms', label: 'Discussions' },
  { id: 'Spaces', label: 'Projects' },
];
const NUM_COLUMNS = 3;

/** Mounts the same group-encryption hook the chat screens use, for one room or project space, and hands its encrypt function out. */
const GroupEncryptor: React.FC<{ type: 'project_space' | 'room'; id: string; onApi: (api: { key: string; isReady: boolean; encrypt: (t: string) => Promise<string> }) => void }> = ({ type, id, onApi }) => {
  const { encryptGroupMessage, isReady } = useGroupEncryption(type, id, true);
  useEffect(() => { onApi({ key: `${type}_${id}`, isReady, encrypt: encryptGroupMessage }); }, [type, id, isReady, encryptGroupMessage]);
  return null;
};

export const UniversalShareSheet: React.FC<ShareSheetProps> = ({
  visible,
  onClose,
  title,
  shareUrl,
  url,
  itemType = 'project',
  itemData,
  onShareToFeed,
}) => {
  const { themeColors } = useUserSettings();
  // fan accounts have no project spaces (web and the app block fans from projects), so they only get People and Discussions
  const { isFan } = useAccountType();
  const visibleTabs = isFan ? TABS.filter((t) => t.id !== 'Spaces') : TABS;
  const { maxHeight, bottomPad } = useSheetMetrics();
  const windowHeight = useWindowDimensions().height;
  const sheetHeight = Math.min(maxHeight, Math.round(windowHeight * 0.8));
  const actualUrl = shareUrl || url || 'https://cinecraftconnect.com';
  const [search, setSearch] = useState('');
  const [sentSet, setSentSet] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Map<string, ShareTarget>>(new Map());
  const [sending, setSending] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('Creators');
  const [loadError, setLoadError] = useState<string | null>(null);
  // a problem loading rooms must not show on the Projects tab (and the other way round)
  const [roomsLoadError, setRoomsLoadError] = useState<string | null>(null);
  const [spacesLoadError, setSpacesLoadError] = useState<string | null>(null);
  const [probe, setProbe] = useState<{ type: 'project_space' | 'room'; id: string } | null>(null);
  const probeApi = useRef<{ key: string; isReady: boolean; encrypt: (t: string) => Promise<string> } | null>(null);
  const encryptQueue = useRef<Promise<unknown>>(Promise.resolve());

  const [creators, setCreators] = useState<ShareTarget[]>([]);
  const [spaces, setSpaces] = useState<ShareTarget[]>([]);
  const [rooms, setRooms] = useState<ShareTarget[]>([]);
  const [loading, setLoading] = useState(false);

  // every time the sheet opens it starts clean
  useEffect(() => {
    if (visible) {
      setSelected(new Map());
      setSentSet(new Set());
      setSearch('');
      setLinkCopied(false);
      setActiveTab('Creators');
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const loadTargets = async () => {
      setLoading(true);
      setLoadError(null);
      setRoomsLoadError(null);
      setSpacesLoadError(null);
      try {
        const supabase = getSupabaseClient() as any;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const [convosRes, networkRes, memberSpacesRes, ownedProjectsRes, memberRoomsRes, ownedRoomsRes] = await Promise.all([
          supabase.rpc('get_user_conversations_with_profiles', { p_user_id: user.id }),
          supabase.rpc('network_overview'),
          supabase.from('project_space_members').select('project_space_id').eq('user_id', user.id),
          supabase.from('projects').select('id').eq('creator_id', user.id),
          supabase.from('room_members').select('room_id, role').eq('user_id', user.id),
          supabase.from('discussion_rooms').select('id').eq('creator_id', user.id),
        ]);

        // 1. People, ranked like a social app: how often and how recently I message them, whose posts I like or
        //    comment on, whose profile I visit, who I follow, and my connections
        const signals = await loadContactSignals(supabase, user.id);
        ((networkRes.data as any[]) || []).forEach((r) => {
          if (r.status === 'accepted' && r.other_id) {
            const sig = signals.get(r.other_id) || { id: r.other_id, messages: 0, lastMessageAt: null, unreadFromThem: 0, likes: 0, comments: 0, views: 0, iFollow: false, followsMe: false, isConnection: false };
            sig.isConnection = true;
            signals.set(r.other_id, sig);
          }
        });
        const known = new Map<string, any>();
        ((convosRes.data as any[]) || []).forEach((c) => {
          if (c.other_user_id) known.set(c.other_user_id, { name: c.other_user_full_name, avatar: c.other_user_avatar_url });
        });
        ((networkRes.data as any[]) || []).forEach((r) => {
          if (r.other_id) known.set(r.other_id, { name: r.full_name || r.username, avatar: r.avatar_url, craft: r.craft });
        });
        const top = [...signals.values()]
          .map((sig) => ({ sig, score: contactScore(sig) }))
          .filter((x) => x.score > 0 && x.sig.id !== user.id)
          .sort((x, y) => y.score - x.score)
          .slice(0, 40);
        const missing = top.map((x) => x.sig.id).filter((id) => !known.has(id));
        if (missing.length > 0) {
          const { data: extra } = await supabase.from('profiles').select('id, full_name, username, avatar_url, craft').in('id', missing);
          ((extra as any[]) || []).forEach((p) => known.set(p.id, { name: p.full_name || p.username, avatar: p.avatar_url, craft: p.craft }));
        }
        setCreators(
          top
            .filter((x) => known.has(x.sig.id))
            .map((x) => {
              const k = known.get(x.sig.id);
              return {
                id: x.sig.id,
                key: `user-${x.sig.id}`,
                kind: 'user' as const,
                name: k.name || 'Creator',
                sub: k.craft || (x.sig.messages > 0 ? 'Recent chat' : x.sig.isConnection ? 'Connection' : x.sig.iFollow ? 'Following' : 'Creator'),
                avatar: k.avatar || null,
              };
            })
        );

        // 2. Project spaces I am in or own, the busiest first
        const spaceIds = new Set<string>(((memberSpacesRes.data as any[]) || []).map((m) => m.project_space_id));
        const ownedIds = ((ownedProjectsRes.data as any[]) || []).map((p) => p.id);
        if (ownedIds.length > 0) {
          const { data: ownedSpaces } = await supabase.from('project_spaces').select('id').in('project_id', ownedIds);
          ((ownedSpaces as any[]) || []).forEach((sp) => spaceIds.add(sp.id));
        }
        const memberRoleByRoom = new Map<string, string>();
        ((memberRoomsRes.data as any[]) || []).forEach((m) => memberRoleByRoom.set(m.room_id, m.role));
        const roomIds = new Set<string>([
          ...(((memberRoomsRes.data as any[]) || []).map((m) => m.room_id)),
          ...(((ownedRoomsRes.data as any[]) || []).map((r) => r.id)),
        ]);

        const [spacesRes, roomsRes, spaceMsgs, roomMsgs] = await Promise.all([
          spaceIds.size ? supabase.from('project_spaces').select('id, name, projects ( id, title, genre, image_url )').in('id', [...spaceIds]) : Promise.resolve({ data: [] }),
          roomIds.size ? supabase.from('discussion_rooms').select('id, title, room_type, creator_id, settings').in('id', [...roomIds]) : Promise.resolve({ data: [] }),
          spaceIds.size ? supabase.from('project_space_messages').select('project_space_id, created_at').in('project_space_id', [...spaceIds]).order('created_at', { ascending: false }).limit(500) : Promise.resolve({ data: [] }),
          roomIds.size ? supabase.from('room_messages').select('room_id, created_at').in('room_id', [...roomIds]).order('created_at', { ascending: false }).limit(500) : Promise.resolve({ data: [] }),
        ]);
        if ((roomsRes as any).error) {
          console.warn('[UniversalShareSheet] rooms query error:', (roomsRes as any).error);
          setRoomsLoadError(friendlyError((roomsRes as any).error, 'Could not load your rooms.'));
        }
        if ((spacesRes as any).error) {
          console.warn('[UniversalShareSheet] project spaces query error:', (spacesRes as any).error);
          setSpacesLoadError(friendlyError((spacesRes as any).error, 'Could not load your projects.'));
        }
        const latest = new Map<string, string>();
        ((spaceMsgs.data as any[]) || []).forEach((m) => { if (!latest.has(m.project_space_id)) latest.set(m.project_space_id, m.created_at); });
        ((roomMsgs.data as any[]) || []).forEach((m) => { if (!latest.has(m.room_id)) latest.set(m.room_id, m.created_at); });
        const busiest = (x: ShareTarget, y: ShareTarget) => (latest.get(y.id) || '').localeCompare(latest.get(x.id) || '') || String(x.name).localeCompare(String(y.name));

        setSpaces(
          ((spacesRes.data as any[]) || [])
            .map((sp): ShareTarget => {
              const project = Array.isArray(sp.projects) ? sp.projects[0] : sp.projects;
              return {
                id: sp.id,
                key: `space-${sp.id}`,
                kind: 'space',
                name: project?.title || sp.name || 'Production Workspace',
                sub: project?.genre ? `${project.genre} Film` : 'Project Space',
                avatar: project?.image_url || null,
              };
            })
            .sort(busiest)
        );
        setRooms(
          ((roomsRes.data as any[]) || [])
            .map((r): ShareTarget => {
              const isAdmin = r.creator_id === user.id || memberRoleByRoom.get(r.id) === 'admin';
              const onlyAdmins = r.settings?.onlyAdminsSend === true || r.settings?.onlyAdminsSend === 'admins';
              const isPrivate = r.room_type === 'private';
              return {
                id: r.id,
                key: `room-${r.id}`,
                kind: 'room',
                name: r.title || 'Discussion room',
                sub: isPrivate ? 'Private room' : 'Discussion Room',
                avatar: null,
                isPrivate,
                disabledReason: onlyAdmins && !isAdmin ? 'Only admins can send messages in this room' : null,
              };
            })
            .sort(busiest)
        );
      } catch (err) {
        console.warn('[UniversalShareSheet] loadTargets error:', err);
        setLoadError(friendlyError(err, 'Could not load your chats. Check your connection and try again.'));
      } finally {
        setLoading(false);
      }
    };
    loadTargets();
  }, [visible]);

  // typing in People also looks through everyone on the app, not just my chats and connections
  const [found, setFound] = useState<ShareTarget[]>([]);
  useEffect(() => {
    const term = search.trim().replace(/[%_,()\\]/g, ' ').trim();
    if (activeTab !== 'Creators' || term.length < 2) { setFound([]); return; }
    const timer = setTimeout(async () => {
      try {
        const supabase = getSupabaseClient() as any;
        const { data: { user } } = await supabase.auth.getUser();
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, craft')
          .or(`full_name.ilike.%${term}%,username.ilike.%${term}%`)
          .neq('id', user?.id || '')
          .limit(20);
        setFound(((data as any[]) || []).map((p): ShareTarget => ({
          id: p.id,
          key: `user-${p.id}`,
          kind: 'user',
          name: p.full_name || p.username || 'Creator',
          sub: p.craft || (p.username ? `@${p.username}` : 'Creator'),
          username: p.username,
          avatar: p.avatar_url || null,
        })));
      } catch { /* the list of my own people still works */ }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, activeTab]);

  // closest name first (exact, starts with, a word starts with, contains); people I already know before strangers
  const matchRank = (text: string, q: string) => {
    const t = (text || '').toLowerCase();
    if (t === q) return 0;
    if (t.startsWith(q)) return 1;
    if (t.split(/[\s._-]+/).some((w) => w.startsWith(q))) return 2;
    if (t.includes(q)) return 3;
    return 99;
  };
  const rankList = (list: ShareTarget[], knownKeys?: Set<string>) => {
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list
      .map((item) => ({ item, rank: Math.min(matchRank(item.name, q), item.username ? matchRank(item.username, q) : 99, matchRank(item.sub || '', q) + 4) }))
      .filter((x) => x.rank < 99)
      .sort((x, y) => x.rank - y.rank || Number(knownKeys?.has(y.item.key) || false) - Number(knownKeys?.has(x.item.key) || false) || String(x.item.name).localeCompare(String(y.item.name)))
      .map((x) => x.item);
  };
  const knownKeys = new Set<string>(creators.map((c) => c.key));
  let shown: ShareTarget[];
  if (activeTab === 'Creators') {
    const merged = [...creators, ...found.filter((p) => !knownKeys.has(p.key))];
    shown = rankList(merged, knownKeys);
  } else if (activeTab === 'Spaces') {
    shown = rankList(spaces);
  } else {
    shown = rankList(rooms);
  }
  const tabError = loadError || (activeTab === 'Rooms' ? roomsLoadError : activeTab === 'Spaces' ? spacesLoadError : null);

  const constructSharePayload = () => {
    const raw = itemData || {};
    const prefixMap: Record<string, string> = {
      project: 'PROJECT_SHARE::',
      post: 'POST_SHARE::',
      job: 'JOB_SHARE::',
      profile: 'PROFILE_SHARE::',
      pitch: 'PITCH_SHARE::',
      marketplace: 'MARKETPLACE_SHARE::',
      announcement: 'ANNOUNCEMENT_SHARE::',
      vendor: 'VENDOR_SHARE::',
      company: 'COMPANY_SHARE::',
      room: 'ROOM_SHARE::',
      content: 'CONTENT_SHARE::',
    };

    const prefix = prefixMap[itemType] || 'PROJECT_SHARE::';
    if (itemType === 'content') {
      // Same shape web sends: type is 'movie' | 'tv', poster_path is the TMDB relative path.
      const contentPayload = {
        type: raw.mediaType === 'tv' ? 'tv' : 'movie',
        id: String(raw.id ?? ''),
        title: title || raw.title || 'Shared title',
        poster_path: raw.poster_path || null,
        rating: typeof raw.rating === 'number' ? raw.rating : undefined,
        overview: raw.overview || undefined,
      };
      return `${prefix}${JSON.stringify(contentPayload)}`;
    }
    if (itemType === 'post') {
      // Web's PostShareCard reads { postId, previewUrl, caption, author } and re-fetches the post by postId.
      const urlId = /\/post\/([^/?#]+)/.exec(actualUrl)?.[1];
      const postPayload = {
        postId: String(raw.postId || raw.id || urlId || ''),
        previewUrl: raw.previewUrl || raw.media_url || undefined,
        caption: raw.caption || raw.content || (title && !/^Film (update|Post)/.test(title) ? title : '') || undefined,
        author: raw.profiles || raw.author
          ? {
              username: (raw.profiles || raw.author).username ?? null,
              full_name: (raw.profiles || raw.author).full_name ?? null,
              avatar_url: (raw.profiles || raw.author).avatar_url ?? null,
              is_verified: !!(raw.profiles || raw.author).is_verified,
            }
          : undefined,
      };
      return `${prefix}${JSON.stringify(postPayload)}`;
    }
    const payload = {
      id: raw.id || raw.projectId,
      title: title || raw.title || 'Shared item',
      subtitle: raw.description || raw.logline || raw.subtitle || raw.craft || raw.content,
      imageUrl: raw.banner_url || raw.cover_image || raw.imageUrl || raw.previewUrl || raw.company_pages?.logo_url || raw.profiles?.avatar_url,
      badge: raw.genre_display || raw.genre || raw.badge || raw.category || (raw.company_pages ? 'Company' : 'Announcement'),
      priceOrSalary: raw.budget || raw.salary || raw.priceOrSalary,
      location: raw.location,
    };

    return `${prefix}${JSON.stringify(payload)}`;
  };

  // Waits for the room's / project space's key to load, then encrypts. One at a time (a single hook instance is mounted).
  const encryptFor = (type: 'project_space' | 'room', id: string, text: string): Promise<string> => {
    const job = encryptQueue.current.catch(() => {}).then(async () => {
      const key = `${type}_${id}`;
      probeApi.current = null;
      setProbe({ type, id });
      const start = Date.now();
      while (Date.now() - start < 8000) {
        const a = probeApi.current as { key: string; isReady: boolean; encrypt: (t: string) => Promise<string> } | null;
        if (a && a.key === key && a.isReady) return a.encrypt(text);
        await new Promise((r) => setTimeout(r, 100));
      }
      const a = probeApi.current as { key: string; isReady: boolean; encrypt: (t: string) => Promise<string> } | null;
      // not ready: encrypt explains why (encryption off, locked, or key not available) instead of sending plain text
      if (a && a.key === key) return a.encrypt(text);
      throw new Error('The secure key for this chat is not available yet. Your message was not sent. Try again in a moment.');
    });
    encryptQueue.current = job;
    return job;
  };

  /** Sends the shared item to one person, room or project space; throws if the database refuses it. */
  const sendOne = async (target: ShareTarget) => {
    const supabase = getSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Please sign in to share content.');

    const plainContent = constructSharePayload();
    let content = plainContent;

    if (target.kind === 'space') {
      // Resolve project_space_id if the id is a project_id
      let resolvedSpaceId = target.id;
      const { data: spaceRow } = await supabase
        .from('project_spaces')
        .select('id')
        .or(`id.eq.${target.id},project_id.eq.${target.id}`)
        .maybeSingle();
      if (spaceRow) resolvedSpaceId = spaceRow.id;

      // project space chats are always end-to-end encrypted: same envelope the chat screen sends
      content = await encryptFor('project_space', resolvedSpaceId, plainContent);
      const { error } = await supabase.from('project_space_messages' as any).insert({
        project_space_id: resolvedSpaceId,
        user_id: user.id,
        content,
      });
      if (error) throw error;
    } else if (target.kind === 'room') {
      if (target.disabledReason) throw new Error(target.disabledReason);
      // private rooms are encrypted exactly like DiscussionRoomDetailScreen sends them; public rooms stay plain text
      if (target.isPrivate) content = await encryptFor('room', target.id, plainContent);
      const { error } = await supabase.from('room_messages' as any).insert({
        room_id: target.id,
        user_id: user.id,
        content,
      });
      if (error) throw error;
    } else {
      const { error } = await supabase.from('direct_messages' as any).insert({
        channel_id: directChannelId(user.id, target.id),
        sender_id: user.id,
        receiver_id: target.id,
        content,
        is_read: false,
      });
      if (error) throw error;
    }
  };

  // the Send button: everyone selected gets it; the ones that worked are marked, the rest stay selected to retry
  const handleSendSelected = async () => {
    if (selected.size === 0 || sending) return;
    setSending(true);
    const items = [...selected.values()];
    const results = await Promise.allSettled(items.map(sendOne));
    const done = items.filter((_, i) => results[i].status === 'fulfilled');
    const firstFailure = results.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;

    if (done.length > 0) {
      setSentSet((prev) => { const n = new Set(prev); done.forEach((t) => n.add(t.key)); return n; });
      setSelected((prev) => { const n = new Map(prev); done.forEach((t) => n.delete(t.key)); return n; });
      showToast({ title: 'Sent', message: done.length === 1 ? `Shared to ${done[0].name}` : `Shared to ${done.length} chats`, type: 'success' });
    }
    if (firstFailure) {
      console.warn('[UniversalShareSheet] send error:', firstFailure.reason);
      showToast({ title: 'Could not share', message: friendlyError(firstFailure.reason, `"${title}" could not be sent. Please try again.`), type: 'error' });
    }
    setSending(false);
  };

  const toggleSelected = useCallback((t: ShareTarget) => {
    if (t.disabledReason) {
      showToast({ title: 'Cannot send here', message: t.disabledReason, type: 'info' });
      return;
    }
    setSelected((prev) => {
      const n = new Map(prev);
      if (n.has(t.key)) n.delete(t.key); else n.set(t.key, t);
      return n;
    });
  }, []);

  const handleCopyLink = () => {
    try {
      Clipboard.setString(actualUrl);
      setLinkCopied(true);
      showToast({ title: 'Link copied', type: 'success' });
    } catch {
      showToast({ title: 'Could not copy the link', type: 'error' });
    }
  };
  useEffect(() => {
    if (!linkCopied) return;
    const t = setTimeout(() => setLinkCopied(false), 2000);
    return () => clearTimeout(t);
  }, [linkCopied]);

  const handleNativeShare = async () => {
    try {
      await Share.share({ message: `${title}\n${actualUrl}` });
    } catch {
      showToast({ title: 'Could not open the share menu', type: 'error' });
    }
  };

  const renderTarget = ({ item }: { item: ShareTarget }) => {
    const isSel = selected.has(item.key);
    const isSent = sentSet.has(item.key);
    const blocked = !!item.disabledReason;
    return (
      <Pressable
        style={({ pressed }) => [styles.cell, (blocked) && { opacity: 0.5 }, pressed && { opacity: 0.7 }]}
        onPress={() => toggleSelected(item)}
        disabled={isSent || sending}
        accessibilityRole="button"
        accessibilityLabel={`${item.name}, ${item.sub}${blocked ? `. ${item.disabledReason}` : ''}`}
        accessibilityState={{ selected: isSel, disabled: isSent || sending }}
        accessibilityHint={isSent ? 'Already sent' : blocked ? undefined : isSel ? 'Tap to deselect' : 'Tap to select'}
      >
        <View style={styles.avatarWrap}>
          <View
            style={[
              styles.avatarRing,
              isSel && { borderColor: themeColors.primary, transform: [{ scale: 0.95 }] },
            ]}
          >
            {item.avatar ? (
              <CachedImage uri={item.avatar} style={[styles.avatar, { backgroundColor: themeColors.chipBg }]} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: themeColors.chipBg }]}>
                {item.kind === 'space' ? (
                  <Icon name="film" size={22} color={themeColors.textMuted} />
                ) : item.kind === 'room' ? (
                  <Icon name={item.isPrivate ? 'lock' : 'message-square'} size={22} color={themeColors.textMuted} />
                ) : (
                  <Text style={[styles.avatarInitial, { color: themeColors.textSecondary }]}>{(item.name[0] || '?').toUpperCase()}</Text>
                )}
              </View>
            )}
          </View>
          {(isSel || isSent) && (
            <View style={[styles.checkBadge, { backgroundColor: themeColors.primary, borderColor: themeColors.bgCard }]}>
              <Icon name="check" size={12} color={themeColors.onPrimary} />
            </View>
          )}
        </View>
        <Text style={[styles.cellName, { color: themeColors.textPrimary }]} numberOfLines={2}>{item.name}</Text>
        {isSent && <Text style={[styles.sentLabel, { color: themeColors.textSecondary }]}>Sent</Text>}
      </Pressable>
    );
  };

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.emptyWrap} accessibilityRole="progressbar" accessibilityLabel="Loading">
          <ActivityIndicator size="small" color={themeColors.primary} />
          <Text style={[styles.emptyHint, { color: themeColors.textSecondary, marginTop: 10 }]}>Loading</Text>
        </View>
      );
    }
    if (tabError) {
      return (
        <View style={styles.emptyWrap}>
          <Text style={[styles.emptyHint, { color: '#EF4444' }]} accessibilityRole="alert">{tabError}</Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyWrap}>
        <Icon name="search" size={32} color={themeColors.textMuted} />
        <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>No matches found</Text>
        <Text style={[styles.emptyHint, { color: themeColors.textSecondary }]}>
          {search.trim()
            ? 'Try a different name.'
            : activeTab === 'Creators'
              ? 'Connect with people to share with them here.'
              : 'Nothing to show here yet.'}
        </Text>
      </View>
    );
  };

  const ActionButton: React.FC<{ icon: string; label: string; onPress: () => void; a11y: string; busy?: boolean }> = ({ icon, label, onPress, a11y, busy }) => (
    <TouchableOpacity
      style={styles.action}
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
    >
      <View style={[styles.actionCircle, { backgroundColor: themeColors.chipBg }]}>
        <Icon name={icon as any} size={20} color={themeColors.textPrimary} />
      </View>
      <Text style={[styles.actionLabel, { color: themeColors.textSecondary }]} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      statusBarTranslucent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel="Close share sheet" accessibilityRole="button">
          <Pressable
            style={[styles.sheet, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border, height: sheetHeight }]}
            onPress={() => {}}
            accessible={false}
          >
            <View style={[styles.handleBar, { backgroundColor: themeColors.divider }]} />

            <View style={styles.headerRow}>
              <Text style={[styles.sheetTitle, { color: themeColors.textPrimary }]} accessibilityRole="header">Share</Text>
              <TouchableOpacity
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel="Close"
                onPress={onClose}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="x" size={20} color={themeColors.iconSecondary} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.topBlock}>
              <View style={[styles.searchBox, { backgroundColor: themeColors.chipBg }]}>
                <Icon name="search" size={16} color={themeColors.iconMuted} />
                <TextInput
                  style={[styles.searchInput, { color: themeColors.textPrimary }]}
                  placeholder="Search"
                  placeholderTextColor={themeColors.textMuted}
                  value={search}
                  onChangeText={setSearch}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  accessibilityLabel="Search people, rooms and projects"
                />
                {search.length > 0 && (
                  <TouchableOpacity onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Icon name="x" size={16} color={themeColors.iconMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* What to share to */}
              <View style={styles.tabRow} accessibilityRole="tablist" accessibilityLabel="Share to">
                {visibleTabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <TouchableOpacity
                      key={tab.id}
                      style={[styles.tabPill, { backgroundColor: isActive ? themeColors.textPrimary : themeColors.chipBg }]}
                      onPress={() => setActiveTab(tab.id)}
                      accessibilityRole="tab"
                      accessibilityLabel={tab.label}
                      accessibilityState={{ selected: isActive }}
                      hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
                    >
                      <Text style={[styles.tabText, { color: isActive ? themeColors.bgCard : themeColors.textSecondary }]}>{tab.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* people, rooms and projects as a grid of round pictures */}
            <FlatList
              key={`grid-${NUM_COLUMNS}`}
              style={styles.flex}
              data={loading ? [] : shown}
              keyExtractor={(t) => t.key}
              renderItem={renderTarget}
              numColumns={NUM_COLUMNS}
              extraData={[selected, sentSet, sending]}
              ListEmptyComponent={renderEmpty}
              contentContainerStyle={styles.gridContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              initialNumToRender={15}
              windowSize={7}
            />

            {/* bottom: Send once someone is picked, otherwise the other ways to share */}
            <View style={[styles.footer, { borderTopColor: themeColors.border, paddingBottom: bottomPad }]}>
              {selected.size > 0 ? (
                <TouchableOpacity
                  style={[styles.sendBtn, { backgroundColor: themeColors.primary, opacity: sending ? 0.7 : 1 }]}
                  onPress={handleSendSelected}
                  disabled={sending}
                  accessibilityRole="button"
                  accessibilityLabel={selected.size === 1 ? 'Send' : `Send to ${selected.size} chats`}
                  accessibilityState={{ disabled: sending, busy: sending }}
                >
                  {sending ? (
                    <View style={styles.sendingRow}>
                      <ActivityIndicator size="small" color={themeColors.onPrimary} />
                      <Text style={[styles.sendBtnText, { color: themeColors.onPrimary }]}>Sending…</Text>
                    </View>
                  ) : (
                    <Text style={[styles.sendBtnText, { color: themeColors.onPrimary }]}>
                      {selected.size === 1 ? 'Send' : `Send to ${selected.size}`}
                    </Text>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={styles.actionsRow}>
                  <ActionButton
                    icon={linkCopied ? 'check' : 'link'}
                    label={linkCopied ? 'Link copied' : 'Copy link'}
                    onPress={handleCopyLink}
                    a11y={linkCopied ? 'Link copied' : 'Copy link'}
                  />
                  <ActionButton icon="share" label="Share via..." onPress={handleNativeShare} a11y="Share via other apps" />
                  {!!onShareToFeed && (
                    <ActionButton icon="plus" label="To feed" onPress={onShareToFeed} a11y="Share to your feed" />
                  )}
                </View>
              )}
            </View>
            {probe && <GroupEncryptor key={`${probe.type}_${probe.id}`} type={probe.type} id={probe.id} onApi={(api) => { probeApi.current = api; }} />}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    overflow: 'hidden',
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
  },
  headerRow: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  closeBtn: {
    position: 'absolute',
    right: 8,
    top: 0,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBlock: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    padding: 0,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tabPill: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
  },
  gridContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    flexGrow: 1,
  },
  cell: {
    width: `${100 / NUM_COLUMNS}%`,
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 6,
    marginBottom: 6,
    minHeight: 44,
  },
  avatarWrap: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '600',
  },
  checkBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellName: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 15,
    textAlign: 'center',
    width: '100%',
  },
  sentLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
  },
  emptyHint: {
    fontSize: 13,
    marginTop: 4,
    textAlign: 'center',
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  sendBtn: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sendBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 24,
  },
  action: {
    alignItems: 'center',
    gap: 6,
    minWidth: 64,
  },
  actionCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default UniversalShareSheet;
