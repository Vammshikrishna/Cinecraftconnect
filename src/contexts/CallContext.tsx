
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface CallState {
  isActive: boolean;
  roomId: string | null;            // Component/Room ID (e.g. Discussion UUID)
  connectionId: string | null;      // LiveKit Room Name (e.g. CineCraft_...)
  roomName: string | null;          // Display Name
  roomType: 'discussion' | 'project' | 'direct' | null;
  isMinimized: boolean;
  isPipHidden: boolean;
  userRole: 'creator' | 'admin' | 'member' | 'guest';
}

interface CallContextType {
  callState: CallState;
  startCall: (roomType: 'discussion' | 'project' | 'direct', roomId: string, roomName: string, role?: string) => Promise<boolean>;
  joinCall: (roomType: 'discussion' | 'project' | 'direct', roomId: string, roomName: string, role?: string) => Promise<boolean>;
  leaveCall: () => void;
  toggleMinimize: (minimized?: boolean) => void;
  togglePipHidden: (hidden?: boolean) => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const CallProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [callState, setCallState] = useState<CallState>({
    isActive: false,
    roomId: null,
    connectionId: null,
    roomName: null,
    roomType: null,
    isMinimized: false,
    isPipHidden: false,
    userRole: 'member',
  });

  const toggleMinimize = (minimized?: boolean) => {
    setCallState(prev => ({
      ...prev,
      isMinimized: minimized !== undefined ? minimized : !prev.isMinimized,
      isPipHidden: false, // Always unhide when toggling minimize/maximize
    }));
  };

  const togglePipHidden = (hidden?: boolean) => {
    setCallState(prev => ({
      ...prev,
      isPipHidden: hidden !== undefined ? hidden : !prev.isPipHidden,
    }));
  };

  const leaveCall = () => {
    setCallState({
      isActive: false,
      roomId: null,
      connectionId: null,
      roomName: null,
      roomType: null,
      isMinimized: false,
      isPipHidden: false,
      userRole: 'member',
    });
  };

  // Cleanup on logout
  useEffect(() => {
    if (!user && callState.isActive) {
      leaveCall();
    }
  }, [user, callState.isActive]);

  const startCall = async (roomType: 'discussion' | 'project' | 'direct', roomId: string, roomName: string, role: string = 'member') => {
    if (!user) return false;

    try {
      // Check for existing active call first
      const { data: existingCall } = await supabase
        .from('calls' as any)
        .select('*')
        .eq('room_type', roomType)
        .eq('room_id', roomId)
        .eq('status', 'active')
        .maybeSingle();

      if (existingCall) {
        setCallState({
          isActive: true,
          roomId,
          connectionId: (existingCall as any).daily_room_name,
          roomName,
          roomType,
          isMinimized: false,
          isPipHidden: false,
          userRole: role as any,
        });
        return true;
      }

      // Generate unique name
      const uniqueSuffix = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      const connectionId = `CineCraft_${roomType}_${roomId}_${uniqueSuffix}`;

      const { data, error } = await supabase
        .from('calls' as any)
        .insert([{
          room_type: roomType,
          room_id: roomId,
          daily_room_name: connectionId,
          daily_room_url: connectionId,
          started_by: user.id,
          status: 'active'
        }])
        .select()
        .single();

      if (error) throw error;

      await supabase
        .from('call_participants' as any)
        .upsert([{
          call_id: (data as any).id,
          user_id: user.id,
          status: 'joined'
        }]);

      setCallState({
        isActive: true,
        roomId,
        connectionId: connectionId,
        roomName,
        roomType,
        isMinimized: false,
        isPipHidden: false,
        userRole: role as any,
      });

      return true;
    } catch (err) {
      console.error('Error starting global call:', err);
      return false;
    }
  };

  const joinCall = async (roomType: 'discussion' | 'project' | 'direct', roomId: string, roomName: string, role: string = 'member') => {
    if (!user) return false;

    // Fetch the active call for this room to get its connectionId
    const { data: activeCall } = await supabase
      .from('calls' as any)
      .select('daily_room_name')
      .eq('room_type', roomType)
      .eq('room_id', roomId)
      .eq('status', 'active')
      .maybeSingle();

    if (!activeCall) return false;

    setCallState({
      isActive: true,
      roomId,
      connectionId: (activeCall as any).daily_room_name,
      roomName,
      roomType,
      isMinimized: false,
      isPipHidden: false,
      userRole: role as any,
    });
    return true;
  };

  return (
    <CallContext.Provider value={{ callState, startCall, joinCall, leaveCall, toggleMinimize, togglePipHidden }}>
      {children}
    </CallContext.Provider>
  );
};

export const useGlobalCall = () => {
  const context = useContext(CallContext);
  if (context === undefined) {
    throw new Error('useGlobalCall must be used within a CallProvider');
  }
  return context;
};
