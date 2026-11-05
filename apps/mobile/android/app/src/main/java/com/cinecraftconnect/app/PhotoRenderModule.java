package com.cinecraftconnect.app;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.ColorMatrix;
import android.graphics.ColorMatrixColorFilter;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.RadialGradient;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.media.MediaCodec;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.media.MediaMetadataRetriever;
import android.media.MediaMuxer;
import android.net.Uri;
import android.os.Build;
import androidx.exifinterface.media.ExifInterface;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.List;

/**
 * Draws a photo edit (see packages/core/src/photoEdit.ts) at full quality: turn, flip, crop, colour, vignette, text.
 * The colour comes in as the same 20 numbers the web editor uses, so both platforms give the same result.
 * Used for the live preview (small) and for the finished picture that is uploaded.
 */
public class PhotoRenderModule extends ReactContextBaseJavaModule {
    private static final String MODULE_NAME = "PhotoRender";

    public PhotoRenderModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    /** Size of the photo as it is shown (after the camera's own rotation). */
    @ReactMethod
    public void info(String uriString, Promise promise) {
        new Thread(() -> {
            try {
                Context context = getReactApplicationContext();
                Uri uri = Uri.parse(uriString);
                int[] raw = rawSize(context, uri);
                if (raw[0] <= 0 || raw[1] <= 0) {
                    promise.reject("ERR_DECODE", "This file is not a picture that can be edited");
                    return;
                }
                int orientation = orientationOf(context, uri);
                boolean swap = orientation == ExifInterface.ORIENTATION_ROTATE_90 || orientation == ExifInterface.ORIENTATION_ROTATE_270
                        || orientation == ExifInterface.ORIENTATION_TRANSPOSE || orientation == ExifInterface.ORIENTATION_TRANSVERSE;
                WritableMap out = Arguments.createMap();
                out.putInt("width", swap ? raw[1] : raw[0]);
                out.putInt("height", swap ? raw[0] : raw[1]);
                promise.resolve(out);
            } catch (Throwable t) {
                promise.reject("ERR_INFO", String.valueOf(t.getMessage()), t);
            }
        }).start();
    }

    /**
     * options (JSON): rotate (0/90/180/270), flipH, crop {x,y,w,h} as shares of the turned photo, whole (ignore the crop),
     * maxEdge (longest side of the result), quality (1-100), format ("webp" or "jpeg"), matrix (20 numbers),
     * vignette {strength 0-100, start, alpha}, withText, text [ {id,text,x,y,size,color,bg} ].
     */
    @ReactMethod
    public void render(String uriString, String optionsJson, Promise promise) {
        new Thread(() -> {
            Bitmap decoded = null;
            Bitmap result = null;
            try {
                Context context = getReactApplicationContext();
                Uri uri = Uri.parse(uriString);
                JSONObject o = new JSONObject(optionsJson);

                int rotate = ((o.optInt("rotate", 0) % 360) + 360) % 360;
                boolean flipH = o.optBoolean("flipH", false);
                boolean whole = o.optBoolean("whole", false);
                int maxEdge = Math.max(16, o.optInt("maxEdge", 1440));
                int quality = Math.min(100, Math.max(10, o.optInt("quality", 85)));
                boolean withText = o.optBoolean("withText", true);
                String format = o.optString("format", "webp");

                JSONObject cropJson = o.optJSONObject("crop");
                double cropX = 0, cropY = 0, cropW = 1, cropH = 1;
                if (cropJson != null && !whole) {
                    cropX = cropJson.optDouble("x", 0);
                    cropY = cropJson.optDouble("y", 0);
                    cropW = cropJson.optDouble("w", 1);
                    cropH = cropJson.optDouble("h", 1);
                }

                // sizes: raw file, after the camera's rotation, after our rotation
                int[] raw = rawSize(context, uri);
                int rawW = raw[0];
                int rawH = raw[1];
                if (rawW <= 0 || rawH <= 0) {
                    promise.reject("ERR_DECODE", "This file is not a picture that can be edited");
                    return;
                }
                int orientation = orientationOf(context, uri);
                boolean exifSwap = orientation == ExifInterface.ORIENTATION_ROTATE_90 || orientation == ExifInterface.ORIENTATION_ROTATE_270
                        || orientation == ExifInterface.ORIENTATION_TRANSPOSE || orientation == ExifInterface.ORIENTATION_TRANSVERSE;
                int baseW = exifSwap ? rawH : rawW;
                int baseH = exifSwap ? rawW : rawH;
                boolean turnSwap = rotate == 90 || rotate == 270;
                int turnedW = turnSwap ? baseH : baseW;
                int turnedH = turnSwap ? baseW : baseH;

                int cx = (int) Math.round(cropX * turnedW);
                int cy = (int) Math.round(cropY * turnedH);
                int cw = Math.max(1, (int) Math.round(cropW * turnedW));
                int ch = Math.max(1, (int) Math.round(cropH * turnedH));
                float scale = Math.min(1f, (float) maxEdge / (float) Math.max(cw, ch));
                int outW = Math.max(1, Math.round(cw * scale));
                int outH = Math.max(1, Math.round(ch * scale));

                // read the photo no bigger than needed
                int sample = 1;
                while (sample * 2 <= (int) (1f / scale)) sample *= 2;
                BitmapFactory.Options opts = new BitmapFactory.Options();
                opts.inSampleSize = sample;
                opts.inPreferredConfig = Bitmap.Config.ARGB_8888;
                InputStream is = context.getContentResolver().openInputStream(uri);
                if (is == null) {
                    promise.reject("ERR_OPEN", "Could not open the photo");
                    return;
                }
                decoded = BitmapFactory.decodeStream(is, null, opts);
                is.close();
                if (decoded == null) {
                    promise.reject("ERR_DECODE", "This file is not a picture that can be edited");
                    return;
                }

                // one transform: decoded pixels -> full-size photo -> camera rotation -> our turn and flip -> crop -> result size
                Matrix m = new Matrix();
                m.postScale((float) rawW / decoded.getWidth(), (float) rawH / decoded.getHeight());
                m.postTranslate(-rawW / 2f, -rawH / 2f);
                switch (orientation) {
                    case ExifInterface.ORIENTATION_FLIP_HORIZONTAL: m.postScale(-1, 1); break;
                    case ExifInterface.ORIENTATION_ROTATE_180: m.postRotate(180); break;
                    case ExifInterface.ORIENTATION_FLIP_VERTICAL: m.postRotate(180); m.postScale(-1, 1); break;
                    case ExifInterface.ORIENTATION_TRANSPOSE: m.postRotate(90); m.postScale(-1, 1); break;
                    case ExifInterface.ORIENTATION_ROTATE_90: m.postRotate(90); break;
                    case ExifInterface.ORIENTATION_TRANSVERSE: m.postRotate(-90); m.postScale(-1, 1); break;
                    case ExifInterface.ORIENTATION_ROTATE_270: m.postRotate(-90); break;
                    default: break;
                }
                if (rotate != 0) m.postRotate(rotate);
                if (flipH) m.postScale(-1, 1);
                m.postTranslate(turnedW / 2f, turnedH / 2f);
                m.postTranslate(-cx, -cy);
                m.postScale(scale, scale);

                result = Bitmap.createBitmap(outW, outH, Bitmap.Config.ARGB_8888);
                Canvas canvas = new Canvas(result);
                Paint paint = new Paint(Paint.FILTER_BITMAP_FLAG | Paint.ANTI_ALIAS_FLAG | Paint.DITHER_FLAG);

                // colour: the same 20 numbers as the web editor. Android takes the offsets on a 0..255 scale.
                JSONArray mx = o.optJSONArray("matrix");
                if (mx != null && mx.length() == 20) {
                    float[] f = new float[20];
                    for (int i = 0; i < 20; i++) f[i] = (float) mx.optDouble(i, i % 6 == 0 ? 1 : 0);
                    f[4] *= 255f;
                    f[9] *= 255f;
                    f[14] *= 255f;
                    f[19] *= 255f;
                    paint.setColorFilter(new ColorMatrixColorFilter(new ColorMatrix(f)));
                }
                canvas.drawBitmap(decoded, m, paint);
                decoded.recycle();
                decoded = null;

                // vignette
                JSONObject vig = o.optJSONObject("vignette");
                if (vig != null && vig.optDouble("strength", 0) > 0) {
                    float start = (float) vig.optDouble("start", 0.5);
                    int alpha = Math.min(255, Math.max(0, (int) Math.round(vig.optDouble("alpha", 0) * 255)));
                    float radius = (float) Math.hypot(outW, outH) / 2f;
                    Paint vp = new Paint(Paint.ANTI_ALIAS_FLAG);
                    vp.setShader(new RadialGradient(outW / 2f, outH / 2f, radius, new int[]{0x00000000, (alpha << 24)}, new float[]{start, 1f}, Shader.TileMode.CLAMP));
                    canvas.drawRect(0, 0, outW, outH, vp);
                }

                // text, last, so the colour change never touches it
                WritableArray boxes = Arguments.createArray();
                JSONArray text = o.optJSONArray("text");
                if (withText && text != null) {
                    for (int i = 0; i < text.length(); i++) {
                        JSONObject t = text.getJSONObject(i);
                        String body = t.optString("text", "");
                        if (body.trim().isEmpty()) continue;
                        float[] box = drawText(context.getAssets(), canvas, outW, outH, t, body);
                        WritableMap b = Arguments.createMap();
                        b.putString("id", t.optString("id", ""));
                        b.putDouble("x", box[0]);
                        b.putDouble("y", box[1]);
                        b.putDouble("w", box[2]);
                        b.putDouble("h", box[3]);
                        b.putDouble("cx", box[4]);
                        b.putDouble("cy", box[5]);
                        b.putDouble("rotate", box[6]);
                        boxes.pushMap(b);
                    }
                }

                // save: WebP where Android can write it well, JPEG otherwise
                File dir = new File(context.getCacheDir(), "cinecraft_media_cache");
                if (!dir.exists()) dir.mkdirs();
                boolean jpeg = "jpeg".equalsIgnoreCase(format);
                String ext = jpeg ? ".jpg" : ".webp";
                File out = new File(dir, "edit_" + System.currentTimeMillis() + "_" + (int) (Math.random() * 100000) + ext);
                Bitmap.CompressFormat cf = jpeg ? Bitmap.CompressFormat.JPEG
                        : (Build.VERSION.SDK_INT >= 30 ? Bitmap.CompressFormat.WEBP_LOSSY : Bitmap.CompressFormat.WEBP);
                FileOutputStream fos = new FileOutputStream(out);
                result.compress(cf, quality, fos);
                fos.flush();
                fos.close();

                WritableMap res = Arguments.createMap();
                res.putString("uri", "file://" + out.getAbsolutePath());
                res.putInt("width", outW);
                res.putInt("height", outH);
                res.putDouble("size", out.length());
                res.putString("mime", jpeg ? "image/jpeg" : "image/webp");
                res.putArray("boxes", boxes);
                promise.resolve(res);
            } catch (OutOfMemoryError oom) {
                promise.reject("ERR_MEMORY", "This photo is too big to edit on this phone");
            } catch (Throwable t) {
                promise.reject("ERR_RENDER", String.valueOf(t.getMessage()), t);
            } finally {
                if (decoded != null && !decoded.isRecycled()) decoded.recycle();
                if (result != null && !result.isRecycled()) result.recycle();
            }
        }).start();
    }

    // ── video: length, still frames for the trimmer, and a lossless cut ────────────────────────────────────────

    /** Length (ms), shown size, turn and whether it has sound. Rejects if the file is not a video this phone can read. */
    @ReactMethod
    public void videoInfo(String uriString, Promise promise) {
        new Thread(() -> {
            MediaMetadataRetriever mmr = new MediaMetadataRetriever();
            try {
                mmr.setDataSource(getReactApplicationContext(), Uri.parse(uriString));
                long durationMs = parseLong(mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION));
                int w = (int) parseLong(mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH));
                int h = (int) parseLong(mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT));
                int rotation = (int) parseLong(mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION));
                String audio = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_HAS_AUDIO);
                if (durationMs <= 0 || w <= 0 || h <= 0) {
                    promise.reject("ERR_VIDEO", "This file is not a video that can be edited");
                    return;
                }
                boolean swap = rotation == 90 || rotation == 270;
                WritableMap out = Arguments.createMap();
                out.putDouble("duration", durationMs);
                out.putInt("width", swap ? h : w);
                out.putInt("height", swap ? w : h);
                out.putBoolean("hasAudio", "yes".equals(audio));
                promise.resolve(out);
            } catch (Throwable t) {
                promise.reject("ERR_VIDEO", String.valueOf(t.getMessage()), t);
            } finally {
                try { mmr.release(); } catch (Throwable ignored) { }
            }
        }).start();
    }

    /** One still picture of the video at timeMs, no longer than maxEdge on its longest side, as a JPEG file. */
    @ReactMethod
    public void videoFrame(String uriString, double timeMs, int maxEdge, Promise promise) {
        new Thread(() -> {
            MediaMetadataRetriever mmr = new MediaMetadataRetriever();
            try {
                mmr.setDataSource(getReactApplicationContext(), Uri.parse(uriString));
                promise.resolve(saveFrame(mmr, (long) (timeMs * 1000), maxEdge));
            } catch (Throwable t) {
                promise.reject("ERR_VIDEO", String.valueOf(t.getMessage()), t);
            } finally {
                try { mmr.release(); } catch (Throwable ignored) { }
            }
        }).start();
    }

    /** `count` still pictures spread evenly over the video (for the strip under the trimmer). */
    @ReactMethod
    public void videoFrames(String uriString, int count, int maxEdge, Promise promise) {
        new Thread(() -> {
            MediaMetadataRetriever mmr = new MediaMetadataRetriever();
            try {
                mmr.setDataSource(getReactApplicationContext(), Uri.parse(uriString));
                long durationMs = parseLong(mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION));
                WritableArray out = Arguments.createArray();
                int n = Math.max(1, count);
                for (int i = 0; i < n; i++) {
                    long t = (long) ((i + 0.5) / n * durationMs * 1000);
                    out.pushString(saveFrame(mmr, t, maxEdge).getString("uri"));
                }
                promise.resolve(out);
            } catch (Throwable t) {
                promise.reject("ERR_VIDEO", String.valueOf(t.getMessage()), t);
            } finally {
                try { mmr.release(); } catch (Throwable ignored) { }
            }
        }).start();
    }

    /**
     * Keeps [startMs, endMs] of the video without re-encoding it (so nothing is lost and it is quick). The cut starts at
     * the nearest keyframe at or before startMs, so it can begin a moment early. With mute, the sound is left out.
     */
    @ReactMethod
    public void trimVideo(String uriString, double startMs, double endMs, boolean mute, Promise promise) {
        new Thread(() -> {
            MediaExtractor ex = new MediaExtractor();
            MediaMuxer muxer = null;
            boolean started = false;
            File out = null;
            try {
                Context context = getReactApplicationContext();
                Uri uri = Uri.parse(uriString);
                ex.setDataSource(context, uri, null);

                MediaMetadataRetriever mmr = new MediaMetadataRetriever();
                int rotation = 0;
                try {
                    mmr.setDataSource(context, uri);
                    rotation = (int) parseLong(mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION));
                } finally {
                    try { mmr.release(); } catch (Throwable ignored) { }
                }

                File dir = new File(context.getCacheDir(), "cinecraft_media_cache");
                if (!dir.exists()) dir.mkdirs();
                out = new File(dir, "edit_trim_" + System.currentTimeMillis() + "_" + (int) (Math.random() * 100000) + ".mp4");
                muxer = new MediaMuxer(out.getAbsolutePath(), MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
                if (rotation != 0) muxer.setOrientationHint(rotation);

                int tracks = ex.getTrackCount();
                int[] map = new int[tracks];
                int videoTrack = -1;
                for (int i = 0; i < tracks; i++) {
                    map[i] = -1;
                    MediaFormat fmt = ex.getTrackFormat(i);
                    String mime = fmt.getString(MediaFormat.KEY_MIME);
                    if (mime == null) continue;
                    if (mime.startsWith("video/") && videoTrack < 0) {
                        map[i] = muxer.addTrack(fmt);
                        ex.selectTrack(i);
                        videoTrack = i;
                    } else if (mime.startsWith("audio/") && !mute) {
                        map[i] = muxer.addTrack(fmt);
                        ex.selectTrack(i);
                    }
                }
                if (videoTrack < 0) {
                    promise.reject("ERR_VIDEO", "This file has no video to cut");
                    return;
                }
                muxer.start();
                started = true;

                long startUs = (long) (startMs * 1000);
                long endUs = (long) (endMs * 1000);
                ex.seekTo(startUs, MediaExtractor.SEEK_TO_PREVIOUS_SYNC);

                ByteBuffer buffer = ByteBuffer.allocate(4 * 1024 * 1024);
                MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
                long base = -1; // the time of the first picture kept, so the new video starts at 0
                while (true) {
                    buffer.clear();
                    int size = ex.readSampleData(buffer, 0);
                    if (size < 0) break;
                    long t = ex.getSampleTime();
                    int track = ex.getSampleTrackIndex();
                    if (t > endUs) break;
                    if (base < 0) {
                        // sound that comes before the first picture is dropped, so the two stay in step
                        if (track != videoTrack) { ex.advance(); continue; }
                        base = t;
                    }
                    if (map[track] >= 0) {
                        info.set(0, size, Math.max(0, t - base), ex.getSampleFlags());
                        muxer.writeSampleData(map[track], buffer, info);
                    }
                    ex.advance();
                }

                muxer.stop();
                started = false;
                WritableMap res = Arguments.createMap();
                res.putString("uri", "file://" + out.getAbsolutePath());
                res.putDouble("size", out.length());
                res.putString("mime", "video/mp4");
                promise.resolve(res);
            } catch (Throwable t) {
                if (out != null) out.delete();
                promise.reject("ERR_TRIM", String.valueOf(t.getMessage()), t);
            } finally {
                try { if (muxer != null) { if (started) muxer.stop(); muxer.release(); } } catch (Throwable ignored) { }
                try { ex.release(); } catch (Throwable ignored) { }
            }
        }).start();
    }

    /** Deletes a temporary picture made by render() (only files this module created, inside the app's cache). */
    @ReactMethod
    public void release(String uriString, Promise promise) {
        try {
            String path = Uri.parse(uriString).getPath();
            File dir = new File(getReactApplicationContext().getCacheDir(), "cinecraft_media_cache");
            if (path != null) {
                File file = new File(path);
                if (file.getParentFile() != null && file.getParentFile().equals(dir) && file.getName().startsWith("edit_")) {
                    file.delete();
                }
            }
            promise.resolve(true);
        } catch (Throwable t) {
            promise.resolve(false);
        }
    }

    private static long parseLong(String v) {
        try { return v == null ? 0 : Long.parseLong(v); } catch (Exception e) { return 0; }
    }

    /** Saves the frame at timeUs (shrunk to maxEdge) as a JPEG in the app cache and returns {uri, width, height}. */
    private WritableMap saveFrame(MediaMetadataRetriever mmr, long timeUs, int maxEdge) throws Exception {
        Bitmap frame = mmr.getFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST_SYNC);
        if (frame == null) throw new Exception("No picture at this time");
        try {
            int longest = Math.max(frame.getWidth(), frame.getHeight());
            Bitmap shown = frame;
            if (maxEdge > 0 && longest > maxEdge) {
                float k = (float) maxEdge / longest;
                shown = Bitmap.createScaledBitmap(frame, Math.max(1, Math.round(frame.getWidth() * k)), Math.max(1, Math.round(frame.getHeight() * k)), true);
            }
            File dir = new File(getReactApplicationContext().getCacheDir(), "cinecraft_media_cache");
            if (!dir.exists()) dir.mkdirs();
            File file = new File(dir, "edit_frame_" + System.currentTimeMillis() + "_" + (int) (Math.random() * 100000) + ".jpg");
            FileOutputStream fos = new FileOutputStream(file);
            shown.compress(Bitmap.CompressFormat.JPEG, 80, fos);
            fos.flush();
            fos.close();
            WritableMap res = Arguments.createMap();
            res.putString("uri", "file://" + file.getAbsolutePath());
            res.putInt("width", shown.getWidth());
            res.putInt("height", shown.getHeight());
            if (shown != frame) shown.recycle();
            return res;
        } finally {
            frame.recycle();
        }
    }

    // ── helpers ──────────────────────────────────────────────────────────────────────────────────────────────────

    private static int[] rawSize(Context context, Uri uri) {
        try {
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            InputStream is = context.getContentResolver().openInputStream(uri);
            if (is == null) return new int[]{0, 0};
            BitmapFactory.decodeStream(is, null, bounds);
            is.close();
            return new int[]{bounds.outWidth, bounds.outHeight};
        } catch (Exception e) {
            return new int[]{0, 0};
        }
    }

    private static int orientationOf(Context context, Uri uri) {
        try {
            InputStream is = context.getContentResolver().openInputStream(uri);
            if (is == null) return ExifInterface.ORIENTATION_NORMAL;
            ExifInterface exif = new ExifInterface(is);
            int o = exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
            is.close();
            return o;
        } catch (Exception e) {
            return ExifInterface.ORIENTATION_NORMAL;
        }
    }

    /** "#RRGGBB", "#RRGGBBAA" or "rgba(r,g,b,a)" as an Android colour; transparent when it cannot be read. */
    private static int parseColor(String c, int fallback) {
        if (c == null || c.isEmpty() || "transparent".equals(c)) return 0x00000000;
        try {
            if (c.startsWith("rgba")) {
                String[] p = c.substring(c.indexOf('(') + 1, c.indexOf(')')).split(",");
                int r = Integer.parseInt(p[0].trim());
                int g = Integer.parseInt(p[1].trim());
                int b = Integer.parseInt(p[2].trim());
                int a = Math.round(Float.parseFloat(p[3].trim()) * 255f);
                return (a << 24) | (r << 16) | (g << 8) | b;
            }
            if (c.startsWith("#") && c.length() == 9) {
                int rgb = (int) Long.parseLong(c.substring(1, 7), 16);
                int a = Integer.parseInt(c.substring(7, 9), 16);
                return (a << 24) | rgb;
            }
            return android.graphics.Color.parseColor(c);
        } catch (Exception e) {
            return fallback;
        }
    }

    private static double luminance(int color) {
        double r = ((color >> 16) & 255) / 255.0;
        double g = ((color >> 8) & 255) / 255.0;
        double b = (color & 255) / 255.0;
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    /** The font files bundled with the app (android/app/src/main/assets/fonts), by the type-style id used in the edit. */
    private static String fontFile(String font) {
        switch (font) {
            case "lora": return "Lora-Regular.ttf";
            case "loraMedium": return "Lora-Medium.ttf";
            case "loraBold": return "Lora-Bold.ttf";
            case "worksans": return "WorkSans-Regular.ttf";
            case "workMedium": return "WorkSans-Medium.ttf";
            case "workSemi": return "WorkSans-SemiBold.ttf";
            case "workBold": return "WorkSans-Bold.ttf";
            case "workExtra": return "WorkSans-ExtraBold.ttf";
            case "mono": return "Inconsolata-Regular.ttf";
            case "monoBold": return "Inconsolata-Bold.ttf";
            default: return null;
        }
    }

    private static final java.util.HashMap<String, Typeface> FACES = new java.util.HashMap<>();

    private static synchronized Typeface faceFor(android.content.res.AssetManager assets, String font) {
        String file = fontFile(font);
        if (file == null) return typefaceFor(font);
        Typeface cached = FACES.get(file);
        if (cached != null) return cached;
        try {
            Typeface tf = Typeface.createFromAsset(assets, "fonts/" + file);
            FACES.put(file, tf);
            return tf;
        } catch (Throwable e) {
            return typefaceFor("modern");
        }
    }

    private static Typeface typefaceFor(String font) {
        switch (font) {
            case "classic": return Typeface.create(Typeface.SERIF, Typeface.BOLD);
            case "typewriter": return Typeface.create(Typeface.MONOSPACE, Typeface.NORMAL);
            case "bold": return Typeface.create("sans-serif-black", Typeface.NORMAL);
            case "italic": return Typeface.create(Typeface.SERIF, Typeface.ITALIC);
            case "neon": return Typeface.create("sans-serif-medium", Typeface.NORMAL);
            default: return Typeface.create("sans-serif", Typeface.BOLD);
        }
    }

    /**
     * Draws one text layer (same layout rules as the web renderer): type style, alignment, a box or a band behind it,
     * outline, shadow and a turn around its centre. Returns x, y, width, height (before turning), then the centre and the turn.
     */
    private static float[] drawText(android.content.res.AssetManager assets, Canvas canvas, int outW, int outH, JSONObject t, String bodyIn) {
        String font = t.optString("font", "modern");
        String align = t.optString("align", "center");
        String backdrop = t.optString("backdrop", "none");
        float rotate = (float) t.optDouble("rotate", 0);
        boolean outline = t.optBoolean("outline", false);
        boolean shadow = t.optBoolean("shadow", true);
        boolean boldFlag = t.optBoolean("bold", false);
        boolean italicFlag = t.optBoolean("italic", false);
        float letterSpacing = (float) t.optDouble("letterSpacing", 0) / 100f;      // em
        float lineHeight = (float) t.optDouble("lineHeight", 1.25);
        int opacity = Math.min(100, Math.max(5, (int) Math.round(t.optDouble("opacity", 100))));
        float strokeWidth = (float) t.optDouble("strokeWidth", 14) / 100f;
        String strokeColor = t.optString("strokeColor", "");
        String shadowColorStr = t.optString("shadowColor", "");
        float shadowBlur = (float) t.optDouble("shadowBlur", 18) / 100f;
        String body = "bold".equals(font) ? bodyIn.toUpperCase() : bodyIn;

        float fontPx = Math.max(10f, outW * (float) t.optDouble("size", 8) / 100f);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        Typeface face = faceFor(assets, font);
        int style = (boldFlag ? Typeface.BOLD : 0) | (italicFlag ? Typeface.ITALIC : 0);
        if (style != 0) face = Typeface.create(face, style);
        p.setTypeface(face);
        p.setLetterSpacing(letterSpacing);
        p.setTextSize(fontPx);
        p.setTextAlign(Paint.Align.LEFT);

        // wrap at 85% of the picture width
        float maxWidth = outW * 0.85f;
        List<String> lines = new ArrayList<>();
        for (String para : body.split("\n", -1)) {
            String[] words = para.split(" ", -1);
            StringBuilder line = new StringBuilder();
            for (String w : words) {
                String test = line.length() > 0 ? line + " " + w : w;
                if (line.length() > 0 && p.measureText(test) > maxWidth) {
                    lines.add(line.toString());
                    line = new StringBuilder(w);
                } else {
                    line = new StringBuilder(test);
                }
            }
            lines.add(line.toString());
        }
        float lineH = fontPx * Math.max(0.6f, lineHeight);
        float textW = 0;
        for (String l : lines) textW = Math.max(textW, p.measureText(l));
        float padX = fontPx * 0.5f;
        float padY = fontPx * 0.3f;
        float boxW = textW + padX * 2;
        float boxH = (lines.size() - 1) * lineH + fontPx * 1.2f + padY * 2;
        float cx = (float) (t.optDouble("x", 50) / 100.0) * outW;
        float cy = (float) (t.optDouble("y", 50) / 100.0) * outH;

        int color = parseColor(t.optString("color", "#FFFFFF"), 0xFFFFFFFF);
        int bg = parseColor(t.optString("bg", "rgba(0,0,0,0.6)"), 0x99000000);
        Paint.FontMetrics fm = p.getFontMetrics();
        float baselineShift = -(fm.ascent + fm.descent) / 2f;

        canvas.save();
        canvas.translate(cx, cy);
        canvas.rotate(rotate);
        // the whole layer (box, outline, shadow and letters) fades together
        if (opacity < 100) canvas.saveLayerAlpha(new RectF(-outW * 2f, -outH * 2f, outW * 2f, outH * 2f), Math.round(opacity * 2.55f));

        float bgRadius = fontPx * (float) t.optDouble("bgRadius", "highlight".equals(backdrop) ? 22 : 30) / 100f;
        Paint bp = new Paint(Paint.ANTI_ALIAS_FLAG);
        bp.setColor(bg);
        if ("box".equals(backdrop)) {
            canvas.drawRoundRect(new RectF(-boxW / 2, -boxH / 2, boxW / 2, boxH / 2), bgRadius, bgRadius, bp);
        } else if ("highlight".equals(backdrop)) {
            for (int i = 0; i < lines.size(); i++) {
                float w = p.measureText(lines.get(i));
                float x = lineStart(align, textW, w);
                float yMid = -((lines.size() - 1) * lineH) / 2f + i * lineH;
                canvas.drawRoundRect(new RectF(x - padX, yMid - lineH / 2f + fontPx * 0.04f, x + w + padX, yMid + lineH / 2f + fontPx * 0.04f), bgRadius, bgRadius, bp);
            }
        }

        for (int i = 0; i < lines.size(); i++) {
            String l = lines.get(i);
            float x = lineStart(align, textW, p.measureText(l));
            float y = -((lines.size() - 1) * lineH) / 2f + i * lineH + baselineShift;
            if ("neon".equals(font)) {
                // a glow of the text's own colour, then the letters on top
                p.setStyle(Paint.Style.FILL);
                p.setColor(color);
                int glow = shadowColorStr.isEmpty() ? color : parseColor(shadowColorStr, color);
                p.setShadowLayer(fontPx * 0.6f, 0, 0, glow);
                canvas.drawText(l, x, y, p);
                p.setShadowLayer(fontPx * 0.25f, 0, 0, glow);
                canvas.drawText(l, x, y, p);
                p.clearShadowLayer();
                continue;
            }
            if (outline) {
                p.setStyle(Paint.Style.STROKE);
                p.setStrokeJoin(Paint.Join.ROUND);
                p.setStrokeWidth(fontPx * strokeWidth);
                p.setColor(strokeColor.isEmpty() ? (luminance(color) > 0.55 ? 0xFF000000 : 0xFFFFFFFF) : parseColor(strokeColor, 0xFF000000));
                p.clearShadowLayer();
                canvas.drawText(l, x, y, p);
            }
            p.setStyle(Paint.Style.FILL);
            p.setColor(color);
            if (shadow) p.setShadowLayer(Math.max(0.01f, fontPx * shadowBlur), 0, fontPx * 0.04f, shadowColorStr.isEmpty() ? 0xA6000000 : parseColor(shadowColorStr, 0xA6000000));
            else p.clearShadowLayer();
            canvas.drawText(l, x, y, p);
            p.clearShadowLayer();
        }
        if (opacity < 100) canvas.restore();
        canvas.restore();
        return new float[]{cx - boxW / 2, cy - boxH / 2, boxW, boxH, cx, cy, rotate};
    }

    /** Where a line starts, inside the block that is centred on (0, 0). */
    private static float lineStart(String align, float blockW, float lineW) {
        if ("left".equals(align)) return -blockW / 2f;
        if ("right".equals(align)) return blockW / 2f - lineW;
        return -lineW / 2f;
    }
}
