#import <Foundation/Foundation.h>
#import <ImageIO/ImageIO.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>
#import <React/RCTBridgeModule.h>

/// iOS counterpart of ImageCompressorModule.java: downscale so the longest edge is at most maxWidth (default 1280), apply the
/// EXIF orientation, re-encode as JPEG (quality 10 to 100, default 75) into the temp directory. Any failure resolves with the
/// original uri so the upload carries on with the picked file.
@interface ImageCompressor : NSObject <RCTBridgeModule>
@end

@implementation ImageCompressor

RCT_EXPORT_MODULE(ImageCompressor)

+ (BOOL)requiresMainQueueSetup { return NO; }

- (dispatch_queue_t)methodQueue {
  return dispatch_queue_create("com.cinecraftconnect.imagecompressor", DISPATCH_QUEUE_SERIAL);
}

RCT_EXPORT_METHOD(compress:(NSString *)uriString
                  options:(NSDictionary *)options
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  @autoreleasepool {
    NSDictionary *fallback = @{ @"uri": uriString ?: @"" };
    NSURL *url = nil;
    if ([uriString hasPrefix:@"/"]) {
      url = [NSURL fileURLWithPath:uriString];
    } else if (uriString.length) {
      url = [NSURL URLWithString:uriString];
    }
    if (!url.isFileURL) {
      resolve(fallback);
      return;
    }

    NSInteger maxDimension = [options[@"maxWidth"] respondsToSelector:@selector(integerValue)] ? [options[@"maxWidth"] integerValue] : 1280;
    if (maxDimension <= 0) maxDimension = 1280;
    NSInteger quality = [options[@"quality"] respondsToSelector:@selector(integerValue)] ? [options[@"quality"] integerValue] : 75;
    quality = MAX(10, MIN(100, quality));

    CGImageSourceRef source = CGImageSourceCreateWithURL((__bridge CFURLRef)url, NULL);
    if (!source) {
      resolve(fallback);
      return;
    }

    // Never upscale a small picture.
    NSDictionary *info = CFBridgingRelease(CGImageSourceCopyPropertiesAtIndex(source, 0, NULL));
    NSInteger longest = MAX([info[(id)kCGImagePropertyPixelWidth] integerValue], [info[(id)kCGImagePropertyPixelHeight] integerValue]);
    if (longest > 0 && longest < maxDimension) maxDimension = longest;

    // The thumbnail call decodes straight at the target size (no full-size bitmap in memory) and applies the EXIF orientation.
    NSDictionary *thumbOptions = @{
      (id)kCGImageSourceCreateThumbnailFromImageAlways: @YES,
      (id)kCGImageSourceCreateThumbnailWithTransform: @YES,
      (id)kCGImageSourceShouldCacheImmediately: @YES,
      (id)kCGImageSourceThumbnailMaxPixelSize: @(maxDimension),
    };
    CGImageRef image = CGImageSourceCreateThumbnailAtIndex(source, 0, (__bridge CFDictionaryRef)thumbOptions);
    CFRelease(source);
    if (!image) {
      resolve(fallback);
      return;
    }

    NSString *directory = [NSTemporaryDirectory() stringByAppendingPathComponent:@"cinecraft_media_cache"];
    [NSFileManager.defaultManager createDirectoryAtPath:directory withIntermediateDirectories:YES attributes:nil error:nil];
    NSString *path = [directory stringByAppendingPathComponent:[NSString stringWithFormat:@"comp_%@.jpg", NSUUID.UUID.UUIDString]];
    NSURL *outUrl = [NSURL fileURLWithPath:path];

    CGImageDestinationRef destination = CGImageDestinationCreateWithURL((__bridge CFURLRef)outUrl, (__bridge CFStringRef)UTTypeJPEG.identifier, 1, NULL);
    if (!destination) {
      CGImageRelease(image);
      resolve(fallback);
      return;
    }
    NSDictionary *properties = @{ (id)kCGImageDestinationLossyCompressionQuality: @((double)quality / 100.0) };
    CGImageDestinationAddImage(destination, image, (__bridge CFDictionaryRef)properties);
    BOOL ok = CGImageDestinationFinalize(destination);
    CFRelease(destination);

    size_t width = CGImageGetWidth(image);
    size_t height = CGImageGetHeight(image);
    CGImageRelease(image);
    if (!ok) {
      resolve(fallback);
      return;
    }

    NSDictionary *attributes = [NSFileManager.defaultManager attributesOfItemAtPath:path error:nil];
    resolve(@{
      @"uri": outUrl.absoluteString,
      @"width": @(width),
      @"height": @(height),
      @"size": attributes[NSFileSize] ?: @0,
    });
  }
}

@end
