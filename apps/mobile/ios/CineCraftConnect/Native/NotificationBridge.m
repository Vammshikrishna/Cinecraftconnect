#import "NotificationBridge.h"

#import <UIKit/UIKit.h>
#import <UserNotifications/UserNotifications.h>
#import <React/RCTBridge.h>
#import <React/RCTLinkingManager.h>

static NSString *const kLocalMarker = @"cc_local";
static NSString *const kAvatarDefaultsKey = @"cc_current_user_avatar";
static NSString *const kIncomingCallId = @"cc_incoming_call";

// A tap that happened before the JS side was ready (cold start from a notification). getInitialNotificationData hands it over once.
static NSDictionary *sPendingTap = nil;
static BOOL sJSReady = NO;

// Reply / mark-as-read button presses. They are queued until the JS listener exists (it asks for the queue with getPendingActions
// right after registering), then sent live as the "NotificationAction" event, the same one the Android module emits.
static NSString *const kActionsDefaultsKey = @"cc_pending_notification_actions";
static NSString *const kCategoryMessage = @"cc_message";
static NSString *const kCategoryMessageReadOnly = @"cc_message_readonly";
static NSString *const kActionReply = @"cc_reply";
static NSString *const kActionMarkRead = @"cc_mark_read";
static BOOL sListenerReady = NO;
static __weak RCTBridge *sBridge = nil;

static NSString *CCEncode(NSString *value) {
  return [value stringByAddingPercentEncodingWithAllowedCharacters:NSCharacterSet.URLPathAllowedCharacterSet] ?: @"";
}

/// Same deep links the Android notifications open (see NotificationBridgeModule.java).
static NSString *CCDeepLink(NSString *screen, NSString *partnerId) {
  if (partnerId.length == 0) return @"cinecraftconnect://notifications";
  NSString *eid = CCEncode(partnerId);
  if ([screen isEqualToString:@"DiscussionRoomDetail"]) {
    return [NSString stringWithFormat:@"cinecraftconnect://discussions/%@?roomId=%@", eid, eid];
  }
  if ([screen isEqualToString:@"ProjectSpace"]) {
    return [NSString stringWithFormat:@"cinecraftconnect://projects/%@?projectId=%@&spaceId=%@", eid, eid, eid];
  }
  if ([screen isEqualToString:@"Conversation"]) {
    return [NSString stringWithFormat:@"cinecraftconnect://messages/%@?partnerId=%@", eid, eid];
  }
  return @"cinecraftconnect://notifications";
}

static void CCSchedule(UNNotificationContent *content, NSString *identifier) {
  UNNotificationRequest *request = [UNNotificationRequest requestWithIdentifier:identifier content:content trigger:nil];
  [[UNUserNotificationCenter currentNotificationCenter] addNotificationRequest:request withCompletionHandler:^(NSError *error) {
    if (error) NSLog(@"[NotificationBridge] could not show notification: %@", error);
  }];
}

/// Adds the sender's picture as the notification thumbnail when it can be downloaded quickly (JPEG / PNG / GIF only: iOS shows nothing else).
static void CCScheduleWithAvatar(UNMutableNotificationContent *content, NSString *identifier, NSString *avatarUrl) {
  NSURL *url = avatarUrl.length ? [NSURL URLWithString:avatarUrl] : nil;
  if (!url || ![url.scheme.lowercaseString isEqualToString:@"https"]) {
    CCSchedule(content, identifier);
    return;
  }
  NSMutableURLRequest *request = [NSMutableURLRequest requestWithURL:url];
  request.timeoutInterval = 4;
  [[[NSURLSession sharedSession] downloadTaskWithRequest:request completionHandler:^(NSURL *tmp, NSURLResponse *response, NSError *error) {
    NSHTTPURLResponse *http = [response isKindOfClass:NSHTTPURLResponse.class] ? (NSHTTPURLResponse *)response : nil;
    NSString *mime = http.MIMEType.lowercaseString ?: @"";
    NSString *ext = [mime isEqualToString:@"image/png"] ? @"png" : ([mime isEqualToString:@"image/jpeg"] ? @"jpg" : ([mime isEqualToString:@"image/gif"] ? @"gif" : nil));
    if (tmp && !error && http.statusCode == 200 && ext) {
      NSURL *dest = [NSURL fileURLWithPath:[NSTemporaryDirectory() stringByAppendingPathComponent:[NSString stringWithFormat:@"%@.%@", NSUUID.UUID.UUIDString, ext]]];
      if ([NSFileManager.defaultManager moveItemAtURL:tmp toURL:dest error:nil]) {
        UNNotificationAttachment *attachment = [UNNotificationAttachment attachmentWithIdentifier:@"avatar" URL:dest options:nil error:nil];
        if (attachment) content.attachments = @[ attachment ];
      }
    }
    CCSchedule(content, identifier);
  }] resume];
}

static NSArray<NSDictionary *> *CCLoadQueue(void) {
  NSArray *stored = [NSUserDefaults.standardUserDefaults arrayForKey:kActionsDefaultsKey];
  return [stored isKindOfClass:NSArray.class] ? stored : @[];
}

static void CCSaveQueue(NSArray<NSDictionary *> *queue) {
  if (queue.count) {
    [NSUserDefaults.standardUserDefaults setObject:queue forKey:kActionsDefaultsKey];
  } else {
    [NSUserDefaults.standardUserDefaults removeObjectForKey:kActionsDefaultsKey];
  }
}

/// Where a notification belongs. Local ones carry it already; pushes from push-delivery carry the message type and ids.
static NSDictionary *CCTarget(NSDictionary *userInfo) {
  NSString *screen = [userInfo[@"screen"] isKindOfClass:NSString.class] ? userInfo[@"screen"] : @"";
  NSString *partnerId = [userInfo[@"partnerId"] isKindOfClass:NSString.class] ? userInfo[@"partnerId"] : @"";
  if (screen.length == 0) {
    NSString *type = [userInfo[@"type"] isKindOfClass:NSString.class] ? userInfo[@"type"] : @"";
    NSString *(^str)(NSString *) = ^NSString *(NSString *key) {
      id v = userInfo[key];
      return [v isKindOfClass:NSString.class] ? v : @"";
    };
    if ([type isEqualToString:@"dm"]) {
      screen = @"Conversation";
      partnerId = partnerId.length ? partnerId : str(@"senderId");
    } else if ([type isEqualToString:@"room"]) {
      screen = @"DiscussionRoomDetail";
      partnerId = str(@"roomId").length ? str(@"roomId") : str(@"conversationId");
    } else if ([type isEqualToString:@"project"]) {
      screen = @"ProjectSpace";
      partnerId = str(@"spaceId").length ? str(@"spaceId") : str(@"conversationId");
    }
  }
  return @{ @"screen": screen, @"partnerId": partnerId };
}

@implementation NotificationBridge

RCT_EXPORT_MODULE(NotificationBridge)

@synthesize bridge = _bridge;

+ (BOOL)requiresMainQueueSetup { return NO; }

- (void)setBridge:(RCTBridge *)bridge {
  _bridge = bridge;
  sBridge = bridge;
}

+ (void)load {
  // Know when the JS side is up, so a tap can be delivered as a live link instead of waiting for getInitialNotificationData.
  NSNotificationCenter *nc = NSNotificationCenter.defaultCenter;
  [nc addObserverForName:RCTJavaScriptWillStartLoadingNotification object:nil queue:nil usingBlock:^(NSNotification *n) {
    sJSReady = NO;
    sListenerReady = NO;
  }];
  [nc addObserverForName:RCTJavaScriptDidLoadNotification object:nil queue:nil usingBlock:^(NSNotification *n) { sJSReady = YES; }];
}

#pragma mark - Reply / mark-as-read buttons

+ (void)registerCategories {
  UNNotificationActionOptions none = UNNotificationActionOptionNone;
  UNTextInputNotificationAction *reply = [UNTextInputNotificationAction actionWithIdentifier:kActionReply
                                                                                       title:@"Reply"
                                                                                     options:none
                                                                        textInputButtonTitle:@"Send"
                                                                        textInputPlaceholder:@"Message"];
  UNNotificationAction *markRead = [UNNotificationAction actionWithIdentifier:kActionMarkRead title:@"Mark as read" options:none];
  UNNotificationCategory *message = [UNNotificationCategory categoryWithIdentifier:kCategoryMessage
                                                                           actions:@[ reply, markRead ]
                                                                 intentIdentifiers:@[]
                                                                           options:UNNotificationCategoryOptionNone];
  UNNotificationCategory *readOnly = [UNNotificationCategory categoryWithIdentifier:kCategoryMessageReadOnly
                                                                            actions:@[ markRead ]
                                                                  intentIdentifiers:@[]
                                                                            options:UNNotificationCategoryOptionNone];
  [UNUserNotificationCenter.currentNotificationCenter setNotificationCategories:[NSSet setWithObjects:message, readOnly, nil]];
}

/// Handles a press on Reply / Mark as read. Returns NO when the response is not one of ours (a plain tap).
+ (BOOL)handleActionResponse:(UNNotificationResponse *)response completionHandler:(void (^)(void))completionHandler {
  NSString *actionIdentifier = response.actionIdentifier;
  BOOL isReply = [actionIdentifier isEqualToString:kActionReply];
  BOOL isMarkRead = [actionIdentifier isEqualToString:kActionMarkRead];
  if (!isReply && !isMarkRead) return NO;

  NSDictionary *userInfo = response.notification.request.content.userInfo;
  NSDictionary *target = CCTarget(userInfo);
  NSString *partnerId = target[@"partnerId"];
  NSString *screen = target[@"screen"];
  NSString *text = @"";
  if (isReply && [response isKindOfClass:UNTextInputNotificationResponse.class]) {
    text = [((UNTextInputNotificationResponse *)response).userText stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet];
  }
  if (partnerId.length == 0 || (isReply && text.length == 0)) {
    completionHandler();
    return YES;
  }

  NSMutableDictionary *action = [NSMutableDictionary dictionaryWithDictionary:@{
    @"actionId": NSUUID.UUID.UUIDString,
    @"action": isReply ? @"reply" : @"mark_as_read",
    @"screen": screen,
    @"partnerId": partnerId,
    // dismissNotification() on the JS side matches the tail after "_" against the push thread id.
    @"conversationKey": [NSString stringWithFormat:@"%@_%@", screen.length ? screen : @"Conversation", partnerId],
  }];
  if (isReply) action[@"text"] = text;

  // Everything below runs on the main queue so the queue and the "listener ready" flag are never touched concurrently.
  dispatch_async(dispatch_get_main_queue(), ^{
    RCTBridge *bridge = sBridge;
    if (sListenerReady && bridge) {
      [bridge enqueueJSCall:@"RCTDeviceEventEmitter.emit" args:@[ @"NotificationAction", action ]];
    } else {
      NSMutableArray *queue = [CCLoadQueue() mutableCopy];
      [queue addObject:action];
      CCSaveQueue(queue);
    }
    // The system gives a background launch about 30 seconds to finish. The JS work is a network call with no completion
    // signal, so hold the app up for a short, fixed time and then let go.
    dispatch_after(dispatch_time(DISPATCH_TIME_NOW, (int64_t)(12 * NSEC_PER_SEC)), dispatch_get_main_queue(), completionHandler);
  });

  // Take the notification off the lock screen right away once it is marked as read.
  if (isMarkRead) {
    [UNUserNotificationCenter.currentNotificationCenter removeDeliveredNotificationsWithIdentifiers:@[ response.notification.request.identifier ]];
  }
  return YES;
}

+ (BOOL)isLocalUserInfo:(NSDictionary *)userInfo {
  return [userInfo[kLocalMarker] boolValue];
}

+ (void)handleNotificationTap:(NSDictionary *)userInfo {
  NSDictionary *tap = @{
    @"screen": userInfo[@"screen"] ?: [NSNull null],
    @"partnerId": userInfo[@"partnerId"] ?: [NSNull null],
    @"url": userInfo[@"url"] ?: [NSNull null],
  };
  NSURL *url = [userInfo[@"url"] isKindOfClass:NSString.class] ? [NSURL URLWithString:userInfo[@"url"]] : nil;
  dispatch_async(dispatch_get_main_queue(), ^{
    if (sJSReady && url) {
      [RCTLinkingManager application:UIApplication.sharedApplication openURL:url options:@{}];
    } else {
      sPendingTap = tap;
    }
  });
}

#pragma mark - JS API (same names as Android)

RCT_EXPORT_METHOD(setCurrentUserAvatar:(NSString *)avatarUrl)
{
  if (avatarUrl.length) {
    [NSUserDefaults.standardUserDefaults setObject:avatarUrl forKey:kAvatarDefaultsKey];
  } else {
    [NSUserDefaults.standardUserDefaults removeObjectForKey:kAvatarDefaultsKey];
  }
}

RCT_EXPORT_METHOD(displayNotification:(NSString *)conversationKey
                  title:(NSString *)title
                  body:(NSString *)body
                  channelId:(NSString *)channelId
                  screen:(NSString *)screen
                  partnerId:(NSString *)partnerId
                  partnerName:(NSString *)partnerName
                  avatarUrl:(NSString *)avatarUrl
                  myAvatarUrl:(NSString *)myAvatarUrl)
{
  UNMutableNotificationContent *content = [UNMutableNotificationContent new];
  content.title = title.length ? title : (partnerName.length ? partnerName : @"CineCraft Connect");
  content.body = body ?: @"";
  content.sound = UNNotificationSound.defaultSound;
  content.threadIdentifier = conversationKey ?: @"general";
  if ([screen isEqualToString:@"Conversation"] || [screen isEqualToString:@"DiscussionRoomDetail"]) {
    content.categoryIdentifier = kCategoryMessage;
  } else if ([screen isEqualToString:@"ProjectSpace"]) {
    content.categoryIdentifier = kCategoryMessageReadOnly;
  }
  content.userInfo = @{
    kLocalMarker: @YES,
    @"conversationKey": conversationKey ?: @"",
    @"screen": screen ?: @"",
    @"partnerId": partnerId ?: @"",
    @"url": CCDeepLink(screen, partnerId),
  };
  NSString *identifier = [NSString stringWithFormat:@"%@-%lld", conversationKey ?: @"n", (long long)(NSDate.date.timeIntervalSince1970 * 1000)];
  CCScheduleWithAvatar(content, identifier, avatarUrl);
}

RCT_EXPORT_METHOD(showIncomingCall:(NSString *)callerId
                  callerName:(NSString *)callerName
                  callerAvatar:(NSString *)callerAvatar
                  roomId:(NSString *)roomId
                  roomName:(NSString *)roomName
                  roomType:(NSString *)roomType
                  isVideo:(BOOL)isVideo)
{
  // No CallKit yet: a time-sensitive banner is the nearest thing (see IOS_SETUP.md, "Not done yet").
  UNMutableNotificationContent *content = [UNMutableNotificationContent new];
  content.title = callerName.length ? callerName : @"Incoming call";
  content.body = isVideo ? @"Incoming video call" : @"Incoming voice call";
  content.sound = UNNotificationSound.defaultRingtoneSound;
  content.threadIdentifier = kIncomingCallId;
  if (@available(iOS 15.0, *)) content.interruptionLevel = UNNotificationInterruptionLevelTimeSensitive;
  content.userInfo = @{ kLocalMarker: @YES, @"screen": @"", @"partnerId": @"", @"url": @"cinecraftconnect://notifications" };
  CCScheduleWithAvatar(content, kIncomingCallId, callerAvatar);
}

RCT_EXPORT_METHOD(cancelIncomingCall)
{
  UNUserNotificationCenter *center = UNUserNotificationCenter.currentNotificationCenter;
  [center removeDeliveredNotificationsWithIdentifiers:@[ kIncomingCallId ]];
  [center removePendingNotificationRequestsWithIdentifiers:@[ kIncomingCallId ]];
}

RCT_EXPORT_METHOD(dismissNotification:(NSString *)conversationKey)
{
  if (conversationKey.length == 0) return;
  // JS passes keys like "Conversation_<id>"; push alerts from the server are grouped by the bare "<id>" (threadId), so match both.
  NSRange underscore = [conversationKey rangeOfString:@"_"];
  NSString *tail = underscore.location != NSNotFound ? [conversationKey substringFromIndex:underscore.location + 1] : conversationKey;
  UNUserNotificationCenter *center = UNUserNotificationCenter.currentNotificationCenter;
  [center getDeliveredNotificationsWithCompletionHandler:^(NSArray<UNNotification *> *notifications) {
    NSMutableArray<NSString *> *ids = [NSMutableArray new];
    for (UNNotification *n in notifications) {
      NSString *thread = n.request.content.threadIdentifier;
      NSString *key = n.request.content.userInfo[@"conversationKey"];
      if ([thread isEqualToString:conversationKey] || [key isEqualToString:conversationKey] ||
          (tail.length && [thread isEqualToString:tail])) {
        [ids addObject:n.request.identifier];
      }
    }
    if (ids.count) [center removeDeliveredNotificationsWithIdentifiers:ids];
  }];
}

RCT_EXPORT_METHOD(dismissAllNotifications)
{
  UNUserNotificationCenter *center = UNUserNotificationCenter.currentNotificationCenter;
  [center removeAllDeliveredNotifications];
  [center removeAllPendingNotificationRequests];
  if (@available(iOS 16.0, *)) {
    [center setBadgeCount:0 withCompletionHandler:nil];
  } else {
    dispatch_async(dispatch_get_main_queue(), ^{ UIApplication.sharedApplication.applicationIconBadgeNumber = 0; });
  }
}

// JS calls this right after it registers the NotificationAction listener, so from here on actions are sent live.
RCT_EXPORT_METHOD(getPendingActions:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    sListenerReady = YES;
    resolve(CCLoadQueue());
  });
}

RCT_EXPORT_METHOD(clearPendingActions:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    CCSaveQueue(@[]);
    resolve(@YES);
  });
}

RCT_EXPORT_METHOD(getInitialNotificationData:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    NSDictionary *tap = sPendingTap;
    sPendingTap = nil;
    resolve(tap ?: [NSNull null]);
  });
}

@end
