import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import FeedAnnouncementCard from '@/components/feed/FeedAnnouncementCard';
import { CardSkeleton } from '@/components/ui/enhanced-skeleton';
import { Megaphone, Plus } from 'lucide-react';
import { CreateAnnouncementDialog } from '@/components/feed/CreateAnnouncementDialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader } from '@/components/common/PageHeader';
import { useAccountType } from '@/hooks/useAccountType';
import { ResponsiveGrid } from '@/components/ui/mobile-responsive-grid';

import { useAppRole } from '@/hooks/useAppRole';

interface Announcement {
    id: string;
    title: string;
    content: string;
    created_at: string;
    posted_at: string;
    author_id?: string | null;
    publisher_page_id?: string | null;
    company_pages?: {
        id: string;
        name: string;
        logo_url: string;
        slug: string;
    } | null;
    profiles?: {
        full_name: string | null;
        username: string | null;
    } | null;
}

const AnnouncementsPage = ({ openCreate = false }: { openCreate?: boolean }) => {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(openCreate);
    const { toast } = useToast();
    const { user } = useAuth();
    const { isFan } = useAccountType();
    const { isInternal } = useAppRole();

    useEffect(() => {
        if (openCreate && !isFan) setIsCreateOpen(true);
    }, [openCreate, isFan]);

    useEffect(() => {
        fetchAnnouncements();

        // Real-time subscription
        const channel = supabase
            .channel('public:announcements')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'announcements'
                },
                () => {
                    fetchAnnouncements();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchAnnouncements = async () => {
        try {
            const { data, error } = await supabase
                .from('announcements')
                .select('*, company_pages:publisher_page_id(id, name, logo_url, slug), profiles:author_id(full_name, username)')
                .order('posted_at', { ascending: false });

            if (error) throw error;

            const mappedData = (data as any || []).map((item: any) => ({
                ...item,
                created_at: item.posted_at || new Date().toISOString()
            }));

            setAnnouncements(mappedData as Announcement[]);
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
        <div className="min-h-screen bg-background pt-20 pb-36">
            <div className="max-w-7xl mx-auto px-4 md:px-8">
                <PageHeader 
                    title="Announcements" 
                    subtitle="Stay updated with the latest news and updates from the platform" 
                    Icon={Megaphone}
                    actionsAtTop={true}
                    actions={
                    user && !isFan && !isInternal ? (
                        <div className="flex gap-2">
                            <Button onClick={() => setIsCreateOpen(true)} className="bg-primary hover:bg-primary/90 rounded-xl h-10 px-4 font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-transform text-sm">
                                <Plus className="mr-2 h-4 w-4" />
                                New Announcement
                            </Button>
                            <CreateAnnouncementDialog
                                open={isCreateOpen}
                                onOpenChange={setIsCreateOpen}
                                onAnnouncementCreated={fetchAnnouncements}
                            />
                        </div>
                    ) : undefined
                  }
                />

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
                    <ResponsiveGrid cols={{ sm: 1, md: 1, lg: 2, xl: 3 }} gap={6} className="items-start">
                        {announcements.map((announcement) => (
                            <FeedAnnouncementCard
                                key={announcement.id}
                                isWidget={true}
                                announcement={{
                                    id: announcement.id,
                                    title: announcement.title,
                                    content: announcement.content,
                                    created_at: announcement.posted_at || announcement.created_at,
                                    author_id: announcement.author_id,
                                    publisher_page_id: announcement.publisher_page_id,
                                    company_pages: announcement.company_pages,
                                    profiles: announcement.profiles
                                }}
                            />
                        ))}
                    </ResponsiveGrid>
                )}
            </div>
        </div>
    );
};

export default AnnouncementsPage;
