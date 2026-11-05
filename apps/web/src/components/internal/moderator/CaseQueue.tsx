import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Flag, User, MessageSquare, 
  Briefcase, ShoppingBag, ChevronRight,
  CheckCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { applyBundle, useBundles } from './CaseAssist';
import { safeUsername } from '../shared/staffHelpers';
import ReasonDialog from '../shared/ReasonDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { GovernanceService } from '@/services/governance/GovernanceService';
import { useAuth } from '@/contexts/AuthContext';
import { claimInfo, dueText, isOpenStatus, slaState } from './caseTools';

interface Case {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  status: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
  due_at?: string | null;
  group_count?: number;
  /** everyone who reported the same thing */
  reporters?: string[];
  assigned_to?: string | null;
  claimed_at?: string | null;
  last_activity_at?: string | null;
  owner?: { username: string } | null;
  escalated_to?: string | null;
  /** null for reports found automatically (no reporter) or whose reporter was deleted */
  reporter?: { username: string; avatar_url: string | null; trust_score?: number | null } | null;
  details: string;
}

interface CaseQueueProps {
  cases: Case[];
  onSelectCase: (caseId: string) => void;
  selectedCaseId?: string | null;
  /** called after a bulk action so the list refreshes */
  onChanged?: () => void;
}

const TARGET_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  post:    { icon: MessageSquare, color: 'text-blue-500',   bg: 'bg-blue-500/10'    },
  comment: { icon: MessageSquare, color: 'text-sky-500',    bg: 'bg-sky-500/10'     },
  user:    { icon: User,          color: 'text-purple-500', bg: 'bg-purple-500/10'  },
  job:     { icon: Briefcase,     color: 'text-emerald-500',bg: 'bg-emerald-500/10' },
  listing: { icon: ShoppingBag,   color: 'text-orange-500', bg: 'bg-orange-500/10'  },
};

const PRIORITY_STYLES = {
  low:    'bg-muted text-muted-foreground border-border/50',
  medium: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  high:   'bg-amber-500/10 text-amber-500 border-amber-500/20',
  urgent: 'bg-red-500/10 text-red-500 border-red-500/20 animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_3] motion-reduce:animate-none',
};

/** How long until a report's response target, or how late it is. */
const DUE_CLASS = {
  overdue: 'bg-red-500/10 text-red-500 border-red-500/20',
  soon: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  ok: 'bg-muted text-muted-foreground border-border/50',
  none: '',
} as const;
const dueInfo = (due?: string | null) => {
  const text = dueText(due);
  return text ? { text, cls: DUE_CLASS[slaState(due)] } : null;
};

const CaseQueue: React.FC<CaseQueueProps> = ({ cases, onSelectCase, selectedCaseId, onChanged }) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const bundles = useBundles();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [bulk, setBulk] = useState<'dismiss' | 'claim' | null>(null);

  // bulk dismiss / take: one at a time so a case held by someone else is skipped and counted, not forced
  const runBulk = async (kind: 'dismiss' | 'claim', reason?: string) => {
    setBulk(null);
    setBusy(true);
    const ids = Array.from(picked);
    let ok = 0;
    let firstError = '';
    for (const id of ids) {
      try {
        if (kind === 'dismiss') await GovernanceService.resolveReport(id, 'dismiss', reason);
        else await GovernanceService.claimReport(id);
        ok += 1;
      } catch (e: any) {
        if (!firstError) firstError = e?.message || '';
      }
    }
    setBusy(false);
    toast({
      title: `${kind === 'dismiss' ? 'Dismissed' : 'Assigned to you'}: ${ok} of ${ids.length}`,
      description: ok < ids.length ? `${ids.length - ok} skipped. ${firstError}`.trim() : undefined,
      variant: ok === ids.length ? undefined : 'destructive',
    });
    setPicked(new Set());
    onChanged?.();
  };

  const toggle = (id: string) => setPicked((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  // the same quick action for every ticked case, one after another (a second person is still needed to take things down)
  const applyToPicked = async (b: Awaited<ReturnType<typeof useBundles>>[number]) => {
    setBusy(true);
    let ok = 0;
    for (const id of Array.from(picked)) {
      if (await applyBundle(id, b, () => {})) ok += 1;
    }
    setBusy(false);
    toast({ title: `${b.name}: ${ok} of ${picked.size} done`, variant: ok === picked.size ? undefined : 'destructive' });
    setPicked(new Set());
    onChanged?.();
  };

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-foreground uppercase tracking-tight">Active Cases</h2>
            <Badge variant="outline" className="rounded-lg text-[12px] font-black uppercase tracking-widest px-2 py-0.5">
              {cases.length} Total
            </Badge>
          </div>
          
        </div>

        {picked.size > 0 && (
          <div className="sticky top-0 z-10 mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-background/95 backdrop-blur px-4 py-3 shadow-sm">
            <span className="text-xs font-black uppercase tracking-wider">{picked.size} selected</span>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setBulk('claim')} className="h-8 text-xs font-bold">Assign to me</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => setBulk('dismiss')} className="h-8 text-xs font-bold">Dismiss selected</Button>
            {bundles.map((b) => (
              <Button key={b.id} size="sm" variant="outline" disabled={busy} onClick={() => applyToPicked(b)} className="h-8 text-xs font-bold">{b.name}</Button>
            ))}
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setPicked(new Set())} className="h-8 text-xs">Clear</Button>
          </div>
        )}

        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {cases.map((item, index) => {
              const config = TARGET_CONFIG[item.target_type] || { icon: Flag, color: 'text-muted-foreground', bg: 'bg-muted' };
              const isSelected = selectedCaseId === item.id;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ delay: Math.min(index, 6) * 0.03 }}
                  onClick={() => onSelectCase(item.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectCase(item.id); }
                  }}
                  className={`group relative glass-card p-4 flex items-center gap-5 cursor-pointer transition-colors duration-200 ${
                    isSelected ? 'ring-2 ring-primary border-primary/50 bg-primary/5' : 'hover:bg-muted/50 border-border/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    aria-label="Select this case"
                    checked={picked.has(item.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggle(item.id)}
                    className="h-4 w-4 shrink-0 accent-primary"
                  />
                  <div className={`w-12 h-12 ${config.bg} rounded-2xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-300`}>
                    <config.icon className={`w-6 h-6 ${config.color}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[12px] px-2 py-0.5 rounded-full font-black border uppercase tracking-widest ${PRIORITY_STYLES[item.priority]}`}>
                        {item.priority}
                      </span>
                      {(item.group_count || 1) > 1 && (
                        <span className="text-[12px] px-2 py-0.5 rounded-full font-black border border-rose-500/20 bg-rose-500/10 text-rose-500 uppercase tracking-widest">
                          {item.group_count} reports
                        </span>
                      )}
                      {(() => {
                        const due = isOpenStatus(item.status) ? dueInfo(item.due_at) : null;
                        return due ? (
                          <span className={`text-[12px] px-2 py-0.5 rounded-full font-black border uppercase tracking-widest ${due.cls}`}>{due.text}</span>
                        ) : null;
                      })()}
                      {(() => {
                        const c = claimInfo(item as any, user?.id);
                        if (!c.held || !isOpenStatus(item.status)) return null;
                        const who = c.mine ? 'You' : `@${item.owner?.username || 'someone'}`;
                        return (
                          <span
                            className={`text-[12px] px-2 py-0.5 rounded-full font-black border tracking-wide ${c.mine ? 'border-primary/30 bg-primary/10 text-primary' : c.idle ? 'border-border/50 bg-muted text-muted-foreground' : 'border-violet-500/30 bg-violet-500/10 text-violet-600'}`}
                            title={c.idle ? 'No activity for a while: anyone can take this case' : `Frees up after ${c.freesInMinutes} more minutes without activity`}
                          >
                            {c.idle ? `${who} (idle)` : `Held by ${who}`}
                          </span>
                        );
                      })()}
                      {item.escalated_to && (
                        <span className="text-[12px] px-2 py-0.5 rounded-full font-black border border-red-500/20 bg-red-500/10 text-red-500 uppercase tracking-widest">
                          To {item.escalated_to.replace('_', ' ')}
                        </span>
                      )}
                      <span className="text-[12px] font-mono text-muted-foreground">#{item.id.slice(0, 8)}</span>
                      <span className="text-[12px] font-bold text-foreground/50 uppercase tracking-widest">•</span>
                      <span className="text-[12px] font-bold text-muted-foreground uppercase tracking-widest">{new Date(item.created_at).toLocaleDateString()}</span>
                    </div>
                    
                    <h3 className="text-sm font-bold text-foreground line-clamp-1 mb-0.5">
                      {(item.reason || '').replace(/_/g, ' ').toUpperCase()}
                    </h3>
                    
                    <div className="flex items-center gap-3 text-[12px] text-muted-foreground font-medium">
                      <span className="flex items-center gap-1.5">
                        <User className="w-3 h-3" /> {item.reporter ? `@${safeUsername(item.reporter)}` : 'Found automatically'}
                        {typeof item.reporter?.trust_score === 'number' && (
                          <Badge variant="outline" className={`h-5 px-1 text-xs font-black border-none ${
                            item.reporter!.trust_score! > 80 ? 'bg-green-500/10 text-green-500' :
                            item.reporter!.trust_score! < 40 ? 'bg-red-500/10 text-red-500' :
                            'bg-amber-500/10 text-amber-500'
                          }`}>
                            TRUST: {item.reporter!.trust_score}
                          </Badge>
                        )}
                      </span>
                      {(item.group_count || 1) > 1 && (
                        <span title={(item.reporters || []).map((r) => `@${r}`).join(', ')}>+{(item.group_count || 1) - 1} more reporter{(item.group_count || 1) - 1 === 1 ? '' : 's'}</span>
                      )}
                      <span>•</span>
                      <span className="capitalize">{item.target_type} Report</span>
                      {item.priority === 'urgent' && (
                        <>
                          <span>•</span>
                          <span className="text-red-500 font-black uppercase tracking-tighter">Urgent</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">

                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                      isSelected ? 'bg-primary text-white' : 'bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary'
                    }`}>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {cases.length === 0 && (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-muted/50 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-border/50">
                <CheckCircle className="w-8 h-8 text-muted-foreground/30" />
              </div>
              <h3 className="text-sm font-bold text-foreground uppercase tracking-tight">Queue Clear</h3>
              <p className="text-[12px] text-muted-foreground font-medium mt-1">No pending cases in this queue.</p>
            </div>
          )}
        </div>
      </div>

      <ReasonDialog
        open={bulk === 'dismiss'}
        title={`Dismiss ${picked.size} case${picked.size === 1 ? '' : 's'}?`}
        description="No violation found. The reports are closed and the people who reported are told. Cases held by another moderator are skipped."
        confirmLabel="Dismiss all"
        onCancel={() => setBulk(null)}
        onConfirm={(reason) => runBulk('dismiss', reason)}
      />
      <AlertDialog open={bulk === 'claim'} onOpenChange={(o) => { if (!o) setBulk(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Take {picked.size} case{picked.size === 1 ? '' : 's'}?</AlertDialogTitle>
            <AlertDialogDescription>They are assigned to you. Cases held by another moderator who is still active are skipped.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => runBulk('claim')}>Assign to me</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CaseQueue;
