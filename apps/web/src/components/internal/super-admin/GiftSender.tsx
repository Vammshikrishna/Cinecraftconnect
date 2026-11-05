import { useCallback, useEffect, useMemo, useState } from 'react';
import { Gift, Send, Users } from 'lucide-react';
import { ENTITLEMENT, ENTITLEMENT_LABEL, friendlyError } from '@cinecraft/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { confirmDialog } from '@/lib/confirmDialog';
import { cn } from '@/lib/utils';

interface PlanLite { code: string; name: string; audience: string }
interface Audience { total: number; sample: { name: string | null; username: string | null }[]; not_found: string[] }
interface Batch { batch_id: string; from_name: string; kind: string; label: string; days: number; sent: number; opened: number; accepted: number; created_at: string }

// a feature gift is one feature switched on, or one limit raised, for some days
const FEATURES: { key: string; kind: 'switch' | 'limit' }[] = [
  { key: ENTITLEMENT.POSTS_CREATE, kind: 'switch' },
  { key: ENTITLEMENT.DM_CREATORS, kind: 'switch' },
  { key: ENTITLEMENT.ANALYTICS_ADVANCED, kind: 'switch' },
  { key: ENTITLEMENT.VERIFIED_BADGE, kind: 'switch' },
  { key: ENTITLEMENT.PROMOTIONS_BUY, kind: 'switch' },
  { key: ENTITLEMENT.PROJECTS_MAX, kind: 'limit' },
  { key: ENTITLEMENT.ROOMS_PRIVATE_MAX, kind: 'limit' },
  { key: ENTITLEMENT.PORTFOLIO_ITEMS_MAX, kind: 'limit' },
  { key: ENTITLEMENT.JOBS_ACTIVE_MAX, kind: 'limit' },
];
const TYPES = [{ id: 'fan', label: 'Fans' }, { id: 'creator', label: 'Creators' }, { id: 'studio', label: 'Studios' }];

type Mode = 'people' | 'everyone' | 'group';

/**
 * Send a gift from the team (or from you) to specific people, to everyone, or to a group. It lands in their account like a
 * gift card: they open it and press Accept. During the beta the days start counting when billing goes live.
 */
export const GiftSender = ({ plans }: { plans: PlanLite[] }) => {
  const { toast } = useToast();
  const { profile } = useAuth();
  const personPlans = plans.filter((p) => p.audience === 'person');

  const [kind, setKind] = useState<'plan' | 'feature'>('plan');
  const [planCode, setPlanCode] = useState(personPlans.find((p) => p.code !== 'fan')?.code || personPlans[0]?.code || '');
  const [featureKey, setFeatureKey] = useState<string>(FEATURES[0].key);
  const [limitValue, setLimitValue] = useState('5');
  const [unlimited, setUnlimited] = useState(false);
  const [days, setDays] = useState(90);
  const [acceptDays, setAcceptDays] = useState(30);
  const [fromName, setFromName] = useState('The CineCraft team');
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<Mode>('people');
  const [usernames, setUsernames] = useState('');
  const [types, setTypes] = useState<string[]>(['creator']);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [joinedAfter, setJoinedAfter] = useState('');
  const [audience, setAudience] = useState<Audience | null>(null);
  const [busy, setBusy] = useState(false);
  const [batches, setBatches] = useState<Batch[]>([]);

  const feature = FEATURES.find((f) => f.key === featureKey)!;
  const nameList = useMemo(() => usernames.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean), [usernames]);

  const filter = useMemo(() => {
    if (mode === 'everyone') return { all: true };
    if (mode === 'group') {
      const f: Record<string, unknown> = {};
      if (types.length) f.account_types = types;
      if (verifiedOnly) f.verified = true;
      if (joinedAfter) f.joined_after = joinedAfter;
      return f;
    }
    return {};
  }, [mode, types, verifiedOnly, joinedAfter]);

  const loadBatches = useCallback(async () => {
    const { data } = await (supabase as any).rpc('staff_list_gift_batches');
    setBatches((data || []) as Batch[]);
  }, []);
  useEffect(() => { void loadBatches(); }, [loadBatches]);
  // whatever is picked changes who it goes to, so the old preview no longer applies
  useEffect(() => { setAudience(null); }, [mode, usernames, types, verifiedOnly, joinedAfter]);

  const preview = async () => {
    setBusy(true);
    const { data, error } = await (supabase as any).rpc('staff_gift_audience', { p_filter: filter, p_usernames: mode === 'people' ? nameList : null });
    setBusy(false);
    if (error) return toast({ title: 'Could not count the audience', description: friendlyError(error), variant: 'destructive' });
    setAudience(data as Audience);
  };

  const featureValue = feature.kind === 'switch' ? true : unlimited ? null : Number(limitValue);
  const valid = days >= 1 && acceptDays >= 1 && (kind === 'plan' ? !!planCode : feature.kind === 'switch' || unlimited || Number(limitValue) > 0);

  const send = async () => {
    if (!audience || audience.total === 0) return;
    const what = kind === 'plan' ? personPlans.find((p) => p.code === planCode)?.name : ENTITLEMENT_LABEL[featureKey];
    const ok = await confirmDialog(`Send "${what}" for ${days} days to ${audience.total} ${audience.total === 1 ? 'person' : 'people'}? They will each get a notification and can accept it.`);
    if (!ok) return;
    setBusy(true);
    const { data, error } = await (supabase as any).rpc('staff_send_gift', {
      p_kind: kind,
      p_plan_code: kind === 'plan' ? planCode : null,
      p_feature_key: kind === 'feature' ? featureKey : null,
      p_feature_value: kind === 'feature' ? featureValue : null,
      p_days: days,
      p_from_name: fromName,
      p_message: message,
      p_accept_within_days: acceptDays,
      p_filter: filter,
      p_usernames: mode === 'people' ? nameList : null,
    });
    setBusy(false);
    if (error) return toast({ title: 'Could not send', description: friendlyError(error), variant: 'destructive' });
    toast({ title: 'Gift sent', description: `${(data as any).sent} ${(data as any).sent === 1 ? 'person has' : 'people have'} a gift waiting.` });
    setAudience(null);
    setMessage('');
    void loadBatches();
  };

  return (
    <section aria-labelledby="gift-title" className="space-y-5">
      <header>
        <h2 id="gift-title" className="text-xl font-bold tracking-tight flex items-center gap-2"><Gift className="h-5 w-5 text-primary" /> Send a gift</h2>
        <p className="text-sm text-muted-foreground mt-1">It lands in their account like a gift card, with your message. They open it and press Accept. Nothing to type.</p>
      </header>

      <div className="rounded-2xl border border-border bg-card p-5 space-y-6">
        {/* what */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold mb-1">What is the gift?</legend>
          <div role="radiogroup" aria-label="Gift type" className="grid sm:grid-cols-2 gap-2">
            {([['plan', 'A plan', 'Everything in a plan, for some days'], ['feature', 'One feature', 'A feature or a higher limit, for some days']] as const).map(([id, t, d]) => (
              <button key={id} type="button" role="radio" aria-checked={kind === id} onClick={() => setKind(id)}
                className={cn('rounded-xl border p-3.5 text-left transition-colors', kind === id ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border hover:border-foreground/30')}>
                <span className="block text-sm font-semibold">{t}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">{d}</span>
              </button>
            ))}
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            {kind === 'plan' ? (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="gs-plan">Plan</Label>
                <select id="gs-plan" value={planCode} onChange={(e) => setPlanCode(e.target.value)} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm">
                  {personPlans.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
                </select>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="gs-feature">Feature</Label>
                  <select id="gs-feature" value={featureKey} onChange={(e) => setFeatureKey(e.target.value)} className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm">
                    {FEATURES.map((f) => <option key={f.key} value={f.key}>{ENTITLEMENT_LABEL[f.key]}</option>)}
                  </select>
                </div>
                {feature.kind === 'limit' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="gs-limit">Allow up to</Label>
                    <div className="flex items-center gap-2">
                      <Input id="gs-limit" type="number" min={1} value={limitValue} disabled={unlimited} onChange={(e) => setLimitValue(e.target.value)} className="h-10 rounded-xl" />
                      <label className="flex items-center gap-1.5 text-xs whitespace-nowrap"><input type="checkbox" checked={unlimited} onChange={(e) => setUnlimited(e.target.checked)} /> No limit</label>
                    </div>
                  </div>
                )}
              </>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="gs-days">For how many days</Label>
              <Input id="gs-days" type="number" min={1} max={730} value={days} onChange={(e) => setDays(Number(e.target.value))} className="h-10 rounded-xl" />
            </div>
          </div>
        </fieldset>

        {/* message */}
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="gs-from">From</Label>
            <Input id="gs-from" value={fromName} onChange={(e) => setFromName(e.target.value)} className="h-10 rounded-xl" />
            {profile?.full_name && fromName !== profile.full_name && (
              <button type="button" onClick={() => setFromName(profile.full_name as string)} className="text-xs text-primary hover:underline">Send as {profile.full_name}</button>
            )}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="gs-msg">Message (optional)</Label>
            <Textarea id="gs-msg" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={600} placeholder="Thank you for being here from the start." className="rounded-xl min-h-[72px]" />
          </div>
        </div>

        {/* who */}
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold mb-1 flex items-center gap-1.5"><Users className="h-4 w-4" /> Who gets it?</legend>
          <div role="tablist" aria-label="Audience" className="inline-flex rounded-xl bg-muted p-1">
            {([['people', 'Specific people'], ['group', 'A group'], ['everyone', 'Everyone']] as const).map(([id, label]) => (
              <button key={id} role="tab" aria-selected={mode === id} onClick={() => setMode(id)}
                className={cn('h-9 px-4 rounded-lg text-sm font-medium transition-colors', mode === id ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>{label}</button>
            ))}
          </div>
          {mode === 'people' && (
            <div className="space-y-1.5">
              <Label htmlFor="gs-users">Usernames</Label>
              <Textarea id="gs-users" value={usernames} onChange={(e) => setUsernames(e.target.value)} placeholder="One per line, or separated by commas" className="rounded-xl min-h-[80px] font-mono text-sm" />
            </div>
          )}
          {mode === 'group' && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {TYPES.map((t) => {
                  const on = types.includes(t.id);
                  return (
                    <button key={t.id} type="button" role="checkbox" aria-checked={on} onClick={() => setTypes(on ? types.filter((x) => x !== t.id) : [...types, t.id])}
                      className={cn('h-9 px-3.5 rounded-full text-sm border transition-colors', on ? 'border-primary bg-primary/10 text-foreground font-medium' : 'border-border text-muted-foreground hover:text-foreground')}>{t.label}</button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-end gap-4">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} /> Verified accounts only</label>
                <div className="space-y-1">
                  <Label htmlFor="gs-joined" className="text-xs">Joined on or after</Label>
                  <Input id="gs-joined" type="date" value={joinedAfter} onChange={(e) => setJoinedAfter(e.target.value)} className="h-9 rounded-lg w-44" />
                </div>
              </div>
            </div>
          )}
          {mode === 'everyone' && <p className="text-sm text-muted-foreground">Every account except staff and banned accounts.</p>}
        </fieldset>

        <div className="grid sm:grid-cols-3 gap-3 items-end">
          <div className="space-y-1.5">
            <Label htmlFor="gs-accept">Must be accepted within (days)</Label>
            <Input id="gs-accept" type="number" min={1} max={365} value={acceptDays} onChange={(e) => setAcceptDays(Number(e.target.value))} className="h-10 rounded-xl" />
          </div>
          <div className="sm:col-span-2 flex flex-wrap items-center justify-end gap-3">
            {audience && (
              <p className="text-sm" role="status">
                <span className="font-semibold">{audience.total}</span> {audience.total === 1 ? 'person' : 'people'}
                {audience.sample.length > 0 && <span className="text-muted-foreground">, for example {audience.sample.map((s) => s.name || s.username).filter(Boolean).slice(0, 3).join(', ')}</span>}
                {audience.not_found.length > 0 && <span className="block text-xs text-amber-600">Not found: {audience.not_found.join(', ')}</span>}
              </p>
            )}
            <Button variant="secondary" className="h-10 rounded-xl" onClick={preview} disabled={busy || !valid || (mode === 'people' && nameList.length === 0)}>Preview who gets it</Button>
            <Button className="h-10 rounded-xl gap-1.5 font-semibold" onClick={send} disabled={busy || !audience || audience.total === 0}><Send className="h-4 w-4" /> Send gift</Button>
          </div>
        </div>
      </div>

      {batches.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Recent gifts</h3>
          <ul className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
            {batches.map((b) => (
              <li key={b.batch_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{b.label} · {b.days} days <span className="text-muted-foreground font-normal">from {b.from_name}</span></p>
                  <p className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleDateString()}</p>
                </div>
                <p className="text-xs text-muted-foreground tabular-nums">{b.sent} sent · {b.opened} opened · <span className="text-foreground font-medium">{b.accepted} accepted</span></p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};

export default GiftSender;
