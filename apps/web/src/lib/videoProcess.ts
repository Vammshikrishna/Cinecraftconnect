/**
 * Cuts and shrinks a video in the browser, keeping the sound (the old compressor recorded only the picture, so videos
 * posted from the web had no audio). It plays the chosen part once and records it, so it takes as long as the clip
 * itself; that is why it only runs when the video really needs it (trimmed, sound removed, or very large).
 */
export interface VideoEdit {
  start: number;
  end: number;
  duration: number;
  /** remove the sound */
  mute: boolean;
}

/** Larger than this is shrunk even when untouched, so a phone video of hundreds of MB does not go up as it is. */
const SHRINK_ABOVE_BYTES = 40 * 1024 * 1024;

export const videoNeedsWork = (file: File, edit: VideoEdit | undefined): boolean => {
  if (file.size > SHRINK_ABOVE_BYTES) return true;
  if (!edit) return false;
  return edit.mute || edit.start > 0.1 || edit.end < edit.duration - 0.1;
};

export const canProcessVideo = (): boolean =>
  typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && !!HTMLCanvasElement.prototype.captureStream;

const pickMime = (): string => {
  const options = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  return options.find((t) => MediaRecorder.isTypeSupported(t)) || '';
};

export const formatClock = (seconds: number): string => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** The length and size of a video, read from the file. */
export const readVideoInfo = (file: File): Promise<{ duration: number; width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    const finish = () => { const out = { duration: isFinite(v.duration) ? v.duration : 0, width: v.videoWidth, height: v.videoHeight }; URL.revokeObjectURL(url); resolve(out); };
    v.onloadedmetadata = () => {
      if (isFinite(v.duration)) { finish(); return; }
      // a video recorded in a browser does not say how long it is; jumping to the far end makes the browser work it out
      v.ontimeupdate = () => { v.ontimeupdate = null; finish(); };
      v.currentTime = 1e9;
    };
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This video cannot be read')); };
    v.src = url;
  });

/** Plays [start, end] of the file and records it (at most 720p) as a new file. Throws if the browser cannot record. */
export const processVideo = (
  file: File,
  edit: VideoEdit,
  opts: { maxDimension?: number; bitrate?: number; onProgress?: (share: number) => void } = {},
): Promise<File> =>
  new Promise((resolve, reject) => {
    if (!canProcessVideo()) { reject(new Error('This browser cannot cut or shrink videos')); return; }
    const mime = pickMime();
    if (!mime) { reject(new Error('This browser cannot record video')); return; }

    const maxDimension = opts.maxDimension ?? 1280;
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.src = url;
    video.playsInline = true;
    video.preload = 'auto';
    let audioCtx: AudioContext | null = null;
    let recorder: MediaRecorder | null = null;
    let raf = 0;
    let finished = false;

    const cleanup = () => {
      cancelAnimationFrame(raf);
      try { video.pause(); } catch { /* already stopped */ }
      URL.revokeObjectURL(url);
      audioCtx?.close().catch(() => { });
    };
    const fail = (message: string) => { if (finished) return; finished = true; cleanup(); reject(new Error(message)); };

    video.onerror = () => fail('This video cannot be read');
    video.onloadedmetadata = () => {
      let width = video.videoWidth || 1280;
      let height = video.videoHeight || 720;
      if (width > maxDimension || height > maxDimension) {
        const k = maxDimension / Math.max(width, height);
        width = Math.round(width * k);
        height = Math.round(height * k);
      }
      width -= width % 2;
      height -= height % 2;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { fail('This browser cannot cut or shrink videos'); return; }

      // picture from the canvas, sound from the video itself (routed only into the recording, so nothing plays aloud)
      const tracks: MediaStreamTrack[] = [...canvas.captureStream(30).getVideoTracks()];
      if (!edit.mute) {
        try {
          const AC: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
          audioCtx = new AC();
          audioCtx.resume().catch(() => { });
          const source = audioCtx.createMediaElementSource(video);
          const dest = audioCtx.createMediaStreamDestination();
          source.connect(dest);
          tracks.push(...dest.stream.getAudioTracks());
        } catch { /* no sound track: the recording is picture only, never silent garbage */ }
      }
      const stream = new MediaStream(tracks);
      try {
        recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: opts.bitrate ?? 2_000_000 });
      } catch { fail('This browser cannot record video'); return; }

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = () => {
        if (finished) return;
        finished = true;
        cleanup();
        const blob = new Blob(chunks, { type: mime.split(';')[0] });
        if (blob.size === 0) { reject(new Error('The video could not be recorded')); return; }
        const ext = mime.includes('mp4') ? 'mp4' : 'webm';
        resolve(new File([blob], file.name.replace(/\.[^/.]+$/, '') + `_edited.${ext}`, { type: blob.type, lastModified: Date.now() }));
      };

      const stop = () => { if (recorder && recorder.state !== 'inactive') recorder.stop(); };
      const draw = () => {
        if (finished) return;
        ctx.drawImage(video, 0, 0, width, height);
        const span = Math.max(0.1, edit.end - edit.start);
        opts.onProgress?.(Math.min(1, Math.max(0, (video.currentTime - edit.start) / span)));
        if (video.ended || video.currentTime >= edit.end - 0.03) { stop(); return; }
        raf = requestAnimationFrame(draw);
      };

      // go to the start, then play to the end while recording
      const begin = () => {
        recorder!.start(250);
        video.play().then(() => { raf = requestAnimationFrame(draw); }).catch(() => fail('The browser did not allow the video to play. Tap Next again.'));
      };
      if (edit.start > 0.05) {
        video.onseeked = () => { video.onseeked = null; begin(); };
        video.currentTime = edit.start;
      } else {
        begin();
      }
    };
  });
