import { CachedImage } from '../../components/common/CachedImage';
import { orTerm } from '../../utils/postgrest';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Modal,
  Switch,
  Dimensions,
  PanResponder,
  InteractionManager,
} from 'react-native';
import { pickAttachments } from '../../services/attachmentPicker';
import DocumentPicker from 'react-native-document-picker';
// @ts-ignore
import { Video } from 'react-native-video-compressor';
import { uploadMediaPipeline } from '../../services/mediaPipeline';
import { captureRef } from 'react-native-view-shot';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { getSupabaseClient } from '@cinecraft/api';
import { ENV } from '../../config/env';
import { useUserSettings } from '../../hooks/useUserSettings';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const ORANGE = '#FF4B33';
const BLUE_BTN = '#1D72F2';
const INK = '#0D0D0D';

type Step = 'select' | 'preview' | 'details';
type EditToolMode = 'main' | 'text' | 'filter' | 'adjust' | 'ratio';

const CRAFT_OPTIONS = [
  'General',
  'Direction',
  'Cinematography',
  'Screenwriting',
  'Acting',
  'Editing',
  'Sound Design',
  'VFX & CGI',
  'Production',
  'Music & Score',
];

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

const FILTERS = [
  { id: 'Normal', label: 'Normal', color: 'transparent', maxOpacity: 0, initial: 'N' },
  { id: 'Clarendon', label: 'Clarendon', color: '#2563EB', maxOpacity: 0.38, initial: 'C' },
  { id: 'Gingham', label: 'Gingham', color: '#D97706', maxOpacity: 0.35, initial: 'G' },
  { id: 'Moon', label: 'Moon (B&W)', color: '#000000', maxOpacity: 0.85, initial: 'M' },
  { id: 'Lark', label: 'Lark', color: '#059669', maxOpacity: 0.32, initial: 'L' },
  { id: 'Reyes', label: 'Reyes', color: '#DB2777', maxOpacity: 0.32, initial: 'R' },
  { id: 'Juno', label: 'Juno', color: '#7C3AED', maxOpacity: 0.38, initial: 'J' },
  { id: 'Slumber', label: 'Slumber', color: '#374151', maxOpacity: 0.48, initial: 'S' },
  { id: 'Crema', label: 'Crema', color: '#F59E0B', maxOpacity: 0.38, initial: 'C' },
  { id: 'CineGold', label: 'CineGold 35mm', color: '#B45309', maxOpacity: 0.42, initial: 'CG' },
  { id: 'CyberTeal', label: 'CyberTeal Sci-Fi', color: '#0891B2', maxOpacity: 0.42, initial: 'CT' },
  { id: 'Monolith', label: 'Monolith Noir', color: '#111827', maxOpacity: 0.82, initial: 'MN' },
];

const ADJUST_CONFIGS: Record<string, { label: string; icon: string; min: number; max: number; defaultVal: number }> = {
  brightness: { label: 'Brightness', icon: 'sun', min: -50, max: 50, defaultVal: 0 },
  contrast: { label: 'Contrast', icon: 'sliders', min: -50, max: 50, defaultVal: 0 },
  saturate: { label: 'Saturation', icon: 'droplets', min: -50, max: 50, defaultVal: 0 },
  warmth: { label: 'Warmth', icon: 'thermometer', min: -50, max: 50, defaultVal: 0 },
  vignette: { label: 'Vignette', icon: 'circle', min: 0, max: 100, defaultVal: 0 },
  fade: { label: 'Fade', icon: 'cloud', min: 0, max: 100, defaultVal: 0 },
  sharpen: { label: 'Sharpen / Lux', icon: 'sparkles', min: 0, max: 100, defaultVal: 0 },
  structure: { label: 'Structure', icon: 'crop', min: 0, max: 100, defaultVal: 0 },
  colour: { label: 'Color Tint', icon: 'palette', min: -50, max: 50, defaultVal: 0 },
  sepia: { label: 'Sepia', icon: 'film', min: 0, max: 100, defaultVal: 0 },
};

// -------------------------------------------------------------
// Interactive Touch Slider Component (Ultra-Sleek & Continuous)
// -------------------------------------------------------------
interface TouchSliderProps {
  min: number;
  max: number;
  value: number;
  onChange: (val: number) => void;
  label?: string;
  unit?: string;
}

const TouchSlider: React.FC<TouchSliderProps> = ({ min, max, value, onChange, label, unit = '' }) => {
  const isDragging = useRef(false);
  const startVal = useRef(value);
  const [trackWidth, setTrackWidth] = useState(SCREEN_WIDTH - 64);
  const [displayVal, setDisplayVal] = useState(value);

  useEffect(() => {
    if (!isDragging.current) {
      setDisplayVal(value);
      startVal.current = value;
    }
  }, [value]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (evt) => {
        isDragging.current = true;
        startVal.current = displayVal;
        const locX = evt.nativeEvent.locationX;
        if (typeof locX === 'number' && trackWidth > 0) {
          const ratio = Math.max(0, Math.min(1, locX / trackWidth));
          const computed = Math.round(min + ratio * (max - min));
          startVal.current = computed;
          setDisplayVal(computed);
          onChange(computed);
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        if (trackWidth > 0) {
          const deltaVal = (gestureState.dx / trackWidth) * (max - min);
          const computed = Math.round(Math.max(min, Math.min(max, startVal.current + deltaVal)));
          setDisplayVal(computed);
          onChange(computed);
        }
      },
      onPanResponderRelease: () => {
        isDragging.current = false;
      },
      onPanResponderTerminate: () => {
        isDragging.current = false;
      },
    })
  ).current;

  const currentPct = Math.max(0, Math.min(100, (((displayVal ?? min) - min) / Math.max(1, max - min)) * 100));

  return (
    <View style={sliderStyles.container}>
      <View style={sliderStyles.headerRow}>
        <View style={sliderStyles.labelWrapper}>
          <View style={sliderStyles.activeDot} />
          {label ? <Text style={sliderStyles.label}>{label}</Text> : null}
        </View>
        <View style={sliderStyles.valBadge}>
          <Text style={sliderStyles.valText}>
            {(displayVal ?? 0) > 0 && min < 0 ? `+${displayVal}` : (displayVal ?? 0)}
            {unit}
          </Text>
        </View>
      </View>

      <View
        style={sliderStyles.trackWrapper}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0) setTrackWidth(w);
        }}
        {...panResponder.panHandlers}
      >
        <View style={sliderStyles.trackBg} pointerEvents="none">
          <View style={[sliderStyles.trackFill, { width: `${currentPct}%` }]} />
          {min < 0 && <View style={sliderStyles.centerTick} />}
        </View>
        <View style={[sliderStyles.thumb, { left: `${currentPct}%` }]} pointerEvents="none" />
      </View>
    </View>
  );
};

const sliderStyles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  labelWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ORANGE,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F1F5F9',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  valBadge: {
    backgroundColor: 'rgba(255, 107, 0, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 0, 0.4)',
  },
  valText: {
    fontSize: 13,
    fontWeight: '900',
    color: ORANGE,
    minWidth: 36,
    textAlign: 'center',
  },
  trackWrapper: {
    height: 38,
    justifyContent: 'center',
    position: 'relative',
  },
  trackBg: {
    height: 6,
    backgroundColor: '#1E293B',
    borderRadius: 3,
    position: 'relative',
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    backgroundColor: ORANGE,
    borderRadius: 3,
  },
  centerTick: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#64748B',
  },
  thumb: {
    position: 'absolute',
    top: 7,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: ORANGE,
    marginLeft: -12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
  },
});

// -------------------------------------------------------------
// DRAGGABLE TEXT OVERLAY ITEM COMPONENT
// -------------------------------------------------------------
interface DraggableTextOverlayItemProps {
  item: TextOverlayItem;
  canvasWidth: number;
  canvasHeight: number;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onSelect: (item: TextOverlayItem) => void;
  onDelete: (id: string) => void;
  isBaking: boolean;
}

const DraggableTextOverlayItem: React.FC<DraggableTextOverlayItemProps> = ({
  item,
  canvasWidth,
  canvasHeight,
  onUpdatePosition,
  onSelect,
  onDelete,
  isBaking,
}) => {
  const itemRef = useRef(item);
  itemRef.current = item;
  const startPos = useRef({ x: item.x, y: item.y });
  const hasMoved = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startPos.current = { x: itemRef.current.x, y: itemRef.current.y };
        hasMoved.current = false;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (Math.abs(gestureState.dx) > 3 || Math.abs(gestureState.dy) > 3) {
          hasMoved.current = true;
        }
        const dxPct = (gestureState.dx / canvasWidth) * 100;
        const dyPct = (gestureState.dy / canvasHeight) * 100;

        const newX = Math.max(5, Math.min(85, startPos.current.x + dxPct));
        const newY = Math.max(5, Math.min(85, startPos.current.y + dyPct));

        onUpdatePosition(itemRef.current.id, newX, newY);
      },
      onPanResponderRelease: () => {
        if (!hasMoved.current) {
          onSelect(itemRef.current);
        }
      },
    })
  ).current;

  const isNeon = item.fontStyle === 'neon' || item.bgColor === 'neon';
  const isTypewriter = item.fontStyle === 'typewriter';
  const isSerif = item.fontStyle === 'serif';
  const isStrong = item.fontStyle === 'strong';

  let computedBg = item.bgColor;
  if (item.bgColor === 'solid') computedBg = item.color === '#FFFFFF' ? '#000000' : '#FFFFFF';
  else if (item.bgColor === 'glass') computedBg = 'rgba(0,0,0,0.65)';
  else if (item.bgColor === 'neon') computedBg = 'rgba(0,0,0,0.80)';

  return (
    <View
      {...panResponder.panHandlers}
      style={[
        draggableStyles.overlayWrapper,
        {
          left: `${item.x}%`,
          top: `${item.y}%`,
          backgroundColor: computedBg,
          borderColor: isNeon ? item.color : 'transparent',
          borderWidth: isNeon ? 1.5 : 0,
        },
      ]}
    >
      <Text
        style={[
          draggableStyles.overlayText,
          {
            color: item.color,
            fontSize: item.fontSize,
            textAlign: item.align || 'center',
            fontFamily: isTypewriter ? 'monospace' : isSerif ? 'serif' : undefined,
            fontWeight: isStrong ? '900' : isSerif ? '600' : '800',
            fontStyle: isSerif ? 'italic' : 'normal',
            textTransform: isStrong ? 'uppercase' : 'none',
            letterSpacing: isStrong ? 1.5 : 0.5,
            textShadowColor: isNeon ? item.color : computedBg === 'transparent' ? 'rgba(0,0,0,0.9)' : 'transparent',
            textShadowRadius: isNeon ? 10 : computedBg === 'transparent' ? 4 : 0,
          },
        ]}
      >
        {item.text}
      </Text>

      {!isBaking && (
        <TouchableOpacity
          style={draggableStyles.deleteBtn}
          onPress={() => onDelete(item.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="x" size={10} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const draggableStyles = StyleSheet.create({
  overlayWrapper: {
    position: 'absolute',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ translateX: -24 }, { translateY: -14 }],
    zIndex: 30,
    elevation: 6,
  },
  overlayText: {
    textAlign: 'center',
  },
  deleteBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
});

// -------------------------------------------------------------
// MAIN CREATE POST SCREEN COMPONENT
// -------------------------------------------------------------
export const CreatePostScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  const { themeColors, isDark } = useUserSettings();
  const editPostId = route?.params?.editPostId;
  const [step, setStep] = useState<Step>(editPostId ? 'details' : 'select');
  const [editMode, setEditMode] = useState<EditToolMode>('main');

  // Media state
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const canvasViewRef = useRef<View>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mediaInput, setMediaInput] = useState('');
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [uploadingProgressText, setUploadingProgressText] = useState('');

  // Editor states (Exact Web & Instagram Parity)
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '4:5' | '16:9' | '9:16' | '3:2' | 'free' | 'original'>('original');
  const [naturalAspectRatio, setNaturalAspectRatio] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [photoPan, setPhotoPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [photoRotation, setPhotoRotation] = useState<number>(0);
  const [photoFlipH, setPhotoFlipH] = useState<boolean>(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('Normal');
  const [filterIntensity, setFilterIntensity] = useState<number>(100);
  const [activeAdjustTool, setActiveAdjustTool] = useState<string>('brightness');
  const [adjustments, setAdjustments] = useState<Record<string, number>>({
    brightness: 0,
    contrast: 0,
    saturate: 0,
    warmth: 0,
    vignette: 0,
    fade: 0,
    sharpen: 0,
    structure: 0,
    colour: 0,
    sepia: 0,
  });

  // Text overlay states & dragging (Instagram Style)
  const [textOverlays, setTextOverlays] = useState<TextOverlayItem[]>([]);
  const [overlayInputText, setOverlayInputText] = useState('');
  const [overlayColor, setOverlayColor] = useState<string>('#FFFFFF');
  const [overlayBg, setOverlayBg] = useState<string>('transparent');
  const [overlayStyle, setOverlayStyle] = useState<'modern' | 'neon' | 'typewriter' | 'strong' | 'serif'>('modern');
  const [overlayAlign, setOverlayAlign] = useState<'left' | 'center' | 'right'>('center');
  const [overlayFontSize, setOverlayFontSize] = useState<number>(20);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);

  // Details state
  const [content, setContent] = useState('');
  const [selectedCraft, setSelectedCraft] = useState('General');
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
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&addressdetails=1`
            );
            const data = await res.json();
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
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=6&addressdetails=1`
        );
        const data = await res.json();
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
            setContent(p.content || '');
            if (p.location) setLocation(p.location);
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
            if (Array.isArray(p.tagged_users)) setTaggedUsers(p.tagged_users);
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

      setIsUploadingMedia(true);
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const uploadedUrls: string[] = [];

      for (let i = 0; i < results.length; i++) {
        const file = results[i];
        setUploadingProgressText(`Processing file ${i + 1} of ${results.length}...`);

        try {
          const uploaded = await uploadMediaPipeline(
            {
              uri: file.uri,
              name: file.name,
              type: file.type,
              size: file.size,
            },
            {
              bucket: 'portfolios',
              folder: 'posts',
              onProgressText: (statusText) => {
                setUploadingProgressText(`${statusText} (${i + 1}/${results.length})`);
              },
            }
          );

          if (uploaded?.url) {
            uploadedUrls.push(uploaded.url);
          }
        } catch (err: any) {
          console.warn('[CreatePostScreen] Upload failed for file:', err);
        }
      }

      if (uploadedUrls.length > 0) {
        setMediaUrls((prev) => [...prev, ...uploadedUrls]);
        setStep('preview');
      } else {
        Alert.alert('Upload Failed', 'Could not upload selected files. Please try again.');
      }
    } catch (err: any) {
      if (!DocumentPicker.isCancel(err)) {
        console.warn('Pick files error:', err);
        Alert.alert('Upload Error', err.message || 'Failed to select media');
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
        if (data) setSearchResults(data as TaggedUser[]);
      } catch (err) {
        console.warn('Search profiles error:', err);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 300);

    return () => clearTimeout(delayTimer);
  }, [tagQuery]);

  const handleAddMediaUrl = () => {
    if (!mediaInput.trim()) return;
    const url = mediaInput.trim();
    setMediaUrls((prev) => [...prev, url]);
    setMediaInput('');
    setShowMediaInput(false);
    if (step === 'select') setStep('preview');
  };

  const handleAddDefaultDemoMedia = () => {
    const demoPhotos = [
      'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800',
      'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?w=800',
      'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800',
    ];
    setMediaUrls(demoPhotos);
    setStep('preview');
  };

  const handleRemoveMedia = (idx: number) => {
    setMediaUrls((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length === 0) setStep('select');
      return next;
    });
    if (activeIndex >= mediaUrls.length - 1) {
      setActiveIndex(Math.max(0, mediaUrls.length - 2));
    }
  };

  const handleSaveTextOverlay = () => {
    if (!overlayInputText.trim()) return;
    if (editingTextId) {
      setTextOverlays((prev) =>
        prev.map((o) =>
          o.id === editingTextId
            ? {
                ...o,
                text: overlayInputText.trim(),
                color: overlayColor,
                bgColor: overlayBg,
                fontSize: overlayFontSize,
                fontStyle: overlayStyle,
                align: overlayAlign,
              }
            : o
        )
      );
      setEditingTextId(null);
    } else {
      const newItem: TextOverlayItem = {
        id: Date.now().toString(),
        text: overlayInputText.trim(),
        color: overlayColor,
        bgColor: overlayBg,
        fontSize: overlayFontSize,
        fontStyle: overlayStyle,
        align: overlayAlign,
        x: 50,
        y: 50,
      };
      setTextOverlays((prev) => [...prev, newItem]);
    }
    setOverlayInputText('');
  };

  const handleSelectTextOverlay = (item: TextOverlayItem) => {
    setEditingTextId(item.id);
    setOverlayInputText(item.text);
    setOverlayColor(item.color);
    setOverlayBg(item.bgColor);
    setOverlayFontSize(item.fontSize);
    if (item.fontStyle) setOverlayStyle(item.fontStyle);
    if (item.align) setOverlayAlign(item.align);
    setEditMode('text');
  };

  const handleRemoveTextOverlay = (id: string) => {
    setTextOverlays((prev) => prev.filter((t) => t.id !== id));
    if (editingTextId === id) {
      setEditingTextId(null);
      setOverlayInputText('');
    }
  };

  const handleUpdateTextPosition = (id: string, x: number, y: number) => {
    setTextOverlays((prev) => prev.map((item) => (item.id === id ? { ...item, x, y } : item)));
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

  const handleProceedFromPreview = async () => {
    const isAdjusted = Object.values(adjustments).some((val) => val !== 0);
    const hasEdits =
      selectedFilter !== 'Normal' ||
      textOverlays.length > 0 ||
      isAdjusted ||
      zoomLevel !== 100 ||
      photoRotation !== 0 ||
      photoFlipH ||
      photoPan.x !== 0 ||
      photoPan.y !== 0 ||
      aspectRatio !== 'original';

    // If edits were made, capture and upload the baked image directly to Supabase storage
    if (hasEdits && canvasViewRef.current && mediaUrls[activeIndex] && !mediaUrls[activeIndex].includes('video')) {
      try {
        setIsBakingMedia(true);
        // Wait 150ms for UI frame paint to hide any deletion handles
        await new Promise((resolve) => setTimeout(resolve, 150));

        const capturedUri = await captureRef(canvasViewRef, {
          format: 'jpg',
          quality: 0.95,
          result: 'tmpfile',
        });

        if (capturedUri) {
          const supabase = getSupabaseClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();

          const sanitized = `baked_${Date.now()}.jpg`;
          const storagePath = `baked/${user?.id || 'anon'}/${sanitized}`;

          const formData = new FormData();
          formData.append('file', {
            uri: capturedUri.startsWith('file://') ? capturedUri : `file://${capturedUri}`,
            name: sanitized,
            type: 'image/jpeg',
          } as any);

          const { data: sessionData } = await supabase.auth.getSession();
          const token = sessionData?.session?.access_token;
          const uploadUrl = `${ENV.SUPABASE_URL}/storage/v1/object/portfolios/${storagePath}`;

          const headers: Record<string, string> = {
            apikey: ENV.SUPABASE_ANON_KEY,
            'x-upsert': 'true',
          };
          if (token) headers['Authorization'] = `Bearer ${token}`;

          const res = await fetch(uploadUrl, {
            method: 'POST',
            headers,
            body: formData,
          });

          if (res.ok) {
            const { data: pubData } = supabase.storage.from('portfolios').getPublicUrl(storagePath);
            if (pubData?.publicUrl) {
              const bakedUrl = pubData.publicUrl;
              console.log('[MobileBake] Baked Image successfully uploaded:', bakedUrl);
              setMediaUrls((prev) => {
                const copy = [...prev];
                copy[activeIndex] = bakedUrl;
                return copy;
              });
              // Reset adjustments since they are now permanently baked into the image
              setSelectedFilter('Normal');
              setTextOverlays([]);
              setAdjustments({
                brightness: 0,
                contrast: 0,
                saturate: 0,
                warmth: 0,
                vignette: 0,
                fade: 0,
                sharpen: 0,
                structure: 0,
                colour: 0,
                sepia: 0,
              });
              setZoomLevel(100);
              setPhotoRotation(0);
              setPhotoFlipH(false);
              setPhotoPan({ x: 0, y: 0 });
            }
          } else {
            console.error('[MobileBake] Storage upload error status:', res.status);
          }
        }
      } catch (bakeErr) {
        console.error('[MobileBake] Error capturing view shot:', bakeErr);
      } finally {
        setIsBakingMedia(false);
      }
    }

    setStep('details');
  };

  const handleSubmit = async () => {
    if (!content.trim() && mediaUrls.length === 0) {
      Alert.alert('Empty Post', 'Please write a caption or attach media before sharing.');
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) {
        throw new Error('Please sign in to share a post.');
      }

      const mediaItemsFormatted = mediaUrls.map((url: string) => {
        const isVideo = url.endsWith('.mp4') || url.includes('video');
        return {
          url,
          type: isVideo ? 'video' : 'image',
          zoom: zoomLevel,
          pan: { x: 0, y: 0 },
          crop: null,
          aspectRatio: aspectRatio,
          filter: 'none',
          location: location.trim() || undefined,
          tagged_users: taggedUsers,
          comments_disabled: disableComments,
          hide_likes: hideLikes,
        };
      });

      let finalContent = content.trim();
      if (location.trim() && mediaUrls.length === 0) {
        finalContent = `${finalContent}\n\n📍 ${location.trim()}`;
      }

      const tagsArray: string[] = [];
      if (selectedCraft && selectedCraft !== 'General') {
        tagsArray.push(selectedCraft);
      }

      const mediaUrlsArray = mediaUrls.map((m: any) => (typeof m === 'string' ? m : m.url));

      const payload: any = {
        author_id: user.id,
        content: finalContent,
        media_type: mediaUrls[0]?.includes('video') ? 'video' : 'image',
        media_items: mediaItemsFormatted,
        media_urls: mediaUrlsArray,
        media_url: mediaUrlsArray[0] || null,
        page_id: selectedPageId === 'user' ? null : selectedPageId,
        tags: tagsArray,
        updated_at: new Date().toISOString(),
      };

      if (editPostId) {
        const { error } = await supabase.from('posts').update(payload).eq('id', editPostId);
        if (error) throw error;
        Alert.alert('Post Updated! ✨', 'Your post changes have been published.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        const { error } = await supabase.from('posts').insert(payload);
        if (error) throw error;
        Alert.alert('Post Published! 🎬', 'Your update is now live on CineCraft.', [
          { text: 'View Feed', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (err: any) {
      Alert.alert('Failed to Share', err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const activeAuthorName =
    selectedPageId === 'user'
      ? userProfile?.full_name || userProfile?.username || 'You'
      : myPages.find((p) => p.id === selectedPageId)?.name || 'Studio Page';

  const activeAuthorAvatar =
    selectedPageId === 'user' ? userProfile?.avatar_url : myPages.find((p) => p.id === selectedPageId)?.logo_url;

  if (loadingEdit) {
    return (
      <View style={styles.loadingCenter}>
        <ActivityIndicator size="large" color={ORANGE} />
        <Text style={styles.loadingText}>Loading post details...</Text>
      </View>
    );
  }

  // Measure natural dimensions of active media for dynamic aspect ratio
  useEffect(() => {
    if (mediaUrls[activeIndex] && !mediaUrls[activeIndex].includes('video')) {
      Image.getSize(
        mediaUrls[activeIndex],
        (width, height) => {
          if (width > 0 && height > 0) {
            setNaturalAspectRatio(width / height);
          }
        },
        () => {}
      );
    }
  }, [mediaUrls, activeIndex]);

  // Calculate container aspect ratio height for Step 2 Instagram Editor (matches Web exact ratios)
  const previewHeight =
    aspectRatio === '1:1'
      ? SCREEN_WIDTH
      : aspectRatio === '4:5'
      ? (SCREEN_WIDTH * 5) / 4
      : aspectRatio === '16:9'
      ? (SCREEN_WIDTH * 9) / 16
      : aspectRatio === '9:16'
      ? Math.min(SCREEN_HEIGHT * 0.58, (SCREEN_WIDTH * 16) / 9)
      : aspectRatio === '3:2'
      ? (SCREEN_WIDTH * 2) / 3
      : aspectRatio === 'free'
      ? SCREEN_WIDTH * 1.05
      : SCREEN_WIDTH / Math.min(Math.max(naturalAspectRatio || 1, 0.75), 1.91);

  // Selected filter config & intensity opacity
  const activeFilterConfig = FILTERS.find((f) => f.id === selectedFilter) || FILTERS[0];
  const filterOpacity = Math.max(
    0,
    Math.min(1, ((filterIntensity ?? 80) / 100) * (activeFilterConfig?.maxOpacity ?? 0.4))
  );

  // Adjustment calculation variables
  const brightnessVal = Number.isFinite(adjustments.brightness) ? adjustments.brightness : 0;
  const contrastVal = Number.isFinite(adjustments.contrast) ? adjustments.contrast : 0;
  const saturateVal = Number.isFinite(adjustments.saturate) ? adjustments.saturate : 0;
  const warmthVal = Number.isFinite(adjustments.warmth) ? adjustments.warmth : 0;
  const vignetteVal = Math.max(0, Number.isFinite(adjustments.vignette) ? adjustments.vignette : 0);
  const fadeVal = Math.max(0, Number.isFinite(adjustments.fade) ? adjustments.fade : 0);
  const sharpenVal = Math.max(0, Number.isFinite(adjustments.sharpen) ? adjustments.sharpen : 0);
  const structureVal = Math.max(0, Number.isFinite(adjustments.structure) ? adjustments.structure : 0);
  const colourVal = Number.isFinite(adjustments.colour) ? adjustments.colour : 0;
  const sepiaVal = Math.max(0, Number.isFinite(adjustments.sepia) ? adjustments.sepia : 0);

  // Photo pan responder for free crop and positioning (smooth 1:1 gesture physics)
  const photoPanRef = useRef(photoPan);
  photoPanRef.current = photoPan;
  const startPhotoPan = useRef({ x: 0, y: 0 });

  const photoPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => editMode === 'ratio' || zoomLevel > 100,
      onMoveShouldSetPanResponder: (evt, gestureState) =>
        (editMode === 'ratio' || zoomLevel > 100) && (Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2),
      onPanResponderGrant: () => {
        startPhotoPan.current = { ...photoPanRef.current };
      },
      onPanResponderMove: (evt, gestureState) => {
        setPhotoPan({
          x: Math.round(startPhotoPan.current.x + gestureState.dx),
          y: Math.round(startPhotoPan.current.y + gestureState.dy),
        });
      },
    })
  ).current;

  // -------------------------------------------------------------
  // CANVAS RENDERER
  // -------------------------------------------------------------
  const renderCanvasContent = () => (
    <View
      ref={canvasViewRef}
      collapsable={false}
      style={[styles.canvasArea, { height: previewHeight }]}
      {...photoPanResponder.panHandlers}
    >
      {mediaUrls[activeIndex] ? (
        <Image
          source={{ uri: mediaUrls[activeIndex] }}
          style={[
            styles.canvasImage,
            {
              transform: [
                { translateX: photoPan.x },
                { translateY: photoPan.y },
                { scale: zoomLevel / 100 },
                { rotate: `${photoRotation}deg` },
                { scaleX: photoFlipH ? -1 : 1 },
              ],
            },
          ]}
          resizeMode={aspectRatio === 'original' ? 'contain' : 'cover'}
        />
      ) : (
        <View style={styles.canvasEmptyFallback}>
          <Icon name="image" size={40} color="#64748B" />
        </View>
      )}

      {/* LIVE OVERLAY FILTER LAYER */}
      {activeFilterConfig && activeFilterConfig.id !== 'Normal' && filterOpacity > 0 && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: activeFilterConfig.color, opacity: filterOpacity },
          ]}
        />
      )}

      {/* LIVE BRIGHTNESS OVERLAY */}
      {brightnessVal !== 0 && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: brightnessVal > 0 ? '#FFFFFF' : '#000000',
              opacity: Math.min(0.48, Math.abs(brightnessVal) / 100),
            },
          ]}
        />
      )}

      {/* LIVE CONTRAST OVERLAY */}
      {contrastVal !== 0 && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: contrastVal > 0 ? '#000000' : '#808080',
              opacity: Math.min(0.35, Math.abs(contrastVal) / 140),
            },
          ]}
        />
      )}

      {/* LIVE SATURATION / VIBRANCE OVERLAY */}
      {saturateVal !== 0 && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: saturateVal < 0 ? '#334155' : '#FF6B00',
              opacity: Math.min(0.38, Math.abs(saturateVal) / 140),
            },
          ]}
        />
      )}

      {/* LIVE WARMTH / SEPIA TINT */}
      {(warmthVal !== 0 || sepiaVal > 0) && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: sepiaVal > 0 ? '#78350F' : warmthVal > 0 ? '#F59E0B' : '#0284C7',
              opacity: Math.min(0.5, Math.max(Math.abs(warmthVal) / 130, sepiaVal / 130)),
            },
          ]}
        />
      )}

      {/* LIVE COLOR TINT LAYER */}
      {colourVal !== 0 && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: colourVal > 0 ? '#EC4899' : '#06B6D4',
              opacity: Math.min(0.4, Math.abs(colourVal) / 130),
            },
          ]}
        />
      )}

      {/* LIVE FADE / MATTE OVERLAY */}
      {fadeVal > 0 && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              backgroundColor: '#FAF5FF',
              opacity: (fadeVal / 100) * 0.32,
            },
          ]}
        />
      )}

      {/* LIVE VIGNETTE BORDER */}
      {vignetteVal > 0 && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            {
              borderWidth: Math.min(52, vignetteVal * 0.95),
              borderColor: 'rgba(0,0,0,0.75)',
            },
          ]}
        />
      )}

      {/* RULE OF THIRDS GRID (Visible during Ratio/Crop and Adjust Mode) */}
      {(editMode === 'adjust' || editMode === 'ratio') && !isBakingMedia && (
        <View style={styles.gridOverlay} pointerEvents="none">
          <View style={styles.gridRow}>
            <View style={styles.gridCell} />
            <View style={styles.gridCell} />
            <View style={styles.gridCell} />
          </View>
          <View style={styles.gridRow}>
            <View style={styles.gridCell} />
            <View style={styles.gridCell} />
            <View style={styles.gridCell} />
          </View>
          <View style={styles.gridRow}>
            <View style={styles.gridCell} />
            <View style={styles.gridCell} />
            <View style={styles.gridCell} />
          </View>
        </View>
      )}

      {/* DRAGGABLE & MOVABLE TEXT OVERLAYS LAYER */}
      {textOverlays.map((item) => (
        <DraggableTextOverlayItem
          key={item.id}
          item={item}
          canvasWidth={SCREEN_WIDTH}
          canvasHeight={previewHeight}
          onUpdatePosition={handleUpdateTextPosition}
          onSelect={handleSelectTextOverlay}
          onDelete={handleRemoveTextOverlay}
          isBaking={isBakingMedia}
        />
      ))}

      {/* Multiple media counter badge */}
      {mediaUrls.length > 1 && !isBakingMedia && (
        <View style={styles.mediaIndexBadge}>
          <Text style={styles.mediaIndexBadgeText}>
            {activeIndex + 1}/{mediaUrls.length}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      {/* STEP 1: SELECT MEDIA */}
      {step === 'select' && (
        <View style={[styles.stepSelectContainer, { backgroundColor: themeColors.bgScreen }]}>
          <Header title="New Post" showLogo={false} onBack={() => navigation.goBack()} />

          <View style={styles.selectBody}>
            <View style={[styles.uploadCloudIconBox, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
              <Icon name="upload" size={48} color={ORANGE} />
            </View>

            <Text style={[styles.selectTitle, { color: themeColors.textPrimary }]}>Create New Post</Text>
            <Text style={[styles.selectSub, { color: themeColors.textSecondary }]}>Upload photos and videos directly from your device gallery</Text>

            {/* Native Gallery / File Upload Button */}
            <TouchableOpacity
              style={[styles.uploadGalleryBtn, isUploadingMedia && styles.btnDisabled]}
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

            {/* Secondary: Paste URL Button */}
            <TouchableOpacity
              style={[styles.selectMediaBtn, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}
              onPress={() => setShowMediaInput(!showMediaInput)}
            >
              <Text style={[styles.selectMediaBtnText, { color: themeColors.textPrimary }]}>Paste Media URL</Text>
            </TouchableOpacity>

            {/* Demo Production Photos */}
            <TouchableOpacity style={[styles.demoPhotosBtn, { backgroundColor: themeColors.chipBg }]} onPress={handleAddDefaultDemoMedia}>
              <Text style={[styles.demoPhotosBtnText, { color: themeColors.textSecondary }]}>Use Demo Production Photos ✨</Text>
            </TouchableOpacity>

            {showMediaInput && (
              <View style={styles.urlInputBox}>
                <TextInput
                  style={[styles.urlInput, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                  placeholder="https://images.unsplash.com/photo-..."
                  placeholderTextColor={themeColors.textMuted}
                  value={mediaInput}
                  onChangeText={setMediaInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity style={styles.addUrlBtn} onPress={handleAddMediaUrl}>
                  <Text style={styles.addUrlBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      )}

      {/* STEP 2: INSTAGRAM-STYLE CINEMA STUDIO EDITOR */}
      {step === 'preview' && (
        <View style={[styles.editorStepContainer, { backgroundColor: themeColors.bgScreen }]}>
          {/* Top Bar */}
          <View style={[styles.editorTopBar, { backgroundColor: themeColors.bgCard, borderBottomColor: themeColors.border }]}>
            <TouchableOpacity
              onPress={() => {
                if (editMode !== 'main') setEditMode('main');
                else setStep('select');
              }}
              style={{ padding: 4 }}
            >
              <Icon name="arrow-left" size={22} color={themeColors.textPrimary} />
            </TouchableOpacity>
            <Text style={[styles.editorTopTitle, { color: themeColors.textPrimary }]}>
              {editMode === 'text'
                ? 'Text Studio'
                : editMode === 'filter'
                ? 'Cinema Filters'
                : editMode === 'adjust'
                ? 'Adjustments'
                : editMode === 'ratio'
                ? 'Crop & Framing'
                : 'Edit Photo'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                if (editMode !== 'main') setEditMode('main');
                else handleProceedFromPreview();
              }}
              style={{ padding: 4 }}
            >
              <Text style={styles.editorTopDoneText}>
                {editMode !== 'main' ? 'Done' : 'Next'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Centered Main Image Canvas */}
          {renderCanvasContent()}

          {/* SUB-MENU DRAWER (Exclusive Tool Drawer - Hides Bottom Toolbars) */}
          {editMode !== 'main' && (
            <View style={[styles.subMenuDrawer, { backgroundColor: themeColors.bgCard, borderTopColor: themeColors.border }]}>
              <View style={[styles.drawerHandleBar, { backgroundColor: themeColors.divider }]} />

              {/* 1. FILTER SUB-MENU WITH LIVE STRENGTH SLIDER */}
              {editMode === 'filter' && (
                <View style={styles.filterMenuContent}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                    {FILTERS.map((f) => {
                      const isSelected = selectedFilter === f.id;
                      return (
                        <TouchableOpacity
                          key={f.id}
                          style={[styles.filterCard, isSelected && styles.filterCardActive]}
                          onPress={() => {
                            setSelectedFilter(f.id);
                          }}
                        >
                          <View style={[styles.filterThumbBox, isSelected && styles.filterThumbBoxActive]}>
                            {mediaUrls[activeIndex] && (
                              <CachedImage uri={mediaUrls[activeIndex]} style={styles.fullImg} />
                            )}
                            {f.id !== 'Normal' && (
                              <View
                                style={[
                                  StyleSheet.absoluteFillObject,
                                  { backgroundColor: f.color, opacity: f.maxOpacity },
                                ]}
                              />
                            )}
                            {isSelected && <View style={styles.filterActivePill} />}
                          </View>
                          <Text style={[styles.filterLabel, isSelected && styles.filterLabelActive]}>
                            {f.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {/* Filter Intensity Slider */}
                  {selectedFilter !== 'Normal' && (
                    <View style={styles.sliderContainerBox}>
                      <TouchSlider
                        min={0}
                        max={100}
                        value={filterIntensity}
                        onChange={setFilterIntensity}
                        label={`${selectedFilter} Strength`}
                        unit="%"
                      />
                    </View>
                  )}

                  {/* Apply / Cancel Footer */}
                  <View style={styles.drawerBottomDoneRow}>
                    <TouchableOpacity
                      style={styles.drawerCancelBtn}
                      onPress={() => {
                        setSelectedFilter('Normal');
                        setFilterIntensity(100);
                        setEditMode('main');
                      }}
                    >
                      <Text style={styles.drawerCancelBtnText}>Reset</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.drawerApplyBtn}
                      onPress={() => setEditMode('main')}
                    >
                      <Icon name="check" size={16} color="#FFFFFF" />
                      <Text style={styles.drawerApplyBtnText}>Apply</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* 2. ADJUSTMENTS SUB-MENU WITH 10 PRO TOOLS & TOUCH SLIDER */}
              {editMode === 'adjust' && (
                <View style={styles.adjustMenuContent}>
                  {/* Tool selection chips scroll */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.adjustToolsScroll}>
                    {Object.entries(ADJUST_CONFIGS).map(([key, config]) => {
                      const isSelected = activeAdjustTool === key;
                      const hasVal = (adjustments[key] || 0) !== 0;
                      return (
                        <TouchableOpacity
                          key={key}
                          style={[
                            styles.adjustToolChip,
                            isSelected && styles.adjustToolChipActive,
                            hasVal && !isSelected && styles.adjustToolChipHasValue,
                          ]}
                          onPress={() => setActiveAdjustTool(key)}
                        >
                          <Icon
                            name={config.icon}
                            size={16}
                            color={isSelected ? '#FFFFFF' : hasVal ? ORANGE : '#94A3B8'}
                          />
                          <Text
                            style={[
                              styles.adjustToolChipText,
                              isSelected && styles.adjustToolChipTextActive,
                              hasVal && !isSelected && { color: ORANGE },
                            ]}
                          >
                            {config.label}
                          </Text>
                          {hasVal && <View style={styles.toolValueDot} />}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  {/* Active Tool Slider */}
                  <View style={styles.sliderContainerBox}>
                    {(() => {
                      const config = ADJUST_CONFIGS[activeAdjustTool] || ADJUST_CONFIGS.brightness;
                      const curVal = adjustments[activeAdjustTool] || 0;
                      return (
                        <TouchSlider
                          min={config.min}
                          max={config.max}
                          value={curVal}
                          onChange={(val) =>
                            setAdjustments((prev) => ({
                              ...prev,
                              [activeAdjustTool]: val,
                            }))
                          }
                          label={config.label}
                          unit={activeAdjustTool === 'vignette' || activeAdjustTool === 'fade' ? '%' : ''}
                        />
                      );
                    })()}
                  </View>

                  {/* Reset Tool / Reset All */}
                  <View style={styles.adjustActionsRow}>
                    <TouchableOpacity
                      style={styles.adjustActionBtn}
                      onPress={() =>
                        setAdjustments((prev) => ({
                          ...prev,
                          [activeAdjustTool]: 0,
                        }))
                      }
                    >
                      <Text style={[styles.adjustActionBtnText, { color: themeColors.textSecondary }]}>Reset Tool</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.adjustActionBtn}
                      onPress={() =>
                        setAdjustments({
                          brightness: 0,
                          contrast: 0,
                          saturate: 0,
                          warmth: 0,
                          vignette: 0,
                          fade: 0,
                          sharpen: 0,
                          structure: 0,
                          colour: 0,
                          sepia: 0,
                        })
                      }
                    >
                      <Text style={[styles.adjustActionBtnText, { color: '#EF4444' }]}>Reset All</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Apply / Cancel Footer */}
                  <View style={styles.drawerBottomDoneRow}>
                    <TouchableOpacity
                      style={[styles.drawerCancelBtn, { backgroundColor: themeColors.chipBg }]}
                      onPress={() => setEditMode('main')}
                    >
                      <Text style={[styles.drawerCancelBtnText, { color: themeColors.textSecondary }]}>Done</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.drawerApplyBtn}
                      onPress={() => setEditMode('main')}
                    >
                      <Icon name="check" size={16} color="#FFFFFF" />
                      <Text style={styles.drawerApplyBtnText}>Apply</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* 3. INSTAGRAM-GRADE TEXT OVERLAYS SUB-MENU */}
              {editMode === 'text' && (
                <View style={styles.textMenuContent}>
                  {/* Text Input Row */}
                  <View style={styles.textInputRow}>
                    <TextInput
                      style={[styles.textOverlayInput, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                      placeholder="Type text overlay..."
                      placeholderTextColor={themeColors.textMuted}
                      value={overlayInputText}
                      onChangeText={setOverlayInputText}
                    />
                    <TouchableOpacity style={styles.textSaveBtn} onPress={handleSaveTextOverlay}>
                      <Text style={styles.textSaveBtnText}>{editingTextId ? 'Update' : 'Add'}</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Typography Font Style Pills */}
                  <View style={styles.textStylesRow}>
                    {(['modern', 'neon', 'typewriter', 'strong', 'serif'] as const).map((st) => (
                      <TouchableOpacity
                        key={st}
                        style={[styles.textStylePill, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }, overlayStyle === st && styles.textStylePillActive]}
                        onPress={() => setOverlayStyle(st)}
                      >
                        <Text style={[styles.textStylePillText, { color: themeColors.textSecondary }, overlayStyle === st && styles.textStylePillTextActive]}>
                          {st.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Background Mode & Alignment Controls */}
                  <View style={styles.textControlBarRow}>
                    {/* Bg Mode Switcher */}
                    <TouchableOpacity
                      style={[styles.bgToggleBtn, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}
                      onPress={() =>
                        setOverlayBg((prev) =>
                          prev === 'transparent'
                            ? 'solid'
                            : prev === 'solid'
                            ? 'glass'
                            : prev === 'glass'
                            ? 'neon'
                            : 'transparent'
                        )
                      }
                    >
                      <Text style={[styles.bgToggleBtnText, { color: themeColors.textPrimary }]}>
                        Bg: {overlayBg === 'transparent' ? 'None' : overlayBg === 'solid' ? 'Solid' : overlayBg === 'glass' ? 'Glass' : 'Neon'}
                      </Text>
                    </TouchableOpacity>

                    {/* Alignment Switcher */}
                    <TouchableOpacity
                      style={[styles.alignToggleBtn, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}
                      onPress={() =>
                        setOverlayAlign((prev) =>
                          prev === 'center' ? 'left' : prev === 'left' ? 'right' : 'center'
                        )
                      }
                    >
                      <Icon
                        name={overlayAlign === 'left' ? 'align-left' : overlayAlign === 'right' ? 'align-right' : 'align-center'}
                        size={16}
                        color={themeColors.textPrimary}
                      />
                    </TouchableOpacity>

                    {/* Font Size Pills */}
                    <View style={styles.fontSizesGroup}>
                      {[
                        { label: 'S', size: 14 },
                        { label: 'M', size: 20 },
                        { label: 'L', size: 26 },
                        { label: 'XL', size: 34 },
                      ].map((sz) => (
                        <TouchableOpacity
                          key={sz.label}
                          style={[
                            styles.fontSizeBtn,
                            { backgroundColor: themeColors.chipBg, borderColor: themeColors.border },
                            overlayFontSize === sz.size && styles.fontSizeBtnActive,
                          ]}
                          onPress={() => setOverlayFontSize(sz.size)}
                        >
                          <Text
                            style={[
                              styles.fontSizeBtnText,
                              { color: themeColors.textSecondary },
                              overlayFontSize === sz.size && styles.fontSizeBtnTextActive,
                            ]}
                          >
                            {sz.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* 12 Instagram-Grade Color Palette */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorsScroll}>
                    {[
                      { color: '#FFFFFF', name: 'White' },
                      { color: '#000000', name: 'Black' },
                      { color: '#FF6B00', name: 'Orange' },
                      { color: '#FACC15', name: 'Yellow' },
                      { color: '#22C55E', name: 'Green' },
                      { color: '#06B6D4', name: 'Cyan' },
                      { color: '#3B82F6', name: 'Blue' },
                      { color: '#8B5CF6', name: 'Purple' },
                      { color: '#EC4899', name: 'Pink' },
                      { color: '#EF4444', name: 'Red' },
                      { color: '#14B8A6', name: 'Teal' },
                      { color: '#EAB308', name: 'Gold' },
                    ].map((item) => (
                      <TouchableOpacity
                        key={item.color}
                        style={[
                          styles.colorDot,
                          { backgroundColor: item.color },
                          overlayColor === item.color && styles.colorDotActive,
                        ]}
                        onPress={() => setOverlayColor(item.color)}
                      />
                    ))}
                  </ScrollView>

                  <Text style={styles.dragHintText}>💡 Drag text on photo to position • Tap text to edit</Text>

                  {/* Apply / Cancel Footer */}
                  <View style={styles.drawerBottomDoneRow}>
                    <TouchableOpacity
                      style={[styles.drawerCancelBtn, { backgroundColor: themeColors.chipBg }]}
                      onPress={() => setEditMode('main')}
                    >
                      <Text style={[styles.drawerCancelBtnText, { color: themeColors.textSecondary }]}>Done</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.drawerApplyBtn}
                      onPress={() => setEditMode('main')}
                    >
                      <Icon name="check" size={16} color="#FFFFFF" />
                      <Text style={styles.drawerApplyBtnText}>Apply</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* 4. FREE CROP & FRAMING SUB-MENU */}
              {editMode === 'ratio' && (
                <View style={styles.ratioMenuContent}>
                  {/* Aspect Ratio Presets (with Free Crop) */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.ratioScroll}>
                    {(
                      [
                        { id: 'free', label: 'Free' },
                        { id: 'original', label: 'Original' },
                        { id: '1:1', label: '1:1 Square' },
                        { id: '4:5', label: '4:5 Portrait' },
                        { id: '16:9', label: '16:9 Cinema' },
                        { id: '9:16', label: '9:16 Story' },
                        { id: '3:2', label: '3:2 Photo' },
                      ] as const
                    ).map((r) => (
                      <TouchableOpacity
                        key={r.id}
                        style={[styles.ratioBtn, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }, aspectRatio === r.id && styles.ratioBtnActive]}
                        onPress={() => setAspectRatio(r.id)}
                      >
                        <Text style={[styles.ratioBtnText, { color: themeColors.textSecondary }, aspectRatio === r.id && styles.ratioBtnTextActive]}>
                          {r.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Quick Transform Tool Bar (Rotate, Flip, Reset) */}
                  <View style={styles.cropTransformRow}>
                    <TouchableOpacity
                      style={[styles.cropActionChip, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}
                      onPress={() => setPhotoRotation((prev) => (prev + 90) % 360)}
                    >
                      <Icon name="rotate-cw" size={16} color={themeColors.textPrimary} />
                      <Text style={[styles.cropActionChipText, { color: themeColors.textPrimary }]}>Rotate 90°</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.cropActionChip, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}
                      onPress={() => setPhotoFlipH((prev) => !prev)}
                    >
                      <Icon name="flip-horizontal" size={16} color={themeColors.textPrimary} />
                      <Text style={[styles.cropActionChipText, { color: themeColors.textPrimary }]}>Flip H</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.cropActionChip, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}
                      onPress={() => {
                        setPhotoPan({ x: 0, y: 0 });
                        setPhotoRotation(0);
                        setPhotoFlipH(false);
                        setZoomLevel(100);
                        setAspectRatio('original');
                      }}
                    >
                      <Text style={[styles.cropActionChipText, { color: '#EF4444' }]}>Reset</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Image Zoom Slider */}
                  <View style={styles.sliderContainerBox}>
                    <TouchSlider
                      min={100}
                      max={250}
                      value={zoomLevel}
                      onChange={setZoomLevel}
                      label="Crop Zoom"
                      unit="%"
                    />
                  </View>

                  <Text style={[styles.dragHintText, { color: themeColors.textSecondary }]}>💡 Touch and drag photo on canvas to pan & frame</Text>

                  {/* Apply / Cancel Footer */}
                  <View style={styles.drawerBottomDoneRow}>
                    <TouchableOpacity
                      style={[styles.drawerCancelBtn, { backgroundColor: themeColors.chipBg }]}
                      onPress={() => setEditMode('main')}
                    >
                      <Text style={[styles.drawerCancelBtnText, { color: themeColors.textSecondary }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.drawerApplyBtn}
                      onPress={() => setEditMode('main')}
                    >
                      <Icon name="check" size={16} color="#FFFFFF" />
                      <Text style={styles.drawerApplyBtnText}>Apply Framing</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* MAIN TOOLBAR ICONS (Visible ONLY in Main Mode) */}
          {editMode === 'main' && (
            <View style={[styles.toolsRowContainer, { backgroundColor: themeColors.bgCard, borderTopColor: themeColors.border }]}>
              <TouchableOpacity
                style={styles.toolIconBtn}
                onPress={() => setEditMode('text')}
              >
                <View style={[styles.toolIconCircle, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
                  <Icon name="type" size={20} color={themeColors.textPrimary} />
                </View>
                <Text style={[styles.toolIconLabel, { color: themeColors.textSecondary }]}>Text</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toolIconBtn}
                onPress={() => setEditMode('filter')}
              >
                <View style={[styles.toolIconCircle, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
                  <Icon name="aperture" size={20} color={themeColors.textPrimary} />
                </View>
                <Text style={[styles.toolIconLabel, { color: themeColors.textSecondary }]}>Filter</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toolIconBtn}
                onPress={() => setEditMode('adjust')}
              >
                <View style={[styles.toolIconCircle, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
                  <Icon name="sliders" size={20} color={themeColors.textPrimary} />
                </View>
                <Text style={[styles.toolIconLabel, { color: themeColors.textSecondary }]}>Edit</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toolIconBtn}
                onPress={() => setEditMode('ratio')}
              >
                <View style={[styles.toolIconCircle, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
                  <Icon name="crop" size={20} color={themeColors.textPrimary} />
                </View>
                <Text style={[styles.toolIconLabel, { color: themeColors.textSecondary }]}>Ratio</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* BOTTOM THUMBNAILS & NEXT STEP ACTION BAR (Visible ONLY in Main Mode) */}
          {editMode === 'main' && (
            <View style={[styles.editorBottomActionBar, { backgroundColor: themeColors.bgCard, borderTopColor: themeColors.border }]}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbsScroll}>
                {mediaUrls.map((url, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.thumbCard, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }, activeIndex === idx && styles.thumbCardActive]}
                    onPress={() => setActiveIndex(idx)}
                  >
                    <CachedImage uri={url} style={styles.fullImg} />
                    <TouchableOpacity
                      style={styles.thumbDeleteBadge}
                      onPress={() => handleRemoveMedia(idx)}
                    >
                      <Icon name="x" size={10} color="#FFFFFF" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}

                {mediaUrls.length < 10 && (
                  <TouchableOpacity style={[styles.addMoreMediaThumbBtn, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]} onPress={handlePickLocalFiles}>
                    <Icon name="plus" size={20} color={themeColors.textPrimary} />
                  </TouchableOpacity>
                )}
              </ScrollView>

              <TouchableOpacity
                style={[styles.nextStepBlueBtn, isBakingMedia && styles.btnDisabled]}
                onPress={handleProceedFromPreview}
                disabled={isBakingMedia}
              >
                {isBakingMedia ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.nextStepBlueBtnText}>Next</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* STEP 3: DETAILS & CAPTION SCREEN */}
      {step === 'details' && (
        <View style={{ flex: 1, backgroundColor: themeColors.bgScreen }}>
          <Header
            showLogo={false}
            title={editPostId ? 'Edit Info' : 'New Post'}
            onBack={() => {
              if (mediaUrls.length > 0 && !editPostId) setStep('preview');
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

          <ScrollView style={styles.scrollContent} keyboardShouldPersistTaps="handled">
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
                  <Icon name="chevron-down" size={14} color={themeColors.textSecondary} />
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
            <View style={[styles.captionRowWithMedia, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
              <TextInput
                style={[styles.textInputFlex, { color: themeColors.textPrimary }]}
                placeholder="Write a caption or production notes..."
                placeholderTextColor={themeColors.textMuted}
                multiline
                value={content}
                onChangeText={setContent}
                autoFocus
              />
              {mediaUrls[0] && (
                <View style={styles.sideMediaPreview}>
                  <CachedImage uri={mediaUrls[0]} style={styles.fullImg} />
                </View>
              )}
            </View>

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

            {/* Craft Selector Pills */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: themeColors.textSecondary }]}>TAG CRAFT / CATEGORY</Text>
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
                <Icon name={showLocations ? 'chevron-up' : 'chevron-down'} size={16} color={themeColors.textSecondary} />
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
                <Icon name={showAdvanced ? 'chevron-up' : 'chevron-down'} size={16} color={themeColors.textSecondary} />
              </TouchableOpacity>

              {showAdvanced && (
                <View style={[styles.advancedOptionsBox, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
                  <View style={styles.switchRow}>
                    <Text style={[styles.switchLabel, { color: themeColors.textPrimary }]}>Hide Like & View Counts</Text>
                    <Switch
                      value={hideLikes}
                      onValueChange={setHideLikes}
                      trackColor={{ false: themeColors.border, true: ORANGE }}
                    />
                  </View>
                  <View style={styles.switchRow}>
                    <Text style={[styles.switchLabel, { color: themeColors.textPrimary }]}>Turn Off Commenting</Text>
                    <Switch
                      value={disableComments}
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
          </ScrollView>
        </View>
      )}

      {/* Tag People Search Modal */}
      <Modal visible={showTagModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tag People</Text>
              <TouchableOpacity onPress={() => setShowTagModal(false)}>
                <Icon name="x" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalSearchBox}>
              <Icon name="search" size={16} color="#94A3B8" />
              <TextInput
                style={styles.modalInput}
                placeholder="Search by name or @username..."
                placeholderTextColor="#94A3B8"
                value={tagQuery}
                onChangeText={setTagQuery}
                autoFocus
              />
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
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
    fontSize: 22,
    fontWeight: '900',
    color: '#FFFFFF',
    fontFamily: 'Lora-Bold',
    marginBottom: 8,
  },
  selectSub: {
    fontSize: 13.5,
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
    fontSize: 15,
    fontWeight: '900',
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
    fontSize: 13.5,
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
    fontSize: 12.5,
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
    fontWeight: '800',
    fontSize: 13,
  },

  // ---------------- STEP 2: STUDIO EDITOR ----------------
  editorStepContainer: {
    flex: 1,
    backgroundColor: '#090D16',
    justifyContent: 'space-between',
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
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  editorTopDoneText: {
    fontSize: 15,
    fontWeight: '900',
    color: ORANGE,
  },
  canvasArea: {
    width: SCREEN_WIDTH,
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
    fontSize: 11,
    fontWeight: '900',
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
    fontSize: 10,
    fontWeight: '800',
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
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 6,
  },
  filterLabelActive: {
    color: ORANGE,
    fontWeight: '900',
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
    fontSize: 11.5,
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
    fontSize: 13.5,
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
    fontWeight: '900',
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
    fontSize: 10,
    fontWeight: '800',
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
    fontSize: 11,
    fontWeight: '800',
  },
  alignToggleBtn: {
    width: 34,
    height: 34,
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
    fontSize: 11,
    fontWeight: '800',
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
    fontSize: 10.5,
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
    fontSize: 12.5,
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
    fontSize: 12.5,
    fontWeight: '900',
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
    fontSize: 11.5,
    fontWeight: '900',
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
    fontSize: 11.5,
    fontWeight: '800',
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
    fontSize: 11.5,
    fontWeight: '700',
    color: '#94A3B8',
  },
  toolIconLabelActive: {
    color: ORANGE,
    fontWeight: '800',
  },

  // ---------------- BOTTOM THUMBNAILS & NEXT ----------------
  editorBottomActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#090D16',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  thumbsScroll: {
    flex: 1,
  },
  thumbCard: {
    width: 48,
    height: 56,
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
  },
  thumbDeleteBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMoreMediaThumbBtn: {
    width: 48,
    height: 56,
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
    fontWeight: '900',
    fontSize: 14,
  },

  // ---------------- STEP 3: DETAILS ----------------
  scrollContent: {
    flex: 1,
    padding: 16,
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
    fontSize: 13.5,
    fontWeight: '900',
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
    fontWeight: '900',
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
    fontSize: 15,
    fontWeight: '900',
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
    fontSize: 11,
    fontWeight: '900',
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
    fontSize: 13.5,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  pageItemTextActive: {
    color: ORANGE,
    fontWeight: '900',
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
    fontSize: 11,
    fontWeight: '900',
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
    fontWeight: '800',
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11.5,
    fontWeight: '900',
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
    fontSize: 12.5,
    color: '#94A3B8',
    fontWeight: '700',
  },
  craftPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
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
    fontSize: 13.5,
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
    fontWeight: '900',
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
    fontSize: 12.5,
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
    fontSize: 13.5,
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
    fontWeight: '800',
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
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
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
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 40,
  },
  userSearchMeta: {
    flex: 1,
  },
  userSearchName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  userSearchSub: {
    fontSize: 12,
    color: '#94A3B8',
  },
});

export default CreatePostScreen;
