package com.cinecraftconnect.app;

import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class CallServiceModule extends ReactContextBaseJavaModule {
    private ToneGenerator tone;
    private String toneKind = "";
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private synchronized void releaseTone() {
        mainHandler.removeCallbacksAndMessages(null);
        if (tone != null) {
            try {
                tone.stopTone();
                tone.release();
            } catch (Exception ignored) {
            }
            tone = null;
        }
    }

    /** Plays a built-in telephony tone on the voice-call stream so it follows the earpiece/speaker route. */
    private synchronized void playTone(String kind, int toneType, int durationMs) {
        releaseTone();
        toneKind = kind;
        try {
            tone = new ToneGenerator(AudioManager.STREAM_VOICE_CALL, 80);
            tone.startTone(toneType, durationMs);
            if (durationMs > 0) {
                mainHandler.postDelayed(this::releaseTone, durationMs + 200L);
            }
        } catch (Exception e) {
            tone = null;
        }
    }

    @ReactMethod
    public void startRingback(Promise promise) {
        // -1 = until stopped. TONE_SUP_RINGTONE is the standard "ringing…" ringback pattern.
        playTone("ringback", ToneGenerator.TONE_SUP_RINGTONE, -1);
        promise.resolve(true);
    }

    @ReactMethod
    public void stopRingback(Promise promise) {
        // Only stop the ringback; a busy tone that just started must be allowed to finish.
        if ("ringback".equals(toneKind)) releaseTone();
        promise.resolve(true);
    }

    @ReactMethod
    public void playBusy(Promise promise) {
        playTone("busy", ToneGenerator.TONE_SUP_BUSY, 2000);
        promise.resolve(true);
    }

    public CallServiceModule(ReactApplicationContext context) {
        super(context);
    }

    @NonNull
    @Override
    public String getName() {
        return "CallService";
    }

    @ReactMethod
    public void start(String title, boolean withMic, Promise promise) {
        try {
            Context ctx = getReactApplicationContext();
            Intent intent = new Intent(ctx, CallForegroundService.class);
            intent.setAction(CallForegroundService.ACTION_START);
            intent.putExtra(CallForegroundService.EXTRA_TITLE, title);
            intent.putExtra(CallForegroundService.EXTRA_WITH_MIC, withMic);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ctx.startForegroundService(intent);
            } else {
                ctx.startService(intent);
            }
            promise.resolve(true);
        } catch (Exception e) {
            promise.resolve(false);
        }
    }

    @ReactMethod
    public void stop(Promise promise) {
        try {
            Context ctx = getReactApplicationContext();
            Intent intent = new Intent(ctx, CallForegroundService.class);
            intent.setAction(CallForegroundService.ACTION_STOP);
            ctx.startService(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.resolve(false);
        }
    }
}
