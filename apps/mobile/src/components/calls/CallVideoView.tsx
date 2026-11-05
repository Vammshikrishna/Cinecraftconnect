import * as React from 'react';
import { Platform, StyleSheet, View, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import { LocalVideoTrack, RemoteVideoTrack, Track, TrackEvent, type ElementInfo, type VideoTrack } from 'livekit-client';
import { RTCPIPView } from '@livekit/react-native-webrtc';

type Props = {
  videoTrack?: VideoTrack | undefined;
  style?: ViewStyle;
  objectFit?: 'cover' | 'contain';
  mirror?: boolean;
  zOrder?: number;
  /**
   * iOS only: this video becomes the picture-in-picture window when the app goes to the background during a call. Only one
   * mounted CallVideoView at a time should set it. Ignored on Android (it has its own PiP window, see pipService.ts).
   */
  pip?: boolean;
};

/** Reports the view size to LiveKit so remote adaptive streams pick a matching quality (what the stock VideoView does). */
class CallVideoElementInfo implements ElementInfo {
  element: object = {};
  id?: string;
  _width = 0;
  _height = 0;
  _observing = false;
  visible = true;
  visibilityChangedAt: number | undefined;
  // true keeps the stream flowing while the app is in the picture-in-picture window
  pictureInPicture = true;
  handleResize?: () => void;
  handleVisibilityChanged?: () => void;
  width = () => this._width;
  height = () => this._height;
  observe(): void {
    this._observing = true;
  }
  stopObserving(): void {
    this._observing = false;
  }
  onLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    this._width = width;
    this._height = height;
    if (this._observing) this.handleResize?.();
  }
}

/**
 * Drop-in for LiveKit's (deprecated) VideoView with one addition: iOS picture-in-picture. The stock VideoView has no PiP, and
 * the newer VideoTrack component needs a TrackReference that this app's call state does not carry.
 */
export function CallVideoView({ videoTrack, style, objectFit = 'cover', mirror, zOrder, pip }: Props) {
  const [elementInfo] = React.useState(() => {
    const info = new CallVideoElementInfo();
    info.id = videoTrack?.sid;
    return info;
  });
  const [mediaStream, setMediaStream] = React.useState<any>(videoTrack?.mediaStream);

  React.useEffect(() => {
    setMediaStream(videoTrack?.mediaStream);
    if (videoTrack instanceof LocalVideoTrack) {
      const onRestarted = (track: Track | null) => setMediaStream(track?.mediaStream);
      videoTrack.on(TrackEvent.Restarted, onRestarted);
      return () => {
        videoTrack.off(TrackEvent.Restarted, onRestarted);
      };
    }
    return undefined;
  }, [videoTrack]);

  React.useEffect(() => {
    if (videoTrack instanceof RemoteVideoTrack && videoTrack.isAdaptiveStream) {
      videoTrack.observeElementInfo(elementInfo);
      return () => videoTrack.stopObservingElementInfo(elementInfo);
    }
    return undefined;
  }, [videoTrack, elementInfo]);

  const iosPIP = React.useMemo(
    () => (Platform.OS === 'ios' && pip ? { enabled: true, startAutomatically: true, preferredSize: { width: 9, height: 16 } } : undefined),
    [pip],
  );

  return (
    <View style={[style, styles.container]} onLayout={(e) => elementInfo.onLayout(e)}>
      <RTCPIPView
        style={styles.video}
        streamURL={mediaStream?.toURL() ?? ''}
        objectFit={objectFit}
        zOrder={zOrder}
        mirror={mirror}
        iosPIP={iosPIP}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  video: { flex: 1, width: '100%' },
});
