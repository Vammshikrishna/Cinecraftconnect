import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, Network, Plus, ShieldAlert, Trash2, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { confirmDialog } from '@/lib/confirmDialog';
import { friendlyError } from '@cinecraft/core';
import { cn } from '@/lib/utils';

interface RiskRow {
  user_id: string;
  full_name: string | null;
  username: string | null;
  ip_risk_score: number;
  is_vpn_detected: boolean;
  is_proxy_detected: boolean;
  device_count: number;
  ip_count: number;
  linked_accounts: number;
  is_banned: boolean;
}
interface Linked { user_id: string; full_name: string | null; username: string | null; shared_devices: number; shared_ips: number; is_banned: boolean }
interface FraudNetwork { id: string; name: string; description: string | null; risk_level: 'low' | 'medium' | 'high' | 'critical'; associated_user_ids: string[]; associated_ips: string[] }

const LEVEL_STYLE: Record<string, string> = {
  low: 'border-border text-muted-foreground',
  medium: 'border-amber-500/40 text-amber-600 bg-amber-500/10',
  high: 'border-orange-500/40 text-orange-600 bg-orange-500/10',
  critical: 'border-destructive/40 text-destructive bg-destructive/10',
};
const nameOf = (r: { full_name: string | null; username: string | null }) => r.full_name || r.username || 'Unknown';
const SCORES = [{ label: 'All', v: 0 }, { label: '40 and up', v: 40 }, { label: '70 and up', v: 70 }];

/**
 * Who might be the same person, and who is working together. Risk profiles come from the devices and addresses we have seen
 * for each account; a fraud network is a group an admin has decided belongs together.
 */
export const RiskAndNetworks = ({ onOpenUser }: { onOpenUser: (userId: string) => void }) => {
  const { toast } = useToast();
  const [min, setMin] = useState(40);
  const [rows, setRows] = useState<RiskRow[]>([]);
  const [networks, setNetworks] = useState<FraudNetwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const [linked, setLinked] = useState<Record<string, Linked[]>>({});
  const [editing, setEditing] = useState<Partial<FraudNetwork> | null>(null);
  const [usersText, setUsersText] = useState('');
  const [ipsText, setIpsText] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [risk, nets] = await Promise.all([
      (supabase as any).rpc('staff_list_risk_profiles', { p_min_score: min }),
      (supabase as any).rpc('staff_list_fraud_networks'),
    ]);
    if (risk.error) toast({ title: 'Could not load risk profiles', description: friendlyError(risk.error), variant: 'destructive' });
    if (nets.error) toast({ title: 'Could not load networks', description: friendlyError(nets.error), variant: 'destructive' });
    setRows((risk.data || []) as RiskRow[]);
    setNetworks((nets.data || []) as FraudNetwork[]);
    setLoading(false);
  }, [min, toast]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const toggle = async (userId: string) => {
    if (open === userId) return setOpen(null);
    setOpen(userId);
    if (!linked[userId]) {
      const { data, error } = await (supabase as any).rpc('staff_linked_accounts', { p_user: userId });
      if (error) toast({ title: 'Could not load linked accounts', description: friendlyError(error), variant: 'destructive' });
      setLinked((prev) => ({ ...prev, [userId]: (data || []) as Linked[] }));
    }
  };

  const startNetwork = (n?: FraudNetwork, fromUsers?: string[]) => {
    setEditing(n || { name: '', description: '', risk_level: 'high' });
    setUsersText((n?.associated_user_ids || fromUsers || []).join('\n'));
    setIpsText((n?.associated_ips || []).join('\n'));
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    const split = (t: string) => t.split(/[\s,]+/).map((x) => x.trim()).filter(Boolean);
    const { error } = await (supabase as any).rpc('staff_save_fraud_network', {
      p_id: editing.id || null,
      p_name: editing.name || '',
      p_description: editing.description || null,
      p_risk_level: editing.risk_level || 'high',
      p_users: split(usersText),
      p_ips: split(ipsText),
    });
    setSaving(false);
    if (error) return toast({ title: 'Could not save', description: friendlyError(error), variant: 'destructive' });
    toast({ title: 'Network saved' });
    setEditing(null);
    load();
  };

  const remove = async (n: FraudNetwork) => {
    if (!(await confirmDialog(`Remove the network "${n.name}"? The accounts are not changed.`))) return;
    const { error } = await (supabase as any).rpc('staff_delete_fraud_network', { p_id: n.id });
    if (error) return toast({ title: 'Could not remove', description: friendlyError(error), variant: 'destructive' });
    load();
  };

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>;

  return (
    <div className="space-y-10">
      <section aria-labelledby="risk-title" className="space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="risk-title" className="text-xl font-bold tracking-tight flex items-center gap-2"><ShieldAlert className="h-5 w-5 text-primary" /> Risk profiles</h2>
            <p className="text-sm text-muted-foreground mt-1">Accounts ranked by risk. Open one to see who shares its devices or addresses.</p>
          </div>
          <div role="tablist" aria-label="Minimum risk score" className="flex gap-1.5">
            {SCORES.map((s) => (
              <button key={s.v} role="tab" aria-selected={min === s.v} onClick={() => setMin(s.v)}
                className={cn('h-9 px-3.5 rounded-full text-sm font-medium border transition-colors', min === s.v ? 'bg-foreground text-background border-foreground' : 'bg-card text-muted-foreground border-border hover:text-foreground')}>
                {s.label}
              </button>
            ))}
          </div>
        </header>

        {rows.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">No accounts at this risk level.</div>
        ) : (
          <ul className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
            {rows.map((r) => (
              <li key={r.user_id}>
                <button type="button" onClick={() => toggle(r.user_id)} aria-expanded={open === r.user_id}
                  className="w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-muted/40 transition-colors">
                  <span className={cn('h-10 w-10 rounded-full grid place-items-center text-sm font-bold shrink-0 tabular-nums', r.ip_risk_score >= 70 ? 'bg-destructive/10 text-destructive' : r.ip_risk_score >= 40 ? 'bg-amber-500/15 text-amber-600' : 'bg-muted text-muted-foreground')}>
                    {r.ip_risk_score}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium truncate">{nameOf(r)} {r.username && <span className="text-muted-foreground font-normal">@{r.username}</span>}</span>
                    <span className="block text-xs text-muted-foreground">{r.device_count} devices · {r.ip_count} addresses{r.is_vpn_detected ? ' · VPN' : ''}{r.is_proxy_detected ? ' · proxy' : ''}</span>
                  </span>
                  {r.is_banned && <Badge variant="outline" className="rounded-full border-destructive/40 text-destructive">Banned</Badge>}
                  {r.linked_accounts > 0 && <Badge variant="outline" className="rounded-full gap-1"><Users className="h-3 w-3" /> {r.linked_accounts} linked</Badge>}
                  <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', open === r.user_id && 'rotate-180')} />
                </button>
                {open === r.user_id && (
                  <div className="px-4 pb-4 bg-muted/20">
                    <div className="flex flex-wrap gap-2 py-3">
                      <Button size="sm" variant="outline" className="h-9 rounded-lg" onClick={() => onOpenUser(r.user_id)}>Open account record</Button>
                      {(linked[r.user_id] || []).length > 0 && (
                        <Button size="sm" variant="outline" className="h-9 rounded-lg gap-1.5" onClick={() => startNetwork(undefined, [r.user_id, ...(linked[r.user_id] || []).map((l) => l.user_id)])}>
                          <Network className="h-4 w-4" /> Save as a network
                        </Button>
                      )}
                    </div>
                    {(linked[r.user_id] || []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">No other account shares a device or address with this one.</p>
                    ) : (
                      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                        {(linked[r.user_id] || []).map((l) => (
                          <li key={l.user_id} className="flex items-center gap-3 px-3.5 py-2.5">
                            <span className="min-w-0 flex-1 text-sm truncate">{nameOf(l)}{l.username && <span className="text-muted-foreground"> @{l.username}</span>}</span>
                            <span className="text-xs text-muted-foreground">{l.shared_devices} shared devices · {l.shared_ips} shared addresses</span>
                            {l.is_banned && <Badge variant="outline" className="rounded-full border-destructive/40 text-destructive">Banned</Badge>}
                            <Button size="sm" variant="ghost" className="h-8 rounded-lg" onClick={() => onOpenUser(l.user_id)}>Open</Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="net-title" className="space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="net-title" className="text-xl font-bold tracking-tight flex items-center gap-2"><Network className="h-5 w-5 text-primary" /> Fraud networks</h2>
            <p className="text-sm text-muted-foreground mt-1">Groups of accounts and addresses that work together.</p>
          </div>
          <Button className="h-10 rounded-xl gap-1.5 font-semibold" onClick={() => startNetwork()}><Plus className="h-4 w-4" /> New network</Button>
        </header>

        {networks.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card py-12 text-center text-sm text-muted-foreground">No networks yet. Save one from a risk profile that has linked accounts.</div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {networks.map((n) => (
              <li key={n.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{n.name}</p>
                    {n.description && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{n.description}</p>}
                  </div>
                  <Badge variant="outline" className={cn('rounded-full capitalize', LEVEL_STYLE[n.risk_level])}>{n.risk_level}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-3">{n.associated_user_ids.length} accounts · {n.associated_ips.length} addresses</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {n.associated_user_ids.slice(0, 4).map((u) => (
                    <button key={u} type="button" onClick={() => onOpenUser(u)} className="text-xs font-mono rounded-md bg-muted px-2 py-1 hover:bg-muted/70">{u.slice(0, 8)}</button>
                  ))}
                  {n.associated_user_ids.length > 4 && <span className="text-xs text-muted-foreground self-center">+{n.associated_user_ids.length - 4} more</span>}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" variant="secondary" className="h-9 rounded-lg" onClick={() => startNetwork(n)}>Edit</Button>
                  <Button size="sm" variant="ghost" className="h-9 rounded-lg text-destructive hover:bg-destructive/10 gap-1.5" onClick={() => remove(n)}><Trash2 className="h-4 w-4" /> Remove</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? 'Edit network' : 'New network'}</DialogTitle>
            <DialogDescription>Group the accounts and addresses that belong together. Nothing happens to the accounts themselves.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-1.5"><Label htmlFor="fn-name">Name</Label><Input id="fn-name" value={editing?.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="h-11 rounded-xl" /></div>
            <div className="space-y-1.5"><Label htmlFor="fn-desc">What is known</Label><Textarea id="fn-desc" value={editing?.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="rounded-xl min-h-[80px]" /></div>
            <div className="space-y-1.5">
              <Label htmlFor="fn-level">Risk level</Label>
              <select id="fn-level" value={editing?.risk_level || 'high'} onChange={(e) => setEditing({ ...editing, risk_level: e.target.value as FraudNetwork['risk_level'] })} className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm capitalize">
                {['low', 'medium', 'high', 'critical'].map((l) => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="fn-users">Account ids (one per line)</Label><Textarea id="fn-users" value={usersText} onChange={(e) => setUsersText(e.target.value)} className="rounded-xl min-h-[90px] font-mono text-xs" /></div>
            <div className="space-y-1.5"><Label htmlFor="fn-ips">Addresses (one per line)</Label><Textarea id="fn-ips" value={ipsText} onChange={(e) => setIpsText(e.target.value)} className="rounded-xl min-h-[70px] font-mono text-xs" /></div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !(editing?.name || '').trim()} className="rounded-xl font-semibold">{saving ? 'Saving' : 'Save network'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RiskAndNetworks;
