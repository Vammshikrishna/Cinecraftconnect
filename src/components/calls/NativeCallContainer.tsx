import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// Free public STUN servers (like WhatsApp uses)
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
}

interface NativeCallContainerProps {
    roomId: string; // The Project Space ID
    onLeave: () => void;
}

export const NativeCallContainer = ({ roomId, onLeave }: NativeCallContainerProps) => {
    const { user } = useAuth();
    const [localStream, setLocalStream] = useState<MediaStream | null>(null);
    const [peers, setPeers] = useState<Record<string, PeerConnection>>({});
    const [updateTrigger, setUpdateTrigger] = useState(0); // Force re-render for peer updates

    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const peersRef = useRef<Record<string, PeerConnection>>({}); // Ref to keep track without re-renders affecting logic
    const roomChannelRef = useRef<any>(null);

    // Initialize Local Stream
    useEffect(() => {
        const startLocalStream = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: true
                });
                setLocalStream(stream);
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }
            } catch (err) {
                console.error("Failed to access camera/mic:", err);
            }
        };

        startLocalStream();

        return () => {
            // Cleanup local stream on unmount
            localStream?.getTracks().forEach(track => track.stop());
        };
    }, []);

    // Signaling & Connections
    useEffect(() => {
        if (!user || !localStream) return;

        const channel = supabase.channel(`call_signaling:${roomId}`);
        roomChannelRef.current = channel;

        const handleNewUser = async (newUserId: string) => {
            if (newUserId === user.id || peersRef.current[newUserId]) return;

            console.log(`User joined: ${newUserId}. I am initiating call.`);
            createPeerConnection(newUserId, true);
        };

        const handleOffer = async (payload: any) => {
            const { offer, fromUserId } = payload;
            if (fromUserId === user.id) return;

            console.log(`Received offer from ${fromUserId}`);
            const pc = createPeerConnection(fromUserId, false);

            await pc.connection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.connection.createAnswer();
            await pc.connection.setLocalDescription(answer);

            channel.send({
                type: 'broadcast',
                event: 'signal',
                payload: { type: 'answer', answer, fromUserId: user.id, toUserId: fromUserId }
            });
        };

        const handleAnswer = async (payload: any) => {
            const { answer, fromUserId } = payload;
            if (fromUserId === user.id) return;

            const peer = peersRef.current[fromUserId];
            if (peer) {
                console.log(`Received answer from ${fromUserId}`);
                await peer.connection.setRemoteDescription(new RTCSessionDescription(answer));
            }
        };

        const handleCandidate = async (payload: any) => {
            const { candidate, fromUserId } = payload;
            if (fromUserId === user.id) return;

            const peer = peersRef.current[fromUserId];
            if (peer) {
                // console.log(`Received ICE candidate from ${fromUserId}`);
                await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
            }
        };

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                // Check for new users in presence state
                Object.keys(state).forEach((key) => {
                    // Presence key might be complex, usually we look at user_id inside
                    state[key].forEach((presence: any) => {
                        if (presence.user_id && presence.user_id !== user.id) {
                            // If we are 'older' or sorted higher, we initiate? 
                            // Simplified: Just broadcast 'ready' and let existing users call me?
                            // Or rely on 'join' trigger.
                        }
                    })
                });
            })
            .on('presence', { event: 'join' }, ({ newPresences }: any) => {
                newPresences.forEach((presence: any) => {
                    if (presence.user_id) handleNewUser(presence.user_id);
                });
            })
            .on('presence', { event: 'leave' }, ({ leftPresences }: any) => {
                leftPresences.forEach((presence: any) => {
                    if (presence.user_id) removePeer(presence.user_id);
                });
            })
            .on('broadcast', { event: 'signal' }, (payload) => {
                const { type, fromUserId, toUserId } = payload.payload;
                if (toUserId && toUserId !== user.id) return; // Only process if intended for me (or broadcast)

                if (type === 'offer') handleOffer(payload.payload);
                if (type === 'answer') handleAnswer(payload.payload);
                if (type === 'candidate') handleCandidate(payload.payload);
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    await channel.track({ user_id: user.id, online_at: new Date().toISOString() });
                }
            });

        return () => {
            Object.values(peersRef.current).forEach(p => p.connection.close());
            supabase.removeChannel(channel);
        };
    }, [roomId, user, localStream]); // Re-run if localStream keeps changing? Ideally once.

    const createPeerConnection = (targetUserId: string, initiator: boolean) => {
        if (peersRef.current[targetUserId]) return peersRef.current[targetUserId];

        const pc = new RTCPeerConnection(ICE_SERVERS);

        // Add local tracks
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
            console.log(`Received track from ${targetUserId}`);
            const newStream = event.streams[0] || new MediaStream([event.track]);

            peersRef.current[targetUserId] = {
                ...peersRef.current[targetUserId],
                stream: newStream
            };
            setPeers({ ...peersRef.current });
            setUpdateTrigger(prev => prev + 1);
        };

        peersRef.current[targetUserId] = { userId: targetUserId, connection: pc };

        // Create Offer if initiator
        if (initiator) {
            const makeOffer = async () => {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                roomChannelRef.current?.send({
                    type: 'broadcast',
                    event: 'signal',
                    payload: { type: 'offer', offer, fromUserId: user?.id, toUserId: targetUserId }
                });
            };
            makeOffer();
        }

        setPeers({ ...peersRef.current });
        return peersRef.current[targetUserId];
    };

    const removePeer = (userId: string) => {
        if (peersRef.current[userId]) {
            peersRef.current[userId].connection.close();
            delete peersRef.current[userId];
            setPeers({ ...peersRef.current });
        }
    };

    // Toggle Controls
    const toggleMute = () => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => track.enabled = !track.enabled);
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        if (localStream) {
            localStream.getVideoTracks().forEach(track => track.enabled = !track.enabled);
            setIsVideoOff(!isVideoOff);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-background flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-card">
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-semibold flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Team Call
                    </h2>
                    <span className="text-sm text-muted-foreground">{Object.keys(peers).length + 1} People</span>
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-black/95 overflow-y-auto">
                {/* Local User */}
                <div className="relative bg-muted rounded-lg overflow-hidden aspect-video border border-white/20">
                    <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`}
                    />
                    {isVideoOff && (
                        <div className="absolute inset-0 flex items-center justify-center bg-zinc-800">
                            <Avatar className="h-20 w-20">
                                <AvatarFallback>{user?.email?.charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                        </div>
                    )}
                    <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-white text-xs">
                        You {isMuted && '(Muted)'}
                    </div>
                </div>

                {/* Remote Peers */}
                {Object.values(peers).map((peer) => (
                    <PeerVideo key={peer.userId} peer={peer} />
                ))}
            </div>

            {/* Controls */}
            <div className="p-6 bg-card border-t border-border flex justify-center gap-4">
                <Button
                    variant={isMuted ? "destructive" : "secondary"}
                    size="lg"
                    className="rounded-full h-14 w-14"
                    onClick={toggleMute}
                >
                    {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                </Button>
                <Button
                    variant={isVideoOff ? "destructive" : "secondary"}
                    size="lg"
                    className="rounded-full h-14 w-14"
                    onClick={toggleVideo}
                >
                    {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
                </Button>
                <Button
                    variant="destructive"
                    size="lg"
                    className="rounded-full h-14 w-14"
                    onClick={onLeave}
                >
                    <PhoneOff className="h-6 w-6" />
                </Button>
            </div>
        </div>
    );
};

// Helper Component for Remote Video
const PeerVideo = ({ peer }: { peer: PeerConnection }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    useEffect(() => {
        if (videoRef.current && peer.stream) {
            videoRef.current.srcObject = peer.stream;
        }
    }, [peer.stream, peer.connection]); // Force update if connection changes

    return (
        <div className="relative bg-muted rounded-lg overflow-hidden aspect-video border border-border">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-white text-xs">
                User {peer.userId.slice(0, 4)}
            </div>
        </div>
    );
};
