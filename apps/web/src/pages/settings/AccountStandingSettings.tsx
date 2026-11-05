import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { SettingsPageHeader, SettingsSection, SettingsLoading } from '@/components/settings/SettingsUI';
import { CheckCircle2, AlertTriangle, Ban, VolumeX } from 'lucide-react';
import { friendlyError } from '@cinecraft/core';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { suspensionHeadline } from '@/components/settings/settingsLogic';
import { Textarea } from '@/components/ui/textarea';

interface Standing {
  is_banned: boolean;
  ban: { reason: string; ban_type: string; expires_at: string | null; since: string } | null;
  muted_until: string | null;
  strikes: Array<{ reason: string; created_at: string; expires_at: string }>;
  notices?: Array<{ id: string; kind: 'content_removed' | 'warning' | 'suspension'; reason: string | null; item: string | null; created_at: string; reversed: boolean; appeal_status: 'pending' | 'upheld' | 'reversed' | null; can_appeal: boolean }>;
  appeal: { status: 'pending' | 'upheld' | 'reversed'; created_at: string; decision_note: string | null } | null;
  can_appeal: boolean;
}

const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

/** A person's own record with us: strikes and when they expire, any mute or suspension, and where their appeal stands. */
const AccountStandingSettings = () => {
  const [standing, setStanding] = useState<Standing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const { toast } = useToast();
  const [appealing, setAppealing] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    (supabase as any).rpc('get_my_account_standing').then(({ data, error: err }: any) => {
      if (err) { setError(friendlyError(err, 'We could not load your account standing.')); setLoaded(true); }
      else if (!data) { setError('We could not find your account standing record.'); setLoaded(true); }
      else { setError(null); setStanding({ ...data, strikes: data.strikes || [], notices: data.notices || [] } as Standing); setLoaded(true); }
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  const sendAppeal = async (id: string) => {
    setSending(true);
    const { error: err } = await (supabase as any).rpc('submit_notice_appeal', { p_notice: id, p_message: text });
    setSending(false);
    if (err) return toast({ title: 'Could not send your appeal', description: friendlyError(err), variant: 'destructive' });
    toast({ title: 'Appeal sent', description: 'A different member of our team will look at it.' });
    setAppealing(null);
    setText('');
    load();
  };

  const good = standing && !standing.is_banned && !standing.muted_until && standing.strikes.length === 0 && !(standing.notices || []).length;

  return (
    <>
      <SettingsPageHeader
        title="Account standing"
        description="Any warnings, restrictions or suspensions on your account, and what happens next."
      />
      {error ? (
        <div role="alert" className="space-y-3">
          <p className="text-sm text-destructive break-words">{error}</p>
          <Button size="sm" variant="outline" onClick={() => { setError(null); setLoaded(false); load(); }}>Try again</Button>
        </div>
      ) : !standing ? (
        <SettingsLoading />
      ) : (
        <div className="space-y-6">
          {good && (
            <div className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Your account is in good standing</p>
                <p className="text-sm text-muted-foreground">No warnings, restrictions or suspensions.</p>
              </div>
            </div>
          )}

          {standing.is_banned && (
            <SettingsSection title="Suspension">
              <div className="flex items-start gap-3 p-4">
                <Ban className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="font-semibold">
                    {suspensionHeadline(standing.ban?.ban_type, standing.ban?.expires_at, when)}
                  </p>
                  {standing.ban?.reason && <p className="text-sm text-muted-foreground">{standing.ban.reason}</p>}
                  {standing.ban?.since && <p className="text-xs text-muted-foreground">Since {when(standing.ban.since)}</p>}
                </div>
              </div>
            </SettingsSection>
          )}

          {standing.muted_until && (
            <SettingsSection title="Messaging restriction">
              <div className="flex items-start gap-3 p-4">
                <VolumeX className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-sm">You cannot send messages until {when(standing.muted_until)}.</p>
              </div>
            </SettingsSection>
          )}

          {standing.strikes.length > 0 && (
            <SettingsSection
              title={`Warnings (${standing.strikes.length} active)`}
              description="Three active warnings mean a one-week messaging restriction. Each warning expires after 180 days."
            >
              {standing.strikes.map((s, i) => (
                <div key={i} className="flex items-start gap-3 p-4">
                  <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm">{s.reason}</p>
                    <p className="text-xs text-muted-foreground">Given {when(s.created_at)} · expires {when(s.expires_at)}</p>
                  </div>
                </div>
              ))}
            </SettingsSection>
          )}

          {(standing.notices || []).length > 0 && (
            <SettingsSection title="What we did, and why" description="Each decision, the rule it was about, and the item.">
              {(standing.notices || []).map((n, i) => (
                <div key={i} className="p-4 space-y-1">
                  <p className="text-sm font-semibold break-words">
                    {n.kind === 'content_removed' ? 'Something you posted was removed' : n.kind === 'warning' ? 'You received a warning' : 'Your account was suspended'}
                    {n.reason ? `: ${n.reason}` : ''}
                  </p>
                  {n.item && <p className="text-xs text-muted-foreground border-l-2 border-border pl-3 italic break-words">{n.item}</p>}
                  <p className="text-xs text-muted-foreground">{when(n.created_at)}</p>
                  {n.reversed && <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Reversed after your appeal. It no longer counts against you.</p>}
                  {!n.reversed && n.appeal_status === 'pending' && <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Your appeal is waiting for a decision.</p>}
                  {!n.reversed && n.appeal_status === 'upheld' && <p className="text-xs text-muted-foreground">Your appeal was reviewed and the decision stands.</p>}
                  {n.can_appeal && appealing !== n.id && (
                    <Button size="sm" variant="outline" className="mt-1 h-8 rounded-lg" onClick={() => { setAppealing(n.id); setText(''); }}>Appeal this decision</Button>
                  )}
                  {appealing === n.id && (
                    <div className="mt-2 space-y-2">
                      <Textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="Tell us why this decision should change" className="rounded-xl min-h-[90px] animate-in fade-in duration-200" maxLength={2000} aria-label="Why this decision should change" aria-describedby="appeal-hint" />
                      <p id="appeal-hint" className="text-xs text-muted-foreground">{text.trim().length < 20 ? `${text.trim().length} / 20 characters minimum` : 'Ready to send'}</p>
                      <div className="flex gap-2">
                        <Button size="sm" className="h-9 min-w-[7rem] rounded-lg" disabled={sending || text.trim().length < 20} onClick={() => sendAppeal(n.id)}>{sending ? 'Sending…' : 'Send appeal'}</Button>
                        <Button size="sm" variant="ghost" className="h-9 rounded-lg" onClick={() => setAppealing(null)}>Cancel</Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </SettingsSection>
          )}

          {standing.appeal && (
            <SettingsSection title="Your appeal">
              <div className="p-4 space-y-1">
                <p className="text-sm font-semibold">
                  {standing.appeal.status === 'pending' ? 'Waiting for a decision'
                    : standing.appeal.status === 'reversed' ? 'Accepted: your access was restored'
                    : 'Reviewed: the decision stands'}
                </p>
                <p className="text-xs text-muted-foreground">Sent {when(standing.appeal.created_at)}</p>
                {standing.appeal.decision_note && <p className="text-sm text-muted-foreground">{standing.appeal.decision_note}</p>}
              </div>
            </SettingsSection>
          )}

          <p className="text-xs text-muted-foreground">
            Read the <Link to="/community-guidelines" className="underline">community guidelines</Link> and our <Link to="/transparency" className="underline">transparency reports</Link>. If something here looks wrong, you can contact support from{' '}
            <Link to="/settings/help" className="underline">Help</Link>.
          </p>
        </div>
      )}
    </>
  );
};

export default AccountStandingSettings;
