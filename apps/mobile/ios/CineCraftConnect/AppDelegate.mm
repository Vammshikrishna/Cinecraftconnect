#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <React/RCTLinkingManager.h>
#import <UserNotifications/UserNotifications.h>
#import <FirebaseCore/FirebaseCore.h>
#import <GoogleSignIn/GoogleSignIn.h>

#import "NotificationBridge.h"

@interface AppDelegate () <UNUserNotificationCenterDelegate>
@end

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // Firebase (push) and Google sign-in read GoogleService-Info.plist. It is not committed (see IOS_SETUP.md), so a build
  // without it must still start: the push / Google features are simply off.
  if ([[NSBundle mainBundle] pathForResource:@"GoogleService-Info" ofType:@"plist"] != nil) {
    if ([FIRApp defaultApp] == nil) [FIRApp configure];
  } else {
    NSLog(@"[CineCraft] GoogleService-Info.plist is missing from this build: push notifications and Google sign-in are off.");
  }

  self.moduleName = @"CineCraftConnect";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  BOOL result = [super application:application didFinishLaunchingWithOptions:launchOptions];

  // Set after the super call and before the launch finishes, so react-native-firebase captures this object as the "original"
  // notification delegate and hands it every notification that did not come from Firebase (our own local notifications).
  UNUserNotificationCenter.currentNotificationCenter.delegate = self;
  [NotificationBridge registerCategories];

  [NSNotificationCenter.defaultCenter addObserver:self
                                         selector:@selector(clearBadge)
                                             name:UIApplicationDidBecomeActiveNotification
                                           object:nil];
  return result;
}

- (void)clearBadge
{
  // The server puts badge 1 on every push; nothing else resets it, so opening the app does.
  if (@available(iOS 16.0, *)) {
    [UNUserNotificationCenter.currentNotificationCenter setBadgeCount:0 withCompletionHandler:nil];
  } else {
    UIApplication.sharedApplication.applicationIconBadgeNumber = 0;
  }
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

#pragma mark - Deep links (cinecraftconnect://, https://cinecraftconnect.com) and Google sign-in

// Linking API
- (BOOL)application:(UIApplication *)application openURL:(NSURL *)url options:(NSDictionary<UIApplicationOpenURLOptionsKey, id> *)options
{
  if ([GIDSignIn.sharedInstance handleURL:url]) {
    return YES;
  }
  return [super application:application openURL:url options:options] || [RCTLinkingManager application:application openURL:url options:options];
}

// Universal Links
- (BOOL)application:(UIApplication *)application continueUserActivity:(NSUserActivity *)userActivity restorationHandler:(void (^)(NSArray<id<UIUserActivityRestoring>> *_Nullable))restorationHandler
{
  BOOL result = [RCTLinkingManager application:application continueUserActivity:userActivity restorationHandler:restorationHandler];
  return [super application:application continueUserActivity:userActivity restorationHandler:restorationHandler] || result;
}

#pragma mark - Remote notifications (explicit so Firebase's swizzling and Expo's forwarding both see them)

- (void)application:(UIApplication *)application didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken
{
  return [super application:application didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];
}

- (void)application:(UIApplication *)application didFailToRegisterForRemoteNotificationsWithError:(NSError *)error
{
  return [super application:application didFailToRegisterForRemoteNotificationsWithError:error];
}

- (void)application:(UIApplication *)application didReceiveRemoteNotification:(NSDictionary *)userInfo fetchCompletionHandler:(void (^)(UIBackgroundFetchResult))completionHandler
{
  return [super application:application didReceiveRemoteNotification:userInfo fetchCompletionHandler:completionHandler];
}

#pragma mark - UNUserNotificationCenterDelegate

// A notification arrives while the app is open. Our own local notifications (NotificationBridge) are shown as a banner. Remote
// ones are NOT: the JS layer decrypts the message and shows its own banner, so showing the push as well would double it.
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
       willPresentNotification:(UNNotification *)notification
         withCompletionHandler:(void (^)(UNNotificationPresentationOptions))completionHandler
{
  if ([NotificationBridge isLocalUserInfo:notification.request.content.userInfo]) {
    completionHandler(UNNotificationPresentationOptionBanner | UNNotificationPresentationOptionList | UNNotificationPresentationOptionSound);
  } else {
    completionHandler(UNNotificationPresentationOptionNone);
  }
}

- (void)userNotificationCenter:(UNUserNotificationCenter *)center
didReceiveNotificationResponse:(UNNotificationResponse *)response
         withCompletionHandler:(void (^)(void))completionHandler
{
  // Reply / Mark as read buttons, on local and remote notifications alike (react-native-firebase forwards the response here too).
  if ([NotificationBridge handleActionResponse:response completionHandler:completionHandler]) {
    return;
  }
  NSDictionary *userInfo = response.notification.request.content.userInfo;
  if ([NotificationBridge isLocalUserInfo:userInfo]) {
    [NotificationBridge handleNotificationTap:userInfo];
  }
  // Taps on remote (Firebase) notifications are routed by react-native-firebase: getInitialNotification / onNotificationOpenedApp.
  completionHandler();
}

@end
