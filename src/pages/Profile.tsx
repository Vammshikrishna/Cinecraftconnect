
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { PortfolioGrid } from '@/components/portfolio/PortfolioGrid';

import { UserAnnouncements } from '@/components/profile/UserAnnouncements';
import { UserPosts } from '@/components/profile/UserPosts';
import { UserProjects } from '@/components/profile/UserProjects';
import { RealTimeAnalytics } from '@/components/profile/RealTimeAnalytics';
import EditProfileForm from '@/components/profile/EditProfileForm';
import Skills from '@/components/profile/Skills';
import Experience from '@/components/profile/Experience';
import {
  Briefcase,
  MapPin,
  Globe,
  Settings,
  Instagram,
  Linkedin,
  Twitter,
  Facebook,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const ProfilePage = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  const [postCount, setPostCount] = useState(0);
  const [connectionsCount, setConnectionsCount] = useState(0);

  const fetchCounts = useCallback(async () => {
    if (!user) return;
    const { count: posts } = await supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', user.id);
    setPostCount(posts || 0);

    const { count: connections } = await supabase
      .from('user_connections')
      .select('id', { count: 'exact', head: true })
      .or(`follower_id.eq.${user.id},following_id.eq.${user.id}`)
      .eq('status', 'accepted');
    setConnectionsCount(connections || 0);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (error && error.code !== 'PGRST116') throw error;
        if (profileData) setProfile(profileData as any);
        await fetchCounts();
      } catch (error) {
        console.error('Error fetching initial data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();

    const profileChannel = supabase
      .channel(`profile-updates:${user.id}`)
      .on<Profile>(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload) => {
          setProfile(prevProfile => {
            if (!prevProfile) return null;
            return { ...prevProfile, ...(payload.new as Partial<Profile>) } as Profile;
          });
        }
      )
      .subscribe();

    const postsChannel = supabase
      .channel(`post-count-updates:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'posts', filter: `author_id=eq.${user.id}` },
        () => fetchCounts()
      )
      .subscribe();

    const connectionsChannel = supabase
      .channel(`connections-count-updates:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_connections', filter: `or(follower_id.eq.${user.id},following_id.eq.${user.id})` },
        () => fetchCounts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileChannel);
      supabase.removeChannel(postsChannel);
      supabase.removeChannel(connectionsChannel);
    };
  }, [user, fetchCounts]);

  const handleProfileUpdate = (updatedProfile: Profile) => {
    setProfile(updatedProfile);
    setIsEditing(false);
  };

  if (loading) {
    return (
      <div className="w-full h-screen bg-black flex justify-center items-center pt-20">
        <Skeleton className="h-64 w-full max-w-3xl" />
      </div>
    );
  }

  if (!profile || !user) {
    return <div className="text-white bg-black h-screen flex items-center justify-center">User not found.</div>;
  }

  if (isEditing) {
    return (
      <div className="bg-black text-white min-h-screen flex justify-center py-12 pt-20">
        <div className="w-full max-w-3xl px-4">
          <EditProfileForm
            profile={profile}
            onUpdate={handleProfileUpdate}
            setEditing={setIsEditing}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background text-foreground min-h-screen flex justify-center pt-20 pb-24 relative overflow-hidden">
      {/* Background ambient effects */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] pointer-events-none opacity-50" />

      <div className="w-full max-w-4xl px-4 relative z-10">
        <header className="glass-card p-8 mb-8 relative overflow-hidden group">
          {/* Decorative background gradient inside card */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 pointer-events-none" />

          <div className="relative z-10 flex flex-col items-center text-center gap-6">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-full blur opacity-75 group-hover:opacity-100 transition duration-500"></div>
              <Avatar className="w-32 h-32 border-4 border-background relative">
                <AvatarImage src={profile.avatar_url || ''} alt={profile.username || 'User'} className="object-cover" />
                <AvatarFallback className="bg-muted text-4xl font-bold text-muted-foreground">
                  {profile.username?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="flex flex-col gap-2 items-center max-w-2xl">
              <h1 className="text-3xl md:text-4xl font-bold text-gradient">
                {profile.full_name || profile.username}
              </h1>

              {profile.bio && (
                <p className="text-muted-foreground text-sm md:text-base max-w-prose leading-relaxed">
                  {profile.bio}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-center gap-4 mt-2 text-sm text-muted-foreground">
                {profile.craft && (
                  <Link to={`/learning-portal?craft=${encodeURIComponent(profile.craft)}`} className="flex items-center gap-1.5 hover:text-primary transition-colors px-3 py-1 rounded-full bg-secondary/10 border border-secondary/20">
                    <Briefcase size={14} />
                    <span>{profile.craft}</span>
                  </Link>
                )}
                {profile.location && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/10 border border-secondary/20">
                    <MapPin size={14} />
                    <span>{profile.location}</span>
                  </div>
                )}
                {profile.website && (
                  <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-primary transition-colors px-3 py-1 rounded-full bg-secondary/10 border border-secondary/20">
                    <Globe size={14} />
                    <span>{profile.website.replace(/^(https?|ftp):\/\//, '')}</span>
                  </a>
                )}
              </div>

              <div className="flex items-center justify-center gap-3 mt-4">
                {(profile.social_links?.instagram || profile.instagram_url) && (
                  <a href={profile.social_links?.instagram || profile.instagram_url || '#'} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:text-pink-500 hover:bg-pink-500/10 transition-all hover:scale-110">
                      <Instagram size={18} />
                    </Button>
                  </a>
                )}

                {profile.social_links?.linkedin && (
                  <a href={profile.social_links.linkedin} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:text-blue-600 hover:bg-blue-600/10 transition-all hover:scale-110">
                      <Linkedin size={18} />
                    </Button>
                  </a>
                )}

                {profile.social_links?.twitter && (
                  <a href={profile.social_links.twitter} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:text-sky-500 hover:bg-sky-500/10 transition-all hover:scale-110">
                      <Twitter size={18} />
                    </Button>
                  </a>
                )}

                {profile.social_links?.facebook && (
                  <a href={profile.social_links.facebook} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:text-blue-500 hover:bg-blue-500/10 transition-all hover:scale-110">
                      <Facebook size={18} />
                    </Button>
                  </a>
                )}

                {profile.youtube_url && (
                  <a href={profile.youtube_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:text-red-500 hover:bg-red-500/10 transition-all hover:scale-110">
                      <div className="flex items-center justify-center w-4 h-4 bg-current rounded-full">
                        <div className="w-0 h-0 border-t-[2px] border-t-transparent border-l-[4px] border-l-background border-b-[2px] border-b-transparent ml-0.5"></div>
                      </div>
                    </Button>
                  </a>
                )}
              </div>

              <div className="flex items-center gap-6 mt-6 py-4 border-t border-border/50 w-full justify-center">
                <div className="flex flex-col items-center px-6">
                  <span className="text-2xl font-bold text-foreground">{postCount}</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Posts</span>
                </div>
                <div className="w-px h-8 bg-border/50" />
                <div className="flex flex-col items-center px-6">
                  <span className="text-2xl font-bold text-foreground">{connectionsCount}</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Connections</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 mt-2">
                <Button
                  onClick={() => setIsEditing(true)}
                  className="bg-primary hover:bg-primary/90 text-white rounded-full px-6 shadow-lg shadow-primary/20 transition-all hover:scale-105"
                >
                  Edit Profile
                </Button>
                <Link to="/settings">
                  <Button variant="outline" size="icon" className="rounded-full border-border/50 hover:bg-secondary/10 hover:text-foreground transition-all hover:scale-105">
                    <Settings className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </header>

        <Tabs defaultValue="posts" className="w-full">
          <div className="relative w-full mb-6">
            <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide w-full md:justify-center" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <TabsList className="flex h-auto bg-transparent gap-2 p-0">
                <TabsTrigger
                  value="posts"
                  className="flex items-center gap-1.5 px-4 py-1.5 md:px-6 md:py-2 rounded-full text-xs md:text-sm font-medium whitespace-nowrap transition-all duration-300 border shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-[0_0_15px_-3px_rgba(var(--primary),0.4)] data-[state=active]:scale-105 bg-secondary/30 border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                >
                  Posts
                </TabsTrigger>
                <TabsTrigger
                  value="portfolio"
                  className="flex items-center gap-1.5 px-4 py-1.5 md:px-6 md:py-2 rounded-full text-xs md:text-sm font-medium whitespace-nowrap transition-all duration-300 border shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-[0_0_15px_-3px_rgba(var(--primary),0.4)] data-[state=active]:scale-105 bg-secondary/30 border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                >
                  Portfolio
                </TabsTrigger>
                <TabsTrigger
                  value="projects"
                  className="flex items-center gap-1.5 px-4 py-1.5 md:px-6 md:py-2 rounded-full text-xs md:text-sm font-medium whitespace-nowrap transition-all duration-300 border shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-[0_0_15px_-3px_rgba(var(--primary),0.4)] data-[state=active]:scale-105 bg-secondary/30 border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                >
                  Projects
                </TabsTrigger>
                <TabsTrigger
                  value="announcements"
                  className="flex items-center gap-1.5 px-4 py-1.5 md:px-6 md:py-2 rounded-full text-xs md:text-sm font-medium whitespace-nowrap transition-all duration-300 border shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-[0_0_15px_-3px_rgba(var(--primary),0.4)] data-[state=active]:scale-105 bg-secondary/30 border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                >
                  Announcements
                </TabsTrigger>
                <TabsTrigger
                  value="analytics"
                  className="flex items-center gap-1.5 px-4 py-1.5 md:px-6 md:py-2 rounded-full text-xs md:text-sm font-medium whitespace-nowrap transition-all duration-300 border shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-[0_0_15px_-3px_rgba(var(--primary),0.4)] data-[state=active]:scale-105 bg-secondary/30 border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                >
                  Analytics
                </TabsTrigger>
                <TabsTrigger
                  value="skills"
                  className="flex items-center gap-1.5 px-4 py-1.5 md:px-6 md:py-2 rounded-full text-xs md:text-sm font-medium whitespace-nowrap transition-all duration-300 border shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-[0_0_15px_-3px_rgba(var(--primary),0.4)] data-[state=active]:scale-105 bg-secondary/30 border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                >
                  Skills
                </TabsTrigger>
                <TabsTrigger
                  value="experience"
                  className="flex items-center gap-1.5 px-4 py-1.5 md:px-6 md:py-2 rounded-full text-xs md:text-sm font-medium whitespace-nowrap transition-all duration-300 border shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-[0_0_15px_-3px_rgba(var(--primary),0.4)] data-[state=active]:scale-105 bg-secondary/30 border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                >
                  Experience
                </TabsTrigger>
              </TabsList>
              <div className="w-4 shrink-0" />
            </div>
            <div className="absolute right-0 top-0 bottom-2 w-12 bg-gradient-to-l from-background to-transparent pointer-events-none" />
            <div className="absolute left-0 top-0 bottom-2 w-4 bg-gradient-to-r from-background to-transparent pointer-events-none" />
          </div>

          <TabsContent value="posts" className="py-8"><UserPosts targetUserId={user.id} /></TabsContent>
          <TabsContent value="portfolio" className="py-8">
            <PortfolioGrid userId={user.id} isOwner={true} />
          </TabsContent>
          <TabsContent value="projects" className="py-8"><UserProjects userId={user.id} /></TabsContent>
          <TabsContent value="announcements" className="py-8"><UserAnnouncements /></TabsContent>
          <TabsContent value="analytics" className="py-8"><RealTimeAnalytics /></TabsContent>
          <TabsContent value="skills" className="py-8"><Skills userId={user.id} isOwner={true} /></TabsContent>
          <TabsContent value="experience" className="py-8"><Experience userId={user.id} isOwner={true} /></TabsContent>
        </Tabs>


      </div>
    </div>
  );
};

export default ProfilePage;
