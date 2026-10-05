package com.cinecraftconnect.app;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.net.Uri;
import androidx.exifinterface.media.ExifInterface;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;

public class ImageCompressorModule extends ReactContextBaseJavaModule {
    private static final String MODULE_NAME = "ImageCompressor";

    public ImageCompressorModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void compress(String uriString, ReadableMap options, Promise promise) {
        new Thread(() -> {
            try {
                Context context = getReactApplicationContext();
                Uri uri = Uri.parse(uriString);

                int maxDimension = options != null && options.hasKey("maxWidth") ? options.getInt("maxWidth") : 1280;
                int quality = options != null && options.hasKey("quality") ? options.getInt("quality") : 75;
                if (quality < 10) quality = 10;
                if (quality > 100) quality = 100;

                // Step 1: Decode bounds to calculate sample size
                BitmapFactory.Options boundsOptions = new BitmapFactory.Options();
                boundsOptions.inJustDecodeBounds = true;

                InputStream isBounds = context.getContentResolver().openInputStream(uri);
                if (isBounds == null) {
                    promise.reject("ERR_OPEN_STREAM", "Could not open stream for uri: " + uriString);
                    return;
                }
                BitmapFactory.decodeStream(isBounds, null, boundsOptions);
                isBounds.close();

                int origWidth = boundsOptions.outWidth;
                int origHeight = boundsOptions.outHeight;

                if (origWidth <= 0 || origHeight <= 0) {
                    // Cannot decode as bitmap, return original
                    WritableMap fallback = Arguments.createMap();
                    fallback.putString("uri", uriString);
                    fallback.putInt("width", 0);
                    fallback.putInt("height", 0);
                    fallback.putDouble("size", 0);
                    promise.resolve(fallback);
                    return;
                }

                // Step 2: Compute inSampleSize (power of 2)
                int inSampleSize = 1;
                int longest = Math.max(origWidth, origHeight);
                while (longest / (inSampleSize * 2) >= maxDimension) {
                    inSampleSize *= 2;
                }

                BitmapFactory.Options decodeOptions = new BitmapFactory.Options();
                decodeOptions.inSampleSize = inSampleSize;
                decodeOptions.inPreferredConfig = Bitmap.Config.RGB_565; // Saves 50% RAM compared to ARGB_8888

                InputStream isBitmap = context.getContentResolver().openInputStream(uri);
                Bitmap bitmap = BitmapFactory.decodeStream(isBitmap, null, decodeOptions);
                if (isBitmap != null) isBitmap.close();

                if (bitmap == null) {
                    WritableMap fallback = Arguments.createMap();
                    fallback.putString("uri", uriString);
                    fallback.putInt("width", origWidth);
                    fallback.putInt("height", origHeight);
                    promise.resolve(fallback);
                    return;
                }

                // Step 3: Check EXIF orientation
                int rotationDegrees = 0;
                try {
                    InputStream isExif = context.getContentResolver().openInputStream(uri);
                    if (isExif != null) {
                        ExifInterface exif = new ExifInterface(isExif);
                        int orientation = exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
                        isExif.close();

                        if (orientation == ExifInterface.ORIENTATION_ROTATE_90) {
                            rotationDegrees = 90;
                        } else if (orientation == ExifInterface.ORIENTATION_ROTATE_180) {
                            rotationDegrees = 180;
                        } else if (orientation == ExifInterface.ORIENTATION_ROTATE_270) {
                            rotationDegrees = 270;
                        }
                    }
                } catch (Exception ignored) {}

                // Step 4: Scale accurately if still larger than maxDimension, and apply EXIF rotation
                int curWidth = bitmap.getWidth();
                int curHeight = bitmap.getHeight();
                float scale = 1.0f;
                int curLongest = Math.max(curWidth, curHeight);
                if (curLongest > maxDimension) {
                    scale = (float) maxDimension / (float) curLongest;
                }

                Matrix matrix = new Matrix();
                if (scale < 1.0f) {
                    matrix.postScale(scale, scale);
                }
                if (rotationDegrees != 0) {
                    matrix.postRotate(rotationDegrees);
                }

                Bitmap finalBitmap = bitmap;
                if (scale < 1.0f || rotationDegrees != 0) {
                    finalBitmap = Bitmap.createBitmap(bitmap, 0, 0, curWidth, curHeight, matrix, true);
                    if (finalBitmap != bitmap) {
                        bitmap.recycle();
                    }
                }

                // Step 5: Save compressed JPEG to cache directory
                File cacheDir = new File(context.getCacheDir(), "cinecraft_media_cache");
                if (!cacheDir.exists()) {
                    cacheDir.mkdirs();
                }

                File outFile = new File(cacheDir, "comp_" + System.currentTimeMillis() + "_" + (int)(Math.random() * 1000) + ".jpg");
                FileOutputStream fos = new FileOutputStream(outFile);
                finalBitmap.compress(Bitmap.CompressFormat.JPEG, quality, fos);
                fos.flush();
                fos.close();
                finalBitmap.recycle();

                WritableMap result = Arguments.createMap();
                result.putString("uri", "file://" + outFile.getAbsolutePath());
                result.putInt("width", finalBitmap.getWidth());
                result.putInt("height", finalBitmap.getHeight());
                result.putDouble("size", outFile.length());
                promise.resolve(result);

            } catch (Exception e) {
                // On any unexpected error, fallback safely to original URI
                WritableMap fallback = Arguments.createMap();
                fallback.putString("uri", uriString);
                promise.resolve(fallback);
            }
        }).start();
    }
}
