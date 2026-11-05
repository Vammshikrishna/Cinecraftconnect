import React, { useEffect, useRef } from 'react';
import { findNodeHandle, NativeModules, Platform } from 'react-native';
import { ScreenCapturePickerView as NativePicker } from '@livekit/react-native-webrtc';
import { registerScreenSharePicker } from '../../services/liveCall';

const ScreenCapturePickerView: any = NativePicker; // the library types it without props

/**
 * iOS only. Starting a screen share needs the system "Start Broadcast" sheet (ReplayKit). WebRTC ships an invisible native
 * button for it; this keeps one mounted for the whole session and hands liveCall.ts a function that presses it.
 */
export function ScreenSharePickerHost() {
  const ref = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS !== 'ios') return undefined;
    registerScreenSharePicker(() => {
      const tag = findNodeHandle(ref.current);
      if (tag) NativeModules.ScreenCapturePickerViewManager?.show?.(tag);
    });
    return () => registerScreenSharePicker(null);
  }, []);

  if (Platform.OS !== 'ios') return null;
  return <ScreenCapturePickerView ref={ref} style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} pointerEvents="none" />;
}
