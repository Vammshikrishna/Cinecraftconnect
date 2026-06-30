import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { PitchCallCard } from '@/components/pitch/PitchCallCard';
import { PitchCallCreationModal } from '@/components/pitch/PitchCallCreationModal';
import { CallCreatorPitchInbox, WriterPitchTracker } from '@/components/pitch/PitchDashboard';
import { usePitchCalls, canCreatePitchCall, canSubmitPitch } from '@/hooks/usePitch';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountType } from '@/hooks/useAccountType';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { useUnreadPitchSubmissions } from '@/hooks/useUnreadPitchSubmissions';
import { CardSkeleton } from '@/components/ui/enhanced-skeleton';
import SEO from '@/components/common/SEO';
import { 
    Megaphone, Search, Lightbulb, Inbox, 
    PlusCircle, FileText, SlidersHorizontal
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';

const Pitch = () => {
    const { user, profile } = useAuth();
    const { push } = useAppNavigation();
    const { accountType: userAccountType, isFan } = useAccountType();

    useEffect(() => {
        if (isFan) {
            push('/404');
        }
    }, [isFan, push]);

    const [activeTab, setActiveTab] = useState('discover');
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterOpen, setFilterOpen] = useState(false);
    const [filters, setFilters] = useState({
        genre: '',
        language: '',
        format: '',
        budgetRange: '',
        compensation: '',
        openToDebut: false,
        regionalWelcome: false,
    });

    const userCraft = (profile as any)?.craft || '';

    const userCanCreate = canCreatePitchCall(userCraft, userAccountType);
    const userCanSubmit = canSubmitPitch(userCraft, userAccountType);
    const { unreadPitchCount, hasUnreadPitches } = useUnreadPitchSubmissions();

    const { pitchCalls, loading, refetch, toggleSave } = usePitchCalls(filters, searchQuery);
    const [submittedIds, setSubmittedIds] = useState<string[]>([]);

    useEffect(() => {
        if (!user) return;
        const fetchMySubmissions = async () => {
            const { data } = await supabase
                .from('pitch_submissions')
                .select('pitch_call_id')
                .eq('submitter_id', user.id);
            if (data) setSubmittedIds(data.map((s: any) => s.pitch_call_id));
        };
        fetchMySubmissions();
    }, [user?.id]);

    const hasActiveFilters = filters.genre || filters.language || filters.format || 
        filters.budgetRange || filters.compensation || filters.openToDebut || filters.regionalWelcome;

    return (
        <div className="min-h-screen bg-background pb-36">
            <SEO
                title="Pitch"
                description="The professional story pitching marketplace for India's entertainment industry. Call creators post pitch calls, writers submit scripts and concepts."
            />

            {/* Background orb */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px]" />
            </div>

            <main className="max-w-7xl mx-auto px-4 md:px-8 pt-20 relative z-10">
                <PageHeader
                    title="Pitch"
                    subtitle="The professional story pitching marketplace for the entertainment industry"
                    Icon={Lightbulb}
                    actionsAtTop={true}
                    actions={
                        user && userCanCreate && (
                            <Button
                                className="h-10 md:h-11 px-4 md:px-5 rounded-xl font-bold text-xs md:text-sm"
                                onClick={() => setIsCreateOpen(true)}
                            >
                                <PlusCircle className="h-4 w-4 mr-2" />
                                Post a Pitch Call
                            </Button>
                        )
                    }
                />

                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList className="bg-card border border-border/50 p-1 rounded-xl h-auto flex-wrap">
                        <TabsTrigger value="discover" className="rounded-lg gap-2 font-bold">
                            <Lightbulb className="h-4 w-4" /> Discover Pitch Calls
                        </TabsTrigger>
                        {user && userCanSubmit && (
                            <TabsTrigger value="my-pitches" className="rounded-lg gap-2 font-bold">
                                <FileText className="h-4 w-4" /> My Pitches
                            </TabsTrigger>
                        )}
                        {user && userCanCreate && (
                            <TabsTrigger value="inbox" className="rounded-lg gap-2 font-bold relative">
                                <Inbox className="h-4 w-4" /> Review Inbox
                                {hasUnreadPitches && (
                                    <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-background">
                                        {unreadPitchCount > 9 ? '9+' : unreadPitchCount}
                                    </span>
                                )}
                            </TabsTrigger>
                        )}
                    </TabsList>

                    {/* ─── Discover Tab ─── */}
                    <TabsContent value="discover">
                        {/* Search + Filter Bar */}
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-card/40 border border-border/50 rounded-2xl p-3 mb-8 backdrop-blur-xl"
                        >
                            <div className="flex gap-3">
                                <div className="relative flex-1">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search pitch calls..."
                                        className="h-12 pl-11 bg-transparent border-transparent focus:bg-muted/20 rounded-xl"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                    />
                                </div>
                                <Popover open={filterOpen} onOpenChange={setFilterOpen}>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            className={`h-12 px-5 rounded-xl border font-bold text-xs uppercase tracking-widest gap-2 ${hasActiveFilters ? 'text-primary border-primary/30 bg-primary/5' : 'border-border/50'}`}
                                        >
                                            <SlidersHorizontal className="h-4 w-4" />
                                            Filters {hasActiveFilters && '•'}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80 p-5 space-y-4" align="end">
                                        <p className="font-black text-sm uppercase tracking-widest">Filter Pitch Calls</p>
                                        
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold uppercase">Genre</Label>
                                            <Select value={filters.genre || 'all'} onValueChange={v => setFilters(f => ({ ...f, genre: v === 'all' ? '' : v }))}>
                                                <SelectTrigger className="h-9"><SelectValue placeholder="Any genre" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">Any Genre</SelectItem>
                                                    {['Action', 'Thriller', 'Drama', 'Comedy', 'Horror', 'Sci-Fi', 'Documentary'].map(g => (
                                                        <SelectItem key={g} value={g}>{g}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold uppercase">Language</Label>
                                            <Select value={filters.language || 'all'} onValueChange={v => setFilters(f => ({ ...f, language: v === 'all' ? '' : v }))}>
                                                <SelectTrigger className="h-9"><SelectValue placeholder="Any language" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">Any Language</SelectItem>
                                                    {['Hindi', 'Telugu', 'Tamil', 'Malayalam', 'Kannada', 'English'].map(l => (
                                                        <SelectItem key={l} value={l}>{l}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold uppercase">Compensation</Label>
                                            <Select value={filters.compensation || 'all'} onValueChange={v => setFilters(f => ({ ...f, compensation: v === 'all' ? '' : v }))}>
                                                <SelectTrigger className="h-9"><SelectValue placeholder="Any" /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">Any</SelectItem>
                                                    <SelectItem value="paid">Paid Only</SelectItem>
                                                    <SelectItem value="development_deal">Development Deal</SelectItem>
                                                    <SelectItem value="revenue_share">Revenue Share</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-3 pt-2 border-t border-border">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-sm">Open to Debut Writers</Label>
                                                <Switch
                                                    checked={filters.openToDebut}
                                                    onCheckedChange={v => setFilters(f => ({ ...f, openToDebut: v }))}
                                                />
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <Label className="text-sm">Regional Stories Welcome</Label>
                                                <Switch
                                                    checked={filters.regionalWelcome}
                                                    onCheckedChange={v => setFilters(f => ({ ...f, regionalWelcome: v }))}
                                                />
                                            </div>
                                        </div>

                                        <Button
                                            variant="outline"
                                            className="w-full text-xs"
                                            onClick={() => {
                                                setFilters({ genre: '', language: '', format: '', budgetRange: '', compensation: '', openToDebut: false, regionalWelcome: false });
                                                setFilterOpen(false);
                                            }}
                                        >
                                            Clear All Filters
                                        </Button>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        </motion.div>

                        {/* Results */}
                        {loading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {[1,2,3,4,5,6].map(i => <CardSkeleton key={i} />)}
                            </div>
                        ) : pitchCalls.length === 0 ? (
                            <div className="text-center py-20 text-muted-foreground">
                                <Megaphone className="h-16 w-16 mx-auto mb-6 opacity-20" />
                                <p className="text-xl font-black mb-2">No Pitch Calls Found</p>
                                <p className="text-sm">
                                    {hasActiveFilters 
                                        ? 'Try adjusting your filters to see more results.' 
                                        : 'Be the first to post a pitch call and start the marketplace.'}
                                </p>
                                {!hasActiveFilters && userCanCreate && (
                                    <Button className="mt-6" onClick={() => setIsCreateOpen(true)}>
                                        <PlusCircle className="h-4 w-4 mr-2" /> Post First Pitch Call
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                <AnimatePresence>
                                    {pitchCalls.map((pc, index) => (
                                        <PitchCallCard
                                            key={pc.id}
                                            pitchCall={pc}
                                            onSaveToggle={toggleSave}
                                            canSubmit={userCanSubmit}
                                            alreadySubmitted={submittedIds.includes(pc.id)}
                                            index={index}
                                        />
                                    ))}
                                </AnimatePresence>
                            </div>
                        )}
                    </TabsContent>

                    {/* ─── My Pitches Tab (Writers) ─── */}
                    {user && userCanSubmit && (
                        <TabsContent value="my-pitches">
                            <div className="max-w-3xl">
                                <div className="mb-6">
                                    <h2 className="text-xl font-black">My Submitted Pitches</h2>
                                    <p className="text-sm text-muted-foreground mt-1">Track the status of all your pitch submissions in real-time</p>
                                </div>
                                <WriterPitchTracker />
                            </div>
                        </TabsContent>
                    )}

                    {/* ─── Review Inbox Tab (Call Creators) ─── */}
                    {user && userCanCreate && (
                        <TabsContent value="inbox">
                            <div className="mb-6">
                                <h2 className="text-xl font-black">Pitch Review Inbox</h2>
                                <p className="text-sm text-muted-foreground mt-1">Review all pitches submitted to your pitch calls</p>
                            </div>
                            <CallCreatorPitchInbox />
                        </TabsContent>
                    )}
                </Tabs>
            </main>

            <PitchCallCreationModal
                isOpen={isCreateOpen}
                onClose={() => setIsCreateOpen(false)}
                onCreated={refetch}
            />
        </div>
    );
};

export default Pitch;
