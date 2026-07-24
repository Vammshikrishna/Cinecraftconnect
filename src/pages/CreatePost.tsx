import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ImagePlus, X, ArrowLeft, Loader2, MapPin, User, Building2, UploadCloud, Video, Maximize, ZoomIn, ZoomOut, Smile, Tag, Accessibility, Settings, ChevronRight, ChevronUp, Search, UserPlus, Check, Sparkles, Sun, Sliders, Crop, Thermometer, Droplets, Palette, Cloud, Circle, Type, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { usePostMutation } from '@/hooks/mutations/usePostMutation';
import { MentionTextarea } from '@/components/ui/mention-textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useMyPages } from '@/hooks/useCompanyPages';
import { Input } from '@/components/ui/input';
import EmojiPicker, { Theme, EmojiStyle } from 'emoji-picker-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { queryClient } from '@/lib/queryClient';

type Step = 'select' | 'preview' | 'details';

interface MediaItem {
    url: string;
    type: 'image' | 'video';
}

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

interface SubMenuSnapshot {
    selectedFilterName: string;
    filterVal: string;
    filterIntensity: number;
    adjustments: Record<string, number>;
    aspectRatio: '1:1' | '4:5' | '16:9' | 'original' | 'free';
    zoom: number;
    pan: { x: number; y: number };
    crop: { top: number; right: number; bottom: number; left: number };
    textOverlays: TextOverlayItem[];
}

const TOOL_CONFIGS: Record<string, { key: 'brightness' | 'contrast' | 'saturate' | 'sepia' | 'warmth' | 'vignette' | 'fade' | 'lux' | 'structure' | 'colour' | 'sharpen'; name: string; min: number; max: number; defaultVal: number }> = {
    'Sharpen': { key: 'sharpen', name: 'Sharpen', min: 0, max: 100, defaultVal: 0 },
    'Lux': { key: 'lux', name: 'Lux', min: 0, max: 100, defaultVal: 0 },
    'Brightness': { key: 'brightness', name: 'Brightness', min: 50, max: 150, defaultVal: 100 },
    'Contrast': { key: 'contrast', name: 'Contrast', min: 50, max: 150, defaultVal: 100 },
    'Structure': { key: 'structure', name: 'Structure', min: 0, max: 100, defaultVal: 0 },
    'Warmth': { key: 'warmth', name: 'Warmth', min: -50, max: 50, defaultVal: 0 },
    'Saturation': { key: 'saturate', name: 'Saturation', min: 50, max: 150, defaultVal: 100 },
    'Colour': { key: 'colour', name: 'Colour', min: -50, max: 50, defaultVal: 0 },
    'Fade': { key: 'fade', name: 'Fade', min: 0, max: 100, defaultVal: 0 },
    'Vignette': { key: 'vignette', name: 'Vignette', min: 0, max: 100, defaultVal: 0 },
};

export default function CreatePost() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const editPostId = searchParams.get('editPostId') || searchParams.get('edit');
    const { user } = useAuth();
    const { toast } = useToast();
    const { data: myPages } = useMyPages();
    const { createPost: createPostMutation } = usePostMutation();
    
    const [step, setStep] = useState<Step>('select');
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isLoadingEdit, setIsLoadingEdit] = useState(false);
    const [jobSharePart, setJobSharePart] = useState<string | null>(null);
    
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
                    .or(`username.ilike.%${tagSearchQuery}%,full_name.ilike.%${tagSearchQuery}%`)
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
        if (!editPostId) return;
        setIsLoadingEdit(true);
        const fetchPostForEdit = async () => {
            try {
                const { data: post, error } = await supabase
                    .from('posts')
                    .select('*')
                    .eq('id', editPostId)
                    .single();
                
                if (error) throw error;
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
                    setMediaItems(items);

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
                    description: err.message || 'Could not load post details for editing.',
                    variant: 'destructive',
                });
            } finally {
                setIsLoadingEdit(false);
            }
        };

        fetchPostForEdit();
    }, [editPostId]);
    
    // UI states
    const [activeIndex, setActiveIndex] = useState(0);
    const [mediaFilters, setMediaFilters] = useState<Record<string, string>>({});
    const [aspectRatio, setAspectRatio] = useState<'1:1' | '4:5' | '16:9' | 'original' | 'free'>('original');
    const [activeTab, setActiveTab] = useState<'crop' | 'edit'>('crop');
    const [expandedSection, setExpandedSection] = useState<'adv' | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    
    // Advanced Settings states
    const [commentingOff, setCommentingOff] = useState(false);
    const [hideLikes, setHideLikes] = useState(false);
    
    // Zoom, Pan & Adjustments states
    const [mediaZoom, setMediaZoom] = useState<Record<string, number>>({});
    const [mediaPan, setMediaPan] = useState<Record<string, { x: number; y: number }>>({});
    const [mediaCrop, setMediaCrop] = useState<Record<string, { top: number; right: number; bottom: number; left: number }>>({});
    const [mediaAdjustments, setMediaAdjustments] = useState<Record<string, { brightness?: number; contrast?: number; saturate?: number; sepia?: number; warmth?: number; vignette?: number; fade?: number; lux?: number; structure?: number; colour?: number; sharpen?: number }>>({}); 
    const [editMode, setEditMode] = useState<'main' | 'filter' | 'adjust' | 'crop' | 'text'>(window.innerWidth < 768 ? 'main' : 'filter');
    const [isFilterIntensityOpen, setIsFilterIntensityOpen] = useState(false);
    const [mediaFilterIntensity, setMediaFilterIntensity] = useState<Record<string, number>>({});
    const [activeAdjustmentTool, setActiveAdjustmentTool] = useState<string | null>(null);
    const [selectedFilterName, setSelectedFilterName] = useState<string>('Normal');
    const [detailsActiveIndex, setDetailsActiveIndex] = useState(0);
    const [showZoomSlider, setShowZoomSlider] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    
    // Text Overlay States
    const [mediaTextOverlays, setMediaTextOverlays] = useState<Record<string, TextOverlayItem[]>>({});
    const [newOverlayText, setNewOverlayText] = useState('');
    const [selectedTextColor, setSelectedTextColor] = useState('#FFFFFF');
    const [selectedTextBg, setSelectedTextBg] = useState('rgba(0,0,0,0.6)');
    const [selectedFontSize, setSelectedFontSize] = useState(22);
    const [editingTextId, setEditingTextId] = useState<string | null>(null);
    const [subMenuSnapshot, setSubMenuSnapshot] = useState<SubMenuSnapshot | null>(null);

    const enterSubMenu = (mode: 'filter' | 'adjust' | 'crop' | 'text') => {
        const url = mediaItems[activeIndex]?.url || '';
        setSubMenuSnapshot({
            selectedFilterName,
            filterVal: mediaFilters[url] || 'none',
            filterIntensity: mediaFilterIntensity[url] ?? 100,
            adjustments: { ...(mediaAdjustments[url] || {}) },
            aspectRatio,
            zoom: mediaZoom[url] || 100,
            pan: { ...(mediaPan[url] || { x: 0, y: 0 }) },
            crop: { ...(mediaCrop[url] || { top: 0, right: 0, bottom: 0, left: 0 }) },
            textOverlays: [...(mediaTextOverlays[url] || [])]
        });
        setEditMode(mode);
    };

    const cancelSubMenu = () => {
        if (isFilterIntensityOpen) {
            setMediaFilterIntensity(prev => ({
                ...prev,
                [mediaItems[activeIndex]?.url]: toolSnapshotValue
            }));
            setIsFilterIntensityOpen(false);
            return;
        }

        if (activeAdjustmentTool) {
            const config = TOOL_CONFIGS[activeAdjustmentTool];
            const key = config ? config.key : activeAdjustmentTool.toLowerCase();
            setMediaAdjustments(prev => {
                const current = prev[mediaItems[activeIndex]?.url] || {};
                return {
                    ...prev,
                    [mediaItems[activeIndex]?.url]: { ...current, [key]: toolSnapshotValue }
                };
            });
            setActiveAdjustmentTool(null);
            return;
        }

        if (subMenuSnapshot) {
            const url = mediaItems[activeIndex]?.url || '';
            setSelectedFilterName(subMenuSnapshot.selectedFilterName);
            setMediaFilters(prev => ({ ...prev, [url]: subMenuSnapshot.filterVal }));
            setMediaFilterIntensity(prev => ({ ...prev, [url]: subMenuSnapshot.filterIntensity }));
            setMediaAdjustments(prev => ({ ...prev, [url]: { ...subMenuSnapshot.adjustments } }));
            setAspectRatio(subMenuSnapshot.aspectRatio);
            setMediaZoom(prev => ({ ...prev, [url]: subMenuSnapshot.zoom }));
            setMediaPan(prev => ({ ...prev, [url]: subMenuSnapshot.pan }));
            setMediaCrop(prev => ({ ...prev, [url]: { ...subMenuSnapshot.crop } }));
            setMediaTextOverlays(prev => ({ ...prev, [url]: [...subMenuSnapshot.textOverlays] }));
        }
        setSubMenuSnapshot(null);
        setEditMode('main');
    };

    const finishSubMenu = () => {
        if (isFilterIntensityOpen) {
            setIsFilterIntensityOpen(false);
            return;
        }

        if (activeAdjustmentTool) {
            setActiveAdjustmentTool(null);
            return;
        }

        setSubMenuSnapshot(null);
        setEditMode('main');
    };

    const handleTextOverlayDrag = (id: string, e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        const startX = clientX;
        const startY = clientY;

        const url = mediaItems[activeIndex]?.url;
        if (!url) return;
        const overlays = mediaTextOverlays[url] || [];
        const item = overlays.find(o => o.id === id);
        if (!item) return;

        const initialX = item.x;
        const initialY = item.y;

        const handleMove = (moveEv: MouseEvent | TouchEvent) => {
            const moveX = 'touches' in moveEv ? moveEv.touches[0].clientX : moveEv.clientX;
            const moveY = 'touches' in moveEv ? moveEv.touches[0].clientY : moveEv.clientY;
            
            const dx = ((moveX - startX) / rect.width) * 100;
            const dy = ((moveY - startY) / rect.height) * 100;

            const newX = Math.max(5, Math.min(95, initialX + dx));
            const newY = Math.max(5, Math.min(95, initialY + dy));

            setMediaTextOverlays(prev => ({
                ...prev,
                [url]: (prev[url] || []).map(o => o.id === id ? { ...o, x: newX, y: newY } : o)
            }));
        };

        const handleUp = () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleUp);
        };

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        window.addEventListener('touchmove', handleMove);
        window.addEventListener('touchend', handleUp);
    };

    React.useEffect(() => {
        const media = window.matchMedia('(max-width: 768px)');
        setIsMobile(media.matches);
        const listener = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
    }, []);
    
    const isDraggingRef = useRef(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const [toolSnapshotValue, setToolSnapshotValue] = useState<number>(0);
    const containerRef = useRef<HTMLDivElement>(null);
    
    const getFilterString = (url: string) => {
        const filterBase = mediaFilters[url] && mediaFilters[url] !== 'none' ? mediaFilters[url] : '';
        const adj = mediaAdjustments[url] || {};
        
        const brightness = adj.brightness !== undefined ? adj.brightness : 100;
        const contrast = adj.contrast !== undefined ? adj.contrast : 100;
        const saturate = adj.saturate !== undefined ? adj.saturate : 100;
        const sepia = adj.sepia !== undefined ? adj.sepia : 0;
        
        const warmthFilter = adj.warmth ? `sepia(${Math.abs(adj.warmth) / 100}) hue-rotate(${adj.warmth > 0 ? -adj.warmth / 2 : -adj.warmth / 2}deg)` : '';
        const fadeFilter = adj.fade ? `brightness(${100 + adj.fade / 4}%) contrast(${100 - adj.fade / 3}%)` : '';
        const luxFilter = adj.lux ? `brightness(${100 + adj.lux / 3}%) contrast(${100 + adj.lux / 4}%) saturate(${100 + adj.lux / 4}%)` : '';
        const structureFilter = adj.structure ? `contrast(${100 + adj.structure * 0.6}%) saturate(${100 + adj.structure * 0.3}%)` : '';
        const colourFilter = adj.colour ? `hue-rotate(${adj.colour * 3.6}deg)` : '';
        const sharpenFilter = adj.sharpen ? `contrast(${100 + adj.sharpen * 0.5}%) saturate(${100 + adj.sharpen * 0.2}%)` : '';

        const intensity = mediaFilterIntensity[url] !== undefined ? mediaFilterIntensity[url] / 100 : 1;
        let finalFilterBase = filterBase;
        if (intensity < 1 && filterBase) {
            finalFilterBase = `opacity(${0.4 + intensity * 0.6}) ${filterBase}`;
        }

        return `${finalFilterBase} ${warmthFilter} ${fadeFilter} ${luxFilter} ${structureFilter} ${sharpenFilter} ${colourFilter} brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%) sepia(${sepia}%)`.trim();
    };

    const getClipPathString = (url: string) => {
        const crop = mediaCrop[url];
        if (!crop) return 'inset(0% 0% 0% 0%)';
        return `inset(${crop.top}% ${crop.right}% ${crop.bottom}% ${crop.left}%)`;
    };

    const handleCropDrag = (e: React.MouseEvent | React.TouchEvent, handle: 'tl' | 'tr' | 'bl' | 'br' | 'center') => {
        e.stopPropagation();
        if (e.cancelable) e.preventDefault();
        
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        
        const currentCrop = mediaCrop[mediaItems[activeIndex]?.url] || { top: 0, right: 0, bottom: 0, left: 0 };
        const startX = clientX;
        const startY = clientY;
        
        const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
            if (moveEvent.cancelable) moveEvent.preventDefault();
            const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
            const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
            
            const dx = ((currentX - startX) / rect.width) * 100;
            const dy = ((currentY - startY) / rect.height) * 100;
            
            setMediaCrop(prev => {
                const url = mediaItems[activeIndex]?.url;
                if (!url) return prev;
                let next = { ...currentCrop };
                
                if (handle === 'tl') {
                    next.left = Math.max(0, Math.min(100 - currentCrop.right - 10, currentCrop.left + dx));
                    next.top = Math.max(0, Math.min(100 - currentCrop.bottom - 10, currentCrop.top + dy));
                } else if (handle === 'tr') {
                    next.right = Math.max(0, Math.min(100 - currentCrop.left - 10, currentCrop.right - dx));
                    next.top = Math.max(0, Math.min(100 - currentCrop.bottom - 10, currentCrop.top + dy));
                } else if (handle === 'bl') {
                    next.left = Math.max(0, Math.min(100 - currentCrop.right - 10, currentCrop.left + dx));
                    next.bottom = Math.max(0, Math.min(100 - currentCrop.top - 10, currentCrop.bottom - dy));
                } else if (handle === 'br') {
                    next.right = Math.max(0, Math.min(100 - currentCrop.left - 10, currentCrop.right - dx));
                    next.bottom = Math.max(0, Math.min(100 - currentCrop.top - 10, currentCrop.bottom - dy));
                } else if (handle === 'center') {
                    const width = 100 - currentCrop.left - currentCrop.right;
                    const height = 100 - currentCrop.top - currentCrop.bottom;
                    let nextLeft = currentCrop.left + dx;
                    let nextTop = currentCrop.top + dy;
                    if (nextLeft < 0) nextLeft = 0;
                    if (nextLeft + width > 100) nextLeft = 100 - width;
                    if (nextTop < 0) nextTop = 0;
                    if (nextTop + height > 100) nextTop = 100 - height;
                    next.left = nextLeft;
                    next.right = 100 - nextLeft - width;
                    next.top = nextTop;
                    next.bottom = 100 - nextTop - height;
                }
                return { ...prev, [url]: next };
            });
        };
        
        const handleUp = () => {
            window.removeEventListener('mousemove', handleMove);
            window.removeEventListener('mouseup', handleUp);
            window.removeEventListener('touchmove', handleMove);
            window.removeEventListener('touchend', handleUp);
        };
        
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        window.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('touchend', handleUp);
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!mediaItems[activeIndex]) return;
        isDraggingRef.current = true;
        const currentPan = mediaPan[mediaItems[activeIndex].url] || { x: 0, y: 0 };
        dragStartRef.current = { x: e.clientX - currentPan.x, y: e.clientY - currentPan.y };
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDraggingRef.current || !mediaItems[activeIndex]) return;
        const x = e.clientX - dragStartRef.current.x;
        const y = e.clientY - dragStartRef.current.y;
        setMediaPan(prev => ({
            ...prev,
            [mediaItems[activeIndex].url]: { x, y }
        }));
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (!mediaItems[activeIndex]) return;
        isDraggingRef.current = true;
        const currentPan = mediaPan[mediaItems[activeIndex].url] || { x: 0, y: 0 };
        const touch = e.touches[0];
        dragStartRef.current = { x: touch.clientX - currentPan.x, y: touch.clientY - currentPan.y };
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!isDraggingRef.current || !mediaItems[activeIndex]) return;
        const touch = e.touches[0];
        const x = touch.clientX - dragStartRef.current.x;
        const y = touch.clientY - dragStartRef.current.y;
        setMediaPan(prev => ({
            ...prev,
            [mediaItems[activeIndex].url]: { x, y }
        }));
    };

    const handleTouchEnd = () => { isDraggingRef.current = false; };
    const handleMouseUpOrLeave = () => { isDraggingRef.current = false; };
    const fileInputRef = useRef<HTMLInputElement>(null);

    const uploadFiles = async (files: FileList) => {
        if (!user) return;
        if (mediaItems.length + files.length > 10) {
            toast({
                title: 'Limit exceeded',
                description: 'You can upload up to 10 images or videos.',
                variant: 'destructive',
            });
            return;
        }

        setIsUploading(true);
        const newItems: MediaItem[] = [];

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const isVideo = file.type.startsWith('video/');
                const isImage = file.type.startsWith('image/');
                
                if (!isVideo && !isImage) continue;
                
                let fileToUpload = file;
                if (isImage) {
                    const { compressImage } = await import('@/utils/imageCompression');
                    fileToUpload = await compressImage(file);
                } else {
                    const { FILE_SIZE_LIMITS } = await import('@/utils/fileValidation');
                    if (file.size > FILE_SIZE_LIMITS.video) {
                        toast({ title: 'File too large', description: `${file.name} exceeds 20MB.`, variant: 'destructive' });
                        continue;
                    }
                }

                const fileExt = file.name.split('.').pop();
                const fileName = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}.${fileExt}`;
                const filePath = `posts/${fileName}`;

                const { error } = await supabase.storage.from('portfolios').upload(filePath, fileToUpload, { cacheControl: '31536000' });
                if (error) throw error;

                const { data } = supabase.storage.from('portfolios').getPublicUrl(filePath);
                newItems.push({ url: data.publicUrl, type: isVideo ? 'video' : 'image' });
            }
            
            if (newItems.length > 0) {
                setMediaItems(prev => [...prev, ...newItems]);
                setStep('preview');
            }
        } catch (error: any) {
            console.error('Upload error:', error);
            toast({ title: 'Upload failed', description: error.message, variant: 'destructive' });
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleShare = async () => {
        if (!caption.trim() && mediaItems.length === 0) return;
        setIsSubmitting(true);
        try {
            const tags = (caption.match(/#[a-zA-Z0-9_]+/g) || []).map(t => t.replace('#', ''));
            const baseItems = mediaItems.length > 0 ? mediaItems : [{ url: '', type: 'image' as const }];
            const mediaItemsWithMetadata = baseItems.map((item, idx) => ({
                url: item.url,
                type: item.type,
                crop: mediaCrop[item.url] || null,
                zoom: mediaZoom[item.url] || 100,
                pan: mediaPan[item.url] || { x: 0, y: 0 },
                filter: getFilterString(item.url),
                aspectRatio: aspectRatio,
                ...(idx === 0 ? {
                    location: location.trim() || null,
                    tagged_users: taggedUsers,
                    comments_disabled: commentingOff,
                    hide_likes: hideLikes
                } : {})
            }));

            let finalContent = caption.trim();
            if (jobSharePart) {
                finalContent = finalContent ? `${finalContent}\n\nJOB_SHARE::${jobSharePart}` : `JOB_SHARE::${jobSharePart}`;
            }

            if (editPostId) {
                const updatePayload: any = {
                    content: finalContent,
                    media_items: mediaItemsWithMetadata,
                    updated_at: new Date().toISOString()
                };
                if (selectedPageId && selectedPageId !== 'user') {
                    updatePayload.page_id = selectedPageId;
                }

                const { error } = await supabase
                    .from('posts')
                    .update(updatePayload)
                    .eq('id', editPostId);

                if (error) throw error;
                toast({ title: 'Success', description: 'Post updated successfully!' });
            } else {
                await createPostMutation(finalContent, {
                    mediaItems: mediaItemsWithMetadata,
                    tags,
                    pageId: selectedPageId === 'user' ? null : selectedPageId,
                    location: location.trim() || null,
                    taggedUsers
                } as any);
                toast({ title: 'Success', description: 'Post shared successfully!' });
            }
            
            if (user?.id) {
                queryClient.invalidateQueries({ queryKey: ['home-feed-posts', user.id] });
            }
            queryClient.invalidateQueries({ queryKey: ['home-feed-posts'] });
            queryClient.invalidateQueries({ queryKey: ['home-feed-static'] });
            navigate('/feed');
        } catch (error: any) {
            console.error('Error saving post:', error);
            toast({ title: 'Error', description: error.message || 'Failed to save post', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoadingEdit) {
        return (
            <div className="min-h-screen bg-background pt-[68px] md:pt-24 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm font-medium text-muted-foreground">Loading post details...</p>
                </div>
            </div>
        );
    }

    return (
        <>
        <div className={`min-h-screen flex flex-col items-center justify-center px-0 md:px-4 ${isMobile && step === 'preview' ? 'bg-zinc-950 pt-0 pb-0 h-[100dvh] overflow-hidden fixed inset-0 z-[100]' : 'bg-background pt-[68px] md:pt-24 pb-12'}`}>
            <div className={`w-full md:max-w-6xl lg:max-w-7xl md:border md:border-border/50 md:rounded-2xl overflow-hidden md:shadow-2xl flex flex-col md:h-[88vh] ${isMobile && step === 'preview' ? 'h-full bg-zinc-950 flex-1' : 'h-auto min-h-[calc(100vh-68px)] md:min-h-[550px] bg-card'}`}>
                
                {/* Header */}
                {!(step === 'preview' && editMode === 'main') && (
                    <div className="h-14 border-b border-border/50 flex items-center justify-between px-4 shrink-0 bg-background/50 backdrop-blur-sm z-10">
                    <Button variant="ghost" size="icon" onClick={() => {
                        if (step === 'details' && !editPostId) {
                            setActiveIndex(detailsActiveIndex);
                            setStep('preview');
                        }
                        else if (step === 'preview' && !editPostId) setStep('select');
                        else navigate(-1);
                    }}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h2 className="text-sm font-bold tracking-tight">
                        {editPostId ? (step === 'details' ? 'Edit info' : 'Edit post') : (
                            step === 'select' ? 'Create new post' :
                            step === 'preview' ? 'Crop & Adjust' : 'New post details'
                        )}
                    </h2>
                    <div>
                        {step === 'preview' && (
                            <Button variant="ghost" className="text-primary font-bold hover:text-primary/80" onClick={() => {
                                setDetailsActiveIndex(activeIndex);
                                setStep('details');
                            }}>
                                Next
                            </Button>
                        )}
                        {step === 'details' && (
                            <Button variant="ghost" className="text-primary font-bold hover:text-primary/80" onClick={handleShare} disabled={isSubmitting}>
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
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center animate-in fade-in zoom-in-95 duration-300">
                            <UploadCloud className="h-20 w-20 text-muted-foreground mb-6 opacity-80" />
                            <h3 className="text-xl font-medium mb-4">Drag photos and videos here</h3>
                            <Button size="lg" className="rounded-full px-8 font-semibold" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                                {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</> : 'Select from computer'}
                            </Button>
                        </div>
                    )}

                    
                    {/* Step 2: Combined Preview/Editor Layout */}
                    {step === 'preview' && (
                        !isMobile ? (
                            <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden animate-in slide-in-from-right-8 duration-300">
                            <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 border-b md:border-b-0 md:border-r border-border/50 min-h-0">
                                <div className="w-full max-w-2xl flex flex-col items-center justify-center min-h-0">
                                    <div 
                                        ref={containerRef}
                                        className="bg-black rounded-xl overflow-hidden shadow-inner relative group border border-white/10 transition-all duration-300 flex items-center justify-center select-none"
                                        style={{ 
                                            height: isMobile ? '280px' : '450px',
                                            width: aspectRatio === '1:1' 
                                                ? (isMobile ? '280px' : '450px') 
                                                : aspectRatio === '4:5' 
                                                    ? (isMobile ? '224px' : '360px') 
                                                    : aspectRatio === '16:9' 
                                                        ? (isMobile ? '320px' : '600px') 
                                                        : 'auto',
                                            maxWidth: '100%',
                                            aspectRatio: aspectRatio === 'original' ? 'auto' : undefined,
                                        }}
                                        onMouseDown={handleMouseDown}
                                        onMouseMove={handleMouseMove}
                                        onMouseUp={handleMouseUpOrLeave}
                                        onMouseLeave={handleMouseUpOrLeave}
                                    >
                                        {mediaItems[activeIndex]?.type === 'video' ? (
                                            <video 
                                                src={mediaItems[activeIndex].url} 
                                                className={`w-full h-full ${aspectRatio !== 'original' && aspectRatio !== 'free' ? 'object-cover' : 'object-contain'}`} 
                                                autoPlay loop muted 
                                                style={{
                                                    transform: `translate(${mediaPan[mediaItems[activeIndex]?.url]?.x || 0}px, ${mediaPan[mediaItems[activeIndex]?.url]?.y || 0}px) scale(${(mediaZoom[mediaItems[activeIndex]?.url] || 100) / 100})`,
                                                    filter: getFilterString(mediaItems[activeIndex]?.url),
                                                    clipPath: aspectRatio === 'free' ? getClipPathString(mediaItems[activeIndex]?.url) : undefined,
                                                    pointerEvents: 'none'
                                                }}
                                            />
                                        ) : (
                                            <img 
                                                src={mediaItems[activeIndex]?.url} 
                                                className={`w-full h-full ${aspectRatio !== 'original' && aspectRatio !== 'free' ? 'object-cover' : 'object-contain'}`} 
                                                alt="Preview" 
                                                style={{
                                                    transform: `translate(${mediaPan[mediaItems[activeIndex]?.url]?.x || 0}px, ${mediaPan[mediaItems[activeIndex]?.url]?.y || 0}px) scale(${(mediaZoom[mediaItems[activeIndex]?.url] || 100) / 100})`,
                                                    filter: getFilterString(mediaItems[activeIndex]?.url),
                                                    clipPath: aspectRatio === 'free' ? getClipPathString(mediaItems[activeIndex]?.url) : undefined,
                                                    pointerEvents: 'none'
                                                }}
                                            />
                                        )}
                                        {mediaItems.length > 1 && (
                                            <div className="absolute top-4 right-4 bg-black/60 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-white z-10 pointer-events-none">
                                                {activeIndex + 1} / {mediaItems.length}
                                            </div>
                                        )}

                                        {((mediaAdjustments[mediaItems[activeIndex]?.url]?.vignette) || 0) > 0 && (
                                            <div 
                                                className="absolute inset-0 pointer-events-none z-10" 
                                                style={{
                                                    background: `radial-gradient(circle, transparent 30%, rgba(0,0,0,${(mediaAdjustments[mediaItems[activeIndex]?.url]?.vignette || 0) / 100}) 100%)`
                                                }}
                                            />
                                        )}

                                        {(mediaTextOverlays[mediaItems[activeIndex]?.url] || []).map(overlay => (
                                            <div
                                                key={overlay.id}
                                                onMouseDown={(e) => handleTextOverlayDrag(overlay.id, e)}
                                                onTouchStart={(e) => handleTextOverlayDrag(overlay.id, e)}
                                                className="absolute z-20 cursor-move select-none px-3 py-1.5 rounded-lg shadow-lg font-bold text-center transition-transform hover:scale-105"
                                                style={{
                                                    left: `${overlay.x}%`,
                                                    top: `${overlay.y}%`,
                                                    transform: 'translate(-50%, -50%)',
                                                    color: overlay.color,
                                                    backgroundColor: overlay.bgColor,
                                                    fontSize: `${overlay.fontSize}px`,
                                                    maxWidth: '85%',
                                                    wordBreak: 'break-word',
                                                    textShadow: overlay.bgColor === 'transparent' ? '0 2px 4px rgba(0,0,0,0.8)' : 'none'
                                                }}
                                            >
                                                {overlay.text}
                                            </div>
                                        ))}

                                        {aspectRatio === 'free' && (() => {
                                            const crop = mediaCrop[mediaItems[activeIndex]?.url] || { top: 0, right: 0, bottom: 0, left: 0 };
                                            return (
                                                <div className="absolute inset-0 z-20 pointer-events-none">
                                                    <div className="absolute bg-black/50 pointer-events-none" style={{ top: 0, left: 0, right: 0, height: `${crop.top}%` }} />
                                                    <div className="absolute bg-black/50 pointer-events-none" style={{ bottom: 0, left: 0, right: 0, height: `${crop.bottom}%` }} />
                                                    <div className="absolute bg-black/50 pointer-events-none" style={{ top: `${crop.top}%`, bottom: `${crop.bottom}%`, left: 0, width: `${crop.left}%` }} />
                                                    <div className="absolute bg-black/50 pointer-events-none" style={{ top: `${crop.top}%`, bottom: `${crop.bottom}%`, right: 0, width: `${crop.right}%` }} />
                                                    <div
                                                        className="absolute border-2 border-white shadow-2xl cursor-move select-none pointer-events-auto"
                                                        style={{
                                                            top: `${crop.top}%`,
                                                            right: `${crop.right}%`,
                                                            bottom: `${crop.bottom}%`,
                                                            left: `${crop.left}%`,
                                                        }}
                                                        onMouseDown={(e) => handleCropDrag(e, 'center')}
                                                        onTouchStart={(e) => handleCropDrag(e, 'center')}
                                                    >
                                                        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.2) 1px, transparent 1px)', backgroundSize: '33.33% 33.33%' }} />
                                                        {(['tl','tr','bl','br'] as const).map(h => (
                                                            <div
                                                                key={h}
                                                                className={`absolute w-5 h-5 z-30 pointer-events-auto ${h.includes('t') ? '-top-1' : '-bottom-1'} ${h.includes('l') ? '-left-1' : '-right-1'}`}
                                                                style={{ cursor: h === 'tl' || h === 'br' ? 'nwse-resize' : 'nesw-resize' }}
                                                                onMouseDown={(e) => { e.stopPropagation(); handleCropDrag(e, h); }}
                                                                onTouchStart={(e) => { e.stopPropagation(); handleCropDrag(e, h); }}
                                                            >
                                                                <div className={`absolute w-4 h-4 border-white border-4 ${h.includes('t') ? 'border-b-0' : 'border-t-0'} ${h.includes('l') ? 'border-r-0' : 'border-l-0'} top-0 left-0`} />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    
                                    <div className="mt-6 w-full max-w-lg overflow-x-auto flex gap-3 pb-2 shrink-0">
                                        {mediaItems.map((item, idx) => (
                                            <div 
                                                key={idx} 
                                                onClick={() => setActiveIndex(idx)}
                                                className={`relative w-20 h-20 shrink-0 rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${activeIndex === idx ? 'border-primary scale-105' : 'border-transparent hover:border-primary/50'}`}
                                            >
                                                <Button 
                                                    size="icon" 
                                                    variant="destructive" 
                                                    className="absolute top-1 right-1 h-5 w-5 rounded-full p-0.5 opacity-0 group-hover:opacity-100 z-10"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        const newItems = [...mediaItems];
                                                        newItems.splice(idx, 1);
                                                        setMediaItems(newItems);
                                                        if (activeIndex >= newItems.length) {
                                                            setActiveIndex(Math.max(0, newItems.length - 1));
                                                        }
                                                        if (newItems.length === 0) setStep('select');
                                                    }}
                                                >
                                                    <X className="h-3 w-3" />
                                                </Button>
                                                {item.type === 'video' ? (
                                                    <div className="w-full h-full bg-zinc-900 relative">
                                                        <video src={item.url} className="w-full h-full object-cover opacity-80" />
                                                        <Video className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" />
                                                    </div>
                                                ) : (
                                                    <img 
                                                        src={item.url} 
                                                        className="w-full h-full object-cover" 
                                                        alt={`Thumb ${idx}`}
                                                        style={{ filter: getFilterString(item.url) }}
                                                    />
                                                )}
                                            </div>
                                        ))}
                                        {mediaItems.length < 10 && (
                                            <button 
                                                onClick={() => fileInputRef.current?.click()}
                                                className="w-20 h-20 shrink-0 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center text-muted-foreground hover:bg-white/5 hover:text-white transition-all hover:border-primary/50"
                                            >
                                                {isUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                             <div className="w-full md:w-[380px] lg:w-[420px] flex flex-col bg-card text-card-foreground shrink-0 border-t md:border-t-0 md:border-l border-border/50 select-none dark:bg-zinc-950 dark:text-white dark:border-white/10">
                                 <div className="flex items-center justify-around p-3 border-b border-border/50 bg-muted/40 dark:bg-zinc-900/60 dark:border-white/10">
                                     {[
                                         { name: 'Text', icon: 'Aa', mode: 'text' },
                                         { name: 'Filter', icon: <div className="w-4 h-4 rounded-full border-2 border-foreground/80 dark:border-white/80 flex items-center justify-center opacity-90"><div className="w-2 h-2 rounded-full border border-foreground/80 dark:border-white/80 translate-x-0.5" /></div>, mode: 'filter' },
                                         { name: 'Edit', icon: <Sliders className="w-4 h-4 text-foreground/80 dark:text-white/80" />, mode: 'adjust' },
                                         { name: 'Ratio', icon: <Crop className="w-4 h-4 text-foreground/80 dark:text-white/80" />, mode: 'crop' }
                                     ].map(tool => (
                                         <button
                                             key={tool.name}
                                             onClick={() => enterSubMenu(tool.mode as any)}
                                             className={`flex flex-col items-center px-3 py-2 rounded-xl transition-all ${
                                                 editMode === tool.mode 
                                                     ? 'bg-primary text-primary-foreground font-bold shadow-sm dark:bg-zinc-800 dark:text-white' 
                                                     : 'text-muted-foreground hover:text-foreground hover:bg-muted/70 dark:text-white/60 dark:hover:text-white dark:hover:bg-zinc-800/50'
                                             }`}
                                         >
                                             <div className="w-8 h-8 flex items-center justify-center">
                                                 {typeof tool.icon === 'string' ? (
                                                     <span className="font-serif font-bold text-base">{tool.icon}</span>
                                                 ) : tool.icon}
                                             </div>
                                             <span className="text-[10px] font-medium">{tool.name}</span>
                                         </button>
                                     ))}
                                 </div>

                                 <div className="p-4 flex-1 overflow-y-auto space-y-4">
                                     <div className="flex items-center justify-between border-b border-border/50 dark:border-white/10 pb-2">
                                         <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-white/50">
                                             {isFilterIntensityOpen ? `${selectedFilterName} Intensity` : activeAdjustmentTool ? activeAdjustmentTool : (editMode === 'filter' ? 'Filters' : editMode === 'adjust' ? 'Edit Adjustments' : editMode === 'crop' ? 'Crop & Ratio' : editMode === 'text' ? 'Text Overlays' : 'Photo Editor')}
                                         </span>
                                         {editMode !== 'main' && (
                                             <div className="flex items-center gap-2">
                                                 <button onClick={cancelSubMenu} className="text-xs font-semibold text-muted-foreground hover:text-foreground dark:text-white/60 dark:hover:text-white">
                                                     Cancel
                                                 </button>
                                                 <button onClick={finishSubMenu} className="text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 dark:bg-zinc-800 dark:text-white px-3 py-1 rounded-md">
                                                     Done
                                                 </button>
                                             </div>
                                         )}
                                     </div>

                                     {isFilterIntensityOpen ? (
                                         <div className="space-y-4 text-center py-4">
                                             <span className="text-sm font-semibold text-foreground dark:text-white/90">
                                                 Intensity: {mediaFilterIntensity[mediaItems[activeIndex]?.url] ?? 50}%
                                             </span>
                                             <div className="px-4">
                                                 <input 
                                                     type="range"
                                                     min="0"
                                                     max="100"
                                                     value={mediaFilterIntensity[mediaItems[activeIndex]?.url] ?? 50}
                                                     onChange={(e) => {
                                                         const val = parseInt(e.target.value);
                                                         setMediaFilterIntensity(prev => ({
                                                             ...prev,
                                                             [mediaItems[activeIndex]?.url]: val
                                                         }));
                                                     }}
                                                     className="w-full accent-primary dark:accent-white h-1.5 bg-muted dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                                                 />
                                             </div>
                                         </div>
                                     ) : activeAdjustmentTool ? (
                                         <div className="space-y-4 text-center py-4">
                                             {(() => {
                                                 const config = TOOL_CONFIGS[activeAdjustmentTool] || { key: 'brightness', name: activeAdjustmentTool, min: 50, max: 150, defaultVal: 100 };
                                                 const storedVal = mediaAdjustments[mediaItems[activeIndex]?.url]?.[config.key] ?? config.defaultVal;
                                                 const displayVal = config.defaultVal === 100 ? storedVal - 100 : storedVal;
                                                 const minVal = config.defaultVal === 100 ? config.min - 100 : config.min;
                                                 const maxVal = config.defaultVal === 100 ? config.max - 100 : config.max;

                                                 return (
                                                     <>
                                                         <span className="text-sm font-semibold text-foreground dark:text-white/90">
                                                             {displayVal > 0 ? `+${displayVal}` : displayVal}
                                                         </span>
                                                         <div className="px-4">
                                                             <input 
                                                                 type="range"
                                                                 min={minVal}
                                                                 max={maxVal}
                                                                 value={displayVal}
                                                                 onChange={(e) => {
                                                                     const rawVal = parseInt(e.target.value);
                                                                     const newStoredVal = config.defaultVal === 100 ? rawVal + 100 : rawVal;
                                                                     setMediaAdjustments(prev => {
                                                                         const current = prev[mediaItems[activeIndex]?.url] || {};
                                                                         return {
                                                                             ...prev,
                                                                             [mediaItems[activeIndex]?.url]: { ...current, [config.key]: newStoredVal }
                                                                         };
                                                                     });
                                                                 }}
                                                                 className="w-full accent-primary dark:accent-white h-1.5 bg-muted dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                                                             />
                                                         </div>
                                                     </>
                                                 );
                                             })()}
                                         </div>
                                     ) : editMode === 'text' ? (
                                         <div className="space-y-4 py-1">
                                             <div className="flex gap-2">
                                                 <input
                                                     type="text"
                                                     value={newOverlayText}
                                                     onChange={(e) => setNewOverlayText(e.target.value)}
                                                     placeholder="Type text on photo..."
                                                     className="flex-1 bg-background dark:bg-zinc-900 border border-border dark:border-white/20 rounded-xl px-3 py-2 text-xs text-foreground dark:text-white placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                                                 />
                                                 <Button
                                                     onClick={() => {
                                                         if (!newOverlayText.trim()) return;
                                                         const url = mediaItems[activeIndex]?.url;
                                                         if (!url) return;
                                                         if (editingTextId) {
                                                             setMediaTextOverlays(prev => ({
                                                                 ...prev,
                                                                 [url]: (prev[url] || []).map(o => o.id === editingTextId ? {
                                                                     ...o,
                                                                     text: newOverlayText,
                                                                     color: selectedTextColor,
                                                                     bgColor: selectedTextBg,
                                                                     fontSize: selectedFontSize
                                                                 } : o)
                                                             }));
                                                             setEditingTextId(null);
                                                         } else {
                                                             const newItem: TextOverlayItem = {
                                                                 id: Date.now().toString(),
                                                                 text: newOverlayText,
                                                                 color: selectedTextColor,
                                                                 bgColor: selectedTextBg,
                                                                 fontSize: selectedFontSize,
                                                                 x: 50,
                                                                 y: 50
                                                             };
                                                             setMediaTextOverlays(prev => ({
                                                                 ...prev,
                                                                 [url]: [...(prev[url] || []), newItem]
                                                             }));
                                                         }
                                                         setNewOverlayText('');
                                                     }}
                                                     className="bg-primary text-primary-foreground font-semibold hover:bg-primary/90 text-xs px-4 rounded-xl shadow-sm"
                                                 >
                                                     {editingTextId ? 'Save' : 'Add'}
                                                 </Button>
                                             </div>

                                             <div>
                                                 <p className="text-[11px] font-bold text-muted-foreground dark:text-white/50 mb-2">Text Color & Fill</p>
                                                 <div className="flex items-center justify-between gap-2">
                                                     <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
                                                         {[
                                                             { color: '#FFFFFF', name: 'White' },
                                                             { color: '#000000', name: 'Black' },
                                                             { color: '#FACC15', name: 'Yellow' },
                                                             { color: '#EF4444', name: 'Red' },
                                                             { color: '#22C55E', name: 'Green' },
                                                             { color: '#06B6D4', name: 'Cyan' },
                                                             { color: '#A855F7', name: 'Purple' },
                                                             { color: '#F97316', name: 'Orange' },
                                                         ].map(item => (
                                                             <button
                                                                 key={item.color}
                                                                 onClick={() => setSelectedTextColor(item.color)}
                                                                 className={`w-6 h-6 rounded-full shrink-0 border border-border dark:border-white/30 transition-transform ${selectedTextColor === item.color ? 'scale-125 ring-2 ring-primary dark:ring-white' : ''}`}
                                                                 style={{ backgroundColor: item.color }}
                                                             />
                                                         ))}
                                                     </div>
                                                     <button
                                                         onClick={() => setSelectedTextBg(prev => prev === 'transparent' ? 'rgba(0,0,0,0.65)' : prev === 'rgba(0,0,0,0.65)' ? '#FFFFFF' : 'transparent')}
                                                         className="text-[10px] font-bold px-2.5 py-1.5 bg-muted dark:bg-zinc-900 text-foreground dark:text-white/90 border border-border dark:border-white/20 rounded-lg shrink-0 hover:bg-muted/80"
                                                     >
                                                         Bg: {selectedTextBg === 'transparent' ? 'None' : selectedTextBg === '#FFFFFF' ? 'White' : 'Dark'}
                                                     </button>
                                                 </div>
                                             </div>

                                             <div className="flex items-center justify-between text-[11px] text-muted-foreground dark:text-white/80 pt-2 border-t border-border/50 dark:border-white/10">
                                                 <div className="flex items-center gap-2">
                                                     <span>Font Size:</span>
                                                     {[16, 22, 28, 34].map(sz => (
                                                         <button
                                                             key={sz}
                                                             onClick={() => setSelectedFontSize(sz)}
                                                             className={`px-2.5 py-1 rounded text-[10px] ${selectedFontSize === sz ? 'bg-primary text-primary-foreground font-bold shadow-sm' : 'bg-muted dark:bg-zinc-800 text-foreground dark:text-white/70'}`}
                                                         >
                                                             {sz === 16 ? 'S' : sz === 22 ? 'M' : sz === 28 ? 'L' : 'XL'}
                                                         </button>
                                                     ))}
                                                 </div>

                                                 {(mediaTextOverlays[mediaItems[activeIndex]?.url] || []).length > 0 && (
                                                     <button
                                                         onClick={() => {
                                                             const url = mediaItems[activeIndex]?.url;
                                                             if (url) setMediaTextOverlays(prev => ({ ...prev, [url]: [] }));
                                                             setEditingTextId(null);
                                                             setNewOverlayText('');
                                                         }}
                                                         className="text-destructive hover:text-destructive/80 font-semibold"
                                                     >
                                                         Clear All
                                                     </button>
                                                 )}
                                             </div>
                                         </div>
                                     ) : editMode === 'filter' ? (
                                         <div className="space-y-3">
                                             <div className="grid grid-cols-3 gap-2 max-h-[360px] overflow-y-auto pr-1">
                                                 {[
                                                     { name: 'Normal', initial: 'N', filterVal: 'none' },
                                                     { name: 'Paris', initial: 'P', filterVal: 'contrast(1.1) brightness(1.08) saturate(1.05)' },
                                                     { name: 'Los Angeles', initial: 'L', filterVal: 'saturate(1.25) contrast(1.1) hue-rotate(5deg)' },
                                                     { name: 'Simple Cool', initial: 'S', filterVal: 'sepia(0.1) contrast(0.95) saturate(1.1) hue-rotate(-15deg)' },
                                                     { name: 'Boost', initial: 'B', filterVal: 'contrast(1.3) saturate(1.35) brightness(1.05)' },
                                                     { name: 'Boost Warm', initial: 'B', filterVal: 'sepia(0.2) contrast(1.2) saturate(1.2) brightness(1.05)' },
                                                     { name: 'Boost Cool', initial: 'B', filterVal: 'hue-rotate(-20deg) contrast(1.2) saturate(1.2)' },
                                                     { name: 'Clarendon', initial: 'C', filterVal: 'contrast(1.2) saturate(1.3) brightness(1.05)' },
                                                     { name: 'Gingham', initial: 'G', filterVal: 'sepia(0.15) contrast(0.9) saturate(0.9) brightness(0.95)' }
                                                 ].map(item => {
                                                     const isSelected = selectedFilterName === item.name;
                                                     return (
                                                         <button 
                                                             key={item.name} 
                                                             onClick={() => {
                                                                 if (isSelected) {
                                                                     setToolSnapshotValue(mediaFilterIntensity[mediaItems[activeIndex]?.url] ?? 100);
                                                                     setIsFilterIntensityOpen(true);
                                                                 } else {
                                                                     setSelectedFilterName(item.name);
                                                                     setMediaFilters(prev => ({
                                                                         ...prev,
                                                                         [mediaItems[activeIndex]?.url]: item.filterVal
                                                                     }));
                                                                 }
                                                             }}
                                                             className="flex flex-col items-center text-center transition-all group"
                                                         >
                                                             <div className={`w-full aspect-square rounded-xl bg-muted dark:bg-zinc-800 overflow-hidden relative border-2 transition-all flex items-center justify-center ${
                                                                 isSelected ? 'border-primary dark:border-white shadow-md scale-102 ring-2 ring-primary/20 dark:ring-white/20' : 'border-transparent opacity-85 hover:opacity-100'
                                                             }`}>
                                                                 <img src={mediaItems[activeIndex]?.url} className="w-full h-full object-cover" alt={item.name} style={{ filter: item.filterVal }} />
                                                                 <span className="absolute text-white font-bold text-sm drop-shadow-md pointer-events-none">
                                                                     {item.initial}
                                                                 </span>
                                                             </div>
                                                             <span className="text-[10px] font-semibold text-foreground/80 dark:text-white/80 mt-1">{item.name}</span>
                                                         </button>
                                                     );
                                                 })}
                                             </div>
                                             <p className="text-center text-[11px] text-muted-foreground dark:text-white/50 font-medium">
                                                 Tap filter again to adjust intensity
                                             </p>
                                         </div>
                                     ) : editMode === 'crop' ? (
                                         <div className="space-y-6 py-2">
                                             <div>
                                                 <p className="text-[11px] font-bold text-muted-foreground dark:text-white/50 uppercase tracking-wider mb-3">Aspect Ratio</p>
                                                 <div className="grid grid-cols-3 gap-2">
                                                     {(['original', '1:1', '4:5', '16:9', 'free'] as const).map(ratio => (
                                                         <Button 
                                                             key={ratio} 
                                                             variant={aspectRatio === ratio ? 'default' : 'outline'} 
                                                             onClick={() => setAspectRatio(ratio)}
                                                             className={`text-[11px] h-9 font-bold tracking-wide capitalize ${aspectRatio === ratio ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm' : 'bg-background text-foreground border-border hover:bg-muted dark:bg-transparent dark:text-white/80 dark:border-white/20'}`}
                                                         >
                                                             {ratio === 'original' ? 'Original' : ratio === 'free' ? 'Free Crop' : ratio}
                                                         </Button>
                                                     ))}
                                                 </div>
                                             </div>
                                             
                                             <div className="pt-2 border-t border-border/50 dark:border-white/10">
                                                 <p className="text-[11px] font-bold text-muted-foreground dark:text-white/50 uppercase tracking-wider mb-3">Crop Zoom</p>
                                                 <div className="flex items-center gap-3">
                                                     <ZoomOut className="h-4 w-4 text-muted-foreground dark:text-white/50" />
                                                     <input 
                                                         type="range" 
                                                         min="100" 
                                                         max="200" 
                                                         value={mediaZoom[mediaItems[activeIndex]?.url] || 100} 
                                                         onChange={(e) => {
                                                             const z = parseInt(e.target.value);
                                                             setMediaZoom(prev => ({ ...prev, [mediaItems[activeIndex].url]: z }));
                                                         }}
                                                         className="flex-1 accent-primary dark:accent-white h-1.5 bg-muted dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer" 
                                                     />
                                                     <ZoomIn className="h-4 w-4 text-muted-foreground dark:text-white/50" />
                                                 </div>
                                             </div>
                                         </div>
                                     ) : (
                                         <div className="space-y-3">
                                             <div className="grid grid-cols-3 gap-3">
                                                 {[
                                                     { name: 'Sharpen', icon: Maximize },
                                                     { name: 'Lux', icon: Sparkles },
                                                     { name: 'Brightness', icon: Sun },
                                                     { name: 'Contrast', icon: Sliders },
                                                     { name: 'Structure', icon: Crop },
                                                     { name: 'Warmth', icon: Thermometer },
                                                     { name: 'Saturation', icon: Droplets },
                                                     { name: 'Colour', icon: Palette },
                                                     { name: 'Fade', icon: Cloud },
                                                     { name: 'Vignette', icon: Circle }
                                                 ].map(tool => (
                                                     <button
                                                         key={tool.name}
                                                         onClick={() => {
                                                             const config = TOOL_CONFIGS[tool.name];
                                                             const key = config ? config.key : (tool.name.toLowerCase() as any);
                                                             const def = config ? config.defaultVal : 0;
                                                             const currentVal = mediaAdjustments[mediaItems[activeIndex]?.url]?.[key as keyof typeof mediaAdjustments[string]] ?? def;
                                                             setToolSnapshotValue(currentVal);
                                                             setActiveAdjustmentTool(tool.name);
                                                         }}
                                                         className="flex flex-col items-center p-3 rounded-xl bg-muted/40 border border-border/60 hover:border-primary hover:bg-muted/80 dark:bg-zinc-900 dark:border-white/10 dark:hover:border-white/40 dark:hover:bg-zinc-800 transition-all group"
                                                     >
                                                         <div className="w-10 h-10 rounded-full border border-border dark:border-white/30 flex items-center justify-center text-foreground dark:text-white mb-1.5 group-hover:border-primary dark:group-hover:border-white group-hover:text-primary">
                                                             <tool.icon className="h-5 w-5 stroke-[1.5]" />
                                                         </div>
                                                         <span className="text-[11px] font-semibold text-foreground/80 dark:text-white/80 group-hover:text-foreground">{tool.name}</span>
                                                     </button>
                                                 ))}
                                             </div>
                                         </div>
                                     )}
                                 </div>

                                 {/* Sidebar Bottom Action / Next */}
                                 <div className="p-4 border-t border-border/50 bg-muted/30 dark:border-white/10 dark:bg-zinc-900/80 flex items-center justify-between mt-auto">
                                     <Button 
                                         variant="ghost" 
                                         onClick={() => setStep('select')}
                                         className="text-muted-foreground hover:text-foreground dark:text-white/60 dark:hover:text-white text-xs"
                                     >
                                         Back
                                     </Button>
                                     <Button 
                                         onClick={() => {
                                             setDetailsActiveIndex(activeIndex);
                                             setStep('details');
                                         }}
                                         className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold py-2.5 px-7 rounded-full text-xs shadow-lg"
                                     >
                                         Next →
                                     </Button>
                                 </div>
                             </div>
                        </div>
                        ) : (
                            // MOBILE LAYOUT
                            <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden animate-in slide-in-from-right-8 duration-300 relative select-none">
                            
                            {/* Custom Header for Main Edit Mode */}
                            {editMode === 'main' && (
                                <div className="absolute top-0 left-0 right-0 h-14 flex items-center px-4 z-20">
                                    <button 
                                        onClick={() => setStep('select')}
                                        className="text-white p-2"
                                    >
                                        <ArrowLeft className="w-6 h-6" />
                                    </button>
                                </div>
                            )}

                            {/* Main Photo Preview Canvas */}
                            <div className={`flex-1 flex items-center justify-center relative overflow-hidden ${editMode === 'main' ? '' : 'p-3'}`}>
                                <div 
                                    ref={containerRef}
                                    className={`bg-black overflow-hidden relative flex items-center justify-center select-none ${editMode === 'main' ? 'w-full' : 'rounded-lg shadow-2xl border border-white/10 max-h-[52vh] md:max-h-[60vh] max-w-full'}`}
                                    style={editMode === 'main' ? {
                                        width: '100%',
                                        aspectRatio: aspectRatio === '1:1' ? '1 / 1' : aspectRatio === '4:5' ? '4 / 5' : aspectRatio === '16:9' ? '16 / 9' : 'auto',
                                        maxHeight: '70vh'
                                    } : { 
                                        height: isMobile ? '340px' : '480px',
                                        width: aspectRatio === '1:1' 
                                            ? (isMobile ? '340px' : '480px') 
                                            : aspectRatio === '4:5' 
                                                ? (isMobile ? '272px' : '384px') 
                                                : aspectRatio === '16:9' 
                                                    ? (isMobile ? '340px' : '640px') 
                                                    : 'auto',
                                        aspectRatio: aspectRatio === 'original' ? 'auto' : undefined,
                                    }}
                                    onMouseDown={handleMouseDown}
                                    onMouseMove={handleMouseMove}
                                    onMouseUp={handleMouseUpOrLeave}
                                    onMouseLeave={handleMouseUpOrLeave}
                                    onTouchStart={handleTouchStart}
                                    onTouchMove={handleTouchMove}
                                    onTouchEnd={handleTouchEnd}
                                >
                                    {mediaItems[activeIndex]?.type === 'video' ? (
                                        <video 
                                            src={mediaItems[activeIndex].url} 
                                            className={`w-full h-full ${aspectRatio !== 'original' && aspectRatio !== 'free' ? 'object-cover' : 'object-contain'}`} 
                                            autoPlay loop muted 
                                            style={{
                                                transform: `translate(${mediaPan[mediaItems[activeIndex]?.url]?.x || 0}px, ${mediaPan[mediaItems[activeIndex]?.url]?.y || 0}px) scale(${(mediaZoom[mediaItems[activeIndex]?.url] || 100) / 100})`,
                                                filter: getFilterString(mediaItems[activeIndex]?.url)
                                            }}
                                        />
                                    ) : (
                                        <img 
                                            src={mediaItems[activeIndex].url} 
                                            className={`w-full h-full ${aspectRatio !== 'original' && aspectRatio !== 'free' ? 'object-cover' : 'object-contain'}`}
                                            alt="Preview" 
                                            style={{
                                                transform: `translate(${mediaPan[mediaItems[activeIndex]?.url]?.x || 0}px, ${mediaPan[mediaItems[activeIndex]?.url]?.y || 0}px) scale(${(mediaZoom[mediaItems[activeIndex]?.url] || 100) / 100})`,
                                                filter: getFilterString(mediaItems[activeIndex]?.url)
                                            }}
                                        />
                                    )}
                                    
                                    {/* Free Crop overlay - Mobile */}
                                    {editMode !== 'main' && aspectRatio === 'free' && (() => {
                                        const crop = mediaCrop[mediaItems[activeIndex]?.url] || { top: 0, right: 0, bottom: 0, left: 0 };
                                        return (
                                            <div className="absolute inset-0 pointer-events-none z-20">
                                                {/* 4 dark panels */}
                                                <div className="absolute bg-black/55 pointer-events-none" style={{ top: 0, left: 0, right: 0, height: `${crop.top}%` }} />
                                                <div className="absolute bg-black/55 pointer-events-none" style={{ bottom: 0, left: 0, right: 0, height: `${crop.bottom}%` }} />
                                                <div className="absolute bg-black/55 pointer-events-none" style={{ top: `${crop.top}%`, bottom: `${crop.bottom}%`, left: 0, width: `${crop.left}%` }} />
                                                <div className="absolute bg-black/55 pointer-events-none" style={{ top: `${crop.top}%`, bottom: `${crop.bottom}%`, right: 0, width: `${crop.right}%` }} />
                                                {/* Crop box */}
                                                <div
                                                    className="absolute border-2 border-white cursor-move pointer-events-auto"
                                                    style={{ top: `${crop.top}%`, right: `${crop.right}%`, bottom: `${crop.bottom}%`, left: `${crop.left}%` }}
                                                    onMouseDown={(e) => handleCropDrag(e, 'center')}
                                                    onTouchStart={(e) => { e.stopPropagation(); handleCropDrag(e, 'center'); }}
                                                >
                                                    {/* Rule of thirds grid */}
                                                    <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.25) 1px, transparent 1px)', backgroundSize: '33.33% 33.33%' }} />
                                                    {/* Corner handles */}
                                                    {(['tl','tr','bl','br'] as const).map(h => (
                                                        <div
                                                            key={h}
                                                            className={`absolute w-8 h-8 z-30 pointer-events-auto flex items-${h.includes('t') ? 'start' : 'end'} justify-${h.includes('l') ? 'start' : 'end'} ${h.includes('t') ? '-top-1' : '-bottom-1'} ${h.includes('l') ? '-left-1' : '-right-1'}`}
                                                            onMouseDown={(e) => { e.stopPropagation(); handleCropDrag(e, h); }}
                                                            onTouchStart={(e) => { e.stopPropagation(); e.preventDefault(); handleCropDrag(e, h); }}
                                                        >
                                                            <div className={`w-5 h-5 border-white border-[3px] ${h.includes('t') ? 'border-b-0' : 'border-t-0'} ${h.includes('l') ? 'border-r-0' : 'border-l-0'}`} />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Grid Overlay for framing/adjusting (Screenshot 4 & 5) */}
                                    {editMode !== 'main' && activeAdjustmentTool && (
                                        <div className="absolute inset-0 pointer-events-none z-10 grid grid-cols-3 grid-rows-3">
                                            <div className="border-b border-r border-white/30" />
                                            <div className="border-b border-r border-white/30" />
                                            <div className="border-b border-white/30" />
                                            <div className="border-b border-r border-white/30" />
                                            <div className="border-b border-r border-white/30" />
                                            <div className="border-b border-white/30" />
                                            <div className="border-r border-white/30" />
                                            <div className="border-r border-white/30" />
                                            <div />
                                        </div>
                                    )}

                                    {/* Vignette Overlay on mobile canvas */}
                                    {((mediaAdjustments[mediaItems[activeIndex]?.url]?.vignette) || 0) > 0 && (
                                        <div 
                                            className="absolute inset-0 pointer-events-none z-10" 
                                            style={{
                                                background: `radial-gradient(circle, transparent 30%, rgba(0,0,0,${(mediaAdjustments[mediaItems[activeIndex]?.url]?.vignette || 0) / 100}) 100%)`
                                            }}
                                        />
                                    )}

                                    {/* Text Overlays Layer */}
                                    {(mediaTextOverlays[mediaItems[activeIndex]?.url] || []).map(overlay => (
                                        <div
                                            key={overlay.id}
                                            onMouseDown={(e) => handleTextOverlayDrag(overlay.id, e)}
                                            onTouchStart={(e) => handleTextOverlayDrag(overlay.id, e)}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingTextId(overlay.id);
                                                setNewOverlayText(overlay.text);
                                                setSelectedTextColor(overlay.color);
                                                setSelectedTextBg(overlay.bgColor);
                                                setSelectedFontSize(overlay.fontSize);
                                                if (editMode !== 'text') {
                                                    enterSubMenu('text');
                                                }
                                            }}
                                            className="absolute z-20 cursor-move select-none px-3 py-1.5 rounded-lg shadow-lg font-bold text-center transition-transform hover:scale-105 active:scale-95"
                                            style={{
                                                left: `${overlay.x}%`,
                                                top: `${overlay.y}%`,
                                                transform: 'translate(-50%, -50%)',
                                                color: overlay.color,
                                                backgroundColor: overlay.bgColor,
                                                fontSize: `${overlay.fontSize}px`,
                                                maxWidth: '85%',
                                                wordBreak: 'break-word',
                                                textShadow: overlay.bgColor === 'transparent' ? '0 2px 4px rgba(0,0,0,0.8)' : 'none'
                                            }}
                                        >
                                            {overlay.text}
                                        </div>
                                    ))}

                                    {/* Floating Aspect Ratio Switcher */}
                                    {editMode !== 'main' && !activeAdjustmentTool && !isFilterIntensityOpen && (
                                        <div className="absolute bottom-3 left-3 z-30 flex items-center gap-1 bg-black/80 backdrop-blur-md p-1 rounded-full border border-white/20 shadow-xl">
                                            {(['original', '1:1', '4:5', '16:9'] as const).map(ratio => (
                                                <button
                                                    key={ratio}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setAspectRatio(ratio);
                                                    }}
                                                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full transition-all capitalize ${
                                                        aspectRatio === ratio ? 'bg-white text-black shadow font-bold' : 'text-white/80 hover:text-white'
                                                    }`}
                                                >
                                                    {ratio === 'original' ? 'Original' : ratio}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Editor Controls (Main Mode) */}
                            {editMode === 'main' ? (
                                <div className="bg-zinc-950 pb-4 pt-4 px-4 flex flex-col gap-6 z-10 border-t border-white/10">
                                    <div className="flex items-center justify-center gap-6 px-2">
                                        {[
                                            { name: 'Text', icon: 'Aa', action: () => enterSubMenu('text') },
                                            { name: 'Filter', icon: <div className="w-5 h-5 rounded-full border-2 border-white/80 flex items-center justify-center opacity-90"><div className="w-3 h-3 rounded-full border border-white/80 translate-x-1" /></div>, action: () => enterSubMenu('filter') },
                                            { name: 'Edit', icon: <Sliders className="w-5 h-5 text-white/80" />, action: () => enterSubMenu('adjust') },
                                            { name: 'Ratio', icon: <Crop className="w-5 h-5 text-white/80" />, action: () => enterSubMenu('crop') }
                                        ].map(tool => (
                                            <button 
                                                key={tool.name}
                                                onClick={tool.action}
                                                className="flex flex-col items-center shrink-0"
                                            >
                                                <div className="w-14 h-14 bg-zinc-800/80 rounded-2xl flex items-center justify-center mb-1 hover:bg-zinc-700 transition-colors">
                                                    {typeof tool.icon === 'string' ? (
                                                        <span className="text-white font-serif font-bold text-lg">{tool.icon}</span>
                                                    ) : tool.icon}
                                                </div>
                                                <span className="text-[11px] font-medium text-white/90">{tool.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-center justify-between mt-2">
                                        <div className="flex gap-2 overflow-x-auto scrollbar-none items-center pr-4">
                                            {mediaItems.map((item, idx) => (
                                                <div 
                                                    key={idx} 
                                                    className={`w-12 h-16 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${idx === activeIndex ? 'border-white' : 'border-transparent opacity-60'}`}
                                                    onClick={() => setActiveIndex(idx)}
                                                >
                                                    {item.type === 'video' ? (
                                                        <video src={item.url} className="w-full h-full object-cover" />
                                                    ) : (
                                                        <img src={item.url} className="w-full h-full object-cover" alt="thumbnail" />
                                                    )}
                                                </div>
                                            ))}
                                            <button 
                                                className="w-12 h-16 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0 ml-1"
                                                onClick={() => fileInputRef.current?.click()}
                                            >
                                                <span className="text-white text-xl font-light">+</span>
                                            </button>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                setDetailsActiveIndex(activeIndex);
                                                setStep('details');
                                            }}
                                            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-8 rounded-full shrink-0 ml-4 shadow-lg text-sm"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-zinc-900 rounded-t-3xl border-t border-white/10 shadow-2xl flex flex-col shrink-0 pb-2 z-10 relative mt-[-20px]">
                                    
                                    {/* Top Drag Handle Pill (Instagram APK) */}
                                    <div className="w-10 h-1 rounded-full bg-white/40 mx-auto mt-3 mb-2" />

                                {/* Sheet Content */}
                                <div className="px-4 py-3 min-h-[165px] flex flex-col justify-center">
                                    
                                    {/* 1. FILTER INTENSITY SLIDER */}
                                    {isFilterIntensityOpen ? (
                                        <div className="space-y-4 text-center animate-in fade-in duration-200 py-2">
                                            <span className="text-sm font-semibold text-white/90">
                                                {mediaFilterIntensity[mediaItems[activeIndex]?.url] ?? 50}
                                            </span>
                                            <div className="px-6">
                                                <input 
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    value={mediaFilterIntensity[mediaItems[activeIndex]?.url] ?? 50}
                                                    onChange={(e) => {
                                                        const val = parseInt(e.target.value);
                                                        setMediaFilterIntensity(prev => ({
                                                            ...prev,
                                                            [mediaItems[activeIndex]?.url]: val
                                                        }));
                                                    }}
                                                    className="w-full accent-white h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                    ) : activeAdjustmentTool ? (
                                        /* 2. SPECIFIC EDIT TOOL SLIDER */
                                        <div className="space-y-4 text-center animate-in fade-in duration-200 py-2">
                                            {(() => {
                                                const config = TOOL_CONFIGS[activeAdjustmentTool] || { key: 'brightness', name: activeAdjustmentTool, min: 50, max: 150, defaultVal: 100 };
                                                const storedVal = mediaAdjustments[mediaItems[activeIndex]?.url]?.[config.key] ?? config.defaultVal;
                                                const displayVal = config.defaultVal === 100 ? storedVal - 100 : storedVal;
                                                const minVal = config.defaultVal === 100 ? config.min - 100 : config.min;
                                                const maxVal = config.defaultVal === 100 ? config.max - 100 : config.max;

                                                return (
                                                    <>
                                                        <span className="text-sm font-semibold text-white/90">
                                                            {displayVal > 0 ? `+${displayVal}` : displayVal}
                                                        </span>
                                                        <div className="px-6">
                                                            <input 
                                                                type="range"
                                                                min={minVal}
                                                                max={maxVal}
                                                                value={displayVal}
                                                                onChange={(e) => {
                                                                    const rawVal = parseInt(e.target.value);
                                                                    const newStoredVal = config.defaultVal === 100 ? rawVal + 100 : rawVal;
                                                                    setMediaAdjustments(prev => {
                                                                        const current = prev[mediaItems[activeIndex]?.url] || {};
                                                                        return {
                                                                            ...prev,
                                                                            [mediaItems[activeIndex]?.url]: { ...current, [config.key]: newStoredVal }
                                                                        };
                                                                    });
                                                                }}
                                                                className="w-full accent-white h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                                                            />
                                                        </div>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    ) : editMode === 'text' ? (
                                        /* 3. TEXT OVERLAY EDITOR */
                                        <div className="space-y-3 animate-in fade-in duration-200 py-1">
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={newOverlayText}
                                                    onChange={(e) => setNewOverlayText(e.target.value)}
                                                    placeholder="Type text on photo..."
                                                    className="flex-1 bg-zinc-800 border border-white/20 rounded-xl px-3 py-2 text-xs text-white placeholder-white/40 focus:outline-none focus:border-white"
                                                />
                                                <Button
                                                    onClick={() => {
                                                        if (!newOverlayText.trim()) return;
                                                        const url = mediaItems[activeIndex]?.url;
                                                        if (!url) return;
                                                        if (editingTextId) {
                                                            setMediaTextOverlays(prev => ({
                                                                ...prev,
                                                                [url]: (prev[url] || []).map(o => o.id === editingTextId ? {
                                                                    ...o,
                                                                    text: newOverlayText,
                                                                    color: selectedTextColor,
                                                                    bgColor: selectedTextBg,
                                                                    fontSize: selectedFontSize
                                                                } : o)
                                                            }));
                                                            setEditingTextId(null);
                                                        } else {
                                                            const newItem: TextOverlayItem = {
                                                                id: Date.now().toString(),
                                                                text: newOverlayText,
                                                                color: selectedTextColor,
                                                                bgColor: selectedTextBg,
                                                                fontSize: selectedFontSize,
                                                                x: 50,
                                                                y: 50
                                                            };
                                                            setMediaTextOverlays(prev => ({
                                                                ...prev,
                                                                [url]: [...(prev[url] || []), newItem]
                                                            }));
                                                        }
                                                        setNewOverlayText('');
                                                    }}
                                                    className="bg-white text-black font-semibold hover:bg-white/90 text-xs px-4 rounded-xl"
                                                >
                                                    {editingTextId ? 'Save' : 'Add'}
                                                </Button>
                                            </div>

                                            {/* Color Palette & Background Toggle */}
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
                                                    {[
                                                        { color: '#FFFFFF', name: 'White' },
                                                        { color: '#000000', name: 'Black' },
                                                        { color: '#FACC15', name: 'Yellow' },
                                                        { color: '#EF4444', name: 'Red' },
                                                        { color: '#22C55E', name: 'Green' },
                                                        { color: '#06B6D4', name: 'Cyan' },
                                                        { color: '#A855F7', name: 'Purple' },
                                                        { color: '#F97316', name: 'Orange' },
                                                    ].map(item => (
                                                        <button
                                                            key={item.color}
                                                            onClick={() => setSelectedTextColor(item.color)}
                                                            className={`w-6 h-6 rounded-full shrink-0 border border-white/30 transition-transform ${selectedTextColor === item.color ? 'scale-125 ring-2 ring-white' : ''}`}
                                                            style={{ backgroundColor: item.color }}
                                                        />
                                                    ))}
                                                </div>

                                                <button
                                                    onClick={() => setSelectedTextBg(prev => prev === 'transparent' ? 'rgba(0,0,0,0.65)' : prev === 'rgba(0,0,0,0.65)' ? '#FFFFFF' : 'transparent')}
                                                    className="text-[10px] font-bold px-2 py-1 bg-zinc-800 rounded-lg text-white/90 border border-white/20 shrink-0"
                                                >
                                                    Bg: {selectedTextBg === 'transparent' ? 'None' : selectedTextBg === '#FFFFFF' ? 'White' : 'Dark'}
                                                </button>
                                            </div>

                                            {/* Font Size & Clear */}
                                            <div className="flex items-center justify-between text-[11px] text-white/80">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px]">Size:</span>
                                                    {[16, 22, 28, 34].map(sz => (
                                                        <button
                                                            key={sz}
                                                            onClick={() => setSelectedFontSize(sz)}
                                                            className={`px-2 py-0.5 rounded text-[10px] ${selectedFontSize === sz ? 'bg-white text-black font-bold' : 'bg-zinc-800 text-white/70'}`}
                                                        >
                                                            {sz === 16 ? 'S' : sz === 22 ? 'M' : sz === 28 ? 'L' : 'XL'}
                                                        </button>
                                                    ))}
                                                </div>

                                                {(mediaTextOverlays[mediaItems[activeIndex]?.url] || []).length > 0 && (
                                                    <button
                                                        onClick={() => {
                                                            const url = mediaItems[activeIndex]?.url;
                                                            if (url) setMediaTextOverlays(prev => ({ ...prev, [url]: [] }));
                                                            setEditingTextId(null);
                                                            setNewOverlayText('');
                                                        }}
                                                        className="text-red-400 hover:text-red-300 font-medium text-[11px]"
                                                    >
                                                        Clear Text
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ) : editMode === 'filter' ? (
                                        /* 4. FILTER CAROUSEL */
                                        <div className="space-y-2 animate-in fade-in duration-200">
                                            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none px-2 items-center">
                                                {[
                                                    { name: 'Normal', initial: 'N', filterVal: 'none' },
                                                    { name: 'Paris', initial: 'P', filterVal: 'contrast(1.1) brightness(1.08) saturate(1.05)' },
                                                    { name: 'Los Angeles', initial: 'L', filterVal: 'saturate(1.25) contrast(1.1) hue-rotate(5deg)' },
                                                    { name: 'Simple Cool', initial: 'S', filterVal: 'sepia(0.1) contrast(0.95) saturate(1.1) hue-rotate(-15deg)' },
                                                    { name: 'Boost', initial: 'B', filterVal: 'contrast(1.3) saturate(1.35) brightness(1.05)' },
                                                    { name: 'Boost Warm', initial: 'B', filterVal: 'sepia(0.2) contrast(1.2) saturate(1.2) brightness(1.05)' },
                                                    { name: 'Boost Cool', initial: 'B', filterVal: 'hue-rotate(-20deg) contrast(1.2) saturate(1.2)' },
                                                    { name: 'Clarendon', initial: 'C', filterVal: 'contrast(1.2) saturate(1.3) brightness(1.05)' },
                                                    { name: 'Gingham', initial: 'G', filterVal: 'sepia(0.15) contrast(0.9) saturate(0.9) brightness(0.95)' }
                                                ].map(item => {
                                                    const isSelected = selectedFilterName === item.name;
                                                    return (
                                                        <button 
                                                            key={item.name} 
                                                            onClick={() => {
                                                                if (isSelected) {
                                                                    setToolSnapshotValue(mediaFilterIntensity[mediaItems[activeIndex]?.url] ?? 100);
                                                                    setIsFilterIntensityOpen(true);
                                                                } else {
                                                                    setSelectedFilterName(item.name);
                                                                    setMediaFilters(prev => ({
                                                                        ...prev,
                                                                        [mediaItems[activeIndex]?.url]: item.filterVal
                                                                    }));
                                                                }
                                                            }}
                                                            className="flex flex-col items-center shrink-0 text-center transition-all group"
                                                        >
                                                            <span className="text-[11px] font-semibold text-white/80 mb-1.5">{item.name}</span>
                                                            <div className={`w-20 h-20 rounded-2xl bg-zinc-800 overflow-hidden relative border-2 transition-all flex items-center justify-center ${
                                                                isSelected ? 'border-white shadow-xl scale-102 ring-2 ring-white/20' : 'border-transparent opacity-85 hover:opacity-100'
                                                            }`}>
                                                                <img src={mediaItems[activeIndex]?.url} className="w-full h-full object-cover" alt={item.name} style={{ filter: item.filterVal }} />
                                                                <span className="absolute text-white font-bold text-lg drop-shadow-md pointer-events-none">
                                                                    {item.initial}
                                                                </span>
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            <p className="text-center text-[11px] text-white/50 font-medium pt-1">
                                                Tap again to adjust
                                            </p>
                                        </div>
                                    ) : editMode === 'crop' ? (
                                        /* 5. CROP & RATIO */
                                        <div className="space-y-6 animate-in fade-in duration-200 py-2">
                                            <div>
                                                <p className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-3 text-center">Aspect Ratio</p>
                                                <div className="grid grid-cols-5 gap-2 px-2">
                                                    {(['original', '1:1', '4:5', '16:9', 'free'] as const).map(ratio => (
                                                        <Button 
                                                            key={ratio} 
                                                            variant={aspectRatio === ratio ? 'default' : 'outline'} 
                                                            onClick={() => setAspectRatio(ratio)}
                                                            className={`text-[10px] h-9 font-bold tracking-wide capitalize px-0 ${aspectRatio === ratio ? 'bg-white text-black hover:bg-white/90' : 'bg-transparent text-white/80 border-white/20 hover:border-white/50'}`}
                                                        >
                                                            {ratio === 'original' ? 'Orig' : ratio === 'free' ? 'Free' : ratio}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </div>
                                            
                                            <div className="pt-2">
                                                <p className="text-[11px] font-bold text-white/50 uppercase tracking-wider mb-3 text-center">Crop Zoom</p>
                                                <div className="flex items-center gap-3 px-4">
                                                    <ZoomOut className="h-4 w-4 text-white/50" />
                                                    <input 
                                                        type="range" 
                                                        min="100" 
                                                        max="200" 
                                                        value={mediaZoom[mediaItems[activeIndex]?.url] || 100} 
                                                        onChange={(e) => {
                                                            const z = parseInt(e.target.value);
                                                            setMediaZoom(prev => ({ ...prev, [mediaItems[activeIndex].url]: z }));
                                                        }}
                                                        className="flex-1 accent-white h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer" 
                                                    />
                                                    <ZoomIn className="h-4 w-4 text-white/50" />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        /* 6. EDIT TOOLS CIRCLE CAROUSEL */
                                        <div className="space-y-3 animate-in fade-in duration-200">
                                            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none px-2 items-center">
                                                {[
                                                    { name: 'Sharpen', icon: Maximize },
                                                    { name: 'Lux', icon: Sparkles },
                                                    { name: 'Brightness', icon: Sun },
                                                    { name: 'Contrast', icon: Sliders },
                                                    { name: 'Structure', icon: Crop },
                                                    { name: 'Warmth', icon: Thermometer },
                                                    { name: 'Saturation', icon: Droplets },
                                                    { name: 'Colour', icon: Palette },
                                                    { name: 'Fade', icon: Cloud },
                                                    { name: 'Vignette', icon: Circle }
                                                ].map(tool => (
                                                    <button
                                                        key={tool.name}
                                                        onClick={() => {
                                                            const config = TOOL_CONFIGS[tool.name];
                                                            const key = config ? config.key : (tool.name.toLowerCase() as any);
                                                            const def = config ? config.defaultVal : 0;
                                                            const currentVal = mediaAdjustments[mediaItems[activeIndex]?.url]?.[key as keyof typeof mediaAdjustments[string]] ?? def;
                                                            setToolSnapshotValue(currentVal);
                                                            setActiveAdjustmentTool(tool.name);
                                                        }}
                                                        className="flex flex-col items-center shrink-0 transition-all group"
                                                    >
                                                        <span className="text-[11px] font-semibold text-white/80 mb-2">{tool.name}</span>
                                                        <div className="w-16 h-16 rounded-full border border-white/40 flex items-center justify-center text-white bg-transparent hover:border-white hover:bg-white/10 transition-all">
                                                            <tool.icon className="h-6 w-6 stroke-[1.5]" />
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* FIXED BOTTOM ACTION BAR */}
                                <div className="border-t border-white/10 flex items-center justify-between px-6 py-3 bg-zinc-900 shrink-0">
                                    <button 
                                        onClick={cancelSubMenu}
                                        className="text-sm font-semibold text-white/80 hover:text-white"
                                    >
                                        Cancel
                                    </button>

                                    <span className="text-sm font-bold text-white tracking-wide">
                                        {isFilterIntensityOpen ? selectedFilterName : activeAdjustmentTool ? activeAdjustmentTool : (editMode === 'filter' ? 'Filter' : editMode === 'adjust' ? 'Edit' : editMode === 'crop' ? 'Ratio' : editMode === 'text' ? 'Text' : '')}
                                    </span>

                                    <button 
                                        onClick={finishSubMenu}
                                        className="text-sm font-semibold text-white hover:text-white/80"
                                    >
                                        {(isFilterIntensityOpen || activeAdjustmentTool) ? 'Done' : 'Finished'}
                                    </button>
                                </div>
                            </div>
                            )}
                        </div>
                        )
                    )}

                    {/* Step 3: Details */}
                    {step === 'details' && (
                        <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden animate-in slide-in-from-right-8 duration-300">
                             {/* Left: Preview carousel that allows viewing all items */}
                             <div className="w-full md:w-[50%] lg:w-[60%] flex items-center justify-center bg-black/40 border-b md:border-b-0 md:border-r border-border/50 p-6 relative select-none shrink-0">
                                  <div 
                                      className="w-full max-w-md bg-black rounded-xl overflow-hidden shadow-2xl relative border border-white/10 flex items-center justify-center"
                                      style={(() => {
                                          if (aspectRatio === 'free') {
                                              const crop = mediaCrop[mediaItems[detailsActiveIndex]?.url];
                                              if (crop) {
                                                  const boxWidth = 100 - crop.left - crop.right;
                                                  const boxHeight = 100 - crop.top - crop.bottom;
                                                  return { aspectRatio: `${boxWidth}/${boxHeight}` };
                                              }
                                          }
                                          return {
                                              aspectRatio: aspectRatio === '1:1' ? '1/1' : aspectRatio === '4:5' ? '4/5' : aspectRatio === '16:9' ? '16:9' : 'auto',
                                          };
                                      })()}
                                  >
                                      {(() => {
                                          const activeUrl = mediaItems[detailsActiveIndex]?.url;
                                          const isVideo = mediaItems[detailsActiveIndex]?.type === 'video';
                                          const filter = getFilterString(activeUrl);
                                          
                                          let mediaStyle: any = { filter };
                                          let mediaClassName = "w-full h-full object-cover";

                                          if (aspectRatio === 'free') {
                                              const crop = mediaCrop[activeUrl];
                                              if (crop) {
                                                  const boxWidth = 100 - crop.left - crop.right;
                                                  const boxHeight = 100 - crop.top - crop.bottom;
                                                  const scale = 100 / Math.max(1, boxWidth);
                                                  mediaStyle = {
                                                      ...mediaStyle,
                                                      width: '100%',
                                                      height: '100%',
                                                      objectFit: 'cover',
                                                      transformOrigin: 'top left',
                                                      transform: `scale(${scale}) translate(${-crop.left}%, ${-crop.top}%)`
                                                  };
                                                  mediaClassName = "w-full h-full object-cover block";
                                              }
                                          } else {
                                              mediaStyle.transform = `translate(${mediaPan[activeUrl]?.x || 0}px, ${mediaPan[activeUrl]?.y || 0}px) scale(${(mediaZoom[activeUrl] || 100) / 100})`;
                                              mediaClassName = `w-full h-full ${aspectRatio !== 'original' ? 'object-cover' : 'object-contain'}`;
                                          }

                                          return isVideo ? (
                                              <video 
                                                  src={activeUrl} 
                                                  className={mediaClassName}
                                                  autoPlay loop muted 
                                                  style={mediaStyle}
                                              />
                                          ) : (
                                              <img 
                                                  src={activeUrl} 
                                                  className={mediaClassName}
                                                  alt="Preview" 
                                                  style={mediaStyle}
                                              />
                                          );
                                      })()}
                                     
                                     {/* Left/Right Carousel Controls */}
                                     {mediaItems.length > 1 && (
                                         <>
                                             <button 
                                                 onClick={() => setDetailsActiveIndex(prev => (prev > 0 ? prev - 1 : mediaItems.length - 1))}
                                                 className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white font-bold text-lg border border-white/10 shadow-lg transition-all"
                                             >
                                                 ‹
                                             </button>
                                             <button 
                                                 onClick={() => setDetailsActiveIndex(prev => (prev < mediaItems.length - 1 ? prev + 1 : 0))}
                                                 className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white font-bold text-lg border border-white/10 shadow-lg transition-all"
                                             >
                                                 ›
                                             </button>
                                             <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-white z-10 pointer-events-none">
                                                 {detailsActiveIndex + 1} / {mediaItems.length}
                                             </div>
                                         </>
                                     )}

                                     {/* Vignette Overlay in step 3 */}
                                     {((mediaAdjustments[mediaItems[detailsActiveIndex]?.url]?.vignette) || 0) > 0 && (
                                         <div 
                                             className="absolute inset-0 pointer-events-none z-10" 
                                             style={{
                                                 background: `radial-gradient(circle, transparent 30%, rgba(0,0,0,${(mediaAdjustments[mediaItems[detailsActiveIndex]?.url]?.vignette || 0) / 100}) 100%)`
                                             }}
                                         />
                                     )}

                                     {/* Text Overlays Layer in step 3 */}
                                     {(mediaTextOverlays[mediaItems[detailsActiveIndex]?.url] || []).map(overlay => (
                                         <div
                                             key={overlay.id}
                                             className="absolute z-20 select-none px-3 py-1.5 rounded-lg shadow-lg font-bold text-center pointer-events-none"
                                             style={{
                                                 left: `${overlay.x}%`,
                                                 top: `${overlay.y}%`,
                                                 transform: 'translate(-50%, -50%)',
                                                 color: overlay.color,
                                                 backgroundColor: overlay.bgColor,
                                                 fontSize: `${overlay.fontSize}px`,
                                                 maxWidth: '85%',
                                                 wordBreak: 'break-word',
                                                 textShadow: overlay.bgColor === 'transparent' ? '0 2px 4px rgba(0,0,0,0.8)' : 'none'
                                             }}
                                         >
                                             {overlay.text}
                                         </div>
                                     ))}
                                 </div>
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
                                    <div className="flex-1">
                                        <MentionTextarea
                                            value={caption}
                                            onChange={(e) => setCaption(e.target.value)}
                                            placeholder="Write a caption..."
                                            className="min-h-[120px] resize-none border-none focus-visible:ring-0 bg-transparent text-base p-0 w-full"
                                        />
                                        <div className="flex items-center justify-between mt-2 text-muted-foreground">
                                            <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker} modal={false}>
                                                <PopoverTrigger asChild>
                                                    <button className="hover:text-foreground transition-colors p-1" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                                                        <Smile className="h-5 w-5" />
                                                    </button>
                                                </PopoverTrigger>
                                                <PopoverContent className="p-0 border-none shadow-2xl bg-transparent z-[9999]" align="start" side="bottom" sideOffset={8}>
                                                    <EmojiPicker
                                                        theme={Theme.DARK}
                                                        emojiStyle={EmojiStyle.APPLE}
                                                        onEmojiClick={(emojiData) => setCaption(prev => prev + emojiData.emoji)}
                                                        width={300}
                                                        height={350}
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            <span className="text-xs font-medium">{caption.length} / 2200</span>
                                        </div>
                                    </div>
                                </div>

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
                                            className="text-xs font-bold text-primary hover:text-primary/80 hover:bg-primary/10 h-8 rounded-full px-3"
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
                                                        <AvatarFallback className="text-[10px]"><User className="h-3 w-3" /></AvatarFallback>
                                                    </Avatar>
                                                    <span className="font-semibold text-foreground">@{u.username || u.full_name}</span>
                                                    <button 
                                                        onClick={() => setTaggedUsers(prev => prev.filter(item => item.id !== u.id))}
                                                        className="ml-1 text-muted-foreground hover:text-foreground p-0.5 rounded-full hover:bg-white/10"
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Add Location Section (Instagram Style with Suggestions) */}
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
                                                placeholder="Add location" 
                                                className="border-none bg-transparent focus-visible:ring-0 px-0 shadow-none text-base h-auto placeholder:text-muted-foreground"
                                            />
                                            {location && (
                                                <button 
                                                    onClick={() => setLocation('')}
                                                    className="text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-white/10"
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Location Suggestions Dropdown & Quick Chips */}
                                    {showLocationSuggestions && (
                                        <div className="mt-3 animate-in fade-in duration-200">
                                            <div className="flex items-center justify-between mb-2">
                                                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Suggested Locations</p>
                                                <button 
                                                    onClick={() => setShowLocationSuggestions(false)}
                                                    className="text-[10px] text-muted-foreground hover:text-foreground font-semibold"
                                                >
                                                    Hide
                                                </button>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {POPULAR_LOCATIONS.filter(loc => !location || loc.toLowerCase().includes(location.toLowerCase())).slice(0, 6).map(loc => (
                                                    <button
                                                        key={loc}
                                                        onClick={() => {
                                                            setLocation(loc);
                                                            setShowLocationSuggestions(false);
                                                        }}
                                                        className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                                                            location === loc 
                                                                ? 'bg-primary border-primary text-primary-foreground font-bold shadow-md' 
                                                                : 'bg-secondary/70 border-border text-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/10 font-medium'
                                                        }`}
                                                    >
                                                        📍 {loc}
                                                    </button>
                                                ))}
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
                                                    className={`w-10 h-6 rounded-full shrink-0 border border-border transition-all duration-300 p-0.5 ${
                                                        commentingOff ? 'bg-primary border-primary flex justify-end' : 'bg-muted-foreground/30 flex justify-start'
                                                    }`}
                                                >
                                                    <span className="w-4 h-4 rounded-full bg-white shadow-md block" />
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
                                                    className={`w-10 h-6 rounded-full shrink-0 border border-border transition-all duration-300 p-0.5 ${
                                                        hideLikes ? 'bg-primary border-primary flex justify-end' : 'bg-muted-foreground/30 flex justify-start'
                                                    }`}
                                                >
                                                    <span className="w-4 h-4 rounded-full bg-white shadow-md block" />
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

            {/* Tag People Search Dialog */}
            <Dialog open={showTagDialog} onOpenChange={setShowTagDialog}>
                <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-2xl border-white/10 rounded-2xl p-6 shadow-2xl">
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
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                </div>
                            ) : userSearchResults.length > 0 ? (
                                userSearchResults.map(profile => {
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
                                                    <p className="text-[11px] text-muted-foreground">@{profile.username || 'user'}</p>
                                                </div>
                                            </div>
                                            <Button 
                                                size="sm" 
                                                variant={isTagged ? "default" : "outline"} 
                                                className="h-8 rounded-full px-3 text-xs font-bold"
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
