package com.cinecraftconnect.app;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Locale;

/**
 * Downloads a profile picture for a notification. The address comes from another user's profile, so it is treated as
 * untrusted: only https links to known picture hosts, no redirects, a small size limit, and the image is decoded at a
 * reduced size so an oversized picture cannot exhaust memory.
 */
final class SafeAvatar {
    private static final int MAX_BYTES = 2 * 1024 * 1024; // 2 MB
    private static final int TARGET_PX = 192;
    // Where profile pictures live: the project's Supabase storage and Google account pictures.
    private static final String[] ALLOWED_HOST_SUFFIXES = {
            ".supabase.co",
            ".supabase.in",
            ".googleusercontent.com",
    };

    private SafeAvatar() {}

    static boolean isAllowed(String raw) {
        try {
            URL url = new URL(raw.trim());
            if (!"https".equalsIgnoreCase(url.getProtocol())) return false;
            if (url.getUserInfo() != null) return false;
            int port = url.getPort();
            if (port != -1 && port != 443) return false;
            String host = url.getHost() == null ? "" : url.getHost().toLowerCase(Locale.ROOT);
            for (String suffix : ALLOWED_HOST_SUFFIXES) {
                if (host.endsWith(suffix)) return true;
            }
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    /** Returns a bitmap no larger than about 192 px on its long side, or null when the link is not acceptable. */
    static Bitmap fetch(String raw) {
        if (raw == null || raw.trim().isEmpty() || !isAllowed(raw)) return null;
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(raw.trim()).openConnection();
            conn.setConnectTimeout(6000);
            conn.setReadTimeout(6000);
            conn.setInstanceFollowRedirects(false); // a redirect could lead somewhere that was never checked
            conn.setRequestProperty("User-Agent", "CineCraftConnect/1.0");
            conn.setDoInput(true);
            conn.connect();
            if (conn.getResponseCode() != HttpURLConnection.HTTP_OK) return null;
            long declared = conn.getContentLengthLong();
            if (declared > MAX_BYTES) return null;

            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            try (InputStream in = conn.getInputStream()) {
                byte[] chunk = new byte[8192];
                int total = 0;
                int read;
                while ((read = in.read(chunk)) != -1) {
                    total += read;
                    if (total > MAX_BYTES) return null;
                    buffer.write(chunk, 0, read);
                }
            }
            byte[] data = buffer.toByteArray();

            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(data, 0, data.length, bounds);
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null;

            int sample = 1;
            while ((bounds.outWidth / (sample * 2)) >= TARGET_PX && (bounds.outHeight / (sample * 2)) >= TARGET_PX) {
                sample *= 2;
            }
            BitmapFactory.Options decode = new BitmapFactory.Options();
            decode.inSampleSize = sample;
            return BitmapFactory.decodeByteArray(data, 0, data.length, decode);
        } catch (Throwable ignored) {
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }
}
