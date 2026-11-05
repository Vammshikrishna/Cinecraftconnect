#import <UIKit/UIKit.h>
#import <React/RCTBridgeModule.h>

/**
 * iOS counterpart of the Android PipBridge module (see src/services/lockScreenGuard.ts and pipService.ts).
 *
 * iOS apps cannot push themselves to the background, so enterPipMode / moveToBackground do nothing here. The video call's
 * picture-in-picture is not driven from this module: CallVideoView (src/components/calls) renders the remote video with
 * iosPIP + startAutomatically, so iOS floats it by itself when the person leaves the app during a video call. This module
 * only answers the lock check.
 */
@interface PipBridge : NSObject <RCTBridgeModule>
@end

@implementation PipBridge

RCT_EXPORT_MODULE(PipBridge)

+ (BOOL)requiresMainQueueSetup { return NO; }

RCT_EXPORT_METHOD(isDeviceLocked:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    // Protected data is unavailable while the phone is locked with a passcode.
    resolve(@(!UIApplication.sharedApplication.isProtectedDataAvailable));
  });
}

RCT_EXPORT_METHOD(moveToBackground) {}

RCT_EXPORT_METHOD(isPipSupported:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  resolve(@NO);
}

RCT_EXPORT_METHOD(enterPipMode:(double)width height:(double)height resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  resolve(@NO);
}

RCT_EXPORT_METHOD(setPipCallState:(BOOL)muted speakerOn:(BOOL)speakerOn) {}

RCT_EXPORT_METHOD(setAutoPipEnabled:(BOOL)enabled) {}

@end
