/**
 * One definition of a photo edit, shared by web and mobile.
 *
 * A "recipe" is a small piece of data: how the photo is turned and cropped, which filter and sliders are on, and
 * the text on top. Web draws it on a canvas, mobile draws it with Skia, and both read the numbers below, so the
 * same recipe looks the same everywhere. The recipe only lives while someone edits (and in a local draft);
 * what is posted is the finished picture, with nothing left to replay.
 */

export type Rotation = 0 | 90 | 180 | 270;
export type AspectId = 'original' | '1:1' | '4:5' | '16:9' | 'free';

/** A rectangle in the turned photo, each side as a share (0 to 1) of the whole. */
export interface CropRect { x: number; y: number; w: number; h: number }

export interface Adjust {
  brightness: number; // -50 .. 50
  contrast: number;   // -50 .. 50
  saturation: number; // -50 .. 50
  warmth: number;     // -50 .. 50 (negative is cooler)
  fade: number;       // 0 .. 100
  vignette: number;   // 0 .. 100
  /** the sliders below were added later: a recipe saved without them reads as 0 */
  tint?: number;      // -50 .. 50 (negative is greener, positive is more magenta)
  hue?: number;       // -180 .. 180 degrees
  /** filters only: how far the picture is pushed toward a sepia tone, 0 .. 100 */
  sepia?: number;
}

/**
 * The type styles on offer. Each platform draws them with its own closest font (see the renderers).
 * The ones after 'neon' are the Lora / Work Sans / Inconsolata files bundled with the mobile app; web draws them with its default.
 */
export type TextFont =
  | 'modern' | 'classic' | 'typewriter' | 'bold' | 'italic' | 'neon'
  | 'lora' | 'loraMedium' | 'loraBold' | 'worksans' | 'workMedium' | 'workSemi' | 'workBold' | 'workExtra' | 'mono' | 'monoBold';
export type TextAlign = 'left' | 'center' | 'right';
/** none: just the letters; box: one block behind all the text; highlight: a band behind each line */
export type TextBackdrop = 'none' | 'box' | 'highlight';

export interface TextLayer {
  id: string;
  text: string;
  /** centre of the text, as a share of the picture (0 to 100) */
  x: number;
  y: number;
  /** text height as a share of the picture width, so it scales with the picture (e.g. 7 means 7%) */
  size: number;
  color: string;
  /** colour behind the text when backdrop is box or highlight ('transparent' on an older layer means no box) */
  bg: string;
  font?: TextFont;
  align?: TextAlign;
  backdrop?: TextBackdrop;
  /** turn, in degrees (-180 to 180) */
  rotate?: number;
  /** a thin outline in the opposite colour, so the text reads on any photo */
  outline?: boolean;
  shadow?: boolean;
  // ── added later (mobile editor); a layer saved without them gets the defaults in normalizeTextLayer ──
  bold?: boolean;
  italic?: boolean;
  /** extra space between letters, as a percent of the text size (-10 .. 60) */
  letterSpacing?: number;
  /** line height as a multiple of the text size (0.8 .. 2.4) */
  lineHeight?: number;
  /** 10 .. 100 */
  opacity?: number;
  /** outline thickness as a percent of the text size (2 .. 40) */
  strokeWidth?: number;
  /** outline colour; '' picks black or white to suit the text */
  strokeColor?: string;
  /** shadow or glow colour; '' means the usual soft black shadow (a glow in the text's own colour for the Neon type) */
  shadowColor?: string;
  /** shadow blur as a percent of the text size (0 .. 100) */
  shadowBlur?: number;
  /** corner radius of the box or band, as a percent of the text size (0 .. 100) */
  bgRadius?: number;
}

export const TEXT_FONTS: { id: TextFont; label: string }[] = [
  { id: 'modern', label: 'Modern' },
  { id: 'classic', label: 'Classic' },
  { id: 'typewriter', label: 'Typewriter' },
  { id: 'bold', label: 'Strong' },
  { id: 'italic', label: 'Italic' },
  { id: 'neon', label: 'Neon' },
];

/** A text layer with every setting filled in (layers saved by an earlier version only have some of them). */
export interface FullTextLayer extends Required<Omit<TextLayer, 'bg'>> { bg: string }

export const normalizeTextLayer = (t: TextLayer): FullTextLayer => {
  const backdrop = t.backdrop ?? (t.bg && t.bg !== 'transparent' ? 'box' : 'none');
  return {
    ...t,
    font: t.font ?? 'modern',
    align: t.align ?? 'center',
    backdrop,
    rotate: t.rotate ?? 0,
    outline: t.outline ?? false,
    shadow: t.shadow ?? (t.bg === 'transparent' || !t.bg),
    bg: t.bg && t.bg !== 'transparent' ? t.bg : 'rgba(0,0,0,0.6)',
    bold: t.bold ?? false,
    italic: t.italic ?? false,
    letterSpacing: t.letterSpacing ?? 0,
    lineHeight: t.lineHeight ?? 1.25,
    opacity: t.opacity ?? 100,
    strokeWidth: t.strokeWidth ?? 14,
    strokeColor: t.strokeColor ?? '',
    shadowColor: t.shadowColor ?? '',
    shadowBlur: t.shadowBlur ?? 18,
    // the corners the renderers always used: 30% of the text size for the box, 22% for the band
    bgRadius: t.bgRadius ?? (backdrop === 'highlight' ? 22 : 30),
  };
};

const luminance = (hex: string): number => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255; const g = (n >> 8) & 255; const b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

/** A backdrop colour that keeps the text readable: dark behind light text, light behind dark text. */
export const backdropFor = (textColor: string): string => (luminance(textColor) > 0.55 ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.85)');

/** The outline colour that stands out against the text colour. */
export const outlineFor = (textColor: string): string => (luminance(textColor) > 0.55 ? '#000000' : '#FFFFFF');

export interface PhotoRecipe {
  v: 1;
  rotate: Rotation;
  flipH: boolean;
  aspect: AspectId;
  crop: CropRect;
  filter: FilterId;
  /** how much of the filter is applied, 0 to 100 */
  intensity: number;
  adjust: Adjust;
  text: TextLayer[];
}

// ── filters ─────────────────────────────────────────────────────────────────────────────────────────────────────

export type FilterCategory = 'basic' | 'portrait' | 'film' | 'vintage' | 'bw' | 'warm' | 'cool' | 'dramatic' | 'fade' | 'pop';

export interface FilterPreset extends Partial<Adjust> { id: FilterId; label: string; category: FilterCategory }

export type FilterId =
  | 'normal' | 'clarendon' | 'gingham' | 'moon' | 'lark' | 'reyes' | 'juno' | 'slumber' | 'crema' | 'cinegold' | 'cyberteal'
  | 'crisp' | 'softskin' | 'glow' | 'kodak' | 'portra' | 'fuji' | 'sepia' | 'noir' | 'silver' | 'sunset'
  | 'arctic' | 'ocean' | 'drama' | 'moody' | 'matte' | 'dusty' | 'vivid' | 'pop';

export const FILTER_CATEGORIES: { id: FilterCategory; label: string }[] = [
  { id: 'basic', label: 'Basic' },
  { id: 'portrait', label: 'Portrait' },
  { id: 'film', label: 'Film' },
  { id: 'vintage', label: 'Vintage' },
  { id: 'bw', label: 'B&W' },
  { id: 'warm', label: 'Warm' },
  { id: 'cool', label: 'Cool' },
  { id: 'dramatic', label: 'Dramatic' },
  { id: 'fade', label: 'Fade' },
  { id: 'pop', label: 'Pop' },
];

/** Every filter is a set of the colour sliders (brightness, contrast, saturation, warmth, tint, hue, sepia, fade, vignette). */
export const FILTERS: FilterPreset[] = [
  { id: 'normal', label: 'Normal', category: 'basic' },
  { id: 'clarendon', label: 'Clarendon', category: 'basic', brightness: 6, contrast: 20, saturation: 25, warmth: -5 },
  { id: 'lark', label: 'Lark', category: 'basic', brightness: 8, contrast: 8, saturation: 15, warmth: -3 },
  { id: 'crisp', label: 'Crisp', category: 'basic', brightness: 2, contrast: 18, saturation: 8 },
  { id: 'crema', label: 'Crema', category: 'portrait', brightness: 5, contrast: -5, saturation: 5, warmth: 12, fade: 10 },
  { id: 'softskin', label: 'Soft Skin', category: 'portrait', brightness: 6, contrast: -8, saturation: -4, warmth: 6, fade: 8 },
  { id: 'glow', label: 'Glow', category: 'portrait', brightness: 10, contrast: -6, saturation: 6, warmth: 8, tint: 3, fade: 14 },
  { id: 'kodak', label: 'Kodak', category: 'film', contrast: 14, saturation: 14, warmth: 14, fade: 10 },
  { id: 'portra', label: 'Portra', category: 'film', brightness: 4, contrast: -4, saturation: -4, warmth: 8, fade: 14 },
  { id: 'fuji', label: 'Fuji', category: 'film', contrast: 10, saturation: 12, warmth: -6, tint: -8, fade: 8 },
  { id: 'gingham', label: 'Gingham', category: 'vintage', brightness: 4, contrast: -10, saturation: -10, warmth: 10, fade: 25 },
  { id: 'reyes', label: 'Reyes', category: 'vintage', brightness: 8, contrast: -10, saturation: -12, warmth: 12, fade: 30 },
  { id: 'slumber', label: 'Slumber', category: 'vintage', brightness: -3, contrast: -12, saturation: -18, warmth: 8, fade: 30 },
  { id: 'sepia', label: 'Sepia', category: 'vintage', contrast: 6, sepia: 75, fade: 10, vignette: 20 },
  { id: 'moon', label: 'Moon', category: 'bw', brightness: -5, contrast: 20, saturation: -100 },
  { id: 'noir', label: 'Noir', category: 'bw', brightness: -6, contrast: 35, saturation: -100, vignette: 25 },
  { id: 'silver', label: 'Silver', category: 'bw', brightness: 6, contrast: 10, saturation: -100, fade: 12 },
  { id: 'juno', label: 'Juno', category: 'warm', brightness: 3, contrast: 14, saturation: 25, warmth: 10 },
  { id: 'cinegold', label: 'CineGold', category: 'warm', contrast: 12, saturation: 5, warmth: 28, fade: 12, vignette: 25 },
  { id: 'sunset', label: 'Sunset', category: 'warm', brightness: 3, contrast: 8, saturation: 15, warmth: 30, tint: 5 },
  { id: 'cyberteal', label: 'CyberTeal', category: 'cool', contrast: 14, saturation: 18, warmth: -28, vignette: 20 },
  { id: 'arctic', label: 'Arctic', category: 'cool', brightness: 6, contrast: 6, saturation: -6, warmth: -30 },
  { id: 'ocean', label: 'Ocean', category: 'cool', contrast: 8, saturation: 12, warmth: -22, tint: -4, hue: -10 },
  { id: 'drama', label: 'Drama', category: 'dramatic', brightness: -4, contrast: 38, saturation: -8, vignette: 35 },
  { id: 'moody', label: 'Moody', category: 'dramatic', brightness: -10, contrast: 22, saturation: -18, warmth: -6, fade: 10, vignette: 40 },
  { id: 'matte', label: 'Matte', category: 'fade', brightness: 4, contrast: -14, fade: 40 },
  { id: 'dusty', label: 'Dusty', category: 'fade', contrast: -8, saturation: -14, warmth: 8, fade: 45 },
  { id: 'vivid', label: 'Vivid', category: 'pop', contrast: 14, saturation: 45 },
  { id: 'pop', label: 'Pop', category: 'pop', brightness: 4, contrast: 20, saturation: 60 },
];

export const ASPECTS: { id: AspectId; label: string; ratio: number | null }[] = [
  { id: 'original', label: 'Original', ratio: null },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:5', label: '4:5', ratio: 4 / 5 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
  { id: 'free', label: 'Free', ratio: null },
];

export const NO_ADJUST: Adjust = { brightness: 0, contrast: 0, saturation: 0, warmth: 0, fade: 0, vignette: 0 };
export const FULL_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 };

export const defaultRecipe = (): PhotoRecipe => ({
  v: 1,
  rotate: 0,
  flipH: false,
  aspect: 'original',
  crop: { ...FULL_CROP },
  filter: 'normal',
  intensity: 100,
  adjust: { ...NO_ADJUST },
  text: [],
});

const nearly = (a: number, b: number) => Math.abs(a - b) < 0.0005;

/** True when the recipe changes the photo at all (resizing for upload is not an edit). */
export const isEdited = (r: PhotoRecipe): boolean =>
  r.rotate !== 0 ||
  r.flipH ||
  !(nearly(r.crop.x, 0) && nearly(r.crop.y, 0) && nearly(r.crop.w, 1) && nearly(r.crop.h, 1)) ||
  r.filter !== 'normal' ||
  (Object.keys(NO_ADJUST) as (keyof Adjust)[]).some((k) => r.adjust[k] !== 0) ||
  !!r.adjust.tint || !!r.adjust.hue ||
  r.text.length > 0;

// ── geometry ────────────────────────────────────────────────────────────────────────────────────────────────────

/** Size of the photo after it is turned. */
export const rotatedSize = (w: number, h: number, rotate: Rotation) => (rotate === 90 || rotate === 270 ? { w: h, h: w } : { w, h });

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Keeps a crop inside the photo and not smaller than a few percent. */
export const clampCrop = (c: CropRect, min = 0.05): CropRect => {
  const w = clamp(c.w, min, 1);
  const h = clamp(c.h, min, 1);
  return { x: clamp(c.x, 0, 1 - w), y: clamp(c.y, 0, 1 - h), w, h };
};

/**
 * The biggest crop of the wanted shape that fits the (turned) photo, centred on `around` when given.
 * `ratio` is width / height in pixels. A null ratio keeps the whole photo.
 */
export const cropForRatio = (photoW: number, photoH: number, ratio: number | null, around?: CropRect): CropRect => {
  if (!ratio) return { ...FULL_CROP };
  const photoRatio = photoW / photoH;
  let w: number;
  let h: number;
  if (ratio >= photoRatio) { w = 1; h = photoRatio / ratio; } else { h = 1; w = ratio / photoRatio; }
  const cx = around ? around.x + around.w / 2 : 0.5;
  const cy = around ? around.y + around.h / 2 : 0.5;
  return clampCrop({ x: cx - w / 2, y: cy - h / 2, w, h });
};

/** The pixel rectangle of the crop in the turned photo. */
export const cropPixels = (crop: CropRect, turnedW: number, turnedH: number) => ({
  x: Math.round(crop.x * turnedW),
  y: Math.round(crop.y * turnedH),
  w: Math.max(1, Math.round(crop.w * turnedW)),
  h: Math.max(1, Math.round(crop.h * turnedH)),
});

/** Output size for a crop of cw x ch pixels, never bigger than the crop and never longer than maxEdge. */
export const exportSize = (cw: number, ch: number, maxEdge: number) => {
  const scale = Math.min(1, maxEdge / Math.max(cw, ch));
  return { w: Math.max(1, Math.round(cw * scale)), h: Math.max(1, Math.round(ch * scale)), scale };
};

// ── colour ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** Filter and sliders added together: what the picture actually gets. The filter is scaled by its strength. */
export const effectiveAdjust = (r: PhotoRecipe): Adjust => {
  const preset = FILTERS.find((f) => f.id === r.filter) || FILTERS[0];
  const k = clamp(r.intensity, 0, 100) / 100;
  const add = (key: keyof Adjust) => (preset[key] || 0) * k + (r.adjust[key] || 0);
  return {
    tint: add('tint'),
    hue: add('hue'),
    sepia: clamp(add('sepia'), 0, 100),
    brightness: add('brightness'),
    contrast: add('contrast'),
    saturation: add('saturation'),
    warmth: add('warmth'),
    fade: clamp(add('fade'), 0, 100),
    vignette: clamp(add('vignette'), 0, 100),
  };
};

/** A colour change as 3x3 numbers plus an offset (all in 0..1 colour). Alpha is never touched. */
interface Affine { m: number[]; o: number[] }

const IDENTITY: Affine = { m: [1, 0, 0, 0, 1, 0, 0, 0, 1], o: [0, 0, 0] };

/** `b` applied after `a`. */
const then = (a: Affine, b: Affine): Affine => {
  const m = new Array(9).fill(0);
  const o = [0, 0, 0];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      for (let k = 0; k < 3; k++) m[r * 3 + c] += b.m[r * 3 + k] * a.m[k * 3 + c];
    }
    o[r] = b.o[r] + b.m[r * 3] * a.o[0] + b.m[r * 3 + 1] * a.o[1] + b.m[r * 3 + 2] * a.o[2];
  }
  return { m, o };
};

const scaleRgb = (s: number): Affine => ({ m: [s, 0, 0, 0, s, 0, 0, 0, s], o: [0, 0, 0] });

const contrastAround = (k: number): Affine => ({ m: [k, 0, 0, 0, k, 0, 0, 0, k], o: [0.5 * (1 - k), 0.5 * (1 - k), 0.5 * (1 - k)] });

const LR = 0.2126;
const LG = 0.7152;
const LB = 0.0722;
const saturation = (s: number): Affine => ({
  m: [
    LR * (1 - s) + s, LG * (1 - s), LB * (1 - s),
    LR * (1 - s), LG * (1 - s) + s, LB * (1 - s),
    LR * (1 - s), LG * (1 - s), LB * (1 - s) + s,
  ],
  o: [0, 0, 0],
});

const warmthMatrix = (w: number): Affine => ({ m: [1 + w / 200, 0, 0, 0, 1, 0, 0, 0, 1 - w / 200], o: [0, 0, 0] });

/** Tint moves the picture toward green (negative) or magenta (positive). */
const tintMatrix = (t: number): Affine => ({ m: [1 + t / 250, 0, 0, 0, 1 - t / 250, 0, 0, 0, 1 + t / 250], o: [0, 0, 0] });

/** Turns every colour around the colour wheel by `deg` degrees, keeping brightness. */
const hueMatrix = (deg: number): Affine => {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return {
    m: [
      0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928,
      0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.14, 0.072 - c * 0.072 - s * 0.283,
      0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072,
    ],
    o: [0, 0, 0],
  };
};

/** A blend (k from 0 to 1) between the picture as it is and a warm brown sepia tone. */
const sepiaMatrix = (k: number): Affine => {
  const sep = [0.393, 0.769, 0.189, 0.349, 0.686, 0.168, 0.272, 0.534, 0.131];
  const id = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  return { m: id.map((v, i) => v + (sep[i] - v) * k), o: [0, 0, 0] };
};

/** Fade lifts the blacks a little and flattens the picture. */
const fadeMatrix = (f: number): Affine => ({ m: [1 - f / 400, 0, 0, 0, 1 - f / 400, 0, 0, 0, 1 - f / 400], o: [f / 800, f / 800, f / 800] });

/**
 * The colour change as 20 numbers (a 4x5 matrix, row by row: R, G, B, A, each with an offset), in the order
 * Skia and SVG expect. Brightness, contrast, saturation, warmth and fade, one after the other.
 */
export const colorMatrix = (r: PhotoRecipe): number[] => {
  const a = effectiveAdjust(r);
  let t = IDENTITY;
  t = then(t, scaleRgb(1 + a.brightness / 100));
  t = then(t, contrastAround(1 + a.contrast / 100));
  t = then(t, saturation(Math.max(0, 1 + a.saturation / 100)));
  t = then(t, warmthMatrix(a.warmth));
  if (a.tint) t = then(t, tintMatrix(a.tint));
  if (a.hue) t = then(t, hueMatrix(a.hue));
  if (a.sepia) t = then(t, sepiaMatrix((a.sepia as number) / 100));
  t = then(t, fadeMatrix(a.fade));
  const { m, o } = t;
  return [
    m[0], m[1], m[2], 0, o[0],
    m[3], m[4], m[5], 0, o[1],
    m[6], m[7], m[8], 0, o[2],
    0, 0, 0, 1, 0,
  ];
};

export const isIdentityMatrix = (mx: number[]): boolean => {
  const id = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
  return mx.every((v, i) => Math.abs(v - id[i]) < 0.0005);
};

/** Applies the matrix to canvas pixels (RGBA bytes) in place. */
export const applyColorMatrix = (data: Uint8ClampedArray, mx: number[]): void => {
  const [a, b, c, , d, e, f, g, , h, i, j, k, , l] = mx;
  for (let p = 0; p < data.length; p += 4) {
    const r = data[p] / 255;
    const g1 = data[p + 1] / 255;
    const b1 = data[p + 2] / 255;
    data[p] = (a * r + b * g1 + c * b1 + d) * 255;
    data[p + 1] = (e * r + f * g1 + g * b1 + h) * 255;
    data[p + 2] = (i * r + j * g1 + k * b1 + l) * 255;
  }
};

/** How dark the corners get and where the darkening starts, as shares of the distance to the corner. */
export const vignetteLook = (strength: number) => ({ start: 0.5, alpha: clamp(strength, 0, 100) / 100 * 0.75 });

/** The vignette that goes with a recipe (filter and slider added together). */
export const vignetteStrength = (r: PhotoRecipe): number => effectiveAdjust(r).vignette;

// ── text ────────────────────────────────────────────────────────────────────────────────────────────────────────

export const TEXT_COLORS = ['#FFFFFF', '#0D0D0D', '#FF4B33', '#FACC15', '#F97316', '#22C55E', '#14B8A6', '#38BDF8', '#6366F1', '#EC4899'];

export const newTextLayer = (text: string): TextLayer => ({
  id: `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
  text,
  x: 50,
  y: 50,
  size: 8,
  color: '#FFFFFF',
  bg: 'rgba(0,0,0,0.6)',
  font: 'modern',
  align: 'center',
  backdrop: 'none',
  rotate: 0,
  outline: false,
  shadow: true,
});
