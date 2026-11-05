#import <AVFoundation/AVFoundation.h>
#import <React/RCTBridgeModule.h>

/**
 * iOS counterpart of the Android CallService module (see src/services/liveCall.ts).
 *
 * On Android this is a foreground service plus the dial / busy tones. iOS has no foreground service: a call stays alive in the
 * background through the "audio" background mode in Info.plist and the audio session LiveKit starts, so start / stop are no-ops
 * here. The dial (ringback) and busy tones are generated in code, so there are no audio files to ship.
 */
@interface CallService : NSObject <RCTBridgeModule>
@end

/// A two-frequency tone pattern as an in-memory 16-bit mono WAV. `pattern` alternates on / off seconds, starting with "on".
static NSData *CCToneWav(double f1, double f2, NSArray<NSNumber *> *pattern) {
  const int sampleRate = 16000;
  NSMutableData *pcm = [NSMutableData data];
  BOOL on = YES;
  for (NSNumber *seconds in pattern) {
    int count = (int)(seconds.doubleValue * sampleRate);
    NSMutableData *segment = [NSMutableData dataWithLength:(NSUInteger)count * 2];
    int16_t *samples = (int16_t *)segment.mutableBytes;
    if (on) {
      int fade = sampleRate / 100; // 10 ms ramps so the tone does not click
      for (int i = 0; i < count; i++) {
        double t = (double)i / sampleRate;
        double v = 0.30 * 0.5 * (sin(2.0 * M_PI * f1 * t) + sin(2.0 * M_PI * f2 * t));
        if (i < fade) v *= (double)i / fade;
        else if (i > count - fade) v *= (double)(count - i) / fade;
        samples[i] = (int16_t)(v * 32767.0);
      }
    }
    [pcm appendData:segment];
    on = !on;
  }

  uint32_t dataLength = (uint32_t)pcm.length;
  uint32_t riffLength = 36 + dataLength;
  uint32_t fmtLength = 16, byteRate = sampleRate * 2, rate = sampleRate;
  uint16_t pcmFormat = 1, channels = 1, blockAlign = 2, bits = 16;
  NSMutableData *wav = [NSMutableData dataWithCapacity:44 + dataLength];
  [wav appendBytes:"RIFF" length:4]; [wav appendBytes:&riffLength length:4];
  [wav appendBytes:"WAVE" length:4]; [wav appendBytes:"fmt " length:4];
  [wav appendBytes:&fmtLength length:4]; [wav appendBytes:&pcmFormat length:2];
  [wav appendBytes:&channels length:2]; [wav appendBytes:&rate length:4];
  [wav appendBytes:&byteRate length:4]; [wav appendBytes:&blockAlign length:2];
  [wav appendBytes:&bits length:2]; [wav appendBytes:"data" length:4];
  [wav appendBytes:&dataLength length:4]; [wav appendData:pcm];
  return wav; // arm64 is little-endian, which is what WAV expects
}

@implementation CallService {
  AVAudioPlayer *_ringback;
  AVAudioPlayer *_busy;
}

RCT_EXPORT_MODULE(CallService)

+ (BOOL)requiresMainQueueSetup { return NO; }

- (dispatch_queue_t)methodQueue { return dispatch_get_main_queue(); }

/// Dialling happens before LiveKit starts its own session, so make sure the tones are audible and use the call routing (earpiece by default).
- (void)prepareSession {
  AVAudioSession *session = AVAudioSession.sharedInstance;
  NSError *error = nil;
  [session setCategory:AVAudioSessionCategoryPlayAndRecord
                  mode:AVAudioSessionModeVoiceChat
               options:AVAudioSessionCategoryOptionAllowBluetooth
                 error:&error];
  [session setActive:YES error:nil];
  if (error) NSLog(@"[CallService] audio session: %@", error);
}

- (AVAudioPlayer *)playerWithFrequencies:(double)f1 and:(double)f2 pattern:(NSArray<NSNumber *> *)pattern loops:(NSInteger)loops {
  NSError *error = nil;
  AVAudioPlayer *player = [[AVAudioPlayer alloc] initWithData:CCToneWav(f1, f2, pattern) error:&error];
  if (!player) { NSLog(@"[CallService] tone: %@", error); return nil; }
  player.numberOfLoops = loops;
  player.volume = 1.0;
  [player prepareToPlay];
  return player;
}

RCT_EXPORT_METHOD(startRingback:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  if (!_ringback.isPlaying) {
    [self prepareSession];
    // North-American ringback: 440 + 480 Hz, 2 s on, 4 s off, repeated until stopRingback.
    _ringback = [self playerWithFrequencies:440 and:480 pattern:@[ @2.0, @4.0 ] loops:-1];
    [_ringback play];
  }
  resolve(@YES);
}

RCT_EXPORT_METHOD(stopRingback:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [_ringback stop];
  _ringback = nil;
  resolve(@YES);
}

RCT_EXPORT_METHOD(playBusy:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [_ringback stop];
  _ringback = nil;
  [self prepareSession];
  // Busy signal: 480 + 620 Hz, four 0.5 s beeps.
  _busy = [self playerWithFrequencies:480 and:620 pattern:@[ @0.5, @0.5, @0.5, @0.5, @0.5, @0.5, @0.5, @0.5 ] loops:0];
  [_busy play];
  resolve(@YES);
}

RCT_EXPORT_METHOD(start:(NSString *)title withMic:(BOOL)withMic resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  resolve(@YES); // nothing to start: see the note at the top of the file
}

RCT_EXPORT_METHOD(stop:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject)
{
  [_ringback stop];
  [_busy stop];
  _ringback = nil;
  _busy = nil;
  resolve(@YES);
}

@end
