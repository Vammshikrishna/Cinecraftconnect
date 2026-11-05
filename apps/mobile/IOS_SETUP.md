# iOS build guide (iPhone, iPad, Mac)

The iOS project lives in `apps/mobile/ios`. It is a universal app (iPhone + iPad) with the same bundle id as Android, `com.cinecraftconnect.app`.

> **Status: written on Windows, never compiled.** The Xcode project file was checked structurally (it parses and every file and object it references exists), the JS passes `tsc`, but nothing has been built in Xcode yet. Expect a first build on the Mac to need a few small fixes. Send the Xcode error and they are quick to fix.

## What you need on the Mac

| | |
|---|---|
| macOS + Xcode | macOS 14 or newer, Xcode 16 (React Native 0.76 needs 15.1 or newer) |
| Node | 22 (same as CI) |
| Ruby | 2.6.10 or newer with Bundler (`gem install bundler`); CocoaPods comes from the `Gemfile` |
| Apple account | **Free Apple ID**: Simulator and your own iPhone / iPad, but no push notifications and no universal links. **Paid Developer Program ($99/year)**: push, universal links, TestFlight, App Store |

## One-time setup

1. Get the repo on the Mac and run `npm install` at the repo root.
2. Create `apps/mobile/src/config/env.secrets.ts` from `env.secrets.example.ts` (the same values as on Android).
3. **Firebase (needed for push and Google sign-in)**
   - Firebase console > Project settings > add an **iOS app** with bundle id `com.cinecraftconnect.app`.
   - Download `GoogleService-Info.plist` and put it in `apps/mobile/ios/CineCraftConnect/`. It is git-ignored; a build step copies it into the app. Without it the app still runs, with push and Google sign-in off.
   - Firebase console > Project settings > Cloud Messaging > Apple app configuration: upload an **APNs authentication key (.p8)** (Apple Developer > Keys). Push does not reach iPhones without it.
4. Open `ios/CineCraftConnect/Info.plist` and replace `REPLACE_WITH_REVERSED_CLIENT_ID` (in the Google URL scheme) with the `REVERSED_CLIENT_ID` value from `GoogleService-Info.plist`. Without this, Google sign-in cannot come back to the app.
5. Install the pods: `cd apps/mobile && npm run ios:pods` (first run takes 5 to 15 minutes). Commit the generated `ios/Podfile.lock`.
6. Open **`ios/CineCraftConnect.xcworkspace`** (not the `.xcodeproj`) in Xcode.
7. Target **CineCraftConnect** > Signing & Capabilities > pick your **Team**.
   - Free Apple ID: Xcode refuses the Push / Associated Domains capabilities. In Build Settings clear **Code Signing Entitlements** (`CODE_SIGN_ENTITLEMENTS`). Everything except push and universal links then works.

## Running

| Where | How |
|---|---|
| iPhone / iPad Simulator | `cd apps/mobile && npm run ios`, or choose a simulator in Xcode and press Run. Push does not work on the Simulator (no APNs token). |
| Your iPhone / iPad | Plug it in, turn on Developer Mode (Settings > Privacy & Security), choose it in Xcode and press Run. |
| Mac | On an Apple-silicon Mac choose the destination **My Mac (Designed for iPad)**. |
| Release build | Xcode > Product > Archive. Raise `CURRENT_PROJECT_VERSION` for every upload. For export compliance the app uses end-to-end encryption: answer the encryption questions in App Store Connect. |

Test a deep link in the Simulator: `xcrun simctl openurl booted "cinecraftconnect://messages/<user-id>"`.

## What is in place

- Universal iPhone + iPad project, brand app icon (opaque 1024 px, made from `src/assets/logo.jpg`) and launch screen with the logo.
- Lora / Work Sans / Inconsolata fonts (same files as Android; the names match the `fontFamily` strings).
- Camera, microphone, photo library and Bluetooth permission texts; `cinecraftconnect://` deep links; background audio (calls keep playing when the screen locks).
- Push through Firebase to APNs. `supabase/functions/push-delivery` sends the iOS payload (alert, sound, `mutable-content`, thread id, and since the buttons were added, the category).
- `ios/CineCraftConnect/Native`: iOS versions of the Android native modules the JS calls (`NotificationBridge`, `CallService`, `PipBridge`, `ImageCompressor`, `PhotoRender`), so the shared JS runs unchanged.
  - Banners while the app is open, dismissing a chat's notifications when you open it, tap to open the right screen, badge cleared on open.
  - Dial and busy tones during calls.
- New architecture is off, like `android/gradle.properties`.

## Added after the first scaffold (also never compiled)

- **Reply / Mark as read buttons** on message notifications (`NotificationBridge.m`, `AppDelegate.mm`). Works for local banners and for pushes. **Deploy `supabase/functions/push-delivery` again**: it now sends `aps.category` (`cc_message` for chats and rooms, `cc_message_readonly` for project spaces, which are encrypted so they only get Mark as read). Without the new deploy, pushes arrive without buttons; local banners already have them. Replies reuse the Android handler (`notificationActionHandler.ts`), so encrypted chats are never sent as plain text.
- **Screen sharing** in calls: a ReplayKit broadcast extension, target **ScreenShare** (`ios/ScreenShare`). The call screen's monitor button opens the system "Start Broadcast" sheet. Needs the **App Group** `group.com.cinecraftconnect.app` on both the app and the extension (paid Apple account; Xcode creates it when you tick the capability, or add it in the developer portal). The bundle id of the extension is `com.cinecraftconnect.app.ScreenShare`; it must stay in sync with `RTCScreenSharingExtension` in `Info.plist`. With a free Apple ID, delete the ScreenShare target (and its Embed phase) and clear `CODE_SIGN_ENTITLEMENTS`: the rest of the app does not need it.
- **Picture-in-picture** for video calls: the remote video is drawn by `CallVideoView` with iOS PiP on, so it floats when you leave the app during a video call (iOS 15+). Voice calls have no picture to float.
- **Photo and video editor**: `Native/PhotoRender.m` (crop, turn, flip, filters, vignette, text, video trim without re-encoding). iOS writes JPEG, not WebP; the JS uses the returned `mime`.
- **Image compression**: `Native/ImageCompressor.m` (longest side 1280, JPEG quality 75, same as Android).
- **iPad**: the app already chose tablet layouts by screen width (`useResponsive`, `TabletContainer`), so an iPad uses them with no extra work; multitasking (Split View, Slide Over, Stage Manager) is allowed (`UIRequiresFullScreen` is false). Three values that used to be read once at launch now come from the physical screen so a resized window cannot leave them wrong. Test on an iPad in both orientations and in Split View.

## Not done yet (different from Android)

1. **Incoming calls when the app is closed.** Android rings full screen. iOS needs **CallKit + PushKit** (a VoIP push from the server) for that. For now a call arrives as a normal time-sensitive banner. This is the biggest piece of iOS work left.
2. **Message text in a notification when the app is closed.** For end-to-end encrypted messages the server sends the generic text "Sent you a message" (title: the sender's name), so nothing unreadable or private is shown. Showing the real text would need a Notification Service Extension that shares the keychain with the app. While the app is open, the JS decrypts the message and shows the real text.
3. Screen sharing does not carry the phone's sound (audio is off, like Android).
4. A button press on a notification while the app is closed keeps the app alive for about 12 seconds so the reply or read mark can reach the server; on a very slow network it can be lost.

## If a build fails

- `pod install` cannot find a pod: `cd apps/mobile/ios && bundle exec pod install --repo-update`.
- Firebase / Swift link errors: pods are built as static frameworks (see `Podfile`). To try another mode: `USE_FRAMEWORKS=dynamic npm run ios:pods`.
- "No such module" or a stale build: Xcode > Product > Clean Build Folder, delete `ios/Pods` and `ios/build`, run `npm run ios:pods` again.
- Metro cannot find the bundle in a Release build: the "Bundle React Native code and images" build phase needs Node; `ios/.xcode.env` points it at `node` on your PATH. If Xcode cannot find it, put the full path in `ios/.xcode.env.local` (`export NODE_BINARY=/path/to/node`).
