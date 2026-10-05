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
                PictureInPictureParams.Builder builder = new PictureInPictureParams.Builder();
                builder.setAspectRatio(aspectRatio);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    builder.setAutoEnterEnabled(true);
                    builder.setSeamlessResizeEnabled(true);
                }
                boolean success = activity.enterPictureInPictureMode(builder.build());
                promise.resolve(success);
            } else {
                promise.reject("UNSUPPORTED", "PiP is only supported on Android 8.0 and above");
            }
        } catch (Exception e) {
            promise.reject("PIP_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void setAutoPipEnabled(boolean enabled) {
        try {
            MainActivity.setAutoPipEnabled(enabled);
            Activity activity = getCurrentActivity();
            if (activity != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                PictureInPictureParams.Builder builder = new PictureInPictureParams.Builder();
                builder.setAspectRatio(new Rational(4, 5));
                builder.setAutoEnterEnabled(enabled);
                builder.setSeamlessResizeEnabled(true);
                activity.setPictureInPictureParams(builder.build());
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
