import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { CalendarCheck, Loader2, Check, X, MessageSquare, Star, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/common/PageHeader';
import { BackButton } from '@/components/common/BackButton';
import { OrdersTabs } from '@/components/marketplace/OrdersTabs';
import { LeaveReviewModal } from '@/components/marketplace/LeaveReviewModal';
import { cn } from '@/lib/utils';

const db = supabase as any;

type Status = 'pending' | 'confirmed' | 'cancelled' | 'completed';
interface Person { id: string; full_name: string | null; username: string | null; avatar_url: string | null }
interface Booking {
  id: string;
  listing_id: string;
  renter_id: string;
  owner_id: string;
  start_date: string;
  end_date: string;
  total_price: number;
  status: Status;
  message: string | null;
  created_at: string;
  listing: { id: string; title: string; images: string[] | null; is_bundle: boolean | null } | null;
  renter: Person | null;
  owner: Person | null;
  reviewed?: boolean;
}

const STATUS: Record<Status, { label: string; color: string; tint: string }> = {
  pending: { label: 'Pending', color: '#F59E0B', tint: 'rgba(245,158,11,0.14)' },
  confirmed: { label: 'Confirmed', color: '#10B981', tint: 'rgba(16,185,129,0.14)' },
  completed: { label: 'Completed', color: '#3B82F6', tint: 'rgba(59,130,246,0.14)' },
  cancelled: { label: 'Cancelled', color: '#EF4444', tint: 'rgba(239,68,68,0.14)' },
};

const range = (b: Booking) =>
  `${format(new Date(b.start_date), 'd MMM')}${b.end_date !== b.start_date ? ` – ${format(new Date(b.end_date), 'd MMM yyyy')}` : ` ${format(new Date(b.start_date), 'yyyy')}`}`;

const MyBookings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { push } = useAppNavigation();
  const [role, setRole] = useState<'renter' | 'owner'>('renter');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ booking: Booking; status: Status; title: string } | null>(null);
  const [reviewFor, setReviewFor] = useState<Booking | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data, error } = await db
      .from('marketplace_bookings')
      .select(`id, listing_id, renter_id, owner_id, start_date, end_date, total_price, status, message, created_at,
        listing:listing_id ( id, title, images, is_bundle ),
        renter:renter_id ( id, full_name, username, avatar_url ),
        owner:owner_id ( id, full_name, username, avatar_url )`)
      .is('parent_booking_id', null)
      .or(`renter_id.eq.${user.id},owner_id.eq.${user.id}`)
      .order('created_at', { ascending: false });
    if (error) console.error(error);
    const rows = (data || []) as Booking[];
    // which of my rentals already have a review
    const mine = rows.filter((r) => r.renter_id === user.id).map((r) => r.id);
    let reviewed = new Set<string>();
    if (mine.length) {
      const { data: revs } = await db.from('marketplace_reviews').select('booking_id').in('booking_id', mine);
      reviewed = new Set((revs || []).map((r: any) => r.booking_id));
    }
    setBookings(rows.map((r) => ({ ...r, reviewed: reviewed.has(r.id) })));
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    load();
    if (!user) return;
    const channel = supabase
      .channel(`my_bookings_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'marketplace_bookings' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, load]);

  const mine = useMemo(
    () => bookings.filter((b) => (role === 'renter' ? b.renter_id === user?.id : b.owner_id === user?.id)),
    [bookings, role, user?.id]
  );
  const pendingForMe = bookings.filter((b) => b.owner_id === user?.id && b.status === 'pending').length;

  const setStatus = async (b: Booking, status: Status) => {
    setBusyId(b.id);
    const { error } = await db.from('marketplace_bookings').update({ status }).eq('id', b.id);
    setBusyId(null);
    if (error) {
      toast({ title: 'Could not update the booking', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: status === 'confirmed' ? 'Booking confirmed' : status === 'completed' ? 'Marked as completed' : 'Booking cancelled' });
    load();
  };

  const started = (b: Booking) => new Date(b.start_date).getTime() <= Date.now();

  return (
    <div className="min-h-screen bg-background pt-16 md:pt-20 pb-28">
      <div className="max-w-4xl mx-auto px-4 md:px-8">
        <BackButton label="BACK TO MARKETPLACE" to="/marketplace" className="mb-6" />
        <PageHeader title="Orders" subtitle="Track the gear and locations you rent, and the requests on your listings." Icon={CalendarCheck} />
        <OrdersTabs current="bookings" />

        <Tabs value={role} onValueChange={(v) => setRole(v as any)} className="mt-6">
          <TabsList className="grid grid-cols-2 w-full sm:w-80 h-11 rounded-xl">
            <TabsTrigger value="renter" className="rounded-lg font-bold">Renting</TabsTrigger>
            <TabsTrigger value="owner" className="rounded-lg font-bold">
              Hosting{pendingForMe > 0 && <span className="ml-2 text-[10px] bg-amber-500 text-black rounded-full px-1.5 py-0.5 font-black">{pendingForMe}</span>}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : mine.length === 0 ? (
          <div className="text-center py-20 mt-6 rounded-[2rem] border border-dashed border-border/60 bg-card/30">
            <CalendarCheck className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-black mb-1">{role === 'renter' ? 'No rentals yet' : 'No requests yet'}</h3>
            <p className="text-muted-foreground text-sm mb-6">
              {role === 'renter' ? 'Find gear or a location and send a booking request.' : 'When someone requests your gear it will show up here.'}
            </p>
            <Button onClick={() => push('/marketplace')} className="rounded-xl font-bold">Browse marketplace</Button>
          </div>
        ) : (
          <div className="space-y-4 mt-6">
            {mine.map((b) => {
              const st = STATUS[b.status];
              const other = role === 'renter' ? b.owner : b.renter;
              const name = other?.full_name || other?.username || 'Member';
              const busy = busyId === b.id;
              return (
                <div key={b.id} className="rounded-[1.5rem] border border-border/60 bg-card/40 p-4 md:p-5 flex flex-col sm:flex-row gap-4">
                  <Link to={`/marketplace/${b.listing_id}`} className="w-full sm:w-28 h-28 shrink-0 rounded-2xl overflow-hidden bg-muted">
                    {b.listing?.images?.[0] ? <img src={b.listing.images[0]} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Package className="text-muted-foreground/40" /></div>}
                  </Link>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <Link to={`/marketplace/${b.listing_id}`} className="font-black text-lg leading-tight hover:text-primary truncate">{b.listing?.title || 'Listing removed'}</Link>
                      <span className="text-[10px] font-black uppercase tracking-widest rounded-full px-3 py-1 shrink-0" style={{ color: st.color, backgroundColor: st.tint }}>{st.label}</span>
                    </div>
                    <p className="text-sm font-bold">{range(b)} · <span className="text-primary">₹{Number(b.total_price).toLocaleString()}</span></p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Avatar className="h-6 w-6"><AvatarImage src={other?.avatar_url || ''} /><AvatarFallback>{name[0]}</AvatarFallback></Avatar>
                      <span>{role === 'renter' ? 'Owner' : 'Renter'}: <b className="text-foreground">{name}</b></span>
                      <span>· requested {formatDistanceToNow(new Date(b.created_at), { addSuffix: true })}</span>
                    </div>
                    {b.message && <p className="text-xs text-muted-foreground bg-muted/30 rounded-xl px-3 py-2">“{b.message}”</p>}

                    <div className="flex flex-wrap gap-2 pt-1">
                      {role === 'owner' && b.status === 'pending' && (
                        <>
                          <Button size="sm" className="rounded-full" disabled={busy} onClick={() => setStatus(b, 'confirmed')}><Check className="w-4 h-4 mr-1" /> Accept</Button>
                          <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => setConfirmAction({ booking: b, status: 'cancelled', title: 'Decline this request?' })}><X className="w-4 h-4 mr-1" /> Decline</Button>
                        </>
                      )}
                      {role === 'owner' && b.status === 'confirmed' && started(b) && (
                        <Button size="sm" className="rounded-full" disabled={busy} onClick={() => setStatus(b, 'completed')}><Check className="w-4 h-4 mr-1" /> Mark completed</Button>
                      )}
                      {((role === 'owner' && b.status === 'confirmed') || (role === 'renter' && (b.status === 'pending' || b.status === 'confirmed'))) && (
                        <Button size="sm" variant="ghost" className="rounded-full text-red-500 hover:bg-red-500/10" disabled={busy} onClick={() => setConfirmAction({ booking: b, status: 'cancelled', title: 'Cancel this booking?' })}>Cancel booking</Button>
                      )}
                      {role === 'renter' && (b.status === 'completed' || (b.status === 'confirmed' && started(b))) && !b.reviewed && (
                        <Button size="sm" variant="outline" className="rounded-full" onClick={() => setReviewFor(b)}><Star className="w-4 h-4 mr-1" /> Leave review</Button>
                      )}
                      {other && (
                        <Button size="sm" variant="ghost" className="rounded-full" onClick={() => push(`/messages/${other.id}`)}><MessageSquare className="w-4 h-4 mr-1" /> Message</Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AlertDialog open={!!confirmAction} onOpenChange={(o) => !o && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.title}</AlertDialogTitle>
            <AlertDialogDescription>The other person will be notified. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction className={cn('bg-red-600 hover:bg-red-700')} onClick={() => { if (confirmAction) setStatus(confirmAction.booking, confirmAction.status); setConfirmAction(null); }}>
              Yes, continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {reviewFor && (
        <LeaveReviewModal open onOpenChange={(o) => !o && setReviewFor(null)} listingId={reviewFor.listing_id} onSuccess={() => { setReviewFor(null); load(); }} />
      )}
    </div>
  );
};

export default MyBookings;
