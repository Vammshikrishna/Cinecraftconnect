import { BadgeCheck } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface VerificationBadgeProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  xs: 'w-3 h-3',
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
};

const VerificationBadge = ({ size = 'md', className = '' }: VerificationBadgeProps) => {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center shrink-0 ${className}`}>
            <BadgeCheck className={`${SIZE_MAP[size]} text-primary fill-primary stroke-white`} strokeWidth={2.5} />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs font-bold">
          ✅ Verified CineCraft Creator
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default VerificationBadge;
