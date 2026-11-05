import { useEffect, useRef, useState } from 'react';
import { VolumeX, Volume2 } from 'lucide-react';
import { formatClock, type VideoEdit } from '@/lib/videoProcess';
import { cn } from '@/lib/utils';

interface Props {
  src: string;
  edit: VideoEdit | undefined;
  /** length of the video in seconds, read when it was added */
  duration: number;
  onChange: (next: VideoEdit) => void;
}

const MIN_LENGTH = 1; // seconds

/** Pick the part of a video to keep, and whether to keep its sound. The preview plays only the chosen part. */
export const VideoTrimmer = ({ src, edit, duration, onChange }: Props) => {
  const ref = useRef<HTMLVideoElement>(null);
  const [now, setNow] = useState(0);
  const editRef = useRef(edit);
  editRef.current = edit;

  const onMeta = () => {
    if (editRef.current || duration <= 0) return;
    onChange({ start: 0, end: duration, duration, mute: false });
  };

  // keep the preview inside the chosen part
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const tick = () => {
      const e = editRef.current;
      setNow(v.currentTime);
      if (!e) return;
      if (v.currentTime >= e.end - 0.02) { v.currentTime = e.start; if (!v.paused) v.play().catch(() => { }); }
      else if (v.currentTime < e.start - 0.05) v.currentTime = e.start;
    };
    v.addEventListener('timeupdate', tick);
    return () => v.removeEventListener('timeupdate', tick);
  }, [src]);

  if (!edit) {
    return (
      <div className="flex-1 min-h-0 grid place-items-center p-4 bg-black/40">
        <video ref={ref} src={src} onLoadedMetadata={onMeta} className="max-h-[50vh] max-w-full rounded-lg bg-black" muted playsInline />
      </div>
    );
  }

  const pct = (t: number) => (edit.duration > 0 ? (t / edit.duration) * 100 : 0);
  const setStart = (t: number) => {
    const start = Math.min(Math.max(0, t), edit.end - MIN_LENGTH);
    onChange({ ...edit, start });
    if (ref.current) ref.current.currentTime = start;
  };
  const setEnd = (t: number) => {
    const end = Math.max(Math.min(edit.duration, t), edit.start + MIN_LENGTH);
    onChange({ ...edit, end });
    if (ref.current) ref.current.currentTime = Math.max(edit.start, end - 0.5);
  };
  const thumb = '[&::-webkit-slider-thumb]:pointer-events-auto [&::-moz-range-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:appearance-none [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-sm [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0';

  return (
    <div className="flex-1 min-h-0 flex flex-col md:flex-row">
      <div className="flex-1 min-h-0 grid place-items-center p-4 md:p-6 bg-black/40">
        <video ref={ref} src={src} controls playsInline muted={edit.mute} className="max-h-[52vh] max-w-full rounded-lg bg-black" />
      </div>

      <div className="md:w-[340px] lg:w-[380px] shrink-0 border-t md:border-t-0 md:border-l border-border/50 bg-card p-4 space-y-5">
        <div>
          <div className="flex justify-between text-[13px] font-medium mb-3">
            <span>Trim</span>
            <span className="text-muted-foreground tabular-nums">{formatClock(edit.start)} – {formatClock(edit.end)} · {formatClock(edit.end - edit.start)}</span>
          </div>
          <div className="relative h-8">
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded bg-muted" />
            <div className="absolute top-1/2 -translate-y-1/2 h-2 rounded bg-primary/40" style={{ left: `${pct(edit.start)}%`, width: `${pct(edit.end) - pct(edit.start)}%` }} />
            <div className="absolute top-1/2 -translate-y-1/2 h-4 w-0.5 bg-foreground/70" style={{ left: `${pct(now)}%` }} />
            <input
              type="range" min={0} max={edit.duration} step={0.1} value={edit.start}
              onChange={(e) => setStart(Number(e.target.value))}
              aria-label="Start of the video"
              className={cn('absolute inset-0 w-full appearance-none bg-transparent pointer-events-none', thumb)}
            />
            <input
              type="range" min={0} max={edit.duration} step={0.1} value={edit.end}
              onChange={(e) => setEnd(Number(e.target.value))}
              aria-label="End of the video"
              className={cn('absolute inset-0 w-full appearance-none bg-transparent pointer-events-none', thumb)}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">Drag the two handles. Only this part is posted.</p>
        </div>

        <button
          type="button"
          onClick={() => onChange({ ...edit, mute: !edit.mute })}
          aria-pressed={edit.mute}
          className={cn('w-full h-11 rounded-xl border flex items-center justify-center gap-2 text-sm font-semibold transition-colors', edit.mute ? 'bg-primary/10 border-primary text-primary' : 'hover:bg-muted')}
        >
          {edit.mute ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          {edit.mute ? 'Sound removed' : 'Keep the sound'}
        </button>
      </div>
    </div>
  );
};

export default VideoTrimmer;
