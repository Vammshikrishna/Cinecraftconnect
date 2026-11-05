import { Mic, ShieldBan, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StartAudioSpaceButton } from '@/components/calls/StartAudioSpaceButton';
import { useAccountType } from '@/hooks/useAccountType';
import { FAN_CALL_TOOLTIP } from '@/lib/calls/fanCallRule';

/**
 * Calling in a project space: start a video call, start an audio room, or join one that is already live.
 * Shown in two places: a row of buttons in the header, and a small "Team calls" panel at the bottom of the sidebar.
 */
interface Props {
  layout: 'header' | 'panel';
  /** I am in the call of this space right now */
  isInCall: boolean;
  /** staff in observation mode cannot call */
  isInternal: boolean;
  /** a call or audio room somebody already started here */
  active: { mode: 'call' | 'audio_space' } | null;
  onReturn: () => void;
  onJoin: () => void;
  onStartVideo: () => void;
  onStartAudio: (speakingMode: 'open' | 'request') => void;
}

const LiveDot = () => <span aria-hidden className="h-2 w-2 rounded-full bg-green-400 shrink-0" />;

export const ProjectCallControls = ({ layout, isInCall, isInternal, active, onReturn, onJoin, onStartVideo, onStartAudio }: Props) => {
  const { isFan } = useAccountType();
  if (isInternal) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 h-9 text-xs font-medium text-muted-foreground" title="Staff cannot start or join calls">
        <ShieldBan className="h-4 w-4" />
        <span className={layout === 'header' ? 'hidden sm:inline' : ''}>Observation mode</span>
      </div>
    );
  }

  const joinLabel = active?.mode === 'audio_space' ? 'Join audio room' : 'Join video call';

  if (layout === 'header') {
    if (isInCall) {
      return (
        <Button onClick={onReturn} className="h-9 rounded-full bg-green-600 hover:bg-green-700 text-white gap-2 px-4 font-semibold" aria-label="Return to the call">
          <LiveDot /> <Video className="h-4 w-4" /> <span className="hidden sm:inline">In call</span>
        </Button>
      );
    }
    if (active) {
      return (
        <Button onClick={onJoin} className="h-9 rounded-full bg-green-600 hover:bg-green-700 text-white gap-2 px-4 font-semibold" aria-label={joinLabel}>
          <LiveDot />
          {active.mode === 'audio_space' ? <Mic className="h-4 w-4" /> : <Video className="h-4 w-4" />}
          <span className="hidden sm:inline">{joinLabel}</span>
          <span className="sm:hidden">Join</span>
        </Button>
      );
    }
    return (
      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={onStartVideo} disabled={isFan} title={isFan ? FAN_CALL_TOOLTIP : undefined} className="h-9 rounded-full gap-2 px-3.5 font-medium" aria-label={isFan ? FAN_CALL_TOOLTIP : 'Start a video call'}>
          <Video className="h-4 w-4" />
          <span className="hidden md:inline">Video call</span>
        </Button>
        <StartAudioSpaceButton onStart={onStartAudio} label="Audio room" />
      </div>
    );
  }

  // the sidebar panel
  return (
    <div className="rounded-xl border border-border bg-background/60 p-3 space-y-3">
      <div>
        <p className="text-sm font-semibold text-foreground flex items-center gap-2">
          Team calls
          {(active || isInCall) && <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600"><LiveDot /> Live now</span>}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isInCall ? 'You are in the call.' : active ? (active.mode === 'audio_space' ? 'An audio room is open.' : 'A video call is in progress.') : 'Talk with everyone on this project.'}
        </p>
      </div>
      {isInCall ? (
        <Button onClick={onReturn} className="w-full h-10 rounded-lg gap-2 font-semibold"><Video className="h-4 w-4" /> Return to the call</Button>
      ) : active ? (
        <Button onClick={onJoin} className="w-full h-10 rounded-lg gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold">
          {active.mode === 'audio_space' ? <Mic className="h-4 w-4" /> : <Video className="h-4 w-4" />} {joinLabel}
        </Button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onStartVideo} disabled={isFan} title={isFan ? FAN_CALL_TOOLTIP : undefined} className="h-10 rounded-lg gap-2 font-medium"><Video className="h-4 w-4" /> Video</Button>
          <StartAudioSpaceButton onStart={onStartAudio} label="Audio" block />
        </div>
      )}
    </div>
  );
};
