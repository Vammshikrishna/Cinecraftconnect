
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDays, MessageCircle, ThumbsUp, Share2, Megaphone, Calendar, Loader2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  role?: string;
}

interface Announcement {
  id: string;
  author_id: string;
  title: string;
  content: string;
  event_date: string | null;
  event_location: string | null;
  posted_at: string;
  updated_at: string;
  author?: Profile;
}

const Announcements = () => {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});

  useEffect(() => {
    fetchAnnouncements();

    // Set up realtime subscription
    const announcementsChannel = supabase
      .channel('public:announcements')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            fetchAnnouncementWithAuthor(payload.new as Announcement);
          } else if (payload.eventType === 'UPDATE') {
            setAnnouncements(current => 
              current.map(item => item.id === payload.new.id ? {...item, ...payload.new} : item)
            );
          } else if (payload.eventType === 'DELETE') {
            setAnnouncements(current => 
              current.filter(item => item.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(announcementsChannel);
    };
  }, []);

  const fetchAnnouncements = async () => {
    setIsLoading(true);
    try {
      const { data: announcementData, error } = await supabase
        .from('announcements')
        .select('*')
        .order('posted_at', { ascending: false });

      if (error) throw error;

      // Now fetch author information for each announcement
      const authorIds = [...new Set(announcementData.map(a => a.author_id))];
      
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, role')
        .in('id', authorIds);
        
      if (profileError) throw profileError;

      // Create a map of profiles by id for easy lookup
      const profileMap: Record<string, Profile> = {};
      profileData?.forEach(profile => {
        profileMap[profile.id] = profile;
      });
      
      setProfiles(profileMap);
      
      // Attach author data to announcements
      const announcementsWithAuthors = announcementData.map(announcement => ({
        ...announcement,
        author: profileMap[announcement.author_id]
      }));
      
      setAnnouncements(announcementsWithAuthors);
    } catch (error) {
      console.error("Error fetching announcements:", error);
      toast({
        title: "Error",
        description: "Failed to load announcements",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAnnouncementWithAuthor = async (newAnnouncement: Announcement) => {
    try {
      // Check if we already have the author's profile
      if (!profiles[newAnnouncement.author_id]) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, full_name, avatar_url, role')
          .eq('id', newAnnouncement.author_id)
          .single();
          
        if (profileError) throw profileError;
        
        // Add this profile to our profiles map
        setProfiles(current => ({
          ...current,
          [profileData.id]: profileData
        }));
      }
      
      // Add the announcement with author data to our list
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to post an announcement",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from('announcements')
        .insert({
          author_id: user.id,
          title,
          content,
          event_date: eventDate || null,
          event_location: eventLocation || null
        });
        
      if (error) throw error;
      
      // Reset form
      setTitle("");
      setContent("");
      setEventDate("");
      setEventLocation("");
      setShowForm(false);
      
      toast({
        title: "Announcement posted!",
        description: "Your announcement has been published to the community."
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to post announcement",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase();
  };

  return (
    <section className="py-12 px-4 md:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold">Community Announcements</h2>
          <Button 
            onClick={() => setShowForm(!showForm)} 
            className="bg-cinesphere-purple hover:bg-cinesphere-purple/90"
            disabled={!user}
          >
            <Megaphone size={16} className="mr-2" /> 
            {showForm ? "Cancel" : "Post Announcement"}
          </Button>
        </div>
        
        {/* Announcement Form */}
        {showForm && (
          <div className="glass-card rounded-xl p-6 mb-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="announcement-title" className="block text-sm font-medium mb-1">Title</label>
                <Input 
                  id="announcement-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="E.g., Casting Call: Lead Actress for Short Film"
                  className="bg-cinesphere-dark/50 border-white/10"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="announcement-content" className="block text-sm font-medium mb-1">Content</label>
                <Textarea 
                  id="announcement-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your announcement details here..."
                  className="bg-cinesphere-dark/50 border-white/10 min-h-[100px]"
                  required
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="event-date" className="block text-sm font-medium mb-1">Event Date (if applicable)</label>
                  <Input 
                    id="event-date"
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="bg-cinesphere-dark/50 border-white/10"
                  />
                </div>
                
                <div>
                  <label htmlFor="event-location" className="block text-sm font-medium mb-1">Location</label>
                  <Input 
                    id="event-location"
                    value={eventLocation}
                    onChange={(e) => setEventLocation(e.target.value)}
                    placeholder="E.g., Downtown Studio, LA or Online"
                    className="bg-cinesphere-dark/50 border-white/10"
                  />
                </div>
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button 
                  type="submit" 
                  className="bg-cinesphere-purple hover:bg-cinesphere-purple/90"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Posting...
                    </>
                  ) : (
                    "Post Announcement"
                  )}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="border-white/20">
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}
        
        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center p-20">
            <Loader2 className="h-10 w-10 text-cinesphere-purple animate-spin" />
          </div>
        )}
        
        {/* Empty State */}
        {!isLoading && announcements.length === 0 && (
          <div className="glass-card rounded-xl p-8 text-center">
            <Megaphone className="h-12 w-12 mx-auto text-cinesphere-purple/50 mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Announcements Yet</h3>
            <p className="text-gray-400 mb-6">Be the first to post an announcement in the community</p>
            <Button 
              onClick={() => setShowForm(true)} 
              className="bg-cinesphere-purple hover:bg-cinesphere-purple/90"
              disabled={!user}
            >
              Post First Announcement
            </Button>
            {!user && (
              <p className="mt-4 text-sm text-gray-400">
                Sign in to post an announcement
              </p>
            )}
          </div>
        )}
        
        {/* Announcements List */}
        {!isLoading && announcements.length > 0 && (
          <div className="space-y-6">
            {announcements.map((announcement) => (
              <div key={announcement.id} className="glass-card rounded-xl p-6 hover:shadow-lg transition-all">
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={announcement.author?.avatar_url || ""} />
                    <AvatarFallback className="bg-cinesphere-purple/30 text-white">
                      {getInitials(announcement.author?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1">
                      <h3 className="text-xl font-semibold">{announcement.title}</h3>
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-400 mb-3">
                      <span className="mr-2">{announcement.author?.full_name || "User"}</span>
                      <span className="text-cinesphere-purple">{announcement.author?.role || "Filmmaker"}</span>
                      <span className="mx-2">·</span>
                      <span>Posted {new Date(announcement.posted_at).toLocaleDateString()}</span>
                    </div>
                    
                    <p className="text-gray-200 mb-4">{announcement.content}</p>
                    
                    {(announcement.event_date || announcement.event_location) && (
                      <div className="bg-cinesphere-dark/30 rounded-lg p-3 mb-4 flex flex-col sm:flex-row gap-3">
                        {announcement.event_date && (
                          <div className="flex items-center text-cinesphere-purple">
                            <Calendar size={16} className="mr-2" />
                            <span>Event Date: {new Date(announcement.event_date).toLocaleDateString()}</span>
                          </div>
                        )}
                        {announcement.event_location && (
                          <div className="flex items-center text-cinesphere-purple sm:ml-4">
                            <CalendarDays size={16} className="mr-2" />
                            <span>Location: {announcement.event_location}</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    <div className="flex pt-2 border-t border-white/10">
                      <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                        <ThumbsUp size={16} className="mr-1" /> 0
                      </Button>
                      <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                        <MessageCircle size={16} className="mr-1" /> 0
                      </Button>
                      <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white ml-auto">
                        <Share2 size={16} className="mr-1" /> Share
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default Announcements;
