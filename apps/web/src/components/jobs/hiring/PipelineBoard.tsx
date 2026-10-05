import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CalendarClock, MoreHorizontal, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PIPELINE_STAGES, type ApplicationStatus } from '@cinecraft/core';
import type { HiringApplicant } from '@/lib/jobs/hiringApi';
import { MatchBadge, StarRating } from './shared';

interface Props {
  applications: HiringApplicant[];
  onOpen: (a: HiringApplicant) => void;
  /** Move a candidate to another stage (rejecting asks for a reason first). */
  onMove: (a: HiringApplicant, status: ApplicationStatus) => void;
}

/**
 * Kanban board of the hiring pipeline. Drag a card to another column or use the "⋯" menu (works on touch screens and
 * with the keyboard). Same stages, colours and order as the mobile app.
 */
export const PipelineBoard = ({ applications, onOpen, onMove }: Props) => {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<ApplicationStatus | null>(null);

  return (
    <div className="flex gap-3 overflow-x-auto pb-3 snap-x">
      {PIPELINE_STAGES.map((stage) => {
        const items = applications.filter((a) => a.status === stage.key);
        return (
          <div
            key={stage.key}
            onDragOver={(e) => {
              e.preventDefault();
              if (overStage !== stage.key) setOverStage(stage.key);
            }}
            onDragLeave={() => setOverStage((s) => (s === stage.key ? null : s))}
            onDrop={(e) => {
              e.preventDefault();
              const a = applications.find((x) => x.id === dragId);
              setOverStage(null);
              setDragId(null);
              if (a && a.status !== stage.key) onMove(a, stage.key);
            }}
            className={cn(
              'shrink-0 w-[260px] snap-start rounded-2xl border bg-muted/20 flex flex-col max-h-[70vh] transition-colors',
              overStage === stage.key ? 'border-primary bg-primary/5' : 'border-border/60'
            )}
          >
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border/50">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
                <h4 className="text-[11px] font-black uppercase tracking-widest">{stage.label}</h4>
              </div>
              <span className="text-xs font-bold rounded-full px-2 py-0.5" style={{ color: stage.color, backgroundColor: stage.tint }}>{items.length}</span>
            </div>

            <div className="p-2 space-y-2 overflow-y-auto">
              {items.length === 0 && <p className="text-[11px] text-muted-foreground text-center py-6">Drop candidates here</p>}
              {items.map((a) => {
                const name = a.applicant?.full_name || a.applicant?.username || 'Applicant';
                const nextInterview = a.interviews.find((i) => (i.status === 'proposed' || i.status === 'confirmed') && new Date(i.scheduled_at) > new Date());
                return (
                  <div
                    key={a.id}
                    draggable
                    onDragStart={(e) => {
                      setDragId(a.id);
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', a.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOverStage(null);
                    }}
                    onClick={() => onOpen(a)}
                    className={cn(
                      'rounded-xl bg-card border border-border/60 p-3 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all',
                      dragId === a.id && 'opacity-40'
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <Avatar className="w-9 h-9">
                        <AvatarImage src={a.applicant?.avatar_url || ''} className="object-cover" />
                        <AvatarFallback className="bg-primary/15 text-primary font-black text-sm">{name[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold truncate leading-tight">{name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{a.applicant?.craft || a.applicant?.location || 'No details'}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button onClick={(e) => e.stopPropagation()} className="p-1 rounded-md hover:bg-muted text-muted-foreground" aria-label="Move candidate">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          {PIPELINE_STAGES.filter((s) => s.key !== a.status).map((s) => (
                            <DropdownMenuItem key={s.key} onClick={() => onMove(a, s.key)}>
                              <span className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: s.color }} /> Move to {s.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="flex items-center justify-between mt-2.5">
                      <MatchBadge match={a.match} compact />
                      <div className="flex items-center gap-1.5">
                        {a.is_shortlisted && <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />}
                        {a.rating ? <StarRating value={a.rating} readOnly size={11} /> : null}
                      </div>
                    </div>

                    {nextInterview && (
                      <p className="flex items-center gap-1 text-[10px] font-bold text-blue-500 mt-2">
                        <CalendarClock className="w-3 h-3" /> {new Date(nextInterview.scheduled_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                        {nextInterview.status === 'proposed' ? ' · awaiting' : ' · confirmed'}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1.5">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
