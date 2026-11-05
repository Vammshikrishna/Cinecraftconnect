import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';

// ready-made wording, fetched once (admins edit it in the Moderation tab)
let templateCache: Array<{ title: string; body: string }> | null = null;

export const MIN_REASON_LENGTH = 5;

interface ReasonDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  destructive?: boolean;
  /** Ask how long, for a temporary action. The list is shown as a choice; 0 means permanent / no end. */
  durations?: Array<{ label: string; days: number }>;
  /** Names the choice row above for screen readers when it is not a duration (for example the person an escalation goes to). */
  choiceLabel?: string;
  /** Hide the saved moderation reasons (Explicit content, Fraud or scam, ...): they only make sense for reports and enforcement. */
  hideSavedReasons?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string, days: number) => void | Promise<void>;
}

/** Staff actions always carry a written reason, which is kept in the audit trail and shown to the second approver. */
const ReasonDialog = ({ open, title, description, confirmLabel, destructive, durations, choiceLabel, hideSavedReasons, onCancel, onConfirm }: ReasonDialogProps) => {
  const [reason, setReason] = useState('');
  const [days, setDays] = useState(durations?.[0]?.days ?? 0);
  const [busy, setBusy] = useState(false);
  const [templates, setTemplates] = useState<Array<{ title: string; body: string }>>(templateCache || []);

  useEffect(() => {
    if (open) {
      setReason('');
      setDays(durations?.[0]?.days ?? 0);
      setBusy(false);
    }
  }, [open, durations]);

  useEffect(() => {
    if (!open) return;
    (supabase as any).from('mod_templates').select('title, body').eq('kind', 'reason').order('title')
      .then(({ data }: any) => { if (data) { templateCache = data; setTemplates(data); } });
  }, [open]);

  const valid = reason.trim().length >= MIN_REASON_LENGTH;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o && !busy) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {durations && durations.length > 0 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label={choiceLabel || 'How long'}>
            {durations.map((d) => (
              <button
                key={d.label}
                type="button"
                aria-pressed={days === d.days}
                onClick={() => setDays(d.days)}
                className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-colors ${days === d.days ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:text-foreground'}`}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}

        {!hideSavedReasons && templates.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Saved reasons</p>
            <div className="flex flex-wrap gap-1.5">
              {templates.map((t) => (
                <button
                  key={t.title}
                  type="button"
                  onClick={() => setReason((cur) => (cur.trim() ? `${cur.trim()} ${t.body}`.slice(0, 500) : t.body))}
                  className="text-[12px] font-bold px-2.5 py-1 rounded-full border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                >
                  {t.title}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="gov-reason" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Reason (required)</label>
          <Textarea
            id="gov-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={3}
            placeholder="What happened, and why this action?"
          />
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={!valid || busy}
            onClick={async () => {
              setBusy(true);
              try { await onConfirm(reason.trim(), days); } finally { setBusy(false); }
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReasonDialog;
