import {
  applyColorMatrix, colorMatrix, cropPixels, exportSize, isIdentityMatrix, normalizeTextLayer, outlineFor, rotatedSize, vignetteLook, vignetteStrength,
  type CropRect, type FullTextLayer, type PhotoRecipe, type TextFont,
} from '@cinecraft/core';

/**
 * Draws a photo edit (see packages/core/src/photoEdit.ts). The live preview and the finished picture both come
 * from this one function, so what you see while editing is exactly what is posted.
 */

/** Where a text layer is on the picture: its box before turning (x, y, w, h), its centre, and its turn in degrees. */
export interface TextBox { id: string; x: number; y: number; w: number; h: number; cx: number; cy: number; rotate: number }

export interface Rendered { width: number; height: number; boxes: TextBox[] }

export const loadBitmap = async (source: Blob): Promise<ImageBitmap> => createImageBitmap(source, { imageOrientation: 'from-image' } as ImageBitmapOptions);

/** A small copy for filter thumbnails and fast previews of big photos. */
export const downscale = async (bitmap: ImageBitmap, maxEdge: number): Promise<ImageBitmap> => {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  if (scale >= 1) return bitmap;
  return createImageBitmap(bitmap, { resizeWidth: Math.round(bitmap.width * scale), resizeHeight: Math.round(bitmap.height * scale), resizeQuality: 'high' });
};

const wrapLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
  const lines: string[] = [];
  text.split('\n').forEach((para) => {
    const words = para.split(' ');
    let line = '';
    words.forEach((w) => {
      const test = line ? `${line} ${w}` : w;
      if (line && ctx.measureText(test).width > maxWidth) { lines.push(line); line = w; } else line = test;
    });
    lines.push(line);
  });
  return lines;
};

const fontFor = (font: TextFont, px: number): string => {
  switch (font) {
    case 'classic': return `600 ${px}px Lora, Georgia, serif`;
    case 'typewriter': return `500 ${px}px Inconsolata, "Courier New", monospace`;
    case 'bold': return `900 ${px}px "Work Sans", Impact, sans-serif`;
    case 'italic': return `italic 500 ${px}px Lora, Georgia, serif`;
    case 'neon': return `600 ${px}px "Work Sans", system-ui, sans-serif`;
    default: return `700 ${px}px "Work Sans", system-ui, -apple-system, "Segoe UI", sans-serif`;
  }
};

/** Draws one text layer (turned around its centre) and returns where it is. */
const drawTextLayer = (ctx: CanvasRenderingContext2D, outW: number, outH: number, t: FullTextLayer): TextBox | null => {
  const body = t.font === 'bold' ? t.text.toUpperCase() : t.text;
  if (!body.trim()) return null;
  const fontPx = Math.max(10, (outW * t.size) / 100);
  ctx.font = fontFor(t.font, fontPx);
  ctx.textBaseline = 'middle';
  const lines = wrapLines(ctx, body, outW * 0.85);
  const lineH = fontPx * 1.25;
  const textW = Math.max(...lines.map((l) => ctx.measureText(l).width));
  const padX = fontPx * 0.5;
  const padY = fontPx * 0.3;
  const boxW = textW + padX * 2;
  const boxH = (lines.length - 1) * lineH + fontPx * 1.2 + padY * 2;
  const cx = (t.x / 100) * outW;
  const cy = (t.y / 100) * outH;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((t.rotate * Math.PI) / 180);

  // where each line starts, inside the block that is centred on (0, 0)
  const lineX = (w: number) => (t.align === 'left' ? -textW / 2 : t.align === 'right' ? textW / 2 - w : -w / 2);
  const lineY = (i: number) => -((lines.length - 1) * lineH) / 2 + i * lineH;
  const rounded = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
    ctx.fill();
  };

  if (t.backdrop === 'box') {
    ctx.fillStyle = t.bg;
    rounded(-boxW / 2, -boxH / 2, boxW, boxH, fontPx * 0.3);
  } else if (t.backdrop === 'highlight') {
    ctx.fillStyle = t.bg;
    lines.forEach((l, i) => {
      const w = ctx.measureText(l).width;
      rounded(lineX(w) - padX, lineY(i) - lineH / 2 + fontPx * 0.04, w + padX * 2, lineH, fontPx * 0.22);
    });
  }

  ctx.textAlign = 'left';
  lines.forEach((l, i) => {
    const w = ctx.measureText(l).width;
    const x = lineX(w);
    const y = lineY(i);
    if (t.font === 'neon') {
      // a glow of the text's own colour, then the letters on top
      ctx.shadowColor = t.color;
      ctx.shadowBlur = fontPx * 0.6;
      ctx.fillStyle = t.color;
      ctx.fillText(l, x, y);
      ctx.shadowBlur = fontPx * 0.25;
      ctx.fillText(l, x, y);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      return;
    }
    if (t.shadow) { ctx.shadowColor = 'rgba(0,0,0,0.65)'; ctx.shadowBlur = fontPx * 0.18; ctx.shadowOffsetY = fontPx * 0.04; }
    if (t.outline) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = fontPx * 0.14;
      ctx.strokeStyle = outlineFor(t.color);
      ctx.strokeText(l, x, y);
    }
    ctx.fillStyle = t.color;
    ctx.fillText(l, x, y);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  });
  ctx.restore();
  return { id: t.id, x: cx - boxW / 2, y: cy - boxH / 2, w: boxW, h: boxH, cx, cy, rotate: t.rotate };
};

/**
 * Draws `recipe` onto `canvas`, sized so its longest side is at most `maxEdge` (and never bigger than the crop).
 * Pass `whole: true` to draw the whole turned photo without the crop (used while the crop box is being moved).
 */
export const renderPhoto = (
  canvas: HTMLCanvasElement,
  bitmap: ImageBitmap,
  recipe: PhotoRecipe,
  opts: { maxEdge: number; whole?: boolean; withText?: boolean },
): Rendered => {
  const turned = rotatedSize(bitmap.width, bitmap.height, recipe.rotate);
  const crop: CropRect = opts.whole ? { x: 0, y: 0, w: 1, h: 1 } : recipe.crop;
  const px = cropPixels(crop, turned.w, turned.h);
  const out = exportSize(px.w, px.h, opts.maxEdge);

  canvas.width = out.w;
  canvas.height = out.h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { width: out.w, height: out.h, boxes: [] };
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, out.w, out.h);

  // turn, flip and crop in one transform: the crop's corner lands on the canvas corner
  ctx.save();
  ctx.setTransform(out.scale, 0, 0, out.scale, -px.x * out.scale, -px.y * out.scale);
  ctx.translate(turned.w / 2, turned.h / 2);
  if (recipe.flipH) ctx.scale(-1, 1);
  ctx.rotate((recipe.rotate * Math.PI) / 180);
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  ctx.restore();

  // colour
  const mx = colorMatrix(recipe);
  if (!isIdentityMatrix(mx)) {
    const img = ctx.getImageData(0, 0, out.w, out.h);
    applyColorMatrix(img.data, mx);
    ctx.putImageData(img, 0, 0);
  }

  // vignette
  const vig = vignetteStrength(recipe);
  if (vig > 0) {
    const look = vignetteLook(vig);
    const r = Math.hypot(out.w, out.h) / 2;
    const g = ctx.createRadialGradient(out.w / 2, out.h / 2, r * look.start, out.w / 2, out.h / 2, r);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${look.alpha})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, out.w, out.h);
  }

  // text, last, so the colour change never touches it
  const boxes: TextBox[] = [];
  if (opts.withText !== false) {
    recipe.text.forEach((layer) => {
      const box = drawTextLayer(ctx, out.w, out.h, normalizeTextLayer(layer));
      if (box) boxes.push(box);
    });
  }
  return { width: out.w, height: out.h, boxes };
};

/** The finished picture as a file to upload: WebP where the browser can write it, JPEG otherwise. */
export const exportPhoto = async (
  bitmap: ImageBitmap,
  recipe: PhotoRecipe,
  opts: { maxEdge?: number; quality?: number } = {},
): Promise<{ blob: Blob; width: number; height: number }> => {
  // make sure the text font is ready before drawing it
  try { await (document as any).fonts?.load?.('700 24px "Work Sans"'); } catch { /* the fallback font is used */ }
  const canvas = document.createElement('canvas');
  const r = renderPhoto(canvas, bitmap, recipe, { maxEdge: opts.maxEdge ?? 1440 });
  const quality = opts.quality ?? 0.85;
  const toBlob = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
  let blob = await toBlob('image/webp');
  if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg'); // Safari cannot write WebP
  if (!blob) throw new Error('Could not make the picture');
  return { blob, width: r.width, height: r.height };
};
