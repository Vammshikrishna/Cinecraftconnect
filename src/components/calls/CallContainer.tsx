import { useEffect, useState, useRef } from 'react';
import DailyIframe, { DailyCall } from '@daily-co/daily-js';
import { DailyProvider, useDaily, useParticipantIds } from '@daily-co/daily-react';
import { CallControls } from './CallControls';
import { ParticipantGrid } from './ParticipantGrid';
import { CallChatSidebar } from './CallChatSidebar';
import { ReactionDisplay } from './ReactionDisplay';
import { ParticipantList } from './ParticipantList';
import { Button } from '@/components/ui/button';
import { X, Users, MessageCircle } from 'lucide-react';

interface CallContainerProps {
    callId: string;
    roomUrl: string;
    roomType: 'project' | 'discussion';
    roomId: string;
    onLeave: () => void;
}

const CallRoom = ({ callId, roomType, roomId, onLeave }: Omit<CallContainerProps, 'roomUrl'>) => {
    const daily = useDaily();
    const participantIds = useParticipantIds();
    const [showChat, setShowChat] = useState(false);
    const [showParticipants, setShowParticipants] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);

    useEffect(() => {
        if (!daily) return;

        const handleParticipantUpdated = (event: any) => {
            if (event.participant.screen) {
                setIsScreenSharing(true);
            } else {
                setIsScreenSharing(false);
            }
        };

        daily.on('participant-updated', handleParticipantUpdated);

        return () => {
            daily.off('participant-updated', handleParticipantUpdated);
        };
    }, [daily]);

    const handleLeaveCall = async () => {
        if (daily) {
            await daily.leave();
            await daily.destroy();
        }
        onLeave();
    };

    return (
        <div className="h-screen w-screen bg-background flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-card">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={handleLeaveCall}>
                        <X className="h-5 w-5" />
                    </Button>
                    <h2 className="text-lg font-semibold">
                        {roomType === 'project' ? 'Project Call' : 'Discussion Room Call'}
                    </h2>
                    <span className="text-sm text-muted-foreground">
                        {participantIds.length} participant{participantIds.length !== 1 ? 's' : ''}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant={showParticipants ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setShowParticipants(!showParticipants)}
                    >
                        <Users className="h-4 w-4 mr-2" />
                        Participants
                    </Button>
                    <Button
                        variant={showChat ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setShowChat(!showChat)}
                    >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Chat
                    </Button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Video Grid */}
                <div className="flex-1 relative">
                    <ParticipantGrid isScreenSharing={isScreenSharing} />
                    <ReactionDisplay callId={callId} />
                </div>

                {/* Sidebars */}
                {showParticipants && (
                    <div className="w-80 border-l border-border bg-card">
                        <ParticipantList callId={callId} roomType={roomType} roomId={roomId} />
                    </div>
                )}

                {showChat && (
                    <div className="w-96 border-l border-border bg-card">
                        <CallChatSidebar callId={callId} roomType={roomType} roomId={roomId} />
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="p-4 border-t border-border bg-card">
                <CallControls callId={callId} onLeave={handleLeaveCall} />
            </div>
        </div>
    );
};

export const CallContainer = ({ callId, roomUrl, roomType, roomId, onLeave }: CallContainerProps) => {
    const [callObject, setCallObject] = useState<DailyCall | null>(null);
    const [error, setError] = useState<string | null>(null);
    const callObjectRef = useRef<DailyCall | null>(null);

    useEffect(() => {
        if (callObjectRef.current) return; // Prevent duplicate initialization

        const initializeCall = async () => {
            try {
                const daily = DailyIframe.createCallObject({
                    url: roomUrl,
                });

                callObjectRef.current = daily;

                // Add timeout for join
                const joinPromise = daily.join();
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Join timed out')), 15000)
                );

                await Promise.race([joinPromise, timeoutPromise]);

                // Only set state after joining to ensure participants are loaded
                setCallObject(daily);
            } catch (error: any) {
                console.error('Error joining call:', error);
                setError(error.message || 'Failed to join call');
                if (callObjectRef.current) {
                    callObjectRef.current.destroy();
                    callObjectRef.current = null;
                }
                // Don't auto-leave, let user see error
            }
        };

        initializeCall();

        return () => {
            if (callObjectRef.current) {
                callObjectRef.current.leave().then(() => {
                    callObjectRef.current?.destroy();
                    callObjectRef.current = null;
                }).catch(console.error);
            }
        };
    }, [roomUrl, onLeave]);

    if (error) {
        const isApiKeyError = error.includes('API key is missing');
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-background">
                <div className="text-center max-w-md p-6 border border-destructive/20 bg-destructive/10 rounded-lg">
                    <h3 className="text-lg font-semibold text-destructive mb-2">Connection Error</h3>
                    <p className="text-muted-foreground mb-4">{error}</p>
                    {isApiKeyError && (
                        <p className="text-xs text-muted-foreground mb-4">
                            Please add <code>VITE_DAILY_API_KEY</code> to your <code>.env.local</code> file.
                        </p>
                    )}
                    <Button onClick={onLeave} variant="outline">
                        Close
                    </Button>
                </div>
            </div>
        );
    }

    if (!callObject) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-background">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Joining call...</p>
                    <p className="text-xs text-muted-foreground mt-2">Please allow camera/microphone access</p>
                </div>
            </div>
        );
    }

    return (
        <DailyProvider callObject={callObject}>
            <CallRoom callId={callId} roomType={roomType} roomId={roomId} onLeave={onLeave} />
        </DailyProvider>
    );
};
