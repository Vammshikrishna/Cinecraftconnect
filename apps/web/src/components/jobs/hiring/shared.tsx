import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStage, matchColor, type MatchResult } from '@cinecraft/core';

export const StarRating = ({
  value, onChange, size = 18, readOnly = false,
}: { value: number | null; onChange?: (v: number | null) => void; size?: number; readOnly?: boolean }) => (
  <div className="inline-flex items-center gap-0.5" role="radiogroup" aria-label="Rating">
    {[1, 2, 3, 4, 5].map((n) => {
      const filled = (value || 0) >= n;
      return (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          onClick={(e) => {
            e.stopPropagation();
            // tapping the current rating again clears it
            onChange?.(value === n ? null : n);
          }}
          className={cn('p-0.5 transition-transform', !readOnly && 'hover:scale-110 cursor-pointer', readOnly && 'cursor-default')}
        >
          <Star style={{ width: size, height: size }} className={filled ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'} />
        </button>
      );
    })}
  </div>
);

export const MatchBadge = ({ match, compact = false }: { match: MatchResult; compact?: boolean }) => (
  <span
    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider border"
    style={{ color: matchColor(match.score), borderColor: `${matchColor(match.score)}55`, backgroundColor: `${matchColor(match.score)}18` }}
    title={match.reasons.join('\n') || 'No matching signals yet'}
  >
    {match.score}%{!compact && <span className="hidden sm:inline">· {match.label}</span>}
  </span>
);

export const StageBadge = ({ status }: { status?: string | null }) => {
  const stage = getStage(status);
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest"
      style={{ color: stage.color, backgroundColor: stage.tint }}
    >
      {stage.label}
    </span>
  );
};
