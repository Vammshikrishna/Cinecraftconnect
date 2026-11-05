import { orTerm } from '@/lib/postgrest';
import {
    extractHashtags, buildMediaItems, mediaColumns, mediaSizeFields, checkPost, describePostError, normalizeCategory, isVideoMedia, isImageMedia,
    geocodeSearch, geocodeReverse,
    schedulePresets, checkSchedule, formatSchedule, toLocalInputValue, inviteCollaborators, COLLAB_MAX,
    firstUrl, fetchLinkPreview, searchGifs, GIF_CREDIT, type GifItem, type LinkPreview,
    emptyPollDraft, checkPollDraft, pollDraftInUse, attachPoll, POLL_DURATIONS, POLL_MAX_OPTIONS, POLL_OPTION_MAX, POLL_QUESTION_MAX, type PollDraft,
    POST_MEDIA_MAX, POST_VIDEO_MAX_SECONDS, POST_ALT_TEXT_MAX, POST_CAPTION_MAX, POST_CATEGORIES, POST_AUDIENCES, normalizeAudience,
} from '@cinecraft/core';
import { useBlockedUsers } from '@/hooks/useBlockedUsers';
import { LinkPreviewCard } from '@/components/feed/PostExtras';
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ImagePlus, X, ArrowLeft, Loader2, MapPin, User, UploadCloud, Video, Smile, Tag, Settings, ChevronRight, ChevronUp, Search, UserPlus, Check, BarChart3, CalendarClock, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { usePostMutation } from '@/hooks/mutations/usePostMutation';
import { MentionTextarea } from '@/components/ui/mention-textarea';
import { PostLivePreview } from '@/components/create/PostLivePreview';
import { JobShareCard } from '@/components/chat/JobShareCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useMyPages } from '@/hooks/useCompanyPages';
import { Input } from '@/components/ui/input';
import EmojiPicker, { Theme, EmojiStyle } from '@/components/common/LazyEmojiPicker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { queryClient } from '@/lib/queryClient';
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';
import { friendlyError, defaultRecipe, type PhotoRecipe } from '@cinecraft/core';
import { PhotoEditor } from '@/components/create/PhotoEditor';
import { VideoTrimmer } from '@/components/create/VideoTrimmer';
import { CameraCaptureDialog } from '@/components/create/CameraCaptureDialog';
import { processVideo, videoNeedsWork, canProcessVideo, readVideoInfo, type VideoEdit } from '@/lib/videoProcess';
import { loadBitmap, exportPhoto } from '@/lib/photoRender';
import { putPhoto, getPhoto, deletePhotos } from '@/lib/draftPhotos';
import { cn } from '@/lib/utils';
import { hasBlockedExtension } from '@/utils/fileValidation';

type Step = 'select' | 'preview' | 'details';

/** the shown size of a finished picture or video (from the file itself), so the post card has the right shape before anything loads */
const readBlobSize = (blob: Blob, type: 'image' | 'video'): Promise<{ width: number; height: number } | null> =>
    new Promise((resolve) => {
        const url = URL.createObjectURL(blob);
        const done = (v: { width: number; height: number } | null) => { URL.revokeObjectURL(url); resolve(v); };
        const timer = setTimeout(() => done(null), 8000);
        if (type === 'video') {
            const v = document.createElement('video');
            v.preload = 'metadata';
            v.muted = true;
            v.onloadedmetadata = () => { clearTimeout(timer); done(v.videoWidth > 0 ? { width: v.videoWidth, height: v.videoHeight } : null); };
            v.onerror = () => { clearTimeout(timer); done(null); };
            v.src = url;
        } else {
            const img = new Image();
            img.onload = () => { clearTimeout(timer); done(img.naturalWidth > 0 ? { width: img.naturalWidth, height: img.naturalHeight } : null); };
            img.onerror = () => { clearTimeout(timer); done(null); };
            img.src = url;
        }
    });

interface MediaItem {
    url: string;
    type: 'image' | 'video';
    /** a photo that is still on this device: it is edited here and uploaded once, when the post is shared */
    local?: boolean;
    /** a GIF (kept as it is, so it keeps moving) */
    passthrough?: boolean;
    /** identifies a local photo in the draft */
    key?: string;
    /** length of a video in seconds */
    duration?: number;
}

const newKey = () => `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export interface TaggedUser {
    id: string;
    username: string;
    full_name?: string;
    avatar_url?: string;
}

const POPULAR_LOCATIONS = [
    'Mumbai, India',
    'Los Angeles, CA',
    'New York, NY',
    'London, UK',
    'Hyderabad, India',
    'Bengaluru, India',
    'Toronto, ON',
    'Film City, Mumbai'
];

export interface TextOverlayItem {
    id: string;
    text: string;
    color: string;
    bgColor: string;
    fontSize: number;
    x: number;
    y: number;
}

export default function CreatePost() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const routeLocation = useLocation();
    // set when a job is shared to the feed: the job card is attached and the post opens at its details step
    const sharedJob: any = (routeLocation.state as any)?.sharedJob || null;
    const editPostId = searchParams.get('editPostId') || searchParams.get('edit');
    const { user } = useAuth();
    const { toast } = useToast();
    const { data: myPages } = useMyPages();
    const { createPost: createPostMutation } = usePostMutation();
    
    const [step, setStep] = useState<Step>('select');
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
    // new photos stay on this device while they are edited: the photo as picked, its edit settings, and the finished picture
    const [recipes, setRecipes] = useState<Record<string, PhotoRecipe>>({});
    const [videoEdits, setVideoEdits] = useState<Record<string, VideoEdit>>({}); // the part of each video to keep, and its sound
    const [videoProgress, setVideoProgress] = useState<number | null>(null);
    const sourcesRef = useRef<Map<string, Blob>>(new Map());
    const finalsRef = useRef<Map<string, { blob: Blob; sig: string; previewUrl: string }>>(new Map());
    const rawItemsRef = useRef<Map<string, any>>(new Map()); // a post being edited keeps what it was saved with
    const persistedKeys = useRef<Set<string>>(new Set());
    const [unreadable, setUnreadable] = useState<Set<string>>(new Set());
    const [isPreparing, setIsPreparing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [isLoadingEdit, setIsLoadingEdit] = useState(false);
    const [jobSharePart, setJobSharePart] = useState<string | null>(null);
    useEffect(() => {
        if (sharedJob && !editPostId) {
            setJobSharePart(JSON.stringify(sharedJob));
            setStep('details');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    
    // Details state
    const [caption, setCaption] = useState('');
    const [location, setLocation] = useState('');
    const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
    const [selectedPageId, setSelectedPageId] = useState<string | 'user'>('user');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Tag People states
    const [taggedUsers, setTaggedUsers] = useState<TaggedUser[]>([]);
    const [showTagDialog, setShowTagDialog] = useState(false);
    const [tagSearchQuery, setTagSearchQuery] = useState('');
    const [userSearchResults, setUserSearchResults] = useState<TaggedUser[]>([]);
    const [isSearchingUsers, setIsSearchingUsers] = useState(false);

    // User tag search effect
    useEffect(() => {
        if (!tagSearchQuery.trim()) {
            setUserSearchResults([]);
            return;
        }
        const searchProfiles = async () => {
            setIsSearchingUsers(true);
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('id, username, full_name, avatar_url')
                    .or(`username.ilike.%${orTerm(tagSearchQuery)}%,full_name.ilike.%${orTerm(tagSearchQuery)}%`)
                    .limit(10);
                if (!error && data) {
                    setUserSearchResults(data as TaggedUser[]);
                }
            } catch (err) {
                console.error('Error searching profiles:', err);
            } finally {
                setIsSearchingUsers(false);
            }
        };

        const timer = setTimeout(searchProfiles, 250);
        return () => clearTimeout(timer);
    }, [tagSearchQuery]);

    useEffect(() => {
        if (!editPostId || !user?.id) return;
        setIsLoadingEdit(true);
        const fetchPostForEdit = async () => {
            try {
                const { data: post, error } = await supabase
                    .from('posts')
                    .select('*')
                    .eq('id', editPostId)
                    .eq('author_id', user.id) // only the author can open a post in the editor
                    .maybeSingle();
                
                if (error) throw error;
                if (!post || (post as any).author_id !== user.id) {
                    toast({ title: 'Cannot edit this post', description: 'This post does not exist or is not yours.', variant: 'destructive' });
                    navigate('/create', { replace: true });
                    return;
                }
                if (post) {
                    let textContent = post.content || '';
                    if (textContent.includes('JOB_SHARE::')) {
                        const parts = textContent.split('JOB_SHARE::');
                        textContent = parts[0].trim();
                        setJobSharePart(parts[parts.length - 1]);
                    }
                    setCaption(textContent);

                    let items: MediaItem[] = [];
                    if (Array.isArray(post.media_items) && post.media_items.length > 0) {
                        items = post.media_items.map((m: any) => {
                            if (typeof m === 'string') {
                                const isVid = m.endsWith('.mp4') || m.endsWith('.webm') || m.includes('video');
                                return { url: m, type: (isVid ? 'video' : 'image') as 'image' | 'video' };
                            }
                            const isVid = m.type === 'video' || (m.url && (m.url.endsWith('.mp4') || m.url.includes('video')));
                            return {
                                url: m.url || m.media_url,
                                type: (isVid ? 'video' : 'image') as 'image' | 'video'
                            };
                        });
                    } else if (post.media_url) {
                        const isVid = post.media_type === 'video' || (typeof post.media_url === 'string' && post.media_url.includes('video'));
                        items = [{ url: post.media_url, type: (isVid ? 'video' : 'image') as 'image' | 'video' }];
                    }
                    items = items.filter((i) => !!i.url);
                    setMediaItems(items);
                    if ((post as any).category) setCategory((post as any).category);
                    setAudience(normalizeAudience((post as any).audience));
                    if ((post as any).link_preview) { setLinkPreview((post as any).link_preview); setDismissedLink((post as any).link_preview.url); }
                    const altMap: Record<string, string> = {};
                    if (Array.isArray(post.media_items)) {
                        (post.media_items as any[]).forEach((m) => { if (m && typeof m === 'object' && m.url && m.alt) altMap[m.url] = String(m.alt); });
                    }
                    setAltTexts(altMap);
                    rawItemsRef.current = new Map();
                    if (Array.isArray(post.media_items)) {
                        (post.media_items as any[]).forEach((m) => { if (m && typeof m === 'object' && m.url) rawItemsRef.current.set(m.url, m); });
                    }

                    const firstItem: any = Array.isArray(post.media_items) && post.media_items.length > 0 ? post.media_items[0] : {};
                    const postLoc = firstItem?.location || (post as any).location;
                    const postTags = firstItem?.tagged_users || (post as any).tagged_users;

                    if (firstItem?.comments_disabled !== undefined) {
                        setCommentingOff(!!firstItem.comments_disabled);
                    }
                    if (firstItem?.hide_likes !== undefined) {
                        setHideLikes(!!firstItem.hide_likes);
                    }
                    if (postLoc) {
                        setLocation(postLoc);
                    }
                    if (Array.isArray(postTags)) {
                        setTaggedUsers(postTags);
                    }
                    if (post.page_id) {
                        setSelectedPageId(post.page_id);
                    }

                    // Jump directly to details mode for editing existing post like Instagram
                    setStep('details');
                }
            } catch (err: any) {
                console.error('Error fetching post for edit:', err);
                toast({
                    title: 'Error loading post',
                    description: friendlyError(err, 'Could not load post details for editing.'),
                    variant: 'destructive',
                });
            } finally {
                setIsLoadingEdit(false);
            }
        };

        fetchPostForEdit();
    }, [editPostId, user?.id]);
    
    // UI states
    const [activeIndex, setActiveIndex] = useState(0);
    const [expandedSection, setExpandedSection] = useState<'adv' | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    
    // Advanced Settings states
    const [commentingOff, setCommentingOff] = useState(false);
    const [hideLikes, setHideLikes] = useState(false);
    const [category, setCategory] = useState<string>('General');
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

    // people to credit: search by name or @username, never yourself or people you blocked
    useEffect(() => {
        if (!collabQuery.trim()) { setCollabResults([]); return; }
        const t = window.setTimeout(async () => {
            const { data } = await supabase
                .from('profiles')
                .select('id, username, full_name, avatar_url')
                .or(`username.ilike.%${orTerm(collabQuery)}%,full_name.ilike.%${orTerm(collabQuery)}%`)
                .limit(8);
            setCollabResults(((data || []) as TaggedUser[]).filter((u) => u.id !== user?.id && !isBlocked(u.id) && !collabs.some((c) => c.id === u.id)));
        }, 250);
        return () => window.clearTimeout(t);
    }, [collabQuery, collabs]); // eslint-disable-line react-hooks/exhaustive-deps

    // a card for the first link in the caption (fetched by the server; you can remove it)
    useEffect(() => {
        const url = firstUrl(caption);
        if (!url) { setLinkPreview(null); return; }
        if (linkPreview?.url === url || dismissedLink === url) return;
        let cancelled = false;
        const t = window.setTimeout(async () => {
            const preview = await fetchLinkPreview(supabase, url);
            if (!cancelled) setLinkPreview(preview);
        }, 700);
        return () => { cancelled = true; window.clearTimeout(t); };
    }, [caption]); // eslint-disable-line react-hooks/exhaustive-deps

    // GIF search (empty box = trending)
    useEffect(() => {
        if (!gifOpen) return;
        let cancelled = false;
        setGifState('loading');
        const t = window.setTimeout(async () => {
            const res = await searchGifs(supabase, gifQuery);
            if (cancelled) return;
            if (res.ok) { setGifs(res.items); setGifState('idle'); }
            else { setGifs([]); setGifState((res as any).reason === 'not_configured' ? 'off' : 'error'); }
        }, 350);
        return () => { cancelled = true; window.clearTimeout(t); };
    }, [gifOpen, gifQuery]);

    const addGif = (g: GifItem) => {
        if (mediaItems.length >= POST_MEDIA_MAX) {
            toast({ title: 'Limit reached', description: `You can add up to ${POST_MEDIA_MAX} photos, videos or GIFs.`, variant: 'destructive' });
            return;
        }
        setMediaItems((prev) => [...prev, { url: g.url, type: 'image' }]);
        setAltTexts((prev) => ({ ...prev, [g.url]: g.title }));
        setGifOpen(false);
        if (step === 'select') setStep('preview');
    };
    const captionRef = useRef<HTMLTextAreaElement>(null);
    const [altTexts, setAltTexts] = useState<Record<string, string>>({});
    const [uploadStatus, setUploadStatus] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const shared = useRef(false);
    const { isBlocked } = useBlockedUsers();

    // ── draft: caption, media and options are kept on this device until the post is shared or discarded ──
    const draftKey = `create_post_draft_${user?.id}`;
    const [pendingDraft, setPendingDraft] = useState<any | null>(null);
    const draftPhotoKeys = (): string[] => {
        try {
            const d = JSON.parse(localStorage.getItem(draftKey) || 'null');
            return (d?.mediaItems || []).filter((i: any) => i?.local && i.key).map((i: any) => i.key);
        } catch { return []; }
    };
    const clearDraft = () => {
        deletePhotos(draftPhotoKeys());
        try { localStorage.removeItem(draftKey); } catch { /* storage unavailable */ }
        setPendingDraft(null);
    };
    useEffect(() => {
        if (!user || editPostId) return;
        try {
            const rawDraft = localStorage.getItem(draftKey);
            if (rawDraft) {
                const d = JSON.parse(rawDraft);
                if (d && (d.caption || (Array.isArray(d.mediaItems) && d.mediaItems.length))) setPendingDraft(d);
            }
        } catch { /* ignore a corrupt draft */ }
    }, [user?.id, editPostId]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (!user || editPostId || pendingDraft || shared.current) return;
        if (!caption && mediaItems.length === 0) return;
        const t = window.setTimeout(async () => {
            try {
                const saved: any[] = [];
                const recipesByKey: Record<string, PhotoRecipe> = {};
                const videoEditsByKey: Record<string, VideoEdit> = {};
                const altsOut: Record<string, string> = {};
                for (const m of mediaItems) {
                    if (m.local && m.key) {
                        const src = sourcesRef.current.get(m.url);
                        if (m.type === 'video' && src && src.size > 150 * 1024 * 1024) continue; // too big to keep in a draft
                        if (!persistedKeys.current.has(m.key)) {
                            if (src) { await putPhoto(m.key, src); persistedKeys.current.add(m.key); }
                        }
                        saved.push({ key: m.key, type: m.type, local: true, passthrough: !!m.passthrough, duration: m.duration });
                        if (recipes[m.url]) recipesByKey[m.key] = recipes[m.url];
                        if (videoEdits[m.url]) videoEditsByKey[m.key] = videoEdits[m.url];
                        if (altTexts[m.url]) altsOut['k:' + m.key] = altTexts[m.url];
                    } else {
                        saved.push({ url: m.url, type: m.type });
                        if (altTexts[m.url]) altsOut[m.url] = altTexts[m.url];
                    }
                }
                localStorage.setItem(draftKey, JSON.stringify({ caption, location, taggedUsers, category, audience, commentingOff, hideLikes, mediaItems: saved, recipes: recipesByKey, videoEdits: videoEditsByKey, altTexts: altsOut, savedAt: Date.now() }));
            } catch { /* storage full or unavailable: the draft is a convenience */ }
        }, 800);
        return () => window.clearTimeout(t);
    }, [caption, location, taggedUsers, category, audience, commentingOff, hideLikes, mediaItems, altTexts, recipes, videoEdits, pendingDraft]); // eslint-disable-line react-hooks/exhaustive-deps
    const restoreDraft = async () => {
        const d = pendingDraft;
        if (!d) return;
        setCaption(d.caption || '');
        setLocation(d.location || '');
        setTaggedUsers(Array.isArray(d.taggedUsers) ? d.taggedUsers : []);
        setCategory(d.category || 'General');
        setAudience(normalizeAudience(d.audience));
        setCommentingOff(!!d.commentingOff);
        setHideLikes(!!d.hideLikes);
        // photos come back from this device, with the edits they had
        const items: MediaItem[] = [];
        const nextAlts: Record<string, string> = {};
        const nextRecipes: Record<string, PhotoRecipe> = {};
        const nextVideoEdits: Record<string, VideoEdit> = {};
        for (const m of Array.isArray(d.mediaItems) ? d.mediaItems : []) {
            if (m.local && m.key) {
                const blob = await getPhoto(m.key);
                if (!blob) continue; // the stored picture is gone (storage was cleared): it cannot be restored
                const url = URL.createObjectURL(blob);
                sourcesRef.current.set(url, m.type === 'video' ? new File([blob], 'video', { type: blob.type }) : blob);
                persistedKeys.current.add(m.key);
                items.push({ url, type: m.type, local: true, passthrough: !!m.passthrough, key: m.key, duration: m.duration });
                if (d.recipes?.[m.key]) nextRecipes[url] = d.recipes[m.key];
                if (d.videoEdits?.[m.key]) nextVideoEdits[url] = d.videoEdits[m.key];
                if (d.altTexts?.['k:' + m.key]) nextAlts[url] = d.altTexts['k:' + m.key];
            } else if (m.url) {
                items.push({ url: m.url, type: m.type });
                if (d.altTexts?.[m.url]) nextAlts[m.url] = d.altTexts[m.url];
            }
        }
        setAltTexts(nextAlts);
        setRecipes(nextRecipes);
        setVideoEdits(nextVideoEdits);
        setMediaItems(items);
        setPendingDraft(null);
        setStep(items.length > 0 ? 'preview' : 'details');
    };
    const discardDraft = () => {
        // remove what was kept for the discarded draft: pictures on this device, and files from older drafts
        const paths = (pendingDraft?.mediaItems || [])
            .map((i: any) => String(i?.url || '').split('/portfolios/')[1])
            .filter(Boolean)
            .map((x: string) => decodeURIComponent(x.split('?')[0]));
        if (paths.length > 0) supabase.storage.from('portfolios').remove(paths).catch(() => { });
        clearDraft();
    };

    // do not close the tab in the middle of an upload or while posting
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (isUploading || isSubmitting) { e.preventDefault(); e.returnValue = ''; }
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [isUploading, isSubmitting]);

    const onDropFiles = (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        if (isUploading) return;
        const dropped = Array.from(e.dataTransfer.files || []);
        const usable = dropped.filter((f) => isImageMedia(f.name, f.type) || isVideoMedia(f.name, f.type));
        if (usable.length === 0) {
            toast({ title: 'Unsupported file', description: 'Drop photos or videos.', variant: 'destructive' });
            return;
        }
        if (usable.length < dropped.length) toast({ title: 'Some files were skipped', description: 'Only photos and videos can be added.' });
        uploadFiles(usable);
    };
    
    const [detailsActiveIndex, setDetailsActiveIndex] = useState(0);
    // Realtime Location Search & GPS states
    const [isFetchingLocation, setIsFetchingLocation] = useState(false);
    const [realtimeLocations, setRealtimeLocations] = useState<string[]>([]);
    const [isSearchingLocation, setIsSearchingLocation] = useState(false);

    const handleGetCurrentLocation = () => {
        if (!navigator.geolocation) {
            toast({ title: 'Location Error', description: 'Geolocation is not supported by your browser.', variant: 'destructive' });
            return;
        }
        setIsFetchingLocation(true);
        navigator.geolocation.getCurrentPosition(
            async (pos) => {
                try {
                    const data = await geocodeReverse(supabase, pos.coords.latitude, pos.coords.longitude);
                    if (data && data.address) {
                        const city = data.address.city || data.address.town || data.address.village || data.address.suburb || data.address.state || '';
                        const country = data.address.country || '';
                        const place = [city, country].filter(Boolean).join(', ') || data.display_name;
                        if (place) {
                            setLocation(place);
                            setShowLocationSuggestions(false);
                            toast({ title: 'Current Location 📍', description: place });
                        }
                    }
                } catch (err) {
                    toast({ title: 'Location Error', description: 'Could not fetch location details.', variant: 'destructive' });
                } finally {
                    setIsFetchingLocation(false);
                }
            },
            () => {
                setIsFetchingLocation(false);
                toast({ title: 'Location Denied', description: 'GPS access denied. You can type location manually.', variant: 'destructive' });
            }
        );
    };

    useEffect(() => {
        if (!location.trim() || location.length < 2) {
            setRealtimeLocations([]);
            return;
        }
        const timer = setTimeout(async () => {
            setIsSearchingLocation(true);
            try {
                const data = await geocodeSearch(supabase, location);
                if (Array.isArray(data)) {
                    const parsed = data.map((item: any) => {
                        const addr = item.address || {};
                        const name = item.name || addr.city || addr.town || addr.village || item.display_name.split(',')[0];
                        const country = addr.country || '';
                        return [name, country].filter(Boolean).join(', ');
                    }).filter(Boolean);
                    setRealtimeLocations(Array.from(new Set(parsed)));
                }
            } catch (err) {
                console.error('Error searching realtime location:', err);
            } finally {
                setIsSearchingLocation(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [location]);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const photoCaptureRef = useRef<HTMLInputElement>(null);
    const videoCaptureRef = useRef<HTMLInputElement>(null);
    const [cameraMode, setCameraMode] = useState<'photo' | 'video' | null>(null);
    // phones and tablets hand the job to the camera app (a file input with `capture`); computers get a recorder in the page
    const openCamera = (m: 'photo' | 'video') => {
        const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
        if (touch) (m === 'photo' ? photoCaptureRef : videoCaptureRef).current?.click();
        else setCameraMode(m);
    };

    const uploadFiles = async (files: FileList | File[]) => {
        if (!user) return;
        const list = Array.from(files);
        if (list.length === 0) return;
        if (mediaItems.length + list.length > POST_MEDIA_MAX) {
            toast({
                title: 'Limit exceeded',
                description: `You can add up to ${POST_MEDIA_MAX} photos or videos to a post.`,
                variant: 'destructive',
            });
            return;
        }

        setIsUploading(true);
        const newItems: MediaItem[] = [];
        const failed: string[] = [];

        // one file at a time; a problem with one file never throws away the files that were already added
        for (let i = 0; i < list.length; i++) {
            const file = list[i];
            try {
                if (hasBlockedExtension(file.name)) { failed.push(`${file.name} (this file type is not allowed)`); continue; }
                const isVideo = isVideoMedia(file.name, file.type);
                const isImage = isImageMedia(file.name, file.type);
                if (!isVideo && !isImage) { failed.push(`${file.name} (not a photo or video)`); continue; }

                if (isImage) {
                    if (file.size > 40 * 1024 * 1024) { failed.push(`${file.name} (bigger than 40 MB)`); continue; }
                    // the photo stays here, at full size, while it is edited; it is uploaded once, when the post is shared
                    const url = URL.createObjectURL(file);
                    sourcesRef.current.set(url, file);
                    newItems.push({ url, type: 'image', local: true, passthrough: file.type === 'image/gif', key: newKey() });
                    continue;
                }

                // a video stays here too: it is cut and shrunk when you tap Next, and uploaded once when the post is shared
                let info: { duration: number };
                try { info = await readVideoInfo(file); } catch { failed.push(`${file.name} (this video cannot be read)`); continue; }
                if (info.duration > POST_VIDEO_MAX_SECONDS) {
                    failed.push(`${file.name} (longer than 3:59, please trim it first)`);
                    continue;
                }
                const vurl = URL.createObjectURL(file);
                sourcesRef.current.set(vurl, file);
                newItems.push({ url: vurl, type: 'video', local: true, key: newKey(), duration: info.duration });
            } catch (error: any) {
                console.error('Add file error:', error);
                failed.push(`${file.name} (${error?.message || 'could not be added'})`);
            }
        }

        if (newItems.length > 0) {
            setMediaItems(prev => [...prev, ...newItems]);
            setStep('preview');
        }
        if (failed.length > 0) {
            toast({
                title: failed.length === list.length ? 'Could not add' : `${failed.length} file${failed.length > 1 ? 's' : ''} could not be added`,
                description: failed.slice(0, 3).join('; '),
                variant: 'destructive',
            });
        }
        setIsUploading(false);
        setUploadStatus('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeMedia = (idx: number) => {
        const item = mediaItems[idx];
        if (!item) return;
        if (item.local) {
            URL.revokeObjectURL(item.url);
            const fin = finalsRef.current.get(item.url);
            if (fin) URL.revokeObjectURL(fin.previewUrl);
            finalsRef.current.delete(item.url);
            sourcesRef.current.delete(item.url);
            if (item.key) { persistedKeys.current.delete(item.key); deletePhotos([item.key]); }
        }
        setRecipes((prev) => { const n = { ...prev }; delete n[item.url]; return n; });
        setVideoEdits((prev) => { const n = { ...prev }; delete n[item.url]; return n; });
        const remaining = mediaItems.filter((_, i) => i !== idx);
        setMediaItems(remaining);
        setActiveIndex((a) => Math.max(0, Math.min(a >= idx ? a - 1 : a, remaining.length - 1)));
        if (remaining.length === 0) setStep('select');
    };

    /** finishes every new photo (turn, crop, colour, text, resize) so it is ready to preview and upload; false if something failed */
    const prepareMedia = async (): Promise<boolean> => {
        setIsPreparing(true);
        try {
            for (const item of mediaItems) {
                if (!item.local) continue;
                const src = sourcesRef.current.get(item.url);
                if (!src) continue;

                if (item.type === 'video') {
                    const edit = videoEdits[item.url];
                    const sig = `${JSON.stringify(edit || null)}:${src.size}`;
                    const have = finalsRef.current.get(item.url);
                    if (have && have.sig === sig) continue;
                    if (have) URL.revokeObjectURL(have.previewUrl);
                    let blob: Blob = src;
                    if (videoNeedsWork(src as File, edit)) {
                        const trimmed = !!edit && (edit.mute || edit.start > 0.1 || edit.end < edit.duration - 0.1);
                        if (!canProcessVideo()) {
                            if (trimmed) throw new Error('This browser cannot cut videos. Remove the trim, or use Chrome or Edge.');
                        } else {
                            const info = edit ? null : await readVideoInfo(src as File);
                            const use: VideoEdit = edit || { start: 0, end: info!.duration, duration: info!.duration, mute: false };
                            setVideoProgress(0);
                            blob = await processVideo(src as File, use, { onProgress: (p) => setVideoProgress(p) });
                        }
                    }
                    finalsRef.current.set(item.url, { blob, sig, previewUrl: URL.createObjectURL(blob) });
                    continue;
                }

                if (item.type !== 'image') continue;
                const recipe = recipes[item.url] || defaultRecipe();
                const sig = JSON.stringify(recipe);
                const have = finalsRef.current.get(item.url);
                if (have && have.sig === sig) continue;
                if (have) URL.revokeObjectURL(have.previewUrl);
                let blob: Blob = src;
                if (!item.passthrough && !unreadable.has(item.url)) {
                    try {
                        const bmp = await loadBitmap(src);
                        blob = (await exportPhoto(bmp, recipe)).blob;
                        bmp.close?.();
                    } catch (err) {
                        console.warn('Could not finish a photo, posting it as it is:', err);
                        blob = src;
                    }
                }
                finalsRef.current.set(item.url, { blob, sig, previewUrl: URL.createObjectURL(blob) });
            }
            return true;
        } catch (err: any) {
            toast({ title: 'Could not prepare your media', description: friendlyError(err, 'Please try again.'), variant: 'destructive' });
            return false;
        } finally {
            setIsPreparing(false);
            setVideoProgress(null);
        }
    };

    const handleShare = async () => {
        const pollInUse = !editPostId && pollDraftInUse(poll);
        const check = checkPost({ caption, mediaCount: mediaItems.length, busy: isUploading, hasPoll: pollInUse || (!editPostId && !!jobSharePart) });
        if (!check.ok) {
            toast({ title: 'Cannot post yet', description: check.message, variant: 'destructive' });
            return;
        }
        if (pollInUse) {
            const pc = checkPollDraft(poll!);
            if (!pc.ok) { toast({ title: 'Check your poll', description: pc.message, variant: 'destructive' }); return; }
            if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                toast({ title: 'Polls need a connection', description: 'Connect to the internet to post a poll, or remove the poll to save the post offline.', variant: 'destructive' });
                return;
            }
        }
        if (!editPostId && scheduleOn) {
            const sc = checkSchedule(scheduleAt);
            if (!sc.ok) { toast({ title: 'Check the schedule', description: sc.message, variant: 'destructive' }); return; }
        }
        if (!editPostId && (scheduleOn || collabs.length > 0) && typeof navigator !== 'undefined' && navigator.onLine === false) {
            toast({ title: 'You are offline', description: 'Scheduling and collaborators need a connection. Connect, or remove them to save the post offline.', variant: 'destructive' });
            return;
        }
        if (isSubmitting) return;
        setIsSubmitting(true);
        const uploadedPaths: string[] = [];
        try {
            const tags = extractHashtags(caption);

            // new photos: finish them, then upload only the finished pictures (the photo as picked never leaves this device)
            if (mediaItems.some((i) => i.local)) {
                if (typeof navigator !== 'undefined' && navigator.onLine === false) {
                    toast({ title: 'You are offline', description: 'Photos are uploaded when you share. Your draft is saved on this device; connect and try again.', variant: 'destructive' });
                    return;
                }
                if (!(await prepareMedia())) return;
            }
            const localTotal = mediaItems.filter((i) => i.local).length;
            let uploadedCount = 0;
            const processed: any[] = [];
            for (const item of mediaItems) {
                let finalUrl = item.url;
                let size: { width: number; height: number } | null = null;
                if (item.local && (item.type === 'image' || item.type === 'video')) {
                    const fin = finalsRef.current.get(item.url);
                    if (!fin) throw new Error('A photo is not ready yet. Please try again.');
                    size = await readBlobSize(fin.blob, item.type).catch(() => null);
                    uploadedCount++;
                    setUploadStatus(localTotal > 1 ? `Uploading ${uploadedCount} of ${localTotal}…` : 'Uploading…');
                    const ext = fin.blob.type === 'image/jpeg' ? 'jpg' : fin.blob.type === 'image/png' ? 'png' : fin.blob.type === 'image/gif' ? 'gif' : fin.blob.type === 'video/mp4' ? 'mp4' : fin.blob.type.startsWith('video/') ? 'webm' : 'webp';
                    const path = `posts/${user!.id}/${Date.now()}_${uploadedCount}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
                    const { error: upErr } = await supabase.storage.from('portfolios').upload(path, fin.blob, { cacheControl: '31536000', contentType: fin.blob.type || undefined });
                    if (upErr) throw upErr;
                    uploadedPaths.push(path);
                    finalUrl = supabase.storage.from('portfolios').getPublicUrl(path).data.publicUrl;
                }
                const alt = (altTexts[item.url] || '').trim().slice(0, POST_ALT_TEXT_MAX);
                // a post being edited keeps whatever it was saved with (nothing is replaced by defaults)
                const raw = editPostId ? rawItemsRef.current.get(item.url) : null;
                const base = raw ? { ...raw } : {};
                delete (base as any).alt;
                processed.push({ ...base, ...(size ? mediaSizeFields(size.width, size.height) : {}), url: finalUrl, type: item.type, ...(alt ? { alt } : {}) });
            }

            // details (place, tagged people, comment/like switches) ride on the first item; a text post gets a details-only item, never a fake image
            const items = buildMediaItems(processed as any[], {
                location,
                tagged_users: taggedUsers,
                comments_disabled: commentingOff,
                hide_likes: hideLikes,
            });
            const columns = mediaColumns(processed as any[]);

            let finalContent = caption.trim();
            if (jobSharePart) {
                finalContent = finalContent ? `${finalContent}\n\nJOB_SHARE::${jobSharePart}` : `JOB_SHARE::${jobSharePart}`;
            }
            const pageId = selectedPageId === 'user' ? null : selectedPageId;
            const previewToSave = linkPreview && caption.includes(linkPreview.url) ? linkPreview : null;
            const scheduledIso = !editPostId && scheduleOn && scheduleAt ? scheduleAt.toISOString() : null;
            const categoryValue = normalizeCategory(category);

            if (editPostId) {
                const { error } = await supabase
                    .from('posts')
                    .update({
                        content: finalContent,
                        media_items: items,
                        ...columns,
                        tags,
                        category: categoryValue,
                        audience: normalizeAudience(audience),
                        link_preview: previewToSave,
                        page_id: pageId, // choosing "Personal Profile" really switches back
                        updated_at: new Date().toISOString(),
                    } as any)
                    .eq('id', editPostId)
                    .eq('author_id', user!.id);
                if (error) throw error;
                toast({ title: 'Updated', description: 'Your post was updated.' });
            } else {
                const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
                const queueIt = async () => {
                    await createPostMutation(finalContent, { mediaItems: items, tags, pageId, category: categoryValue, audience: normalizeAudience(audience) } as any);
                    toast({ title: 'Saved on this device', description: 'You are offline. Your post will be published automatically when you are back online.' });
                };
                if (offline) {
                    await queueIt();
                } else {
                    // publish now, so a refusal (limit, permission, rate limit) is shown here instead of vanishing later
                    const { data: created, error } = await supabase
                        .from('posts')
                        .insert({
                            author_id: user!.id,
                            content: finalContent,
                            page_id: pageId,
                            ...columns,
                            media_items: items,
                            tags,
                            category: categoryValue,
                            audience: normalizeAudience(audience),
                            link_preview: previewToSave,
                            scheduled_at: scheduledIso,
                        } as any)
                        .select('id')
                        .single();
                    if (error) {
                        if (/failed to fetch|network|load failed/i.test(error.message || '') && !pollInUse) await queueIt();
                        else throw error;
                    } else {
                        if (pollInUse && created?.id) {
                            try {
                                await attachPoll(supabase, created.id, poll!);
                            } catch (pollErr: any) {
                                await supabase.from('posts').delete().eq('id', created.id); // do not leave a post without the poll the author asked for
                                throw new Error(`Your post was not published because the poll could not be added: ${pollErr?.message || 'please try again'}`);
                            }
                        }
                        if (collabs.length > 0 && created?.id) {
                            try {
                                await inviteCollaborators(supabase, created.id, collabs.map((c) => c.id));
                            } catch (collabErr: any) {
                                toast({ title: 'Posted, but the invitations were not sent', description: collabErr?.message, variant: 'destructive' });
                            }
                        }
                        toast(scheduledIso
                            ? { title: 'Scheduled', description: `Your post will go live ${formatSchedule(scheduledIso)}.` }
                            : { title: 'Posted', description: 'Your post is live.' });
                    }
                }
            }

            shared.current = true;
            clearDraft();
            if (user?.id) {
                queryClient.invalidateQueries({ queryKey: ['home-feed-posts', user.id] });
            }
            queryClient.invalidateQueries({ queryKey: ['home-feed-posts'] });
            queryClient.invalidateQueries({ queryKey: ['home-feed-static'] });
            navigate('/feed');
        } catch (error: any) {
            console.error('Error saving post:', error);
            // pictures uploaded for a post that was not saved are removed again
            if (uploadedPaths.length > 0) supabase.storage.from('portfolios').remove(uploadedPaths).catch(() => { });
            toast({ title: 'Could not post', description: describePostError(error), variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
            setUploadStatus('');
        }
    };

    if (isLoadingEdit) {
        return (
            <div className="min-h-dvh bg-background pt-[68px] md:pt-24 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm font-medium text-muted-foreground">Loading post details...</p>
                </div>
            </div>
        );
    }

    return (
        <>
        <div className={`min-h-dvh flex flex-col items-center justify-center px-0 md:px-4 bg-background pt-[68px] md:pt-24 pb-12`}>
            <div className={`w-full md:max-w-6xl lg:max-w-7xl md:border md:border-border/50 md:rounded-2xl overflow-hidden md:shadow-2xl flex flex-col md:h-[88vh] h-auto min-h-[calc(100vh-68px)] md:min-h-[550px] bg-card`}>
                
                {/* Header */}
                {(
                    <div className="h-14 border-b border-border/50 flex items-center justify-between px-4 shrink-0 bg-background/50 backdrop-blur-sm z-10">
                    <Button aria-label="Back" variant="ghost" size="icon" onClick={() => {
                        if (step === 'details' && !editPostId) {
                            setActiveIndex(detailsActiveIndex);
                            setStep(mediaItems.length > 0 ? 'preview' : 'select');
                        }
                        else if (step === 'preview' && !editPostId) setStep('select');
                        else navigate(-1);
                    }}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h2 className="text-sm font-bold tracking-tight">
                        {editPostId ? (step === 'details' ? 'Edit info' : 'Edit post') : (
                            step === 'select' ? 'Create new post' :
                            step === 'preview' ? 'Edit' : 'New post details'
                        )}
                    </h2>
                    <div>
                        {step === 'preview' && (
                            <Button
                                variant="ghost"
                                className="text-primary font-bold hover:text-primary/80"
                                disabled={isPreparing || isUploading || mediaItems.length === 0}
                                onClick={async () => {
                                    if (!(await prepareMedia())) return;
                                    setDetailsActiveIndex(Math.min(activeIndex, Math.max(0, mediaItems.length - 1)));
                                    setStep('details');
                                }}
                            >
                                {isPreparing ? (videoProgress !== null ? <span className="tabular-nums">{Math.round(videoProgress * 100)}%</span> : <Loader2 className="h-4 w-4 animate-spin" />) : 'Next'}
                            </Button>
                        )}
                        {step === 'details' && (
                            <Button variant="ghost" className="text-primary font-bold hover:text-primary/80" onClick={handleShare} disabled={isSubmitting || isUploading || (!caption.trim() && mediaItems.length === 0 && !(!editPostId && (pollDraftInUse(poll) || !!jobSharePart)))}>
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (editPostId ? 'Done' : 'Share')}
                            </Button>
                        )}
                        {step === 'select' && <div className="w-10" />}
                    </div>
                    </div>
                )}

                {/* Body */}
                <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden bg-zinc-950/20">
                    
                    {/* Step 1: Select */}
                    {step === 'select' && (
                        <div
                            className={`flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-300 transition-colors ${dragOver ? 'bg-primary/10' : ''}`}
                            onDragOver={(e) => { e.preventDefault(); if (!isUploading) setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={onDropFiles}
                        >
                            {pendingDraft && (
                                <div className="w-full max-w-md mb-8 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-left" role="region" aria-label="Saved draft">
                                    <p className="font-semibold text-sm">Continue your draft?</p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        You started a post{pendingDraft.savedAt ? ` on ${new Date(pendingDraft.savedAt).toLocaleString()}` : ''}
                                        {Array.isArray(pendingDraft.mediaItems) && pendingDraft.mediaItems.length > 0 ? ` with ${pendingDraft.mediaItems.length} photo${pendingDraft.mediaItems.length > 1 ? 's' : ''}/videos` : ''}.
                                    </p>
                                    <div className="flex gap-2 mt-3">
                                        <Button size="sm" onClick={restoreDraft}>Continue</Button>
                                        <Button size="sm" variant="ghost" onClick={discardDraft}>Discard</Button>
                                    </div>
                                </div>
                            )}
                            <UploadCloud className="h-20 w-20 text-muted-foreground mb-6 opacity-80" aria-hidden="true" />
                            <h3 className="text-xl font-medium mb-1">Choose photos and videos</h3>
                            <p className="text-sm text-muted-foreground mb-4">Up to {POST_MEDIA_MAX} items. Videos up to 3:59.</p>
                            <Button size="lg" className="rounded-full px-8 font-semibold" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                                {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {uploadStatus || 'Uploading...'}</> : 'Select from device'}
                            </Button>
                            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                                <Button type="button" variant="outline" className="rounded-full" onClick={() => openCamera('photo')} disabled={isUploading}>
                                    <ImagePlus className="mr-2 h-4 w-4" aria-hidden="true" /> Take photo
                                </Button>
                                <Button type="button" variant="outline" className="rounded-full" onClick={() => openCamera('video')} disabled={isUploading}>
                                    <Video className="mr-2 h-4 w-4" aria-hidden="true" /> Record video
                                </Button>
                            </div>
                            <button
                                type="button"
                                onClick={() => setStep('details')}
                                disabled={isUploading}
                                className="mt-4 text-sm font-semibold text-primary hover:underline underline-offset-4 min-h-[44px]"
                            >
                                or write a text post or poll
                            </button>
                        </div>
                    )}


                    {/* Step 2: edit the photo (it stays on this device until the post is shared) */}
                    {step === 'preview' && (() => {
                        const active = mediaItems[Math.min(activeIndex, Math.max(0, mediaItems.length - 1))];
                        const canEdit = !!active && active.type === 'image' && !!active.local && !active.passthrough && !unreadable.has(active.url) && sourcesRef.current.has(active.url);
                        return (
                            <div className="flex-1 min-h-0 flex flex-col animate-in fade-in duration-300">
                                <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 overflow-x-auto no-scrollbar shrink-0" role="list" aria-label="Photos and videos in this post">
                                    {mediaItems.map((m, i) => (
                                        <div key={m.url} role="listitem" className="relative shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => setActiveIndex(i)}
                                                aria-label={`Item ${i + 1} of ${mediaItems.length}`}
                                                aria-pressed={i === activeIndex}
                                                className={cn('block h-14 w-14 rounded-lg overflow-hidden bg-muted transition-[box-shadow]', i === activeIndex && 'ring-2 ring-primary ring-offset-2 ring-offset-background')}
                                            >
                                                {m.type === 'video'
                                                    ? <video src={m.url} className="h-full w-full object-cover" muted />
                                                    : <img src={finalsRef.current.get(m.url)?.previewUrl || m.url} alt="" className="h-full w-full object-cover" />}
                                            </button>
                                            <button
                                                type="button"
                                                aria-label={`Remove item ${i + 1}`}
                                                onClick={() => removeMedia(i)}
                                                className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-background border border-border shadow grid place-items-center text-muted-foreground hover:text-foreground before:absolute before:-inset-2 before:content-['']"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ))}
                                    {mediaItems.length < POST_MEDIA_MAX && (
                                        <button
                                            type="button"
                                            aria-label="Add more photos or videos"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={isUploading}
                                            className="h-14 w-14 shrink-0 rounded-lg border border-dashed border-border grid place-items-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                                        >
                                            {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                                        </button>
                                    )}
                                </div>

                                {!active ? null : active.type === 'video' && active.local ? (
                                    <VideoTrimmer
                                        key={active.url}
                                        src={active.url}
                                        edit={videoEdits[active.url]}
                                        duration={active.duration || 0}
                                        onChange={(e) => setVideoEdits((prev) => ({ ...prev, [active.url]: e }))}
                                    />
                                ) : canEdit ? (
                                    <PhotoEditor
                                        key={active.url}
                                        source={sourcesRef.current.get(active.url)!}
                                        recipe={recipes[active.url] || defaultRecipe()}
                                        onChange={(r) => setRecipes((prev) => ({ ...prev, [active.url]: r }))}
                                        onUnreadable={() => setUnreadable((prev) => new Set(prev).add(active.url))}
                                    />
                                ) : (
                                    <div className="flex-1 min-h-0 grid place-items-center p-6 bg-black/40">
                                        <div className="max-w-md w-full flex flex-col items-center gap-3 text-center">
                                            {active.type === 'video'
                                                ? <video src={active.url} className="w-full max-h-[60vh] rounded-lg bg-black" controls muted />
                                                : <img src={active.url} alt="Preview" className="w-full max-h-[60vh] rounded-lg object-contain bg-black" />}
                                            <p className="text-xs text-muted-foreground">
                                                {active.type === 'video' ? 'Videos are posted as they are.' : active.passthrough ? 'GIFs are posted as they are, so they keep moving.' : 'This picture is posted as it is.'}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* Step 3: Details */}
                    {step === 'details' && (
                        <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden animate-in fade-in duration-200">
                             {/* Left: the pictures as they will be posted */}
                             <div className={`w-full md:w-[50%] lg:w-[60%] flex items-center justify-center ${mediaItems.length === 0 ? 'bg-muted/40' : 'bg-black/40'} border-b md:border-b-0 md:border-r border-border/50 p-6 relative select-none shrink-0 overflow-y-auto`}>
                                  {mediaItems.length === 0 ? (
                                      <PostLivePreview
                                          authorName={selectedPageId === 'user' ? (user?.user_metadata?.full_name || user?.user_metadata?.username || 'You') : ((myPages || []).find((pg: any) => pg.id === selectedPageId)?.name || 'Your page')}
                                          authorAvatar={selectedPageId === 'user' ? user?.user_metadata?.avatar_url : (myPages || []).find((pg: any) => pg.id === selectedPageId)?.logo_url}
                                          caption={caption}
                                          poll={poll}
                                          category={category}
                                          audienceLabel={POST_AUDIENCES.find((a) => a.id === audience)?.label || 'Everyone'}
                                          scheduleLabel={scheduleOn && scheduleAt ? `Goes live ${formatSchedule(scheduleAt)}` : null}
                                          attachment={jobSharePart ? <JobShareCard {...(() => { try { return JSON.parse(jobSharePart); } catch { return {}; } })()} /> : null}
                                      />
                                  ) : (
                                  <div className="w-full max-w-md bg-black rounded-xl overflow-hidden shadow-2xl relative border border-white/10 flex items-center justify-center">
                                      {(() => {
                                          const it = mediaItems[detailsActiveIndex];
                                          if (!it) return null;
                                          const src = finalsRef.current.get(it.url)?.previewUrl || it.url;
                                          return it.type === 'video' ? (
                                              <video src={src} className="w-full max-h-[70vh] object-contain" autoPlay loop muted playsInline />
                                          ) : (
                                              <img decoding="async" src={src} alt="Preview" className="w-full max-h-[70vh] object-contain" />
                                          );
                                      })()}

                                      {mediaItems.length > 1 && (
                                          <>
                                              <button
                                                  aria-label="Previous"
                                                  onClick={() => setDetailsActiveIndex(prev => (prev > 0 ? prev - 1 : mediaItems.length - 1))}
                                                  className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 active:scale-95 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white font-bold text-lg border border-white/10 shadow-lg transition"
                                              >
                                                  ‹
                                              </button>
                                              <button
                                                  aria-label="Next"
                                                  onClick={() => setDetailsActiveIndex(prev => (prev < mediaItems.length - 1 ? prev + 1 : 0))}
                                                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 active:scale-95 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white font-bold text-lg border border-white/10 shadow-lg transition"
                                              >
                                                  ›
                                              </button>
                                              <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-white z-10 pointer-events-none">
                                                  {detailsActiveIndex + 1} / {mediaItems.length}
                                              </div>
                                          </>
                                      )}
                                  </div>
                                  )}
                             </div>

                            {/* Right: Input forms */}
                            <div className="flex-1 flex flex-col bg-card overflow-y-auto">
                                <div className="p-4 flex items-center gap-3 border-b border-border/30">
                                    <Avatar className="h-8 w-8 ring-2 ring-primary/20">
                                        <AvatarImage src={user?.user_metadata?.avatar_url} />
                                        <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                                    </Avatar>
                                    <Select value={selectedPageId} onValueChange={setSelectedPageId}>
                                        <SelectTrigger className="w-fit h-8 text-xs font-semibold bg-transparent border-none hover:bg-accent rounded-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="user">Personal Profile</SelectItem>
                                            {(myPages || []).map(page => (
                                                <SelectItem key={page.id} value={page.id}>{page.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="p-4 border-b border-border/30 flex gap-4 items-start relative group/caption">
                                    <div className="flex-1 rounded-2xl border border-border/60 bg-background/60 px-4 py-3 transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
                                        <MentionTextarea
                                            ref={captionRef}
                                            value={caption}
                                            onChange={(e) => setCaption(e.target.value)}
                                            placeholder={mediaItems.length === 0 ? "What do you want to share?" : "Write a caption..."}
                                            maxLength={POST_CAPTION_MAX}
                                            aria-label="Caption"
                                            className="min-h-[120px] resize-none border-none focus-visible:ring-0 bg-transparent text-base p-0 w-full"
                                        />
                                        <div className="flex items-center justify-between mt-2 text-muted-foreground">
                                            <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker} modal={false}>
                                                <PopoverTrigger asChild>
                                                    <button aria-label="Emoji" className="hover:text-foreground transition-colors p-3 -m-2" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                                                        <Smile className="h-5 w-5" />
                                                    </button>
                                                </PopoverTrigger>
                                                <PopoverContent className="p-0 border-none shadow-2xl bg-transparent z-[9999]" align="start" side="bottom" sideOffset={8}>
                                                    <EmojiPicker
                                                        theme={Theme.AUTO}
                                                        emojiStyle={EmojiStyle.APPLE}
                                                        onEmojiClick={(emojiData) => {
                                                            const el = captionRef.current;
                                                            const emoji = emojiData.emoji;
                                                            if (!el) { setCaption(prev => (prev + emoji).slice(0, POST_CAPTION_MAX)); return; }
                                                            // insert where the cursor is, not at the end
                                                            const start = el.selectionStart ?? caption.length;
                                                            const end = el.selectionEnd ?? start;
                                                            const next = (caption.slice(0, start) + emoji + caption.slice(end)).slice(0, POST_CAPTION_MAX);
                                                            setCaption(next);
                                                            requestAnimationFrame(() => {
                                                                const pos = Math.min(start + emoji.length, next.length);
                                                                el.focus();
                                                                el.setSelectionRange(pos, pos);
                                                            });
                                                        }}
                                                        width={300}
                                                        height={350}
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            <button type="button" onClick={() => setGifOpen(true)} disabled={isUploading || mediaItems.length >= POST_MEDIA_MAX} className="text-xs font-bold border border-current rounded px-1.5 py-0.5 hover:text-foreground disabled:opacity-40 min-h-[44px] min-w-[44px] -my-2" aria-label="Add a GIF">GIF</button>
                                            <span className={`text-xs font-medium ${caption.length >= POST_CAPTION_MAX ? 'text-destructive' : caption.length > POST_CAPTION_MAX * 0.9 ? 'text-amber-600' : ''}`} aria-live={caption.length > POST_CAPTION_MAX * 0.9 ? 'polite' : 'off'}>{caption.length} / {POST_CAPTION_MAX}</span>
                                        </div>
                                    </div>
                                </div>

                                {linkPreview && (
                                    <div className="px-4 border-b border-border/30 relative">
                                        <LinkPreviewCard preview={linkPreview} />
                                        <button type="button" aria-label="Remove link preview" onClick={() => { setDismissedLink(linkPreview.url); setLinkPreview(null); }} className="absolute right-6 top-5 h-8 w-8 rounded-full bg-background/90 border flex items-center justify-center shadow-sm">
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                )}

                                {/* Add to your post */}
                                {!editPostId && (
                                    <div className="px-4 py-3 border-b border-border/30">
                                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Add to your post</p>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                aria-pressed={!!poll}
                                                onClick={() => setPoll(poll ? null : emptyPollDraft())}
                                                className={`inline-flex items-center gap-2 min-h-[44px] rounded-full border px-4 text-sm font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.97] ${poll ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground border-border/70 hover:bg-muted'}`}
                                            >
                                                <BarChart3 className="h-4 w-4" /> Poll
                                            </button>
                                            <button
                                                type="button"
                                                aria-pressed={scheduleOn}
                                                onClick={() => { setScheduleOn(!scheduleOn); if (!scheduleOn && !scheduleAt) setScheduleAt(schedulePresets()[0].at); }}
                                                className={`inline-flex items-center gap-2 min-h-[44px] rounded-full border px-4 text-sm font-semibold transition-[background-color,color,transform] duration-150 active:scale-[0.97] ${scheduleOn ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground border-border/70 hover:bg-muted'}`}
                                            >
                                                <CalendarClock className="h-4 w-4" /> Schedule
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Poll builder */}
                                {!editPostId && poll && (
                                    <div className="mx-4 my-4 space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-sm font-semibold text-foreground">Poll</p>
                                                <p className="text-xs text-muted-foreground">Ask your connections to vote: 2 to {POLL_MAX_OPTIONS} options.</p>
                                            </div>
                                            <button type="button" aria-label="Remove poll" onClick={() => setPoll(null)} className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/10">
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                        <Input
                                            value={poll.question}
                                            onChange={(e) => setPoll({ ...poll, question: e.target.value })}
                                            maxLength={POLL_QUESTION_MAX}
                                            placeholder="Ask a question (optional)"
                                            aria-label="Poll question"
                                            className="text-base"
                                        />
                                        <div className="space-y-2">
                                            {poll.options.map((opt, i) => (
                                                <div key={i} className="flex items-center gap-2">
                                                    <span className="h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/40" aria-hidden />
                                                    <Input
                                                        value={opt}
                                                        onChange={(e) => setPoll({ ...poll, options: poll.options.map((o, j) => (j === i ? e.target.value : o)) })}
                                                        maxLength={POLL_OPTION_MAX}
                                                        placeholder={`Option ${i + 1}`}
                                                        aria-label={`Poll option ${i + 1}`}
                                                        className="text-base"
                                                    />
                                                    {poll.options.length > 2 && (
                                                        <button type="button" aria-label={`Remove option ${i + 1}`} onClick={() => setPoll({ ...poll, options: poll.options.filter((_, j) => j !== i) })} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-foreground/10">
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                        {poll.options.length < POLL_MAX_OPTIONS && (
                                            <button type="button" onClick={() => setPoll({ ...poll, options: [...poll.options, ''] })} className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-semibold text-primary transition-colors hover:bg-primary/5">
                                                <Plus className="h-4 w-4" /> Add option <span className="font-normal text-muted-foreground">({poll.options.length}/{POLL_MAX_OPTIONS})</span>
                                            </button>
                                        )}
                                        <div>
                                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Poll length</p>
                                            <div className="flex flex-wrap gap-2" role="group" aria-label="How long the poll stays open">
                                                {POLL_DURATIONS.map((d) => (
                                                    <button key={d.id} type="button" aria-pressed={poll.durationId === d.id} onClick={() => setPoll({ ...poll, durationId: d.id })} className={`min-h-[44px] rounded-full border px-4 text-sm font-semibold transition-colors ${poll.durationId === d.id ? 'bg-foreground text-background border-foreground' : 'bg-card text-muted-foreground border-border/60 hover:bg-muted'}`}>{d.label}</button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Schedule panel */}
                                {!editPostId && scheduleOn && (
                                    <div className="mx-4 my-4 space-y-3 rounded-2xl border border-border/60 bg-muted/20 p-4">
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">Publish later</p>
                                            <p className="text-xs text-muted-foreground">{scheduleAt ? `Goes live ${formatSchedule(scheduleAt)}. Only you see it until then.` : 'Choose a time up to 90 days ahead.'}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {schedulePresets().map((pr) => (
                                                <button key={pr.id} type="button" onClick={() => setScheduleAt(pr.at)} aria-pressed={scheduleAt?.getTime() === pr.at.getTime()} className={`px-4 min-h-[44px] rounded-full text-sm font-semibold border transition-colors ${scheduleAt?.getTime() === pr.at.getTime() ? 'bg-foreground text-background border-foreground' : 'bg-card text-muted-foreground border-border/60 hover:bg-muted'}`}>{pr.label}</button>
                                            ))}
                                        </div>
                                        <Input type="datetime-local" aria-label="Publish time" value={scheduleAt ? toLocalInputValue(scheduleAt) : ''} onChange={(e) => setScheduleAt(e.target.value ? new Date(e.target.value) : null)} className="w-auto text-base" />
                                    </div>
                                )}

                                {/* Post settings */}
                                <div className="grid gap-4 border-b border-border/30 p-4 sm:grid-cols-2">
                                    <div className="space-y-1.5">
                                        <p className="text-sm font-semibold text-foreground">Category</p>
                                        <Select value={category} onValueChange={setCategory}>
                                            <SelectTrigger className="w-full" aria-label="Post category"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {POST_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground">Helps people find your post. Hashtags in the caption become tags.</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <p className="text-sm font-semibold text-foreground">Audience</p>
                                        <Select value={audience} onValueChange={setAudience}>
                                            <SelectTrigger className="w-full" aria-label="Who can see this post"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {POST_AUDIENCES.map((a) => <SelectItem key={a.id} value={a.id}>{a.label}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-xs text-muted-foreground">{POST_AUDIENCES.find((a) => a.id === audience)?.description}</p>
                                    </div>
                                </div>

                                {/* Collaborators (new posts only) */}
                                {!editPostId && (
                                    <div className="p-4 border-b border-border/30">
                                        <p className="font-medium text-base text-foreground">Collaborators</p>
                                        <p className="text-xs text-muted-foreground mb-3">Credit up to {COLLAB_MAX} people. They are shown on the post only after they accept.</p>
                                        {collabs.length > 0 && (
                                            <div className="flex flex-wrap gap-2 mb-3">
                                                {collabs.map((c) => (
                                                    <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full bg-accent/60 border border-border/50 pl-2 pr-1 py-1 text-xs font-semibold">
                                                        @{c.username || c.full_name}
                                                        <button type="button" aria-label={`Remove ${c.username || c.full_name}`} onClick={() => setCollabs((prev) => prev.filter((x) => x.id !== c.id))} className="h-6 w-6 flex items-center justify-center rounded-full hover:bg-foreground/10"><X className="h-3.5 w-3.5" /></button>
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {collabs.length < COLLAB_MAX && (
                                            <>
                                                <Input value={collabQuery} onChange={(e) => setCollabQuery(e.target.value)} placeholder="Search people to credit" aria-label="Search people to credit" />
                                                {collabResults.length > 0 && (
                                                    <div className="mt-2 rounded-xl border divide-y overflow-hidden">
                                                        {collabResults.map((u) => (
                                                            <button key={u.id} type="button" onClick={() => { setCollabs((prev) => [...prev, u]); setCollabQuery(''); setCollabResults([]); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted min-h-[44px]">
                                                                <Avatar className="h-8 w-8"><AvatarImage src={u.avatar_url} /><AvatarFallback><User className="h-4 w-4" /></AvatarFallback></Avatar>
                                                                <span className="min-w-0"><span className="block text-sm font-medium truncate">{u.full_name || u.username}</span><span className="block text-xs text-muted-foreground">@{u.username}</span></span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Alt text */}
                                {mediaItems.length > 0 && (
                                    <div className="p-4 border-b border-border/30">
                                        <p className="font-medium text-base text-foreground">Alt text</p>
                                        <p className="text-xs text-muted-foreground mb-3">Describe each photo or video for people who cannot see it. Screen readers read this aloud.</p>
                                        <div className="space-y-3">
                                            {mediaItems.map((m, idx) => (
                                                <div key={m.url} className="flex items-center gap-3">
                                                    <div className="h-12 w-12 shrink-0 rounded-lg overflow-hidden bg-muted">
                                                        {m.type === 'image' ? <img src={m.url} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full flex items-center justify-center"><Video className="h-5 w-5 text-muted-foreground" /></div>}
                                                    </div>
                                                    <Input
                                                        value={altTexts[m.url] || ''}
                                                        onChange={(e) => setAltTexts((prev) => ({ ...prev, [m.url]: e.target.value }))}
                                                        maxLength={POST_ALT_TEXT_MAX}
                                                        placeholder={`Describe item ${idx + 1}`}
                                                        aria-label={`Alt text for item ${idx + 1}`}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Tag People Section (Instagram Style) */}
                                <div className="p-4 border-b border-border/30">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 text-muted-foreground group">
                                            <Tag className="h-5 w-5 group-hover:text-primary transition-colors shrink-0" />
                                            <span className="font-medium text-base text-foreground">Tag people</span>
                                        </div>
                                        <Button 
                                            variant="ghost" 
                                            size="sm" 
                                            onClick={() => setShowTagDialog(true)}
                                            className="text-xs font-bold text-primary hover:text-primary/80 hover:bg-primary/10 h-10 md:h-8 rounded-full px-3"
                                        >
                                            {taggedUsers.length > 0 ? `Tagged (${taggedUsers.length})` : 'Add tag'}
                                        </Button>
                                    </div>

                                    {taggedUsers.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-3 pt-1">
                                            {taggedUsers.map(u => (
                                                <div key={u.id} className="flex items-center gap-1.5 bg-accent/60 border border-border/50 rounded-full pl-1.5 pr-2 py-1 text-xs font-medium animate-in fade-in zoom-in-95">
                                                    <Avatar className="h-5 w-5">
                                                        <AvatarImage src={u.avatar_url} />
                                                        <AvatarFallback className="text-xs"><User className="h-3 w-3" /></AvatarFallback>
                                                    </Avatar>
                                                    <span className="font-semibold text-foreground">@{u.username || u.full_name}</span>
                                                    <button aria-label="Close" 
                                                        onClick={() => setTaggedUsers(prev => prev.filter(item => item.id !== u.id))}
                                                        className="ml-1 text-muted-foreground hover:text-foreground p-0.5 rounded-full hover:bg-foreground/10"
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Add Location Section (Realtime OpenStreetMap & GPS Geolocation) */}
                                <div className="p-4 border-b border-border/30 relative">
                                    <div className="flex items-center gap-3 text-muted-foreground group">
                                        <MapPin className={`h-5 w-5 transition-colors shrink-0 ${location ? 'text-primary' : 'group-hover:text-primary'}`} />
                                        <div className="flex-1 flex items-center justify-between">
                                            <Input 
                                                value={location}
                                                onChange={(e) => {
                                                    setLocation(e.target.value);
                                                    setShowLocationSuggestions(true);
                                                }}
                                                onFocus={() => setShowLocationSuggestions(true)}
                                                placeholder="Add location (e.g. Mumbai, LA, London...)" 
                                                className="border-none bg-transparent focus-visible:ring-0 px-0 shadow-none text-base h-auto placeholder:text-muted-foreground"
                                            />
                                            {location ? (
                                                <button aria-label="Close" 
                                                    onClick={() => setLocation('')}
                                                    className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-foreground/10"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={handleGetCurrentLocation}
                                                    disabled={isFetchingLocation}
                                                    className="text-xs font-bold text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 px-3 py-1 rounded-full flex items-center gap-1 transition shrink-0"
                                                >
                                                    {isFetchingLocation ? <Loader2 className="h-3 w-3 animate-spin" /> : <><MapPin className="h-3 w-3 mr-1 inline" />Use Current Location</>}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Realtime Location Suggestions Dropdown */}
                                    {showLocationSuggestions && (
                                        <div className="mt-3 animate-in fade-in duration-200">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-[12px] font-bold text-muted-foreground uppercase tracking-wider">
                                                    {isSearchingLocation ? 'Searching Realtime Locations...' : 'Realtime Locations'}
                                                </p>
                                                <button 
                                                    onClick={() => setShowLocationSuggestions(false)}
                                                    className="text-[12px] text-muted-foreground hover:text-foreground font-semibold"
                                                >
                                                    Hide
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {realtimeLocations.length > 0 ? (
                                                    realtimeLocations.map(loc => (
                                                        <button
                                                            key={loc}
                                                            onClick={() => {
                                                                setLocation(loc);
                                                                setShowLocationSuggestions(false);
                                                            }}
                                                            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                                                                location === loc 
                                                                    ? 'bg-primary border-primary text-primary-foreground font-bold shadow-md' 
                                                                    : 'bg-secondary/70 border-border text-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/10 font-medium'
                                                            }`}
                                                        >
                                                            📍 {loc}
                                                        </button>
                                                    ))
                                                ) : (
                                                    POPULAR_LOCATIONS.filter(loc => !location || loc.toLowerCase().includes(location.toLowerCase())).slice(0, 6).map(loc => (
                                                        <button
                                                            key={loc}
                                                            onClick={() => {
                                                                setLocation(loc);
                                                                setShowLocationSuggestions(false);
                                                            }}
                                                            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                                                                location === loc 
                                                                    ? 'bg-primary border-primary text-primary-foreground font-bold shadow-md' 
                                                                    : 'bg-secondary/70 border-border text-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/10 font-medium'
                                                            }`}
                                                        >
                                                            📍 {loc}
                                                        </button>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Advanced Settings collapsible section */}
                                <div className="flex flex-col pb-6">
                                    <button 
                                        className="flex items-center justify-between p-4 border-b border-border/30 hover:bg-accent/50 transition-colors text-left" 
                                        onClick={() => setExpandedSection(s => s === 'adv' ? null : 'adv')}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Settings className="h-5 w-5 text-muted-foreground" /> 
                                            <span className="font-semibold text-sm">Advanced settings</span>
                                        </div>
                                        {expandedSection === 'adv' ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                                    </button>
                                    {expandedSection === 'adv' && (
                                        <div className="p-4 bg-muted/40 border-b border-border/30 text-sm space-y-5 animate-in slide-in-from-top-2 duration-200">
                                            <div 
                                                className="flex items-center justify-between gap-4 cursor-pointer"
                                                onClick={() => setCommentingOff(!commentingOff)}
                                            >
                                                <div>
                                                    <p className="font-semibold text-foreground">Turn off commenting</p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">You can change this later by going to the ••• menu at the top of your post.</p>
                                                </div>
                                                <button 
                                                    type="button"
                                                    role="switch"
                                                    aria-checked={commentingOff}
                                                    aria-label="Turn off commenting"
                                                    className={`w-10 h-6 rounded-full shrink-0 border border-border transition-colors duration-200 p-0.5 ${
                                                        commentingOff ? 'bg-primary border-primary' : 'bg-muted-foreground/30'
                                                    }`}
                                                >
                                                    <span className={`w-4 h-4 rounded-full bg-white shadow-md block transition-transform duration-200 ${commentingOff ? 'translate-x-4' : 'translate-x-0'}`} />
                                                </button>
                                            </div>
                                            <div 
                                                className="flex items-center justify-between gap-4 cursor-pointer"
                                                onClick={() => setHideLikes(!hideLikes)}
                                            >
                                                <div>
                                                    <p className="font-semibold text-foreground">Hide like and view counts</p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">Only you will see the total number of likes and views on this post.</p>
                                                </div>
                                                <button 
                                                    type="button"
                                                    role="switch"
                                                    aria-checked={hideLikes}
                                                    aria-label="Hide like and view counts"
                                                    className={`w-10 h-6 rounded-full shrink-0 border border-border transition-colors duration-200 p-0.5 ${
                                                        hideLikes ? 'bg-primary border-primary' : 'bg-muted-foreground/30'
                                                    }`}
                                                >
                                                    <span className={`w-4 h-4 rounded-full bg-white shadow-md block transition-transform duration-200 ${hideLikes ? 'translate-x-4' : 'translate-x-0'}`} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={(e) => {
                    if (e.target.files?.length) uploadFiles(e.target.files);
                }}
            />
            <input
                ref={photoCaptureRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
                onChange={(e) => { if (e.target.files?.length) uploadFiles(e.target.files); e.target.value = ''; }}
            />
            <input
                ref={videoCaptureRef}
                type="file"
                accept="video/*"
                capture="environment"
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
                onChange={(e) => { if (e.target.files?.length) uploadFiles(e.target.files); e.target.value = ''; }}
            />
            <CameraCaptureDialog
                open={cameraMode !== null}
                initialMode={cameraMode || 'photo'}
                maxSeconds={POST_VIDEO_MAX_SECONDS}
                onClose={() => setCameraMode(null)}
                onCapture={(file) => { setCameraMode(null); uploadFiles([file]); }}
            />

            {/* GIF picker */}
            <Dialog open={gifOpen} onOpenChange={setGifOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Add a GIF</DialogTitle>
                        <DialogDescription>Search, or pick one of the trending GIFs.</DialogDescription>
                    </DialogHeader>
                    <Input value={gifQuery} onChange={(e) => setGifQuery(e.target.value)} placeholder="Search GIFs" aria-label="Search GIFs" autoFocus />
                    <div className="max-h-[50vh] overflow-y-auto">
                        {gifState === 'loading' && <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>}
                        {gifState === 'off' && <p className="py-8 text-center text-sm text-muted-foreground">GIFs are not set up yet.</p>}
                        {gifState === 'error' && <p className="py-8 text-center text-sm text-muted-foreground">Could not load GIFs. Try again in a moment.</p>}
                        {gifState === 'idle' && gifs.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No GIFs found.</p>}
                        {gifState === 'idle' && gifs.length > 0 && (
                            <div className="columns-2 sm:columns-3 gap-2 [&>button]:mb-2">
                                {gifs.map((g) => (
                                    <button key={g.id} type="button" onClick={() => addGif(g)} className="block w-full overflow-hidden rounded-lg hover:ring-2 hover:ring-primary" aria-label={g.title}>
                                        <img src={g.preview} alt={g.title} loading="lazy" referrerPolicy="no-referrer" className="w-full h-auto" />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <p className="text-[12px] text-muted-foreground text-right">{GIF_CREDIT}</p>
                </DialogContent>
            </Dialog>

            {/* Tag People Search Dialog */}
            <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
                <DialogContent className="sm:max-w-md bg-card/95 border-white/10 rounded-2xl p-6 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold flex items-center gap-2">
                            <Tag className="h-5 w-5 text-primary" />
                            <span>Tag People</span>
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            Search profiles to tag in your post.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="mt-2 space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input 
                                value={tagSearchQuery}
                                onChange={(e) => setTagSearchQuery(e.target.value)}
                                placeholder="Search by name or @username..."
                                className="pl-9 bg-accent/40 border-border/50 rounded-xl text-sm"
                                autoFocus
                            />
                        </div>

                        {/* Search Results / Empty State */}
                        <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                            {isSearchingUsers ? (
                                <div className="space-y-2 p-2">{[0, 1, 2].map(i => <EnhancedSkeleton key={i} className="h-10 w-full rounded-xl" />)}</div>
                            ) : userSearchResults.filter(p => p.id !== user?.id && !isBlocked(p.id)).length > 0 ? (
                                userSearchResults.filter(p => p.id !== user?.id && !isBlocked(p.id)).map(profile => {
                                    const isTagged = taggedUsers.some(u => u.id === profile.id);
                                    return (
                                        <div 
                                            key={profile.id}
                                            onClick={() => {
                                                if (isTagged) {
                                                    setTaggedUsers(prev => prev.filter(u => u.id !== profile.id));
                                                } else {
                                                    setTaggedUsers(prev => [...prev, profile]);
                                                }
                                            }}
                                            className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${
                                                isTagged ? 'bg-primary/10 border border-primary/30' : 'hover:bg-accent/60'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-9 w-9">
                                                    <AvatarImage src={profile.avatar_url} />
                                                    <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="text-xs font-bold text-foreground">{profile.full_name || profile.username}</p>
                                                    <p className="text-[12px] text-muted-foreground">@{profile.username || 'user'}</p>
                                                </div>
                                            </div>
                                            <Button 
                                                size="sm" 
                                                variant={isTagged ? "default" : "outline"} 
                                                className="h-10 md:h-8 rounded-full px-3 text-xs font-bold"
                                            >
                                                {isTagged ? <Check className="h-4 w-4 mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
                                                {isTagged ? 'Tagged' : 'Tag'}
                                            </Button>
                                        </div>
                                    );
                                })
                            ) : tagSearchQuery.trim() ? (
                                <p className="text-center py-6 text-xs text-muted-foreground">No users found matching "{tagSearchQuery}"</p>
                            ) : (
                                <p className="text-center py-6 text-xs text-muted-foreground">Type to search people by name or username</p>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
        </>
    );
}
