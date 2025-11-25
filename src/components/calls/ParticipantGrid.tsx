import { useParticipantIds, useScreenShare } from '@daily-co/daily-react';
import { ParticipantTile } from './ParticipantTile';

interface ParticipantGridProps {
    isScreenSharing: boolean;
}

export const ParticipantGrid = ({ isScreenSharing }: ParticipantGridProps) => {
    const participantIds = useParticipantIds();
    const { screens } = useScreenShare();

    const screenShareParticipant = screens.length > 0 ? screens[0] : null;
    const videoParticipants = participantIds.filter(id => id !== screenShareParticipant?.session_id);

    // Calculate grid layout
    const getGridClass = (count: number) => {
        if (count === 1) return 'grid-cols-1';
        if (count === 2) return 'grid-cols-2';
        if (count <= 4) return 'grid-cols-2 grid-rows-2';
        if (count <= 6) return 'grid-cols-3 grid-rows-2';
        return 'grid-cols-3 grid-rows-3';
    };

    if (isScreenSharing && screenShareParticipant) {
        return (
            <div className="h-full flex gap-2 p-4">
                {/* Screen share takes main area */}
                <div className="flex-1">
                    <ParticipantTile
                        sessionId={screenShareParticipant.session_id}
                        isScreenShare={true}
                    />
                </div>

                {/* Video participants in sidebar */}
                {videoParticipants.length > 0 && (
                    <div className="w-64 flex flex-col gap-2 overflow-y-auto">
                        {videoParticipants.map((id) => (
                            <ParticipantTile key={id} sessionId={id} isScreenShare={false} />
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={`h-full p-4 grid ${getGridClass(participantIds.length)} gap-4 auto-rows-fr`}>
            {participantIds.map((id) => (
                <ParticipantTile key={id} sessionId={id} isScreenShare={false} />
            ))}
        </div>
    );
};
