package com.cinecraftconnect.app;

import android.app.Application;
import com.facebook.react.PackageList;
import com.facebook.react.ReactApplication;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint;
import com.facebook.react.defaults.DefaultReactNativeHost;
import com.facebook.soloader.SoLoader;
import com.facebook.drawee.backends.pipeline.Fresco;
import com.facebook.imagepipeline.core.ImagePipelineConfig;
import com.facebook.cache.disk.DiskCacheConfig;
import java.util.List;

public class MainApplication extends Application implements ReactApplication {

  private final ReactNativeHost mReactNativeHost =
      new DefaultReactNativeHost(this) {
        @Override
        public boolean getUseDeveloperSupport() {
          return BuildConfig.DEBUG;
        }

        @Override
        protected List<ReactPackage> getPackages() {
          @SuppressWarnings("UnnecessaryLocalVariable")
          List<ReactPackage> packages = new PackageList(this).getPackages();
          packages.add(new NotificationBridgePackage());
          packages.add(new PipBridgePackage());
          packages.add(new CallServicePackage());
          packages.add(new ImageCompressorPackage());
          return packages;
        }

        @Override
        protected String getJSMainModuleName() {
          return "index";
        }

        @Override
        protected boolean isNewArchEnabled() {
          return DefaultNewArchitectureEntryPoint.getFabricEnabled();
        }

        @Override
        protected Boolean isHermesEnabled() {
          return true;
        }
      };

  @Override
  public ReactNativeHost getReactNativeHost() {
    return mReactNativeHost;
  }

  @Override
  public void onCreate() {
    super.onCreate();
    SoLoader.init(this, /* native exopackage */ false);

    // Initialize Fresco with high-capacity 300MB persistent disk cache for offline image support
    try {
      DiskCacheConfig diskCacheConfig = DiskCacheConfig.newBuilder(this)
          .setBaseDirectoryPath(getCacheDir())
          .setBaseDirectoryName("fresco_offline_cache")
          .setMaxCacheSize(300L * 1024L * 1024L) // 300 MB disk cache
          .setMaxCacheSizeOnLowDiskSpace(60L * 1024L * 1024L)
          .setMaxCacheSizeOnVeryLowDiskSpace(20L * 1024L * 1024L)
          .build();

      ImagePipelineConfig imagePipelineConfig = ImagePipelineConfig.newBuilder(this)
          .setMainDiskCacheConfig(diskCacheConfig)
          .setDownsampleEnabled(true)
          .build();

      Fresco.initialize(this, imagePipelineConfig);
    } catch (Exception e) {
      android.util.Log.w("MainApplication", "Failed to initialize custom Fresco cache config", e);
    }

    if (DefaultNewArchitectureEntryPoint.getFabricEnabled()) {
      DefaultNewArchitectureEntryPoint.load();
    }

    // Initialize FCM Notification Channel for Android 8.0+ (Oreo and above)
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
      android.app.NotificationChannel channel = new android.app.NotificationChannel(
          "fcm_fallback_notification_channel",
          "CineCraft Notifications",
          android.app.NotificationManager.IMPORTANCE_HIGH
      );
      channel.setDescription("CineCraft Connect Push Notifications");
      channel.enableLights(true);
      channel.enableVibration(true);
      channel.setShowBadge(true);
      channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);

      android.app.NotificationManager manager = getSystemService(android.app.NotificationManager.class);
      if (manager != null) {
        manager.createNotificationChannel(channel);
      }
    }
  }
}
