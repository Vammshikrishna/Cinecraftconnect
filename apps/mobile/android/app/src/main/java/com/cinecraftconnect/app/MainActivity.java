package com.cinecraftconnect.app;

import com.facebook.react.ReactActivity;
import com.facebook.react.ReactActivityDelegate;
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint;
import com.facebook.react.defaults.DefaultReactActivityDelegate;
import expo.modules.ReactActivityDelegateWrapper;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import android.app.KeyguardManager;
import android.app.PendingIntent;
import android.app.PictureInPictureParams;
import android.app.RemoteAction;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.drawable.Icon;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.util.Rational;

import java.util.ArrayList;
import java.util.List;

public class MainActivity extends ReactActivity {

  private static boolean isAutoPipEnabled = false;

  public static void setAutoPipEnabled(boolean enabled) {
    isAutoPipEnabled = enabled;
  }

  // ── Android does not deliver touches to the app while it is in the small Picture-in-Picture window; the only
  //    controls it allows are these system-drawn actions (mute, speaker, end), which come back as a broadcast. ──
  private static final String PIP_ACTION = "com.cinecraftconnect.app.PIP_ACTION";
  private static boolean pipMuted = false;
  private static boolean pipSpeakerOn = false;
  private BroadcastReceiver pipReceiver;

  public static boolean isAutoPip() {
    return isAutoPipEnabled;
  }

  public static void setPipCallState(boolean muted, boolean speakerOn) {
    pipMuted = muted;
    pipSpeakerOn = speakerOn;
  }

  private static RemoteAction pipAction(Context ctx, int code, String action, int iconRes, String title) {
    Intent intent = new Intent(PIP_ACTION).setPackage(ctx.getPackageName()).putExtra("action", action);
    PendingIntent pi = PendingIntent.getBroadcast(ctx, code, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    return new RemoteAction(Icon.createWithResource(ctx, iconRes), title, title, pi);
  }

  /** Mute / speaker / end call buttons for the PiP window. */
  public static List<RemoteAction> pipActions(Context ctx) {
    List<RemoteAction> list = new ArrayList<>();
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return list;
    list.add(pipAction(ctx, 1, "mute", pipMuted ? R.drawable.ic_pip_mic_off : R.drawable.ic_pip_mic, pipMuted ? "Unmute" : "Mute"));
    list.add(pipAction(ctx, 2, "speaker", pipSpeakerOn ? R.drawable.ic_pip_volume_up : R.drawable.ic_pip_volume_off, pipSpeakerOn ? "Speaker off" : "Speaker on"));
    list.add(pipAction(ctx, 3, "end", R.drawable.ic_pip_call_end, "End call"));
    return list;
  }

  /** PiP parameters with the call actions; used everywhere the app enters or prepares PiP. */
  public static PictureInPictureParams.Builder pipBuilder(Context ctx, boolean autoEnter) {
    PictureInPictureParams.Builder builder = new PictureInPictureParams.Builder();
    builder.setAspectRatio(new Rational(16, 9));
    builder.setActions(pipActions(ctx));
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      builder.setAutoEnterEnabled(autoEnter);
      builder.setSeamlessResizeEnabled(true);
    }
    return builder;
  }

  private void registerPipReceiver() {
    if (pipReceiver != null) return;
    pipReceiver = new BroadcastReceiver() {
      @Override
      public void onReceive(Context context, Intent intent) {
        String action = intent == null ? null : intent.getStringExtra("action");
        if (action == null) return;
        try {
          if (getReactNativeHost() != null && getReactNativeHost().getReactInstanceManager() != null) {
            com.facebook.react.bridge.ReactContext rc = getReactNativeHost().getReactInstanceManager().getCurrentReactContext();
            if (rc != null) {
              rc.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit("onPipAction", action);
            }
          }
        } catch (Exception e) {
          e.printStackTrace();
        }
      }
    };
    IntentFilter filter = new IntentFilter(PIP_ACTION);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      registerReceiver(pipReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
    } else {
      registerReceiver(pipReceiver, filter);
    }
  }

  private void unregisterPipReceiver() {
    if (pipReceiver == null) return;
    try {
      unregisterReceiver(pipReceiver);
    } catch (Exception ignored) {
      // already gone
    }
    pipReceiver = null;
  }

  @Override
  protected void onDestroy() {
    unregisterPipReceiver();
    unregisterUnlockReceiver();
    super.onDestroy();
  }

  // ── Lock screen: an answered call may be shown over the lock screen, but only the call, and only until the user leaves
  //    it or unlocks. The activity must never stay "show when locked" afterwards, or the whole app would be readable
  //    from the lock screen. ──
  public boolean isKeyguardLocked() {
    try {
      KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
      return km != null && km.isKeyguardLocked();
    } catch (Exception e) {
      return false;
    }
  }

  private void stopShowingOverLockScreen() {
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
        setShowWhenLocked(false);
        setTurnScreenOn(false);
      } else {
        getWindow().clearFlags(
            android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
      }
    } catch (Exception ignored) {
      // best effort
    }
  }

  private BroadcastReceiver unlockReceiver;

  private void registerUnlockReceiver() {
    if (unlockReceiver != null) return;
    unlockReceiver = new BroadcastReceiver() {
      @Override
      public void onReceive(Context context, Intent intent) {
        // the owner unlocked the phone: no longer show over the lock screen, and tell the app the call may leave the call screen
        stopShowingOverLockScreen();
        try {
          if (getReactNativeHost() != null && getReactNativeHost().getReactInstanceManager() != null) {
            com.facebook.react.bridge.ReactContext rc = getReactNativeHost().getReactInstanceManager().getCurrentReactContext();
            if (rc != null) {
              rc.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class).emit("onDeviceUnlocked", true);
            }
          }
        } catch (Exception e) {
          e.printStackTrace();
        }
      }
    };
    registerReceiver(unlockReceiver, new IntentFilter(Intent.ACTION_USER_PRESENT));
  }

  private void unregisterUnlockReceiver() {
    if (unlockReceiver == null) return;
    try {
      unregisterReceiver(unlockReceiver);
    } catch (Exception ignored) {
      // already gone
    }
    unlockReceiver = null;
  }

  @Override
  protected void onStop() {
    // Home / power / another app: stop showing over the lock screen (the call itself keeps running in its service)
    if (isKeyguardLocked()) stopShowingOverLockScreen();
    super.onStop();
  }

  @Override
  protected String getMainComponentName() {
    return "CineCraftConnect";
  }

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(null);
    registerUnlockReceiver();
    allowOverLockScreenForCalls(getIntent());
  }

  /**
   * True only for an incoming-call intent made by this app's own notification. This activity is exported, so another
   * app could send "incomingCall" / "callAction=accept"; such an intent has the call instructions removed.
   */
  private boolean isOwnCallIntent(Intent intent) {
    if (intent == null || !intent.getBooleanExtra("incomingCall", false)) return false;
    if (CallIntentGuard.isTrusted(this, intent)) return true;
    CallIntentGuard.stripCallExtras(intent);
    return false;
  }

  /** An incoming call has to be visible on a locked phone and wake the screen, like a normal phone call. */
  private void allowOverLockScreenForCalls(Intent intent) {
    if (!isOwnCallIntent(intent)) return;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true);
      setTurnScreenOn(true);
    } else {
      getWindow().addFlags(
          android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
              | android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
    }
  }

  @Override
  public void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    allowOverLockScreenForCalls(intent);
    emitIncomingCall(intent);
  }

  /** The app is already running: tell the JavaScript side so it shows the incoming call screen. */
  private void emitIncomingCall(Intent intent) {
    if (!isOwnCallIntent(intent)) return;
    try {
      if (getReactNativeHost() != null && getReactNativeHost().getReactInstanceManager() != null) {
        com.facebook.react.bridge.ReactContext reactContext =
            getReactNativeHost().getReactInstanceManager().getCurrentReactContext();
        if (reactContext != null) {
          com.facebook.react.bridge.WritableMap map = com.facebook.react.bridge.Arguments.createMap();
          map.putString("callerId", intent.getStringExtra("callerId"));
          map.putString("callerName", intent.getStringExtra("callerName"));
          map.putString("callerAvatar", intent.getStringExtra("callerAvatar"));
          map.putString("roomId", intent.getStringExtra("roomId"));
          map.putString("roomName", intent.getStringExtra("roomName"));
          map.putString("roomType", intent.getStringExtra("roomType"));
          map.putBoolean("isVideo", intent.getBooleanExtra("isVideo", false));
          map.putString("callAction", intent.getStringExtra("callAction"));
          reactContext
              .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
              .emit("incomingCallFromNative", map);
          intent.removeExtra("incomingCall");
        }
      }
    } catch (Exception e) {
      e.printStackTrace();
    }
  }

  @Override
  public void onUserLeaveHint() {
    super.onUserLeaveHint();
    // never float a PiP window over the lock screen: it would show the app to whoever holds the phone
    if (isAutoPipEnabled && !isKeyguardLocked() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      try {
        enterPictureInPictureMode(pipBuilder(this, true).build());
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
    if (isInPictureInPictureMode) registerPipReceiver(); else unregisterPipReceiver();
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
    return new ReactActivityDelegateWrapper(
        this,
        DefaultNewArchitectureEntryPoint.getFabricEnabled(),
        new DefaultReactActivityDelegate(
            this,
            getMainComponentName(),
            DefaultNewArchitectureEntryPoint.getFabricEnabled()));
  }
}
