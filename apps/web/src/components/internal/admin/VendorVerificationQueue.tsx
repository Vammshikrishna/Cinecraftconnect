import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, ExternalLink, Loader2, X, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { formatMoney } from '@cinecraft/core';
import ReasonDialog from '@/components/internal/shared/ReasonDialog';

const db = supabase as any;

interface Payment {
  request_id: string;
  amount_minor: number;
  tax_minor: number;
  currency: string;
  paid_at: string | null;
  order_status: string;
  refunded_minor: number;
  submissions_left: number | null;
  payment_problem?: boolean;
  override_reason?: string | null;
}

interface Req {
  id: string;
  vendor_id: string;
  document_ref: string;
  registration_number: string | null;
  website: string | null;
  notes: string | null;
  created_at: string;
  order_id: string | null;
  vendor: { business_name: string; location: string | null; email: string | null; phone: string | null } | null;
  owner: { full_name: string | null; username: string | null } | null;
}

/** Admin queue for vendor business verification. Approving is the only thing that sets the verified badge. */
export const VendorVerificationQueue = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [pay, setPay] = useState<Record<string, Payment>>({});
  const [overrideText, setOverrideText] = useState<Record<string, string>>({});
  const [rejecting, setRejecting] = useState<Req | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await db
      .from('vendor_verification_requests')
      .select(`id, vendor_id, document_ref, registration_number, website, notes, created_at, order_id,
        vendor:vendor_id ( business_name, location, email, phone ),
        owner:owner_id ( full_name, username )`)
      .eq('status', 'pending')
      .order('created_at');
    if (error) console.error(error);
    const list = (data || []) as Req[];
    setRows(list);
    // what each request was paid with (there is a payment only once billing is live)
    const ids = list.filter((x) => x.order_id).map((x) => x.id);
    if (ids.length) {
      const { data: p } = await db.rpc('staff_verification_payments', { p_request_ids: ids });
      setPay(Object.fromEntries(((p || []) as Payment[]).map((x) => [x.request_id, x])));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openDoc = async (ref: string) => {
    const path = ref.replace(/^vendor_docs:/, '');
    const { data, error } = await supabase.storage.from('vendor_docs').createSignedUrl(path, 300);
    if (error || !data?.signedUrl) return toast({ title: 'Could not open the document', variant: 'destructive' });
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  // an approval is blocked (by the database too) while the payment was refunded or disputed and nobody has recorded why it may go ahead
  const blocked = (r: Req) => !!pay[r.id]?.payment_problem && !pay[r.id]?.override_reason;

  const override = async (r: Req) => {
    const { error } = await db.rpc('staff_override_verification_payment', { p_request_id: r.id, p_reason: overrideText[r.id] || '' });
    if (error) return toast({ title: 'Could not record the override', description: error.message, variant: 'destructive' });
    toast({ title: 'Override recorded' });
    load();
  };

  const decide = async (r: Req, approve: boolean, reason?: string) => {
    setBusyId(r.id);
    const note = reason?.trim() || notes[r.id] || null;
    const { data, error } = await db.rpc('review_vendor_verification', { p_request_id: r.id, p_approve: approve, p_note: note });
    setBusyId(null);
    if (error || data?.success === false) {
      toast({ title: 'Could not save the decision', description: error?.message || data?.message, variant: 'destructive' });
      return;
    }
    toast({ title: approve ? 'Business verified' : 'Request rejected' });
    load();
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><BadgeCheck className="w-4 h-4" /> Vendor verification ({rows.length})</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border/60 p-8 text-center">No vendors are waiting for review.</p>
      ) : (
        rows.map((r) => (
          <div key={r.id} className="rounded-2xl border border-border/60 bg-card/40 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-black">{r.vendor?.business_name}</p>
                <p className="text-xs text-muted-foreground">
                  {[r.vendor?.location, r.vendor?.email, r.vendor?.phone].filter(Boolean).join(' · ')}
                </p>
                <p className="text-xs text-muted-foreground">Owner: {r.owner?.full_name || r.owner?.username} · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })} · <span className={r.order_id ? 'font-semibold text-emerald-600' : ''}>{r.order_id ? 'Paid review' : 'No payment (beta)'}</span></p>
              </div>
              <Button size="sm" variant="outline" className="rounded-full shrink-0" onClick={() => openDoc(r.document_ref)}>
                <ExternalLink className="w-4 h-4 mr-1" /> Open document
              </Button>
            </div>
            {(() => {
              const p = pay[r.id];
              if (!r.order_id) {
                return <p className="text-xs rounded-lg bg-muted/50 px-3 py-2 text-muted-foreground">No payment: submitted while verification is free (beta).</p>;
              }
              if (!p) return null;
              if (p.payment_problem) {
                return (
                  <div className="space-y-2">
                    <p className="text-xs rounded-lg bg-destructive/10 text-destructive px-3 py-2 font-medium">
                      Payment problem: this review was {p.order_status === 'disputed' ? 'disputed' : 'refunded'}. It cannot be approved until you record why it may go ahead. You can still reject it.
                    </p>
                    {p.override_reason ? (
                      <p className="text-xs rounded-lg bg-amber-500/10 text-amber-700 px-3 py-2">Override recorded: {p.override_reason}</p>
                    ) : (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Input placeholder="Why may this go ahead anyway? (at least 10 characters)" value={overrideText[r.id] || ''} onChange={(e) => setOverrideText({ ...overrideText, [r.id]: e.target.value })} />
                        <Button variant="outline" className="rounded-xl" disabled={(overrideText[r.id] || '').trim().length < 10} onClick={() => override(r)}>Record override</Button>
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <p className="text-xs rounded-lg bg-emerald-500/10 text-emerald-700 px-3 py-2">
                  Paid {formatMoney(p.amount_minor + p.tax_minor, p.currency)}
                  {p.paid_at ? ` on ${new Date(p.paid_at).toLocaleDateString()}` : ''}
                  {typeof p.submissions_left === 'number' ? `, ${p.submissions_left} ${p.submissions_left === 1 ? 'resubmission' : 'resubmissions'} left` : ''}.
                </p>
              );
            })()}
            {(r.registration_number || r.website || r.notes) && (
              <div className="text-sm space-y-1 bg-muted/30 rounded-xl p-3">
                {r.registration_number && <p>Registration: <b>{r.registration_number}</b></p>}
                {r.website && <p>Website: {r.website}</p>}
                {r.notes && <p className="text-muted-foreground">{r.notes}</p>}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <Input placeholder="Note for the vendor (shown if rejected)" value={notes[r.id] || ''} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
              <Button className="rounded-xl" disabled={busyId === r.id || blocked(r)} onClick={() => decide(r, true)}><Check className="w-4 h-4 mr-1" /> Approve</Button>
              <Button variant="outline" className="rounded-xl text-red-500" disabled={busyId === r.id} onClick={() => setRejecting(r)}><X className="w-4 h-4 mr-1" /> Reject</Button>
            </div>
          </div>
        ))
      )}
      <ReasonDialog
        open={!!rejecting}
        title="Reject this vendor verification?"
        description={rejecting ? `${rejecting.vendor?.business_name || 'This business'} is told why. The reason is kept in the audit log.` : undefined}
        confirmLabel="Reject request"
        destructive
        onCancel={() => setRejecting(null)}
        onConfirm={(reason) => { const r = rejecting; setRejecting(null); if (r) decide(r, false, reason); }}
      />
    </div>
  );
};
