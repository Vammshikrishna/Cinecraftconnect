import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import FeedAnnouncementCard from '@/components/feed/FeedAnnouncementCard';
import { CardSkeleton } from '@/components/ui/enhanced-skeleton';
import { Megaphone, Plus } from 'lucide-react';
import { CreateAnnouncementDialog } from '@/components/feed/CreateAnnouncementDialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

interface Announcement {
    id: string;
    title: string;
    content: string;
    created_at: string;
    posted_at: string;
}

const AnnouncementsPage = ({ openCreate = false }: { openCreate?: boolean }) => {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(openCreate);
    const { toast } = useToast();
    const { user } = useAuth();

    useEffect(() => {
        if (openCreate) setIsCreateOpen(true);
    }, [openCreate]);

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    const fetchAnnouncements = async () => {
        try {
            const { data, error } = await supabase
                .from('announcements')
                .select('*')
                .order('posted_at', { ascending: false });

            if (error) throw error;

            const mappedData = (data || []).map(item => ({
                ...item,
                created_at: item.posted_at || new Date().toISOString()
            }));

            setAnnouncements(mappedData);
        } catch (error) {
            console.error('Error fetching announcements:', error);
            toast({
                title: 'Error',
                description: 'Failed to load announcements',
                variant: 'destructive'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background pt-20 pb-24">
            <div className="max-w-4xl mx-auto px-4 md:px-8">
                <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-xl">
                            <Megaphone className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-4xl font-extrabold text-foreground mb-2">
                                Announcements
                            </h1>
                            <p className="text-muted-foreground text-lg">
                                Stay updated with the latest news and updates from the platform
                            </p>
                        </div>
                    </div>
                    {user && (
                        <div className="flex gap-2">
                            <Button onClick={() => setIsCreateOpen(true)} className="bg-primary hover:bg-primary/90">
                                <Plus className="mr-2 h-4 w-4" />
                                New Announcement
                            </Button>
                            <CreateAnnouncementDialog
                                open={isCreateOpen}
                                onOpenChange={setIsCreateOpen}
                                onAnnouncementCreated={fetchAnnouncements}
                            />
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="space-y-4">
                        {[...Array(5)].map((_, i) => (
                            <CardSkeleton key={i} className="h-48" />
                        ))}
                    </div>
                ) : announcements.length === 0 ? (
                    <div className="text-center py-16">
                        <Megaphone className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-foreground mb-2">
                            No announcements yet
                        </h3>
                        <p className="text-muted-foreground">
                            Check back later for updates and news
                        </p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {announcements.map((announcement) => (
                            <FeedAnnouncementCard
                                key={announcement.id}
                                announcement={{
                                    id: announcement.id,
                                    title: announcement.title,
                                    content: announcement.content,
                                    created_at: announcement.posted_at || announcement.created_at
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AnnouncementsPage;
