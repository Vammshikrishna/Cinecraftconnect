package com.cinecraftconnect.app;

import com.facebook.react.ReactActivity;
import com.facebook.react.ReactActivityDelegate;
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint;
import com.facebook.react.defaults.DefaultReactActivityDelegate;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import android.app.PictureInPictureParams;
import android.content.Intent;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.util.Rational;

public class MainActivity extends ReactActivity {

  private static boolean isAutoPipEnabled = false;

  public static void setAutoPipEnabled(boolean enabled) {
    isAutoPipEnabled = enabled;
  }

  @Override
  protected String getMainComponentName() {
    return "CineCraftConnect";
  }

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(null);
  }

  @Override
  public void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
  }

  @Override
  public void onUserLeaveHint() {
    super.onUserLeaveHint();
    if (isAutoPipEnabled && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      try {
        PictureInPictureParams.Builder builder = new PictureInPictureParams.Builder();
        builder.setAspectRatio(new Rational(4, 5));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          builder.setAutoEnterEnabled(true);
          builder.setSeamlessResizeEnabled(true);
        }
        enterPictureInPictureMode(builder.build());
      } catch (Exception e) {
        e.printStackTrace();
      }
    }
  }

  @Override
  public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode, Configuration newConfig) {
    super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);
    emitPipModeChanged(isInPictureInPictureMode);
  }

  @Override
  public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode) {
    super.onPictureInPictureModeChanged(isInPictureInPictureMode);
    emitPipModeChanged(isInPictureInPictureMode);
  }

  private void emitPipModeChanged(boolean isInPictureInPictureMode) {
    try {
      if (getReactNativeHost() != null && getReactNativeHost().getReactInstanceManager() != null) {
        com.facebook.react.bridge.ReactContext reactContext = 
            getReactNativeHost().getReactInstanceManager().getCurrentReactContext();
        if (reactContext != null) {
          reactContext
              .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
              .emit("onPictureInPictureModeChanged", isInPictureInPictureMode);
        }
      }
    } catch (Exception e) {
      e.printStackTrace();
    }
  }

  @Override
  protected ReactActivityDelegate createReactActivityDelegate() {
    return new DefaultReactActivityDelegate(
        this,
        getMainComponentName(),
        DefaultNewArchitectureEntryPoint.getFabricEnabled());
  }
}
