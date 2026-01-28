import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Mic, MicOff, Video, VideoOff, PhoneOff, Users, MessageSquare,
    Send, Smile, X, Hand, MoreHorizontal,
    Maximize, Settings, MonitorUp
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
    DropdownMenuSeparator, DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
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

interface ChatMessage {
    id: string;
    userId: string;
    content: string;
    timestamp: number;
}

interface Reaction {
    id: string;
    userId: string;
    emoji: string;
    timestamp: number;
}

interface NativeCallContainerProps {
    roomId: string;
    onLeave: () => void;
    roomName?: string;
    projectId?: string;
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '👏', '🎉', '👋'];

// ----------------------------------------------------------------------
// EXTERNALIZED COMPONENTS TO PREVENT RE-RENDERING/REMOUNTING ISSUES
// ----------------------------------------------------------------------

interface LocalVideoFrameProps {
    localStream: MediaStream | null;
    isMuted: boolean;
    isVideoOff: boolean;
    isHandRaised: boolean;
    isScreenSharing: boolean;
    reactions: Reaction[];
    userId?: string;
    className?: string;
}

const LocalVideoFrame = ({ localStream, isMuted, isVideoOff, isHandRaised, isScreenSharing, reactions, userId, className }: LocalVideoFrameProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    // Re-attach stream whenever it changes or component mounts
    useEffect(() => {
        if (videoRef.current && localStream) {
            videoRef.current.srcObject = localStream;
        }
    }, [localStream]);

    return (
        <div className={`relative bg-[#3c4043] rounded-xl overflow-hidden shadow-lg border-2 transition-all group ${isHandRaised ? 'border-yellow-400' : 'border-transparent hover:border-white/20'} ${className}`}>
            <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full ${isScreenSharing ? 'object-contain' : 'object-cover transform scale-x-[-1]'} ${(isVideoOff && !isScreenSharing) ? 'hidden' : ''}`}
            />
            {/* Show Avatar if video is logically off AND we are not screen sharing */}
            {(isVideoOff && !isScreenSharing) && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <Avatar className="h-24 w-24 border-2 border-white/20">
                        <AvatarFallback className="bg-purple-600 text-white text-3xl">ME</AvatarFallback>
                    </Avatar>
                </div>
            )}

            {isHandRaised && (
                <div className="absolute top-3 left-3 bg-yellow-400 p-1.5 rounded-full shadow-lg">
                    <Hand className="w-4 h-4 text-black font-bold" />
                </div>
            )}

            <div className="absolute bottom-3 left-3 bg-[#00000080] px-3 py-1 rounded-md text-white text-sm font-medium backdrop-blur-sm flex items-center gap-2">
                <span>{isScreenSharing ? 'You (Presenting)' : 'You'}</span>
                {isMuted ? <MicOff className="w-3 h-3 text-red-400" /> : <Mic className="w-3 h-3 text-green-400" />}
            </div>

            <div className="absolute bottom-12 left-4 flex flex-col-reverse gap-2 pointer-events-none">
                {reactions.filter(r => r.userId === userId).map((r) => (
                    <div key={r.id} className="animate-in fade-in slide-in-from-bottom-5 duration-500 text-4xl drop-shadow-md">
                        {r.emoji}
                    </div>
                ))}
            </div>
        </div>
    );
};

// Subcomponent for Peer Video frame
const PeerVideo = ({ peer }: { peer: PeerConnection }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    useEffect(() => {
        if (videoRef.current && peer.stream) videoRef.current.srcObject = peer.stream;
    }, [peer.stream]);

    return (
        <>
            <video ref={videoRef} autoPlay playsInline className={`w-full h-full ${peer.isScreenSharing ? 'object-contain' : 'object-cover'}`} />
            <div className="absolute bottom-3 left-3 bg-[#00000080] px-3 py-1 rounded-md text-white text-sm font-medium backdrop-blur-sm">
                User {peer.userId.slice(0, 4)}
            </div>
        </>
    );
};

interface RemoteVideoFrameProps {
    peer: PeerConnection;
    raisedHands: Set<string>;
    reactions: Reaction[];
    className?: string;
}

const RemoteVideoFrame = ({ peer, raisedHands, reactions, className }: RemoteVideoFrameProps) => (
    <div className={`relative bg-[#3c4043] rounded-xl overflow-hidden shadow-lg border-2 ${raisedHands.has(peer.userId) ? 'border-yellow-400' : 'border-transparent'} ${className}`}>
        <PeerVideo peer={peer} />

        {raisedHands.has(peer.userId) && (
            <div className="absolute top-3 left-3 bg-yellow-400 p-1.5 rounded-full shadow-lg">
                <Hand className="w-4 h-4 text-black font-bold" />
            </div>
        )}

        <div className="absolute bottom-12 left-4 flex flex-col-reverse gap-2 pointer-events-none">
            {reactions.filter(r => r.userId === peer.userId).map((r) => (
                <div key={r.id} className="animate-in fade-in slide-in-from-bottom-5 duration-500 text-4xl drop-shadow-md">
                    {r.emoji}
                </div>
            ))}
        </div>
    </div>
);


export const NativeCallContainer = ({ roomId, onLeave, roomName = 'Team Discussion', projectId }: NativeCallContainerProps) => {
    const { user } = useAuth();
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
    const [peers, setPeers] = useState<Record<string, PeerConnection>>({});

    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [isHandRaised, setIsHandRaised] = useState(false);

    // UI States
    const [activeTab, setActiveTab] = useState<'chat' | 'people' | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [reactions, setReactions] = useState<Reaction[]>([]);
    const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set());
    const [callDuration, setCallDuration] = useState(0);
    const [allRoomMembers, setAllRoomMembers] = useState<{ id: string; username: string; avatar_url: string }[]>([]);
    const [isHost, setIsHost] = useState(false);
    const [hostId, setHostId] = useState<string | null>(null);

    // Feature States
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [showSettings, setShowSettings] = useState(false);

    const { toast } = useToast();

    const peersRef = useRef<Record<string, PeerConnection>>({});
    const roomChannelRef = useRef<any>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

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
            }
        };
        startLocalStream();
        return () => {
            isMounted = false;
            streamRef.current?.getTracks().forEach(track => track.stop());
        };
    }, []);

    // Fetch All Room Members (for "Ask to Join" list)
    useEffect(() => {
        const fetchMembers = async () => {
            // If we are in a project call, fetch project members
            if (projectId) {
                const { data: members, error } = await supabase
                    .from('project_members')
                    .select('user_id, profiles(id, username, avatar_url)')
                    .eq('project_id', projectId);

                if (members && !error) {
                    const mapped = members.map((m: any) => ({
                        id: m.profiles.id,
                        username: m.profiles.username,
                        avatar_url: m.profiles.avatar_url
                    }));
                    setAllRoomMembers(mapped);
                }
            }
            // Otherwise, default to discussion room members if roomId is present (and not a project call)
            else if (roomId) {
                // Ensure we don't try to query room_members with a non-discussion UUID (though handled by projectId check above)
                const { data: members, error } = await supabase
                    .from('room_members')
                    .select('user_id, profiles(id, username, avatar_url)')
                    .eq('room_id', roomId);

                if (members && !error) {
                    const mapped = members.map((m: any) => ({
                        id: m.profiles.id,
                        username: m.profiles.username,
                        avatar_url: m.profiles.avatar_url
                    }));
                    setAllRoomMembers(mapped);
                }
            }
        };
        fetchMembers();
    }, [roomId, projectId]);

    // Determine Host (first person to join or call creator)
    useEffect(() => {
        const checkHost = async () => {
            if (!user) return;

            // Check if there's an active call and who created it
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
                // Fallback: first person is host
                setIsHost(Object.keys(peers).length === 0);
                setHostId(user.id);
            }
        };
        checkHost();
    }, [roomId, user, peers]);

    // Signaling & Events
    useEffect(() => {
        if (!user || !localStream) return;

        const channel = supabase.channel(`call_signaling:${roomId}`);
        roomChannelRef.current = channel;

        const handleSignal = async (payload: any) => {
            const { type, fromUserId, toUserId, answer, offer, candidate, content, emoji, id, handRaised, isScreenSharing: remoteIsScreenSharing } = payload.payload;

            // WebRTC Signaling
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

            // Features (Broadcast)
            if (type === 'chat') {
                setMessages(prev => [...prev, { id, userId: fromUserId, content, timestamp: Date.now() }]);
            }
            if (type === 'reaction') {
                const newReaction = { id, userId: fromUserId, emoji, timestamp: Date.now() };
                setReactions(prev => [...prev, newReaction]);
                setTimeout(() => {
                    setReactions(prev => prev.filter(r => r.id !== id));
                }, 4000);
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
            // Host Controls
            if (type === 'remove_participant' && payload.targetUserId === user.id) {
                toast({ title: "Removed from Call", description: "You have been removed by the host.", variant: "destructive" });
                setTimeout(() => onLeave(), 2000);
            }
            if (type === 'host_mute' && payload.targetUserId === user.id) {
                if (localStream) {
                    localStream.getAudioTracks().forEach(t => t.enabled = false);
                    setIsMuted(true);
                    toast({ title: "Muted by Host", description: "You have been muted by the host." });
                }
            }
        };

        // Presence Logic
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
            supabase.removeChannel(channel);
        };
    }, [roomId, user, localStream]);

    const createPeerConnection = (targetUserId: string, initiator: boolean) => {
        if (peersRef.current[targetUserId]) return peersRef.current[targetUserId];
        const pc = new RTCPeerConnection(ICE_SERVERS);

        if (localStream) {
            localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
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
    };

    const removePeer = (userId: string) => {
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
    };

    const sendMessage = () => {
        if (!chatInput.trim()) return;
        const id = Math.random().toString(36).substr(2, 9);
        const msg = { id, userId: user?.id || 'me', content: chatInput, timestamp: Date.now() };
        setMessages(prev => [...prev, msg]);
        roomChannelRef.current?.send({
            type: 'broadcast',
            event: 'signal',
            payload: { type: 'chat', content: chatInput, fromUserId: user?.id, id }
        });
        setChatInput('');
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

    const toggleHandRaise = () => {
        const newState = !isHandRaised;
        setIsHandRaised(newState);
        setRaisedHands(prev => {
            const newSet = new Set(prev);
            if (newState) {
                if (user?.id) newSet.add(user.id);
            } else {
                if (user?.id) newSet.delete(user.id);
            }
            return newSet;
        });

        roomChannelRef.current?.send({
            type: 'broadcast',
            event: 'signal',
            payload: { type: 'hand_raise', handRaised: newState, fromUserId: user?.id }
        });
    };

    // Host Controls
    const handleRemoveParticipant = (userId: string) => {
        if (!isHost) return;

        roomChannelRef.current?.send({
            type: 'broadcast',
            event: 'signal',
            payload: { type: 'remove_participant', targetUserId: userId, fromUserId: user?.id }
        });

        // Remove peer locally
        removePeer(userId);
        toast({ title: "Participant Removed", description: "User has been removed from the call." });
    };

    const handleMuteParticipant = (userId: string) => {
        if (!isHost) return;

        roomChannelRef.current?.send({
            type: 'broadcast',
            event: 'signal',
            payload: { type: 'host_mute', targetUserId: userId, fromUserId: user?.id }
        });

        toast({ title: "Participant Muted", description: "User has been muted by host." });
    };

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, activeTab]);

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

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    };

    const toggleScreenShare = async () => {
        if (isScreenSharing) {
            // Stop sharing - revert to camera
            try {
                // We typically already have localStream (camera) running in PIP. 
                // We just need to replace the sender track with the camera track.

                let cameraVideoTrack: MediaStreamTrack | undefined;

                if (localStream) {
                    cameraVideoTrack = localStream.getVideoTracks()[0];
                } else {
                    // Fallback if localStream was somehow lost (unlikely)
                    const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                    setLocalStream(cameraStream);
                    cameraVideoTrack = cameraStream.getVideoTracks()[0];
                }

                if (cameraVideoTrack) {
                    Object.values(peersRef.current).forEach(peer => {
                        const sender = peer.connection.getSenders().find(s => s.track?.kind === 'video');
                        if (sender) sender.replaceTrack(cameraVideoTrack);
                    });
                }

                // Stop the screen share tracks to ensure browser UI updates
                if (screenStream) {
                    screenStream.getTracks().forEach(track => track.stop());
                }

                setScreenStream(null);
                setIsScreenSharing(false);
                roomChannelRef.current?.send({
                    type: 'broadcast',
                    event: 'signal',
                    payload: { type: 'screen_share_status', isScreenSharing: false, fromUserId: user?.id }
                });
            } catch (e) {
                console.error("Error revert to camera", e);
            }
        } else {
            try {
                // Start sharing
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                const screenTrack = screenStream.getVideoTracks()[0];

                // Handle user clicking "Stop sharing" in browser UI
                screenTrack.onended = () => {
                    if (isScreenSharing) toggleScreenShare(); // Revert if ended externally
                };

                // Replace track in peer connections
                Object.values(peersRef.current).forEach(peer => {
                    const sender = peer.connection.getSenders().find(s => s.track?.kind === 'video');
                    if (sender) sender.replaceTrack(screenTrack);
                });

                setScreenStream(screenStream);
                setIsScreenSharing(true);

                roomChannelRef.current?.send({
                    type: 'broadcast',
                    event: 'signal',
                    payload: { type: 'screen_share_status', isScreenSharing: true, fromUserId: user?.id }
                });
            } catch (err) {
                console.error("Failed to share screen:", err);
            }
        }
    };

    const handleDeviceChange = async (deviceId: string, kind: MediaDeviceKind) => {
        console.log(`Switching ${kind} to ${deviceId}`);
        // Basic replacement logic
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

            setLocalStream(newStream); // Propagate to LocalVideoFrame
        } catch (e) {
            console.error("Failed to switch device", e);
        }
    };

    return (
        <div ref={containerRef} className="fixed inset-0 z-[100] bg-[#202124] text-white flex flex-col font-sans">

            {/* --- TOP BAR --- */}
            <div className="h-14 bg-[#1f1f1f] border-b border-[#333] flex items-center justify-between px-4 z-10 shrink-0">
                <div className="flex items-center gap-4">
                    <span className="font-semibold text-lg">{roomName}</span>
                    <Badge variant="outline" className="text-xs font-normal border-gray-600 text-gray-300">
                        {formatDuration(callDuration)}
                    </Badge>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost" size="sm"
                        className={`text-gray-300 hover:text-white hover:bg-[#333] ${activeTab === 'people' ? 'bg-[#333] text-white' : ''}`}
                        onClick={() => setActiveTab(activeTab === 'people' ? null : 'people')}
                    >
                        <Users className="w-5 h-5 mr-2" />
                        <span className="hidden sm:inline">People</span>
                        <span className="ml-1 bg-gray-700 text-xs px-1.5 rounded-full">{Object.keys(peers).length + 1}</span>
                    </Button>
                </div>
            </div>

            {/* --- MAIN STAGE --- */}
            <div className="flex flex-1 overflow-hidden">
                <div className="flex-1 p-4 relative flex items-center justify-center bg-[#202124]">
                    {/* GRID LAYOUT */}
                    <div className="relative w-full h-full bg-[#202124] flex items-center justify-center p-4">
                        {/* PRESENTATION MODE: LOCAL SHARE */}
                        {isScreenSharing && screenStream ? (
                            <div className="w-full h-full flex flex-col items-center justify-center relative">
                                <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-center pointer-events-none">
                                    <div className="bg-blue-600 px-6 py-2 rounded-b-xl shadow-lg flex items-center gap-2 pointer-events-auto">
                                        <MonitorUp className="w-4 h-4 text-white" />
                                        <span className="text-white font-medium text-sm">You are presenting to everyone</span>
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            className="h-7 text-xs ml-4 bg-white text-blue-600 hover:bg-gray-100"
                                            onClick={toggleScreenShare}
                                        >
                                            Stop presenting
                                        </Button>
                                    </div>
                                </div>

                                <video
                                    ref={(ref) => { if (ref) ref.srcObject = screenStream; }}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="max-w-full max-h-full object-contain rounded-lg shadow-2xl border border-[#333]"
                                />

                                {/* PIP: ME (CAMERA) */}
                                <div className="absolute bottom-20 right-4 w-32 h-24 md:bottom-4 md:w-60 md:h-40 z-30 shadow-2xl transition-all hover:scale-105 duration-300">
                                    <LocalVideoFrame
                                        className="w-full h-full border-2 border-white/20 shadow-xl rounded-xl bg-[#202124]"
                                        localStream={localStream}
                                        isMuted={isMuted}
                                        isVideoOff={isVideoOff}
                                        isHandRaised={isHandRaised}
                                        isScreenSharing={false} // Always false for the camera PIP
                                        reactions={reactions}
                                        userId={user?.id}
                                    />
                                </div>
                            </div>
                        ) : isScreenSharing ? (
                            <div className="text-white">Loading Screen Share...</div>
                        ) : (
                            /* GRID LAYOUT (Normal) */
                            <div className="flex flex-wrap justify-center items-center gap-4 w-full h-full p-4 overflow-y-auto content-center">
                                {/* Calculate width based on count */}
                                {(() => {
                                    const totalCount = Object.keys(peers).length + 1;
                                    // Simple responsive logic:
                                    // 1 person: max-w-4xl h-auto
                                    // 2 people: w-1/2 (on large)
                                    // 3+ people: w-1/3 etc
                                    // Actually flex-basis with min-width is easier.
                                    const getClass = () => {
                                        if (totalCount === 1) return "max-w-4xl w-full h-[80vh]";
                                        if (totalCount === 2) return "w-full md:w-[45%] aspect-video";
                                        if (totalCount <= 4) return "w-full md:w-[45%] lg:w-[45%] aspect-video";
                                        return "w-full md:w-[30%] aspect-video";
                                    };
                                    const cardClass = getClass();

                                    return (
                                        <>
                                            <LocalVideoFrame
                                                className={`${cardClass} transition-all duration-300`}
                                                localStream={localStream}
                                                isMuted={isMuted}
                                                isVideoOff={isVideoOff}
                                                isHandRaised={isHandRaised}
                                                isScreenSharing={false}
                                                reactions={reactions}
                                                userId={user?.id}
                                            />
                                            {Object.values(peers).map((peer) => (
                                                <RemoteVideoFrame
                                                    key={peer.userId}
                                                    peer={peer}
                                                    className={`${cardClass} transition-all duration-300`}
                                                    raisedHands={raisedHands}
                                                    reactions={reactions}
                                                />
                                            ))}
                                        </>
                                    )
                                })()}
                            </div>
                        )}
                    </div>
                    ) : (
                    /* SPEAKER LAYOUT */
                    <div className="flex flex-col h-full w-full gap-4">
                        {/* Spotlight Area (First peer or active speaker) */}
                        <div className="flex-1 flex items-center justify-center bg-[#3c4043] rounded-xl overflow-hidden border border-[#444] shadow-2xl">
                            {Object.values(peers).length > 0 ? (
                                <RemoteVideoFrame
                                    peer={Object.values(peers)[0]}
                                    raisedHands={raisedHands}
                                    reactions={reactions}
                                    className="w-full h-full object-contain"
                                />
                            ) : (
                                <div className="text-gray-400">Waiting for others to join...</div>
                            )}
                        </div>

                        {/* Filmstrip (Me + Others) */}
                        <div className="h-32 flex gap-4 overflow-x-auto pb-2 shrink-0">
                            <LocalVideoFrame
                                className={isScreenSharing ? "h-full w-auto aspect-auto border-blue-500/50" : "h-full aspect-video w-auto"}
                                localStream={localStream}
                                isMuted={isMuted}
                                isVideoOff={isVideoOff}
                                isHandRaised={isHandRaised}
                                isScreenSharing={isScreenSharing}
                                reactions={reactions}
                                userId={user?.id}
                            />
                            {Object.values(peers).slice(1).map((peer) => (
                                <RemoteVideoFrame
                                    key={peer.userId}
                                    peer={peer}
                                    className="h-full aspect-video w-auto"
                                    raisedHands={raisedHands}
                                    reactions={reactions}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* --- SIDE PANEL --- */}
                {activeTab && (
                    <div className="fixed inset-0 z-[60] md:relative md:inset-auto md:z-0 w-full md:w-80 bg-[#1f1f1f] border-l border-[#333] flex flex-col h-full animate-in slide-in-from-right duration-300 shadow-2xl">
                        <div className="p-4 border-b border-[#333] flex justify-between items-center bg-[#2b2b2b]">
                            <h3 className="font-semibold text-white">
                                {activeTab === 'chat' ? 'In-Call Messages' : 'People'}
                            </h3>
                            <Button variant="ghost" size="icon" onClick={() => setActiveTab(null)} className="h-8 w-8 text-gray-400 hover:text-white hover:bg-[#333]">
                                <X className="h-5 w-5" />
                            </Button>
                        </div>

                        {activeTab === 'chat' && (
                            <>
                                <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
                                    <div className="text-center text-xs text-gray-400 my-4 bg-[#333] p-2 rounded-md">Messages are only visible during the call.</div>
                                    {messages.map((msg) => (
                                        <div key={msg.id} className="flex flex-col gap-1">
                                            <div className="flex items-center justify-between">
                                                <span className="font-bold text-sm text-blue-300">{msg.userId === user?.id ? 'You' : `User ${msg.userId.slice(0, 4)}`}</span>
                                                <span className="text-[10px] text-gray-500">{format(new Date(msg.timestamp), 'h:mm a')}</span>
                                            </div>
                                            <p className="text-sm text-gray-200 bg-[#333] p-2 rounded-lg rounded-tl-none inline-block self-start break-words border border-[#444]">{msg.content}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="p-4 border-t border-[#333] bg-[#2b2b2b]">
                                    <div className="relative flex items-center gap-2">
                                        <Input
                                            className="bg-[#3c4043] border-none text-white focus-visible:ring-1 focus-visible:ring-blue-500 rounded-full pl-4"
                                            placeholder="Send a message..."
                                            value={chatInput}
                                            onChange={(e) => setChatInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                                        />
                                        <Button size="icon" variant="secondary" className="rounded-full bg-blue-600 hover:bg-blue-700 text-white shrink-0" onClick={sendMessage}>
                                            <Send className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}

                        {activeTab === 'people' && (
                            <div className="flex-1 overflow-y-auto p-4">
                                <div className="space-y-4">
                                    {/* SECTION: IN MEETING */}
                                    <div>
                                        <div className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">In Meeting ({Object.keys(peers).length + 1})</div>

                                        {/* Me */}
                                        <div className="flex items-center justify-between p-2 rounded-md hover:bg-[#333] transition-colors">
                                            <div className="flex items-center gap-3">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarFallback className="bg-purple-600 text-white text-xs">ME</AvatarFallback>
                                                </Avatar>
                                                <span className="text-sm font-medium text-white">You {isHost && <span className="text-xs bg-purple-600 px-2 py-0.5 rounded-full ml-2">Host</span>}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                {isHandRaised && <Hand className="w-4 h-4 text-yellow-400" />}
                                                {isMuted ? <MicOff className="w-4 h-4 text-red-500" /> : <Mic className="w-4 h-4 text-green-500" />}
                                            </div>
                                        </div>

                                        {/* Others In Call */}
                                        {Object.values(peers).map(peer => {
                                            const profile = allRoomMembers.find(m => m.id === peer.userId);
                                            const isParticipantHost = peer.userId === hostId;
                                            return (
                                                <div key={peer.userId} className="flex items-center justify-between p-2 rounded-md hover:bg-[#333] transition-colors group">
                                                    <div className="flex items-center gap-3 flex-1">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarImage src={profile?.avatar_url} />
                                                            <AvatarFallback className="bg-blue-600 text-white text-xs">{profile?.username?.charAt(0) || 'U'}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-medium text-gray-200">{profile?.username || `User ${peer.userId.slice(0, 4)}`}</span>
                                                                {isParticipantHost && <span className="text-xs bg-purple-600 px-2 py-0.5 rounded-full">Host</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {raisedHands.has(peer.userId) && <Hand className="w-4 h-4 text-yellow-400" />}
                                                        <Mic className="w-4 h-4 text-gray-500" />

                                                        {/* Host Controls */}
                                                        {isHost && (
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                        <MoreHorizontal className="w-4 h-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="bg-[#333] border-[#444] text-white">
                                                                    <DropdownMenuItem onClick={() => handleMuteParticipant(peer.userId)} className="focus:bg-[#444] cursor-pointer">
                                                                        <MicOff className="w-4 h-4 mr-2" /> Mute
                                                                    </DropdownMenuItem>
                                                                    <DropdownMenuItem onClick={() => handleRemoveParticipant(peer.userId)} className="focus:bg-[#444] cursor-pointer text-red-400">
                                                                        <X className="w-4 h-4 mr-2" /> Remove from call
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* SECTION: SUGGESTIONS (Not in Call) */}
                                    <div>
                                        <div className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Suggestions</div>
                                        {allRoomMembers
                                            .filter(m => m.id !== user?.id && !peers[m.id])
                                            .map(member => (
                                                <div key={member.id} className="flex items-center justify-between p-2 rounded-md hover:bg-[#333] transition-colors group">
                                                    <div className="flex items-center gap-3">
                                                        <Avatar className="h-8 w-8 opacity-75">
                                                            <AvatarImage src={member.avatar_url} />
                                                            <AvatarFallback className="bg-gray-600 text-gray-300 text-xs">{member.username?.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        <span className="text-sm font-medium text-gray-400">{member.username}</span>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 px-2 opacity-0 group-hover:opacity-100 transition-all font-semibold text-xs"
                                                        onClick={() => {
                                                            toast({ title: "Invitation Sent", description: `Asked ${member.username} to join.` });
                                                        }}
                                                    >
                                                        Ask to join
                                                    </Button>
                                                </div>
                                            ))
                                        }
                                        {allRoomMembers.filter(m => m.id !== user?.id && !peers[m.id]).length === 0 && (
                                            <div className="text-xs text-gray-500 italic px-2">Everyone is here!</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* --- BOTTOM CONTROLS --- */}
            <div className="h-20 bg-[#202124] flex items-center justify-between px-6 shrink-0 relative z-50">
                {/* Left: Clock / Room Info */}
                {/* Left: Clock / Room Info - REMOVED */}
                <div className="hidden md:flex items-center gap-4 text-white font-medium select-none opacity-0 pointer-events-none">
                    {/* Space reserved if needed, but hidden for now as per user request */}
                </div>

                {/* Center: Controls (DESKTOP) */}
                <div className="hidden md:flex items-center gap-3 absolute left-1/2 transform -translate-x-1/2">
                    <ControlButton onClick={toggleMute} active={!isMuted} activeIcon={<Mic className="w-5 h-5" />} inactiveIcon={<MicOff className="w-5 h-5" />} danger={isMuted} />
                    <ControlButton onClick={toggleVideo} active={!isVideoOff} activeIcon={<Video className="w-5 h-5" />} inactiveIcon={<VideoOff className="w-5 h-5" />} danger={isVideoOff} />
                    <ControlButton onClick={toggleHandRaise} active={isHandRaised} activeIcon={<Hand className="w-5 h-5 text-black" />} inactiveIcon={<Hand className="w-5 h-5" />} activeClass="bg-blue-300 hover:bg-blue-400" />
                    <ControlButton
                        onClick={toggleScreenShare}
                        active={isScreenSharing}
                        activeIcon={<MonitorUp className="w-5 h-5 text-black" />}
                        inactiveIcon={<MonitorUp className="w-5 h-5" />}
                        activeClass="bg-blue-300 hover:bg-blue-400"
                    />

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button className="h-12 w-12 rounded-full bg-[#3c4043] hover:bg-[#4d5155] border-transparent text-white">
                                <Smile className="w-5 h-5" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-2 bg-[#333] border-[#444] rounded-full flex gap-1 mb-4" side="top">
                            {EMOJIS.map(emoji => (
                                <button key={emoji} onClick={() => sendReaction(emoji)} className="text-2xl hover:scale-125 transition-transform p-1.5 active:scale-95">{emoji}</button>
                            ))}
                        </PopoverContent>
                    </Popover>

                    <Button variant="destructive" className="h-12 w-16 rounded-full bg-red-600 hover:bg-red-700 shadow-lg shadow-red-900/20 px-0 flex items-center justify-center ml-2" onClick={onLeave}>
                        <PhoneOff className="w-6 h-6" />
                    </Button>
                </div>

                {/* Right: Info / Chat / More (DESKTOP) */}
                <div className="hidden md:flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="text-white hover:bg-[#3c4043] rounded-full h-12 w-12" onClick={() => setActiveTab(activeTab === 'people' ? null : 'people')}>
                        <Users className="w-5 h-5" />
                    </Button>
                    <Button
                        onClick={() => setActiveTab(activeTab === 'chat' ? null : 'chat')}
                        variant="ghost" size="icon"
                        className={`text-white hover:bg-[#3c4043] rounded-full h-12 w-12 relative ${activeTab === 'chat' ? 'bg-[#8ab4f8] text-black hover:bg-[#8ab4f8]' : ''}`}
                    >
                        <MessageSquare className="w-5 h-5" />
                        {messages.length > 0 && !activeTab && (<span className="absolute top-3 right-3 h-2 w-2 bg-red-500 rounded-full" />)}
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-white hover:bg-[#3c4043] rounded-full h-12 w-12">
                                <MoreHorizontal className="w-5 h-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        {/* Dropdown Content */}
                        <DropdownMenuContent align="end" className="bg-[#333] border-[#444] text-white w-56">
                            <DropdownMenuLabel>More Options</DropdownMenuLabel>
                            <DropdownMenuSeparator className="bg-[#444]" />
                            <DropdownMenuItem onClick={toggleFullscreen} className="focus:bg-[#444] cursor-pointer">
                                <Maximize className="w-4 h-4 mr-2" /> {document.fullscreenElement ? 'Exit Full Screen' : 'Full Screen'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setShowSettings(true)} className="focus:bg-[#444] cursor-pointer">
                                <Settings className="w-4 h-4 mr-2" /> Settings
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* --- MOBILE CONTROLS (Visible only on small screens) --- */}
                <div className="flex md:hidden items-center justify-between w-full gap-2 px-2">
                    <ControlButton onClick={onLeave} active={false} activeIcon={null} inactiveIcon={<PhoneOff className="w-5 h-5" />} danger={true} />
                    <ControlButton onClick={toggleMute} active={!isMuted} activeIcon={<Mic className="w-5 h-5" />} inactiveIcon={<MicOff className="w-5 h-5" />} danger={isMuted} />
                    <ControlButton onClick={toggleVideo} active={!isVideoOff} activeIcon={<Video className="w-5 h-5" />} inactiveIcon={<VideoOff className="w-5 h-5" />} danger={isVideoOff} />

                    <Button
                        onClick={() => setActiveTab(activeTab === 'chat' ? null : 'chat')}
                        className={`h-12 w-12 rounded-full border-none ${activeTab === 'chat' ? 'bg-blue-300 text-black' : 'bg-[#3c4043] text-white'}`}
                    >
                        <MessageSquare className="w-5 h-5" />
                        {messages.length > 0 && !activeTab && (<span className="absolute top-0 right-0 h-3 w-3 bg-red-500 rounded-full border-2 border-[#1f1f1f]" />)}
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button className="h-12 w-12 rounded-full bg-[#3c4043] text-white border-none">
                                <MoreHorizontal className="w-5 h-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-[#333] border-[#444] text-white w-64 pb-4">
                            <DropdownMenuLabel>Options</DropdownMenuLabel>
                            <div className="grid grid-cols-4 gap-2 p-2">
                                {EMOJIS.map(emoji => (
                                    <button key={emoji} onClick={() => sendReaction(emoji)} className="text-2xl hover:scale-125 transition-transform p-1">{emoji}</button>
                                ))}
                            </div>
                            <DropdownMenuSeparator className="bg-[#444]" />
                            <DropdownMenuItem onClick={() => setActiveTab('people')} className="focus:bg-[#444] p-3 cursor-pointer">
                                <Users className="w-5 h-5 mr-3" /> People ({Object.keys(peers).length + 1})
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={toggleHandRaise} className="focus:bg-[#444] p-3 cursor-pointer">
                                <Hand className={`w-5 h-5 mr-3 ${isHandRaised ? 'text-yellow-400' : ''}`} /> {isHandRaised ? 'Lower Hand' : 'Raise Hand'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={toggleScreenShare} className="focus:bg-[#444] p-3 cursor-pointer">
                                <MonitorUp className={`w-5 h-5 mr-3 ${isScreenSharing ? 'text-blue-400' : ''}`} /> {isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setShowSettings(true)} className="focus:bg-[#444] p-3 cursor-pointer">
                                <Settings className="w-5 h-5 mr-3" /> Settings
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            <SettingsDialog
                open={showSettings}
                onOpenChange={setShowSettings}
                currentStream={localStream}
                onDeviceChange={handleDeviceChange}
            />
        </div>
    );
};

// Helper for control buttons to keep JSX clean
const ControlButton = ({ onClick, active, activeIcon, inactiveIcon, danger, activeClass }: any) => {
    return (
        <Button onClick={onClick} className={`h-12 w-12 rounded-full transition-all border-none ${danger ? 'bg-red-600 hover:bg-red-700 text-white' : active ? (activeClass || 'bg-[#3c4043] hover:bg-[#4d5155] text-white') : 'bg-[#3c4043] hover:bg-[#4d5155] text-white'}`}>
            {active ? activeIcon : inactiveIcon}
        </Button>
    )
}

// Settings Dialog Component
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
            <DialogContent className="bg-[#333] border-[#444] text-white">
                <DialogHeader>
                    <DialogTitle>Call Settings</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Camera</label>
                        <select
                            className="w-full bg-[#222] border border-[#444] rounded-md p-2 text-sm"
                            onChange={(e) => onDeviceChange(e.target.value, 'videoinput')}
                        >
                            {videoDevices.map(d => (
                                <option key={d.deviceId || 'default-cam'} value={d.deviceId}>{d.label || `Camera ${videoDevices.indexOf(d) + 1}`}</option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300">Microphone</label>
                        <select
                            className="w-full bg-[#222] border border-[#444] rounded-md p-2 text-sm"
                            onChange={(e) => onDeviceChange(e.target.value, 'audioinput')}
                        >
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

