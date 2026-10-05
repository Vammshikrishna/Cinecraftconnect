import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Eye, Heart, Loader2, Package, Pause, Play, Store, Wallet, CalendarCheck, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/common/PageHeader';
import { BackButton } from '@/components/common/BackButton';
import { VendorVerificationDialog } from '@/components/vendors/VendorVerificationDialog';

const db = supabase as any;

interface ListingStat {
  id: string; title: string; image: string | null; price_per_day: number; is_active: boolean; is_bundle: boolean; admin_flagged: boolean;
  views: number; saves: number; pending: number; confirmed: number; completed: number; revenue: number;
}
interface VendorStat {
  id: string; business_name: string; logo_url: string | null; is_verified: boolean;
  requested: number; quoted: number; accepted: number; completed: number; won_value: number; verification_status: string | null;
}

const Tile = ({ icon: Icon, label, value }: { icon: any; label: string; value: string | number }) => (
  <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
    <div className="flex items-center gap-2 text-muted-foreground text-[10px] font-black uppercase tracking-widest"><Icon size={14} /> {label}</div>
    <p className="text-2xl font-black mt-1">{value}</p>
  </div>
);

/** One place for sellers: how their listings and vendor businesses are doing, and what needs attention. */
const SellerHub = () => {
  const { toast } = useToast();
  const { push } = useAppNavigation();
  const [listings, setListings] = useState<ListingStat[]>([]);
  const [vendors, setVendors] = useState<VendorStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyFor, setVerifyFor] = useState<VendorStat | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await db.rpc('seller_hub_stats');
    if (error) console.error(error);
    setListings(data?.listings || []);
    setVendors(data?.vendors || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(
    () => ({
      views: listings.reduce((n, l) => n + l.views, 0),
      saves: listings.reduce((n, l) => n + l.saves, 0),
      pending: listings.reduce((n, l) => n + l.pending, 0),
      revenue: listings.reduce((n, l) => n + Number(l.revenue), 0),
      openQuotes: vendors.reduce((n, v) => n + v.requested, 0),
    }),
    [listings, vendors]
  );

  const toggleActive = async (l: ListingStat) => {
    setListings((prev) => prev.map((x) => (x.id === l.id ? { ...x, is_active: !x.is_active } : x)));
    const { error } = await db.from('marketplace_listings').update({ is_active: !l.is_active }).eq('id', l.id);
    if (error) {
      toast({ title: 'Could not update the listing', description: error.message, variant: 'destructive' });
      load();
    }
  };

  return (
    <div className="min-h-screen bg-background pt-16 md:pt-20 pb-28">
      <div className="max-w-5xl mx-auto px-4 md:px-8">
        <BackButton label="BACK TO MARKETPLACE" to="/marketplace" className="mb-6" />
        <PageHeader
          title="Seller Hub"
          subtitle="How your listings and vendor businesses are doing."
          Icon={Store}
          actions={
            <div className="flex gap-2">
              <Button variant="outline" className="rounded-xl font-bold" onClick={() => push('/marketplace/bookings')}><CalendarCheck className="w-4 h-4 mr-2" /> Bookings{totals.pending > 0 ? ` (${totals.pending})` : ''}</Button>
              <Button variant="outline" className="rounded-xl font-bold" onClick={() => push('/marketplace/quotes')}><FileText className="w-4 h-4 mr-2" /> Quotes{totals.openQuotes > 0 ? ` (${totals.openQuotes})` : ''}</Button>
            </div>
          }
        />

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Tile icon={Eye} label="Views" value={totals.views} />
              <Tile icon={Heart} label="Saves" value={totals.saves} />
              <Tile icon={CalendarCheck} label="Pending requests" value={totals.pending} />
              <Tile icon={Wallet} label="Booked value" value={`₹${totals.revenue.toLocaleString()}`} />
            </div>

            <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground mt-10 mb-3">Your listings ({listings.length})</h2>
            {listings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                You have not listed anything yet. <Link to="/marketplace" className="text-primary font-bold">Create a listing</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {listings.map((l) => (
                  <div key={l.id} className="rounded-2xl border border-border/60 bg-card/40 p-3 flex gap-4 items-center">
                    <Link to={`/marketplace/${l.id}`} className="w-20 h-20 rounded-xl overflow-hidden bg-muted shrink-0">
                      {l.image ? <img src={l.image} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Package className="text-muted-foreground/40" /></div>}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link to={`/marketplace/${l.id}`} className="font-black truncate hover:text-primary">{l.title}</Link>
                        {!l.is_active && <span className="text-[10px] font-black uppercase bg-muted rounded-full px-2 py-0.5">Paused</span>}
                        {l.admin_flagged && <span className="text-[10px] font-black uppercase bg-red-500/15 text-red-500 rounded-full px-2 py-0.5">Under review</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">₹{Number(l.price_per_day).toLocaleString()}/day{l.is_bundle ? ' · bundle' : ''}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-2 font-semibold">
                        <span className="flex items-center gap-1"><Eye size={12} /> {l.views}</span>
                        <span className="flex items-center gap-1"><Heart size={12} /> {l.saves}</span>
                        <span className={l.pending ? 'text-amber-500' : 'text-muted-foreground'}>{l.pending} pending</span>
                        <span className="text-emerald-500">{l.confirmed} confirmed</span>
                        <span className="text-muted-foreground">{l.completed} done</span>
                        <span className="text-primary">₹{Number(l.revenue).toLocaleString()}</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="rounded-full shrink-0" onClick={() => toggleActive(l)}>
                      {l.is_active ? <><Pause className="w-4 h-4 mr-1" /> Pause</> : <><Play className="w-4 h-4 mr-1" /> Resume</>}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground mt-10 mb-3">Your vendor businesses ({vendors.length})</h2>
            {vendors.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
                No vendor business yet. <Link to="/marketplace?tab=services" className="text-primary font-bold">Register one</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {vendors.map((v) => (
                  <div key={v.id} className="rounded-2xl border border-border/60 bg-card/40 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-muted shrink-0">{v.logo_url && <img src={v.logo_url} alt="" className="w-full h-full object-cover" />}</div>
                      <div className="min-w-0">
                        <Link to={`/vendors/${v.id}`} className="font-black truncate hover:text-primary flex items-center gap-1.5">{v.business_name}{v.is_verified && <BadgeCheck className="w-4 h-4 text-primary" />}</Link>
                        <p className="text-xs text-muted-foreground">
                          {v.requested} new · {v.quoted} quoted · {v.accepted} accepted · {v.completed} done · won ₹{Number(v.won_value).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {!v.is_verified && (
                      v.verification_status === 'pending' ? (
                        <span className="text-xs font-bold text-amber-500">Verification under review</span>
                      ) : (
                        <Button variant="outline" size="sm" className="rounded-full" onClick={() => setVerifyFor(v)}>
                          <BadgeCheck className="w-4 h-4 mr-1" /> {v.verification_status === 'rejected' ? 'Resubmit for verification' : 'Get verified'}
                        </Button>
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {verifyFor && (
        <VendorVerificationDialog open onOpenChange={(o) => !o && setVerifyFor(null)} vendorId={verifyFor.id} vendorName={verifyFor.business_name} onSubmitted={load} />
      )}
    </div>
  );
};

export default SellerHub;
