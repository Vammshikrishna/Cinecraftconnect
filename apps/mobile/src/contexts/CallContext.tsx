import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { setAutoPipEnabled } from '../services/pipService';
import { useUserSettings } from '../hooks/useUserSettings';
import {
  subscribeLiveCall,
  getLiveCallSnapshot,
  leaveLiveCall,
  setMicEnabled,
  setCameraEnabled,
  setSpeakerOn,
} from '../services/liveCall';

export interface ActiveCallState {
  isActive: boolean;
  isMinimized: boolean;
  roomId?: string;
  roomType?: string;
  roomName?: string;
  partnerName?: string;
  partnerId?: string;
  isVideo?: boolean;
  callDuration: number;
  isMuted: boolean;
  isSpeakerOn: boolean;
  isSpeaking: boolean;
  isVideoOff: boolean;
  callStatus: 'Connecting' | 'Connected' | 'Reconnecting';
}

interface CallContextType {
  callState: ActiveCallState;
  startCall: (params: {
    roomId?: string;
    roomType?: string;
    roomName?: string;
    partnerName?: string;
    partnerId?: string;
    isVideo?: boolean;
  }) => void;
  endCall: () => void;
  minimizeCall: () => void;
  maximizeCall: () => void;
  updateCallState: (updates: Partial<ActiveCallState>) => void;
}

const defaultCallState: ActiveCallState = {
  isActive: false,
  isMinimized: false,
  callDuration: 0,
  isMuted: false,
  isSpeakerOn: true,
  isSpeaking: false,
  isVideoOff: true,
  callStatus: 'Connecting',
};

const CallContext = createContext<CallContextType>({
  callState: defaultCallState,
  startCall: () => {},
  endCall: () => {},
  minimizeCall: () => {},
  maximizeCall: () => {},
  updateCallState: () => {},
});

export const useGlobalCall = () => useContext(CallContext);

export const CallProvider = ({ children }: { children: React.ReactNode }) => {
  const [callState, setCallState] = useState<ActiveCallState>(defaultCallState);
  const { settings } = useUserSettings();

  // Keep Android OS auto-PiP enabled whenever a call is active if PiP is allowed in settings
  useEffect(() => {
    const shouldEnable = callState.isActive && settings.call_pip_enabled !== false;
    setAutoPipEnabled(shouldEnable);
    return () => {
      setAutoPipEnabled(false);
    };
  }, [callState.isActive, settings.call_pip_enabled]);

  // Global call timer so duration persists across navigation and in-app PiP
  useEffect(() => {
    let interval: any = null;
    if (callState.isActive && callState.callStatus === 'Connected') {
      interval = setInterval(() => {
        setCallState((prev) => ({
          ...prev,
          callDuration: prev.callDuration + 1,
        }));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callState.isActive, callState.callStatus]);

  // ── Bridge between the live media engine and the UI state used by the call screen + PiP bubble ──────────
  useEffect(() => {
    const sync = () => {
      const live = getLiveCallSnapshot();
      if (live.phase === 'idle') return;
      setCallState((prev) => {
        if (!prev.isActive) return prev;
        const status: ActiveCallState['callStatus'] =
          live.phase === 'reconnecting'
            ? 'Reconnecting'
            : live.phase === 'connected' && (live.remoteCount > 0 || live.mode === 'audio_space')
            ? 'Connected'
            : 'Connecting';
        const speaking = live.participants.some((p) => p.isSpeaking);
        if (prev.callStatus === status && prev.isSpeaking === speaking) return prev;
        return { ...prev, callStatus: status, isSpeaking: speaking };
      });
      // The engine dropped the call (remote ended it, network lost for good, setup failed): close the UI too.
      if (live.phase === 'ended' || live.phase === 'failed') {
        setAutoPipEnabled(false);
        setCallState(defaultCallState);
      }
    };
    sync();
    return subscribeLiveCall(sync);
  }, []);

  // Controls changed from the PiP bubble (or the call screen) are applied to the real microphone / camera / route.
  useEffect(() => {
    if (!callState.isActive) return;
    const live = getLiveCallSnapshot();
    if (live.phase !== 'connected' && live.phase !== 'reconnecting') return;
    // Audio spaces control the mic from their own UI (listeners are not allowed to publish at all).
    if (live.mode === 'audio_space') return;
    if (live.isMicEnabled === callState.isMuted) void setMicEnabled(!callState.isMuted);
  }, [callState.isActive, callState.isMuted, callState.callStatus]);

  useEffect(() => {
    if (!callState.isActive) return;
    const live = getLiveCallSnapshot();
    if (live.phase === 'connected' && live.isSpeakerOn !== callState.isSpeakerOn) void setSpeakerOn(callState.isSpeakerOn);
  }, [callState.isActive, callState.isSpeakerOn, callState.callStatus]);

  useEffect(() => {
    if (!callState.isActive || !callState.isVideo) return;
    const live = getLiveCallSnapshot();
    if (live.mode === 'audio_space') return;
    if (live.phase === 'connected' && live.isCameraEnabled === callState.isVideoOff) {
      void setCameraEnabled(!callState.isVideoOff);
    }
  }, [callState.isActive, callState.isVideo, callState.isVideoOff, callState.callStatus]);

  const startCall = useCallback((params: {
    roomId?: string;
    roomType?: string;
    roomName?: string;
    partnerName?: string;
    partnerId?: string;
    isVideo?: boolean;
  }) => {
    setCallState({
      isActive: true,
      isMinimized: false,
      roomId: params.roomId,
      roomType: params.roomType,
      roomName: params.roomName,
      partnerName: params.partnerName,
      partnerId: params.partnerId,
      isVideo: params.isVideo,
      callDuration: 0,
      isMuted: !!settings.call_mute_mic_on_join,
      isSpeakerOn: true,
      isSpeaking: false,
      isVideoOff: !params.isVideo || !!settings.call_video_off_on_join,
      callStatus: 'Connecting',
    });
  }, [settings.call_mute_mic_on_join, settings.call_video_off_on_join]);

  const endCall = useCallback(() => {
    setAutoPipEnabled(false);
    // Hanging up from anywhere (call screen, PiP bubble, notification) must also close the real media session.
    void leaveLiveCall();
    setCallState(defaultCallState);
  }, []);

  const minimizeCall = useCallback(() => {
    setCallState((prev) => ({
      ...prev,
      isMinimized: true,
    }));
  }, []);

  const maximizeCall = useCallback(() => {
    setCallState((prev) => ({
      ...prev,
      isMinimized: false,
    }));
  }, []);

  const updateCallState = useCallback((updates: Partial<ActiveCallState>) => {
    setCallState((prev) => ({
      ...prev,
      ...updates,
    }));
  }, []);

  return (
    <CallContext.Provider
      value={{
        callState,
        startCall,
        endCall,
        minimizeCall,
        maximizeCall,
        updateCallState,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};
