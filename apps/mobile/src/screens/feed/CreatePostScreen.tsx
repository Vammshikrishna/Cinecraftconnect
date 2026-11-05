import { CachedImage } from '../../components/common/CachedImage';
import { orTerm } from '../../utils/postgrest';
import { MentionInput } from '../../components/common/MentionInput';
import { type MentionUser } from '../../utils/mentions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinkPreviewCard } from '../../components/feed/PostExtras';
import {
  extractHashtags, buildMediaItems, mediaColumns, mediaSizeFields, checkPost, describePostError, normalizeCategory, isVideoMedia,
  geocodeSearch, geocodeReverse,
  schedulePresets, checkSchedule, formatSchedule, inviteCollaborators, COLLAB_MAX,
  firstUrl, fetchLinkPreview, searchGifs, GIF_CREDIT, type GifItem, type LinkPreview,
  emptyPollDraft, checkPollDraft, pollDraftInUse, attachPoll, POLL_DURATIONS, POLL_MAX_OPTIONS, POLL_OPTION_MAX, POLL_QUESTION_MAX, type PollDraft,
  POST_MEDIA_MAX, POST_VIDEO_MAX_SECONDS, POST_ALT_TEXT_MAX, POST_CAPTION_MAX, POST_CATEGORIES, POST_AUDIENCES, normalizeAudience,
} from '@cinecraft/core';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  DeviceEventEmitter,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  Switch,
  useWindowDimensions,
  InteractionManager,
} from 'react-native';
import { pickAttachments } from '../../services/attachmentPicker';
import DocumentPicker from 'react-native-document-picker';
// @ts-ignore
import { Video } from 'react-native-video-compressor';
import { uploadMediaPipeline } from '../../services/mediaPipeline';
import { PhotoEditor } from '../../components/create/PhotoEditor';
import { renderPhoto, photoInfo, photoEditingAvailable, releasePhoto, videoEditingAvailable, videoInfo, trimVideo, type VideoEdit } from '../../services/photoRender';
import { VideoTrimmer } from '../../components/create/VideoTrimmer';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { JobShareCard } from '../../components/chat/JobShareCard';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useAccountType } from '../../hooks/useAccountType';
import { friendlyError, defaultRecipe, type PhotoRecipe } from '@cinecraft/core';

const ORANGE = '#FF4B33';
const BLUE_BTN = '#1D72F2';

type Step = 'select' | 'preview' | 'details';

const CRAFT_OPTIONS: string[] = [...POST_CATEGORIES];

const POPULAR_LOCATIONS = [
  'Film City, Mumbai',
  'Ramoji Film City, Hyderabad',
  'Bengaluru, India',
  'Los Angeles, CA',
  'London, UK',
  'New York, NY',
];

export interface TaggedUser {
  id: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
}

export interface TextOverlayItem {
  id: string;
  text: string;
  color: string;
  bgColor: string;
  fontSize: number;
  fontStyle?: 'modern' | 'neon' | 'typewriter' | 'strong' | 'serif';
  align?: 'left' | 'center' | 'right';
  x: number; // Left percentage (0 - 100)
  y: number; // Top percentage (0 - 100)
}

// -------------------------------------------------------------
// MAIN CREATE POST SCREEN COMPONENT
// -------------------------------------------------------------
export const CreatePostScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  const { themeColors } = useUserSettings();
  // sizes follow the live window (rotation, split screen), never a width measured once at start-up
  const { width: winW, height: winH } = useWindowDimensions();
  const isTablet = Math.min(winW, winH) >= 600;
  const editPostId = route?.params?.editPostId;
  // a job shared to the feed arrives here with its card details: the post opens at the details step with the card attached
  const sharedJob = route?.params?.sharedJob;
  // Fan accounts follow and react but do not publish posts (the database refuses it too): leave the composer.
  const { isFan, loading: accountTypeLoading } = useAccountType();
  useEffect(() => {
    if (isFan && !accountTypeLoading) {
      Alert.alert('Not available', 'Fan accounts cannot create posts. Switch to a creator or studio account to post.');
      navigation.goBack();
    }
  }, [isFan, accountTypeLoading]); // eslint-disable-line react-hooks/exhaustive-deps
  const [step, setStep] = useState<Step>(editPostId || sharedJob ? 'details' : 'select');
  const [jobSharePart, setJobSharePart] = useState<string | null>(() => (sharedJob && !editPostId ? JSON.stringify(sharedJob) : null));
  const jobShareData = React.useMemo(() => { try { return jobSharePart ? JSON.parse(jobSharePart) : null; } catch { return null; } }, [jobSharePart]);

  // Media state
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  // what each uploaded file is (taken from the file itself, never guessed from the web address)
  const kindsRef = useRef<Record<string, 'image' | 'video'>>({});
  const isVideoUrl = (u?: string) => !!u && (kindsRef.current[u] ? kindsRef.current[u] === 'video' : isVideoMedia(u));
  const [altTexts, setAltTexts] = useState<Record<string, string>>({});
  const sharedRef = useRef(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadingProgressText, setUploadingProgressText] = useState('');

  // New photos stay on this phone while they are edited and are uploaded once, when the post is shared.
  const [recipes, setRecipes] = useState<Record<string, PhotoRecipe>>({});
  const [videoEdits, setVideoEdits] = useState<Record<string, VideoEdit>>({}); // the part of each video to keep, and its sound
  // a photo on this phone (the key is its file address): passthrough means it is posted as it is (a GIF)
  const localRef = useRef<Record<string, { passthrough: boolean; name?: string; type?: string }>>({});
  const sizeRef = useRef<Record<string, { width: number; height: number }>>({}); // shown size of each new picture/video (saved on the post so cards are the right shape)
  const finalsRef = useRef<Record<string, { uri: string; sig: string; mime: string }>>({}); // the finished picture of each edited photo
  const rawItemsRef = useRef<Record<string, any>>({}); // a post being edited keeps what it was saved with
  const [unreadable, setUnreadable] = useState<Record<string, boolean>>({});

  // Details state
  const [content, setContent] = useState('');
  const [selectedCraft, setSelectedCraft] = useState('General');
  const [audience, setAudience] = useState<string>('public');
  const [poll, setPoll] = useState<PollDraft | null>(null); // null = no poll on this post
  const [scheduleOn, setScheduleOn] = useState(false);
  const [scheduleAt, setScheduleAt] = useState<Date | null>(null);
  const [collabs, setCollabs] = useState<TaggedUser[]>([]);
  const [collabQuery, setCollabQuery] = useState('');
  const [collabResults, setCollabResults] = useState<TaggedUser[]>([]);
  const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null);
  const [dismissedLink, setDismissedLink] = useState<string | null>(null);
  const [gifOpen, setGifOpen] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [gifState, setGifState] = useState<'idle' | 'loading' | 'error' | 'off'>('idle');
  const [location, setLocation] = useState('');
  const [showLocations, setShowLocations] = useState(false);

  // Realtime GPS & OpenStreetMap search states
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [realtimeLocations, setRealtimeLocations] = useState<string[]>([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);

  const handleGetCurrentLocation = () => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      setIsFetchingLocation(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const data = await geocodeReverse(getSupabaseClient(), pos.coords.latitude, pos.coords.longitude);
            if (data && data.address) {
              const city =
                data.address.city ||
                data.address.town ||
                data.address.village ||
                data.address.suburb ||
                data.address.state ||
                '';
              const country = data.address.country || '';
              const place = [city, country].filter(Boolean).join(', ') || data.display_name;
              if (place) {
                setLocation(place);
                setShowLocations(false);
                Alert.alert('Location Detected 📍', place);
              }
            }
          } catch (err) {
            Alert.alert('Location Error', 'Could not fetch location details.');
          } finally {
            setIsFetchingLocation(false);
          }
        },
        () => {
          setIsFetchingLocation(false);
          Alert.alert('Location Denied', 'GPS access denied. You can type location manually.');
        }
      );
    } else {
      Alert.alert('Location Error', 'Geolocation is not available.');
    }
  };

  useEffect(() => {
    if (!location.trim() || location.length < 2) {
      setRealtimeLocations([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingLocation(true);
      try {
        const data = await geocodeSearch(getSupabaseClient(), location);
        if (Array.isArray(data)) {
          const parsed = data
            .map((item: any) => {
              const addr = item.address || {};
              const name = item.name || addr.city || addr.town || addr.village || item.display_name.split(',')[0];
              const country = addr.country || '';
              return [name, country].filter(Boolean).join(', ');
            })
            .filter(Boolean);
          setRealtimeLocations(Array.from(new Set(parsed)));
        }
      } catch (err) {
        console.error('Error searching location:', err);
      } finally {
        setIsSearchingLocation(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [location]);

  // Author & Company Pages state
  const [userProfile, setUserProfile] = useState<any>(null);
  const [myPages, setMyPages] = useState<any[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | 'user'>('user');
  const [showPageSelector, setShowPageSelector] = useState(false);

  // Tagging People state
  const [taggedUsers, setTaggedUsers] = useState<TaggedUser[]>([]);
  const [showTagModal, setShowTagModal] = useState(false);
  const [tagQuery, setTagQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TaggedUser[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  // Advanced Options
  const [hideLikes, setHideLikes] = useState(false);
  const [disableComments, setDisableComments] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [loading, setLoading] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [pickedMentions, setPickedMentions] = useState<Record<string, MentionUser>>({});

  // people to credit: search by name or @username, never yourself or people you blocked
  useEffect(() => {
    if (!collabQuery.trim()) { setCollabResults([]); return; }
    const t = setTimeout(async () => {
      const supabase = getSupabaseClient();
      const { data } = await supabase.from('profiles').select('id, username, full_name, avatar_url').or(`username.ilike.%${orTerm(collabQuery)}%,full_name.ilike.%${orTerm(collabQuery)}%`).limit(8);
      const { data: sess } = await supabase.auth.getSession();
      const me = sess?.session?.user?.id;
      let blocked = new Set<string>();
      if (me) {
        const { data: b } = await (supabase as any).from('blocked_users').select('blocked_user_id').eq('user_id', me);
        blocked = new Set((b || []).map((x: any) => x.blocked_user_id));
      }
      setCollabResults(((data || []) as TaggedUser[]).filter((u) => u.id !== me && !blocked.has(u.id) && !collabs.some((c) => c.id === u.id)));
    }, 250);
    return () => clearTimeout(t);
  }, [collabQuery, collabs]);

  // a card for the first link in the caption (fetched by the server; you can remove it)
  useEffect(() => {
    const url = firstUrl(content);
    if (!url) { setLinkPreview(null); return; }
    if (linkPreview?.url === url || dismissedLink === url) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const preview = await fetchLinkPreview(getSupabaseClient(), url);
      if (!cancelled) setLinkPreview(preview);
    }, 700);
    return () => { cancelled = true; clearTimeout(t); };
  }, [content]); // eslint-disable-line react-hooks/exhaustive-deps

  // GIF search (empty box = trending)
  useEffect(() => {
    if (!gifOpen) return;
    let cancelled = false;
    setGifState('loading');
    const t = setTimeout(async () => {
      const res = await searchGifs(getSupabaseClient(), gifQuery);
      if (cancelled) return;
      if (res.ok) { setGifs(res.items); setGifState('idle'); }
      else { setGifs([]); setGifState((res as any).reason === 'not_configured' ? 'off' : 'error'); }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [gifOpen, gifQuery]);

  const addGif = (g: GifItem) => {
    if (mediaUrls.length >= POST_MEDIA_MAX) {
      Alert.alert('Limit reached', `You can add up to ${POST_MEDIA_MAX} photos, videos or GIFs.`);
      return;
    }
    kindsRef.current[g.url] = 'image';
    setAltTexts((prev) => ({ ...prev, [g.url]: g.title }));
    setMediaUrls((prev) => [...prev, g.url]);
    setGifOpen(false);
    if (step === 'select') setStep('preview');
  };

  // ── draft: kept on this device until the post is shared or discarded ──
  const draftKey = `create_post_draft_${userProfile?.id || 'me'}`;
  const draftReady = useRef(false);
  const saveDraftNow = () => {
    if (editPostId || sharedRef.current) return;
    if (!content.trim() && mediaUrls.length === 0) return;
    AsyncStorage.setItem(draftKey, JSON.stringify({
      content, mediaUrls, kinds: kindsRef.current, recipes, videoEdits, locals: localRef.current, location, taggedUsers, category: selectedCraft, audience, disableComments, hideLikes, altTexts, savedAt: Date.now(),
    })).catch(() => { });
  };
  const clearDraft = () => { AsyncStorage.removeItem(draftKey).catch(() => { }); };
  const discardDraftFiles = (urls?: string[]) => {
    const paths = (urls || []).map((u) => storagePathOf(u)).filter(Boolean) as string[];
    if (paths.length > 0) getSupabaseClient().storage.from('portfolios').remove(paths).catch(() => { });
  };
  const restoreDraft = async (d: any) => {
    setContent(d.content || '');
    setLocation(d.location || '');
    setTaggedUsers(Array.isArray(d.taggedUsers) ? d.taggedUsers : []);
    setSelectedCraft(d.category || 'General');
    setAudience(normalizeAudience(d.audience));
    setDisableComments(!!d.disableComments);
    setHideLikes(!!d.hideLikes);
    setAltTexts(d.altTexts || {});
    kindsRef.current = { ...(d.kinds || {}) };
    // photos kept on this phone come back with their edits; one that is gone (storage was cleared) is dropped
    const locals = d.locals || {};
    const wanted: string[] = Array.isArray(d.mediaUrls) ? d.mediaUrls : [];
    const urls: string[] = [];
    const nextRecipes: Record<string, PhotoRecipe> = {};
    const nextVideoEdits: Record<string, VideoEdit> = {};
    for (const u of wanted) {
      if (locals[u]) {
        try { if (d.kinds?.[u] === 'video') await videoInfo(u); else await photoInfo(u); } catch { continue; }
        localRef.current[u] = locals[u];
        if (d.recipes?.[u]) nextRecipes[u] = d.recipes[u];
        if (d.videoEdits?.[u]) nextVideoEdits[u] = d.videoEdits[u];
      }
      urls.push(u);
    }
    setRecipes(nextRecipes);
    setVideoEdits(nextVideoEdits);
    setMediaUrls(urls);
    setStep(urls.length > 0 ? 'preview' : 'details');
  };
  // offer a saved draft once
  useEffect(() => {
    if (editPostId || !userProfile?.id) { return; }
    let alive = true;
    AsyncStorage.getItem(`create_post_draft_${userProfile.id}`).then((rawDraft) => {
      if (!alive) return;
      if (!rawDraft) { draftReady.current = true; return; }
      try {
        const d = JSON.parse(rawDraft);
        if (!d || (!d.content && !(Array.isArray(d.mediaUrls) && d.mediaUrls.length))) { draftReady.current = true; return; }
        Alert.alert('Continue your draft?', 'You have an unfinished post on this device.', [
          { text: 'Discard', style: 'destructive', onPress: () => { discardDraftFiles(d.mediaUrls); clearDraft(); draftReady.current = true; } },
          { text: 'Continue', onPress: () => { restoreDraft(d); draftReady.current = true; } },
        ], { cancelable: false });
      } catch { draftReady.current = true; }
    }).catch(() => { draftReady.current = true; });
    return () => { alive = false; };
  }, [userProfile?.id, editPostId]); // eslint-disable-line react-hooks/exhaustive-deps
  // save as you go
  useEffect(() => {
    if (!draftReady.current) return;
    const t = setTimeout(saveDraftNow, 800);
    return () => clearTimeout(t);
  }, [content, mediaUrls, location, taggedUsers, selectedCraft, audience, disableComments, hideLikes, altTexts, recipes, videoEdits]); // eslint-disable-line react-hooks/exhaustive-deps
  // never lose work by pressing Back
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (editPostId || sharedRef.current || loading) return;
      if (!content.trim() && mediaUrls.length === 0) return;
      e.preventDefault();
      Alert.alert('Leave this post?', 'You can keep it as a draft on this device, or discard it.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => { discardDraftFiles(mediaUrls); clearDraft(); sharedRef.current = true; navigation.dispatch(e.data.action); } },
        { text: 'Save draft', onPress: () => { saveDraftNow(); sharedRef.current = true; navigation.dispatch(e.data.action); } },
      ]);
    });
    return unsubscribe;
  }, [navigation, content, mediaUrls, location, taggedUsers, selectedCraft, disableComments, hideLikes, altTexts, editPostId, loading, userProfile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let active = true;
    const task = InteractionManager.runAfterInteractions(async () => {
      try {
        const supabase = getSupabaseClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || !active) return;

        // Fetch Profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url, craft')
          .eq('id', user.id)
          .maybeSingle();

        if (profile && active) setUserProfile(profile);

        // Fetch My Company Pages
        const { data: pages } = await supabase
          .from('company_pages')
          .select('id, name, logo_url')
          .eq('owner_id', user.id);

        if (pages && active) setMyPages(pages);

        // If editing post
        if (editPostId && active) {
          setLoadingEdit(true);
          const { data: post, error } = await supabase.from('posts').select('*').eq('id', editPostId).single();

          if (!error && post && active) {
            const p: any = post;
            // a post that carries a shared job keeps its card: only the words are edited here
            const rawContent = String(p.content || '');
            if (rawContent.includes('JOB_SHARE::')) {
              setContent(rawContent.split('JOB_SHARE::')[0].trim());
              setJobSharePart(rawContent.split('JOB_SHARE::').pop()!.trim());
            } else {
              setContent(rawContent);
            }
            const first: any = Array.isArray(p.media_items) && p.media_items[0] && typeof p.media_items[0] === 'object' ? p.media_items[0] : {};
            setLocation(first.location || p.location || '');
            setTaggedUsers(Array.isArray(first.tagged_users) ? first.tagged_users : (Array.isArray(p.tagged_users) ? p.tagged_users : []));
            setDisableComments(!!first.comments_disabled);
            setHideLikes(!!first.hide_likes);
            if (p.category) setSelectedCraft(p.category);
            setAudience(normalizeAudience(p.audience));
            if (p.link_preview) { setLinkPreview(p.link_preview); setDismissedLink(p.link_preview.url); }
            const altMap: Record<string, string> = {};
            (Array.isArray(p.media_items) ? p.media_items : []).forEach((m: any) => {
              if (m && typeof m === 'object' && m.url) {
                if (m.type === 'video' || m.type === 'image') kindsRef.current[m.url] = m.type;
                if (m.alt) altMap[m.url] = String(m.alt);
              }
            });
            setAltTexts(altMap);
            rawItemsRef.current = {};
            (Array.isArray(p.media_items) ? p.media_items : []).forEach((m: any) => { if (m && typeof m === 'object' && m.url) rawItemsRef.current[m.url] = m; });
            if (p.page_id) setSelectedPageId(p.page_id);

            let urls: string[] = [];
            if (Array.isArray(p.media_items) && p.media_items.length > 0) {
              urls = p.media_items.map((m: any) => (typeof m === 'string' ? m : m.url || m.media_url));
            } else if (p.media_url) {
              urls = [p.media_url];
            }
            const cleanUrls = urls.filter(Boolean);
            setMediaUrls(cleanUrls);
            if (cleanUrls.length > 0) setStep('details');
          }
          if (active) setLoadingEdit(false);
        }
      } catch (e) {
        console.warn('Init error:', e);
      }
    });

    return () => {
      active = false;
      task.cancel();
    };
  }, [editPostId]);

  // Handle local image / video pick & Supabase Storage upload
  const handlePickLocalFiles = async () => {
    try {
      const results = await pickAttachments({ allowFiles: false });

      if (!results || results.length === 0) return;

      if (mediaUrls.length + results.length > POST_MEDIA_MAX) {
        Alert.alert('Too many files', `You can add up to ${POST_MEDIA_MAX} photos or videos to a post.`);
        return;
      }

      setIsUploadingMedia(true);
      const uploaded: { url: string; kind: 'image' | 'video' }[] = [];
      const failed: string[] = [];

      // one file at a time; a problem with one file never throws away the others
      for (let i = 0; i < results.length; i++) {
        const file = results[i];
        setUploadingProgressText(`Processing file ${i + 1} of ${results.length}...`);

        try {
          const isImg = (file.type || '').startsWith('image/') || /\.(jpe?g|png|webp|heic|gif)$/i.test(file.name || '');
          const isGif = file.type === 'image/gif' || /\.gif$/i.test(file.name || '');
          const isVid = (file.type || '').startsWith('video/') || /\.(mp4|mov|mkv|webm|avi|3gp)$/i.test(file.name || '');
          if (isVid && videoEditingAvailable()) {
            try {
              // a video stays here too: it is cut when you tap Next and uploaded once when the post is shared
              const vinfo = await videoInfo(file.uri);
              if (vinfo.width > 0 && vinfo.height > 0) sizeRef.current[file.uri] = { width: vinfo.width, height: vinfo.height };
              localRef.current[file.uri] = { passthrough: false, name: file.name || 'video.mp4', type: file.type || 'video/mp4' };
              uploaded.push({ url: file.uri, kind: 'video' });
              continue;
            } catch (vidErr) {
              console.warn('[CreatePostScreen] Video cannot be edited, adding it as it is:', vidErr);
            }
          }
          if (isImg && isGif) {
            // a GIF is posted as it is (so it keeps moving), uploaded when the post is shared
            localRef.current[file.uri] = { passthrough: true, name: file.name || 'animation.gif', type: 'image/gif' };
            if (file.width && file.height) sizeRef.current[file.uri] = { width: file.width, height: file.height };
            uploaded.push({ url: file.uri, kind: 'image' });
            continue;
          }
          if (isImg && photoEditingAvailable()) {
            try {
              // a working copy (at most 1600 px, camera rotation applied): edited here, uploaded once when the post is shared
              setUploadingProgressText(`Preparing photo ${i + 1} of ${results.length}...`);
              const work = await renderPhoto(file.uri, defaultRecipe(), { maxEdge: 1600, withText: false, format: 'jpeg', quality: 92 });
              localRef.current[work.uri] = { passthrough: false };
              if (work.width > 0 && work.height > 0) sizeRef.current[work.uri] = { width: work.width, height: work.height };
              uploaded.push({ url: work.uri, kind: 'image' });
              continue;
            } catch (prepErr) {
              console.warn('[CreatePostScreen] Photo cannot be edited, adding it as it is:', prepErr);
            }
          }
          const out = await uploadMediaPipeline(
            { uri: file.uri, name: file.name, type: file.type, size: file.size },
            {
              bucket: 'portfolios',
              folder: 'posts',
              onProgressText: (statusText) => {
                setUploadingProgressText(`${statusText} (${i + 1}/${results.length})`);
              },
            }
          );
          if (out?.url && (out.type === 'image' || out.type === 'video')) {
            uploaded.push({ url: out.url, kind: out.type });
            if (file.width && file.height) sizeRef.current[out.url] = { width: file.width, height: file.height };
          } else {
            failed.push(file.name || `file ${i + 1}`);
          }
        } catch (err: any) {
          console.warn('[CreatePostScreen] Upload failed for file:', err);
          failed.push(`${file.name || `file ${i + 1}`}${err?.message ? ` (${err.message})` : ''}`);
        }
      }

      if (uploaded.length > 0) {
        uploaded.forEach((u) => { kindsRef.current[u.url] = u.kind; });
        setMediaUrls((prev) => [...prev, ...uploaded.map((u) => u.url)]);
        setStep('preview');
      }
      if (failed.length > 0) {
        Alert.alert(
          uploaded.length === 0 ? 'Upload failed' : `${failed.length} file${failed.length > 1 ? 's' : ''} could not be added`,
          failed.slice(0, 3).join('\n')
        );
      }
    } catch (err: any) {
      if (!DocumentPicker.isCancel(err)) {
        console.warn('Pick files error:', err);
        Alert.alert('Upload Error', friendlyError(err, 'Failed to select media'));
      }
    } finally {
      setIsUploadingMedia(false);
      setUploadingProgressText('');
    }
  };

  // Search users for tagging
  useEffect(() => {
    if (!tagQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const delayTimer = setTimeout(async () => {
      setIsSearchingUsers(true);
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .or(`username.ilike.%${orTerm(tagQuery)}%,full_name.ilike.%${orTerm(tagQuery)}%`)
          .limit(10);
        // never offer yourself or people you blocked
        const { data: sess } = await supabase.auth.getSession();
        const me = sess?.session?.user?.id;
        let blocked = new Set<string>();
        if (me) {
          const { data: b } = await (supabase as any).from('blocked_users').select('blocked_user_id').eq('user_id', me);
          blocked = new Set((b || []).map((x: any) => x.blocked_user_id));
        }
        if (data) setSearchResults((data as TaggedUser[]).filter((u) => u.id !== me && !blocked.has(u.id)));
      } catch (err) {
        console.warn('Search profiles error:', err);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 300);

    return () => clearTimeout(delayTimer);
  }, [tagQuery]);

  const storagePathOf = (url: string): string | null => {
    const part = String(url || '').split('/portfolios/')[1];
    return part ? decodeURIComponent(part.split('?')[0]) : null;
  };

  const handleRemoveMedia = (idx: number) => {
    const removedUrl = mediaUrls[idx];
    if (removedUrl) {
      delete localRef.current[removedUrl];
      delete finalsRef.current[removedUrl];
      setRecipes((prev) => { const n = { ...prev }; delete n[removedUrl]; return n; });
      setVideoEdits((prev) => { const n = { ...prev }; delete n[removedUrl]; return n; });
      const path = !editPostId ? storagePathOf(removedUrl) : null; // a video removed before posting is not kept in storage
      if (path) getSupabaseClient().storage.from('portfolios').remove([path]).catch(() => { });
    }
    const next = mediaUrls.filter((_, i) => i !== idx);
    setMediaUrls(next);
    if (next.length === 0) { setStep('select'); setActiveIndex(0); return; }
    setActiveIndex((a) => Math.max(0, Math.min(idx < a ? a - 1 : a, next.length - 1)));
  };

  const handleTagUser = (user: TaggedUser) => {
    if (!taggedUsers.some((u) => u.id === user.id)) {
      setTaggedUsers((prev) => [...prev, user]);
    }
    setTagQuery('');
    setShowTagModal(false);
  };

  const handleRemoveTag = (id: string) => {
    setTaggedUsers((prev) => prev.filter((u) => u.id !== id));
  };

  const [isBakingMedia, setIsBakingMedia] = useState(false);

  /** finishes every new photo (turn, crop, colour, text, resize) so it is ready to preview and upload; false if something failed */
  const prepareMedia = async (): Promise<boolean> => {
    const targets = mediaUrls.filter((u) => localRef.current[u] && !localRef.current[u].passthrough);
    if (targets.length === 0) return true;
    setIsBakingMedia(true);
    try {
      for (const u of targets) {
        if (isVideoUrl(u)) {
          const edit = videoEdits[u];
          const sig = JSON.stringify(edit || null);
          if (finalsRef.current[u]?.sig === sig) continue;
          if (edit) {
            if (edit.end - edit.start > POST_VIDEO_MAX_SECONDS + 0.5) {
              Alert.alert('This video is too long', 'Videos can be up to 3:59. Drag the handles to keep a shorter part.');
              return false;
            }
            if (edit.mute || edit.start > 0.1 || edit.end < edit.duration - 0.1) {
              const out = await trimVideo(u, edit.start * 1000, edit.end * 1000, edit.mute);
              finalsRef.current[u] = { uri: out.uri, sig, mime: out.mime };
            }
          } else {
            const info = await videoInfo(u);
            if (info.duration / 1000 > POST_VIDEO_MAX_SECONDS + 0.5) {
              Alert.alert('This video is too long', 'Videos can be up to 3:59. Open it and drag the handles to keep a shorter part.');
              return false;
            }
          }
          continue;
        }
        const recipe = recipes[u] || defaultRecipe();
        const sig = JSON.stringify(recipe);
        if (finalsRef.current[u]?.sig === sig) continue;
        const out = await renderPhoto(u, recipe, { maxEdge: 1440, format: 'webp', quality: 85 });
        finalsRef.current[u] = { uri: out.uri, sig, mime: out.mime };
        if (out.width > 0 && out.height > 0) sizeRef.current[u] = { width: out.width, height: out.height };
      }
      return true;
    } catch (err: any) {
      Alert.alert('Could not prepare your photos', friendlyError(err, 'Please try again.'));
      return false;
    } finally {
      setIsBakingMedia(false);
    }
  };

  const handleProceedFromPreview = async () => {
    if (await prepareMedia()) setStep('details');
  };

  /** what to show for an item: the finished picture if it has one */
  const previewOf = (u: string) => finalsRef.current[u]?.uri || u;

  const handleSubmit = async () => {
    const pollInUse = !editPostId && pollDraftInUse(poll);
    const check = checkPost({ caption: content, mediaCount: mediaUrls.length, busy: isUploadingMedia || isBakingMedia, hasPoll: pollInUse || !!jobSharePart });
    if (!check.ok) {
      Alert.alert('Cannot post yet', check.message);
      return;
    }
    if (!editPostId && scheduleOn) {
      const sc = checkSchedule(scheduleAt);
      if (!sc.ok) { Alert.alert('Check the schedule', sc.message); return; }
    }
    if (pollInUse) {
      const pc = checkPollDraft(poll!);
      if (!pc.ok) {
        Alert.alert('Check your poll', pc.message);
        return;
      }
    }
    if (loading) return;

    setLoading(true);
    let scheduledMessage = '';
    const uploadedPaths: string[] = [];
    try {
      const supabase = getSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user?.id) {
        throw new Error('Please sign in to share a post.');
      }

      // new photos: finish them, then upload only the finished pictures (the photo as picked never leaves this phone)
      if (mediaUrls.some((u) => localRef.current[u])) {
        if (!(await prepareMedia())) { setLoading(false); return; }
      }
      const items: any[] = [];
      for (let i = 0; i < mediaUrls.length; i++) {
        const url = mediaUrls[i];
        let finalUrl = url;
        const local = localRef.current[url];
        if (local) {
          setUploadingProgressText(mediaUrls.length > 1 ? `Uploading ${i + 1} of ${mediaUrls.length}...` : 'Uploading...');
          const fin = finalsRef.current[url];
          const out = isVideoUrl(url)
            ? await uploadMediaPipeline({ uri: fin ? fin.uri : url, name: fin ? 'video.mp4' : (local.name || 'video.mp4'), type: fin ? fin.mime : (local.type || 'video/mp4') }, { bucket: 'portfolios', folder: 'posts' })
            : fin && !local.passthrough
            ? await uploadMediaPipeline({ uri: fin.uri, name: fin.mime === 'image/jpeg' ? 'photo.jpg' : 'photo.webp', type: fin.mime }, { bucket: 'portfolios', folder: 'posts', skipCompress: true })
            : await uploadMediaPipeline({ uri: url, name: local.name || 'photo.jpg', type: local.type || 'image/jpeg' }, { bucket: 'portfolios', folder: 'posts' });
          finalUrl = out.url;
          const path = storagePathOf(finalUrl);
          if (path) uploadedPaths.push(path);
        }
        const alt = (altTexts[url] || '').trim().slice(0, POST_ALT_TEXT_MAX);
        // a post being edited keeps whatever it was saved with (nothing is replaced by defaults)
        const raw = editPostId ? rawItemsRef.current[url] : null;
        const base: any = raw ? { ...raw } : {};
        delete base.alt;
        // the shown size: known from picking/editing, else read now (a restored draft); a post being edited keeps the size it had
        let size = sizeRef.current[url];
        if (!size && local) {
          try {
            if (isVideoUrl(url)) {
              if (videoEditingAvailable()) { const vi = await videoInfo(url); size = { width: vi.width, height: vi.height }; }
            } else if (photoEditingAvailable()) {
              size = await photoInfo(finalsRef.current[url]?.uri || url);
            }
          } catch { /* a post without a saved size is still shown correctly (measured by the reader) */ }
        }
        items.push({ ...base, ...(size ? mediaSizeFields(size.width, size.height) : {}), url: finalUrl, type: isVideoUrl(url) ? 'video' : 'image', ...(alt ? { alt } : {}) });
      }

      // details (place, tagged people, comment/like switches) ride on the first item; a text post gets a details-only item
      const mediaItemsFormatted = buildMediaItems(items, {
        location,
        tagged_users: taggedUsers as any,
        comments_disabled: disableComments,
        hide_likes: hideLikes,
      });

      const payload: any = {
        content: jobSharePart ? (content.trim() ? `${content.trim()}\n\nJOB_SHARE::${jobSharePart}` : `JOB_SHARE::${jobSharePart}`) : content.trim(),
        ...mediaColumns(items),
        media_items: mediaItemsFormatted,
        page_id: selectedPageId === 'user' ? null : selectedPageId,
        tags: extractHashtags(content), // real hashtags, same as the web app
        category: normalizeCategory(selectedCraft), // the topic is a separate field
        audience: normalizeAudience(audience), // who can see it (enforced by the database)
        link_preview: linkPreview && content.includes(linkPreview.url) ? linkPreview : null,
        updated_at: new Date().toISOString(),
      };

      if (editPostId) {
        const { error } = await supabase.from('posts').update(payload).eq('id', editPostId);
        if (error) throw error;
      } else {
        const scheduledIso = scheduleOn && scheduleAt ? scheduleAt.toISOString() : null;
        const { data: created, error } = await supabase.from('posts').insert({ ...payload, author_id: user.id, scheduled_at: scheduledIso }).select('id').single();
        if (error) throw error;
        if (pollInUse && created?.id) {
          try {
            await attachPoll(supabase, (created as any).id, poll!);
          } catch (pollErr: any) {
            await supabase.from('posts').delete().eq('id', (created as any).id); // do not leave a post without the poll the author asked for
            throw new Error(`Your post was not published because the poll could not be added: ${pollErr?.message || 'please try again'}`);
          }
        }
        if (collabs.length > 0 && (created as any)?.id) {
          try {
            await inviteCollaborators(supabase, (created as any).id, collabs.map((c) => c.id));
          } catch (collabErr: any) {
            Alert.alert('Posted, but the invitations were not sent', collabErr?.message || 'Please try again from the post.');
          }
        }
        // @mentions in a post are recorded and notified by the posts trigger notify_post_mentions (part_aq_posts.sql), so none are inserted here (that would notify twice)
        if (scheduledIso) scheduledMessage =`Your post will go live ${formatSchedule(scheduledIso)}.`;
      }

      sharedRef.current = true;
      clearDraft();
      // the temporary pictures made while editing are no longer needed
      Object.keys(finalsRef.current).forEach((u) => releasePhoto(finalsRef.current[u].uri));
      Object.keys(localRef.current).forEach((u) => { if (!localRef.current[u].passthrough) releasePhoto(u); });
      DeviceEventEmitter.emit('Feed.postCreated'); // the feed refreshes itself
      Alert.alert(
        editPostId ? 'Post updated' : (scheduledMessage ? 'Scheduled' : 'Posted'),
        editPostId ? 'Your changes are live.' : (scheduledMessage || 'Your post is live.'),
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err: any) {
      // pictures uploaded for a post that was not saved are removed again
      if (uploadedPaths.length > 0) getSupabaseClient().storage.from('portfolios').remove(uploadedPaths).catch(() => { });
      Alert.alert('Could not post', describePostError(err));
    } finally {
      setLoading(false);
      setUploadingProgressText('');
    }
  };

  const activeAuthorName =
    selectedPageId === 'user'
      ? userProfile?.full_name || userProfile?.username || 'You'
      : myPages.find((p) => p.id === selectedPageId)?.name || 'Studio Page';

  const activeAuthorAvatar =
    selectedPageId === 'user' ? userProfile?.avatar_url : myPages.find((p) => p.id === selectedPageId)?.logo_url;

  const gifPicker = (
    <Modal visible={gifOpen} animationType="slide" onRequestClose={() => setGifOpen(false)}>
      <View style={{ flex: 1, backgroundColor: themeColors.bgScreen, paddingTop: Platform.OS === 'ios' ? 54 : 24 }}>
        <View style={{ flex: 1, width: '100%', maxWidth: isTablet ? 760 : undefined, alignSelf: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 }}>
          <TextInput
            style={{ flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, color: themeColors.textPrimary, borderColor: themeColors.border, backgroundColor: themeColors.inputBg }}
            placeholder="Search GIFs"
            placeholderTextColor={themeColors.textMuted}
            value={gifQuery}
            onChangeText={setGifQuery}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search GIFs"
          />
          <TouchableOpacity onPress={() => setGifOpen(false)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }} accessibilityRole="button" accessibilityLabel="Close GIF picker">
            <Text style={{ color: ORANGE, fontWeight: '700' }}>Close</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 8, flexDirection: 'row', flexWrap: 'wrap' }}>
          {gifState === 'loading' && <Text style={{ width: '100%', textAlign: 'center', padding: 24, color: themeColors.textSecondary }}>Loading…</Text>}
          {gifState === 'off' && <Text style={{ width: '100%', textAlign: 'center', padding: 24, color: themeColors.textSecondary }}>GIFs are not set up yet.</Text>}
          {gifState === 'error' && <Text style={{ width: '100%', textAlign: 'center', padding: 24, color: themeColors.textSecondary }}>Could not load GIFs. Try again in a moment.</Text>}
          {gifState === 'idle' && gifs.length === 0 && <Text style={{ width: '100%', textAlign: 'center', padding: 24, color: themeColors.textSecondary }}>No GIFs found.</Text>}
          {gifState === 'idle' && gifs.map((g) => (
            <TouchableOpacity key={g.id} onPress={() => addGif(g)} style={{ width: isTablet ? '25%' : '33.33%', padding: 3 }} accessibilityRole="button" accessibilityLabel={g.title}>
              <Image source={{ uri: g.preview }} style={{ width: '100%', aspectRatio: 1, borderRadius: 8 }} resizeMode="cover" />
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={{ textAlign: 'right', paddingHorizontal: 12, paddingBottom: 12, fontSize: 12, color: themeColors.textSecondary }}>{GIF_CREDIT}</Text>
        </View>
      </View>
    </Modal>
  );

  if (loadingEdit) {
    return (
      <View style={[styles.loadingCenter, { backgroundColor: themeColors.bgScreen }]}>
        <ActivityIndicator size="large" color={ORANGE} />
        <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Loading post details...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: themeColors.bgScreen }]}
    >
      {/* STEP 1: SELECT MEDIA */}
      {step === 'select' && (
        <View style={[styles.stepSelectContainer, { backgroundColor: themeColors.bgScreen }]}>
          <Header title="New Post" showLogo={false} onBack={() => navigation.goBack()} />

          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.selectBody} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={isTablet ? [styles.selectCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }] : styles.selectInner}>
            <View style={[styles.uploadCloudIconBox, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
              <Icon name="upload" size={48} color={ORANGE} />
            </View>

            <Text style={[styles.selectTitle, { color: themeColors.textPrimary }]}>Create New Post</Text>
            <Text style={[styles.selectSub, { color: themeColors.textSecondary }]}>Upload photos and videos directly from your device gallery</Text>

            {/* Native Gallery / File Upload Button */}
            <TouchableOpacity
              style={[styles.uploadGalleryBtn, isTablet && { alignSelf: 'stretch' }, isUploadingMedia && styles.btnDisabled]}
              onPress={handlePickLocalFiles}
              disabled={isUploadingMedia}
            >
              {isUploadingMedia ? (
                <View style={styles.flexRowCenter}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.uploadGalleryBtnText}>{uploadingProgressText || 'Uploading...'}</Text>
                </View>
              ) : (
                <View style={styles.flexRowCenter}>
                  <Icon name="image-plus" size={20} color="#FFFFFF" />
                  <Text style={styles.uploadGalleryBtnText}>Choose Photos / Videos</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setStep('details')}
              disabled={isUploadingMedia}
              style={{ minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Write a text post or poll"
            >
              <Text style={{ color: ORANGE, fontWeight: '700', fontSize: 14 }}>or write a text post or poll</Text>
            </TouchableOpacity>

          </View>
          </ScrollView>
        </View>
      )}

      {/* STEP 2: EDIT THE PHOTO (it stays on this phone until the post is shared) */}
      {step === 'preview' && (() => {
        const url = mediaUrls[Math.min(activeIndex, Math.max(0, mediaUrls.length - 1))];
        const local = url ? localRef.current[url] : undefined;
        const canEdit = !!url && !!local && !local.passthrough && !unreadable[url] && !isVideoUrl(url) && photoEditingAvailable();
        return (
          <View style={[styles.editorStepContainer, { backgroundColor: themeColors.bgScreen }]}>
          <View style={[styles.editorColumn, isTablet && styles.editorColumnTablet, isTablet && { borderColor: themeColors.border, backgroundColor: themeColors.bgCard }]}>
            <View style={[styles.editorTopBar, { backgroundColor: themeColors.bgCard, borderBottomColor: themeColors.border }]}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={() => setStep('select')} style={{ padding: 4 }}>
                <Icon name="arrow-left" size={22} color={themeColors.textPrimary} />
              </TouchableOpacity>
              <Text style={[styles.editorTopTitle, { color: themeColors.textPrimary }]}>{isVideoUrl(url) ? 'Edit video' : 'Edit photo'}</Text>
              <TouchableOpacity
                accessibilityRole="button"
                style={[styles.nextStepBlueBtn, { backgroundColor: ORANGE, minHeight: 40, justifyContent: 'center' }, (isBakingMedia || mediaUrls.length === 0) && styles.btnDisabled]}
                onPress={handleProceedFromPreview}
                disabled={isBakingMedia || mediaUrls.length === 0}
              >
                {isBakingMedia ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.nextStepBlueBtnText}>Next</Text>}
              </TouchableOpacity>
            </View>

            {/* all items in this post */}
            <View style={[styles.editorBottomActionBar, { backgroundColor: themeColors.bgCard, borderBottomColor: themeColors.border, borderTopWidth: 0, borderBottomWidth: StyleSheet.hairlineWidth }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbsScroll}>
                {mediaUrls.map((u, idx) => (
                  <TouchableOpacity
                    key={u}
                    accessibilityRole="button"
                    accessibilityLabel={`Item ${idx + 1} of ${mediaUrls.length}`}
                    style={[styles.thumbCard, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }, activeIndex === idx && styles.thumbCardActive]}
                    onPress={() => setActiveIndex(idx)}
                  >
                    {isVideoUrl(u) ? (
                      <View style={[styles.fullImg, { alignItems: 'center', justifyContent: 'center' }]}><Icon name="video" size={18} color={themeColors.iconSecondary} /></View>
                    ) : (
                      <Image source={{ uri: previewOf(u) }} style={styles.fullImg} resizeMode="cover" />
                    )}
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Remove item ${idx + 1}`} style={styles.thumbDeleteBadge} onPress={() => handleRemoveMedia(idx)}>
                      <View style={styles.thumbDeleteDot}><Icon name="x" size={10} color="#FFFFFF" /></View>
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
                {mediaUrls.length < POST_MEDIA_MAX && (
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel="Add more photos or videos" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={[styles.addMoreMediaThumbBtn, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]} onPress={handlePickLocalFiles}>
                    <Icon name="plus" size={20} color={themeColors.textPrimary} />
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>

            {!url ? null : (local && isVideoUrl(url) && !unreadable[url] && videoEditingAvailable()) ? (
              <VideoTrimmer
                key={url}
                uri={url}
                edit={videoEdits[url]}
                onChange={(e) => setVideoEdits((prev) => ({ ...prev, [url]: e }))}
                onUnreadable={() => setUnreadable((prev) => ({ ...prev, [url]: true }))}
              />
            ) : canEdit ? (
              <PhotoEditor
                key={url}
                sourceUri={url}
                prepared
                recipe={recipes[url] || defaultRecipe()}
                onChange={(r) => setRecipes((prev) => ({ ...prev, [url]: r }))}
                onUnreadable={() => setUnreadable((prev) => ({ ...prev, [url]: true }))}
              />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#000000' }}>
                {isVideoUrl(url) ? (
                  <Icon name="video" size={48} color="#FFFFFF" />
                ) : (
                  <Image source={{ uri: url }} style={{ width: '100%', flex: 1 }} resizeMode="contain" accessibilityLabel="Preview" />
                )}
                <Text style={{ color: '#FFFFFFB3', fontSize: 12, marginTop: 10, textAlign: 'center' }}>
                  {isVideoUrl(url) ? 'Videos are posted as they are.' : local?.passthrough ? 'GIFs are posted as they are, so they keep moving.' : 'This picture is posted as it is.'}
                </Text>
              </View>
            )}
          </View>
          </View>
        );
      })()}

      {/* STEP 3: DETAILS & CAPTION SCREEN */}
      {step === 'details' && (
        <View style={{ flex: 1, backgroundColor: themeColors.bgScreen }}>
          <Header
            showLogo={false}
            title={editPostId ? 'Edit Info' : 'New Post'}
            onBack={() => {
              if (sharedJob && !editPostId) navigation.goBack();
              else if (mediaUrls.length > 0 && !editPostId) setStep('preview');
              else if (!editPostId) setStep('select');
              else navigation.goBack();
            }}
            rightAction={
              <TouchableOpacity
                style={[styles.publishBtn, loading && styles.publishBtnDisabled]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.publishBtnText}>{editPostId ? 'Done' : 'Share'}</Text>
                )}
              </TouchableOpacity>
            }
          />

          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={{ alignItems: 'center', paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
          <View style={[styles.detailsColumn, isTablet && styles.detailsColumnTablet]}>
            {/* Author Metadata Row with Page Switcher */}
            <View style={styles.authorRow}>
              <View style={styles.avatarCircle}>
                {activeAuthorAvatar ? (
                  <CachedImage uri={activeAuthorAvatar} style={styles.avatarImg} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarFallbackText}>
                      {activeAuthorName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.authorMeta}>
                <TouchableOpacity
                  style={styles.authorSelectorRow}
                  onPress={() => setShowPageSelector(!showPageSelector)}
                >
                  <Text style={[styles.authorName, { color: themeColors.textPrimary }]}>{activeAuthorName}</Text>
                  <Icon name="chevron-down" size={14} color={themeColors.iconSecondary} />
                </TouchableOpacity>

                <Text style={[styles.authorCraft, { color: themeColors.textSecondary }]}>
                  Posting to CineCraft Network • {selectedCraft}
                </Text>
              </View>
            </View>

            {/* Page Switcher Drawer */}
            {showPageSelector && (
              <View style={[styles.pageSelectorBox, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                <Text style={[styles.pageSelectorHeader, { color: themeColors.textSecondary }]}>POST AS:</Text>

                <TouchableOpacity
                  style={[styles.pageItem, selectedPageId === 'user' && [styles.pageItemActive, { backgroundColor: themeColors.chipBg }]]}
                  onPress={() => {
                    setSelectedPageId('user');
                    setShowPageSelector(false);
                  }}
                >
                  <Icon name="user" size={16} color={selectedPageId === 'user' ? ORANGE : themeColors.textPrimary} />
                  <Text style={[styles.pageItemText, { color: themeColors.textPrimary }, selectedPageId === 'user' && styles.pageItemTextActive]}>
                    {userProfile?.full_name || userProfile?.username || 'Personal Profile'}
                  </Text>
                </TouchableOpacity>

                {myPages.map((page) => (
                  <TouchableOpacity
                    key={page.id}
                    style={[styles.pageItem, selectedPageId === page.id && [styles.pageItemActive, { backgroundColor: themeColors.chipBg }]]}
                    onPress={() => {
                      setSelectedPageId(page.id);
                      setShowPageSelector(false);
                    }}
                  >
                    <Icon name="company" size={16} color={selectedPageId === page.id ? ORANGE : themeColors.textPrimary} />
                    <Text
                      style={[styles.pageItemText, { color: themeColors.textPrimary }, selectedPageId === page.id && styles.pageItemTextActive]}
                    >
                      {page.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Main Text Content Input with Side Media Preview */}
            <View style={[styles.captionRowWithMedia, isTablet && { minHeight: 150 }, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
              <MentionInput
                containerStyle={{ flex: 1 }}
                onMentionSelected={(u) => setPickedMentions((p) => ({ ...p, [u.id]: u }))}
                style={[styles.textInputFlex, isTablet && { fontSize: 16 }, { color: themeColors.textPrimary }]}
                placeholder={jobSharePart ? 'Why is this job worth sharing? Tell people who it is for.' : 'Write a caption or production notes...'}
                placeholderTextColor={themeColors.textMuted}
                multiline
                value={content}
                onChangeText={setContent}
                maxLength={POST_CAPTION_MAX}
                accessibilityLabel="Caption"
                autoFocus
              />
              {mediaUrls[0] && (
                <View style={[styles.sideMediaPreview, isTablet && { width: 104, height: 130 }]}>
                  <CachedImage uri={previewOf(mediaUrls[0])} style={styles.fullImg} />
                </View>
              )}
            </View>

            <Text style={{ alignSelf: 'flex-end', marginRight: 4, marginTop: 4, fontSize: 12, color: content.length >= POST_CAPTION_MAX ? '#DC2626' : themeColors.textSecondary }}>
              {content.length} / {POST_CAPTION_MAX}
            </Text>

            {/* The job being shared (like attaching a link in a LinkedIn post) */}
            {!!jobShareData && (
              <View pointerEvents="none" style={{ marginTop: 12, borderWidth: 1, borderColor: themeColors.border, borderRadius: 16, overflow: 'hidden' }} accessibilityLabel="The job that will be shared">
                <JobShareCard
                  jobId={jobShareData.id || jobShareData.jobId || ''}
                  title={jobShareData.title}
                  company={jobShareData.company}
                  location={jobShareData.location}
                  salary={jobShareData.salary}
                  type={jobShareData.type}
                  logoUrl={jobShareData.logoUrl || jobShareData.logo_url}
                  description={jobShareData.description}
                  compact={true}
                />
              </View>
            )}

            {/* Add to your post */}
            <View style={{ marginTop: 14, marginBottom: 10, width: '100%' }}>
              <Text style={[styles.sectionLabel, { color: themeColors.textSecondary, marginBottom: 8 }]}>ADD TO YOUR POST</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {([
                  { key: 'gif', label: 'GIF', on: false, disabled: isUploadingMedia || mediaUrls.length >= POST_MEDIA_MAX, show: true, press: () => setGifOpen(true), a11y: 'Add a GIF' },
                  { key: 'poll', label: 'Poll', on: !!poll, disabled: false, show: !editPostId, press: () => setPoll(poll ? null : emptyPollDraft()), a11y: poll ? 'Remove the poll' : 'Add a poll' },
                  { key: 'schedule', label: 'Schedule', on: scheduleOn, disabled: false, show: !editPostId, press: () => { setScheduleOn(!scheduleOn); if (!scheduleOn && !scheduleAt) setScheduleAt(schedulePresets()[0].at); }, a11y: scheduleOn ? 'Post now instead of scheduling' : 'Schedule the post' },
                ]).filter((c) => c.show).map((c) => (
                  <TouchableOpacity
                    key={c.key}
                    onPress={c.press}
                    disabled={c.disabled}
                    accessibilityRole="button"
                    accessibilityLabel={c.a11y}
                    accessibilityState={{ selected: c.on, disabled: c.disabled }}
                    style={{ minHeight: 44, paddingHorizontal: 18, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.on ? themeColors.primary : themeColors.chipBg, borderColor: c.on ? themeColors.primary : themeColors.border, opacity: c.disabled ? 0.5 : 1 }}
                  >
                    <Text style={{ fontWeight: '700', fontSize: 14, color: c.on ? themeColors.onPrimary : themeColors.textPrimary }}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Poll builder (new posts only) */}
            {!editPostId && !!poll && (
              <View style={{ marginTop: 14, width: '100%', borderWidth: 1, borderRadius: 18, padding: 14, gap: 10, borderColor: themeColors.border, backgroundColor: themeColors.bgCard }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: themeColors.textPrimary }}>Poll</Text>
                    <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>Ask your connections to vote: 2 to {POLL_MAX_OPTIONS} options.</Text>
                  </View>
                  <TouchableOpacity onPress={() => setPoll(null)} accessibilityRole="button" accessibilityLabel="Remove the poll" style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name="x" size={18} color={themeColors.iconSecondary} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={{ minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16, color: themeColors.textPrimary, borderColor: themeColors.border, backgroundColor: themeColors.inputBg }}
                  placeholder="Ask a question (optional)"
                  placeholderTextColor={themeColors.textMuted}
                  value={poll.question}
                  onChangeText={(t2) => setPoll({ ...poll, question: t2 })}
                  maxLength={POLL_QUESTION_MAX}
                  accessibilityLabel="Poll question"
                />
                {poll.options.map((opt, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: themeColors.textMuted }} />
                    <TextInput
                      style={{ flex: 1, minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 16, color: themeColors.textPrimary, borderColor: themeColors.border, backgroundColor: themeColors.inputBg }}
                      placeholder={`Option ${i + 1}`}
                      placeholderTextColor={themeColors.textMuted}
                      value={opt}
                      onChangeText={(t2) => setPoll({ ...poll, options: poll.options.map((o, j) => (j === i ? t2 : o)) })}
                      maxLength={POLL_OPTION_MAX}
                      accessibilityLabel={`Poll option ${i + 1}`}
                    />
                    {poll.options.length > 2 && (
                      <TouchableOpacity
                        onPress={() => setPoll({ ...poll, options: poll.options.filter((_, j) => j !== i) })}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove option ${i + 1}`}
                        style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Icon name="x" size={16} color={themeColors.iconSecondary} />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
                {poll.options.length < POLL_MAX_OPTIONS && (
                  <TouchableOpacity
                    onPress={() => setPoll({ ...poll, options: [...poll.options, ''] })}
                    accessibilityRole="button"
                    style={{ minHeight: 46, borderWidth: 1, borderStyle: 'dashed', borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderColor: themeColors.border }}
                  >
                    <Text style={{ color: themeColors.primary, fontWeight: '700' }}>+ Add option  <Text style={{ color: themeColors.textMuted, fontWeight: '400' }}>({poll.options.length}/{POLL_MAX_OPTIONS})</Text></Text>
                  </TouchableOpacity>
                )}
                <Text style={{ fontSize: 12, fontWeight: '700', letterSpacing: 0.6, color: themeColors.textSecondary }}>POLL LENGTH</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {POLL_DURATIONS.map((d) => {
                    const on = poll.durationId === d.id;
                    return (
                      <TouchableOpacity
                        key={d.id}
                        onPress={() => setPoll({ ...poll, durationId: d.id })}
                        style={{ paddingHorizontal: 16, minHeight: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? themeColors.textPrimary : themeColors.chipBg, borderColor: on ? themeColors.textPrimary : themeColors.border }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                      >
                        <Text style={{ fontSize: 14, fontWeight: '700', color: on ? themeColors.bgScreen : themeColors.textSecondary }}>{d.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Schedule panel (new posts only) */}
            {!editPostId && scheduleOn && (
              <View style={{ marginTop: 14, width: '100%', borderWidth: 1, borderRadius: 18, padding: 14, gap: 10, borderColor: themeColors.border, backgroundColor: themeColors.bgCard }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: themeColors.textPrimary }}>Publish later</Text>
                <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>
                  {scheduleAt ? `Goes live ${formatSchedule(scheduleAt)}. Only you see it until then.` : 'Choose a time up to 90 days ahead.'}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {schedulePresets().map((pr) => {
                    const on = scheduleAt?.getTime() === pr.at.getTime();
                    return (
                      <TouchableOpacity key={pr.id} onPress={() => setScheduleAt(pr.at)} style={{ paddingHorizontal: 16, minHeight: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? themeColors.textPrimary : themeColors.chipBg, borderColor: on ? themeColors.textPrimary : themeColors.border }} accessibilityRole="button" accessibilityState={{ selected: on }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: on ? themeColors.bgScreen : themeColors.textSecondary }}>{pr.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {([['Day', 24 * 60], ['Time', 60]] as [string, number][]).map(([label, minutes]) => (
                  <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ width: 44, color: themeColors.textSecondary, fontWeight: '700' }}>{label}</Text>
                    <TouchableOpacity onPress={() => scheduleAt && setScheduleAt(new Date(scheduleAt.getTime() - minutes * 60_000))} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: themeColors.border, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel={`Earlier by one ${label.toLowerCase()}`}>
                      <Text style={{ fontSize: 20, color: themeColors.textPrimary }}>−</Text>
                    </TouchableOpacity>
                    <Text style={{ flex: 1, textAlign: 'center', color: themeColors.textPrimary, fontWeight: '700' }}>{scheduleAt ? formatSchedule(scheduleAt) : ''}</Text>
                    <TouchableOpacity onPress={() => scheduleAt && setScheduleAt(new Date(scheduleAt.getTime() + minutes * 60_000))} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: themeColors.border, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel={`Later by one ${label.toLowerCase()}`}>
                      <Text style={{ fontSize: 20, color: themeColors.textPrimary }}>+</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {!!linkPreview && (
              <View style={{ marginTop: 8 }}>
                <LinkPreviewCard preview={linkPreview} />
                <TouchableOpacity
                  onPress={() => { setDismissedLink(linkPreview.url); setLinkPreview(null); }}
                  accessibilityRole="button"
                  accessibilityLabel="Remove link preview"
                  style={{ position: 'absolute', right: 20, top: 6, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <Icon name="x" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            )}

            {/* Tagged People Pills */}
            {taggedUsers.length > 0 && (
              <View style={styles.taggedUsersRow}>
                <Text style={[styles.taggedLabel, { color: themeColors.textSecondary }]}>TAGGED:</Text>
                {taggedUsers.map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    style={[styles.taggedPill, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}
                    onPress={() => handleRemoveTag(u.id)}
                  >
                    <Text style={styles.taggedPillText}>@{u.username || u.full_name}</Text>
                    <Icon name="x" size={12} color={ORANGE} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Alt text: a description for people who cannot see the photo */}
            {mediaUrls.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: themeColors.textSecondary }]}>ALT TEXT (FOR SCREEN READERS)</Text>
                {mediaUrls.map((u, i) => (
                  <View key={u} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    {isVideoUrl(u) ? (
                      <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: themeColors.chipBg, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name="video" size={18} color={themeColors.iconSecondary} />
                      </View>
                    ) : (
                      <CachedImage uri={previewOf(u)} style={{ width: 44, height: 44, borderRadius: 8 }} />
                    )}
                    <TextInput
                      style={{ flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, color: themeColors.textPrimary, borderColor: themeColors.border, backgroundColor: themeColors.inputBg }}
                      placeholder={`Describe item ${i + 1}`}
                      placeholderTextColor={themeColors.textMuted}
                      value={altTexts[u] || ''}
                      onChangeText={(t) => setAltTexts((prev) => ({ ...prev, [u]: t }))}
                      maxLength={POST_ALT_TEXT_MAX}
                      accessibilityLabel={`Alt text for item ${i + 1}`}
                    />
                  </View>
                ))}
              </View>
            )}

            {/* Who can see it */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: themeColors.textSecondary }]}>AUDIENCE</Text>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                {POST_AUDIENCES.map((a) => {
                  const on = audience === a.id;
                  return (
                    <TouchableOpacity
                      key={a.id}
                      onPress={() => setAudience(a.id)}
                      style={[{ paddingHorizontal: 16, minHeight: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: themeColors.chipBg, borderColor: themeColors.border }, on && { backgroundColor: ORANGE, borderColor: ORANGE }]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`${a.label}. ${a.description}`}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '700', color: on ? '#FFFFFF' : themeColors.textSecondary }}>{a.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={{ marginTop: 6, fontSize: 12, color: themeColors.textSecondary }}>{POST_AUDIENCES.find((a) => a.id === audience)?.description}</Text>
            </View>

            {/* Collaborators (new posts only) */}
            {!editPostId && (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: themeColors.textSecondary, marginBottom: 2 }]}>COLLABORATORS</Text>
                <Text style={{ fontSize: 12, color: themeColors.textSecondary, marginBottom: 8 }}>Credit up to {COLLAB_MAX} people. They are shown on the post only after they accept.</Text>
                {collabs.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    {collabs.map((c) => (
                      <TouchableOpacity key={c.id} onPress={() => setCollabs((prev) => prev.filter((x) => x.id !== c.id))} style={[styles.taggedPill, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]} accessibilityRole="button" accessibilityLabel={`Remove ${c.username || c.full_name}`}>
                        <Text style={styles.taggedPillText}>@{c.username || c.full_name}</Text>
                        <Icon name="x" size={12} color={ORANGE} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {collabs.length < COLLAB_MAX && (
                  <>
                    <TextInput
                      style={{ minHeight: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, color: themeColors.textPrimary, borderColor: themeColors.border, backgroundColor: themeColors.inputBg }}
                      placeholder="Search people to credit"
                      placeholderTextColor={themeColors.textMuted}
                      value={collabQuery}
                      onChangeText={setCollabQuery}
                      autoCapitalize="none"
                      autoCorrect={false}
                      accessibilityLabel="Search people to credit"
                    />
                    {collabResults.map((u) => (
                      <TouchableOpacity key={u.id} onPress={() => { setCollabs((prev) => [...prev, u]); setCollabQuery(''); setCollabResults([]); }} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }} accessibilityRole="button">
                        {u.avatar_url ? <CachedImage uri={u.avatar_url} style={{ width: 32, height: 32, borderRadius: 16 }} /> : <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: themeColors.chipBg }} />}
                        <View>
                          <Text style={{ color: themeColors.textPrimary, fontWeight: '600' }}>{u.full_name || u.username}</Text>
                          <Text style={{ color: themeColors.textSecondary, fontSize: 12 }}>@{u.username}</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </View>
            )}

            {/* Category */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: themeColors.textSecondary }]}>CATEGORY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillsRow}>
                {CRAFT_OPTIONS.map((c) => {
                  const isSelected = selectedCraft === c;
                  return (
                    <TouchableOpacity
                      key={c}
                      style={[styles.craftPill, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }, isSelected && styles.craftPillActive]}
                      onPress={() => setSelectedCraft(c)}
                    >
                      <Text style={[styles.craftPillText, { color: themeColors.textSecondary }, isSelected && styles.craftPillTextActive]}>
                        {c}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Location Selector (GPS & Realtime OpenStreetMap Search) */}
            <View style={styles.section}>
              <TouchableOpacity
                style={[styles.locationHeaderRow, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}
                onPress={() => setShowLocations(!showLocations)}
              >
                <View style={styles.flexRow}>
                  <Icon name="map-pin" size={16} color={ORANGE} />
                  <Text style={[styles.locationLabel, { color: themeColors.textPrimary }]}>
                    {location ? `Location: ${location}` : 'Add Production Location'}
                  </Text>
                </View>
                <Icon name={showLocations ? 'chevron-up' : 'chevron-down'} size={16} color={themeColors.iconSecondary} />
              </TouchableOpacity>

              {showLocations && (
                <View style={[styles.locationSuggestions, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                  <TouchableOpacity
                    style={styles.currentLocationBtn}
                    onPress={handleGetCurrentLocation}
                    disabled={isFetchingLocation}
                  >
                    {isFetchingLocation ? (
                      <ActivityIndicator size="small" color={ORANGE} />
                    ) : (
                      <Text style={styles.currentLocationBtnText}>📍 Use My Current Location</Text>
                    )}
                  </TouchableOpacity>

                  <TextInput
                    style={[styles.locationSearchInput, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                    placeholder="Search any place in the world..."
                    placeholderTextColor={themeColors.textMuted}
                    value={location}
                    onChangeText={setLocation}
                  />

                  {isSearchingLocation && (
                    <ActivityIndicator size="small" color={ORANGE} style={{ marginVertical: 8 }} />
                  )}

                  {realtimeLocations.length > 0
                    ? realtimeLocations.map((loc) => (
                        <TouchableOpacity
                          key={loc}
                          style={[styles.locationItem, { borderBottomColor: themeColors.divider }]}
                          onPress={() => {
                            setLocation(loc);
                            setShowLocations(false);
                          }}
                        >
                          <Text style={[styles.locationItemText, { color: themeColors.textPrimary }]}>📍 {loc}</Text>
                        </TouchableOpacity>
                      ))
                    : POPULAR_LOCATIONS.map((loc) => (
                        <TouchableOpacity
                          key={loc}
                          style={[styles.locationItem, { borderBottomColor: themeColors.divider }]}
                          onPress={() => {
                            setLocation(loc);
                            setShowLocations(false);
                          }}
                        >
                          <Text style={[styles.locationItemText, { color: themeColors.textPrimary }]}>📍 {loc}</Text>
                        </TouchableOpacity>
                      ))}
                </View>
              )}
            </View>

            {/* Advanced Options */}
            <View style={styles.section}>
              <TouchableOpacity
                style={[styles.locationHeaderRow, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}
                onPress={() => setShowAdvanced(!showAdvanced)}
              >
                <View style={styles.flexRow}>
                  <Icon name="settings" size={16} color={themeColors.textPrimary} />
                  <Text style={[styles.locationLabel, { color: themeColors.textPrimary }]}>Advanced Options</Text>
                </View>
                <Icon name={showAdvanced ? 'chevron-up' : 'chevron-down'} size={16} color={themeColors.iconSecondary} />
              </TouchableOpacity>

              {showAdvanced && (
                <View style={[styles.advancedOptionsBox, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                  <View style={styles.switchRow}>
                    <Text style={[styles.switchLabel, { color: themeColors.textPrimary }]}>Hide Like & View Counts</Text>
                    <Switch
                      value={hideLikes}
                      accessibilityLabel="Hide Like & View Counts"
                      onValueChange={setHideLikes}
                      trackColor={{ false: themeColors.border, true: ORANGE }}
                    />
                  </View>
                  <View style={styles.switchRow}>
                    <Text style={[styles.switchLabel, { color: themeColors.textPrimary }]}>Turn Off Commenting</Text>
                    <Switch
                      value={disableComments}
                      accessibilityLabel="Turn Off Commenting"
                      onValueChange={setDisableComments}
                      trackColor={{ false: themeColors.border, true: ORANGE }}
                    />
                  </View>
                </View>
              )}
            </View>

            {/* Bottom Action Bar */}
            <View style={[styles.toolbar, { backgroundColor: themeColors.bgCard, borderTopColor: themeColors.divider }]}>
              <TouchableOpacity style={styles.toolBtn} onPress={() => setShowTagModal(true)}>
                <Icon name="user-check" size={18} color="#3B82F6" />
                <Text style={[styles.toolBtnText, { color: themeColors.textSecondary }]}>Tag People</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toolBtn}
                onPress={() => setShowLocations(!showLocations)}
              >
                <Icon name="map-pin" size={18} color="#10B981" />
                <Text style={[styles.toolBtnText, { color: themeColors.textSecondary }]}>Location</Text>
              </TouchableOpacity>
            </View>
          </View>
          </ScrollView>
        </View>
      )}

      {/* Tag People Search Modal */}
      <Modal visible={showTagModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tag People</Text>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={() => setShowTagModal(false)}>
                <Icon name="x" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearchBox}>
              <Icon name="search" size={16} color={themeColors.iconMuted} />
              <TextInput returnKeyType="search" accessibilityLabel="Search by name or @username"
                style={styles.modalInput}
                placeholder="Search by name or @username..."
                placeholderTextColor={themeColors.textMuted}
                value={tagQuery}
                onChangeText={setTagQuery}
                autoFocus
              />
              {tagQuery ? (
                <TouchableOpacity
                  onPress={() => setTagQuery('')}
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Icon name="x" size={16} color={themeColors.iconMuted} />
                </TouchableOpacity>
              ) : null}
            </View>

            {isSearchingUsers ? (
              <ActivityIndicator style={{ padding: 20 }} size="small" color={ORANGE} />
            ) : (
              <ScrollView style={styles.resultsList}>
                {searchResults.map((u) => (
                  <TouchableOpacity
                    key={u.id}
                    style={styles.userSearchItem}
                    onPress={() => handleTagUser(u)}
                  >
                    <View style={styles.userSearchAvatar}>
                      {u.avatar_url ? (
                        <CachedImage uri={u.avatar_url} style={styles.fullImg} />
                      ) : (
                        <Text style={styles.userSearchFallback}>
                          {(u.full_name || u.username || 'U').charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>

                    <View style={styles.userSearchMeta}>
                      <Text style={styles.userSearchName}>{u.full_name || u.username}</Text>
                      <Text style={styles.userSearchSub}>@{u.username}</Text>
                    </View>

                    <Icon name="plus" size={18} color={ORANGE} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
      {gifPicker}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#090D16',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '700',
  },
  fullImg: {
    width: '100%',
    height: '100%',
  },
  flexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flexRowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnDisabled: {
    opacity: 0.6,
  },

  // ---------------- STEP 1: SELECT ----------------
  stepSelectContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  selectBody: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  selectInner: {
    width: '100%',
    alignItems: 'center',
  },
  selectCard: {
    width: '100%',
    maxWidth: 560,
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 40,
    paddingVertical: 44,
  },
  uploadCloudIconBox: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  selectTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Lora-Bold',
    marginBottom: 8,
  },
  selectSub: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 28,
  },
  uploadGalleryBtn: {
    backgroundColor: ORANGE,
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginBottom: 14,
    elevation: 3,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  uploadGalleryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  selectMediaBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 11,
    marginBottom: 12,
  },
  selectMediaBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  demoPhotosBtn: {
    backgroundColor: '#1E293B80',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  demoPhotosBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  urlInputBox: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  urlInput: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
  },
  addUrlBtn: {
    backgroundColor: ORANGE,
    borderRadius: 12,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  addUrlBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },

  // ---------------- STEP 2: STUDIO EDITOR ----------------
  editorStepContainer: {
    flex: 1,
    backgroundColor: '#090D16',
  },
  // phones: the editor fills the screen. tablets: a centred card, so the toolbars and the photo share one column
  editorColumn: {
    flex: 1,
    width: '100%',
  },
  editorColumnTablet: {
    maxWidth: 1000,
    alignSelf: 'center',
    marginVertical: 16,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  editorTopBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    zIndex: 10,
  },
  editorTopTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  editorTopDoneText: {
    fontSize: 16,
    fontWeight: '700',
    color: ORANGE,
  },
  canvasArea: {
    width: '100%', // follows the window (it used to be fixed at the size measured when the app started)
    maxWidth: 760,
    alignSelf: 'center',
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  canvasImage: {
    width: '100%',
    height: '100%',
  },
  canvasEmptyFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
  },
  mediaIndexBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 20,
  },
  mediaIndexBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  floatingRatioPill: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    backgroundColor: 'rgba(15,23,42,0.85)',
    borderRadius: 20,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    zIndex: 25,
  },
  floatingRatioBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 14,
  },
  floatingRatioBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  floatingRatioBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  floatingRatioBtnTextActive: {
    color: '#000000',
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 15,
  },
  gridRow: {
    flex: 1,
    flexDirection: 'row',
  },
  gridCell: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.25)',
  },

  // ---------------- SUB-MENU DRAWER ----------------
  subMenuDrawer: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 40,
    elevation: 8,
  },
  drawerHandleBar: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#475569',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  filterMenuContent: {
    paddingVertical: 4,
  },
  filterScroll: {
    paddingVertical: 6,
  },
  filterCard: {
    alignItems: 'center',
    marginRight: 14,
  },
  filterCardActive: {},
  filterThumbBox: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2,
    borderColor: '#334155',
  },
  filterThumbBoxActive: {
    borderColor: ORANGE,
    elevation: 6,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },
  filterActivePill: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ORANGE,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 6,
  },
  filterLabelActive: {
    color: ORANGE,
    fontWeight: '700',
  },
  sliderContainerBox: {
    paddingHorizontal: 6,
    marginTop: 6,
  },

  // ---------------- ADJUSTMENTS MENU ----------------
  adjustMenuContent: {
    paddingVertical: 4,
  },
  adjustToolsScroll: {
    paddingVertical: 4,
  },
  adjustToolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 6,
  },
  adjustToolChipActive: {
    backgroundColor: ORANGE,
    borderColor: ORANGE,
  },
  adjustToolChipHasValue: {
    borderColor: ORANGE,
  },
  adjustToolChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  adjustToolChipTextActive: {
    color: '#FFFFFF',
  },
  toolValueDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFFFFF',
  },
  adjustActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginTop: 6,
  },
  adjustActionBtn: {
    paddingVertical: 4,
  },
  adjustActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },

  // ---------------- TEXT MENU ----------------
  textMenuContent: {
    paddingVertical: 6,
    gap: 10,
  },
  textInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  textOverlayInput: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    color: '#FFFFFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  textSaveBtn: {
    backgroundColor: ORANGE,
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  textSaveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  textStylesRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
  },
  textStylePill: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textStylePillActive: {
    backgroundColor: ORANGE,
    borderColor: ORANGE,
  },
  textStylePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.3,
  },
  textStylePillTextActive: {
    color: '#FFFFFF',
  },
  textControlBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  bgToggleBtn: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#334155',
  },
  bgToggleBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  alignToggleBtn: {
    width: 34,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  fontSizesGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fontSizeBtn: {
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  fontSizeBtnActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  fontSizeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  fontSizeBtnTextActive: {
    color: '#000000',
  },
  colorsScroll: {
    paddingVertical: 2,
  },
  colorDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    marginRight: 8,
    borderWidth: 2,
    borderColor: '#475569',
  },
  colorDotActive: {
    borderColor: '#FFFFFF',
    transform: [{ scale: 1.2 }],
  },
  dragHintText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 2,
  },
  drawerBottomDoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    marginTop: 4,
  },
  drawerCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#1E293B',
  },
  drawerCancelBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  drawerApplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ORANGE,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 10,
    gap: 6,
  },
  drawerApplyBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // ---------------- RATIO & CROP MENU ----------------
  ratioMenuContent: {
    paddingVertical: 6,
    gap: 10,
  },
  ratioScroll: {
    paddingVertical: 2,
  },
  ratioBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 8,
  },
  ratioBtnActive: {
    backgroundColor: ORANGE,
    borderColor: ORANGE,
  },
  ratioBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  ratioBtnTextActive: {
    color: '#FFFFFF',
  },
  cropTransformRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cropActionChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 6,
  },
  cropActionChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // ---------------- TOOLBAR ICONS ROW ----------------
  toolsRowContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    backgroundColor: '#090D16',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  toolIconBtn: {
    alignItems: 'center',
  },
  toolIconBtnActive: {},
  toolIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#131C2E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#243247',
  },
  toolIconCircleActive: {
    backgroundColor: 'rgba(255, 107, 0, 0.15)',
    borderColor: ORANGE,
    elevation: 4,
    shadowColor: ORANGE,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
  },
  toolIconLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  toolIconLabelActive: {
    color: ORANGE,
    fontWeight: '700',
  },

  // ---------------- BOTTOM THUMBNAILS & NEXT ----------------
  editorBottomActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: '#090D16',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  thumbsScroll: {
    flex: 1,
  },
  thumbCard: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    marginRight: 8,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#334155',
    position: 'relative',
  },
  thumbCardActive: {
    borderColor: ORANGE,
    borderWidth: 2.5,
  },
  // a 24 px touch area (inside the 44 px thumbnail, so it is not clipped) with a small round badge in its corner
  thumbDeleteBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 24,
    height: 24,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    padding: 2,
  },
  thumbDeleteDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMoreMediaThumbBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#334155',
    borderStyle: 'dashed',
  },
  nextStepBlueBtn: {
    backgroundColor: BLUE_BTN,
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingVertical: 10,
    marginLeft: 10,
    elevation: 3,
  },
  nextStepBlueBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  // ---------------- STEP 3: DETAILS ----------------
  scrollContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  detailsColumn: {
    width: '100%',
  },
  detailsColumnTablet: {
    maxWidth: 820,
  },
  publishBtn: {
    backgroundColor: ORANGE,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  publishBtnDisabled: {
    opacity: 0.6,
  },
  publishBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E293B',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORANGE,
  },
  avatarFallbackText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
  },
  authorMeta: {
    flex: 1,
  },
  authorSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  authorCraft: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  pageSelectorBox: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  pageSelectorHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  pageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  pageItemActive: {
    backgroundColor: '#33415580',
  },
  pageItemText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  pageItemTextActive: {
    color: ORANGE,
    fontWeight: '700',
  },
  captionRowWithMedia: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 12,
    minHeight: 120,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  textInputFlex: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    textAlignVertical: 'top',
  },
  sideMediaPreview: {
    width: 60,
    height: 75,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  taggedUsersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  taggedLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginRight: 4,
  },
  taggedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  taggedPillText: {
    fontSize: 12,
    color: ORANGE,
    fontWeight: '700',
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  pillsRow: {
    paddingVertical: 2,
  },
  craftPill: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  craftPillActive: {
    backgroundColor: ORANGE,
    borderColor: ORANGE,
  },
  craftPillText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '700',
  },
  craftPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  locationHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  locationLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  locationSuggestions: {
    marginTop: 8,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  currentLocationBtn: {
    backgroundColor: '#FF4B3320',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FF4B3350',
  },
  currentLocationBtnText: {
    color: ORANGE,
    fontWeight: '700',
    fontSize: 13,
  },
  locationSearchInput: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#FFFFFF',
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 8,
  },
  locationItem: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#334155',
  },
  locationItemText: {
    fontSize: 12,
    color: '#E2E8F0',
  },
  advancedOptionsBox: {
    marginTop: 8,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 12,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  toolbar: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    marginBottom: 30,
  },
  toolBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1E293B',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  toolBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ---------------- MODAL ----------------
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    maxHeight: '80%',
    borderTopWidth: 1,
    borderTopColor: '#334155',
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
  },
  resultsList: {
    maxHeight: 320,
  },
  userSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#1E293B',
  },
  userSearchAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    overflow: 'hidden',
  },
  userSearchFallback: {
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 40,
  },
  userSearchMeta: {
    flex: 1,
  },
  userSearchName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userSearchSub: {
    fontSize: 12,
    color: '#94A3B8',
  },
});

export default CreatePostScreen;
