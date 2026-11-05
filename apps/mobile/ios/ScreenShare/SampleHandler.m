#import <ReplayKit/ReplayKit.h>
#import <CoreImage/CoreImage.h>
#import <sys/socket.h>
#import <sys/un.h>

/**
 * ReplayKit broadcast upload extension for sharing the whole iPhone / iPad screen in a call.
 *
 * It talks to the app through a unix socket inside the App Group container (the app side is WebRTC's ScreenCaptureController,
 * which is the socket SERVER; this extension is the client). Each frame is one HTTP-style message: headers Content-Length,
 * Buffer-Width, Buffer-Height, Buffer-Orientation, then a JPEG body. That is exactly what react-native-webrtc's ScreenCapturer
 * reads, so nothing on the app side needs to change.
 *
 * A broadcast extension may use about 50 MB, so frames are scaled down and sent as JPEG, a few per second.
 */

static NSString *const kAppGroupKey = @"RTCAppGroupIdentifier";
static NSString *const kSocketFileName = @"rtc_SSFD";
static const CGFloat kMaxEdge = 1280;
static const CFTimeInterval kMinFrameInterval = 1.0 / 12.0;

@interface SampleHandler : RPBroadcastSampleHandler
@end

@implementation SampleHandler {
  int _socket;
  dispatch_queue_t _queue;
  CIContext *_context;
  CFTimeInterval _lastFrameTime;
  BOOL _sending;
}

- (void)broadcastStartedWithSetupInfo:(NSDictionary<NSString *, NSObject *> *)setupInfo {
  _socket = -1;
  _queue = dispatch_queue_create("com.cinecraftconnect.screenshare", DISPATCH_QUEUE_SERIAL);
  _context = [CIContext contextWithOptions:nil];

  NSString *group = NSBundle.mainBundle.infoDictionary[kAppGroupKey];
  NSURL *container = group.length ? [NSFileManager.defaultManager containerURLForSecurityApplicationGroupIdentifier:group] : nil;
  if (!container) {
    [self finishWithMessage:@"Screen sharing is not set up in this build (App Group missing)."];
    return;
  }
  NSString *path = [[container URLByAppendingPathComponent:kSocketFileName] path];

  // The app opens the socket when the call screen asks for the share; give it a moment.
  for (int attempt = 0; attempt < 20 && _socket < 0; attempt++) {
    _socket = [self connectToPath:path];
    if (_socket < 0) [NSThread sleepForTimeInterval:0.25];
  }
  if (_socket < 0) {
    [self finishWithMessage:@"Could not reach CineCraft Connect. Open the call and try again."];
  }
}

- (void)broadcastPaused {}
- (void)broadcastResumed {}

- (void)broadcastFinished {
  dispatch_sync(_queue, ^{
    if (self->_socket >= 0) {
      close(self->_socket);
      self->_socket = -1;
    }
  });
}

- (void)processSampleBuffer:(CMSampleBufferRef)sampleBuffer withType:(RPSampleBufferType)sampleBufferType {
  if (sampleBufferType != RPSampleBufferTypeVideo || _socket < 0) return;

  CFTimeInterval now = CACurrentMediaTime();
  if (_sending || now - _lastFrameTime < kMinFrameInterval) return;
  _lastFrameTime = now;

  CVPixelBufferRef pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer);
  if (!pixelBuffer) return;

  CGImagePropertyOrientation orientation = kCGImagePropertyOrientationUp;
  CFTypeRef attachment = CMGetAttachment(sampleBuffer, (__bridge CFStringRef)RPVideoSampleOrientationKey, NULL);
  if (attachment) orientation = (CGImagePropertyOrientation)[(__bridge NSNumber *)attachment unsignedIntValue];

  CIImage *image = [CIImage imageWithCVPixelBuffer:pixelBuffer];
  CGFloat longest = MAX(image.extent.size.width, image.extent.size.height);
  if (longest > kMaxEdge) {
    CGFloat scale = kMaxEdge / longest;
    image = [image imageByApplyingTransform:CGAffineTransformMakeScale(scale, scale)];
  }
  CGColorSpaceRef colorSpace = CGColorSpaceCreateWithName(kCGColorSpaceSRGB);
  NSData *jpeg = [_context JPEGRepresentationOfImage:image colorSpace:colorSpace options:@{ (id)kCGImageDestinationLossyCompressionQuality: @0.6 }];
  CGColorSpaceRelease(colorSpace);
  if (!jpeg) return;

  NSInteger width = (NSInteger)image.extent.size.width;
  NSInteger height = (NSInteger)image.extent.size.height;
  _sending = YES;
  dispatch_async(_queue, ^{
    NSString *head = [NSString stringWithFormat:@"POST / HTTP/1.1\r\nContent-Length: %lu\r\nBuffer-Width: %ld\r\nBuffer-Height: %ld\r\nBuffer-Orientation: %d\r\n\r\n",
                      (unsigned long)jpeg.length, (long)width, (long)height, (int)orientation];
    BOOL ok = self->_socket >= 0 && [self writeAll:[head dataUsingEncoding:NSUTF8StringEncoding]] && [self writeAll:jpeg];
    self->_sending = NO;
    if (!ok && self->_socket >= 0) {
      // The app closed its end: the person stopped the share (or ended the call) inside CineCraft Connect.
      close(self->_socket);
      self->_socket = -1;
      [self finishBroadcastWithError:[NSError errorWithDomain:@"CineCraftScreenShare" code:1 userInfo:@{ NSLocalizedDescriptionKey: @"Screen sharing ended." }]];
    }
  });
}

#pragma mark - Socket

- (int)connectToPath:(NSString *)path {
  int fd = socket(AF_UNIX, SOCK_STREAM, 0);
  if (fd < 0) return -1;
  int one = 1;
  setsockopt(fd, SOL_SOCKET, SO_NOSIGPIPE, &one, sizeof(one));

  struct sockaddr_un addr;
  memset(&addr, 0, sizeof(addr));
  addr.sun_family = AF_UNIX;
  strncpy(addr.sun_path, path.UTF8String, sizeof(addr.sun_path) - 1);
  if (connect(fd, (struct sockaddr *)&addr, sizeof(addr)) < 0) {
    close(fd);
    return -1;
  }
  return fd;
}

- (BOOL)writeAll:(NSData *)data {
  const uint8_t *bytes = data.bytes;
  size_t remaining = data.length;
  while (remaining > 0) {
    ssize_t written = send(_socket, bytes, remaining, 0);
    if (written <= 0) return NO;
    bytes += written;
    remaining -= (size_t)written;
  }
  return YES;
}

- (void)finishWithMessage:(NSString *)message {
  [self finishBroadcastWithError:[NSError errorWithDomain:@"CineCraftScreenShare" code:2 userInfo:@{ NSLocalizedDescriptionKey: message }]];
}

@end
