import { VideoPresets, AudioPresets, ScreenSharePresets, RoomOptions } from 'livekit-client';

/**
 * Quality/bandwidth settings shared by every LiveKit call room on web. Defined once at module level so
 * <LiveKitRoom> does not rebuild the Room when a component re-renders.
 */
export const CALL_ROOM_OPTIONS: RoomOptions = {
  // Only download the video resolution each tile actually displays, and pause video that is off-screen/hidden.
  adaptiveStream: true,
  // Stop publishing video layers that nobody is subscribed to (big saving in group calls).
  dynacast: true,
  stopLocalTrackOnUnpublish: true,
  audioCaptureDefaults: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
  videoCaptureDefaults: {
    resolution: VideoPresets.h720.resolution,
    facingMode: 'user',
  },
  publishDefaults: {
    simulcast: true,
    // Opus tuned for speech: discontinuous transmission saves bandwidth, RED adds packet-loss resilience.
    dtx: true,
    red: true,
    audioPreset: AudioPresets.speech,
    videoSimulcastLayers: [VideoPresets.h360, VideoPresets.h180],
    videoEncoding: VideoPresets.h720.encoding,
    screenShareEncoding: ScreenSharePresets.h1080fps15.encoding,
    // Under congestion keep frame rate for talking heads, drop resolution first.
    degradationPreference: 'maintain-framerate',
  },
};
