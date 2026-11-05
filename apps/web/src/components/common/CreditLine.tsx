import React from 'react';
import { cn } from '@/lib/utils';

interface CreditLineProps {
  /** left side: what the credit is about (a project title, or a role) */
  lead: React.ReactNode;
  /** right side: who or what it credits (a role, or a person's name) */
  trail: React.ReactNode;
  /** small line under the row, for who confirmed it and when */
  note?: React.ReactNode;
  /** render the left side in the serif display face (titles) instead of the muted body face (roles) */
  serifLead?: boolean;
  className?: string;
}

/**
 * One line of a film-credits list: lead, a dotted leader, then trail.
 * Used for filmographies and crew lists, where the structure (who did what) is the content.
 */
export const CreditLine = ({ lead, trail, note, serifLead = false, className }: CreditLineProps) => (
  <div className={cn('py-3.5', className)}>
    <div className="flex items-baseline gap-3 min-w-0">
      <span className={cn('min-w-0 truncate', serifLead ? 'font-serif text-lg font-semibold text-foreground' : 'text-sm text-muted-foreground')}>
        {lead}
      </span>
      <span aria-hidden="true" className="flex-1 min-w-[1.5rem] border-b border-dotted border-border -translate-y-1" />
      <span className={cn('shrink-0 max-w-[55%] truncate text-right', serifLead ? 'text-sm text-muted-foreground' : 'font-serif text-base font-semibold text-foreground')}>
        {trail}
      </span>
    </div>
    {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
  </div>
);

export default CreditLine;
