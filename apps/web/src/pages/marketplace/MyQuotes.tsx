import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { FileText, Loader2, Check, X, MessageSquare, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/common/PageHeader';
import { BackButton } from '@/components/common/BackButton';
import { OrdersTabs } from '@/components/marketplace/OrdersTabs';

const db = supabase as any;
type QStatus = 'requested' | 'quoted' | 'accepted' | 'declined' | 'cancelled' | 'completed';

interface Quote {
  id: string;
  vendor_id: string;
  requester_id: string;
  start_date: string;
  end_date: string;
  location: string | null;
  brief: string;
  crew_size: number | null;
  budget: number | null;
  status: QStatus;
  quote_amount: number | null;
  quote_message: string | null;
  valid_until: string | null;
  created_at: string;
  vendor: { id: string; business_name: string; logo_url: string | null; owner_id: string } | null;
  requester: { id: string; full_name: string | null; username: string | null } | null;
  service: { title: string } | null;
}

const STATUS: Record<QStatus, { label: string; color: string; tint: string }> = {
  requested: { label: 'Waiting for quote', color: '#F59E0B', tint: 'rgba(245,158,11,0.14)' },
  quoted: { label: 'Quote received', color: '#3B82F6', tint: 'rgba(59,130,246,0.14)' },
  accepted: { label: 'Accepted', color: '#10B981', tint: 'rgba(16,185,129,0.14)' },
  completed: { label: 'Completed', color: '#8B5CF6', tint: 'rgba(139,92,246,0.14)' },
  declined: { label: 'Declined', color: '#EF4444', tint: 'rgba(239,68,68,0.14)' },
  cancelled: { label: 'Cancelled', color: '#64748B', tint: 'rgba(100,116,139,0.14)' },
};

const range = (q: Quote) => `${format(new Date(q.start_date), 'd MMM')}${q.end_date !== q.start_date ? ` – ${format(new Date(q.end_date), 'd MMM yyyy')}` : ` ${format(new Date(q.start_date), 'yyyy')}`}`;

const MyQuotes = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { push } = useAppNavigation();
  const [role, setRole] = useState<'requester' | 'vendor'>('requester');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [respondTo, setRespondTo] = useState<Quote | null>(null);
  const [form, setForm] = useState({ amount: '', message: '', days: '14' });

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error } = await db
      .from('vendor_quotes')
      .select(`id, vendor_id, requester_id, start_date, end_date, location, brief, crew_size, budget, status, quote_amount, quote_message, valid_until, created_at,
        vendor:vendor_id ( id, business_name, logo_url, owner_id ),
        requester:requester_id ( id, full_name, username ),
        service:service_id ( title )`)
      .order('created_at', { ascending: false });
    if (error) console.error(error);
    setQuotes((data || []) as Quote[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    load();
    if (!user) return;
    const channel = supabase
      .channel(`my_quotes_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vendor_quotes' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, load]);

  const mine = useMemo(
    () => quotes.filter((q) => (role === 'requester' ? q.requester_id === user?.id : q.vendor?.owner_id === user?.id)),
    [quotes, role, user?.id]
  );
  const waiting = quotes.filter((q) => q.vendor?.owner_id === user?.id && q.status === 'requested').length;

  const decide = async (q: Quote, action: 'accept' | 'decline' | 'cancel' | 'complete') => {
    setBusyId(q.id);
    const { data, error } = await db.rpc('decide_quote', { p_quote_id: q.id, p_action: action });
    setBusyId(null);
    if (error || data?.success === false) {
      toast({ title: 'Could not update the request', description: error?.message || data?.message, variant: 'destructive' });
      return;
    }
    load();
  };

  const sendQuote = async () => {
    if (!respondTo) return;
    const amount = Number(form.amount);
    if (!(amount > 0)) return toast({ title: 'Enter the quote amount', variant: 'destructive' });
    setBusyId(respondTo.id);
    const { data, error } = await db.rpc('respond_to_quote', { p_quote_id: respondTo.id, p_amount: amount, p_message: form.message.trim() || null, p_valid_days: Number(form.days) || 14 });
    setBusyId(null);
    if (error || data?.success === false) {
      toast({ title: 'Could not send the quote', description: error?.message || data?.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Quote sent' });
    setRespondTo(null);
    load();
  };

  return (
    <div className="min-h-screen bg-background pt-16 md:pt-20 pb-28">
      <div className="max-w-4xl mx-auto px-4 md:px-8">
        <BackButton label="BACK TO MARKETPLACE" to="/marketplace?tab=services" className="mb-6" />
        <PageHeader title="Orders" subtitle="Quote requests you sent to vendors, and requests clients sent to your business." Icon={FileText} />
        <OrdersTabs current="quotes" />

        <Tabs value={role} onValueChange={(v) => setRole(v as any)} className="mt-6">
          <TabsList className="grid grid-cols-2 w-full sm:w-96 h-11 rounded-xl">
            <TabsTrigger value="requester" className="rounded-lg font-bold">My requests</TabsTrigger>
            <TabsTrigger value="vendor" className="rounded-lg font-bold">
              Received{waiting > 0 && <span className="ml-2 text-[10px] bg-amber-500 text-black rounded-full px-1.5 py-0.5 font-black">{waiting}</span>}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : mine.length === 0 ? (
          <div className="text-center py-20 mt-6 rounded-[2rem] border border-dashed border-border/60 bg-card/30">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-black mb-1">{role === 'requester' ? 'No requests yet' : 'No requests received'}</h3>
            <p className="text-muted-foreground text-sm mb-6">{role === 'requester' ? 'Open a vendor and tap "Request a quote".' : 'Client requests for your vendor business show up here.'}</p>
            {role === 'requester' && <Button onClick={() => push('/marketplace?tab=services')} className="rounded-xl font-bold">Browse services</Button>}
          </div>
        ) : (
          <div className="space-y-4 mt-6">
            {mine.map((q) => {
              const st = STATUS[q.status];
              const busy = busyId === q.id;
              const other = role === 'requester' ? q.vendor?.business_name : q.requester?.full_name || q.requester?.username || 'Client';
              const expired = q.valid_until && new Date(q.valid_until) < new Date(new Date().toDateString());
              return (
                <div key={q.id} className="rounded-[1.5rem] border border-border/60 bg-card/40 p-4 md:p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link to={`/vendors/${q.vendor_id}`} className="font-black text-lg hover:text-primary truncate block">{q.vendor?.business_name}</Link>
                      <p className="text-xs text-muted-foreground">{role === 'vendor' ? `From ${other}` : q.service?.title || 'General request'} · {formatDistanceToNow(new Date(q.created_at), { addSuffix: true })}</p>
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest rounded-full px-3 py-1 shrink-0" style={{ color: st.color, backgroundColor: st.tint }}>{st.label}</span>
                  </div>

                  <p className="text-sm font-bold">{range(q)}{q.location ? ` · ${q.location}` : ''}{q.crew_size ? ` · crew ${q.crew_size}` : ''}{q.budget ? ` · budget ₹${Number(q.budget).toLocaleString()}` : ''}</p>
                  <p className="text-sm text-muted-foreground bg-muted/30 rounded-xl px-3 py-2 whitespace-pre-wrap">{q.brief}</p>

                  {q.quote_amount != null && (
                    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Quote</p>
                      <p className="text-2xl font-black text-primary">₹{Number(q.quote_amount).toLocaleString()}</p>
                      {q.quote_message && <p className="text-sm mt-1 whitespace-pre-wrap">{q.quote_message}</p>}
                      {q.valid_until && q.status === 'quoted' && (
                        <p className={`text-[11px] mt-2 font-bold ${expired ? 'text-red-500' : 'text-muted-foreground'}`}>
                          {expired ? 'Expired' : `Valid until ${format(new Date(q.valid_until), 'd MMM')}`}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {role === 'vendor' && (q.status === 'requested' || q.status === 'quoted') && (
                      <>
                        <Button size="sm" className="rounded-full" disabled={busy} onClick={() => { setRespondTo(q); setForm({ amount: q.quote_amount ? String(q.quote_amount) : '', message: q.quote_message || '', days: '14' }); }}>
                          {q.status === 'quoted' ? 'Update quote' : 'Send quote'}
                        </Button>
                        <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => decide(q, 'decline')}><X className="w-4 h-4 mr-1" /> Decline</Button>
                      </>
                    )}
                    {role === 'vendor' && q.status === 'accepted' && new Date(q.start_date) <= new Date() && (
                      <Button size="sm" className="rounded-full" disabled={busy} onClick={() => decide(q, 'complete')}><Check className="w-4 h-4 mr-1" /> Mark completed</Button>
                    )}
                    {role === 'requester' && q.status === 'quoted' && !expired && (
                      <>
                        <Button size="sm" className="rounded-full" disabled={busy} onClick={() => decide(q, 'accept')}><Check className="w-4 h-4 mr-1" /> Accept quote</Button>
                        <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => decide(q, 'decline')}><X className="w-4 h-4 mr-1" /> Decline</Button>
                      </>
                    )}
                    {role === 'requester' && ['requested', 'quoted', 'accepted'].includes(q.status) && (
                      <Button size="sm" variant="ghost" className="rounded-full text-red-500 hover:bg-red-500/10" disabled={busy} onClick={() => decide(q, 'cancel')}>Cancel request</Button>
                    )}
                    {role === 'requester' && (q.status === 'completed' || (q.status === 'accepted' && new Date(q.start_date) <= new Date())) && (
                      <Button size="sm" variant="outline" className="rounded-full" onClick={() => push(`/vendors/${q.vendor_id}`)}><Star className="w-4 h-4 mr-1" /> Review vendor</Button>
                    )}
                    <Button size="sm" variant="ghost" className="rounded-full" onClick={() => push(`/messages/${role === 'requester' ? q.vendor?.owner_id : q.requester_id}`)}><MessageSquare className="w-4 h-4 mr-1" /> Message</Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={!!respondTo} onOpenChange={(o) => !o && setRespondTo(null)}>
        <DialogContent className="sm:max-w-[440px] w-[95vw]">
          <DialogHeader>
            <DialogTitle>Send a quote</DialogTitle>
            <DialogDescription>{respondTo?.vendor?.business_name} · {respondTo ? range(respondTo) : ''}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Total price (₹) *</Label><Input type="number" min={1} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Valid for (days)</Label><Input type="number" min={1} max={60} value={form.days} onChange={(e) => setForm({ ...form, days: e.target.value })} /></div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">What is included</Label><Textarea className="min-h-[90px]" maxLength={1000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
            <Button className="w-full h-11 rounded-xl font-bold" onClick={sendQuote} disabled={busyId === respondTo?.id}>Send quote</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyQuotes;
