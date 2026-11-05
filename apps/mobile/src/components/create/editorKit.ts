import type { Adjust, FilterId, PhotoRecipe, TextFont, TextLayer } from '@cinecraft/core';

/** Pure helpers for the photo editor (no React), so they can be tested on their own. */

// ── type styles ──────────────────────────────────────────────────────────────────────────────────────────────────

export interface EditorFont {
  id: TextFont;
  label: string;
  /** the React Native fontFamily that shows the name in its own typeface */
  family?: string;
  weight?: '400' | '500' | '600' | '700' | '800' | '900';
  italic?: boolean;
}

/** 16 type styles: the six the layer model always had, and the Lora / Work Sans / Inconsolata files bundled with the app. */
export const EDITOR_FONTS: EditorFont[] = [
  { id: 'modern', label: 'Modern', weight: '700' },
  { id: 'classic', label: 'Classic', family: 'serif', weight: '700' },
  { id: 'typewriter', label: 'Typewriter', family: 'monospace', weight: '400' },
  { id: 'bold', label: 'Strong', weight: '900' },
  { id: 'italic', label: 'Italic', family: 'serif', italic: true },
  { id: 'neon', label: 'Neon', weight: '600' },
  { id: 'lora', label: 'Lora', family: 'Lora-Regular' },
  { id: 'loraMedium', label: 'Lora Medium', family: 'Lora-Medium' },
  { id: 'loraBold', label: 'Lora Bold', family: 'Lora-Bold' },
  { id: 'worksans', label: 'Work Sans', family: 'WorkSans-Regular' },
  { id: 'workMedium', label: 'Work Medium', family: 'WorkSans-Medium' },
  { id: 'workSemi', label: 'Work Semi', family: 'WorkSans-SemiBold' },
  { id: 'workBold', label: 'Work Bold', family: 'WorkSans-Bold' },
  { id: 'workExtra', label: 'Work Heavy', family: 'WorkSans-ExtraBold' },
  { id: 'mono', label: 'Mono', family: 'Inconsolata-Regular' },
  { id: 'monoBold', label: 'Mono Bold', family: 'Inconsolata-Bold' },
];

export const fontSampleStyle = (f: EditorFont) => ({
  ...(f.family ? { fontFamily: f.family } : {}),
  ...(f.weight && !f.family?.includes('-') ? { fontWeight: f.weight } : {}),
  ...(f.italic ? { fontStyle: 'italic' as const } : {}),
});

/** 16 swatches: white, black, greys, then the colours. */
export const TEXT_PALETTE = [
  '#FFFFFF', '#0D0D0D', '#9CA3AF', '#FF4B33', '#F97316', '#FACC15', '#A3E635', '#22C55E',
  '#14B8A6', '#38BDF8', '#3B82F6', '#6366F1', '#A855F7', '#EC4899', '#FB7185', '#FDE68A',
];

/** the style fields a preset resets before it applies its own (position, size, tilt, align and the words stay) */
export const TEXT_STYLE_BASE: Partial<TextLayer> = {
  font: 'modern', bold: false, italic: false, color: '#FFFFFF', outline: false, strokeWidth: 14, strokeColor: '',
  shadow: true, shadowColor: '', shadowBlur: 18, backdrop: 'none', bg: 'rgba(0,0,0,0.6)', bgRadius: 30,
  letterSpacing: 0, lineHeight: 1.25, opacity: 100,
};

export interface TextPreset { id: string; label: string; style: Partial<TextLayer> }

export const TEXT_PRESETS: TextPreset[] = [
  { id: 'classic', label: 'Classic', style: { font: 'classic', color: '#FFFFFF' } },
  { id: 'outline', label: 'Bold outline', style: { font: 'workExtra', color: '#FFFFFF', outline: true, strokeWidth: 16, strokeColor: '#000000' } },
  { id: 'neon', label: 'Neon glow', style: { font: 'neon', color: '#FFFFFF', shadow: true, shadowColor: '#FF2D95' } },
  { id: 'highlight', label: 'Highlight', style: { font: 'workBold', color: '#0D0D0D', backdrop: 'highlight', bg: '#FACC15', shadow: false, bgRadius: 22 } },
  { id: 'shadow', label: 'Shadow', style: { font: 'workBold', color: '#FFFFFF', shadow: true, shadowColor: 'rgba(0,0,0,0.85)', shadowBlur: 34 } },
  { id: 'retro', label: 'Retro', style: { font: 'loraBold', color: '#FACC15', outline: true, strokeWidth: 12, strokeColor: '#B91C1C', shadow: true } },
  { id: 'minimal', label: 'Minimal', style: { font: 'worksans', color: '#FFFFFF', letterSpacing: 22, shadow: false } },
  { id: 'caption', label: 'Caption bar', style: { font: 'workSemi', color: '#FFFFFF', backdrop: 'box', bg: 'rgba(0,0,0,0.72)', bgRadius: 0, shadow: false } },
  { id: 'pill', label: 'Pill', style: { font: 'workBold', color: '#FFFFFF', backdrop: 'box', bg: '#FF4B33', bgRadius: 100, shadow: false } },
  { id: 'typed', label: 'Typed', style: { font: 'mono', color: '#0D0D0D', backdrop: 'box', bg: 'rgba(255,255,255,0.9)', bgRadius: 10, shadow: false } },
];

/** the layer with a preset's look (the words, place, size, tilt and alignment are kept) */
export const applyTextPreset = (layer: TextLayer, preset: TextPreset): TextLayer => ({ ...layer, ...TEXT_STYLE_BASE, ...preset.style });

// ── colour ───────────────────────────────────────────────────────────────────────────────────────────────────────

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const hex2 = (n: number) => Math.round(clamp01(n) * 255).toString(16).padStart(2, '0');

/** hue 0..360, saturation and lightness 0..1 -> "#RRGGBB" */
export const hslToHex = (h: number, s: number, l: number): string => {
  const hh = (((h % 360) + 360) % 360) / 60;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  const [r1, g1, b1] = hh < 1 ? [c, x, 0] : hh < 2 ? [x, c, 0] : hh < 3 ? [0, c, x] : hh < 4 ? [0, x, c] : hh < 5 ? [x, 0, c] : [c, 0, x];
  const m = l - c / 2;
  return `#${hex2(r1 + m)}${hex2(g1 + m)}${hex2(b1 + m)}`.toUpperCase();
};

/** "#RRGGBB" -> hue 0..360, saturation and lightness 0..1 (greys give saturation 0) */
export const hexToHsl = (hex: string): { h: number; s: number; l: number } => {
  const m = /^#?([0-9a-f]{6})/i.exec(hex || '');
  if (!m) return { h: 0, s: 1, l: 0.5 };
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255; const g = ((n >> 8) & 255) / 255; const b = (n & 255) / 255;
  const max = Math.max(r, g, b); const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (((h * 60) % 360) + 360) % 360, s, l };
};

// ── adjust ───────────────────────────────────────────────────────────────────────────────────────────────────────

export interface AdjustTool {
  key: keyof Adjust;
  label: string;
  icon: string;
  min: number;
  max: number;
  group: 'Light' | 'Colour' | 'Effects';
}

/**
 * What the colour pipeline can really do (one 4x5 colour matrix plus a vignette, drawn natively). The sliders show
 * -100..100 (or 0..100) whatever the stored range is; see `shownValue`.
 */
export const ADJUST_TOOLS: AdjustTool[] = [
  { key: 'brightness', label: 'Brightness', icon: 'sun', min: -50, max: 50, group: 'Light' },
  { key: 'contrast', label: 'Contrast', icon: 'adjust', min: -50, max: 50, group: 'Light' },
  { key: 'fade', label: 'Fade', icon: 'cloud', min: 0, max: 100, group: 'Light' },
  { key: 'saturation', label: 'Saturation', icon: 'droplet', min: -50, max: 50, group: 'Colour' },
  { key: 'warmth', label: 'Warmth', icon: 'thermometer', min: -50, max: 50, group: 'Colour' },
  { key: 'tint', label: 'Tint', icon: 'palette', min: -50, max: 50, group: 'Colour' },
  { key: 'hue', label: 'Hue', icon: 'colour', min: -180, max: 180, group: 'Colour' },
  { key: 'vignette', label: 'Vignette', icon: 'vignette', min: 0, max: 100, group: 'Effects' },
];

/** the number shown on a slider: the stored value stretched to -100..100 (or kept 0..100 when it only goes up) */
export const shownValue = (value: number, min: number, max: number): number =>
  min < 0 ? Math.round((value / max) * 100) : Math.round(value);

/** the stored value for a shown one */
export const storedValue = (shown: number, min: number, max: number): number =>
  min < 0 ? Math.round((shown / 100) * max) : Math.round(shown);

/** a mild "auto enhance": a little more contrast and colour, without a histogram. Other sliders are kept. */
export const autoEnhance = (adjust: Adjust): Adjust => ({ ...adjust, brightness: 2, contrast: 8, saturation: 10 });

export const isAutoEnhanced = (adjust: Adjust): boolean => adjust.brightness === 2 && adjust.contrast === 8 && adjust.saturation === 10;

export const adjustChanged = (adjust: Adjust, key: keyof Adjust): boolean => (adjust[key] || 0) !== 0;

// ── filters ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** thumbnails depend on the turn and crop only (not on the sliders or the filter), so this is their cache key */
export const filterThumbKey = (work: string, r: Pick<PhotoRecipe, 'rotate' | 'flipH' | 'crop'>): string =>
  `${work}|${r.rotate}|${r.flipH ? 1 : 0}|${r.crop.x.toFixed(3)},${r.crop.y.toFixed(3)},${r.crop.w.toFixed(3)},${r.crop.h.toFixed(3)}`;

/** filters first of the chosen category, then the rest: the order thumbnails are drawn in */
export const thumbOrder = (ids: FilterId[], first: FilterId[]): FilterId[] => [...first, ...ids.filter((i) => !first.includes(i))];
