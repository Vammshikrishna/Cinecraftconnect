# React Native Core & Reflection Keep Rules
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes InnerClasses
-keepattributes EnclosingMethod

-keepclassmembers class * {
    @com.facebook.react.uimanager.annotations.ReactProp <fields>;
    @com.facebook.react.uimanager.annotations.ReactProp <methods>;
    @com.facebook.react.uimanager.annotations.ReactPropGroup <fields>;
    @com.facebook.react.uimanager.annotations.ReactPropGroup <methods>;
    @com.facebook.react.bridge.ReactMethod <methods>;
    @com.facebook.react.module.annotations.ReactModule <fields>;
    @com.facebook.react.module.annotations.ReactModule <methods>;
}

-keep class * implements com.facebook.react.bridge.NativeModule { *; }
-keep class * implements com.facebook.react.bridge.JavaScriptModule { *; }
-keep class * implements com.facebook.react.uimanager.ViewManager { *; }
-keep class * implements com.facebook.react.ReactPackage { *; }

-keep class com.facebook.react.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.soloader.** { *; }
-keep class com.facebook.fbreact.** { *; }

# Hermes
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.hermes.reactexecutor.** { *; }

# React Native SVG & Vector Icons
-keep class com.horcrux.svg.** { *; }
-keep class com.horcrux.svg.**$* { *; }
-keep class com.oblador.vectoricons.** { *; }
-keep class com.oblador.vectoricons.**$* { *; }

# LiveKit WebRTC
-keep class com.livekit.** { *; }
-keep class org.webrtc.** { *; }
-dontwarn org.webrtc.**

# Firebase & Google Services
-dontwarn com.google.firebase.**
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# React Native Quick Crypto / Base64 / Keychain
-keep class com.quickcrypto.** { *; }
-keep class com.reactnativequickcrypto.** { *; }
-keep class com.reactnativequickbase64.** { *; }
-keep class com.oblador.keychain.** { *; }

# React Native Screens & Safe Area & Gesture Handler
-keep class com.swmansion.rnscreens.** { *; }
-keep class com.swmansion.rnscreens.**$* { *; }
-keep class com.th3rdwave.safeareacontext.** { *; }
-keep class com.th3rdwave.safeareacontext.**$* { *; }
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.swmansion.gesturehandler.**$* { *; }

# AsyncStorage, NetInfo, Video Compressor, Linear Gradient
-keep class com.reactnativecommunity.asyncstorage.** { *; }
-keep class com.reactnativecommunity.netinfo.** { *; }
-keep class com.dylanvh.reactnativevideocompressor.** { *; }
-keep class com.BV.LinearGradient.** { *; }

# OkHttp & Okio
-dontwarn okhttp3.**
-dontwarn okio.**

