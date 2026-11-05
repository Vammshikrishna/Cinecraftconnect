import { Mic } from 'lucide-react';
import { useAccountType } from '@/hooks/useAccountType';
import { FAN_CALL_TOOLTIP } from '@/lib/calls/fanCallRule';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface Props {
  /** Starts the space (or joins the one already running). */
  onStart: (speakingMode: 'open' | 'request') => void;
  disabled?: boolean;
  className?: string;
  /** with a label the button reads "Audio room" instead of showing only a microphone */
  label?: string;
  /** a full-width, square-cornered button (for a panel) */
  block?: boolean;
}

/** "Start an audio space" with the host's choice of how people get on stage. */
export const StartAudioSpaceButton = ({ onStart, disabled, className, label, block }: Props) => {
  const { isFan } = useAccountType();
  if (isFan) {
    return (
      <Button variant={label ? 'outline' : 'ghost'} size={label ? undefined : 'icon'} disabled title={FAN_CALL_TOOLTIP} aria-label={FAN_CALL_TOOLTIP}
        className={className || (label ? (block ? 'h-10 rounded-lg gap-2 font-medium' : 'h-9 rounded-full gap-2 px-3.5 font-medium') : 'h-8 w-8 rounded-full')}>
        <Mic className="h-4 w-4" />
        {label && <span className={block ? '' : 'hidden md:inline'}>{label}</span>}
      </Button>
    );
  }
  return (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      {label ? (
        <Button
          variant="outline"
          disabled={disabled}
          className={className || (block ? 'h-10 rounded-lg gap-2 font-medium' : 'h-9 rounded-full gap-2 px-3.5 font-medium')}
          aria-label={`Start an audio room (listeners and speakers, no video)`}
        >
          <Mic className="h-4 w-4" />
          <span className={block ? '' : 'hidden md:inline'}>{label}</span>
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          className={className || 'h-8 w-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10'}
          title="Start an audio space (listeners + speakers, no video)"
          aria-label="Start an audio space"
        >
          <Mic className="h-4 w-4" />
        </Button>
      )}
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-64">
      <DropdownMenuLabel className="text-xs">Start an audio space — who can speak?</DropdownMenuLabel>
      <DropdownMenuItem onClick={() => onStart('request')} className="flex-col items-start gap-0.5">
        <span className="font-semibold">Raise hand</span>
        <span className="text-[12px] text-muted-foreground">Listeners request to speak; you approve them.</span>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onStart('open')} className="flex-col items-start gap-0.5">
        <span className="font-semibold">Open mic</span>
        <span className="text-[12px] text-muted-foreground">Anyone can unmute and speak. You can switch any time.</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
  );
};
