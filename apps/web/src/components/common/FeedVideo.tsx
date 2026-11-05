import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Expand, Loader2, Pause, Play, RotateCcw, Volume2, VolumeX, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { claimPlayback, formatClock, releasePlayback, rememberSound, soundPreferred } from '@/lib/videoPlayback';

/** Autoplay is skipped when the person asked for less motion or is saving data. */
function autoplayAllowed(): boolean {
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
    if (document.documentElement.classList.contains('reduce-motion')) return false;
    const conn = (navigator as any).connection;
    if (conn?.saveData) return false;
  } catch { /* assume allowed */ }
  return true;
}

/** Thin progress bar that follows a video and seeks on click or drag. No time labels. */
function Scrubber({ videoRef, thick = false, className }: { videoRef: React.RefObject<HTMLVideoElement>; thick?: boolean; className?: string }) {
  const fillRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = videoRef.current;
      if (v && fillRef.current && v.duration > 0 && !dragging.current) {
        fillRef.current.style.width = `${Math.min(100, (v.currentTime / v.duration) * 100)}%`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [videoRef]);

  const seekTo = (clientX: number) => {
    const v = videoRef.current; const bar = barRef.current;
    if (!v || !bar || !(v.duration > 0)) return;
    const rect = bar.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    v.currentTime = f * v.duration;
    if (fillRef.current) fillRef.current.style.width = `${f * 100}%`;
  };

  return (
    <div
      ref={barRef}
      role="slider"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={-1}
      className={cn('group/scrub absolute inset-x-0 bottom-0 z-20 flex h-4 cursor-pointer items-end touch-none', className)}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        e.stopPropagation();
        dragging.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        seekTo(e.clientX);
      }}
      onPointerMove={(e) => { if (dragging.current) seekTo(e.clientX); }}
      onPointerUp={(e) => { dragging.current = false; (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); }}
      onPointerCancel={() => { dragging.current = false; }}
    >
      <div className={cn('w-full bg-white/30 transition-[height]', thick ? 'h-1.5 group-hover/scrub:h-2' : 'h-[3px] group-hover/scrub:h-1')}>
        <div ref={fillRef} className="h-full w-0 bg-primary" />
      </div>
    </div>
  );
}

interface FeedVideoProps {
  src: string;
  poster?: string;
  /** Classes for the outer frame (width, rounding, margins). */
  className?: string;
  /** Fill a parent that already has a size instead of choosing its own aspect ratio. */
  fill?: boolean;
  /** Wait ~250 ms before treating a click as play/pause so a double-click (like) can cancel it. */
  delayClick?: boolean;
  /** Show the expand button that opens the full-screen viewer. */
  allowViewer?: boolean;
  /** Start by itself when mostly in view. */
  autoPlayInView?: boolean;
  onOpenViewer?: () => void;
  /** width / height saved with the post: the frame has the right shape on first paint, before the video loads. */
  aspectHint?: number | null;
}

const CLICK_DELAY_MS = 250;

/** real shape of each video seen so far, so a card is already the right height when it appears again */
const seenRatio = new Map<string, number>();

export const FeedVideo: React.FC<FeedVideoProps> = ({
  src, poster, className, fill = false, delayClick = false, allowViewer = true, autoPlayInView = true, onOpenViewer, aspectHint,
}) => {
  const id = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const clickTimer = useRef<number | null>(null);
  const flashTimer = useRef<number | null>(null);
  const userPaused = useRef(false);
  const inViewRef = useRef(false);
  const viewerOpenRef = useRef(false);

  const [muted, setMuted] = useState(() => !soundPreferred());
  const [playing, setPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [duration, setDuration] = useState(0);
  const [ratio, setRatio] = useState<number | null>(() => seenRatio.get(src) ?? (aspectHint && aspectHint > 0 ? aspectHint : null));
  const [flash, setFlash] = useState<'play' | 'pause' | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [canAuto] = useState(() => autoPlayInView && autoplayAllowed());

  const pauseSelf = useCallback(() => { videoRef.current?.pause(); }, []);

  const tryPlay = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      await v.play();
    } catch {
      // Sound is only allowed after a gesture: fall back to muted and try again.
      if (!v.muted) {
        v.muted = true;
        setMuted(true);
        try { await v.play(); } catch { /* still blocked: stay paused */ }
      }
    }
  }, []);

  // Autoplay when about 60% visible, pause when scrolled away.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting && entry.intersectionRatio >= 0.6;
        inViewRef.current = visible;
        const v = videoRef.current;
        if (!v) return;
        if (visible) {
          if (canAuto && !userPaused.current && !viewerOpenRef.current && !document.hidden) void tryPlay();
        } else {
          userPaused.current = false;
          v.pause();
        }
      },
      { threshold: [0, 0.25, 0.6, 0.85, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [canAuto, tryPlay]);

  // Pause when the tab is hidden, resume when it is back.
  useEffect(() => {
    const onVis = () => {
      const v = videoRef.current;
      if (!v) return;
      if (document.hidden) v.pause();
      else if (canAuto && inViewRef.current && !userPaused.current && !viewerOpenRef.current) void tryPlay();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [canAuto, tryPlay]);

  useEffect(() => () => {
    releasePlayback(id);
    if (clickTimer.current) window.clearTimeout(clickTimer.current);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
  }, [id]);

  const showFlash = (kind: 'play' | 'pause') => {
    setFlash(kind);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 600);
  };

  const toggle = () => {
    const v = videoRef.current;
    if (!v || error) return;
    if (v.paused) {
      userPaused.current = false;
      void tryPlay();
      showFlash('play');
    } else {
      userPaused.current = true;
      v.pause();
      showFlash('pause');
    }
  };

  const onWrapClick = () => {
    if (!delayClick) { toggle(); return; }
    if (clickTimer.current) window.clearTimeout(clickTimer.current);
    clickTimer.current = window.setTimeout(() => { clickTimer.current = null; toggle(); }, CLICK_DELAY_MS);
  };

  const onWrapDoubleClick = () => {
    if (clickTimer.current) { window.clearTimeout(clickTimer.current); clickTimer.current = null; }
  };

  const toggleMute = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v) return;
    const next = !v.muted;
    v.muted = next;
    setMuted(next);
    rememberSound(!next);
  };

  const openViewer = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    if (onOpenViewer) { onOpenViewer(); return; }
    viewerOpenRef.current = true;
    videoRef.current?.pause();
    setViewerOpen(true);
  };

  const closeViewer = (open: boolean) => {
    setViewerOpen(open);
    if (!open) {
      viewerOpenRef.current = false;
      if (canAuto && inViewRef.current && !userPaused.current) void tryPlay();
    }
  };

  const retry = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    setError(false);
    setReady(false);
    videoRef.current?.load();
    if (inViewRef.current && canAuto) void tryPlay();
  };

  const clamped = ratio ? Math.min(2, Math.max(0.8, ratio)) : 16 / 9;
  const label = playing ? 'Video, click to pause' : 'Video, click to play';

  return (
    <>
      <div
        ref={wrapRef}
        role="button"
        tabIndex={0}
        aria-label={label}
        className={cn('relative w-full overflow-hidden bg-black select-none outline-none focus-visible:ring-2 focus-visible:ring-primary', fill && 'h-full', className)}
        style={fill ? undefined : { aspectRatio: String(clamped) }}
        onClick={onWrapClick}
        onDoubleClick={onWrapDoubleClick}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); }
        }}
      >
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          muted={muted}
          loop
          playsInline
          preload="metadata"
          disablePictureInPicture
          className="absolute inset-0 h-full w-full object-cover"
          onLoadedMetadata={(e) => {
            const v = e.currentTarget;
            if (v.videoWidth && v.videoHeight) { const r = v.videoWidth / v.videoHeight; seenRatio.set(src, r); setRatio(r); }
            if (Number.isFinite(v.duration)) setDuration(v.duration);
          }}
          onDurationChange={(e) => { if (Number.isFinite(e.currentTarget.duration)) setDuration(e.currentTarget.duration); }}
          onLoadedData={() => { setReady(true); setError(false); }}
          onCanPlay={() => setReady(true)}
          onWaiting={() => setReady(false)}
          onPlaying={() => setReady(true)}
          onPlay={() => { setPlaying(true); setHasPlayed(true); claimPlayback(id, pauseSelf); }}
          onPause={() => { setPlaying(false); releasePlayback(id); }}
          onEnded={() => { setPlaying(false); releasePlayback(id); }}
          onError={() => setError(true)}
        />

        {!ready && !error && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-white/80" aria-hidden="true" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/80 text-white">
            <span className="text-sm font-medium">Video unavailable</span>
            <button type="button" onClick={retry} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Retry
            </button>
          </div>
        )}

        {/* Brief play/pause feedback, or a standing play button when autoplay is off */}
        {!error && (flash || (!canAuto && !playing && !flash)) && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className={cn('flex h-16 w-16 items-center justify-center rounded-full bg-black/55 text-white', flash && 'animate-in zoom-in-75 fade-in-0 duration-200')}>
              {(flash ? flash === 'play' : true)
                ? <Play className="ml-1 h-8 w-8 fill-current" aria-hidden="true" />
                : <Pause className="h-8 w-8 fill-current" aria-hidden="true" />}
            </div>
          </div>
        )}

        {!error && duration > 0 && (!playing || !hasPlayed) && (
          <span className="pointer-events-none absolute bottom-3.5 left-3 z-10 rounded-full bg-black/60 px-2 py-0.5 text-[12px] font-semibold tabular-nums text-white">
            {formatClock(duration)}
          </span>
        )}

        {!error && allowViewer && (
          <button
            type="button"
            aria-label="Open video full screen"
            onClick={openViewer}
            onDoubleClick={(e) => e.stopPropagation()}
            className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm hover:bg-black/75 focus-visible:ring-2 focus-visible:ring-primary"
          >
            <Expand className="h-4 w-4" aria-hidden="true" />
          </button>
        )}

        {!error && (
          <button
            type="button"
            aria-label={muted ? 'Unmute video' : 'Mute video'}
            aria-pressed={!muted}
            onClick={toggleMute}
            onDoubleClick={(e) => e.stopPropagation()}
            className="absolute bottom-4 right-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm hover:bg-black/75 focus-visible:ring-2 focus-visible:ring-primary"
          >
            {muted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
          </button>
        )}

        {!error && <Scrubber videoRef={videoRef} />}
      </div>

      {allowViewer && !onOpenViewer && (
        <VideoViewerDialog open={viewerOpen} onOpenChange={closeViewer} src={src} poster={poster} />
      )}
    </>
  );
};

/** The full-screen player: contained video, sound on, scrubber with times, keyboard control. */
export const VideoViewerPlayer: React.FC<{ src: string; poster?: string; onClose?: () => void; className?: string }> = ({ src, poster, onClose, className }) => {
  const id = useId();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [flash, setFlash] = useState<'play' | 'pause' | null>(null);
  const flashTimer = useRef<number | null>(null);

  const pauseSelf = useCallback(() => { videoRef.current?.pause(); }, []);

  const start = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    try { await v.play(); } catch {
      v.muted = true; setMuted(true);
      try { await v.play(); } catch { /* needs a tap */ }
    }
  }, []);

  useEffect(() => {
    void start();
    return () => { releasePlayback(id); if (flashTimer.current) window.clearTimeout(flashTimer.current); };
  }, [start, id]);

  useEffect(() => {
    const onVis = () => { if (document.hidden) videoRef.current?.pause(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    const kind = v.paused ? 'play' : 'pause';
    if (v.paused) void start(); else v.pause();
    setFlash(kind);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 600);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    rememberSound(!v.muted);
  };

  const seekBy = (d: number) => {
    const v = videoRef.current;
    if (!v || !(v.duration > 0)) return;
    v.currentTime = Math.min(v.duration, Math.max(0, v.currentTime + d));
  };

  return (
    <div
      data-video-viewer
      tabIndex={-1}
      className={cn('relative flex h-full w-full items-center justify-center bg-black outline-none', className)}
      onKeyDown={(e) => {
        const onButton = (e.target as HTMLElement).tagName === 'BUTTON';
        if (e.key === ' ' && !onButton) { e.preventDefault(); toggle(); }
        else if (e.key === 'm' || e.key === 'M') { e.preventDefault(); toggleMute(); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); seekBy(5); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); seekBy(-5); }
      }}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        playsInline
        muted={muted}
        loop
        preload="auto"
        aria-label={playing ? 'Video, click to pause' : 'Video, click to play'}
        className="max-h-full max-w-full cursor-pointer object-contain"
        onClick={toggle}
        onLoadedData={() => setReady(true)}
        onCanPlay={() => setReady(true)}
        onWaiting={() => setReady(false)}
        onPlaying={() => setReady(true)}
        onDurationChange={(e) => { if (Number.isFinite(e.currentTarget.duration)) setDuration(e.currentTarget.duration); }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onPlay={() => { setPlaying(true); claimPlayback(id, pauseSelf); }}
        onPause={() => { setPlaying(false); releasePlayback(id); }}
        onError={() => setError(true)}
      />

      {!ready && !error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Loader2 className="h-9 w-9 animate-spin text-white/80" aria-hidden="true" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white">
          <span className="text-sm font-medium">Video unavailable</span>
          <button type="button" onClick={() => { setError(false); videoRef.current?.load(); void start(); }} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/25">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Retry
          </button>
        </div>
      )}
      {flash && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-black/55 text-white animate-in zoom-in-75 fade-in-0 duration-200">
            {flash === 'play' ? <Play className="ml-1 h-10 w-10 fill-current" aria-hidden="true" /> : <Pause className="h-10 w-10 fill-current" aria-hidden="true" />}
          </div>
        </div>
      )}

      {onClose && (
        <button type="button" aria-label="Close video" onClick={onClose} className="absolute right-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75 focus-visible:ring-2 focus-visible:ring-primary">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      )}

      <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 to-transparent px-4 pb-4 pt-10">
        <div className="relative mb-2 h-4">
          <Scrubber videoRef={videoRef} thick className="!bottom-1" />
        </div>
        <div className="flex items-center justify-between text-white">
          <span className="text-xs font-semibold tabular-nums">{formatClock(time)} / {formatClock(duration)}</span>
          <button
            type="button"
            aria-label={muted ? 'Unmute video' : 'Mute video'}
            aria-pressed={!muted}
            onClick={toggleMute}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 hover:bg-black/75 focus-visible:ring-2 focus-visible:ring-primary"
          >
            {muted ? <VolumeX className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export const VideoViewerDialog: React.FC<{ open: boolean; onOpenChange: (open: boolean) => void; src: string; poster?: string }> = ({ open, onOpenChange, src, poster }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent
      aria-describedby={undefined}
      hideClose
      onOpenAutoFocus={(e) => {
        // Focus the player, not the close button, so Space toggles playback instead of closing.
        e.preventDefault();
        document.querySelector<HTMLElement>('[data-video-viewer]')?.focus({ preventScroll: true });
      }}
      className="fixed inset-0 left-0 top-0 flex h-[100dvh] max-h-none w-screen max-w-none translate-x-0 translate-y-0 items-center justify-center gap-0 overflow-hidden rounded-none border-none bg-black p-0"
    >
      <DialogTitle className="sr-only">Video</DialogTitle>
      <VideoViewerPlayer src={src} poster={poster} onClose={() => onOpenChange(false)} />
    </DialogContent>
  </Dialog>
);

/**
 * Silent looping preview for grids and share cards: plays on hover (mouse) or while mostly in view (touch),
 * shares the one-video-at-a-time slot, and stays still for reduced motion / data saver.
 */
export const PreviewVideo: React.FC<{ src: string; className?: string; style?: React.CSSProperties }> = ({ src, className, style }) => {
  const id = useId();
  const ref = useRef<HTMLVideoElement>(null);
  const inView = useRef(false);
  const hovering = useRef(false);
  const allowed = useRef(autoplayAllowed());
  const touchOnly = useRef(typeof window !== 'undefined' && !window.matchMedia?.('(hover: hover)').matches);

  const play = useCallback(() => {
    const v = ref.current;
    if (!v || !allowed.current || document.hidden) return;
    v.muted = true;
    v.play().catch(() => { /* blocked: stays on the first frame */ });
  }, []);

  useEffect(() => {
    const v = ref.current;
    if (!v || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => {
      inView.current = e.isIntersecting && e.intersectionRatio >= 0.6;
      if (!inView.current) v.pause();
      else if (touchOnly.current) play();
    }, { threshold: [0, 0.6, 1] });
    io.observe(v);
    const onVis = () => { if (document.hidden) v.pause(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', onVis); releasePlayback(id); };
  }, [play, id]);

  return (
    <video
      ref={ref}
      src={src}
      muted
      loop
      playsInline
      preload="metadata"
      className={className}
      style={style}
      onMouseEnter={() => { hovering.current = true; play(); }}
      onMouseLeave={() => { hovering.current = false; ref.current?.pause(); }}
      onPlay={() => claimPlayback(id, () => ref.current?.pause())}
      onPause={() => releasePlayback(id)}
    />
  );
};

export default FeedVideo;
