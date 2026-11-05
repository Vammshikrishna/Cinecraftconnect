import { NativeModules, Platform } from 'react-native';
import { colorMatrix, normalizeTextLayer, vignetteLook, vignetteStrength, type PhotoRecipe } from '@cinecraft/core';

/**
 * Draws a photo edit (see packages/core/src/photoEdit.ts) with the phone's own graphics code, at full quality.
 * The colour is the same 20 numbers the web editor uses, so a filter looks the same on both.
 * Android and iOS (PhotoRender.m; iOS always writes JPEG, see "mime"); elsewhere the editor is simply not offered.
 */
const native: any = (NativeModules as any).PhotoRender;

export const photoEditingAvailable = (): boolean => (Platform.OS === 'android' || Platform.OS === 'ios') && !!native?.render;

export interface RenderedPhoto {
  uri: string;
  width: number;
  height: number;
  size: number;
  mime: string;
  /** where each text layer ended up, in pixels of this picture (for touching and dragging text) */
  boxes: { id: string; x: number; y: number; w: number; h: number; cx: number; cy: number; rotate: number }[];
}

/** Size of the photo as it is shown (after the camera's own rotation). Rejects if the file is not a picture. */
export const photoInfo = (uri: string): Promise<{ width: number; height: number }> => native.info(uri);

export const renderPhoto = (
  uri: string,
  recipe: PhotoRecipe,
  opts: { maxEdge: number; whole?: boolean; withText?: boolean; quality?: number; format?: 'webp' | 'jpeg' },
): Promise<RenderedPhoto> => {
  const strength = vignetteStrength(recipe);
  const look = vignetteLook(strength);
  return native.render(
    uri,
    JSON.stringify({
      rotate: recipe.rotate,
      flipH: recipe.flipH,
      crop: recipe.crop,
      whole: !!opts.whole,
      maxEdge: opts.maxEdge,
      quality: opts.quality ?? 85,
      format: opts.format ?? 'webp',
      matrix: colorMatrix(recipe),
      vignette: { strength, start: look.start, alpha: look.alpha },
      withText: opts.withText !== false,
      text: recipe.text.map(normalizeTextLayer),
    }),
  );
};

/** Deletes a temporary picture made by renderPhoto once it is no longer shown. Never throws. */
export const releasePhoto = (uri?: string | null): void => {
  if (!uri || !native?.release) return;
  try { native.release(uri); } catch { /* a leftover cache file is harmless */ }
};

// ── video: read it, show still frames of it, and cut it without re-encoding ─────────────────────────────────────

export const videoEditingAvailable = (): boolean => (Platform.OS === 'android' || Platform.OS === 'ios') && !!native?.trimVideo;

/** The part of a video to keep (in seconds) and whether to keep its sound. */
export interface VideoEdit {
  start: number;
  end: number;
  duration: number;
  mute: boolean;
}

export interface VideoInfo {
  /** milliseconds */
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

/** Length and size of a video. Rejects if this phone cannot read it as a video. */
export const videoInfo = (uri: string): Promise<VideoInfo> => native.videoInfo(uri);

/** One still picture of the video at a time (milliseconds). */
export const videoFrame = (uri: string, timeMs: number, maxEdge: number): Promise<{ uri: string; width: number; height: number }> =>
  native.videoFrame(uri, timeMs, maxEdge);

/** Several still pictures spread over the video, for the strip under the trimmer. */
export const videoFrames = (uri: string, count: number, maxEdge: number): Promise<string[]> => native.videoFrames(uri, count, maxEdge);

/** Keeps [startMs, endMs] without re-encoding (the cut starts at the nearest keyframe). */
export const trimVideo = (uri: string, startMs: number, endMs: number, mute: boolean): Promise<{ uri: string; size: number; mime: string }> =>
  native.trimVideo(uri, startMs, endMs, mute);
