import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ResponsiveGrid } from "@/components/ui/mobile-responsive-grid";
import FeedAnnouncementCard from "./FeedAnnouncementCard";
import { Button } from "@/components/ui/button";
import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
    DrawerFooter,
} from '@/components/ui/drawer';
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { z } from "zod";

const announcementSchema = z.object({
  title: z.string().trim().min(1, 'Title cannot be empty').max(200, 'Title must be less than 200 characters'),
  content: z.string().trim().min(1, 'Content cannot be empty').max(2000, 'Content must be less than 2000 characters')
});

interface Announcement {
  id: string;
  title: string;
  content: string;
  created_at: string;
  author_id: string;
}

const AnnouncementsTab = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const { toast } = useToast();

  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnnouncements((data || []).map(item => ({
        ...item,
        created_at: item.posted_at, // Map posted_at to created_at
        author_id: item.author_id || '' // Handle null author_id
      })));
    } catch (error) {
      console.error('Error fetching announcements:', error);
      toast({
        title: "Error",
        description: "Failed to load announcements",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createAnnouncement = async () => {
    try {
      const validation = announcementSchema.safeParse({
        title: newTitle,
        content: newContent
      });

      if (!validation.success) {
        toast({
          title: "Validation error",
          description: validation.error.issues[0].message,
          variant: "destructive",
        });
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please log in to post announcements",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('announcements')
        .insert([
          {
            title: validation.data.title,
            content: validation.data.content,
            author_id: user.id,
          }
        ]);

      if (error) throw error;

      setNewTitle("");
      setNewContent("");
      setShowCreateForm(false);
      fetchAnnouncements();
      toast({
        title: "Success",
        description: "Announcement posted successfully!",
      });
    } catch (error) {
      console.error('Error creating announcement:', error);
      toast({
        title: "Error",
        description: "Failed to post announcement",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchAnnouncements();

    const channel = supabase
      .channel('announcements-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements' },
        () => fetchAnnouncements()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-semibold text-foreground">Announcements</h3>
            <Drawer open={showCreateForm} onOpenChange={setShowCreateForm}>
                <Button onClick={() => setShowCreateForm(true)} className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl">
                    Post Announcement
                </Button>
                <DrawerContent className="bg-background/95 backdrop-blur-3xl border-none rounded-t-[32px] max-h-[90vh]">
                    <div className="mx-auto w-12 h-1.5 rounded-full bg-muted/40 my-4" />
                    <DrawerHeader>
                        <DrawerTitle className="text-xl font-black text-center">Post Announcement</DrawerTitle>
                    </DrawerHeader>
                    <div className="space-y-6 px-6 py-4">
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Title</label>
                            <Input
                                placeholder="Announcement Title"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                className="bg-primary/5 border-none focus-visible:ring-2 focus-visible:ring-primary h-12 rounded-2xl font-bold"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Content</label>
                            <Textarea
                                placeholder="What's the news?"
                                value={newContent}
                                onChange={(e) => setNewContent(e.target.value)}
                                rows={6}
                                className="bg-primary/5 border-none focus-visible:ring-2 focus-visible:ring-primary rounded-2xl font-medium resize-none"
                            />
                        </div>
                    </div>
                    <DrawerFooter className="px-6 pb-12 pt-4">
                        <Button onClick={createAnnouncement} className="h-14 rounded-2xl bg-primary font-black text-lg shadow-xl shadow-primary/20">
                            Post Announcement
                        </Button>
                        <Button variant="ghost" onClick={() => setShowCreateForm(false)} className="h-12 rounded-2xl font-bold">
                            Cancel
                        </Button>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>
        </div>

      {announcements.length === 0 ? (
        <div className="text-center py-8 bg-muted/20 rounded-lg flex flex-col items-center justify-center space-y-4">
          <p className="text-muted-foreground">No announcements yet.</p>
        </div>
      ) : (
        <ResponsiveGrid cols={{ sm: 1, md: 2 }} gap={4}>
          {announcements.map((announcement) => (
            <FeedAnnouncementCard
              key={announcement.id}
              announcement={{
                id: announcement.id,
                title: announcement.title,
                content: announcement.content,
                created_at: announcement.created_at,
                author_id: announcement.author_id
              }}
            />
          ))}
        </ResponsiveGrid>
      )}
    </div>
  );
};

export default AnnouncementsTab;