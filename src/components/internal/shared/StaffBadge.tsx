
import { ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface StaffBadgeProps {
  role?: string;
  showLabel?: boolean;
  className?: string;
}

export const StaffBadge = ({ role, showLabel = true, className = "" }: StaffBadgeProps) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="secondary" 
            className={`bg-orange-500/10 text-orange-600 border-orange-200/50 hover:bg-orange-500/20 transition-colors cursor-help gap-1 py-0.5 px-2 ${className}`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {showLabel && <span className="text-[10px] font-bold uppercase tracking-wider">Team</span>}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-orange-600 text-white border-none text-[11px] font-medium px-2 py-1">
          {role ? `CineCraft ${role.replace('_', ' ')}` : 'Official CineCraft Team Member'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
