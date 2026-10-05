import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
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
import { Calendar as CalendarIcon, Link as LinkIcon, Loader2, Save, MessageSquare, UserCheck } from 'lucide-react';
import { format, eachDayOfInterval, parseISO } from 'date-fns';

export interface UserAvailability {
    id: string;
    user_id: string;
    start_date: string;
    end_date: string;
    status: 'free' | 'tentative' | 'booked';
    notes?: string;
    source_type?: 'personal' | 'schedule';
    source_project_id?: string | null;
}

const parseLocalDate = (dateStr: string): Date => {
    if (!dateStr) return new Date();
    const clean = dateStr.split('T')[0];
    const parts = clean.split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    return parseISO(dateStr);
};

const AvailabilityCalendar = () => {
    const { user } = useAuth();
    const { goBack, push } = useAppNavigation();
    const { toast } = useToast();
    const params = useParams<{ userId?: string }>();
    const [searchParams] = useSearchParams();

    // Determine target user to view/manage
    const targetUserId = params.userId || searchParams.get('userId') || user?.id;
    const isOwnCalendar = Boolean(user?.id && targetUserId === user?.id);

    const [targetProfile, setTargetProfile] = useState<{ full_name?: string; username?: string; craft?: string; account_type?: string } | null>(null);
    const [availabilities, setAvailabilities] = useState<UserAvailability[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Calendar selection state
    const [selectedDates, setSelectedDates] = useState<Date[]>([]);
    const [statusToApply, setStatusToApply] = useState<'free' | 'tentative' | 'booked'>('booked');
    

    useEffect(() => {
        if (targetUserId) {
            fetchAvailability();
            if (!isOwnCalendar) {
                fetchTargetProfile();
            }
        }
    }, [targetUserId, isOwnCalendar]);

    const fetchTargetProfile = async () => {
        try {
            const { data } = await supabase
                .from('profiles')
                .select('full_name, username, craft, account_type')
                .eq('id', targetUserId!)
                .single();
            if (data) setTargetProfile(data);
        } catch (e) {
            console.error('Error fetching target profile:', e);
        }
    };

    const fetchAvailability = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('global_user_availability_view' as any)
                .select('*')
                .eq('user_id', targetUserId!);
                
            if (error) {
                // Fallback to user_availability table if view fails
                const { data: rawData } = await supabase
                    .from('user_availability' as any)
                    .select('*')
                    .eq('user_id', targetUserId!);
                if (rawData) setAvailabilities(rawData as unknown as UserAvailability[]);
            } else if (data) {
                setAvailabilities(data as unknown as UserAvailability[]);
            }
        } catch (error) {
            console.error('Error fetching availability:', error);
            toast({ title: 'Error', description: 'Failed to load availability calendar.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleApplyStatus = async () => {
        if (!user || !isOwnCalendar || selectedDates.length === 0) return;
        
        try {
            setSaving(true);
            
            const newEntries = selectedDates.map(date => {
                const dateStr = format(date, 'yyyy-MM-dd');
                return {
                    user_id: user.id,
                    start_date: dateStr,
                    end_date: dateStr,
                    status: statusToApply
                };
            });

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

    // Builds a real .ics file from the schedule and downloads it (import it into Google/Apple/Outlook).
    const downloadICal = () => {
        const esc = (t: string) =>
            t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
        const compact = (d: string) => d.replace(/-/g, '').slice(0, 8);
        const nextDay = (d: string) => {
            const dt = parseLocalDate(d);
            dt.setDate(dt.getDate() + 1);
            return format(dt, 'yyyyMMdd');
        };
        const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
        const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CineCraft Connect//Availability//EN', 'CALSCALE:GREGORIAN'];
        availabilities.forEach((a) => {
            const startStr = a.start_date;
            const endStr = a.end_date || a.start_date;
            lines.push(
                'BEGIN:VEVENT',
                `UID:${a.id}@cinecraftconnect`,
                `DTSTAMP:${stamp}`,
                `DTSTART;VALUE=DATE:${compact(startStr)}`,
                `DTEND;VALUE=DATE:${nextDay(endStr)}`,
                `SUMMARY:${esc(a.status.toUpperCase() + (a.notes ? ' - ' + a.notes : ''))}`,
                'END:VEVENT'
            );
        });
        lines.push('END:VCALENDAR');
        const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'cinecraft-availability.ics';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast({ title: 'Calendar exported', description: 'Import the downloaded .ics file into your calendar app.' });
    };

    // Helper to expand a date range into local midnight Date objects for calendar modifiers
    const expandDates = (list: UserAvailability[], filterFn: (a: UserAvailability) => boolean) => {
        return list.filter(filterFn).flatMap(a => {
            const start = parseLocalDate(a.start_date);
            const endDateStr = a.end_date || a.start_date;
            const end = parseLocalDate(endDateStr);
            if (!a.end_date || a.start_date === a.end_date || start > end) {
                return [start];
            }
            try {
                return eachDayOfInterval({ start, end });
            } catch (e) {
                return [start];
            }
        });
    };

    // Calculate calendar modifiers to show existing availabilities
    const modifiers = {
        booked: expandDates(availabilities, a => a.status === 'booked' && a.source_type !== 'schedule'),
        tentative: expandDates(availabilities, a => a.status === 'tentative'),
        schedule_booked: expandDates(availabilities, a => a.status === 'booked' && a.source_type === 'schedule'),
    };

    const modifiersClassNames = {
        booked: '!bg-red-500/20 !text-red-500 font-bold border border-red-500/50 rounded-md',
        tentative: '!bg-yellow-500/20 !text-yellow-500 font-bold border border-yellow-500/50 rounded-md',
        schedule_booked: '!bg-purple-500/20 !text-purple-500 font-bold border border-purple-500/50 rounded-md'
    };

    const targetDisplayName = targetProfile?.full_name || targetProfile?.username || 'Crew Member';

    if (!isOwnCalendar && targetProfile?.account_type === 'fan') {
        return (
            <div className="min-h-screen bg-background pt-20 pb-40">
                <div className="max-w-xl mx-auto px-4 text-center">
                    <PageHeader
                        title={`${targetDisplayName}'s Profile`}
                        subtitle="Availability Status"
                        onBack={() => goBack()}
                    />
                    <div className="mt-12 p-8 bg-card border border-border rounded-3xl space-y-4 shadow-sm">
                        <CalendarIcon className="w-12 h-12 text-muted-foreground mx-auto opacity-40" />
                        <h3 className="text-xl font-bold">Crew Availability Unavailable</h3>
                        <p className="text-sm text-muted-foreground">
                            Availability Calendars are only available for Creator, Pro, and Studio crew accounts.
                        </p>
                        <Button onClick={() => push(`/profile/${targetUserId}`)} className="mt-4 bg-primary text-white rounded-xl font-bold">
                            Return to Profile
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background pt-20 pb-40">
            <div className="max-w-4xl mx-auto px-4 md:px-8">
                <PageHeader
                    title={isOwnCalendar ? "Crew Availability" : `${targetDisplayName}'s Availability`}
                    subtitle={isOwnCalendar ? "Manage your personal schedule and sync with other apps" : `View ${targetDisplayName}'s availability and scheduled commitments`}
                    onBack={() => goBack()}
                />

                <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Main Calendar Area */}
                    <div className="md:col-span-2 space-y-6">
                        <div className="bg-card border border-border p-6 rounded-3xl shadow-sm">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <CalendarIcon className="w-5 h-5 text-primary" />
                                    {isOwnCalendar ? 'Select Dates' : 'Availability Calendar'}
                                </h2>
                                
                                {isOwnCalendar ? (
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
                                ) : (
                                    <Button 
                                        onClick={() => push(`/messages/${targetUserId}`)}
                                        className="rounded-xl h-10 px-4 bg-primary text-white flex items-center gap-2"
                                    >
                                        <MessageSquare className="w-4 h-4" />
                                        Contact {targetDisplayName.split(' ')[0]}
                                    </Button>
                                )}
                            </div>

                            <div className="flex justify-center p-4 bg-secondary/5 rounded-2xl border border-border/50">
                                {loading ? (
                                    <div className="h-[300px] flex items-center justify-center">
                                        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground opacity-50" />
                                    </div>
                                ) : isOwnCalendar ? (
                                    <Calendar
                                        mode="multiple"
                                        selected={selectedDates}
                                        onSelect={setSelectedDates as any}
                                        modifiers={modifiers}
                                        modifiersClassNames={modifiersClassNames}
                                        className="w-full max-w-[350px]"
                                    />
                                ) : (
                                    <Calendar
                                        mode="single"
                                        modifiers={modifiers}
                                        modifiersClassNames={modifiersClassNames}
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

                        {/* Schedule Agenda Section */}
                        <div className="bg-card border border-border p-6 rounded-3xl shadow-sm">
                            <h3 className="font-bold text-lg mb-4">
                                {isOwnCalendar ? 'Active Commitments' : `${targetDisplayName}'s Commitments`}
                            </h3>
                            {availabilities.length === 0 ? (
                                <p className="text-sm text-muted-foreground py-4 text-center">No active schedule commitments found.</p>
                            ) : (
                                <div className="space-y-3">
                                    {availabilities.map((item) => {
                                        const isProject = item.source_type === 'schedule';
                                        const displayNotes = isOwnCalendar 
                                            ? item.notes || (isProject ? 'Project Shoot Commitment' : 'Personal Availability')
                                            : (isProject ? item.notes || 'Project Shoot' : item.status === 'booked' ? 'Personal Booked' : 'Tentative Availability');

                                        return (
                                            <div key={item.id} className="flex items-center justify-between p-3 bg-secondary/10 rounded-2xl border border-border/40">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                                                            isProject ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                                                            item.status === 'booked' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                                                            'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                                                        }`}>
                                                            {isProject ? 'Project Schedule' : item.status}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground font-mono">
                                                            {item.start_date} {item.end_date && item.end_date !== item.start_date ? `to ${item.end_date}` : ''}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm font-semibold">{displayNotes}</p>
                                                </div>
                                                {isProject && item.source_project_id && isOwnCalendar && (
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        onClick={() => push(`/projects/${item.source_project_id}/space`)}
                                                        className="text-xs text-primary"
                                                    >
                                                        Open Space
                                                    </Button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar / Sync or Profile options */}
                    <div className="space-y-6">
                        {isOwnCalendar ? (
                            <div className="bg-card border border-border p-6 rounded-3xl shadow-sm">
                                <h3 className="font-bold mb-2">Export Calendar</h3>
                                <p className="text-sm text-muted-foreground mb-6">
                                    Download your schedule as an .ics file and import it into Google Calendar, Apple Calendar, or Outlook.
                                </p>
                                <Button variant="outline" className="w-full justify-start" onClick={downloadICal}>
                                    <LinkIcon className="w-4 h-4 mr-2" />
                                    Download .ics file
                                </Button>
                                <p className="text-[10px] text-muted-foreground mt-2">
                                    This is a one-time snapshot of your current schedule; it does not stay in sync automatically.
                                </p>
                            </div>
                        ) : (
                            <div className="bg-card border border-border p-6 rounded-3xl shadow-sm space-y-4">
                                <h3 className="font-bold">About {targetDisplayName}</h3>
                                {targetProfile?.craft && (
                                    <div className="text-xs text-muted-foreground">
                                        <span className="font-bold text-foreground">Craft:</span> {targetProfile.craft}
                                    </div>
                                )}
                                <Button 
                                    className="w-full bg-primary text-white font-bold rounded-xl"
                                    onClick={() => push(`/profile/${targetUserId}`)}
                                >
                                    <UserCheck className="w-4 h-4 mr-2" />
                                    View Full Profile
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AvailabilityCalendar;

