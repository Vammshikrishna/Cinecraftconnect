import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Video, Circle, Square, RotateCcw, Check, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export type CaptureMode = 'photo' | 'video';

interface Props {
  open: boolean;
  initialMode: CaptureMode;
  /** longest recording in seconds */
  maxSeconds: number;
  onClose: () => void;
  onCapture: (file: File) => void;
}

/** the best recording format this browser can make, with the file extension to use for it */
const pickRecordingType = (): { mime: string; ext: string } | null => {
  if (typeof MediaRecorder === 'undefined') return null;
  const options: { mime: string; ext: string }[] = [
    { mime: 'video/webm;codecs=vp9,opus', ext: 'webm' },
    { mime: 'video/webm;codecs=vp8,opus', ext: 'webm' },
    { mime: 'video/webm', ext: 'webm' },
    { mime: 'video/mp4', ext: 'mp4' },
  ];
  return options.find((o) => { try { return MediaRecorder.isTypeSupported(o.mime); } catch { return false; } }) || null;
};

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const errorText = (e: any): string => {
  const name = e?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera access is blocked. Allow the camera and microphone for this site in your browser settings, then try again.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera was found on this device.';
  if (name === 'NotReadableError') return 'The camera is being used by another app. Close it and try again.';
  return 'The camera could not be started.';
};

export function CameraCaptureDialog({ open, initialMode, maxSeconds, onClose, onCapture }: Props) {
  const [mode, setMode] = useState<CaptureMode>(initialMode);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<{ file: File; url: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const clearTimer = () => { if (timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; } };

  const startStream = useCallback(async (m: CaptureMode) => {
    stopStream();
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) { setError('This browser cannot use the camera. Try Chrome, Edge or Safari over a secure (https) connection.'); return; }
    if (m === 'video' && !pickRecordingType()) { setError('This browser cannot record video. Try Chrome or Edge, or use "Select from device".'); return; }
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: m === 'video' });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => { }); }
    } catch (e: any) {
      setError(errorText(e));
    } finally {
      setStarting(false);
    }
  }, [stopStream]);

  // open / close
  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setResult(null);
    setElapsed(0);
    setRecording(false);
    return () => {
      clearTimer();
      try { if (recorderRef.current && recorderRef.current.state !== 'inactive') { recorderRef.current.onstop = null; recorderRef.current.stop(); } } catch { /* ignore */ }
      recorderRef.current = null;
      stopStream();
    };
  }, [open, initialMode, stopStream]);

  useEffect(() => {
    if (!open || result) return;
    startStream(mode);
  }, [open, mode, result, startStream]);

  // free the preview of a discarded recording
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  const finishRecording = useCallback(() => {
    clearTimer();
    setRecording(false);
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
  }, []);

  const startRecording = () => {
    const stream = streamRef.current;
    const type = pickRecordingType();
    if (!stream || !type) return;
    chunksRef.current = [];
    let rec: MediaRecorder;
    try { rec = new MediaRecorder(stream, { mimeType: type.mime }); } catch { setError('Recording could not be started on this device.'); return; }
    recorderRef.current = rec;
    rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onerror = () => { setError('Recording stopped unexpectedly.'); finishRecording(); };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: type.mime.split(';')[0] });
      chunksRef.current = [];
      if (blob.size === 0) { setError('Nothing was recorded. Please try again.'); return; }
      const file = new File([blob], `recording_${Date.now()}.${type.ext}`, { type: blob.type });
      stopStream();
      setResult({ file, url: URL.createObjectURL(file) });
    };
    rec.start(500);
    startedAtRef.current = Date.now();
    setElapsed(0);
    setRecording(true);
    timerRef.current = window.setInterval(() => {
      const s = (Date.now() - startedAtRef.current) / 1000;
      setElapsed(s);
      if (s >= maxSeconds) finishRecording();
    }, 200);
  };

  const takePhoto = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d')?.drawImage(v, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) { setError('The photo could not be taken. Please try again.'); return; }
      const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
      stopStream();
      setResult({ file, url: URL.createObjectURL(file) });
    }, 'image/jpeg', 0.92);
  };

  const retake = () => { setResult(null); setElapsed(0); };
  const use = () => { if (result) { onCapture(result.file); } };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg" onOpenAutoFocus={(e) => { e.preventDefault(); closeBtnRef.current?.focus(); }}>
        <DialogHeader>
          <DialogTitle>{mode === 'photo' ? 'Take a photo' : 'Record a video'}</DialogTitle>
          <DialogDescription>
            {mode === 'video' ? `Videos can be up to ${fmt(maxSeconds)}. Press Escape to close.` : 'Press Escape to close.'}
          </DialogDescription>
        </DialogHeader>

        {!result && !recording && (
          <div className="flex gap-2" role="group" aria-label="Camera mode">
            <Button type="button" size="sm" variant={mode === 'photo' ? 'default' : 'outline'} aria-pressed={mode === 'photo'} onClick={() => setMode('photo')}>
              <Camera className="h-4 w-4 mr-1.5" aria-hidden="true" /> Photo
            </Button>
            <Button type="button" size="sm" variant={mode === 'video' ? 'default' : 'outline'} aria-pressed={mode === 'video'} onClick={() => setMode('video')}>
              <Video className="h-4 w-4 mr-1.5" aria-hidden="true" /> Video
            </Button>
          </div>
        )}

        <div className="relative rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center">
          {result ? (
            result.file.type.startsWith('video/')
              ? <video src={result.url} className="w-full h-full object-contain" controls playsInline aria-label="Recorded video preview" />
              : <img src={result.url} alt="Photo you just took" className="w-full h-full object-contain" />
          ) : (
            <video ref={videoRef} className="w-full h-full object-contain" muted playsInline aria-label="Camera preview" />
          )}
          {starting && !result && <Loader2 className="absolute h-8 w-8 animate-spin text-white" aria-label="Starting camera" />}
          {recording && (
            <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-black/70 px-2.5 py-1 text-xs text-white tabular-nums" role="timer" aria-live="off">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
              {fmt(elapsed)} / {fmt(maxSeconds)}
            </div>
          )}
        </div>

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap justify-end gap-2">
          <Button ref={closeBtnRef} type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          {result ? (
            <>
              <Button type="button" variant="outline" onClick={retake}><RotateCcw className="h-4 w-4 mr-1.5" aria-hidden="true" /> Retake</Button>
              <Button type="button" onClick={use}><Check className="h-4 w-4 mr-1.5" aria-hidden="true" /> {result.file.type.startsWith('video/') ? 'Use video' : 'Use photo'}</Button>
            </>
          ) : mode === 'photo' ? (
            <Button type="button" onClick={takePhoto} disabled={starting || !!error}><Camera className="h-4 w-4 mr-1.5" aria-hidden="true" /> Take photo</Button>
          ) : recording ? (
            <Button type="button" variant="destructive" onClick={finishRecording}><Square className="h-4 w-4 mr-1.5" aria-hidden="true" /> Stop recording</Button>
          ) : (
            <Button type="button" onClick={startRecording} disabled={starting || !!error}><Circle className="h-4 w-4 mr-1.5 fill-current" aria-hidden="true" /> Start recording</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default CameraCaptureDialog;
