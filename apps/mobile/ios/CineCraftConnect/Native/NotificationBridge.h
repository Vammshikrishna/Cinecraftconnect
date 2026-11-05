#import <Foundation/Foundation.h>
#import <UserNotifications/UserNotifications.h>
#import <React/RCTBridgeModule.h>

/**
 * iOS counterpart of the Android NotificationBridge module (same JS name, same method names), so the shared JS in
 * src/services/mobilePush.ts, App.tsx and the chat screens keeps working unchanged.
 *
 * What it does on iOS:
 *  - displayNotification: shows a local notification while the app is open (the JS decrypts end-to-end encrypted
 *    messages first, so the text is readable). Background / killed delivery is the normal APNs alert push that
 *    supabase/functions/push-delivery already sends.
 *  - dismissNotification / dismissAllNotifications: remove delivered notifications (by conversation key / everything).
 *  - getInitialNotificationData + tap handling: opening the app from one of these notifications routes through the
 *    same cinecraftconnect:// deep links the Android notifications use.
 */
@interface NotificationBridge : NSObject <RCTBridgeModule>

/// userInfo marker that tells apart notifications created here from remote (Firebase) ones.
+ (BOOL)isLocalUserInfo:(NSDictionary *)userInfo;

/// Called by AppDelegate when the person taps one of this module's local notifications.
+ (void)handleNotificationTap:(NSDictionary *)userInfo;

/// Registers the Reply / Mark as read button sets (categories "cc_message" and "cc_message_readonly"). Call once at launch.
+ (void)registerCategories;

/// Handles a press on Reply / Mark as read, for local and remote notifications. Returns NO for anything else (a plain tap),
/// in which case the completion handler has NOT been called.
+ (BOOL)handleActionResponse:(UNNotificationResponse *)response completionHandler:(void (^)(void))completionHandler;

@end
