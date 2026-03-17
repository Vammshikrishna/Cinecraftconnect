
import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

import { Badge } from '@/components/ui/badge';
import {
    Mic, MicOff, Video, VideoOff, PhoneOff, Users,
    Hand, MoreHorizontal, MonitorUp, Smile,
    Maximize, X, Radio
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

// Free public STUN servers
const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' }
    ]
};

interface PeerConnection {
    userId: string;
    connection: RTCPeerConnection;
    stream?: MediaStream;
    isScreenSharing?: boolean;
}

interface Reaction {
    id: string;
    userId: string;
    emoji: string;
    timestamp: number;
}

interface EmbeddedCallPanelProps {
    roomId: string;
    roomName: string;
    onLeave: () => void;
    isMinimized?: boolean;
    onToggleMinimize?: () => void;
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '👏', '🎉', '👋'];

// --- Local Video Frame ---
const LocalVideoFrame = ({ localStream, isMuted, isVideoOff, isHandRaised, reactions, userId, userName, userAvatar, className }: {
    localStream: MediaStream | null;
    isMuted: boolean;
    isVideoOff: boolean;
    isHandRaised: boolean;
    reactions: Reaction[];
    userId?: string;
    userName?: string;
    userAvatar?: string | null;
    className?: string;
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const displayName = userName || 'You';
    const initials = displayName.charAt(0).toUpperCase();

    useEffect(() => {
        if (videoRef.current && localStream) {
            videoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    return (
        <div className={`relative bg-[#3c4043] rounded-xl overflow-hidden shadow-lg border-2 transition-all ${isHandRaised ? 'border-yellow-400' : 'border-transparent'} ${className}`}>
            <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full object-cover transform scale-x-[-1] ${isVideoOff ? 'hidden' : ''}`}
            />
            {isVideoOff && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <Avatar className="h-16 w-16 border-2 border-white/20">
                        <AvatarImage src={userAvatar || undefined} />
                        <AvatarFallback className="bg-purple-600 text-white text-xl">{initials}</AvatarFallback>
                    </Avatar>
                </div>
            )}
            {isHandRaised && (
                <div className="absolute top-2 left-2 bg-yellow-400 p-1 rounded-full shadow-lg">
                    <Hand className="w-3 h-3 text-black" />
                </div>
            )}
            <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded-md text-white text-xs font-medium backdrop-blur-sm flex items-center gap-1.5">
                <span>{displayName} (You)</span>
                {isMuted ? <MicOff className="w-3 h-3 text-red-400" /> : <Mic className="w-3 h-3 text-green-400" />}
            </div>
            <div className="absolute bottom-10 left-3 flex flex-col-reverse gap-1 pointer-events-none">
                {reactions.filter(r => r.userId === userId).map((r) => (
                    <div key={r.id} className="animate-in fade-in slide-in-from-bottom-5 duration-500 text-2xl drop-shadow-md">
                        {r.emoji}
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- Remote Video Frame ---
const RemoteVideoFrame = ({ peer, raisedHands, reactions, allMembers, className }: {
    peer: PeerConnection;
    raisedHands: Set<string>;
    reactions: Reaction[];
    allMembers: { id: string; username: string; avatar_url: string }[];
    className?: string;
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const profile = allMembers.find(m => m.id === peer.userId);

    useEffect(() => {
        if (videoRef.current && peer.stream) {
            videoRef.current.srcObject = peer.stream;
        }
    }, [peer.stream]);

    return (
        <div className={`relative bg-[#3c4043] rounded-xl overflow-hidden shadow-lg border-2 transition-all ${raisedHands.has(peer.userId) ? 'border-yellow-400' : 'border-transparent'} ${className}`}>
            {peer.stream ? (
                <video ref={videoRef} autoPlay playsInline className={`w-full h-full ${peer.isScreenSharing ? 'object-contain' : 'object-cover'}`} />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                    <Avatar className="h-16 w-16 border-2 border-white/20">
                        <AvatarImage src={profile?.avatar_url} />
                        <AvatarFallback className="bg-blue-600 text-white text-xl">
                            {profile?.username?.charAt(0) || 'U'}
                        </AvatarFallback>
                    </Avatar>
                </div>
            )}
            {raisedHands.has(peer.userId) && (
                <div className="absolute top-2 left-2 bg-yellow-400 p-1 rounded-full shadow-lg">
                    <Hand className="w-3 h-3 text-black" />
                </div>
            )}
            <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-0.5 rounded-md text-white text-xs font-medium backdrop-blur-sm">
                {profile?.username || `User ${peer.userId.slice(0, 4)}`}
            </div>
            <div className="absolute bottom-10 left-3 flex flex-col-reverse gap-1 pointer-events-none">
                {reactions.filter(r => r.userId === peer.userId).map((r) => (
                    <div key={r.id} className="animate-in fade-in slide-in-from-bottom-5 duration-500 text-2xl drop-shadow-md">
                        {r.emoji}
                    </div>
                ))}
            </div>
        </div>
    );
};


// ======================================================================
// MAIN EMBEDDED CALL PANEL
// ======================================================================
export const EmbeddedCallPanel = ({ roomId, roomName, onLeave, isMinimized = false, onToggleMinimize }: EmbeddedCallPanelProps) => {
    const { user, profile } = useAuth();
    const { toast } = useToast();
    const myName = profile?.full_name || profile?.username || 'You';
    const myAvatar = profile?.avatar_url || null;

    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
    const [peers, setPeers] = useState<Record<string, PeerConnection>>({});

    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isHandRaised, setIsHandRaised] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    const [reactions, setReactions] = useState<Reaction[]>([]);
    const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set());
    const [callDuration, setCallDuration] = useState(0);
    const [allRoomMembers, setAllRoomMembers] = useState<{ id: string; username: string; avatar_url: string }[]>([]);
    const [isHost, setIsHost] = useState(false);
    const [hostId, setHostId] = useState<string | null>(null);
    const [showPeople, setShowPeople] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    const peersRef = useRef<Record<string, PeerConnection>>({});
    const roomChannelRef = useRef<any>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // Call Timer
    useEffect(() => {
        const timer = setInterval(() => setCallDuration(d => d + 1), 1000);
        return () => clearInterval(timer);
    }, []);

    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Initialize Local Stream
    useEffect(() => {
        let isMounted = true;
        const startLocalStream = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                if (!isMounted) {
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }
                setLocalStream(stream);
                streamRef.current = stream;
            } catch (err) {
                console.error("Failed to access camera/mic:", err);
                // Try audio-only fallback
                try {
                    const audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                    if (!isMounted) {
                        audioStream.getTracks().forEach(track => track.stop());
                        return;
                    }
                    setLocalStream(audioStream);
                    streamRef.current = audioStream;
                    setIsVideoOff(true);
                } catch (audioErr) {
                    console.error("Failed to access mic:", audioErr);
                    // Continue without media — user can still participate in chat
                    setIsVideoOff(true);
                    setIsMuted(true);
                }
            }
        };
        startLocalStream();
        return () => {
            isMounted = false;
            streamRef.current?.getTracks().forEach(track => track.stop());
        };
    }, []);

    // Fetch Room Members
    useEffect(() => {
        const fetchMembers = async () => {
            if (!roomId) return;
            try {
                // Step 1: Get user IDs from room_members
                const { data: membersData, error: membersError } = await supabase
                    .from('room_members')
                    .select('user_id')
                    .eq('room_id', roomId);

                if (membersError || !membersData || membersData.length === 0) {
                    if (membersError) console.error('Error fetching room members:', membersError);
                    return;
                }

                const userIds = membersData.map((m: any) => m.user_id);

                // Step 2: Fetch profiles for these user IDs
                const { data: profilesData, error: profilesError } = await supabase
                    .from('profiles')
                    .select('id, username, avatar_url')
                    .in('id', userIds);

                if (profilesError) {
                    console.error('Error fetching profiles:', profilesError);
                    return;
                }

                setAllRoomMembers((profilesData || []) as { id: string; username: string; avatar_url: string }[]);
            } catch (err) {
                console.error('Error fetching members:', err);
            }
        };
        fetchMembers();
    }, [roomId]);

    // Determine Host
    useEffect(() => {
        const checkHost = async () => {
            if (!user) return;
            const { data: call } = await supabase
                .from('calls')
                .select('started_by')
                .eq('room_id', roomId)
                .eq('status', 'active')
                .maybeSingle();

            if (call) {
                const creatorId = (call as any).started_by;
                setHostId(creatorId);
                setIsHost(creatorId === user.id);
            } else {
                setIsHost(Object.keys(peers).length === 0);
                setHostId(user.id);
            }
        };
        checkHost();
    }, [roomId, user, peers]);

    // --- WebRTC Peer Connection Factory ---
    const createPeerConnection = useCallback((targetUserId: string, initiator: boolean) => {
        if (peersRef.current[targetUserId]) return peersRef.current[targetUserId];
        const pc = new RTCPeerConnection(ICE_SERVERS);

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => pc.addTrack(track, streamRef.current!));
        }

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                roomChannelRef.current?.send({
                    type: 'broadcast',
                    event: 'signal',
                    payload: { type: 'candidate', candidate: event.candidate, fromUserId: user?.id, toUserId: targetUserId }
                });
            }
        };

        pc.ontrack = (event) => {
            const newStream = event.streams[0] || new MediaStream([event.track]);
            peersRef.current[targetUserId] = { ...peersRef.current[targetUserId], stream: newStream };
            setPeers({ ...peersRef.current });
        };

        peersRef.current[targetUserId] = { userId: targetUserId, connection: pc };

        if (initiator) {
            pc.createOffer().then(offer => {
                pc.setLocalDescription(offer);
                roomChannelRef.current?.send({
                    type: 'broadcast',
                    event: 'signal',
                    payload: { type: 'offer', offer, fromUserId: user?.id, toUserId: targetUserId }
                });
            });
        }
        setPeers({ ...peersRef.current });
        return peersRef.current[targetUserId];
    }, [user]);

    const removePeer = useCallback((userId: string) => {
        if (peersRef.current[userId]) {
            peersRef.current[userId].connection.close();
            delete peersRef.current[userId];
            setPeers({ ...peersRef.current });
            setRaisedHands(prev => {
                const newSet = new Set(prev);
                newSet.delete(userId);
                return newSet;
            });
        }
    }, []);

    // Signaling & Events
    useEffect(() => {
        if (!user || !localStream) return;

        const channel = supabase.channel(`call_signaling:${roomId}`);
        roomChannelRef.current = channel;

        const handleSignal = async (payload: any) => {
            const { type, fromUserId, toUserId, answer, offer, candidate, emoji, id, handRaised, isScreenSharing: remoteIsScreenSharing } = payload.payload;

            if (toUserId === user.id) {
                if (type === 'offer') {
                    if (peersRef.current[fromUserId]) return;
                    const pc = createPeerConnection(fromUserId, false);
                    await pc.connection.setRemoteDescription(new RTCSessionDescription(offer));
                    const ans = await pc.connection.createAnswer();
                    await pc.connection.setLocalDescription(ans);
                    channel.send({
                        type: 'broadcast',
                        event: 'signal',
                        payload: { type: 'answer', answer: ans, fromUserId: user.id, toUserId: fromUserId }
                    });
                }
                if (type === 'answer') {
                    const peer = peersRef.current[fromUserId];
                    if (peer) await peer.connection.setRemoteDescription(new RTCSessionDescription(answer));
                }
                if (type === 'candidate') {
                    const peer = peersRef.current[fromUserId];
                    if (peer) await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
                }
            }

            if (type === 'reaction') {
                const newReaction = { id, userId: fromUserId, emoji, timestamp: Date.now() };
                setReactions(prev => [...prev, newReaction]);
                setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 4000);
            }
            if (type === 'hand_raise') {
                setRaisedHands(prev => {
                    const newSet = new Set(prev);
                    if (handRaised) newSet.add(fromUserId);
                    else newSet.delete(fromUserId);
                    return newSet;
                });
            }
            if (type === 'screen_share_status') {
                setPeers(prev => ({
                    ...prev,
                    [fromUserId]: {
                        ...prev[fromUserId],
                        isScreenSharing: remoteIsScreenSharing
                    }
                }));
            }
            if (type === 'remove_participant' && payload.payload.targetUserId === user.id) {
                toast({ title: "Removed from Call", description: "You have been removed by the host.", variant: "destructive" });
                setTimeout(() => onLeave(), 2000);
            }
            if (type === 'host_mute' && payload.payload.targetUserId === user.id) {
                if (streamRef.current) {
                    streamRef.current.getAudioTracks().forEach(t => t.enabled = false);
                    setIsMuted(true);
                    toast({ title: "Muted by Host", description: "You have been muted by the host." });
                }
            }
        };

        channel
            .on('presence', { event: 'join' }, ({ newPresences }: any) => {
                newPresences.forEach((p: any) => {
                    if (p.user_id && p.user_id !== user.id && !peersRef.current[p.user_id]) {
                        createPeerConnection(p.user_id, true);
                    }
                });
            })
            .on('presence', { event: 'leave' }, ({ leftPresences }: any) => {
                leftPresences.forEach((p: any) => {
                    if (p.user_id) removePeer(p.user_id);
                });
            })
            .on('broadcast', { event: 'signal' }, handleSignal)
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({ user_id: user.id, online_at: new Date().toISOString() });
                }
            });

        return () => {
            Object.values(peersRef.current).forEach((p: any) => p.connection.close());
            peersRef.current = {};
            setPeers({});
            supabase.removeChannel(channel);
        };
    }, [roomId, user, localStream, createPeerConnection, removePeer, onLeave, toast]);

    // --- Controls ---
    const toggleMute = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(t => t.enabled = !t.enabled);
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        if (localStream) {
            localStream.getVideoTracks().forEach(t => t.enabled = !t.enabled);
            setIsVideoOff(!isVideoOff);
        }
    };

    const toggleHandRaise = () => {
        const newState = !isHandRaised;
        setIsHandRaised(newState);
        setRaisedHands(prev => {
            const newSet = new Set(prev);
            if (newState && user?.id) newSet.add(user.id);
            else if (user?.id) newSet.delete(user.id);
            return newSet;
        });
        roomChannelRef.current?.send({
            type: 'broadcast',
            event: 'signal',
            payload: { type: 'hand_raise', handRaised: newState, fromUserId: user?.id }
        });
    };

    const sendReaction = (emoji: string) => {
        const id = Math.random().toString(36).substr(2, 9);
        const reaction = { id, userId: user?.id || 'me', emoji, timestamp: Date.now() };
        setReactions(prev => [...prev, reaction]);
        setTimeout(() => setReactions(prev => prev.filter(r => r.id !== id)), 4000);
        roomChannelRef.current?.send({
            type: 'broadcast',
            event: 'signal',
            payload: { type: 'reaction', emoji, fromUserId: user?.id, id }
        });
    };

    const toggleScreenShare = async () => {
        if (isScreenSharing) {
            try {
                let cameraVideoTrack: MediaStreamTrack | undefined;
                if (localStream) {
                    cameraVideoTrack = localStream.getVideoTracks()[0];
                }
                if (cameraVideoTrack) {
                    Object.values(peersRef.current).forEach(peer => {
                        const sender = peer.connection.getSenders().find(s => s.track?.kind === 'video');
                        if (sender) sender.replaceTrack(cameraVideoTrack!);
                    });
                }
                if (screenStream) {
                    screenStream.getTracks().forEach(track => track.stop());
                }
                setScreenStream(null);
                setIsScreenSharing(false);
                roomChannelRef.current?.send({
                    type: 'broadcast', event: 'signal',
                    payload: { type: 'screen_share_status', isScreenSharing: false, fromUserId: user?.id }
                });
            } catch (e) {
                console.error("Error reverting to camera", e);
            }
        } else {
            try {
                const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
                const screenTrack = screen.getVideoTracks()[0];
                screenTrack.onended = () => {
                    if (isScreenSharing) toggleScreenShare();
                };
                Object.values(peersRef.current).forEach(peer => {
                    const sender = peer.connection.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) sender.replaceTrack(screenTrack);
                });
                setScreenStream(screen);
                setIsScreenSharing(true);
                roomChannelRef.current?.send({
                    type: 'broadcast', event: 'signal',
                    payload: { type: 'screen_share_status', isScreenSharing: true, fromUserId: user?.id }
                });
            } catch (err) {
                console.error("Failed to share screen:", err);
            }
        }
    };

    const handleRemoveParticipant = (userId: string) => {
        if (!isHost) return;
        roomChannelRef.current?.send({
            type: 'broadcast', event: 'signal',
            payload: { type: 'remove_participant', targetUserId: userId, fromUserId: user?.id }
        });
        removePeer(userId);
        toast({ title: "Participant Removed", description: "User has been removed from the call." });
    };

    const handleMuteParticipant = (userId: string) => {
        if (!isHost) return;
        roomChannelRef.current?.send({
            type: 'broadcast', event: 'signal',
            payload: { type: 'host_mute', targetUserId: userId, fromUserId: user?.id }
        });
        toast({ title: "Participant Muted" });
    };

    const participantCount = Object.keys(peers).length + 1;

    // --- MINIMIZED VIEW (compact bar) ---
    if (isMinimized) {
        return (
            <div className="bg-gradient-to-r from-[#1a1a2e] via-[#16213e] to-[#0f3460] border border-white/10 rounded-2xl p-3 mx-3 mt-2 shadow-xl">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                        </div>
                        <div>
                            <p className="text-white text-sm font-semibold flex items-center gap-2">
                                <Radio className="w-4 h-4 text-red-400" />
                                Discussion Active
                            </p>
                            <p className="text-gray-400 text-xs">{participantCount} participant{participantCount > 1 ? 's' : ''} • {formatDuration(callDuration)}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={toggleMute} className={`h-8 w-8 rounded-full ${isMuted ? 'bg-red-600/20 text-red-400' : 'text-white hover:bg-white/10'}`}>
                            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={onToggleMinimize} className="text-white hover:bg-white/10 h-8 w-8 rounded-full">
                            <Maximize className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={onLeave} className="text-red-400 hover:bg-red-600/20 h-8 w-8 rounded-full">
                            <PhoneOff className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {/* Mini participant avatars */}
                <div className="flex items-center gap-1 mt-2 pl-6">
                    <Avatar className="h-6 w-6 border border-white/20">
                        <AvatarImage src={myAvatar || undefined} />
                        <AvatarFallback className="bg-purple-600 text-white text-[10px]">{myName.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    {Object.values(peers).slice(0, 5).map(peer => {
                        const profile = allRoomMembers.find(m => m.id === peer.userId);
                        return (
                            <Avatar key={peer.userId} className="h-6 w-6 border border-white/20 -ml-1">
                                <AvatarImage src={profile?.avatar_url} />
                                <AvatarFallback className="bg-blue-600 text-white text-[10px]">{profile?.username?.charAt(0) || 'U'}</AvatarFallback>
                            </Avatar>
                        );
                    })}
                    {Object.keys(peers).length > 5 && (
                        <span className="text-xs text-gray-400 ml-1">+{Object.keys(peers).length - 5}</span>
                    )}
                </div>
            </div>
        );
    }

    // --- FULL VIEW (compact, constrained height) ---
    return (
        <div className="flex flex-col h-full bg-gradient-to-b from-[#1a1a2e] to-[#0f0f23] border-b border-white/10 overflow-hidden relative">

            {/* Header + Controls Combined */}
            <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4 px-3 sm:px-4 py-2 bg-gradient-to-r from-[#1a1a2e]/90 via-[#16213e]/90 to-[#0f3460]/90 backdrop-blur-xl border-b border-white/5 shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className="relative">
                        <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-pink-600 rounded-full flex items-center justify-center shadow-lg shadow-red-500/30">
                            <Radio className="w-4 h-4 text-white" />
                        </div>
                        <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border border-[#1a1a2e]" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="text-white text-xs font-bold truncate max-w-[120px]">{roomName}</h3>
                            <span className="text-[9px] font-bold text-red-400 bg-red-500/15 px-1.5 py-0.5 rounded-full tracking-wider shrink-0">ACTIVE</span>
                        </div>
                        <p className="text-gray-400 text-[10px]">{participantCount} in room • {formatDuration(callDuration)}</p>
                    </div>
                </div>

                {/* Inline Controls */}
                <div className="flex flex-wrap items-center gap-1 justify-end">
                    <ControlButton onClick={toggleMute} active={!isMuted} activeIcon={<Mic className="w-3.5 h-3.5" />} inactiveIcon={<MicOff className="w-3.5 h-3.5" />} danger={isMuted} small />
                    <ControlButton onClick={toggleVideo} active={!isVideoOff} activeIcon={<Video className="w-3.5 h-3.5" />} inactiveIcon={<VideoOff className="w-3.5 h-3.5" />} danger={isVideoOff} small />
                    <ControlButton onClick={toggleHandRaise} active={isHandRaised}
                        activeIcon={<Hand className="w-3.5 h-3.5 text-black" />}
                        inactiveIcon={<Hand className="w-3.5 h-3.5" />}
                        activeClass="bg-yellow-400 hover:bg-yellow-500 text-black" small
                    />
                    <ControlButton onClick={toggleScreenShare} active={isScreenSharing}
                        activeIcon={<MonitorUp className="w-3.5 h-3.5 text-black" />}
                        inactiveIcon={<MonitorUp className="w-3.5 h-3.5" />}
                        activeClass="bg-blue-400 hover:bg-blue-500 text-black" small
                    />

                    {/* Reactions */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button className="h-7 w-7 rounded-full bg-white/10 border-none hover:bg-white/20 text-white p-0">
                                <Smile className="w-3.5 h-3.5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="bottom" className="bg-[#1a1a2e] border-white/10 text-white p-2 flex gap-1 z-50">
                            {EMOJIS.map(e => (
                                <button key={e} onClick={() => sendReaction(e)} className="text-lg hover:scale-125 transition-transform p-0.5">{e}</button>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="w-px h-5 bg-white/15 mx-0.5" />

                    <Button size="sm" variant="ghost" onClick={() => setShowPeople(!showPeople)}
                        className={`h-7 px-1.5 text-[10px] rounded-full ${showPeople ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                        <Users className="w-3 h-3 mr-0.5" />
                        {participantCount}
                    </Button>

                    {onToggleMinimize && (
                        <Button size="sm" variant="ghost" onClick={onToggleMinimize} className="h-7 w-7 rounded-full text-gray-400 hover:text-white hover:bg-white/5 p-0">
                            <X className="w-3.5 h-3.5" />
                        </Button>
                    )}

                    <Button onClick={onLeave} size="sm" className="h-7 px-3 rounded-full bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold border-none ml-0.5">
                        <PhoneOff className="w-3 h-3 mr-1" /> Leave
                    </Button>
                </div>
            </div>

            {/* Video Grid - Compact horizontal scroll */}
            <div className="flex-1 overflow-hidden relative">
                {/* Screen Share View */}
                {isScreenSharing && screenStream ? (
                    <div className="absolute inset-0 z-10 bg-black flex items-center justify-center p-2">
                        <video ref={(r) => { if (r) r.srcObject = screenStream }} autoPlay playsInline muted className="w-full h-full object-contain rounded-lg" />
                        <div className="absolute top-3 left-3 bg-blue-600/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-white text-[10px] font-semibold flex items-center gap-1.5">
                            <MonitorUp className="w-3 h-3" /> Presenting
                        </div>
                    </div>
                ) : null}

                <div className={`grid gap-3 p-3 h-full overflow-y-auto place-content-center ${participantCount <= 1 ? 'grid-cols-1 max-w-[400px] mx-auto' :
                    participantCount <= 4 ? 'grid-cols-2' :
                        'grid-cols-3'
                    }`}>
                    <LocalVideoFrame
                        localStream={localStream}
                        isMuted={isMuted}
                        isVideoOff={isVideoOff}
                        isHandRaised={isHandRaised}
                        reactions={reactions}
                        userId={user?.id}
                        userName={myName}
                        userAvatar={myAvatar}
                        className="aspect-video w-full rounded-xl"
                    />
                    {Object.values(peers).map(peer => (
                        <RemoteVideoFrame
                            key={peer.userId}
                            peer={peer}
                            raisedHands={raisedHands}
                            reactions={reactions}
                            allMembers={allRoomMembers}
                            className="aspect-video w-full rounded-xl"
                        />
                    ))}
                </div>

                {/* Floating reactions overlay */}
                <div className="absolute bottom-2 left-4 flex gap-1 pointer-events-none z-20">
                    {reactions.slice(-5).map((r) => (
                        <div key={r.id} className="animate-in fade-in zoom-in duration-300 text-2xl drop-shadow-lg">
                            {r.emoji}
                        </div>
                    ))}
                </div>
            </div>

            {/* People Panel (slide-down overlay) */}
            {showPeople && (
                <div className="absolute right-0 top-[42px] z-30 w-64 bg-[#16213e]/95 backdrop-blur-xl border border-white/10 rounded-bl-xl shadow-2xl p-3 max-h-[220px] overflow-y-auto">
                    <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">In Room ({participantCount})</div>
                    <div className="space-y-1">
                        <div className="flex items-center justify-between p-1.5 rounded-lg hover:bg-white/5">
                            <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                    <AvatarImage src={myAvatar || undefined} />
                                    <AvatarFallback className="bg-purple-600 text-white text-[10px]">{myName.charAt(0).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <span className="text-xs text-white font-medium">{myName} (You) {isHost && <Badge variant="secondary" className="text-[8px] px-1 py-0 bg-purple-600/30 text-purple-300 border-none ml-1">Host</Badge>}</span>
                            </div>
                            <div className="flex gap-1">
                                {isHandRaised && <Hand className="w-3 h-3 text-yellow-400" />}
                                {isMuted ? <MicOff className="w-3 h-3 text-red-500" /> : <Mic className="w-3 h-3 text-green-500" />}
                            </div>
                        </div>
                        {Object.values(peers).map(peer => {
                            const profile = allRoomMembers.find(m => m.id === peer.userId);
                            const isPeerHost = peer.userId === hostId;
                            return (
                                <div key={peer.userId} className="flex items-center justify-between p-1.5 rounded-lg hover:bg-white/5 group">
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-6 w-6">
                                            <AvatarImage src={profile?.avatar_url} />
                                            <AvatarFallback className="bg-blue-600 text-white text-[10px]">{profile?.username?.charAt(0) || 'U'}</AvatarFallback>
                                        </Avatar>
                                        <span className="text-xs text-gray-200">{profile?.username || `User ${peer.userId.slice(0, 4)}`}
                                            {isPeerHost && <Badge variant="secondary" className="text-[8px] px-1 py-0 bg-purple-600/30 text-purple-300 border-none ml-1">Host</Badge>}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        {raisedHands.has(peer.userId) && <Hand className="w-3 h-3 text-yellow-400" />}
                                        {isHost && (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 text-gray-400 p-0">
                                                        <MoreHorizontal className="w-3 h-3" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="bg-[#1a1a2e] border-white/10 text-white z-50">
                                                    <DropdownMenuItem onClick={() => handleMuteParticipant(peer.userId)} className="text-xs cursor-pointer">
                                                        <MicOff className="w-3 h-3 mr-2" /> Mute
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => handleRemoveParticipant(peer.userId)} className="text-xs cursor-pointer text-red-400">
                                                        <X className="w-3 h-3 mr-2" /> Remove
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Settings Dialog */}
            <SettingsDialog
                open={showSettings}
                onOpenChange={setShowSettings}
                currentStream={localStream}
                onDeviceChange={async (deviceId, kind) => {
                    try {
                        const newStream = await navigator.mediaDevices.getUserMedia({
                            video: kind === 'videoinput' ? { deviceId: { exact: deviceId } } : true,
                            audio: kind === 'audioinput' ? { deviceId: { exact: deviceId } } : true
                        });
                        const newTrack = kind === 'videoinput' ? newStream.getVideoTracks()[0] : newStream.getAudioTracks()[0];
                        Object.values(peersRef.current).forEach(peer => {
                            const sender = peer.connection.getSenders().find(s => s.track?.kind === (kind === 'videoinput' ? 'video' : 'audio'));
                            if (sender) sender.replaceTrack(newTrack);
                        });
                        setLocalStream(newStream);
                    } catch (e) {
                        console.error("Failed to switch device", e);
                    }
                }}
            />
        </div>
    );
};


// --- Control Button ---
const ControlButton = ({ onClick, active, activeIcon, inactiveIcon, danger, activeClass, small }: any) => {
    const size = small ? 'h-7 w-7' : 'h-9 w-9';
    return (
        <Button onClick={onClick} className={`${size} rounded-full transition-all border-none p-0 ${danger ? 'bg-red-600/20 hover:bg-red-600/30 text-red-400' : active ? (activeClass || 'bg-white/10 hover:bg-white/20 text-white') : 'bg-white/10 hover:bg-white/20 text-white'}`}>
            {active ? activeIcon : inactiveIcon}
        </Button>
    );
};

// --- Settings Dialog ---
const SettingsDialog = ({ open, onOpenChange, currentStream: _currentStream, onDeviceChange }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    currentStream: MediaStream | null;
    onDeviceChange: (deviceId: string, kind: MediaDeviceKind) => void;
}) => {
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);

    useEffect(() => {
        navigator.mediaDevices.enumerateDevices().then(setDevices);
    }, []);

    const videoDevices = devices.filter(d => d.kind === 'videoinput');
    const audioDevices = devices.filter(d => d.kind === 'audioinput');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-[#1a1a2e] border-white/10 text-white z-[100000]">
                <DialogHeader>
                    <DialogTitle>Call Settings</DialogTitle>
                    <DialogDescription className="hidden">Manage your audio and video devices.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Camera</label>
                        <select className="w-full bg-[#0f3460] border border-white/10 rounded-md p-2 text-sm" onChange={(e) => onDeviceChange(e.target.value, 'videoinput')}>
                            {videoDevices.map(d => (
                                <option key={d.deviceId || 'default-cam'} value={d.deviceId}>{d.label || `Camera ${videoDevices.indexOf(d) + 1}`}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Microphone</label>
                        <select className="w-full bg-[#0f3460] border border-white/10 rounded-md p-2 text-sm" onChange={(e) => onDeviceChange(e.target.value, 'audioinput')}>
                            {audioDevices.map(d => (
                                <option key={d.deviceId || 'default-mic'} value={d.deviceId}>{d.label || `Mic ${audioDevices.indexOf(d) + 1}`}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
