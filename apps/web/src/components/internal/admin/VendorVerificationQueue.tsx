import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, ExternalLink, Loader2, X, Check } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const db = supabase as any;

interface Req {
  id: string;
  vendor_id: string;
  document_ref: string;
  registration_number: string | null;
  website: string | null;
  notes: string | null;
  created_at: string;
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

  const load = useCallback(async () => {
    const { data, error } = await db
      .from('vendor_verification_requests')
      .select(`id, vendor_id, document_ref, registration_number, website, notes, created_at,
        vendor:vendor_id ( business_name, location, email, phone ),
        owner:owner_id ( full_name, username )`)
      .eq('status', 'pending')
      .order('created_at');
    if (error) console.error(error);
    setRows((data || []) as Req[]);
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

  const decide = async (r: Req, approve: boolean) => {
    setBusyId(r.id);
    const { data, error } = await db.rpc('review_vendor_verification', { p_request_id: r.id, p_approve: approve, p_note: notes[r.id] || null });
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
                <p className="text-xs text-muted-foreground">Owner: {r.owner?.full_name || r.owner?.username} · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</p>
              </div>
              <Button size="sm" variant="outline" className="rounded-full shrink-0" onClick={() => openDoc(r.document_ref)}>
                <ExternalLink className="w-4 h-4 mr-1" /> Open document
              </Button>
            </div>
            {(r.registration_number || r.website || r.notes) && (
              <div className="text-sm space-y-1 bg-muted/30 rounded-xl p-3">
                {r.registration_number && <p>Registration: <b>{r.registration_number}</b></p>}
                {r.website && <p>Website: {r.website}</p>}
                {r.notes && <p className="text-muted-foreground">{r.notes}</p>}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <Input placeholder="Note for the vendor (shown if rejected)" value={notes[r.id] || ''} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
              <Button className="rounded-xl" disabled={busyId === r.id} onClick={() => decide(r, true)}><Check className="w-4 h-4 mr-1" /> Approve</Button>
              <Button variant="outline" className="rounded-xl text-red-500" disabled={busyId === r.id} onClick={() => decide(r, false)}><X className="w-4 h-4 mr-1" /> Reject</Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
};
