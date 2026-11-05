package com.cinecraftconnect.app;

import android.app.Activity;
import android.app.PictureInPictureParams;
import android.os.Build;
import android.util.Rational;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class PipBridgeModule extends ReactContextBaseJavaModule {
    private static final String MODULE_NAME = "PipBridge";

    public PipBridgeModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    /** True while the phone is locked (the call screen may be showing over the lock screen). */
    @ReactMethod
    public void isDeviceLocked(Promise promise) {
        try {
            Activity activity = getCurrentActivity();
            android.app.KeyguardManager km = (android.app.KeyguardManager) getReactApplicationContext().getSystemService(android.content.Context.KEYGUARD_SERVICE);
            promise.resolve(km != null && km.isKeyguardLocked());
        } catch (Exception e) {
            promise.resolve(false);
        }
    }

    /** Sends the app to the background (back to the lock screen) without showing any of its screens. */
    @ReactMethod
    public void moveToBackground() {
        try {
            Activity activity = getCurrentActivity();
            if (activity != null) activity.moveTaskToBack(true);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @ReactMethod
    public void isPipSupported(Promise promise) {
        try {
            boolean supported = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O;
            promise.resolve(supported);
        } catch (Exception e) {
            promise.resolve(false);
        }
    }

    @ReactMethod
    public void enterPipMode(int width, int height, Promise promise) {
        try {
            Activity activity = getCurrentActivity();
            if (activity == null) {
                promise.reject("ACTIVITY_NULL", "Current activity is null");
                return;
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                int w = width > 0 ? width : 4;
                int h = height > 0 ? height : 5;
                Rational aspectRatio = new Rational(w, h);
                PictureInPictureParams.Builder builder = MainActivity.pipBuilder(activity, true);
                builder.setAspectRatio(aspectRatio);
                boolean success = activity.enterPictureInPictureMode(builder.build());
                promise.resolve(success);
            } else {
                promise.reject("UNSUPPORTED", "PiP is only supported on Android 8.0 and above");
            }
        } catch (Exception e) {
            promise.reject("PIP_ERROR", e.getMessage());
        }
    }

    /** Keeps the mute / speaker buttons of the PiP window in step with the call. */
    @ReactMethod
    public void setPipCallState(boolean muted, boolean speakerOn) {
        try {
            MainActivity.setPipCallState(muted, speakerOn);
            Activity activity = getCurrentActivity();
            if (activity != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                activity.setPictureInPictureParams(MainActivity.pipBuilder(activity, MainActivity.isAutoPip()).build());
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @ReactMethod
    public void setAutoPipEnabled(boolean enabled) {
        try {
            MainActivity.setAutoPipEnabled(enabled);
            Activity activity = getCurrentActivity();
            if (activity != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                activity.setPictureInPictureParams(MainActivity.pipBuilder(activity, enabled).build());
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
