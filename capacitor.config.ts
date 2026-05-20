import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cinecraftconnect.app',
  appName: 'CineCraft Connect',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: false,
      backgroundColor: "#0B0B0B",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_default",
      iconColor: "#FF4B33"
    },
    PushNotifications: {
      presentationOptions: ["badge"],
    },
  },
};

export default config;
