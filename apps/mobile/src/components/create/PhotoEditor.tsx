import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, FlatList, Image, Keyboard, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ASPECTS, FILTERS, FILTER_CATEGORIES, backdropFor, clampCrop, cropForRatio, defaultRecipe, isEdited, newTextLayer, normalizeTextLayer, rotatedSize,
  type CropRect, type FilterCategory, type FilterId, type PhotoRecipe, type TextLayer,
} from '@cinecraft/core';
import { Icon } from '../common/Icon';
import { useUserSettings } from '../../hooks/useUserSettings';
import { photoInfo, releasePhoto, renderPhoto, type RenderedPhoto } from '../../services/photoRender';
import { ACCENT, ColorRow, DoubleTapLabel, EditSlider, GradientBar } from './EditorControls';
import {
  ADJUST_TOOLS, EDITOR_FONTS, TEXT_PALETTE, TEXT_PRESETS, adjustChanged, applyTextPreset, autoEnhance, filterThumbKey, fontSampleStyle, hexToHsl, hslToHex,
  isAutoEnhanced, shownValue, storedValue, thumbOrder,
} from './editorKit';

/**
 * The photo editor: filters, adjust, crop and text on one photo. The picture is drawn by the phone's own graphics code
 * (services/photoRender.ts) from the same recipe the web editor uses, so the preview is what gets posted.
 *
 * Layout: a slim row (undo, redo, hold-to-compare, reset), the photo (as big as the room allows), ONE tool panel of fixed
 * height, and a row of tools at the bottom. Filters and Adjust apply live; Crop and Text have a cancel and an apply button.
 */
interface Props {
  /** the photo as picked, at full size (a file or content address on this phone) */
  sourceUri: string;
  recipe: PhotoRecipe;
  onChange: (next: PhotoRecipe) => void;
  /** called if the phone cannot open this photo */
  onUnreadable?: () => void;
  /** the source is already a working copy (camera rotation applied, at most 1600 px), so it is used as it is */
  prepared?: boolean;
}

type Tab = 'crop' | 'filters' | 'adjust' | 'text';
type Handle = 'move' | 'nw' | 'ne' | 'sw' | 'se';
type TextTab = 'edit' | 'style' | 'font' | 'colour' | 'size' | 'outline' | 'shadow' | 'box' | 'layers';

const WORK_EDGE = 1600;
const PREVIEW_EDGE = 900;
const DRAG_EDGE = 520; // while a finger is dragging a slider or a text, the preview is drawn smaller, and sharp again on release
const FAV_KEY = 'photoEditor.favouriteFilters';
const THUMB = 72;

const fit = (w: number, h: number, maxW: number, maxH: number) => {
  const s = Math.min(maxW / Math.max(1, w), maxH / Math.max(1, h));
  return { w: Math.max(1, Math.floor(w * s)), h: Math.max(1, Math.floor(h * s)) };
};

const clampN = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

// ── filter strip ───────────────────────────────────────────────────────────────────────────────────────────────────

interface FilterItemProps {
  id: FilterId; label: string; uri?: string; selected: boolean; fav: boolean; chipBg: string; muted: string; onPick: (id: FilterId) => void; onFav: (id: FilterId) => void;
}

/** one filter: a 72 px thumbnail of the current photo with the filter on, its name, and a favourite star. Re-drawn only when its own props change. */
const FilterItem = React.memo(({ id, label, uri, selected, fav, chipBg, muted, onPick, onFav }: FilterItemProps) => (
  <View style={{ width: THUMB + 12, alignItems: 'center' }}>
    <TouchableOpacity
      onPress={() => onPick(id)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${label} filter`}
      accessibilityState={{ selected }}
      style={{ alignItems: 'center', gap: 4 }}
    >
      <View style={[styles.thumb, { backgroundColor: chipBg }, selected && { borderColor: ACCENT, borderWidth: 3 }]}>
        {uri ? <Image source={{ uri }} style={styles.thumbImg} resizeMode="cover" /> : null}
      </View>
      <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: selected ? '700' : '600', color: selected ? ACCENT : muted, maxWidth: THUMB + 8 }}>{label}</Text>
    </TouchableOpacity>
    {id !== 'normal' && (
      <TouchableOpacity
        onPress={() => onFav(id)}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
        accessibilityRole="button"
        accessibilityLabel={fav ? `Remove ${label} from favourites` : `Add ${label} to favourites`}
        style={styles.favBtn}
      >
        <Text style={{ fontSize: 15, color: fav ? '#FACC15' : '#FFFFFF', textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 3 }}>{fav ? '★' : '☆'}</Text>
      </TouchableOpacity>
    )}
  </View>
));

// ── colour picker (swatches, hue, lightness) ───────────────────────────────────────────────────────────────────────────

const HUE_STOPS = Array.from({ length: 24 }, (_, i) => hslToHex(i * 15, 1, 0.5));

const ColorPicker = ({ value, onPick, onStart, onEnd, ring, border, text, label, auto }: {
  value: string | null; onPick: (c: string) => void; onStart: () => void; onEnd: () => void; ring: string; border: string; text: string; label: string;
  auto?: { selected: boolean; onPick: () => void; color: string };
}) => {
  const init = useMemo(() => hexToHsl(value && value.startsWith('#') ? value : '#FF4B33'), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [hue, setHue] = useState(init.h);
  const [light, setLight] = useState(init.l);
  const lightStops = useMemo(() => Array.from({ length: 17 }, (_, i) => hslToHex(hue, 1, i / 16)), [hue]);
  return (
    <View style={{ gap: 2 }}>
      <ColorRow colors={TEXT_PALETTE} selected={value} onPick={onPick} ring={ring} border={border} label={label} auto={auto} />
      <Text style={{ color: text, fontSize: 11, fontWeight: '600', opacity: 0.7 }}>Custom colour</Text>
      <GradientBar label="Hue" colors={HUE_STOPS} value={hue / 360} thumbColor={hslToHex(hue, 1, 0.5)} onStart={onStart} onEnd={onEnd} onChange={(v) => { setHue(v * 360); onPick(hslToHex(v * 360, 1, light)); }} />
      <GradientBar label="Lightness" colors={lightStops} value={light} thumbColor={hslToHex(hue, 1, light)} onStart={onStart} onEnd={onEnd} onChange={(v) => { setLight(v); onPick(hslToHex(hue, 1, v)); }} />
    </View>
  );
};

export const PhotoEditor: React.FC<Props> = ({ sourceUri, recipe, onChange, onUnreadable, prepared }) => {
  const { themeColors } = useUserSettings();
  const insets = useSafeAreaInsets();
  const [work, setWork] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [preview, setPreview] = useState<RenderedPhoto | null>(null);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Tab>('filters');
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [textTab, setTextTab] = useState<TextTab>('edit');
  const [adjKey, setAdjKey] = useState<(typeof ADJUST_TOOLS)[number]['key']>('brightness');
  const [cat, setCat] = useState<FilterCategory | 'fav'>(() => FILTERS.find((f) => f.id === recipe.filter)?.category ?? 'basic');
  const [favs, setFavs] = useState<string[]>([]);
  const [past, setPast] = useState<PhotoRecipe[]>([]);
  const [future, setFuture] = useState<PhotoRecipe[]>([]);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [room, setRoom] = useState({ w: 0, h: 0 });
  const [photoSize, setPhotoSize] = useState<{ width: number; height: number } | null>(null);
  const [comparing, setComparing] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const [settle, setSettle] = useState(0); // goes up when a drag ends, so the sharp preview is drawn

  const recipeRef = useRef(recipe);
  recipeRef.current = recipe;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const gestureStart = useRef<PhotoRecipe | null>(null);
  const interacting = useRef(false);
  const preparedRef = useRef(!!prepared);
  const workRef = useRef<string | null>(null);
  const snapRef = useRef<{ recipe: PhotoRecipe; pastLen: number } | null>(null);
  const inputRef = useRef<TextInput>(null);
  const panelAnim = useRef(new Animated.Value(1)).current;

  // favourite filters are remembered on this phone
  useEffect(() => {
    let alive = true;
    AsyncStorage.getItem(FAV_KEY).then((v) => { if (alive && v) { try { const a = JSON.parse(v); if (Array.isArray(a)) setFavs(a.filter((x) => typeof x === 'string')); } catch { /* no favourites yet */ } } }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  const toggleFav = useCallback((id: FilterId) => {
    setFavs((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      AsyncStorage.setItem(FAV_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  useEffect(() => {
    const a = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true));
    const b = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => { a.remove(); b.remove(); };
  }, []);

  // a short fade and slide when the tool panel changes
  useEffect(() => {
    panelAnim.setValue(0);
    Animated.timing(panelAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [tab, panelAnim]);

  // open the photo and make a working copy (at most 1600 px) that the preview and thumbnails are drawn from
  useEffect(() => {
    let alive = true;
    setWork(null);
    setPreview(null);
    setFailed(false);
    (async () => {
      try {
        const size = await photoInfo(sourceUri);
        const copyUri = prepared ? sourceUri : (await renderPhoto(sourceUri, defaultRecipe(), { maxEdge: WORK_EDGE, withText: false, format: 'jpeg', quality: 92 })).uri;
        if (!alive) return;
        setPhotoSize(size);
        workRef.current = copyUri;
        setWork(copyUri);
      } catch {
        if (alive) { setFailed(true); onUnreadable?.(); }
      }
    })();
    return () => { alive = false; };
  }, [sourceUri]); // eslint-disable-line react-hooks/exhaustive-deps

  const turned = useMemo(() => (photoSize ? rotatedSize(photoSize.width, photoSize.height, recipe.rotate) : { w: 1, h: 1 }), [photoSize, recipe.rotate]);

  // draw the preview: the whole turned photo while the crop is set, the cropped result in the other tools (latest request wins).
  // While a finger is dragging, it is drawn smaller and not so often; the sharp one follows on release.
  const seq = useRef(0);
  const trail = useRef<string[]>([]); // preview pictures still on screen or about to be; older ones are deleted
  const thumbFiles = useRef<Record<string, string>>({});
  const thumbKeyRef = useRef('');
  useEffect(() => () => {
    trail.current.forEach((u) => releasePhoto(u));
    Object.values(thumbFiles.current).forEach((u) => releasePhoto(u));
    if (preparedRef.current === false && workRef.current) releasePhoto(workRef.current);
  }, []);
  useEffect(() => {
    if (!work) return;
    const mine = ++seq.current;
    const quick = interacting.current;
    const t = setTimeout(async () => {
      try {
        const r = await renderPhoto(work, recipe, { maxEdge: quick ? DRAG_EDGE : PREVIEW_EDGE, whole: tab === 'crop', withText: tab !== 'crop', format: 'jpeg', quality: quick ? 70 : 85 });
        if (mine === seq.current) {
          setPreview(r);
          trail.current.push(r.uri);
          while (trail.current.length > 2) releasePhoto(trail.current.shift());
        } else {
          releasePhoto(r.uri);
        }
      } catch { /* the previous preview stays */ }
    }, quick ? 60 : 30);
    return () => clearTimeout(t);
  }, [work, recipe, tab, settle]);

  // filter thumbnails follow the turn and crop only (not the sliders or the chosen filter), and are drawn once per photo state
  const thumbKey = work ? filterThumbKey(work, recipe) : '';
  useEffect(() => {
    if (!work || tab !== 'filters') return;
    if (thumbKeyRef.current !== thumbKey) {
      Object.values(thumbFiles.current).forEach((u) => releasePhoto(u));
      thumbFiles.current = {};
      thumbKeyRef.current = thumbKey;
      setThumbs({});
    }
    let alive = true;
    const t = setTimeout(async () => {
      const shownNow = FILTERS.filter((f) => (cat === 'fav' ? favs.includes(f.id) : f.category === cat)).map((f) => f.id);
      const order = thumbOrder(FILTERS.map((f) => f.id), shownNow);
      const base = { ...defaultRecipe(), rotate: recipeRef.current.rotate, flipH: recipeRef.current.flipH, crop: recipeRef.current.crop };
      for (const id of order) {
        if (!alive) return;
        if (thumbFiles.current[id]) continue;
        try {
          const r = await renderPhoto(work, { ...base, filter: id }, { maxEdge: 160, withText: false, format: 'jpeg', quality: 80 });
          if (alive) {
            thumbFiles.current[id] = r.uri;
            setThumbs((prev) => ({ ...prev, [id]: r.uri }));
          } else {
            releasePhoto(r.uri);
          }
        } catch { /* a missing thumbnail is fine */ }
      }
    }, 150);
    return () => { alive = false; clearTimeout(t); };
  }, [work, tab, thumbKey, cat]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── history ──────────────────────────────────────────────────────────────────────────────────────────────────
  const beginGesture = useCallback(() => { gestureStart.current = recipeRef.current; interacting.current = true; }, []);
  const endGesture = useCallback(() => {
    const start = gestureStart.current;
    gestureStart.current = null;
    interacting.current = false;
    if (start && JSON.stringify(start) !== JSON.stringify(recipeRef.current)) { setPast((p) => [...p.slice(-39), start]); setFuture([]); }
    setSettle((n) => n + 1);
  }, []);
  const commit = (next: PhotoRecipe) => { setPast((p) => [...p.slice(-39), recipeRef.current]); setFuture([]); onChange(next); };
  const undo = () => { const prev = past[past.length - 1]; if (!prev) return; setPast((p) => p.slice(0, -1)); setFuture((f) => [recipeRef.current, ...f]); onChange(prev); };
  const redo = () => { const next = future[0]; if (!next) return; setFuture((f) => f.slice(1)); setPast((p) => [...p, recipeRef.current]); onChange(next); };
  const doReset = () => { if (isEdited(recipeRef.current)) commit(defaultRecipe()); setSelectedText(null); };
  const reset = () => {
    if (!isEdited(recipeRef.current)) return;
    Alert.alert('Reset all edits?', 'This puts the photo back as it was picked. You can still undo.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: doReset },
    ]);
  };

  // ── tools ────────────────────────────────────────────────────────────────────────────────────────────────────
  const selectTool = (next: Tab) => {
    if (next === tab) return;
    // leaving crop or text with another tool keeps what was done; coming into them remembers the start, so cancel can go back
    if (next === 'crop' || next === 'text') snapRef.current = { recipe: recipeRef.current, pastLen: past.length };
    else snapRef.current = null;
    if (next !== 'text') { setSelectedText(null); Keyboard.dismiss(); }
    setTab(next);
  };
  const applyTool = () => { snapRef.current = null; setSelectedText(null); Keyboard.dismiss(); setTab('filters'); };
  const cancelTool = () => {
    const s = snapRef.current;
    if (s) { onChange(s.recipe); setPast((p) => p.slice(0, s.pastLen)); setFuture([]); }
    snapRef.current = null;
    setSelectedText(null);
    Keyboard.dismiss();
    setTab('filters');
  };

  // ── geometry of what is on screen ───────────────────────────────────────────────────────────────────────────
  const disp = useMemo(() => (preview && stage.w > 0 ? fit(preview.width, preview.height, stage.w - 16, stage.h - 16) : { w: 1, h: 1 }), [preview, stage]);
  const dispRef = useRef(disp);
  dispRef.current = disp;
  const previewRef = useRef(preview);
  previewRef.current = preview;
  const turnedRef = useRef(turned);
  turnedRef.current = turned;
  const tabRef = useRef(tab);
  tabRef.current = tab;

  // ── crop ─────────────────────────────────────────────────────────────────────────────────────────────────────
  const ratioOf = (aspect: PhotoRecipe['aspect']) => ASPECTS.find((a) => a.id === aspect)?.ratio ?? null;
  const chooseAspect = (id: PhotoRecipe['aspect']) => {
    const ratio = ratioOf(id);
    const crop = id === 'original' ? { x: 0, y: 0, w: 1, h: 1 } : id === 'free' ? recipe.crop : cropForRatio(turned.w, turned.h, ratio, recipe.crop);
    commit({ ...recipe, aspect: id, crop });
  };
  const turn = (dir: 1 | -1) => {
    if (!photoSize) return;
    const rotate = ((((recipe.rotate + dir * 90) % 360) + 360) % 360) as PhotoRecipe['rotate'];
    const next = rotatedSize(photoSize.width, photoSize.height, rotate);
    const ratio = ratioOf(recipe.aspect);
    commit({ ...recipe, rotate, crop: ratio ? cropForRatio(next.w, next.h, ratio) : { x: 0, y: 0, w: 1, h: 1 } });
  };
  const flip = () => commit({ ...recipe, flipH: !recipe.flipH, crop: { ...recipe.crop, x: 1 - recipe.crop.x - recipe.crop.w } });

  const makeCropResponder = (mode: Handle) => {
    let start: CropRect = { x: 0, y: 0, w: 1, h: 1 };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => tabRef.current === 'crop',
      onMoveShouldSetPanResponder: () => tabRef.current === 'crop',
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => { start = recipeRef.current.crop; beginGesture(); },
      onPanResponderMove: (_e, g) => {
        const d = dispRef.current;
        const dx = g.dx / d.w;
        const dy = g.dy / d.h;
        const ratio = ratioOf(recipeRef.current.aspect);
        const ratioN = ratio ? (ratio * turnedRef.current.h) / turnedRef.current.w : null;
        let next: CropRect;
        if (mode === 'move') {
          next = { ...start, x: Math.min(1 - start.w, Math.max(0, start.x + dx)), y: Math.min(1 - start.h, Math.max(0, start.y + dy)) };
        } else {
          const west = mode === 'nw' || mode === 'sw';
          const north = mode === 'nw' || mode === 'ne';
          const fx = west ? start.x + start.w : start.x;
          const fy = north ? start.y + start.h : start.y;
          const px = Math.min(1, Math.max(0, (west ? start.x : start.x + start.w) + dx));
          const py = Math.min(1, Math.max(0, (north ? start.y : start.y + start.h) + dy));
          const roomX = west ? fx : 1 - fx;
          const roomY = north ? fy : 1 - fy;
          let w = Math.min(Math.abs(px - fx), roomX);
          let h = Math.min(Math.abs(py - fy), roomY);
          if (ratioN) { h = w / ratioN; if (h > roomY) { h = roomY; w = h * ratioN; } }
          w = Math.max(0.05, w);
          h = Math.max(0.05, h);
          next = clampCrop({ x: west ? fx - w : fx, y: north ? fy - h : fy, w, h });
        }
        onChangeRef.current({ ...recipeRef.current, crop: next });
      },
      onPanResponderRelease: endGesture,
      onPanResponderTerminate: endGesture,
    });
  };
  const cropResponders = useRef<Record<Handle, ReturnType<typeof PanResponder.create>> | null>(null);
  if (!cropResponders.current) {
    cropResponders.current = { move: makeCropResponder('move'), nw: makeCropResponder('nw'), ne: makeCropResponder('ne'), sw: makeCropResponder('sw'), se: makeCropResponder('se') };
  }

  // ── text ─────────────────────────────────────────────────────────────────────────────────────────────────────
  const updateText = (id: string, patch: Partial<TextLayer>) => onChangeRef.current({ ...recipeRef.current, text: recipeRef.current.text.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  const patchText = (id: string, patch: Partial<TextLayer>) => commit({ ...recipeRef.current, text: recipeRef.current.text.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  const addText = () => {
    const layer = { ...newTextLayer('Your text'), y: 50 + (recipe.text.length % 4) * 8 };
    commit({ ...recipe, text: [...recipe.text, layer] });
    setSelectedText(layer.id);
    setTextTab('edit');
    // the keyboard opens on the new text, all of it selected, so typing replaces it
    setTimeout(() => inputRef.current?.focus(), 160);
  };
  const removeText = (id: string) => { commit({ ...recipe, text: recipe.text.filter((t) => t.id !== id) }); setSelectedText(null); };
  const duplicateText = (id: string) => {
    const src = recipe.text.find((t) => t.id === id);
    if (!src) return;
    const copy = { ...src, id: newTextLayer('').id, x: Math.min(95, src.x + 5), y: Math.min(95, src.y + 5) };
    commit({ ...recipe, text: [...recipe.text, copy] });
    setSelectedText(copy.id);
  };
  /** later in the list is drawn on top */
  const moveLayer = (id: string, dir: 1 | -1) => {
    const list = [...recipe.text];
    const i = list.findIndex((t) => t.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    commit({ ...recipe, text: list });
  };

  const selected = recipe.text.find((t) => t.id === selectedText) || null;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const selectedFull = selected ? normalizeTextLayer(selected) : null;
  const selectedBox = selected && preview ? preview.boxes.find((b) => b.id === selected.id) : undefined;

  /** touch on the photo while Text is the tool: tap to select, drag to move, two fingers to resize and turn, tap empty photo to deselect */
  const textResponder = useRef(
    (() => {
      let dragging: { id: string; lx: number; ly: number } | null = null;
      let origin = { dx: 0, dy: 0 };
      let pinch: { id: string; size: number; rotate: number; dist: number; angle: number } | null = null;
      let moved = false;
      let onText = false;
      const end = () => {
        if (!moved && !onText && !pinch) setSelectedText(null);
        endGesture();
        dragging = null;
        pinch = null;
      };
      return PanResponder.create({
        onStartShouldSetPanResponder: () => tabRef.current === 'text',
        onMoveShouldSetPanResponder: () => tabRef.current === 'text',
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          moved = false; pinch = null; origin = { dx: 0, dy: 0 }; onText = false; dragging = null;
          beginGesture();
          const p = previewRef.current;
          const d = dispRef.current;
          if (!p) return;
          const px = (e.nativeEvent.locationX / d.w) * p.width;
          const py = (e.nativeEvent.locationY / d.h) * p.height;
          // the touch, turned back by the text's own turn, so a tilted text is hit where it really is
          const hit = [...p.boxes].reverse().find((b) => {
            const a = (-b.rotate * Math.PI) / 180;
            const dx = px - b.cx; const dy = py - b.cy;
            const lx = dx * Math.cos(a) - dy * Math.sin(a);
            const ly = dx * Math.sin(a) + dy * Math.cos(a);
            return Math.abs(lx) <= b.w / 2 + 12 && Math.abs(ly) <= b.h / 2 + 12;
          });
          if (!hit) return;
          const layer = recipeRef.current.text.find((t) => t.id === hit.id);
          if (!layer) return;
          onText = true;
          dragging = { id: hit.id, lx: layer.x, ly: layer.y };
          setSelectedText(hit.id);
        },
        onPanResponderMove: (e, g) => {
          const touches = e.nativeEvent.touches;
          if (touches && touches.length >= 2) {
            const id = selectedRef.current?.id ?? dragging?.id;
            const src = id ? recipeRef.current.text.find((t) => t.id === id) : undefined;
            if (!id || !src) return;
            const a = touches[0]; const b = touches[1];
            const dist = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
            const ang = (Math.atan2(b.pageY - a.pageY, b.pageX - a.pageX) * 180) / Math.PI;
            if (!pinch || pinch.id !== id) {
              const full = normalizeTextLayer(src);
              pinch = { id, size: full.size, rotate: full.rotate, dist: Math.max(10, dist), angle: ang };
            }
            moved = true;
            let rot = pinch.rotate + (ang - pinch.angle);
            rot = ((((rot + 180) % 360) + 360) % 360) - 180;
            if (Math.abs(rot) < 3) rot = 0;
            updateText(id, { size: clampN(pinch.size * (dist / pinch.dist), 3, 30), rotate: Math.round(rot) });
            return;
          }
          if (pinch) {
            // one finger again: carry on dragging from where the text is now
            pinch = null;
            const cur = dragging ? recipeRef.current.text.find((t) => t.id === dragging!.id) : undefined;
            if (dragging && cur) dragging = { id: dragging.id, lx: cur.x, ly: cur.y };
            origin = { dx: g.dx, dy: g.dy };
          }
          if (!dragging) return;
          if (Math.abs(g.dx) + Math.abs(g.dy) > 6) moved = true;
          const d = dispRef.current;
          updateText(dragging.id, {
            x: clampN(dragging.lx + ((g.dx - origin.dx) / d.w) * 100, 0, 100),
            y: clampN(dragging.ly + ((g.dy - origin.dy) / d.h) * 100, 0, 100),
          });
        },
        onPanResponderRelease: end,
        onPanResponderTerminate: end,
      });
    })(),
  ).current;

  /** the round handle on a selected text: pulling it away or toward the centre resizes the text, moving it around turns it */
  const handleResponder = useRef(
    (() => {
      let start = { id: '', size: 8, rotate: 0, hx: 1, hy: 1, dist: 1, angle: 0 };
      return PanResponder.create({
        onStartShouldSetPanResponder: () => tabRef.current === 'text',
        onMoveShouldSetPanResponder: () => tabRef.current === 'text',
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => {
          const p = previewRef.current;
          const d = dispRef.current;
          const sel = selectedRef.current;
          if (!p || !sel) return;
          const box = p.boxes.find((b) => b.id === sel.id);
          if (!box) return;
          const k = d.w / p.width;
          const a = (box.rotate * Math.PI) / 180;
          const hx0 = (box.w / 2) * k * Math.cos(a) - (box.h / 2) * k * Math.sin(a);
          const hy0 = (box.w / 2) * k * Math.sin(a) + (box.h / 2) * k * Math.cos(a);
          const layer = normalizeTextLayer(sel);
          start = { id: sel.id, size: layer.size, rotate: layer.rotate, hx: hx0, hy: hy0, dist: Math.max(8, Math.hypot(hx0, hy0)), angle: Math.atan2(hy0, hx0) };
          beginGesture();
        },
        onPanResponderMove: (_e, g) => {
          const hx = start.hx + g.dx;
          const hy = start.hy + g.dy;
          const dist = Math.max(8, Math.hypot(hx, hy));
          let rot = start.rotate + ((Math.atan2(hy, hx) - start.angle) * 180) / Math.PI;
          rot = ((((rot + 180) % 360) + 360) % 360) - 180;
          if (Math.abs(rot) < 3) rot = 0; // a gentle snap to level
          updateText(start.id, { size: Math.min(30, Math.max(3, start.size * (dist / start.dist))), rotate: Math.round(rot) });
        },
        onPanResponderRelease: endGesture,
        onPanResponderTerminate: endGesture,
      });
    })(),
  ).current;

  // ── filters list ─────────────────────────────────────────────────────────────────────────────────────────────
  const pickFilter = useCallback((id: FilterId) => {
    const r = recipeRef.current;
    if (r.filter === id) return;
    setPast((p) => [...p.slice(-39), r]);
    setFuture([]);
    onChangeRef.current({ ...r, filter: id, intensity: 100 });
  }, []);
  const chipBg = themeColors.chipBg;
  const muted = themeColors.textSecondary;
  const text = themeColors.textPrimary;
  const filterList = useMemo(() => {
    const list = FILTERS.filter((f) => (cat === 'fav' ? favs.includes(f.id) : f.category === cat));
    return list.some((f) => f.id === 'normal') ? list : [FILTERS[0], ...list];
  }, [cat, favs]);
  const renderFilter = useCallback(({ item }: { item: (typeof FILTERS)[number] }) => (
    <FilterItem id={item.id} label={item.id === 'normal' ? 'Original' : item.label} uri={thumbs[item.id]} selected={recipe.filter === item.id} fav={favs.includes(item.id)} chipBg={chipBg} muted={muted} onPick={pickFilter} onFav={toggleFav} />
  ), [thumbs, recipe.filter, favs, chipBg, muted, pickFilter, toggleFav]);

  // ── screen ───────────────────────────────────────────────────────────────────────────────────────────────────
  if (failed) {
    return (
      <View style={styles.center}>
        <Text style={{ color: muted, textAlign: 'center' }}>This photo could not be opened for editing. It will be posted as it is.</Text>
      </View>
    );
  }
  if (!work) {
    return <View style={styles.center}><ActivityIndicator color={ACCENT} /></View>;
  }

  const panelH = Math.round(clampN(room.h * 0.36, 176, 212));
  const crop = recipe.crop;
  const left = (stage.w - disp.w) / 2;
  const top = (stage.h - disp.h) / 2;
  const edited = isEdited(recipe);
  const tools: { id: Tab; label: string; icon: string }[] = [
    { id: 'filters', label: 'Filters', icon: 'sparkles' },
    { id: 'adjust', label: 'Adjust', icon: 'sliders' },
    { id: 'crop', label: 'Crop', icon: 'crop' },
    { id: 'text', label: 'Text', icon: 'type' },
  ];
  const adjTool = ADJUST_TOOLS.find((a) => a.key === adjKey) ?? ADJUST_TOOLS[0];
  const adjValue = recipe.adjust[adjTool.key] || 0;
  const setAdjust = (key: (typeof ADJUST_TOOLS)[number]['key'], v: number) => onChangeRef.current({ ...recipeRef.current, adjust: { ...recipeRef.current.adjust, [key]: v } });
  const stepBtn = (disabled: boolean) => [styles.iconBtn, { opacity: disabled ? 0.35 : 1 }];
  const sliderColors = { trackColor: muted, textColor: text } as const;

  const header = (title: string, withApply: boolean) => (
    <View style={styles.panelHead}>
      <Text style={[styles.panelTitle, { color: text }]}>{title}</Text>
      {withApply && (
        <View style={styles.row}>
          <TouchableOpacity onPress={cancelTool} accessibilityRole="button" accessibilityLabel={`Cancel ${title.toLowerCase()} changes`} style={styles.iconBtn}>
            <Icon name="x" size={22} color={text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={applyTool} accessibilityRole="button" accessibilityLabel={`Apply ${title.toLowerCase()}`} style={[styles.iconBtn, { backgroundColor: ACCENT, borderRadius: 22 }]}>
            <Icon name="check" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const textChip = (id: TextTab, label: string) => (
    <TouchableOpacity key={id} onPress={() => setTextTab(id)} accessibilityRole="tab" accessibilityState={{ selected: textTab === id }} style={[styles.subChip, { backgroundColor: textTab === id ? ACCENT : chipBg }]}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: textTab === id ? '#FFFFFF' : muted }}>{label}</Text>
    </TouchableOpacity>
  );
  const toggleRow = (label: string, on: boolean, onPress: () => void) => (
    <TouchableOpacity onPress={onPress} accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: on }} style={[styles.toggle, { borderColor: on ? ACCENT : themeColors.border, backgroundColor: on ? ACCENT + '1A' : 'transparent' }]}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: on ? ACCENT : muted }}>{label}: {on ? 'On' : 'Off'}</Text>
    </TouchableOpacity>
  );
  const textSlider = (label: string, value: number, min: number, max: number, key: keyof TextLayer, format?: (v: number) => string, toStore: (v: number) => number = (v) => v) => (
    <EditSlider
      mode="stacked"
      label={label}
      value={value}
      min={min}
      max={max}
      format={format}
      neutral={min <= 0 && max >= 0 ? 0 : undefined}
      onStart={beginGesture}
      onEnd={endGesture}
      onChange={(v) => selected && updateText(selected.id, { [key]: toStore(v) } as Partial<TextLayer>)}
      {...sliderColors}
    />
  );

  const renderText = () => {
    if (!selected || !selectedFull) {
      return (
        <View style={{ gap: 8 }}>
          <TouchableOpacity onPress={addText} accessibilityRole="button" accessibilityLabel="Add text" style={styles.addText}>
            <Icon name="plus" size={20} color="#FFFFFF" />
            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 15 }}>Add text</Text>
          </TouchableOpacity>
          {recipe.text.length === 0
            ? <Text style={{ color: muted, fontSize: 12, textAlign: 'center' }}>Drag the text to move it. Pinch with two fingers to resize and turn it. Tap the photo to deselect.</Text>
            : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
                {recipe.text.map((t) => (
                  <TouchableOpacity key={t.id} onPress={() => { setSelectedText(t.id); setTextTab('style'); }} accessibilityRole="button" accessibilityLabel={`Select text ${t.text}`} style={[styles.subChip, { backgroundColor: chipBg }]}>
                    <Text numberOfLines={1} style={{ maxWidth: 120, fontSize: 13, fontWeight: '600', color: text }}>{t.text || 'Empty'}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
        </View>
      );
    }
    const f = selectedFull;
    return (
      <View style={{ flex: 1 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 6 }} keyboardShouldPersistTaps="handled" accessibilityRole="tablist">
          {textChip('edit', 'Edit')}{textChip('style', 'Styles')}{textChip('font', 'Font')}{textChip('colour', 'Colour')}{textChip('size', 'Size')}
          {textChip('outline', 'Outline')}{textChip('shadow', 'Shadow')}{textChip('box', 'Background')}{textChip('layers', 'Layers')}
        </ScrollView>
        <ScrollView style={{ flex: 1 }} nestedScrollEnabled keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 6 }}>
          {textTab === 'edit' && (
            <TextInput
              ref={inputRef}
              value={selected.text}
              onChangeText={(v) => updateText(selected.id, { text: v })}
              maxLength={120}
              multiline
              selectTextOnFocus
              placeholder="Write something"
              placeholderTextColor={muted}
              style={[styles.input, { color: text, borderColor: themeColors.border }]}
              accessibilityLabel="Edit text"
            />
          )}
          {textTab === 'style' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
              {TEXT_PRESETS.map((p) => {
                const sample = EDITOR_FONTS.find((x) => x.id === p.style.font);
                const bgc = typeof p.style.bg === 'string' && p.style.backdrop && p.style.backdrop !== 'none' ? p.style.bg : 'transparent';
                return (
                  <TouchableOpacity key={p.id} onPress={() => commit({ ...recipeRef.current, text: recipeRef.current.text.map((t) => (t.id === selected.id ? applyTextPreset(t, p) : t)) })} accessibilityRole="button" accessibilityLabel={`${p.label} style`} style={[styles.presetBtn, { borderColor: themeColors.border, backgroundColor: '#1F2937' }]}>
                    <Text style={[{ fontSize: 20, color: p.style.color ?? '#FFFFFF', backgroundColor: bgc, paddingHorizontal: 6, borderRadius: p.style.bgRadius === 0 ? 0 : 6, overflow: 'hidden' }, sample ? fontSampleStyle(sample) : null, p.style.outline ? { textShadowColor: p.style.strokeColor || '#000', textShadowRadius: 3 } : null, p.id === 'neon' ? { textShadowColor: '#FF2D95', textShadowRadius: 8 } : null]}>Aa</Text>
                    <Text numberOfLines={1} style={{ fontSize: 11, color: '#E5E7EB', marginTop: 2 }}>{p.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
          {textTab === 'font' && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
              <TouchableOpacity onPress={() => patchText(selected.id, { bold: !f.bold })} accessibilityRole="button" accessibilityLabel="Bold" accessibilityState={{ selected: f.bold }} style={[styles.boxBtn, { borderColor: f.bold ? ACCENT : themeColors.border, backgroundColor: f.bold ? ACCENT + '1A' : 'transparent' }]}>
                <Text style={{ fontWeight: '900', fontSize: 18, color: f.bold ? ACCENT : text }}>B</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => patchText(selected.id, { italic: !f.italic })} accessibilityRole="button" accessibilityLabel="Italic" accessibilityState={{ selected: f.italic }} style={[styles.boxBtn, { borderColor: f.italic ? ACCENT : themeColors.border, backgroundColor: f.italic ? ACCENT + '1A' : 'transparent' }]}>
                <Text style={{ fontStyle: 'italic', fontWeight: '700', fontSize: 18, color: f.italic ? ACCENT : text }}>I</Text>
              </TouchableOpacity>
              {EDITOR_FONTS.map((fnt) => (
                <TouchableOpacity
                  key={fnt.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${fnt.label} font`}
                  accessibilityState={{ selected: f.font === fnt.id }}
                  onPress={() => patchText(selected.id, { font: fnt.id })}
                  style={[styles.fontChip, { borderColor: f.font === fnt.id ? ACCENT : themeColors.border, backgroundColor: f.font === fnt.id ? ACCENT + '1A' : 'transparent' }]}
                >
                  <Text numberOfLines={1} style={[{ fontSize: 17, color: f.font === fnt.id ? ACCENT : text }, fontSampleStyle(fnt)]}>{fnt.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          {textTab === 'colour' && (
            <ColorPicker key={`c-${selected.id}`} value={f.color} onPick={(c) => updateText(selected.id, { color: c })} onStart={beginGesture} onEnd={endGesture} ring={ACCENT} border={themeColors.border} text={text} label="Text colour" />
          )}
          {textTab === 'size' && (
            <View style={{ gap: 4 }}>
              {textSlider('Size', Math.round(f.size), 3, 30, 'size')}
              {textSlider('Letter spacing', Math.round(f.letterSpacing), -10, 60, 'letterSpacing')}
              {textSlider('Line height', Math.round(f.lineHeight * 10), 8, 24, 'lineHeight', (v) => (v / 10).toFixed(1), (v) => v / 10)}
              {textSlider('Opacity', Math.round(f.opacity), 10, 100, 'opacity', (v) => `${v}%`)}
              {textSlider('Tilt', Math.round(f.rotate), -180, 180, 'rotate', (v) => `${v}°`)}
              <View style={[styles.segment, { borderColor: themeColors.border, alignSelf: 'flex-start' }]}>
                {(['left', 'center', 'right'] as const).map((id) => (
                  <TouchableOpacity key={id} accessibilityRole="button" accessibilityLabel={`Align ${id}`} accessibilityState={{ selected: f.align === id }} onPress={() => patchText(selected.id, { align: id })} style={[styles.segBtn, f.align === id && { backgroundColor: ACCENT }]}>
                    <Icon name={id === 'left' ? 'align-left' : id === 'center' ? 'align-center' : 'align-right'} size={18} color={f.align === id ? '#FFFFFF' : muted} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          {textTab === 'outline' && (
            <View style={{ gap: 4 }}>
              {toggleRow('Outline', f.outline, () => patchText(selected.id, { outline: !f.outline }))}
              {f.outline && (
                <>
                  {textSlider('Width', Math.round(f.strokeWidth), 2, 40, 'strokeWidth')}
                  <ColorPicker key={`o-${selected.id}`} value={f.strokeColor || null} onPick={(c) => updateText(selected.id, { strokeColor: c })} onStart={beginGesture} onEnd={endGesture} ring={ACCENT} border={themeColors.border} text={text} label="Outline colour" auto={{ selected: !f.strokeColor, color: text, onPick: () => patchText(selected.id, { strokeColor: '' }) }} />
                </>
              )}
            </View>
          )}
          {textTab === 'shadow' && (
            <View style={{ gap: 4 }}>
              {toggleRow('Shadow or glow', f.shadow, () => patchText(selected.id, { shadow: !f.shadow }))}
              {f.shadow && (
                <>
                  {textSlider('Blur', Math.round(f.shadowBlur), 0, 100, 'shadowBlur')}
                  <ColorPicker key={`s-${selected.id}`} value={f.shadowColor || null} onPick={(c) => updateText(selected.id, { shadowColor: c })} onStart={beginGesture} onEnd={endGesture} ring={ACCENT} border={themeColors.border} text={text} label="Shadow colour" auto={{ selected: !f.shadowColor, color: text, onPick: () => patchText(selected.id, { shadowColor: '' }) }} />
                </>
              )}
            </View>
          )}
          {textTab === 'box' && (
            <View style={{ gap: 4 }}>
              <View style={[styles.segment, { borderColor: themeColors.border, alignSelf: 'flex-start' }]}>
                {([['none', 'None'], ['box', 'Box'], ['highlight', 'Band']] as const).map(([id, label]) => (
                  <TouchableOpacity
                    key={id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: f.backdrop === id }}
                    onPress={() => patchText(selected.id, id !== 'none' && f.backdrop === 'none' ? { backdrop: id, bg: backdropFor(f.color), bgRadius: id === 'highlight' ? 22 : 30 } : { backdrop: id })}
                    style={[styles.segBtn, { paddingHorizontal: 16 }, f.backdrop === id && { backgroundColor: ACCENT }]}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: f.backdrop === id ? '#FFFFFF' : muted }}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {f.backdrop !== 'none' && (
                <>
                  {textSlider('Corner radius', Math.round(f.bgRadius), 0, 100, 'bgRadius')}
                  <ColorPicker key={`b-${selected.id}`} value={f.bg.startsWith('#') ? f.bg : null} onPick={(c) => updateText(selected.id, { bg: c })} onStart={beginGesture} onEnd={endGesture} ring={ACCENT} border={themeColors.border} text={text} label="Background colour" />
                </>
              )}
            </View>
          )}
          {textTab === 'layers' && (
            <View style={{ gap: 6 }}>
              <View style={styles.row}>
                <TouchableOpacity onPress={() => moveLayer(selected.id, 1)} accessibilityRole="button" accessibilityLabel="Bring forward" style={[styles.actionBtn, { borderColor: themeColors.border }]}><Text style={{ color: text, fontWeight: '600', fontSize: 13 }}>Forward</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => moveLayer(selected.id, -1)} accessibilityRole="button" accessibilityLabel="Send back" style={[styles.actionBtn, { borderColor: themeColors.border }]}><Text style={{ color: text, fontWeight: '600', fontSize: 13 }}>Back</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => duplicateText(selected.id)} accessibilityRole="button" accessibilityLabel="Duplicate text" style={[styles.actionBtn, { borderColor: themeColors.border }]}><Text style={{ color: text, fontWeight: '600', fontSize: 13 }}>Duplicate</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => removeText(selected.id)} accessibilityRole="button" accessibilityLabel="Delete text" style={[styles.actionBtn, { borderColor: '#EF4444' }]}><Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 13 }}>Delete</Text></TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
                {[...recipe.text].reverse().map((t) => (
                  <TouchableOpacity key={t.id} onPress={() => setSelectedText(t.id)} accessibilityRole="button" accessibilityLabel={`Select text ${t.text}`} style={[styles.subChip, { backgroundColor: t.id === selected.id ? ACCENT : chipBg }]}>
                    <Text numberOfLines={1} style={{ maxWidth: 120, fontSize: 13, fontWeight: '600', color: t.id === selected.id ? '#FFFFFF' : text }}>{t.text || 'Empty'}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={addText} accessibilityRole="button" accessibilityLabel="Add text" style={[styles.subChip, { borderWidth: 1, borderColor: ACCENT }]}><Text style={{ color: ACCENT, fontWeight: '700', fontSize: 13 }}>+ Text</Text></TouchableOpacity>
              </ScrollView>
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.root} onLayout={(e) => setRoom({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {/* slim row: undo, redo, compare, reset */}
      <View style={[styles.actions, { backgroundColor: themeColors.bgCard, borderBottomColor: themeColors.border }]}>
        <TouchableOpacity onPress={undo} disabled={past.length === 0} style={stepBtn(past.length === 0)} accessibilityRole="button" accessibilityLabel="Undo" accessibilityState={{ disabled: past.length === 0 }}>
          <Icon name="corner-up-left" size={22} color={text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={redo} disabled={future.length === 0} style={stepBtn(future.length === 0)} accessibilityRole="button" accessibilityLabel="Redo" accessibilityState={{ disabled: future.length === 0 }}>
          <View style={{ transform: [{ scaleX: -1 }] }}><Icon name="corner-up-left" size={22} color={text} /></View>
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <Pressable
          onPressIn={() => setComparing(true)}
          onPressOut={() => setComparing(false)}
          accessibilityRole="button"
          accessibilityLabel="Compare with the original. Press and hold."
          style={({ pressed }) => [styles.compareBtn, { borderColor: pressed ? ACCENT : themeColors.border, backgroundColor: pressed ? ACCENT + '1A' : 'transparent', opacity: edited ? 1 : 0.5 }]}
        >
          <Icon name="eye" size={18} color={comparing ? ACCENT : text} />
          <Text style={{ color: comparing ? ACCENT : text, fontSize: 13, fontWeight: '600' }}>Hold</Text>
        </Pressable>
        <TouchableOpacity onPress={reset} disabled={!edited} style={[styles.textBtn, { opacity: edited ? 1 : 0.35 }]} accessibilityRole="button" accessibilityLabel="Reset all edits" accessibilityState={{ disabled: !edited }}>
          <Text style={{ color: ACCENT, fontWeight: '700', fontSize: 14 }}>Reset</Text>
        </TouchableOpacity>
      </View>

      {/* the photo: as big as the room allows. Hold it to see the original. */}
      <View style={styles.stage} onLayout={(e) => setStage({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        <Pressable
          style={StyleSheet.absoluteFill}
          disabled={tab === 'crop' || tab === 'text'}
          delayLongPress={260}
          onLongPress={() => setComparing(true)}
          onPressOut={() => setComparing(false)}
          accessibilityLabel="Photo. Press and hold to compare with the original."
        >
          {preview && (
            <View style={{ position: 'absolute', left, top, width: disp.w, height: disp.h }} {...(tab === 'text' ? textResponder.panHandlers : {})}>
              <Image source={{ uri: preview.uri }} style={{ width: disp.w, height: disp.h, borderRadius: 4 }} resizeMode="stretch" accessibilityLabel="Photo preview" />
              {tab === 'text' && selectedBox && selected && preview && (() => {
                const k = disp.w / preview.width;
                const w = selectedBox.w * k;
                const h = selectedBox.h * k;
                return (
                  <View
                    pointerEvents="box-none"
                    style={{ position: 'absolute', left: selectedBox.cx * k - w / 2, top: selectedBox.cy * k - h / 2, width: w, height: h, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.95)', transform: [{ rotate: `${selectedBox.rotate}deg` }] }}
                  >
                    <View pointerEvents="none" style={[styles.corner, { left: -5, top: -5 }]} />
                    <View pointerEvents="none" style={[styles.corner, { left: -5, bottom: -5 }]} />
                    <TouchableOpacity onPress={() => removeText(selected.id)} accessibilityRole="button" accessibilityLabel="Delete text" style={[styles.cornerBtn, { left: -22, top: -22 }]}>
                      <View style={[styles.textHandle, { backgroundColor: '#EF4444' }]}><Icon name="x" size={14} color="#FFFFFF" /></View>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => duplicateText(selected.id)} accessibilityRole="button" accessibilityLabel="Duplicate text" style={[styles.cornerBtn, { right: -22, top: -22 }]}>
                      <View style={styles.textHandle}><Icon name="copy" size={13} color="#000000" /></View>
                    </TouchableOpacity>
                    <View {...handleResponder.panHandlers} accessibilityLabel="Resize and turn the text" style={[styles.cornerBtn, { right: -22, bottom: -22 }]}>
                      <View style={styles.textHandle}><Icon name="rotate-cw" size={13} color="#000000" /></View>
                    </View>
                  </View>
                );
              })()}
              {tab === 'crop' && (
                <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                  {/* the darker area outside the crop */}
                  <View pointerEvents="none" style={[styles.dim, { left: 0, top: 0, width: disp.w, height: crop.y * disp.h }]} />
                  <View pointerEvents="none" style={[styles.dim, { left: 0, top: (crop.y + crop.h) * disp.h, width: disp.w, height: (1 - crop.y - crop.h) * disp.h }]} />
                  <View pointerEvents="none" style={[styles.dim, { left: 0, top: crop.y * disp.h, width: crop.x * disp.w, height: crop.h * disp.h }]} />
                  <View pointerEvents="none" style={[styles.dim, { left: (crop.x + crop.w) * disp.w, top: crop.y * disp.h, width: (1 - crop.x - crop.w) * disp.w, height: crop.h * disp.h }]} />
                  <View
                    {...cropResponders.current!.move.panHandlers}
                    style={[styles.cropBox, { left: crop.x * disp.w, top: crop.y * disp.h, width: crop.w * disp.w, height: crop.h * disp.h }]}
                    accessibilityLabel="Crop area. Drag to move."
                  >
                    <View pointerEvents="none" style={[styles.third, { left: '33.3%', top: 0, bottom: 0, width: 1 }]} />
                    <View pointerEvents="none" style={[styles.third, { left: '66.6%', top: 0, bottom: 0, width: 1 }]} />
                    <View pointerEvents="none" style={[styles.third, { top: '33.3%', left: 0, right: 0, height: 1 }]} />
                    <View pointerEvents="none" style={[styles.third, { top: '66.6%', left: 0, right: 0, height: 1 }]} />
                  </View>
                  {(['nw', 'ne', 'sw', 'se'] as const).map((h) => (
                    <View
                      key={h}
                      {...cropResponders.current![h].panHandlers}
                      accessibilityLabel={`Resize crop, ${h} corner`}
                      style={[styles.handle, {
                        left: (h.includes('w') ? crop.x : crop.x + crop.w) * disp.w - 22,
                        top: (h.includes('n') ? crop.y : crop.y + crop.h) * disp.h - 22,
                      }]}
                    >
                      <View style={styles.handleDot} />
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
          {!preview && <ActivityIndicator color={ACCENT} style={StyleSheet.absoluteFill} />}
          {comparing && (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Image source={{ uri: work }} style={{ flex: 1, backgroundColor: '#000000' }} resizeMode="contain" accessibilityLabel="Original photo" />
              <View style={styles.originalTag}><Text style={styles.originalTagText}>Original</Text></View>
            </View>
          )}
        </Pressable>
      </View>

      {/* the one tool panel: fixed height, so the photo does not jump when the tool changes */}
      <View style={[styles.panel, { height: panelH, backgroundColor: themeColors.bgCard, borderTopColor: themeColors.border }]}>
        <Animated.View style={{ flex: 1, opacity: panelAnim, transform: [{ translateY: panelAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }}>
          {tab === 'filters' && (
            <View style={{ flex: 1 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catRow} contentContainerStyle={{ gap: 6, alignItems: 'center', paddingHorizontal: 12 }} accessibilityRole="tablist" keyboardShouldPersistTaps="handled">
                <TouchableOpacity onPress={() => setCat('fav')} accessibilityRole="tab" accessibilityLabel="Favourite filters" accessibilityState={{ selected: cat === 'fav' }} style={[styles.subChip, { backgroundColor: cat === 'fav' ? ACCENT : chipBg }]}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: cat === 'fav' ? '#FFFFFF' : muted }}>★ Favourites</Text>
                </TouchableOpacity>
                {FILTER_CATEGORIES.map((c) => (
                  <TouchableOpacity key={c.id} onPress={() => setCat(c.id)} accessibilityRole="tab" accessibilityState={{ selected: cat === c.id }} style={[styles.subChip, { backgroundColor: cat === c.id ? ACCENT : chipBg }]}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: cat === c.id ? '#FFFFFF' : muted }}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <FlatList
                horizontal
                data={filterList}
                renderItem={renderFilter}
                keyExtractor={(f) => f.id}
                showsHorizontalScrollIndicator={false}
                style={{ flexGrow: 0, height: THUMB + 28 }}
                contentContainerStyle={{ paddingHorizontal: 8, alignItems: 'flex-start' }}
                getItemLayout={(_d, i) => ({ length: THUMB + 12, offset: (THUMB + 12) * i, index: i })}
                initialNumToRender={6}
                windowSize={5}
                extraData={thumbs}
                ListEmptyComponent={<Text style={{ color: muted, fontSize: 13, padding: 16 }}>Tap the star on a filter to keep it here.</Text>}
              />
              {recipe.filter !== 'normal' && (
                <View style={styles.intensityRow}>
                  <DoubleTapLabel label="Intensity" color={text} onDouble={() => { beginGesture(); onChangeRef.current({ ...recipeRef.current, intensity: 100 }); endGesture(); }} />
                  <View style={{ flex: 1 }}>
                    <EditSlider mode="inline" hideLabel label="Intensity" value={recipe.intensity} min={0} max={100} neutral={100} format={(v) => `${v}%`} onStart={beginGesture} onEnd={endGesture} onChange={(v) => onChangeRef.current({ ...recipeRef.current, intensity: v })} {...sliderColors} />
                  </View>
                </View>
              )}
            </View>
          )}

          {tab === 'adjust' && (
            <View style={{ flex: 1 }}>
              <View style={styles.panelHead}>
                <Text style={[styles.panelTitle, { color: text }]}>Adjust</Text>
                <TouchableOpacity
                  onPress={() => commit({ ...recipe, adjust: isAutoEnhanced(recipe.adjust) ? { ...recipe.adjust, brightness: 0, contrast: 0, saturation: 0 } : autoEnhance(recipe.adjust) })}
                  accessibilityRole="button"
                  accessibilityLabel="Auto enhance"
                  accessibilityState={{ selected: isAutoEnhanced(recipe.adjust) }}
                  style={[styles.autoBtn, { backgroundColor: isAutoEnhanced(recipe.adjust) ? ACCENT : chipBg }]}
                >
                  <Icon name="sparkles" size={16} color={isAutoEnhanced(recipe.adjust) ? '#FFFFFF' : text} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: isAutoEnhanced(recipe.adjust) ? '#FFFFFF' : text }}>Auto</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 12, alignItems: 'flex-end', gap: 4 }} keyboardShouldPersistTaps="handled">
                {ADJUST_TOOLS.map((a, i) => {
                  const on = adjKey === a.key;
                  const changed = adjustChanged(recipe.adjust, a.key);
                  const newGroup = i === 0 || ADJUST_TOOLS[i - 1].group !== a.group;
                  return (
                    <React.Fragment key={a.key}>
                      {newGroup && i > 0 && <View style={[styles.groupLine, { backgroundColor: themeColors.border }]} />}
                      <TouchableOpacity
                        onPress={() => setAdjKey(a.key)}
                        accessibilityRole="button"
                        accessibilityLabel={`${a.label}${changed ? ', changed' : ''}`}
                        accessibilityState={{ selected: on }}
                        style={[styles.adjChip, on && { backgroundColor: ACCENT + '22' }]}
                      >
                        <Icon name={a.icon} size={20} color={on ? ACCENT : muted} />
                        <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '600', color: on ? ACCENT : muted }}>{a.label}</Text>
                        {changed && <View style={styles.dot} />}
                      </TouchableOpacity>
                    </React.Fragment>
                  );
                })}
              </ScrollView>
              <View style={styles.adjSlider}>
                <View style={{ flex: 1 }}>
                  <EditSlider
                    mode="bubble"
                    label={adjTool.label}
                    value={shownValue(adjValue, adjTool.min, adjTool.max)}
                    min={adjTool.min < 0 ? -100 : 0}
                    max={100}
                    neutral={0}
                    format={(v) => (v > 0 && adjTool.min < 0 ? `+${v}` : String(v))}
                    onStart={beginGesture}
                    onEnd={endGesture}
                    onChange={(v) => setAdjust(adjTool.key, storedValue(v, adjTool.min, adjTool.max))}
                    {...sliderColors}
                  />
                </View>
                <TouchableOpacity onPress={() => commit({ ...recipe, adjust: { ...recipe.adjust, [adjTool.key]: 0 } })} disabled={adjValue === 0} accessibilityRole="button" accessibilityLabel={`Reset ${adjTool.label}`} style={[styles.textBtn, { opacity: adjValue === 0 ? 0.35 : 1 }]}>
                  <Text style={{ color: ACCENT, fontWeight: '700', fontSize: 13 }}>Reset</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {tab === 'crop' && (
            <View style={{ flex: 1 }}>
              {header('Crop', true)}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 12, alignItems: 'center' }} keyboardShouldPersistTaps="handled">
                {ASPECTS.map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    onPress={() => chooseAspect(a.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Shape ${a.label}`}
                    accessibilityState={{ selected: recipe.aspect === a.id }}
                    style={[styles.pill, { backgroundColor: recipe.aspect === a.id ? ACCENT : chipBg }]}
                  >
                    <Text style={{ fontSize: 14, fontWeight: '700', color: recipe.aspect === a.id ? '#FFFFFF' : muted }}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={[styles.row, { paddingHorizontal: 12, paddingTop: 6, gap: 12 }]}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => turn(-1)} accessibilityRole="button" accessibilityLabel="Turn left">
                  <View style={{ transform: [{ scaleX: -1 }] }}><Icon name="rotate-cw" size={24} color={text} /></View>
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => turn(1)} accessibilityRole="button" accessibilityLabel="Turn right">
                  <Icon name="rotate-cw" size={24} color={text} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={flip} accessibilityRole="button" accessibilityLabel="Flip">
                  <Icon name="flip-horizontal" size={24} color={text} />
                </TouchableOpacity>
                <Text style={{ color: muted, fontSize: 12, flex: 1 }}>Drag the box to move it and the corners to resize it.</Text>
              </View>
            </View>
          )}

          {tab === 'text' && (
            <View style={{ flex: 1 }}>
              {header('Text', true)}
              <View style={{ flex: 1, paddingHorizontal: 12 }}>{renderText()}</View>
            </View>
          )}
        </Animated.View>
      </View>

      {/* the tools: one row; hidden while the keyboard is open (apply or cancel in the panel closes it) */}
      {!keyboard && (
        <View style={[styles.toolbar, { backgroundColor: themeColors.bgCard, borderTopColor: themeColors.border, paddingBottom: Math.max(6, insets.bottom) }]} accessibilityRole="tablist">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbarInner}>
            {tools.map((t) => {
              const on = tab === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => selectTool(t.id)}
                  accessibilityRole="tab"
                  accessibilityLabel={`${t.label} tool`}
                  accessibilityState={{ selected: on }}
                  style={[styles.tool, on && { backgroundColor: ACCENT + '22' }]}
                >
                  <Icon name={t.icon} size={24} color={on ? ACCENT : muted} />
                  <Text style={{ fontSize: 11, fontWeight: on ? '800' : '600', color: on ? ACCENT : muted }}>{t.label}</Text>
                  <View style={[styles.underline, { backgroundColor: on ? ACCENT : 'transparent' }]} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  actions: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 48 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  textBtn: { minHeight: 44, minWidth: 44, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  compareBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, marginRight: 4 },
  stage: { flex: 1, minHeight: 120, backgroundColor: '#000000' },
  originalTag: { position: 'absolute', top: 10, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 },
  originalTagText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  dim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.55)' },
  cropBox: { position: 'absolute', borderWidth: 2, borderColor: '#FFFFFF' },
  third: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.45)' },
  handle: { position: 'absolute', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  handleDot: { width: 16, height: 16, borderRadius: 3, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(0,0,0,0.4)' },
  panel: { borderTopWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  panelHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 14, paddingRight: 6, minHeight: 44 },
  panelTitle: { fontSize: 15, fontWeight: '800' },
  catRow: { flexGrow: 0, height: 46 },
  subChip: { minHeight: 36, paddingHorizontal: 14, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: { minHeight: 40, paddingHorizontal: 18, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  thumb: { width: THUMB, height: THUMB, borderRadius: 12, overflow: 'hidden' },
  thumbImg: { width: '100%', height: '100%' },
  favBtn: { position: 'absolute', top: 0, right: 2, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  intensityRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, minHeight: 44 },
  autoBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 14, borderRadius: 18, marginRight: 8 },
  adjChip: { width: 68, minHeight: 56, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 4 },
  groupLine: { width: 1, height: 36, marginHorizontal: 4, alignSelf: 'center' },
  dot: { position: 'absolute', top: 6, right: 14, width: 7, height: 7, borderRadius: 4, backgroundColor: ACCENT },
  adjSlider: { flexDirection: 'row', alignItems: 'center', paddingLeft: 6, paddingRight: 6, paddingTop: 2 },
  toolbar: { borderTopWidth: StyleSheet.hairlineWidth },
  toolbarInner: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 8, paddingTop: 4, gap: 4 },
  tool: { width: 72, minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 2, paddingTop: 4 },
  underline: { width: 20, height: 3, borderRadius: 2, marginTop: 1 },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 15, textAlignVertical: 'top', paddingTop: 10 },
  addText: { minHeight: 48, borderRadius: 24, backgroundColor: ACCENT, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  presetBtn: { minWidth: 76, height: 62, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  fontChip: { minHeight: 44, minWidth: 76, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  boxBtn: { width: 44, height: 44, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  toggle: { minHeight: 44, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, alignSelf: 'flex-start' },
  actionBtn: { flex: 1, minHeight: 44, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  segBtn: { minHeight: 44, minWidth: 48, alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(0,0,0,0.4)' },
  cornerBtn: { position: 'absolute', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  textHandle: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(0,0,0,0.4)' },
});

export default PhotoEditor;
