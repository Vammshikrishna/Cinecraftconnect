import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useAccountType } from '@/hooks/useAccountType';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { supabase } from '@/integrations/supabase/client';
import { NDAContractsModal } from './NDAContractsModal';
import { StoryListingModal } from './StoryListingModal';
import { 
    Sparkles, Shield, Award, Users, BookOpen, Clock, 
    Search, SlidersHorizontal, PlusCircle, Check, X, Lock, Eye
} from 'lucide-react';
import VerificationBadge from '@/components/common/VerificationBadge';
import { getSafeImageUrl } from '@/services/tmdb';

export default function StoryExchangeTab() {
    const { user, profile } = useAuth();
    const { toast } = useToast();
    const { push } = useAppNavigation();
    const { accountType: userAccountType } = useAccountType();

    const [listings, setListings] = useState<any[]>([]);
    const [myInterests, setMyInterests] = useState<any[]>([]);
    const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [searchQuery, setSearchQuery] = useState('');
    const [genreFilter, setGenreFilter] = useState('all');
    const [formatFilter, setFormatFilter] = useState('all');
    const [stageFilter, setStageFilter] = useState('all');

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [selectedListing, setSelectedListing] = useState<any | null>(null);
    const [showNDAModal, setShowNDAModal] = useState(false);

    const userCraft = (profile as any)?.craft || '';
    const isProducer = userAccountType === 'studio' || userAccountType === 'creator';
    const isWriter = userAccountType === 'creator' || userCraft.toLowerCase().includes('writer') || userCraft.toLowerCase().includes('director');

    useEffect(() => {
        fetchListings();
    }, [genreFilter, formatFilter, stageFilter, searchQuery]);

    useEffect(() => {
        if (!user) return;
        const channel = (supabase as any)
            .channel('story_exchange_rt')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'story_listings' },
                () => fetchListings()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'story_interests' },
                () => fetchListings()
            )
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id]);

    const fetchListings = async () => {
        setLoading(true);
        try {
            // Get public listings
            let query = (supabase as any).from('story_listings').select(`
                *,
                profiles:creator_id (
                    id, full_name, avatar_url, username, craft, location, is_verified
                )
            `);
            
            if (genreFilter !== 'all') query = query.eq('genre', genreFilter);
            if (formatFilter !== 'all') query = query.eq('format', formatFilter);
            if (stageFilter !== 'all') query = query.eq('stage', stageFilter);
            if (searchQuery.trim()) {
                query = query.or(`title.ilike.%${searchQuery}%,logline.ilike.%${searchQuery}%`);
            }

            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) {
                // Fallback to local storage
                let mockListings = JSON.parse(localStorage.getItem('story_listings') || '[]');
                if (genreFilter !== 'all') mockListings = mockListings.filter((l: any) => l.genre === genreFilter);
                if (formatFilter !== 'all') mockListings = mockListings.filter((l: any) => l.format === formatFilter);
                if (stageFilter !== 'all') mockListings = mockListings.filter((l: any) => l.stage === stageFilter);
                if (searchQuery.trim()) {
                    mockListings = mockListings.filter((l: any) => 
                        l.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        l.logline.toLowerCase().includes(searchQuery.toLowerCase())
                    );
                }
                setListings(mockListings);
            } else {
                setListings(data || []);
            }

            // Fetch my interests
            if (user) {
                const { data: interests } = await (supabase as any)
                    .from('story_interests')
                    .select('*')
                    .eq('interested_by', user.id);
                setMyInterests(interests || []);

                // Fetch incoming requests if I am the writer
                const { data: incoming } = await (supabase as any)
                    .from('story_interests')
                    .select('*, story:story_id(*), profiles:interested_by(full_name, avatar_url, craft, is_verified)')
                    .eq('story.creator_id', user.id);
                setIncomingRequests(incoming || []);
            }

        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleRequestAccess = (listing: any) => {
        setSelectedListing(listing);
        if (listing.nda_required) {
            setShowNDAModal(true);
        } else {
            submitInterest(listing.id, 'unsigned');
        }
    };

    const submitInterest = async (storyId: string, ndaSig: string) => {
        if (!user) return;
        try {
            const payload = {
                story_id: storyId,
                interested_by: user.id,
                status: 'pending',
                nda_signed_at: ndaSig !== 'unsigned' ? new Date().toISOString() : null,
            };

            const { error } = await (supabase as any).from('story_interests').insert(payload);

            if (error) {
                // Fallback local storage
                const localInterests = JSON.parse(localStorage.getItem('story_interests') || '[]');
                localInterests.push(payload);
                localStorage.setItem('story_interests', JSON.stringify(localInterests));
                setMyInterests(localInterests.filter((i: any) => i.interested_by === user.id));
                toast({ title: 'Interest Expressed', description: 'Request sent to the writer.' });
            } else {
                toast({ title: 'Request Sent', description: 'Your interest has been submitted.' });
                fetchListings();
            }
        } catch (e) {
            toast({ title: 'Error', variant: 'destructive', description: 'Failed to express interest.' });
        }
    };

    const handleApproveInterest = async (requestId: string) => {
        try {
            const { error } = await (supabase as any)
                .from('story_interests')
                .update({ status: 'approved' })
                .eq('id', requestId);

            if (error) {
                // local storage update
                const localIncoming = incomingRequests.map(r => r.id === requestId ? { ...r, status: 'approved' } : r);
                setIncomingRequests(localIncoming);
            } else {
                toast({ title: 'Approved!', description: 'Full concept synopsis is now visible to the producer.' });
                fetchListings();
            }
        } catch (e) {
            toast({ title: 'Error', variant: 'destructive', description: 'Failed to approve request.' });
        }
    };

    const handleDeclineInterest = async (requestId: string) => {
        try {
            const { error } = await (supabase as any)
                .from('story_interests')
                .update({ status: 'declined' })
                .eq('id', requestId);

            if (error) {
                const localIncoming = incomingRequests.filter(r => r.id !== requestId);
                setIncomingRequests(localIncoming);
            } else {
                toast({ title: 'Declined', description: 'Request declined.' });
                fetchListings();
            }
        } catch (e) {
            toast({ title: 'Error', variant: 'destructive', description: 'Failed to decline request.' });
        }
    };

    return (
        <div className="space-y-6">
            {/* Header info */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-card border border-border/60 rounded-2xl">
                <div>
                    <h2 className="text-xl font-black flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-amber-500" />
                        Story Exchange
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                        Browse premium original concepts, pilot outlines, and scripts listed directly by verified writers, or publish your own ideas to attract producers and investors.
                    </p>
                </div>
                {isWriter && (
                    <Button 
                        onClick={() => setIsCreateOpen(true)}
                        className="bg-primary hover:bg-primary/90 text-white font-bold rounded-xl"
                    >
                        <PlusCircle className="h-4 w-4 mr-2" /> List a Concept
                    </Button>
                )}
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap gap-3 bg-card/60 border border-border/40 p-4 rounded-xl items-center">
                <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search concepts or loglines..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-9 h-10"
                    />
                </div>
                <Select value={genreFilter} onValueChange={setGenreFilter}>
                    <SelectTrigger className="w-[130px] h-10"><SelectValue placeholder="Genre" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Any Genre</SelectItem>
                        {['Action', 'Thriller', 'Drama', 'Comedy', 'Horror', 'Romance', 'Sci-Fi', 'Fantasy'].map(g => (
                            <SelectItem key={g} value={g}>{g}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={formatFilter} onValueChange={setFormatFilter}>
                    <SelectTrigger className="w-[130px] h-10"><SelectValue placeholder="Format" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Any Format</SelectItem>
                        <SelectItem value="film">Feature Film</SelectItem>
                        <SelectItem value="series">Web Series</SelectItem>
                        <SelectItem value="short">Short Film</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={stageFilter} onValueChange={setStageFilter}>
                    <SelectTrigger className="w-[140px] h-10"><SelectValue placeholder="Stage" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Any Stage</SelectItem>
                        <SelectItem value="concept">Concept Only</SelectItem>
                        <SelectItem value="treatment">Treatment Ready</SelectItem>
                        <SelectItem value="pilot">Pilot Ready</SelectItem>
                        <SelectItem value="full_script">Full Script</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Main content grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Listings col */}
                <div className="md:col-span-2 space-y-4">
                    {loading ? (
                        <div className="text-center py-20 text-muted-foreground">
                            <BookOpen className="h-10 w-10 animate-bounce mx-auto mb-3" />
                            Loading Story Exchange...
                        </div>
                    ) : listings.length === 0 ? (
                        <div className="text-center py-20 bg-card border border-border/40 rounded-2xl text-muted-foreground">
                            <BookOpen className="h-16 w-16 mx-auto mb-4 opacity-20" />
                            <h3 className="font-bold text-lg">No Concepts Found</h3>
                            <p className="text-sm mt-1">Be the first to list an original concept in the exchange!</p>
                        </div>
                    ) : (
                        listings.map(l => {
                            const isOwner = user?.id === l.creator_id;
                            const interest = myInterests.find(i => i.story_id === l.id);
                            const accessApproved = interest?.status === 'approved';
                            const initials = (l.profiles?.full_name || 'W').split(' ').map((n: string) => n[0]).join('').toUpperCase();

                            return (
                                <Card key={l.id} className="p-5 border border-border hover:border-primary/20 transition-all space-y-4">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-10 w-10 shrink-0">
                                                <AvatarImage src={getSafeImageUrl(l.profiles?.avatar_url || null) || undefined} />
                                                <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">{initials}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <div className="flex items-center gap-1">
                                                    <p className="text-sm font-bold">{l.profiles?.full_name || 'Creator'}</p>
                                                    <VerificationBadge size="sm" />
                                                </div>
                                                <p className="text-xs text-muted-foreground">{l.profiles?.craft || 'Writer'}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-1.5 flex-wrap">
                                            <Badge variant="outline" className="text-[10px] capitalize">{l.format}</Badge>
                                            <Badge variant="secondary" className="text-[10px]">{l.genre}</Badge>
                                            {l.nda_required && (
                                                <Badge variant="destructive" className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1 flex items-center shrink-0">
                                                    <Shield className="h-2.5 w-2.5" /> NDA Required
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <h3 className="text-lg font-black text-foreground group-hover:text-primary transition-colors">{l.title}</h3>
                                        <p className="text-sm text-primary italic font-medium mt-1">"{l.logline}"</p>
                                    </div>

                                    <div className="text-xs leading-relaxed text-muted-foreground p-3.5 bg-muted/20 border border-border/40 rounded-xl">
                                        <p className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1">Teaser Synopsis</p>
                                        {l.synopsis_teaser}
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center justify-between gap-3 pt-3 border-t border-border/40">
                                        <div className="flex gap-3 text-xs text-muted-foreground font-semibold">
                                            <span>Stage: <span className="text-foreground capitalize">{l.stage.replace('_', ' ')}</span></span>
                                            <span>Deal: <span className="text-foreground capitalize">{l.asking_deal.replace('_', ' ')}</span></span>
                                        </div>
                                        {isOwner ? (
                                            <Badge className="bg-primary/10 text-primary border border-primary/20">Your Listing</Badge>
                                        ) : interest ? (
                                            accessApproved ? (
                                                <div className="space-y-2 w-full pt-2">
                                                    <div className="flex items-center gap-1.5 text-xs text-green-500 font-bold bg-green-500/5 p-2 rounded border border-green-500/10">
                                                        <Check className="h-4 w-4" /> Full Synopsis Unlocked
                                                    </div>
                                                    <div className="text-xs p-3 bg-primary/5 border border-primary/10 rounded-xl leading-relaxed text-foreground">
                                                        <p className="font-black text-[10px] uppercase tracking-widest text-primary mb-1">Full Confidential Synopsis</p>
                                                        {l.synopsis_full || 'No full synopsis provided.'}
                                                    </div>
                                                    <Button size="sm" className="w-full bg-secondary" onClick={() => push(`/dm/${l.creator_id}`)}>
                                                        Open Chat with Writer
                                                    </Button>
                                                </div>
                                            ) : interest.status === 'declined' ? (
                                                <Badge variant="outline" className="text-destructive border-destructive/20 bg-destructive/5">Access Declined</Badge>
                                            ) : (
                                                <Button disabled variant="outline" className="text-amber-500 border-amber-500/20 bg-amber-500/5">
                                                    <Clock className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Pending Approval
                                                </Button>
                                            )
                                        ) : (
                                            isProducer && (
                                                <Button size="sm" className="bg-primary hover:bg-primary/95 text-white font-bold" onClick={() => handleRequestAccess(l)}>
                                                    <Lock className="h-3.5 w-3.5 mr-1.5" /> Request Access
                                                </Button>
                                            )
                                        )}
                                    </div>
                                </Card>
                            );
                        })
                    )}
                </div>

                {/* Right panel: Interest Tracker (Writers) */}
                <div className="space-y-4">
                    <Card className="p-4 border border-border bg-card/60 backdrop-blur-sm space-y-4">
                        <h3 className="font-black text-sm flex items-center gap-1.5 border-b pb-2.5">
                            <Clock className="h-4 w-4 text-primary" /> Incoming Access Requests
                        </h3>
                        {incomingRequests.length === 0 ? (
                            <p className="text-xs text-muted-foreground text-center py-6">No pending access requests.</p>
                        ) : (
                            <div className="space-y-3">
                                {incomingRequests.map(r => (
                                    <div key={r.id} className="p-3 bg-muted/30 border border-border/40 rounded-xl space-y-2">
                                        <div className="flex items-center gap-2 justify-between">
                                            <p className="text-xs font-bold text-foreground truncate max-w-[120px]">{r.profiles?.full_name || 'Producer'}</p>
                                            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{r.status}</Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground line-clamp-1">Requested: <strong>{r.story?.title}</strong></p>
                                        {r.status === 'pending' && (
                                            <div className="flex gap-1.5 pt-1">
                                                <Button size="sm" className="h-7 text-[10px] bg-green-500 hover:bg-green-600 px-3 py-1 flex-1 font-bold text-white" onClick={() => handleApproveInterest(r.id)}>
                                                    <Check className="h-3 w-3 mr-1" /> Approve
                                                </Button>
                                                <Button size="sm" variant="ghost" className="h-7 text-[10px] text-destructive hover:bg-destructive/10 px-3 py-1 flex-1 font-bold" onClick={() => handleDeclineInterest(r.id)}>
                                                    <X className="h-3 w-3 mr-1" /> Decline
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </Card>
                </div>
            </div>

            {/* Modal instances */}
            {selectedListing && (
                <NDAContractsModal
                    isOpen={showNDAModal}
                    onClose={() => setShowNDAModal(false)}
                    writerName={selectedListing.profiles?.full_name || 'Writer'}
                    producerName={profile?.full_name || 'Producer'}
                    storyTitle={selectedListing.title}
                    onSign={(sig) => {
                        setShowNDAModal(false);
                        submitInterest(selectedListing.id, sig);
                    }}
                />
            )}

            <StoryListingModal 
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                onCreated={fetchListings}
            />
        </div>
    );
}
