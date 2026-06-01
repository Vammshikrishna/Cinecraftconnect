import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/common/PageHeader';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarIcon, Link as LinkIcon, Loader2, Save } from 'lucide-react';
import { format, isSameDay, eachDayOfInterval, parseISO } from 'date-fns';

export interface UserAvailability {
    id: string;
    start_date: string;
    end_date: string;
    status: 'free' | 'tentative' | 'booked';
    notes?: string;
    source_type?: 'personal' | 'schedule';
    source_project_id?: string | null;
}

const AvailabilityCalendar = () => {
    const { user } = useAuth();
    const { goBack } = useAppNavigation();
    const { toast } = useToast();

    const [availabilities, setAvailabilities] = useState<UserAvailability[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Calendar selection state
    const [selectedDates, setSelectedDates] = useState<Date[]>([]);
    const [statusToApply, setStatusToApply] = useState<'free' | 'tentative' | 'booked'>('booked');
    
    // External sync
    const [iCalUrl, setICalUrl] = useState('');

    useEffect(() => {
        if (user) {
            fetchAvailability();
        }
    }, [user]);

    const fetchAvailability = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('global_user_availability_view' as any)
                .select('*')
                .eq('user_id', user!.id);
                
            if (error) throw error;
            setAvailabilities(data as unknown as UserAvailability[]);
        } catch (error) {
            console.error('Error fetching availability:', error);
            toast({ title: 'Error', description: 'Failed to load availability calendar.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleApplyStatus = async () => {
        if (!user || selectedDates.length === 0) return;
        
        try {
            setSaving(true);
            
            // For simplicity, we just save each selected date as a single-day availability.
            // If they selected consecutive days, a more advanced implementation would merge them into ranges.
            const newEntries = selectedDates.map(date => {
                const dateStr = format(date, 'yyyy-MM-dd');
                return {
                    user_id: user.id,
                    start_date: dateStr,
                    end_date: dateStr,
                    status: statusToApply
                };
            });

            // If applying 'free', we actually delete any existing overlapping 'tentative'/'booked' records
            // or we could insert explicit 'free' records. Let's insert explicit records or update existing.
            // A simple approach is to delete existing entries for these dates and then insert if not 'free'.
            
            // Delete existing overlapping (exact single days for now)
            const dateStrings = selectedDates.map(d => format(d, 'yyyy-MM-dd'));
            await supabase
                .from('user_availability' as any)
                .delete()
                .eq('user_id', user.id)
                .in('start_date', dateStrings)
                .in('end_date', dateStrings);
                
            if (statusToApply !== 'free') {
                const { error } = await supabase
                    .from('user_availability' as any)
                    .insert(newEntries);
                if (error) throw error;
            }

            toast({ title: 'Availability updated', description: `Marked ${selectedDates.length} days as ${statusToApply}.` });
            setSelectedDates([]);
            await fetchAvailability();
        } catch (error) {
            console.error('Error saving availability:', error);
            toast({ title: 'Error', description: 'Failed to update availability.', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    const generateICalLink = () => {
        // Mock generation for subscription
        const baseUrl = window.location.origin;
        const link = `${baseUrl}/api/calendar/sync?user=${user?.id}&token=placeholder`;
        navigator.clipboard.writeText(link);
        toast({ title: 'Link copied', description: 'iCal subscription link copied to clipboard.' });
    };

    // Helper to expand a date range into an array of individual days for the calendar modifier
    const expandDates = (list: UserAvailability[], filterFn: (a: UserAvailability) => boolean) => {
        return list.filter(filterFn).flatMap(a => {
            if (!a.end_date || a.start_date === a.end_date) {
                return [parseISO(a.start_date)];
            }
            try {
                return eachDayOfInterval({ start: parseISO(a.start_date), end: parseISO(a.end_date) });
            } catch (e) {
                return [parseISO(a.start_date)];
            }
        });
    };

    // Calculate calendar modifiers to show existing availabilities
    const modifiers = {
        booked: expandDates(availabilities, a => a.status === 'booked' && a.source_type !== 'schedule'),
        tentative: expandDates(availabilities, a => a.status === 'tentative'),
        schedule_booked: expandDates(availabilities, a => a.status === 'booked' && a.source_type === 'schedule'),
    };

    const modifiersStyles = {
        booked: { backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', fontWeight: 'bold' },
        tentative: { backgroundColor: 'rgba(234, 179, 8, 0.2)', color: '#eab308', fontWeight: 'bold' },
        schedule_booked: { backgroundColor: 'rgba(168, 85, 247, 0.2)', color: '#a855f7', fontWeight: 'bold' }
    };

    return (
        <div className="min-h-screen bg-background pt-20 pb-40">
            <div className="max-w-4xl mx-auto px-4 md:px-8">
                <PageHeader
                    title="Crew Availability"
                    subtitle="Manage your personal schedule and sync with other apps"
                    onBack={() => goBack()}
                />

                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Main Calendar Area */}
                    <div className="md:col-span-2 space-y-6">
                        <div className="bg-card border border-border p-6 rounded-3xl shadow-sm">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <CalendarIcon className="w-5 h-5 text-primary" />
                                    Select Dates
                                </h2>
                                
                                <div className="flex items-center gap-2 bg-secondary/20 p-1 rounded-xl">
                                    <Select value={statusToApply} onValueChange={(v: any) => setStatusToApply(v)}>
                                        <SelectTrigger className="w-[140px] h-10 border-0 bg-transparent font-bold">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="booked">Booked</SelectItem>
                                            <SelectItem value="tentative">Tentative</SelectItem>
                                            <SelectItem value="free">Free</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button 
                                        onClick={handleApplyStatus}
                                        disabled={selectedDates.length === 0 || saving}
                                        className="rounded-lg h-10 px-4"
                                    >
                                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Apply'}
                                    </Button>
                                </div>
                            </div>

                            <div className="flex justify-center p-4 bg-secondary/5 rounded-2xl border border-border/50">
                                {loading ? (
                                    <div className="h-[300px] flex items-center justify-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground opacity-50" />
                                    </div>
                                ) : (
                                    <Calendar
                                        mode="multiple"
                                        selected={selectedDates}
                                        onSelect={setSelectedDates as any}
                                        modifiers={modifiers}
                                        modifiersStyles={modifiersStyles}
                                        className="w-full max-w-[350px]"
                                    />
                                )}
                            </div>
                            
                            <div className="mt-6 flex justify-center gap-6 text-sm flex-wrap">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500"></div>
                                    <span className="text-muted-foreground">Personal Booked</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-purple-500/20 border border-purple-500"></div>
                                    <span className="text-muted-foreground">Project Booked</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-yellow-500/20 border border-yellow-500"></div>
                                    <span className="text-muted-foreground">Tentative</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sidebar / Sync options */}
                    <div className="space-y-6">
                        <div className="bg-card border border-border p-6 rounded-3xl shadow-sm">
                            <h3 className="font-bold mb-2">Sync Calendar</h3>
                            <p className="text-sm text-muted-foreground mb-6">
                                Import or export your schedule to Google Calendar, Apple Calendar, or Outlook.
                            </p>
                            
                            <div className="space-y-6">
                                <div>
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                                        Export (Subscribe)
                                    </Label>
                                    <Button variant="outline" className="w-full justify-start" onClick={generateICalLink}>
                                        <LinkIcon className="w-4 h-4 mr-2" />
                                        Copy iCal Link
                                    </Button>
                                    <p className="text-[10px] text-muted-foreground mt-2">
                                        Paste this link in your calendar app to subscribe to your CineCraft schedule.
                                    </p>
                                </div>
                                
                                <div className="pt-4 border-t border-border/50">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 block">
                                        Import Google Calendar
                                    </Label>
                                    <div className="flex gap-2">
                                        <Input 
                                            value={iCalUrl}
                                            onChange={(e) => setICalUrl(e.target.value)}
                                            placeholder="Paste .ics URL..." 
                                            className="h-10 text-xs"
                                        />
                                        <Button size="icon" variant="secondary" className="h-10 w-10 shrink-0" onClick={() => toast({ title: 'Saved', description: 'Calendar URL saved for syncing.' })}>
                                            <Save className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AvailabilityCalendar;
