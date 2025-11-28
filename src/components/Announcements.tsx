
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState, useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Send, Calendar, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from 'date-fns';

interface Profile {
  id: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  author_id: string;
  author: Profile;
  posted_at: string;
  event_date?: string;
  event_location?: string;
  updated_at?: string;
}

export default function Announcements() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [newAnnouncement, setNewAnnouncement] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  useEffect(() => {
    const subscription = supabase
      .channel('announcements')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'announcements' },
        (payload) => {
          fetchAnnouncementWithAuthor(payload.new as Announcement);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [profiles]);


  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from("announcements")
        .select('*')
        .order("posted_at", { ascending: false });

      if (error) throw error;

      const announcementsData = data as any;

      const authorIds = [...new Set(announcementsData.map((a: any) => a.author_id))] as string[];
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', authorIds);

      if (profilesError) throw profilesError;

      const profilesMap = profilesData.reduce((acc: any, p: any) => {
        acc[p.id] = p;
        return acc;
      }, {});

      setProfiles(profilesMap);
      setAnnouncements(announcementsData.map((a: any) => ({ ...a, author: profilesMap[a.author_id] })));

    } catch (error) {
      console.error("Error fetching announcements:", error);
    }
  };

  const fetchAnnouncementWithAuthor = async (newAnnouncement: Announcement) => {
    try {
      if (!profiles[newAnnouncement.author_id]) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url')
          .eq('id', newAnnouncement.author_id)
          .single();

        if (profileError) throw profileError;

        setProfiles(current => ({
          ...current,
          [profileData.id]: profileData as Profile
        }));
      }

      setAnnouncements(current => [
        {
          ...newAnnouncement,
          author: profiles[newAnnouncement.author_id] || undefined
        },
        ...current
      ]);
    } catch (error) {
      console.error("Error fetching announcement author:", error);
    }
  };


  const handlePost = async () => {
    if (newAnnouncement.trim() === "" || !user) return;

    setIsPosting(true);
    try {
      const { error } = await supabase.from("announcements").insert([
        {
          title: "New Announcement", // Or a form field
          content: newAnnouncement,
          author_id: user.id,
          posted_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      setNewAnnouncement("");
      toast({ title: "Success", description: "Your announcement has been posted." });
    } catch (error) {
      console.error("Error posting announcement:", error);
      toast({ title: "Error", description: "Failed to post announcement.", variant: "destructive" });
    } finally {
      setIsPosting(false);
    }
  };

  const handleTextareaFocus = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "120px";
    }
  };

  return (
    <Card className="w-full mx-auto bg-card shadow-lg rounded-lg border-2 border-border">
      <CardHeader>
        <CardTitle className="text-xl font-bold text-foreground">Announcements</CardTitle>
        <CardDescription className="text-muted-foreground">Company-wide news and updates</CardDescription>
      </CardHeader>
      <CardContent>
        {user && (
          <div className="flex items-start space-x-4 mb-6">
            <Avatar className="mt-2">
              <AvatarImage src={user.user_metadata.avatar_url} />
              <AvatarFallback>{user.user_metadata.full_name?.[0]}</AvatarFallback>
            </Avatar>
            <div className="flex-grow relative">
              <Textarea
                ref={textareaRef}
                value={newAnnouncement}
                onChange={(e) => setNewAnnouncement(e.target.value)}
                onFocus={handleTextareaFocus}
                placeholder="Share an update..."
                className="w-full p-3 pr-24 rounded-lg bg-background border-border transition-all duration-300 focus:border-primary focus-visible:ring-primary"
                style={{ height: '50px' }}
              />
              <Button onClick={handlePost} disabled={isPosting || !newAnnouncement.trim()} size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full">
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {announcements.map((announcement) => (
            <div key={announcement.id} className="flex items-start space-x-4 p-4 rounded-lg bg-background/50 hover:bg-background transition-colors duration-200">
              <Avatar>
                <AvatarImage src={announcement.author?.avatar_url} />
                <AvatarFallback>
                  {announcement.author?.full_name?.[0] || '?'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-grow">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-foreground">
                    {announcement.author?.full_name || announcement.author?.username || 'Anonymous'}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {format(parseISO(announcement.posted_at), 'MMM d, yyyy')}
                  </span>
                </div>
                <h4 className="font-bold text-lg mt-1 text-primary">{announcement.title}</h4>
                <p className="mt-1 text-foreground/90 whitespace-pre-wrap">
                  {announcement.content}
                </p>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {announcement.event_date && (
                    <div className="flex items-center"><Calendar className="mr-2 h-4 w-4" /> {format(parseISO(announcement.event_date), "eeee, MMMM d, yyyy 'at' h:mm a")}</div>
                  )}
                  {announcement.event_location && (
                    <div className="flex items-center"><MapPin className="mr-2 h-4 w-4" /> {announcement.event_location}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      {announcements.length > 5 && (
        <CardFooter className="text-center justify-center pt-4">
          <Button variant="link">View all</Button>
        </CardFooter>
      )}
    </Card>
  );
}
