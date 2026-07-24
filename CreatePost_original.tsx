import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ImagePlus, X, ArrowLeft, Loader2, MapPin, User, Building2, UploadCloud, Video, Maximize, ZoomIn, ZoomOut, Smile, Tag, Accessibility, Settings, ChevronRight, ChevronUp } from 'lucide-react';
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
import { queryClient } from '@/lib/queryClient';

type Step = 'select' | 'preview' | 'details';

interface MediaItem {
    url: string;
    type: 'image' | 'video';
}

export default function CreatePost() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { toast } = useToast();
    const { data: myPages } = useMyPages();
    const { createPost: createPostMutation } = usePostMutation();
    
    const [step, setStep] = useState<Step>('select');
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    
    // Details state
    const [caption, setCaption] = useState('');
    const [location, setLocation] = useState('');
    const [selectedPageId, setSelectedPageId] = useState<string | 'user'>('user');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
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
    const [mediaAdjustments, setMediaAdjustments] = useState<Record<string, { brightness: number; contrast: number; saturate: number; sepia: number; warmth: number; vignette: number }>>({});
    const [editMode, setEditMode] = useState<'filter' | 'adjust'>('filter');
    const [detailsActiveIndex, setDetailsActiveIndex] = useState(0);
    const [showZoomSlider, setShowZoomSlider] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    
    React.useEffect(() => {
        const media = window.matchMedia('(max-w: 768px)');
        setIsMobile(media.matches);
        const listener = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
    }, []);
    
    const isDraggingRef = useRef(false);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);
    
    const getFilterString = (url: string) => {
        const filterBase = mediaFilters[url] && mediaFilters[url] !== 'none' ? mediaFilters[url] : '';
        const adj = mediaAdjustments[url] || { brightness: 100, contrast: 100, saturate: 100, sepia: 0, warmth: 0, vignette: 0 };
        const warmthFilter = adj.warmth ? `sepia(${adj.warmth / 100}) hue-rotate(${-adj.warmth / 3}deg) saturate(${1 + adj.warmth / 200})` : '';
        return `${filterBase} ${warmthFilter} brightness(${adj.brightness}%) contrast(${adj.contrast}%) saturate(${adj.saturate}%) sepia(${adj.sepia}%)`.trim();
    };

    const getClipPathString = (url: string) => {
        const crop = mediaCrop[url];
        if (!crop) return 'inset(0% 0% 0% 0%)';
        return `inset(${crop.top}% ${crop.right}% ${crop.bottom}% ${crop.left}%)`;
    };

    const handleCropDrag = (e: React.MouseEvent | React.TouchEvent, handle: 'tl' | 'tr' | 'bl' | 'br' | 'center') => {
        e.stopPropagation();
        if (e.cancelable) {
            e.preventDefault();
        }
        
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        
        const currentCrop = mediaCrop[mediaItems[activeIndex]?.url] || { top: 0, right: 0, bottom: 0, left: 0 };
        const startX = clientX;
        const startY = clientY;
        
        const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
            if (moveEvent.cancelable) {
                moveEvent.preventDefault();
            }
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

    const handleMouseUpOrLeave = () => {
        isDraggingRef.current = false;
    };
    
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
            
            const mediaItemsWithMetadata = mediaItems.map(item => ({
                url: item.url,
                type: item.type,
                crop: mediaCrop[item.url] || null,
                zoom: mediaZoom[item.url] || 100,
                pan: mediaPan[item.url] || { x: 0, y: 0 },
                filter: getFilterString(item.url),
                aspectRatio: aspectRatio,
            }));
            
            await createPostMutation(caption, {
                mediaItems: mediaItemsWithMetadata,
                tags,
                pageId: selectedPageId === 'user' ? null : selectedPageId
            });
            
            // Invalidate React Query feed queries immediately so feed reloads and displays the new post
            if (user?.id) {
                queryClient.invalidateQueries({ queryKey: ['home-feed-posts', user.id] });
            }
            queryClient.invalidateQueries({ queryKey: ['home-feed-posts'] });
            queryClient.invalidateQueries({ queryKey: ['home-feed-static'] });

            toast({ title: 'Success', description: 'Post shared successfully!' });
            navigate('/feed');
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to share post', variant: 'destructive' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-background pt-[68px] md:pt-24 flex flex-col items-center justify-center pb-12 px-0 md:px-4">
            <div className="w-full md:max-w-5xl bg-card md:border md:border-border/50 md:rounded-2xl overflow-hidden md:shadow-2xl flex flex-col md:h-[85vh] h-auto min-h-[calc(100vh-68px)] md:min-h-[550px]">
                
                {/* Header */}
                <div className="h-14 border-b border-border/50 flex items-center justify-between px-4 shrink-0 bg-background/50 backdrop-blur-sm z-10">
                    <Button variant="ghost" size="icon" onClick={() => {
                        if (step === 'details') {
                            setActiveIndex(detailsActiveIndex);
                            setStep('preview');
                        }
                        else if (step === 'preview') setStep('select');
                        else navigate(-1);
                    }}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h2 className="text-sm font-bold tracking-tight">
                        {step === 'select' && 'Create new post'}
                        {step === 'preview' && 'Crop & Adjust'}
                        {step === 'details' && 'New post details'}
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
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Share'}
                            </Button>
                        )}
                        {step === 'select' && <div className="w-10" />}
                    </div>
                </div>

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

                    {/* Step 2: Preview */}
                    {step === 'preview' && (
                        <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden animate-in slide-in-from-right-8 duration-300">
                            {/* Left side: Main Image Preview & Controls */}
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

                                        {/* Vignette Overlay */}
                                        {mediaAdjustments[mediaItems[activeIndex]?.url]?.vignette > 0 && (
                                            <div 
                                                className="absolute inset-0 pointer-events-none z-10" 
                                                style={{
                                                    background: `radial-gradient(circle, transparent 30%, rgba(0,0,0,${mediaAdjustments[mediaItems[activeIndex]?.url].vignette / 100}) 100%)`
                                                }}
                                            />
                                        )}

                                        {/* Free Crop Bounding Box Overlay */}
                                        {aspectRatio === 'free' && activeTab === 'crop' && (
                                            <div className="absolute inset-0 z-20 pointer-events-none">
                                                {/* Dimmed backdrop outside the crop area */}
                                                <div className="absolute inset-0 bg-black/45 pointer-events-none" />
                                                
                                                {/* Draggable Bounding Box */}
                                                <div 
                                                    className="absolute border-2 border-white border-dashed shadow-2xl flex items-center justify-center pointer-events-auto cursor-move select-none"
                                                    style={{
                                                        top: `${mediaCrop[mediaItems[activeIndex]?.url]?.top || 0}%`,
                                                        right: `${mediaCrop[mediaItems[activeIndex]?.url]?.right || 0}%`,
                                                        bottom: `${mediaCrop[mediaItems[activeIndex]?.url]?.bottom || 0}%`,
                                                        left: `${mediaCrop[mediaItems[activeIndex]?.url]?.left || 0}%`,
                                                        backgroundColor: 'transparent',
                                                        mixBlendMode: 'difference'
                                                    }}
                                                    onMouseDown={(e) => handleCropDrag(e, 'center')}
                                                    onTouchStart={(e) => handleCropDrag(e, 'center')}
                                                >
                                                    {/* Grid Lines */}
                                                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-30 border border-white/20 pointer-events-none">
                                                        <div className="border-r border-b border-white/30" />
                                                        <div className="border-r border-b border-white/30" />
                                                        <div className="border-b border-white/30" />
                                                        <div className="border-r border-b border-white/30" />
                                                        <div className="border-r border-b border-white/30" />
                                                        <div className="border-b border-white/30" />
                                                    </div>

                                                    {/* Corner Handles */}
                                                    <div 
                                                        className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-white cursor-nwse-resize z-30" 
                                                        style={{ transform: 'translate(-2px, -2px)' }}
                                                        onMouseDown={(e) => handleCropDrag(e, 'tl')}
                                                        onTouchStart={(e) => handleCropDrag(e, 'tl')}
                                                    />
                                                    <div 
                                                        className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-white cursor-nesw-resize z-30" 
                                                        style={{ transform: 'translate(2px, -2px)' }}
                                                        onMouseDown={(e) => handleCropDrag(e, 'tr')}
                                                        onTouchStart={(e) => handleCropDrag(e, 'tr')}
                                                    />
                                                    <div 
                                                        className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-white cursor-nesw-resize z-30" 
                                                        style={{ transform: 'translate(-2px, 2px)' }}
                                                        onMouseDown={(e) => handleCropDrag(e, 'bl')}
                                                        onTouchStart={(e) => handleCropDrag(e, 'bl')}
                                                    />
                                                    <div 
                                                        className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-white cursor-nwse-resize z-30" 
                                                        style={{ transform: 'translate(2px, 2px)' }}
                                                        onMouseDown={(e) => handleCropDrag(e, 'br')}
                                                        onTouchStart={(e) => handleCropDrag(e, 'br')}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Sub-image carousel */}
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
                            
                            {/* Right side: Tabs (Crop / Edit) - standard instagram layout for this step */}
                            <div className="w-full md:w-[320px] flex flex-col bg-card shrink-0 border-t md:border-t-0 md:border-l border-border/50 pb-8 md:pb-0">
                                <div className="flex border-b border-border/50">
                                    <button 
                                        onClick={() => setActiveTab('crop')}
                                        className={`flex-1 py-3 text-sm font-bold ${activeTab === 'crop' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        Crop
                                    </button>
                                    <button 
                                        onClick={() => setActiveTab('edit')}
                                        className={`flex-1 py-3 text-sm font-bold ${activeTab === 'edit' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        Edit
                                    </button>
                                </div>
                                <div className="p-4 flex-1 overflow-y-auto">
                                    {activeTab === 'crop' ? (
                                        <div className="space-y-6 animate-in fade-in duration-200">
                                            <div>
                                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Aspect Ratio</p>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {(['original', 'free', '1:1', '4:5', '16:9'] as const).map(ratio => (
                                                        <Button 
                                                            key={ratio} 
                                                            variant={aspectRatio === ratio ? 'default' : 'outline'} 
                                                            onClick={() => setAspectRatio(ratio)}
                                                            className="text-xs h-10 font-bold tracking-wide capitalize"
                                                        >
                                                            {ratio === 'original' ? 'Original' : ratio === 'free' ? 'Free Crop 📐' : ratio}
                                                        </Button>
                                                    ))}
                                                </div>
                                            </div>
                                            
                                            <div className="pt-4 border-t border-border/50">
                                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Crop Zoom</p>
                                                <div className="flex items-center gap-3">
                                                    <ZoomOut className="h-4 w-4 text-muted-foreground" />
                                                    <input 
                                                        type="range" 
                                                        min="100" 
                                                        max="200" 
                                                        value={mediaZoom[mediaItems[activeIndex]?.url] || 100} 
                                                        onChange={(e) => {
                                                            const z = parseInt(e.target.value);
                                                            setMediaZoom(prev => ({ ...prev, [mediaItems[activeIndex].url]: z }));
                                                        }}
                                                        className="flex-1 accent-primary h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer" 
                                                    />
                                                    <ZoomIn className="h-4 w-4 text-muted-foreground" />
                                                </div>
                                                <p className="text-[10px] text-muted-foreground mt-3">
                                                    💡 Use the slider to zoom in and drag the photo to adjust framing.
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-6 animate-in fade-in duration-200">
                                            {/* Sub-tabs for Edit Section */}
                                            <div className="flex bg-zinc-900 rounded-lg p-1">
                                                <button 
                                                    onClick={() => setEditMode('filter')}
                                                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${editMode === 'filter' ? 'bg-zinc-800 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                                >
                                                    Filters
                                                </button>
                                                <button 
                                                    onClick={() => setEditMode('adjust')}
                                                    className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${editMode === 'adjust' ? 'bg-zinc-800 text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                                >
                                                    Adjust
                                                </button>
                                            </div>

                                            {editMode === 'filter' ? (
                                                <div className="grid grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-1">
                                                    {[
                                                        { name: 'Normal', value: 'none' },
                                                        { name: 'Clarendon', value: 'contrast(1.2) saturate(1.3) brightness(1.05)' },
                                                        { name: 'Gingham', value: 'sepia(0.15) contrast(0.9) saturate(0.9) brightness(0.95) hue-rotate(-10deg)' },
                                                        { name: 'Moon', value: 'grayscale(1) contrast(1.1) brightness(1.1)' },
                                                        { name: 'Lark', value: 'brightness(1.1) saturate(1.2) contrast(0.95)' },
                                                        { name: 'Aden', value: 'hue-rotate(20deg) saturate(0.85) contrast(0.9) brightness(1.1)' }
                                                    ].map(filter => (
                                                        <button 
                                                            key={filter.name} 
                                                            onClick={() => {
                                                                if (mediaItems[activeIndex]) {
                                                                    setMediaFilters(prev => ({
                                                                        ...prev,
                                                                        [mediaItems[activeIndex].url]: filter.value
                                                                    }));
                                                                }
                                                            }}
                                                            className={`flex flex-col items-center p-2 rounded-lg border-2 text-center transition-all ${
                                                                (mediaFilters[mediaItems[activeIndex]?.url] || 'none') === filter.value 
                                                                    ? 'border-primary bg-primary/10' 
                                                                    : 'border-border hover:border-primary/30 bg-background/50'
                                                            }`}
                                                        >
                                                            <div 
                                                                className="w-full aspect-square rounded bg-zinc-800 overflow-hidden mb-1"
                                                                style={{ filter: filter.value }}
                                                            >
                                                                {mediaItems[activeIndex]?.type === 'video' ? (
                                                                    <video src={mediaItems[activeIndex]?.url} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <img src={mediaItems[activeIndex]?.url} className="w-full h-full object-cover" alt="Filter preview" />
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] font-bold tracking-tight">{filter.name}</span>
                                                        </button>
                                                     ))}
                                                </div>
                                            ) : (
                                                <div className="space-y-5">
                                                    {[
                                                        { label: 'Brightness', key: 'brightness', min: 50, max: 150, def: 100, unit: '%' },
                                                        { label: 'Contrast', key: 'contrast', min: 50, max: 150, def: 100, unit: '%' },
                                                        { label: 'Saturation', key: 'saturate', min: 0, max: 200, def: 100, unit: '%' },
                                                        { label: 'Sepia', key: 'sepia', min: 0, max: 100, def: 0, unit: '%' },
                                                        { label: 'Warmth', key: 'warmth', min: 0, max: 100, def: 0, unit: '%' },
                                                        { label: 'Vignette', key: 'vignette', min: 0, max: 100, def: 0, unit: '%' },
                                                    ].map(adj => {
                                                        const currentVal = mediaAdjustments[mediaItems[activeIndex]?.url]?.[adj.key as 'brightness' | 'contrast' | 'saturate' | 'sepia' | 'warmth' | 'vignette'] ?? adj.def;
                                                        return (
                                                            <div key={adj.key} className="space-y-1.5">
                                                                <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                                                                    <span>{adj.label}</span>
                                                                    <span>{currentVal}{adj.unit}</span>
                                                                </div>
                                                                <input 
                                                                    type="range"
                                                                    min={adj.min}
                                                                    max={adj.max}
                                                                    value={currentVal}
                                                                    onChange={(e) => {
                                                                        const val = parseInt(e.target.value);
                                                                        setMediaAdjustments(prev => {
                                                                            const current = prev[mediaItems[activeIndex].url] || {
                                                                                brightness: 100,
                                                                                contrast: 100,
                                                                                saturate: 100,
                                                                                sepia: 0,
                                                                                warmth: 0,
                                                                                vignette: 0
                                                                            };
                                                                            return {
                                                                                ...prev,
                                                                                [mediaItems[activeIndex].url]: {
                                                                                    ...current,
                                                                                    [adj.key]: val
                                                                                }
                                                                            };
                                                                        });
                                                                    }}
                                                                    className="w-full accent-primary h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer"
                                                                />
                                                            </div>
                                                        );
                                                    }) }
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
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
                                     {mediaAdjustments[mediaItems[detailsActiveIndex]?.url]?.vignette > 0 && (
                                         <div 
                                             className="absolute inset-0 pointer-events-none z-10" 
                                             style={{
                                                 background: `radial-gradient(circle, transparent 30%, rgba(0,0,0,${mediaAdjustments[mediaItems[detailsActiveIndex]?.url].vignette / 100}) 100%)`
                                             }}
                                         />
                                     )}

                                     {/* Vignette Overlay in step 3 */}
                                     {mediaAdjustments[mediaItems[detailsActiveIndex]?.url]?.vignette > 0 && (
                                         <div 
                                             className="absolute inset-0 pointer-events-none z-10" 
                                             style={{
                                                 background: `radial-gradient(circle, transparent 30%, rgba(0,0,0,${mediaAdjustments[mediaItems[detailsActiveIndex]?.url].vignette / 100}) 100%)`
                                             }}
                                         />
                                     )}

                                     {/* Vignette Overlay in step 3 */}
                                     {mediaAdjustments[mediaItems[detailsActiveIndex]?.url]?.vignette > 0 && (
                                         <div 
                                             className="absolute inset-0 pointer-events-none z-10" 
                                             style={{
                                                 background: `radial-gradient(circle, transparent 30%, rgba(0,0,0,${mediaAdjustments[mediaItems[detailsActiveIndex]?.url].vignette / 100}) 100%)`
                                             }}
                                         />
                                     )}
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
                                            autoFocus
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

                                <div className="p-4 border-b border-border/30">
                                    <div className="flex items-center gap-3 text-muted-foreground group">
                                        <MapPin className="h-5 w-5 group-hover:text-primary transition-colors shrink-0" />
                                        <Input 
                                            value={location}
                                            onChange={(e) => setLocation(e.target.value)}
                                            placeholder="Add location" 
                                            className="border-none bg-transparent focus-visible:ring-0 px-0 shadow-none text-base h-auto placeholder:text-muted-foreground"
                                        />
                                    </div>
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
                                        <div className="p-4 bg-accent/20 text-sm space-y-5 animate-in slide-in-from-top-2 duration-200">
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
                                                        commentingOff ? 'bg-primary border-primary flex justify-end' : 'bg-zinc-700/50 flex justify-start'
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
                                                        hideLikes ? 'bg-primary border-primary flex justify-end' : 'bg-zinc-700/50 flex justify-start'
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
        </div>
    );
}
