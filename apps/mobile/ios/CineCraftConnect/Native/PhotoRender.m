#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <ImageIO/ImageIO.h>
#import <AVFoundation/AVFoundation.h>
#import <UniformTypeIdentifiers/UniformTypeIdentifiers.h>
#import <React/RCTBridgeModule.h>

/**
 * iOS counterpart of PhotoRenderModule.java (the photo and video editor's native half). Same JS name, same methods and same
 * option names, so src/services/photoRender.ts runs unchanged. The photo is drawn with Core Graphics: turn, flip, crop, the
 * 20-number colour matrix the web editor uses, vignette, then text. Two differences from Android: iOS cannot write WebP, so the
 * result is always a JPEG (the reply says so in "mime"), and videos are cut with AVFoundation's passthrough export (no re-encode).
 */
@interface PhotoRender : NSObject <RCTBridgeModule>
@end

static NSString *CCCacheDir(void) {
  NSString *dir = [NSTemporaryDirectory() stringByAppendingPathComponent:@"cinecraft_media_cache"];
  [NSFileManager.defaultManager createDirectoryAtPath:dir withIntermediateDirectories:YES attributes:nil error:nil];
  return dir;
}

static NSString *CCTempPath(NSString *prefix, NSString *ext) {
  return [CCCacheDir() stringByAppendingPathComponent:[NSString stringWithFormat:@"%@%@.%@", prefix, NSUUID.UUID.UUIDString, ext]];
}

static NSURL *CCURL(NSString *uriString) {
  if ([uriString hasPrefix:@"/"]) return [NSURL fileURLWithPath:uriString];
  return [NSURL URLWithString:uriString ?: @""];
}

/// Size of the picture as shown (after the camera's own rotation), read from the file header only.
static BOOL CCImageSize(NSURL *url, CGSize *size) {
  CGImageSourceRef source = url ? CGImageSourceCreateWithURL((__bridge CFURLRef)url, NULL) : NULL;
  if (!source) return NO;
  NSDictionary *info = CFBridgingRelease(CGImageSourceCopyPropertiesAtIndex(source, 0, NULL));
  CFRelease(source);
  CGFloat w = [info[(id)kCGImagePropertyPixelWidth] doubleValue];
  CGFloat h = [info[(id)kCGImagePropertyPixelHeight] doubleValue];
  int orientation = [info[(id)kCGImagePropertyOrientation] intValue];
  if (w <= 0 || h <= 0) return NO;
  BOOL swap = orientation >= 5 && orientation <= 8;
  *size = swap ? CGSizeMake(h, w) : CGSizeMake(w, h);
  return YES;
}

static BOOL CCWriteJPEG(CGImageRef image, NSString *path, double quality) {
  CGImageDestinationRef destination = CGImageDestinationCreateWithURL((__bridge CFURLRef)[NSURL fileURLWithPath:path], (__bridge CFStringRef)UTTypeJPEG.identifier, 1, NULL);
  if (!destination) return NO;
  NSDictionary *props = @{ (id)kCGImageDestinationLossyCompressionQuality: @(quality) };
  CGImageDestinationAddImage(destination, image, (__bridge CFDictionaryRef)props);
  BOOL ok = CGImageDestinationFinalize(destination);
  CFRelease(destination);
  return ok;
}

static unsigned long long CCFileSize(NSString *path) {
  return [[NSFileManager.defaultManager attributesOfItemAtPath:path error:nil][NSFileSize] unsignedLongLongValue];
}

/// "#RRGGBB", "#RRGGBBAA" or "rgba(r,g,b,a)"; `fallback` when it cannot be read; clear for "transparent".
static UIColor *CCColor(NSString *c, UIColor *fallback) {
  if (![c isKindOfClass:NSString.class] || c.length == 0 || [c isEqualToString:@"transparent"]) return UIColor.clearColor;
  if ([c hasPrefix:@"rgba"] || [c hasPrefix:@"rgb"]) {
    NSRange open = [c rangeOfString:@"("];
    NSRange close = [c rangeOfString:@")"];
    if (open.location == NSNotFound || close.location == NSNotFound) return fallback;
    NSArray<NSString *> *p = [[c substringWithRange:NSMakeRange(open.location + 1, close.location - open.location - 1)] componentsSeparatedByString:@","];
    if (p.count < 3) return fallback;
    CGFloat a = p.count > 3 ? p[3].doubleValue : 1;
    return [UIColor colorWithRed:p[0].doubleValue / 255 green:p[1].doubleValue / 255 blue:p[2].doubleValue / 255 alpha:a];
  }
  if ([c hasPrefix:@"#"] && (c.length == 7 || c.length == 9)) {
    unsigned int rgb = 0;
    unsigned int a = 255;
    [[NSScanner scannerWithString:[c substringWithRange:NSMakeRange(1, 6)]] scanHexInt:&rgb];
    if (c.length == 9) [[NSScanner scannerWithString:[c substringWithRange:NSMakeRange(7, 2)]] scanHexInt:&a];
    return [UIColor colorWithRed:((rgb >> 16) & 255) / 255.0 green:((rgb >> 8) & 255) / 255.0 blue:(rgb & 255) / 255.0 alpha:a / 255.0];
  }
  return fallback;
}

static double CCLuminance(UIColor *color) {
  CGFloat r = 0, g = 0, b = 0, a = 0;
  [color getRed:&r green:&g blue:&b alpha:&a];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/// The bundled Lora / Work Sans / Inconsolata files (PostScript names, see UIAppFonts in Info.plist), by type-style id.
static NSString *CCFontFile(NSString *font) {
  static NSDictionary<NSString *, NSString *> *map;
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    map = @{ @"lora": @"Lora-Regular", @"loraMedium": @"Lora-Medium", @"loraBold": @"Lora-Bold",
             @"worksans": @"WorkSans-Regular", @"workMedium": @"WorkSans-Medium", @"workSemi": @"WorkSans-SemiBold",
             @"workBold": @"WorkSans-Bold", @"workExtra": @"WorkSans-ExtraBold",
             @"mono": @"Inconsolata-Regular", @"monoBold": @"Inconsolata-Bold" };
  });
  return map[font];
}

static UIFont *CCFontFor(NSString *font, CGFloat size) {
  NSString *file = CCFontFile(font);
  if (file) return [UIFont fontWithName:file size:size] ?: [UIFont boldSystemFontOfSize:size];
  if ([font isEqualToString:@"classic"]) return [UIFont fontWithName:@"TimesNewRomanPS-BoldMT" size:size] ?: [UIFont boldSystemFontOfSize:size];
  if ([font isEqualToString:@"typewriter"]) return [UIFont fontWithName:@"Courier" size:size] ?: [UIFont monospacedSystemFontOfSize:size weight:UIFontWeightRegular];
  if ([font isEqualToString:@"bold"]) return [UIFont systemFontOfSize:size weight:UIFontWeightBlack];
  if ([font isEqualToString:@"italic"]) return [UIFont fontWithName:@"TimesNewRomanPS-ItalicMT" size:size] ?: [UIFont italicSystemFontOfSize:size];
  if ([font isEqualToString:@"neon"]) return [UIFont systemFontOfSize:size weight:UIFontWeightMedium];
  return [UIFont boldSystemFontOfSize:size];
}

static CGFloat CCLineStart(NSString *align, CGFloat blockW, CGFloat lineW) {
  if ([align isEqualToString:@"left"]) return -blockW / 2;
  if ([align isEqualToString:@"right"]) return blockW / 2 - lineW;
  return -lineW / 2;
}

/// Draws one text layer (same layout rules as the Android and web renderers). Returns x, y, w, h (before turning), centre x, y, turn.
static NSArray<NSNumber *> *CCDrawText(CGContextRef ctx, CGFloat outW, CGFloat outH, NSDictionary *t, NSString *bodyIn) {
  NSString *font = t[@"font"] ?: @"modern";
  NSString *align = t[@"align"] ?: @"center";
  NSString *backdrop = t[@"backdrop"] ?: @"none";
  CGFloat rotate = [t[@"rotate"] doubleValue];
  BOOL outline = [t[@"outline"] boolValue];
  BOOL shadow = t[@"shadow"] ? [t[@"shadow"] boolValue] : YES;
  NSString *body = [font isEqualToString:@"bold"] ? bodyIn.uppercaseString : bodyIn;
  BOOL boldFlag = [t[@"bold"] boolValue];
  BOOL italicFlag = [t[@"italic"] boolValue];
  CGFloat letterSpacing = t[@"letterSpacing"] ? [t[@"letterSpacing"] doubleValue] / 100.0 : 0; // em
  CGFloat lineHeight = t[@"lineHeight"] ? [t[@"lineHeight"] doubleValue] : 1.25;
  CGFloat opacity = MIN(100.0, MAX(5.0, t[@"opacity"] ? [t[@"opacity"] doubleValue] : 100.0)) / 100.0;
  CGFloat strokeWidth = t[@"strokeWidth"] ? [t[@"strokeWidth"] doubleValue] : 14; // percent of the text size
  NSString *strokeColorStr = [t[@"strokeColor"] isKindOfClass:NSString.class] ? t[@"strokeColor"] : @"";
  NSString *shadowColorStr = [t[@"shadowColor"] isKindOfClass:NSString.class] ? t[@"shadowColor"] : @"";
  CGFloat shadowBlur = t[@"shadowBlur"] ? [t[@"shadowBlur"] doubleValue] / 100.0 : 0.18;

  CGFloat fontPx = MAX(10.0, outW * (t[@"size"] ? [t[@"size"] doubleValue] : 8) / 100.0);
  UIFont *uiFont = CCFontFor(font, fontPx);
  if (boldFlag || italicFlag) {
    UIFontDescriptorSymbolicTraits traits = uiFont.fontDescriptor.symbolicTraits | (boldFlag ? UIFontDescriptorTraitBold : 0) | (italicFlag ? UIFontDescriptorTraitItalic : 0);
    UIFontDescriptor *desc = [uiFont.fontDescriptor fontDescriptorWithSymbolicTraits:traits];
    if (desc) uiFont = [UIFont fontWithDescriptor:desc size:fontPx] ?: uiFont;
  }
  CGFloat kern = letterSpacing * fontPx;
  NSDictionary *measureAttrs = @{ NSFontAttributeName: uiFont, NSKernAttributeName: @(kern) };
  CGFloat (^measure)(NSString *) = ^CGFloat(NSString *s) { return [s sizeWithAttributes:measureAttrs].width; };

  CGFloat maxWidth = outW * 0.85;
  NSMutableArray<NSString *> *lines = [NSMutableArray new];
  for (NSString *para in [body componentsSeparatedByString:@"\n"]) {
    NSMutableString *line = [NSMutableString new];
    for (NSString *word in [para componentsSeparatedByString:@" "]) {
      NSString *test = line.length ? [NSString stringWithFormat:@"%@ %@", line, word] : word;
      if (line.length && measure(test) > maxWidth) {
        [lines addObject:[line copy]];
        line = [NSMutableString stringWithString:word];
      } else {
        line = [NSMutableString stringWithString:test];
      }
    }
    [lines addObject:[line copy]];
  }

  CGFloat lineH = fontPx * MAX(0.6, lineHeight);
  CGFloat textW = 0;
  for (NSString *l in lines) textW = MAX(textW, measure(l));
  CGFloat padX = fontPx * 0.5;
  CGFloat padY = fontPx * 0.3;
  CGFloat boxW = textW + padX * 2;
  CGFloat boxH = (lines.count - 1) * lineH + fontPx * 1.2 + padY * 2;
  CGFloat cx = (t[@"x"] ? [t[@"x"] doubleValue] : 50) / 100.0 * outW;
  CGFloat cy = (t[@"y"] ? [t[@"y"] doubleValue] : 50) / 100.0 * outH;

  UIColor *color = CCColor(t[@"color"], UIColor.whiteColor);
  UIColor *bg = CCColor(t[@"bg"], [UIColor colorWithWhite:0 alpha:0.6]);
  // the line's baseline sits so that the glyph box is centred on the line's middle
  CGFloat baselineShift = (uiFont.ascender + uiFont.descender) / 2.0;

  CGContextSaveGState(ctx);
  CGContextTranslateCTM(ctx, cx, cy);
  CGContextRotateCTM(ctx, rotate * M_PI / 180.0);
  // the whole layer (box, outline, shadow and letters) fades together
  if (opacity < 1.0) {
    CGContextSetAlpha(ctx, opacity);
    CGContextBeginTransparencyLayer(ctx, NULL);
  }

  CGFloat bgRadius = fontPx * (t[@"bgRadius"] ? [t[@"bgRadius"] doubleValue] : ([backdrop isEqualToString:@"highlight"] ? 22 : 30)) / 100.0;
  CGContextSetFillColorWithColor(ctx, bg.CGColor);
  if ([backdrop isEqualToString:@"box"]) {
    UIBezierPath *path = [UIBezierPath bezierPathWithRoundedRect:CGRectMake(-boxW / 2, -boxH / 2, boxW, boxH) cornerRadius:bgRadius];
    CGContextAddPath(ctx, path.CGPath);
    CGContextFillPath(ctx);
  } else if ([backdrop isEqualToString:@"highlight"]) {
    for (NSUInteger i = 0; i < lines.count; i++) {
      CGFloat w = measure(lines[i]);
      CGFloat x = CCLineStart(align, textW, w);
      CGFloat yMid = -((CGFloat)(lines.count - 1) * lineH) / 2.0 + i * lineH;
      CGRect r = CGRectMake(x - padX, yMid - lineH / 2 + fontPx * 0.04, w + padX * 2, lineH);
      CGContextAddPath(ctx, [UIBezierPath bezierPathWithRoundedRect:r cornerRadius:bgRadius].CGPath);
      CGContextFillPath(ctx);
    }
  }

  for (NSUInteger i = 0; i < lines.count; i++) {
    NSString *l = lines[i];
    CGFloat x = CCLineStart(align, textW, measure(l));
    CGFloat baseline = -((CGFloat)(lines.count - 1) * lineH) / 2.0 + i * lineH + baselineShift;
    CGPoint origin = CGPointMake(x, baseline - uiFont.ascender);

    if ([font isEqualToString:@"neon"]) {
      // a glow of the text's own colour, then the letters on top
      NSDictionary *attrs = @{ NSFontAttributeName: uiFont, NSForegroundColorAttributeName: color, NSKernAttributeName: @(kern) };
      UIColor *glow = shadowColorStr.length ? CCColor(shadowColorStr, color) : color;
      CGContextSetShadowWithColor(ctx, CGSizeZero, fontPx * 0.6, glow.CGColor);
      [l drawAtPoint:origin withAttributes:attrs];
      CGContextSetShadowWithColor(ctx, CGSizeZero, fontPx * 0.25, glow.CGColor);
      [l drawAtPoint:origin withAttributes:attrs];
      CGContextSetShadowWithColor(ctx, CGSizeZero, 0, NULL);
      continue;
    }
    if (outline) {
      UIColor *stroke = strokeColorStr.length ? CCColor(strokeColorStr, UIColor.blackColor) : (CCLuminance(color) > 0.55 ? UIColor.blackColor : UIColor.whiteColor);
      // a positive stroke width draws the outline only; the fill goes on top afterwards
      [l drawAtPoint:origin withAttributes:@{ NSFontAttributeName: uiFont, NSKernAttributeName: @(kern), NSStrokeColorAttributeName: stroke, NSStrokeWidthAttributeName: @(strokeWidth) }];
    }
    if (shadow) {
      UIColor *sc = shadowColorStr.length ? CCColor(shadowColorStr, [UIColor colorWithWhite:0 alpha:0.65]) : [UIColor colorWithWhite:0 alpha:0.65];
      CGContextSetShadowWithColor(ctx, CGSizeMake(0, fontPx * 0.04), fontPx * shadowBlur, sc.CGColor);
    }
    [l drawAtPoint:origin withAttributes:@{ NSFontAttributeName: uiFont, NSKernAttributeName: @(kern), NSForegroundColorAttributeName: color }];
    CGContextSetShadowWithColor(ctx, CGSizeZero, 0, NULL);
  }
  if (opacity < 1.0) CGContextEndTransparencyLayer(ctx);
  CGContextRestoreGState(ctx);
  return @[ @(cx - boxW / 2), @(cy - boxH / 2), @(boxW), @(boxH), @(cx), @(cy), @(rotate) ];
}

@implementation PhotoRender

RCT_EXPORT_MODULE(PhotoRender)

+ (BOOL)requiresMainQueueSetup { return NO; }

- (dispatch_queue_t)methodQueue {
  return dispatch_queue_create("com.cinecraftconnect.photorender", DISPATCH_QUEUE_CONCURRENT);
}

#pragma mark - Photo

RCT_EXPORT_METHOD(info:(NSString *)uriString resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  CGSize size;
  if (!CCImageSize(CCURL(uriString), &size)) {
    reject(@"ERR_DECODE", @"This file is not a picture that can be edited", nil);
    return;
  }
  resolve(@{ @"width": @((NSInteger)size.width), @"height": @((NSInteger)size.height) });
}

RCT_EXPORT_METHOD(render:(NSString *)uriString
                  options:(NSString *)optionsJson
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  @autoreleasepool {
    NSDictionary *o = [NSJSONSerialization JSONObjectWithData:[optionsJson dataUsingEncoding:NSUTF8StringEncoding] options:0 error:nil];
    if (![o isKindOfClass:NSDictionary.class]) {
      reject(@"ERR_RENDER", @"Bad edit options", nil);
      return;
    }
    NSURL *url = CCURL(uriString);
    CGSize base;
    if (!CCImageSize(url, &base)) {
      reject(@"ERR_DECODE", @"This file is not a picture that can be edited", nil);
      return;
    }

    NSInteger rotate = (([o[@"rotate"] integerValue] % 360) + 360) % 360;
    BOOL flipH = [o[@"flipH"] boolValue];
    BOOL whole = [o[@"whole"] boolValue];
    NSInteger maxEdge = MAX(16, o[@"maxEdge"] ? [o[@"maxEdge"] integerValue] : 1440);
    double quality = MIN(100, MAX(10, o[@"quality"] ? [o[@"quality"] integerValue] : 85)) / 100.0;
    BOOL withText = o[@"withText"] ? [o[@"withText"] boolValue] : YES;

    NSDictionary *crop = [o[@"crop"] isKindOfClass:NSDictionary.class] && !whole ? o[@"crop"] : nil;
    double cropX = crop[@"x"] ? [crop[@"x"] doubleValue] : 0, cropY = crop[@"y"] ? [crop[@"y"] doubleValue] : 0;
    double cropW = crop[@"w"] ? [crop[@"w"] doubleValue] : 1, cropH = crop[@"h"] ? [crop[@"h"] doubleValue] : 1;

    BOOL turnSwap = rotate == 90 || rotate == 270;
    CGFloat turnedW = turnSwap ? base.height : base.width;
    CGFloat turnedH = turnSwap ? base.width : base.height;
    NSInteger cx = (NSInteger)llround(cropX * turnedW), cy = (NSInteger)llround(cropY * turnedH);
    NSInteger cw = MAX(1, (NSInteger)llround(cropW * turnedW)), ch = MAX(1, (NSInteger)llround(cropH * turnedH));
    CGFloat scale = MIN(1.0, (CGFloat)maxEdge / (CGFloat)MAX(cw, ch));
    NSInteger outW = MAX(1, (NSInteger)lround(cw * scale)), outH = MAX(1, (NSInteger)lround(ch * scale));

    // read the picture no bigger than needed (the thumbnail call also applies the camera's rotation)
    CGImageSourceRef source = CGImageSourceCreateWithURL((__bridge CFURLRef)url, NULL);
    if (!source) {
      reject(@"ERR_OPEN", @"Could not open the photo", nil);
      return;
    }
    CGFloat want = ceil(MAX(base.width, base.height) * scale);
    NSDictionary *thumbOptions = @{
      (id)kCGImageSourceCreateThumbnailFromImageAlways: @YES,
      (id)kCGImageSourceCreateThumbnailWithTransform: @YES,
      (id)kCGImageSourceShouldCacheImmediately: @YES,
      (id)kCGImageSourceThumbnailMaxPixelSize: @(MAX(1.0, want)),
    };
    CGImageRef decoded = CGImageSourceCreateThumbnailAtIndex(source, 0, (__bridge CFDictionaryRef)thumbOptions);
    CFRelease(source);
    if (!decoded) {
      reject(@"ERR_DECODE", @"This file is not a picture that can be edited", nil);
      return;
    }
    CGFloat dW = CGImageGetWidth(decoded), dH = CGImageGetHeight(decoded);

    CGColorSpaceRef rgb = CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
    CGContextRef ctx = CGBitmapContextCreate(NULL, outW, outH, 8, 0, rgb, kCGImageAlphaPremultipliedLast | kCGBitmapByteOrder32Big);
    if (!ctx) {
      CGColorSpaceRelease(rgb);
      CGImageRelease(decoded);
      reject(@"ERR_MEMORY", @"This photo is too big to edit on this phone", nil);
      return;
    }
    // top-left origin, like the other platforms
    CGContextTranslateCTM(ctx, 0, outH);
    CGContextScaleCTM(ctx, 1, -1);
    CGContextSetInterpolationQuality(ctx, kCGInterpolationHigh);
    CGContextSetRGBFillColor(ctx, 0, 0, 0, 1);
    CGContextFillRect(ctx, CGRectMake(0, 0, outW, outH));

    // one transform: decoded pixels -> full-size photo -> our turn and flip -> crop -> result size
    CGAffineTransform m = CGAffineTransformMakeScale(base.width / dW, base.height / dH);
    m = CGAffineTransformConcat(m, CGAffineTransformMakeTranslation(-base.width / 2, -base.height / 2));
    if (rotate != 0) m = CGAffineTransformConcat(m, CGAffineTransformMakeRotation(rotate * M_PI / 180.0));
    if (flipH) m = CGAffineTransformConcat(m, CGAffineTransformMakeScale(-1, 1));
    m = CGAffineTransformConcat(m, CGAffineTransformMakeTranslation(turnedW / 2, turnedH / 2));
    m = CGAffineTransformConcat(m, CGAffineTransformMakeTranslation(-cx, -cy));
    m = CGAffineTransformConcat(m, CGAffineTransformMakeScale(scale, scale));

    CGContextSaveGState(ctx);
    CGContextConcatCTM(ctx, m);
    // CGContextDrawImage draws upright in a y-up context; we flipped to y-down, so flip once more around the image.
    CGContextTranslateCTM(ctx, 0, dH);
    CGContextScaleCTM(ctx, 1, -1);
    CGContextDrawImage(ctx, CGRectMake(0, 0, dW, dH), decoded);
    CGContextRestoreGState(ctx);
    CGImageRelease(decoded);

    // colour: the same 20 numbers as the web editor (rows R, G, B, A; the last column is the offset, on a 0..1 scale)
    NSArray *mx = [o[@"matrix"] isKindOfClass:NSArray.class] ? o[@"matrix"] : nil;
    if (mx.count == 20) {
      float f[20];
      for (int i = 0; i < 20; i++) f[i] = [mx[i] floatValue];
      uint8_t *px = (uint8_t *)CGBitmapContextGetData(ctx);
      size_t rowBytes = CGBitmapContextGetBytesPerRow(ctx);
      for (NSInteger y = 0; y < outH; y++) {
        uint8_t *row = px + y * rowBytes;
        for (NSInteger x = 0; x < outW; x++) {
          uint8_t *p = row + x * 4;
          float r = p[0] / 255.f, g = p[1] / 255.f, b = p[2] / 255.f;
          float nr = f[0] * r + f[1] * g + f[2] * b + f[4];
          float ng = f[5] * r + f[6] * g + f[7] * b + f[9];
          float nb = f[10] * r + f[11] * g + f[12] * b + f[14];
          p[0] = (uint8_t)(fminf(1.f, fmaxf(0.f, nr)) * 255.f + 0.5f);
          p[1] = (uint8_t)(fminf(1.f, fmaxf(0.f, ng)) * 255.f + 0.5f);
          p[2] = (uint8_t)(fminf(1.f, fmaxf(0.f, nb)) * 255.f + 0.5f);
        }
      }
    }

    // vignette
    NSDictionary *vig = [o[@"vignette"] isKindOfClass:NSDictionary.class] ? o[@"vignette"] : nil;
    if (vig && [vig[@"strength"] doubleValue] > 0) {
      CGFloat start = vig[@"start"] ? [vig[@"start"] doubleValue] : 0.5;
      CGFloat alpha = MIN(1.0, MAX(0.0, [vig[@"alpha"] doubleValue]));
      CGFloat radius = hypot(outW, outH) / 2;
      CGFloat colors[8] = { 0, 0, 0, 0, 0, 0, 0, alpha };
      CGFloat locations[2] = { 0, 1 };
      CGGradientRef gradient = CGGradientCreateWithColorComponents(rgb, colors, locations, 2);
      CGContextDrawRadialGradient(ctx, gradient, CGPointMake(outW / 2.0, outH / 2.0), radius * start, CGPointMake(outW / 2.0, outH / 2.0), radius, kCGGradientDrawsAfterEndLocation);
      CGGradientRelease(gradient);
    }

    // text, last, so the colour change never touches it
    NSMutableArray *boxes = [NSMutableArray new];
    NSArray *text = [o[@"text"] isKindOfClass:NSArray.class] ? o[@"text"] : nil;
    if (withText && text.count) {
      UIGraphicsPushContext(ctx);
      for (NSDictionary *t in text) {
        if (![t isKindOfClass:NSDictionary.class]) continue;
        NSString *body = [t[@"text"] isKindOfClass:NSString.class] ? t[@"text"] : @"";
        if ([body stringByTrimmingCharactersInSet:NSCharacterSet.whitespaceAndNewlineCharacterSet].length == 0) continue;
        NSArray<NSNumber *> *box = CCDrawText(ctx, outW, outH, t, body);
        [boxes addObject:@{
          @"id": t[@"id"] ?: @"",
          @"x": box[0], @"y": box[1], @"w": box[2], @"h": box[3], @"cx": box[4], @"cy": box[5], @"rotate": box[6],
        }];
      }
      UIGraphicsPopContext();
    }

    CGImageRef result = CGBitmapContextCreateImage(ctx);
    CGContextRelease(ctx);
    CGColorSpaceRelease(rgb);
    if (!result) {
      reject(@"ERR_RENDER", @"Could not draw the picture", nil);
      return;
    }
    NSString *path = CCTempPath(@"edit_", @"jpg");
    BOOL ok = CCWriteJPEG(result, path, quality);
    CGImageRelease(result);
    if (!ok) {
      reject(@"ERR_RENDER", @"Could not save the picture", nil);
      return;
    }
    resolve(@{
      @"uri": [NSURL fileURLWithPath:path].absoluteString,
      @"width": @(outW),
      @"height": @(outH),
      @"size": @(CCFileSize(path)),
      @"mime": @"image/jpeg",
      @"boxes": boxes,
    });
  }
}

#pragma mark - Video

static AVURLAsset *CCAsset(NSString *uriString) {
  return [AVURLAsset URLAssetWithURL:CCURL(uriString) options:@{ AVURLAssetPreferPreciseDurationAndTimingKey: @YES }];
}

RCT_EXPORT_METHOD(videoInfo:(NSString *)uriString resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  AVURLAsset *asset = CCAsset(uriString);
  AVAssetTrack *video = [asset tracksWithMediaType:AVMediaTypeVideo].firstObject;
  double seconds = CMTimeGetSeconds(asset.duration);
  if (!video || !isfinite(seconds) || seconds <= 0) {
    reject(@"ERR_VIDEO", @"This file is not a video that can be edited", nil);
    return;
  }
  CGSize shown = CGSizeApplyAffineTransform(video.naturalSize, video.preferredTransform);
  resolve(@{
    @"duration": @(llround(seconds * 1000)),
    @"width": @((NSInteger)fabs(shown.width)),
    @"height": @((NSInteger)fabs(shown.height)),
    @"hasAudio": @([asset tracksWithMediaType:AVMediaTypeAudio].count > 0),
  });
}

/// One still of the video, shrunk so its longest side is at most maxEdge, saved as a JPEG: {uri, width, height}.
static NSDictionary *CCSaveFrame(AVAssetImageGenerator *generator, CMTime time, NSInteger maxEdge, NSError **error) {
  CGImageRef frame = [generator copyCGImageAtTime:time actualTime:NULL error:error];
  if (!frame) return nil;
  NSString *path = CCTempPath(@"edit_frame_", @"jpg");
  BOOL ok = CCWriteJPEG(frame, path, 0.8);
  NSDictionary *result = ok ? @{
    @"uri": [NSURL fileURLWithPath:path].absoluteString,
    @"width": @(CGImageGetWidth(frame)),
    @"height": @(CGImageGetHeight(frame)),
  } : nil;
  CGImageRelease(frame);
  return result;
}

static AVAssetImageGenerator *CCGenerator(AVURLAsset *asset, NSInteger maxEdge) {
  AVAssetImageGenerator *generator = [AVAssetImageGenerator assetImageGeneratorWithAsset:asset];
  generator.appliesPreferredTrackTransform = YES;
  // like Android's "closest sync frame": quick, and exact enough for a trimmer
  generator.requestedTimeToleranceBefore = kCMTimePositiveInfinity;
  generator.requestedTimeToleranceAfter = kCMTimePositiveInfinity;
  if (maxEdge > 0) generator.maximumSize = CGSizeMake(maxEdge, maxEdge);
  return generator;
}

RCT_EXPORT_METHOD(videoFrame:(NSString *)uriString
                  timeMs:(double)timeMs
                  maxEdge:(NSInteger)maxEdge
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  AVURLAsset *asset = CCAsset(uriString);
  NSError *error = nil;
  NSDictionary *frame = CCSaveFrame(CCGenerator(asset, maxEdge), CMTimeMakeWithSeconds(timeMs / 1000.0, 600), maxEdge, &error);
  if (frame) resolve(frame); else reject(@"ERR_VIDEO", error.localizedDescription ?: @"No picture at this time", error);
}

RCT_EXPORT_METHOD(videoFrames:(NSString *)uriString
                  count:(NSInteger)count
                  maxEdge:(NSInteger)maxEdge
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  AVURLAsset *asset = CCAsset(uriString);
  double seconds = CMTimeGetSeconds(asset.duration);
  if (!isfinite(seconds) || seconds <= 0) {
    reject(@"ERR_VIDEO", @"This file is not a video that can be edited", nil);
    return;
  }
  AVAssetImageGenerator *generator = CCGenerator(asset, maxEdge);
  NSInteger n = MAX(1, count);
  NSMutableArray<NSString *> *uris = [NSMutableArray new];
  for (NSInteger i = 0; i < n; i++) {
    NSError *error = nil;
    NSDictionary *frame = CCSaveFrame(generator, CMTimeMakeWithSeconds((i + 0.5) / n * seconds, 600), maxEdge, &error);
    if (!frame) {
      reject(@"ERR_VIDEO", error.localizedDescription ?: @"No picture at this time", error);
      return;
    }
    [uris addObject:frame[@"uri"]];
  }
  resolve(uris);
}

/// Keeps [startMs, endMs] without re-encoding. With mute, the sound is left out.
RCT_EXPORT_METHOD(trimVideo:(NSString *)uriString
                  startMs:(double)startMs
                  endMs:(double)endMs
                  mute:(BOOL)mute
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  AVURLAsset *asset = CCAsset(uriString);
  AVAssetTrack *sourceVideo = [asset tracksWithMediaType:AVMediaTypeVideo].firstObject;
  if (!sourceVideo) {
    reject(@"ERR_VIDEO", @"This file has no video to cut", nil);
    return;
  }
  CMTimeRange range = CMTimeRangeFromTimeToTime(CMTimeMakeWithSeconds(startMs / 1000.0, 600), CMTimeMakeWithSeconds(endMs / 1000.0, 600));

  AVMutableComposition *composition = [AVMutableComposition composition];
  NSError *error = nil;
  AVMutableCompositionTrack *video = [composition addMutableTrackWithMediaType:AVMediaTypeVideo preferredTrackID:kCMPersistentTrackID_Invalid];
  [video insertTimeRange:range ofTrack:sourceVideo atTime:kCMTimeZero error:&error];
  video.preferredTransform = sourceVideo.preferredTransform;
  AVAssetTrack *sourceAudio = mute ? nil : [asset tracksWithMediaType:AVMediaTypeAudio].firstObject;
  if (!error && sourceAudio) {
    AVMutableCompositionTrack *audio = [composition addMutableTrackWithMediaType:AVMediaTypeAudio preferredTrackID:kCMPersistentTrackID_Invalid];
    [audio insertTimeRange:range ofTrack:sourceAudio atTime:kCMTimeZero error:&error];
  }
  if (error) {
    reject(@"ERR_TRIM", error.localizedDescription, error);
    return;
  }

  AVAssetExportSession *export = [[AVAssetExportSession alloc] initWithAsset:composition presetName:AVAssetExportPresetPassthrough];
  if (!export) {
    reject(@"ERR_TRIM", @"This video cannot be cut on this phone", nil);
    return;
  }
  AVFileType type = [export.supportedFileTypes containsObject:AVFileTypeMPEG4] ? AVFileTypeMPEG4 : AVFileTypeQuickTimeMovie;
  NSString *ext = [type isEqualToString:AVFileTypeMPEG4] ? @"mp4" : @"mov";
  NSString *path = CCTempPath(@"edit_trim_", ext);
  export.outputURL = [NSURL fileURLWithPath:path];
  export.outputFileType = type;
  export.shouldOptimizeForNetworkUse = YES;
  [export exportAsynchronouslyWithCompletionHandler:^{
    if (export.status == AVAssetExportSessionStatusCompleted) {
      resolve(@{
        @"uri": [NSURL fileURLWithPath:path].absoluteString,
        @"size": @(CCFileSize(path)),
        @"mime": [type isEqualToString:AVFileTypeMPEG4] ? @"video/mp4" : @"video/quicktime",
      });
    } else {
      [NSFileManager.defaultManager removeItemAtPath:path error:nil];
      reject(@"ERR_TRIM", export.error.localizedDescription ?: @"Could not cut the video", export.error);
    }
  }];
}

#pragma mark - Cleanup

/// Deletes a temporary file made by this module (only inside the app's cache folder, only names starting with "edit_").
RCT_EXPORT_METHOD(release:(NSString *)uriString resolver:(RCTPromiseResolveBlock)resolve rejecter:(RCTPromiseRejectBlock)reject)
{
  NSString *path = CCURL(uriString).path;
  NSString *dir = [NSTemporaryDirectory() stringByAppendingPathComponent:@"cinecraft_media_cache"];
  if (path.length && [path.stringByDeletingLastPathComponent.stringByStandardizingPath isEqualToString:dir.stringByStandardizingPath] &&
      [path.lastPathComponent hasPrefix:@"edit_"]) {
    [NSFileManager.defaultManager removeItemAtPath:path error:nil];
  }
  resolve(@YES);
}

@end
