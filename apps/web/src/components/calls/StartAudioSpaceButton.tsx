import { Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface Props {
  /** Starts the space (or joins the one already running). */
  onStart: (speakingMode: 'open' | 'request') => void;
  disabled?: boolean;
  className?: string;
}

/** "Start an audio space" with the host's choice of how people get on stage. */
export const StartAudioSpaceButton = ({ onStart, disabled, className }: Props) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        variant="ghost"
        size="icon"
        disabled={disabled}
        className={className || 'h-8 w-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10'}
        title="Start an audio space (listeners + speakers, no video)"
      >
        <Mic className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-64">
      <DropdownMenuLabel className="text-xs">Start an audio space — who can speak?</DropdownMenuLabel>
      <DropdownMenuItem onClick={() => onStart('request')} className="flex-col items-start gap-0.5">
        <span className="font-semibold">Raise hand</span>
        <span className="text-[11px] text-muted-foreground">Listeners request to speak; you approve them.</span>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => onStart('open')} className="flex-col items-start gap-0.5">
        <span className="font-semibold">Open mic</span>
        <span className="text-[11px] text-muted-foreground">Anyone can unmute and speak. You can switch any time.</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);
