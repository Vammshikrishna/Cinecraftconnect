import { useEffect, useMemo, useRef, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, ChevronsUp, Copy, Crop, FlipHorizontal2, Loader2, Redo2, RotateCcw, RotateCw, SlidersHorizontal, Sparkles, Trash2, Type, Undo2, X } from 'lucide-react';
import {
  ASPECTS, FILTERS, NO_ADJUST, TEXT_COLORS, TEXT_FONTS, backdropFor, clampCrop, cropForRatio, defaultRecipe, isEdited, newTextLayer, normalizeTextLayer, rotatedSize,
  type Adjust, type CropRect, type PhotoRecipe, type TextFont, type TextLayer,
} from '@cinecraft/core';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { downscale, loadBitmap, renderPhoto, type TextBox } from '@/lib/photoRender';

interface Props {
  /** the photo as picked, at full size */
  source: Blob;
  recipe: PhotoRecipe;
  onChange: (next: PhotoRecipe) => void;
  /** called if the browser cannot open this photo */
  onUnreadable?: () => void;
}

type Tab = 'crop' | 'filters' | 'adjust' | 'text';
type Handle = 'move' | 'nw' | 'ne' | 'sw' | 'se';

const SLIDERS: { key: keyof Adjust; label: string; min: number; max: number }[] = [
  { key: 'brightness', label: 'Brightness', min: -50, max: 50 },
  { key: 'contrast', label: 'Contrast', min: -50, max: 50 },
  { key: 'saturation', label: 'Saturation', min: -50, max: 50 },
  { key: 'warmth', label: 'Warmth', min: -50, max: 50 },
  { key: 'fade', label: 'Fade', min: 0, max: 100 },
  { key: 'vignette', label: 'Vignette', min: 0, max: 100 },
];

const WORK_EDGE = 1600;

/** how each type style looks in its button */
const fontSample = (font: TextFont): React.CSSProperties => {
  switch (font) {
    case 'classic': return { fontFamily: 'Lora, Georgia, serif', fontWeight: 600 };
    case 'typewriter': return { fontFamily: 'Inconsolata, "Courier New", monospace', fontWeight: 500 };
    case 'bold': return { fontFamily: '"Work Sans", Impact, sans-serif', fontWeight: 900 };
    case 'italic': return { fontFamily: 'Lora, Georgia, serif', fontStyle: 'italic', fontWeight: 500 };
    case 'neon': return { fontFamily: '"Work Sans", sans-serif', fontWeight: 600, color: 'hsl(var(--primary))', textShadow: '0 0 8px hsl(var(--primary))' };
    default: return { fontFamily: '"Work Sans", sans-serif', fontWeight: 700 };
  }
}; // the preview works from a smaller copy of big photos, so sliders stay quick

/** A tiny preview of one filter on this photo. */
const FilterThumb = ({ bitmap, recipe, filterId, label, active, onPick }: { bitmap: ImageBitmap; recipe: PhotoRecipe; filterId: PhotoRecipe['filter']; label: string; active: boolean; onPick: () => void }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    renderPhoto(ref.current, bitmap, { ...recipe, filter: filterId, intensity: 100, adjust: { ...NO_ADJUST }, text: [] }, { maxEdge: 96, withText: false });
  }, [bitmap, recipe.rotate, recipe.flipH, recipe.crop, filterId]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <button type="button" onClick={onPick} aria-pressed={active} className="shrink-0 flex flex-col items-center gap-1.5 focus-visible:outline-none group">
      <canvas
        ref={ref}
        className={cn('h-[72px] w-[72px] rounded-lg object-cover bg-muted transition', active ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'group-hover:opacity-90')}
        style={{ objectFit: 'cover' }}
      />
      <span className={cn('text-xs font-medium', active ? 'text-primary' : 'text-muted-foreground')}>{label}</span>
    </button>
  );
};

export const PhotoEditor = ({ source, recipe, onChange, onUnreadable }: Props) => {
  const [work, setWork] = useState<ImageBitmap | null>(null);
  const [thumb, setThumb] = useState<ImageBitmap | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<Tab>('crop');
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [draftText, setDraftText] = useState('');
  const [past, setPast] = useState<PhotoRecipe[]>([]);
  const [future, setFuture] = useState<PhotoRecipe[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const boxesRef = useRef<TextBox[]>([]);
  const [boxes, setBoxes] = useState<TextBox[]>([]);
  const [dims, setDims] = useState({ w: 1, h: 1 });
  const recipeRef = useRef(recipe);
  recipeRef.current = recipe;
  const gestureStart = useRef<PhotoRecipe | null>(null);

  // open the photo (and a small copy for filter previews)
  useEffect(() => {
    let alive = true;
    setWork(null);
    setThumb(null);
    setFailed(false);
    loadBitmap(source)
      .then(async (bmp) => {
        const w = await downscale(bmp, WORK_EDGE);
        const t = await downscale(bmp, 160);
        if (!alive) return;
        setWork(w);
        setThumb(t);
      })
      .catch(() => { if (alive) { setFailed(true); onUnreadable?.(); } });
    return () => { alive = false; };
  }, [source]); // eslint-disable-line react-hooks/exhaustive-deps

  const turned = useMemo(() => (work ? rotatedSize(work.width, work.height, recipe.rotate) : { w: 1, h: 1 }), [work, recipe.rotate]);

  // draw: the whole photo while the crop is being set, the cropped result in the other tabs
  useEffect(() => {
    if (!work || !canvasRef.current) return;
    let frame = requestAnimationFrame(() => {
      if (!canvasRef.current) return;
      const r = renderPhoto(canvasRef.current, work, recipe, { maxEdge: 1000, whole: tab === 'crop', withText: tab !== 'crop' });
      boxesRef.current = r.boxes;
      setBoxes(r.boxes);
      setDims({ w: r.width, h: r.height });
    });
    return () => cancelAnimationFrame(frame);
  }, [work, recipe, tab]);

  // ── history ──────────────────────────────────────────────────────────────────────────────────────────────────
  /** call when a drag or slider move starts, so the whole move is one undo step */
  const beginGesture = () => { gestureStart.current = recipeRef.current; };
  const endGesture = () => {
    const start = gestureStart.current;
    gestureStart.current = null;
    if (start && JSON.stringify(start) !== JSON.stringify(recipeRef.current)) { setPast((p) => [...p.slice(-39), start]); setFuture([]); }
  };
  /** a single change (a button) is its own undo step */
  const commit = (next: PhotoRecipe) => {
    setPast((p) => [...p.slice(-39), recipeRef.current]);
    setFuture([]);
    onChange(next);
  };
  const undo = () => { const prev = past[past.length - 1]; if (!prev) return; setPast((p) => p.slice(0, -1)); setFuture((f) => [recipeRef.current, ...f]); onChange(prev); };
  const redo = () => { const next = future[0]; if (!next) return; setFuture((f) => f.slice(1)); setPast((p) => [...p, recipeRef.current]); onChange(next); };
  const reset = () => { if (isEdited(recipeRef.current)) commit(defaultRecipe()); setSelectedText(null); };

  // ── crop ─────────────────────────────────────────────────────────────────────────────────────────────────────
  const ratioOf = (aspect: PhotoRecipe['aspect']) => ASPECTS.find((a) => a.id === aspect)?.ratio ?? null;

  const chooseAspect = (id: PhotoRecipe['aspect']) => {
    const ratio = ratioOf(id);
    const crop = id === 'original' ? { x: 0, y: 0, w: 1, h: 1 } : id === 'free' ? recipe.crop : cropForRatio(turned.w, turned.h, ratio, recipe.crop);
    commit({ ...recipe, aspect: id, crop });
  };
  const turn = (dir: 1 | -1) => {
    const rotate = (((recipe.rotate + dir * 90) % 360) + 360) % 360 as PhotoRecipe['rotate'];
    const next = rotatedSize(work!.width, work!.height, rotate);
    const ratio = ratioOf(recipe.aspect);
    commit({ ...recipe, rotate, crop: ratio ? cropForRatio(next.w, next.h, ratio) : { x: 0, y: 0, w: 1, h: 1 } });
  };
  const flip = () => commit({ ...recipe, flipH: !recipe.flipH, crop: { ...recipe.crop, x: 1 - recipe.crop.x - recipe.crop.w } });

  const dragCrop = (e: React.PointerEvent, mode: Handle) => {
    if (!overlayRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = overlayRef.current.getBoundingClientRect();
    const s = recipeRef.current.crop;
    const ratio = ratioOf(recipeRef.current.aspect);
    // a locked shape in shares of the photo: width share / height share
    const ratioN = ratio ? (ratio * turned.h) / turned.w : null;
    const sx = e.clientX;
    const sy = e.clientY;
    beginGesture();

    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - sx) / rect.width;
      const dy = (ev.clientY - sy) / rect.height;
      let next: CropRect;
      if (mode === 'move') {
        next = { ...s, x: Math.min(1 - s.w, Math.max(0, s.x + dx)), y: Math.min(1 - s.h, Math.max(0, s.y + dy)) };
      } else {
        const west = mode === 'nw' || mode === 'sw';
        const north = mode === 'nw' || mode === 'ne';
        const fx = west ? s.x + s.w : s.x; // the corner that stays put
        const fy = north ? s.y + s.h : s.y;
        const px = Math.min(1, Math.max(0, (west ? s.x : s.x + s.w) + dx));
        const py = Math.min(1, Math.max(0, (north ? s.y : s.y + s.h) + dy));
        const roomX = west ? fx : 1 - fx;
        const roomY = north ? fy : 1 - fy;
        let w = Math.min(Math.abs(px - fx), roomX);
        let h = Math.min(Math.abs(py - fy), roomY);
        if (ratioN) {
          h = w / ratioN;
          if (h > roomY) { h = roomY; w = h * ratioN; }
        }
        w = Math.max(0.05, w);
        h = Math.max(0.05, h);
        next = clampCrop({ x: west ? fx - w : fx, y: north ? fy - h : fy, w, h });
      }
      onChange({ ...recipeRef.current, crop: next });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      endGesture();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // ── text ─────────────────────────────────────────────────────────────────────────────────────────────────────
  const updateText = (id: string, patch: Partial<TextLayer>) => onChange({ ...recipeRef.current, text: recipeRef.current.text.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  const addText = () => {
    const text = draftText.trim();
    if (!text) return;
    const layer = newTextLayer(text);
    commit({ ...recipe, text: [...recipe.text, layer] });
    setSelectedText(layer.id);
    setDraftText('');
  };
  const removeText = (id: string) => { commit({ ...recipe, text: recipe.text.filter((t) => t.id !== id) }); setSelectedText(null); };

  const patchText = (id: string, patch: Partial<TextLayer>) => commit({ ...recipeRef.current, text: recipeRef.current.text.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  const duplicateText = (id: string) => {
    const src = recipe.text.find((t) => t.id === id);
    if (!src) return;
    const copy = { ...newTextLayer(src.text), ...src, id: newTextLayer('').id, x: Math.min(95, src.x + 5), y: Math.min(95, src.y + 5) };
    commit({ ...recipe, text: [...recipe.text, copy] });
    setSelectedText(copy.id);
  };
  const bringToFront = (id: string) => {
    const layer = recipe.text.find((t) => t.id === id);
    if (layer) commit({ ...recipe, text: [...recipe.text.filter((t) => t.id !== id), layer] });
  };

  const dragTextOnCanvas = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tab !== 'text' || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const py = ((e.clientY - rect.top) / rect.height) * canvas.height;
    // the pointer, turned back by the text's own turn, so a tilted text is hit where it really is
    const hit = [...boxesRef.current].reverse().find((b) => {
      const a = (-b.rotate * Math.PI) / 180;
      const dx = px - b.cx; const dy = py - b.cy;
      const lx = dx * Math.cos(a) - dy * Math.sin(a);
      const ly = dx * Math.sin(a) + dy * Math.cos(a);
      return Math.abs(lx) <= b.w / 2 && Math.abs(ly) <= b.h / 2;
    });
    if (!hit) { setSelectedText(null); return; }
    e.preventDefault();
    setSelectedText(hit.id);
    const layer = recipeRef.current.text.find((t) => t.id === hit.id)!;
    const start = { x: e.clientX, y: e.clientY, lx: layer.x, ly: layer.y };
    beginGesture();
    const move = (ev: PointerEvent) => {
      const nx = start.lx + ((ev.clientX - start.x) / rect.width) * 100;
      const ny = start.ly + ((ev.clientY - start.y) / rect.height) * 100;
      updateText(hit.id, { x: Math.min(100, Math.max(0, nx)), y: Math.min(100, Math.max(0, ny)) });
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); endGesture(); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  /** the round handle on a selected text: dragging it away or toward the centre resizes the text, around it turns it */
  const dragTextHandle = (e: React.PointerEvent, id: string) => {
    if (!canvasRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const layer = normalizeTextLayer(recipeRef.current.text.find((t) => t.id === id)!);
    const cx = rect.left + (layer.x / 100) * rect.width;
    const cy = rect.top + (layer.y / 100) * rect.height;
    const startDist = Math.max(8, Math.hypot(e.clientX - cx, e.clientY - cy));
    const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
    beginGesture();
    const move = (ev: PointerEvent) => {
      const dist = Math.max(8, Math.hypot(ev.clientX - cx, ev.clientY - cy));
      const angle = Math.atan2(ev.clientY - cy, ev.clientX - cx);
      let rot = layer.rotate + ((angle - startAngle) * 180) / Math.PI;
      rot = ((((rot + 180) % 360) + 360) % 360) - 180;
      if (Math.abs(rot) < 3) rot = 0; // a gentle snap to level
      updateText(id, { size: Math.min(30, Math.max(3, layer.size * (dist / startDist))), rotate: Math.round(rot) });
    };
    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); endGesture(); };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const selected = recipe.text.find((t) => t.id === selectedText) || null;
  const selectedFull = selected ? normalizeTextLayer(selected) : null;
  const selectedBox = selected ? boxes.find((b) => b.id === selected.id) : undefined;

  // ── screen ───────────────────────────────────────────────────────────────────────────────────────────────────
  if (failed) {
    return <div className="flex-1 grid place-items-center p-8 text-center text-sm text-muted-foreground">This photo could not be opened for editing. It will be posted as it is.</div>;
  }
  if (!work || !thumb) {
    return <div className="flex-1 grid place-items-center p-8" role="status" aria-label="Opening photo"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const crop = recipe.crop;
  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'crop', label: 'Crop', icon: Crop },
    { id: 'filters', label: 'Filters', icon: Sparkles },
    { id: 'adjust', label: 'Adjust', icon: SlidersHorizontal },
    { id: 'text', label: 'Text', icon: Type },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col md:flex-row">
      {/* the photo */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-3 p-4 md:p-6 bg-zinc-950">
        <div className="relative inline-block max-w-full select-none touch-none" style={{ lineHeight: 0 }}>
          <canvas
            ref={canvasRef}
            onPointerDown={dragTextOnCanvas}
            className={cn('block rounded-lg bg-black', tab === 'text' && 'cursor-move')}
            style={{ maxWidth: '100%', maxHeight: 'min(58vh, 560px)', width: 'auto', height: 'auto' }}
            aria-label="Photo preview"
          />
          {tab === 'text' && selectedBox && selected && (
            <div
              aria-hidden
              className="absolute pointer-events-none border border-white/80 rounded-sm"
              style={{
                left: `${(selectedBox.cx / dims.w) * 100}%`,
                top: `${(selectedBox.cy / dims.h) * 100}%`,
                width: `${(selectedBox.w / dims.w) * 100}%`,
                height: `${(selectedBox.h / dims.h) * 100}%`,
                transform: `translate(-50%, -50%) rotate(${selectedBox.rotate}deg)`,
                boxShadow: '0 0 0 1px rgba(0,0,0,0.35)',
              }}
            >
              <button
                type="button"
                aria-label="Resize and turn the text"
                onPointerDown={(e) => dragTextHandle(e, selected.id)}
                className="pointer-events-auto absolute -right-3 -bottom-3 h-6 w-6 rounded-full bg-white shadow ring-1 ring-black/40 cursor-nwse-resize touch-none grid place-items-center"
              >
                <RotateCw className="h-3 w-3 text-black" />
              </button>
              <button
                type="button"
                aria-label="Delete this text"
                onPointerDown={(e) => { e.stopPropagation(); removeText(selected.id); }}
                className="pointer-events-auto absolute -left-3 -top-3 h-6 w-6 rounded-full bg-white shadow ring-1 ring-black/40 grid place-items-center"
              >
                <X className="h-3 w-3 text-black" />
              </button>
            </div>
          )}
          {tab === 'crop' && (
            <div ref={overlayRef} className="absolute inset-0">
              {/* the dark area outside the crop */}
              <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(0,0,0,0.55)', clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${crop.x * 100}% ${crop.y * 100}%, ${crop.x * 100}% ${(crop.y + crop.h) * 100}%, ${(crop.x + crop.w) * 100}% ${(crop.y + crop.h) * 100}%, ${(crop.x + crop.w) * 100}% ${crop.y * 100}%, ${crop.x * 100}% ${crop.y * 100}%)` }} />
              <div
                onPointerDown={(e) => dragCrop(e, 'move')}
                className="absolute border-2 border-white cursor-move touch-none"
                style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%`, boxShadow: '0 0 0 1px rgba(0,0,0,0.4)' }}
              >
                {/* thirds */}
                <div className="absolute inset-0 pointer-events-none opacity-60" style={{ backgroundImage: 'linear-gradient(to right, transparent 33%, rgba(255,255,255,.5) 33%, rgba(255,255,255,.5) calc(33% + 1px), transparent calc(33% + 1px), transparent 66%, rgba(255,255,255,.5) 66%, rgba(255,255,255,.5) calc(66% + 1px), transparent calc(66% + 1px)), linear-gradient(to bottom, transparent 33%, rgba(255,255,255,.5) 33%, rgba(255,255,255,.5) calc(33% + 1px), transparent calc(33% + 1px), transparent 66%, rgba(255,255,255,.5) 66%, rgba(255,255,255,.5) calc(66% + 1px), transparent calc(66% + 1px))' }} />
                {(['nw', 'ne', 'sw', 'se'] as const).map((h) => (
                  <span
                    key={h}
                    role="slider"
                    aria-label={`Resize crop, ${h} corner`}
                    onPointerDown={(e) => dragCrop(e, h)}
                    className={cn('absolute h-6 w-6 -m-3 grid place-items-center touch-none', h === 'nw' || h === 'se' ? 'cursor-nwse-resize' : 'cursor-nesw-resize')}
                    style={{ left: h.includes('w') ? 0 : '100%', top: h.includes('n') ? 0 : '100%' }}
                  >
                    <span className="h-3 w-3 rounded-sm bg-white shadow ring-1 ring-black/40" />
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* the tools */}
      <div className="md:w-[340px] lg:w-[380px] shrink-0 flex flex-col border-t md:border-t-0 md:border-l border-border/50 bg-card min-h-0">
        <div className="px-3 pt-3">
          <div role="tablist" aria-label="Edit tools" className="flex gap-1 flex-wrap">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn('h-10 px-3 rounded-full text-[13px] font-semibold flex items-center gap-1.5 transition-colors', tab === id ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted')}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline md:hidden lg:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-5">
          {tab === 'crop' && (
            <>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Shape">
                {ASPECTS.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    aria-pressed={recipe.aspect === a.id}
                    onClick={() => chooseAspect(a.id)}
                    className={cn('h-9 px-4 rounded-full text-[13px] font-semibold transition-colors', recipe.aspect === a.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground')}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 gap-2" onClick={() => turn(-1)}><RotateCcw className="h-4 w-4" /> Turn left</Button>
                <Button variant="outline" className="flex-1 gap-2" onClick={() => turn(1)}><RotateCw className="h-4 w-4" /> Turn right</Button>
                <Button variant="outline" size="icon" aria-label="Flip" onClick={flip}><FlipHorizontal2 className="h-4 w-4" /></Button>
              </div>
              <p className="text-xs text-muted-foreground">Drag the box to move it and the corners to resize it.</p>
            </>
          )}

          {tab === 'filters' && (
            <>
              <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                {FILTERS.map((f) => (
                  <FilterThumb key={f.id} bitmap={thumb} recipe={recipe} filterId={f.id} label={f.label} active={recipe.filter === f.id} onPick={() => commit({ ...recipe, filter: f.id })} />
                ))}
              </div>
              {recipe.filter !== 'normal' && (
                <label className="block">
                  <span className="flex justify-between text-[13px] font-medium mb-1"><span>Strength</span><span className="text-muted-foreground tabular-nums">{recipe.intensity}</span></span>
                  <input
                    type="range" min={0} max={100} value={recipe.intensity}
                    onPointerDown={beginGesture} onPointerUp={endGesture} onKeyDown={beginGesture} onKeyUp={endGesture}
                    onChange={(e) => onChange({ ...recipe, intensity: Number(e.target.value) })}
                    className="w-full accent-[hsl(var(--primary))]"
                  />
                </label>
              )}
            </>
          )}

          {tab === 'adjust' && (
            <div className="space-y-4">
              {SLIDERS.map((s) => (
                <label key={s.key} className="block">
                  <span className="flex justify-between text-[13px] font-medium mb-1">
                    <span>{s.label}</span>
                    <span className="text-muted-foreground tabular-nums">{recipe.adjust[s.key]}</span>
                  </span>
                  <input
                    type="range" min={s.min} max={s.max} value={recipe.adjust[s.key]}
                    onPointerDown={beginGesture} onPointerUp={endGesture} onKeyDown={beginGesture} onKeyUp={endGesture}
                    onDoubleClick={() => commit({ ...recipe, adjust: { ...recipe.adjust, [s.key]: 0 } })}
                    onChange={(e) => onChange({ ...recipe, adjust: { ...recipe.adjust, [s.key]: Number(e.target.value) } })}
                    className="w-full accent-[hsl(var(--primary))]"
                    aria-label={s.label}
                  />
                </label>
              ))}
              <p className="text-xs text-muted-foreground">Double-click a slider to put it back to 0.</p>
            </div>
          )}

          {tab === 'text' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addText(); } }}
                  placeholder="Write something"
                  maxLength={120}
                  aria-label="Text to add"
                  className="flex-1 h-10 rounded-lg border bg-background px-3 text-sm"
                />
                <Button onClick={addText} disabled={!draftText.trim()}>Add</Button>
              </div>
              {recipe.text.length === 0 && <p className="text-xs text-muted-foreground">Add text, then drag it on the photo. Use the round handle to make it bigger, smaller or tilted.</p>}
              {recipe.text.length > 1 && (
                <div className="space-y-1">
                  {recipe.text.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedText(t.id)}
                      className={cn('w-full text-left text-sm rounded-lg px-3 py-2 truncate transition-colors', selectedText === t.id ? 'bg-primary/10 text-primary font-semibold' : 'hover:bg-muted')}
                    >
                      {t.text}
                    </button>
                  ))}
                </div>
              )}
              {selected && selectedFull && (
                <div className="space-y-4 rounded-xl border p-3">
                  <textarea
                    value={selected.text}
                    onChange={(e) => updateText(selected.id, { text: e.target.value })}
                    maxLength={120}
                    rows={2}
                    aria-label="Edit text"
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none"
                  />

                  <div role="group" aria-label="Type style" className="grid grid-cols-3 gap-2">
                    {TEXT_FONTS.map((fnt) => (
                      <button
                        key={fnt.id}
                        type="button"
                        aria-pressed={selectedFull.font === fnt.id}
                        onClick={() => patchText(selected.id, { font: fnt.id })}
                        className={cn('h-14 rounded-lg border flex flex-col items-center justify-center transition-colors', selectedFull.font === fnt.id ? 'border-primary bg-primary/10' : 'hover:bg-muted')}
                      >
                        <span className="text-lg leading-none" style={fontSample(fnt.id)}>Aa</span>
                        <span className="text-xs text-muted-foreground mt-1">{fnt.label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div role="group" aria-label="Alignment" className="flex rounded-lg border overflow-hidden">
                      {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([id, Icon]) => (
                        <button
                          key={id}
                          type="button"
                          aria-label={`Align ${id}`}
                          aria-pressed={selectedFull.align === id}
                          onClick={() => patchText(selected.id, { align: id })}
                          className={cn('h-9 w-10 grid place-items-center', selectedFull.align === id ? 'bg-foreground text-background' : 'hover:bg-muted')}
                        >
                          <Icon className="h-4 w-4" />
                        </button>
                      ))}
                    </div>
                    <div role="group" aria-label="Background" className="flex rounded-lg border overflow-hidden text-[12px] font-semibold">
                      {([['none', 'None'], ['box', 'Box'], ['highlight', 'Band']] as const).map(([id, label]) => (
                        <button
                          key={id}
                          type="button"
                          aria-pressed={selectedFull.backdrop === id}
                          onClick={() => patchText(selected.id, { backdrop: id, bg: backdropFor(selectedFull.color) })}
                          className={cn('h-9 px-3', selectedFull.backdrop === id ? 'bg-foreground text-background' : 'hover:bg-muted')}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Text colour">
                    {TEXT_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Colour ${c}`}
                        aria-pressed={selectedFull.color === c}
                        onClick={() => patchText(selected.id, { color: c, bg: backdropFor(c) })}
                        className={cn('h-7 w-7 rounded-full border border-border', selectedFull.color === c && 'ring-2 ring-primary ring-offset-2 ring-offset-background')}
                        style={{ background: c }}
                      />
                    ))}
                    <label className="h-7 w-7 rounded-full border border-dashed grid place-items-center cursor-pointer overflow-hidden relative" title="Pick any colour">
                      <span className="text-xs text-muted-foreground">+</span>
                      <input type="color" aria-label="Any colour" value={/^#[0-9a-f]{6}$/i.test(selectedFull.color) ? selectedFull.color : '#ffffff'} onChange={(e) => patchText(selected.id, { color: e.target.value, bg: backdropFor(e.target.value) })} className="absolute inset-0 opacity-0 cursor-pointer" />
                    </label>
                  </div>

                  <div className="flex gap-2">
                    <button type="button" aria-pressed={selectedFull.outline} onClick={() => patchText(selected.id, { outline: !selectedFull.outline })} className={cn('h-9 px-3 rounded-lg border text-[13px] font-semibold', selectedFull.outline ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted')}>Outline</button>
                    <button type="button" aria-pressed={selectedFull.shadow} onClick={() => patchText(selected.id, { shadow: !selectedFull.shadow })} className={cn('h-9 px-3 rounded-lg border text-[13px] font-semibold', selectedFull.shadow ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted')}>Shadow</button>
                  </div>

                  <label className="block">
                    <span className="flex justify-between text-[13px] font-medium mb-1"><span>Size</span><span className="text-muted-foreground tabular-nums">{Math.round(selectedFull.size)}</span></span>
                    <input
                      type="range" min={3} max={30} step={0.5} value={selectedFull.size}
                      onPointerDown={beginGesture} onPointerUp={endGesture} onKeyDown={beginGesture} onKeyUp={endGesture}
                      onChange={(e) => updateText(selected.id, { size: Number(e.target.value) })}
                      className="w-full accent-[hsl(var(--primary))]"
                    />
                  </label>
                  <label className="block">
                    <span className="flex justify-between text-[13px] font-medium mb-1"><span>Tilt</span><span className="text-muted-foreground tabular-nums">{Math.round(selectedFull.rotate)}°</span></span>
                    <input
                      type="range" min={-180} max={180} step={1} value={selectedFull.rotate}
                      onPointerDown={beginGesture} onPointerUp={endGesture} onKeyDown={beginGesture} onKeyUp={endGesture}
                      onDoubleClick={() => commit({ ...recipe, text: recipe.text.map((t) => (t.id === selected.id ? { ...t, rotate: 0 } : t)) })}
                      onChange={(e) => updateText(selected.id, { rotate: Number(e.target.value) })}
                      className="w-full accent-[hsl(var(--primary))]"
                    />
                  </label>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => duplicateText(selected.id)}><Copy className="h-4 w-4" /> Duplicate</Button>
                      {recipe.text.length > 1 && <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => bringToFront(selected.id)}><ChevronsUp className="h-4 w-4" /> Front</Button>}
                    </div>
                    <Button variant="ghost" size="sm" className="text-destructive gap-1.5" onClick={() => removeText(selected.id)}><Trash2 className="h-4 w-4" /> Delete</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-3 py-2 border-t border-border/50 flex items-center justify-between">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" aria-label="Undo" disabled={past.length === 0} onClick={undo}><Undo2 className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" aria-label="Redo" disabled={future.length === 0} onClick={redo}><Redo2 className="h-4 w-4" /></Button>
          </div>
          <Button variant="ghost" size="sm" disabled={!isEdited(recipe)} onClick={reset}>Reset all</Button>
        </div>
      </div>
    </div>
  );
};

export default PhotoEditor;
