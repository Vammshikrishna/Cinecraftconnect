
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDays, MessageCircle, ThumbsUp, Share2, Megaphone, Calendar } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

// Mock announcement data
const mockAnnouncements = [
  {
    id: 1,
    author: "Jordan Rivera",
    authorRole: "Director",
    avatar: "/placeholder.svg",
    initials: "JR",
    title: "Casting Call: Lead Actress for Short Film",
    content: "Looking for a lead actress (25-35) for an upcoming drama short film 'Echoes of Tomorrow'. Auditions will be held next weekend at Downtown Studio.",
    eventDate: "2025-05-25",
    eventLocation: "Downtown Studio, LA",
    postedAt: "2025-05-01",
    likes: 42,
    comments: 8
  },
  {
    id: 2,
    author: "Emma Clark",
    authorRole: "Producer",
    avatar: "/placeholder.svg",
    initials: "EC",
    title: "Film Festival Launch Party",
    content: "Join us for the launch party of the 10th Annual Independent Filmmakers Festival. Network with industry professionals and enjoy screenings of selected short films.",
    eventDate: "2025-06-10",
    eventLocation: "Riverfront Cinema, NYC",
    postedAt: "2025-05-05",
    likes: 67,
    comments: 15
  },
  {
    id: 3,
    author: "Marcus Johnson",
    authorRole: "Workshop Facilitator",
    avatar: "/placeholder.svg",
    initials: "MJ",
    title: "Screenwriting Workshop Series",
    content: "Four-week intensive screenwriting workshop for beginners and intermediate writers. Learn structure, character development, and dialogue techniques from industry professionals.",
    eventDate: "2025-06-05",
    eventLocation: "Film Academy Center, Online",
    postedAt: "2025-05-08",
    likes: 31,
    comments: 6
  }
];

const Announcements = () => {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [announcements, setAnnouncements] = useState(mockAnnouncements);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Create new announcement (in a real app, this would send to a backend)
    const newAnnouncement = {
      id: announcements.length + 1,
      author: "Current User", // In a real app, get from auth
      authorRole: "Filmmaker", // In a real app, get from profile
      avatar: "/placeholder.svg",
      initials: "CU",
      title: title,
      content: content,
      eventDate: eventDate,
      eventLocation: eventLocation,
      postedAt: new Date().toISOString().split('T')[0],
      likes: 0,
      comments: 0
    };
    
    setAnnouncements([newAnnouncement, ...announcements]);
    
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
  };

  return (
    <section className="py-12 px-4 md:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold">Community Announcements</h2>
          <Button 
            onClick={() => setShowForm(!showForm)} 
            className="bg-cinesphere-purple hover:bg-cinesphere-purple/90"
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
                <Button type="submit" className="bg-cinesphere-purple hover:bg-cinesphere-purple/90">
                  Post Announcement
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="border-white/20">
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}
        
        {/* Announcements List */}
        <div className="space-y-6">
          {announcements.map((announcement) => (
            <div key={announcement.id} className="glass-card rounded-xl p-6 hover:shadow-lg transition-all">
              <div className="flex items-start gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={announcement.avatar} />
                  <AvatarFallback className="bg-cinesphere-purple/30 text-white">{announcement.initials}</AvatarFallback>
                </Avatar>
                
                <div className="flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1">
                    <h3 className="text-xl font-semibold">{announcement.title}</h3>
                  </div>
                  
                  <div className="flex items-center text-sm text-gray-400 mb-3">
                    <span className="mr-2">{announcement.author}</span>
                    <span className="text-cinesphere-purple">{announcement.authorRole}</span>
                    <span className="mx-2">·</span>
                    <span>Posted {new Date(announcement.postedAt).toLocaleDateString()}</span>
                  </div>
                  
                  <p className="text-gray-200 mb-4">{announcement.content}</p>
                  
                  {(announcement.eventDate || announcement.eventLocation) && (
                    <div className="bg-cinesphere-dark/30 rounded-lg p-3 mb-4 flex flex-col sm:flex-row gap-3">
                      {announcement.eventDate && (
                        <div className="flex items-center text-cinesphere-purple">
                          <Calendar size={16} className="mr-2" />
                          <span>Event Date: {new Date(announcement.eventDate).toLocaleDateString()}</span>
                        </div>
                      )}
                      {announcement.eventLocation && (
                        <div className="flex items-center text-cinesphere-purple sm:ml-4">
                          <CalendarDays size={16} className="mr-2" />
                          <span>Location: {announcement.eventLocation}</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="flex pt-2 border-t border-white/10">
                    <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                      <ThumbsUp size={16} className="mr-1" /> {announcement.likes}
                    </Button>
                    <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                      <MessageCircle size={16} className="mr-1" /> {announcement.comments}
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
      </div>
    </section>
  );
};

export default Announcements;
