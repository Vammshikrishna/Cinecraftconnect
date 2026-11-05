#import <RCTAppDelegate.h>
#import <UIKit/UIKit.h>
#import <Expo/Expo.h>

// EXAppDelegateWrapper runs the Expo module lifecycle (expo-gl for the landing animation); the Android MainApplication does the same
// through expo.modules.ApplicationLifecycleDispatcher.
@interface AppDelegate : EXAppDelegateWrapper

@end
