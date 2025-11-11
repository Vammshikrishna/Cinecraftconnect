import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Profile } from '@/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { PortfolioGrid } from '@/components/portfolio/PortfolioGrid';
import PortfolioUploadDialog from '@/components/portfolio/PortfolioUploadDialog';
import { UserAnnouncements } from '@/components/profile/UserAnnouncements';
import { UserPosts } from '@/components/profile/UserPosts';
import { UserProjects } from '@/components/profile/UserProjects';
import { RealTimeAnalytics } from '@/components/profile/RealTimeAnalytics';
import EditProfileForm from '@/components/profile/EditProfileForm';
import { 
  Grid, 
  Film, 
  BarChart2,
  Rss,
  Briefcase,
  MapPin,
  Globe
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const ProfilePage = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [portfolioDialogOpen, setPortfolioDialogOpen] = useState(false);
  const [postCount, setPostCount] = useState(0);
  const [connectionsCount, setConnectionsCount] = useState(0);

  const fetchCounts = useCallback(async () => {
    if (!user) return;
    // Fetch post count
    const { count: posts } = await supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', user.id);
    setPostCount(posts || 0);

    // Correctly fetch accepted connections count
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
        if (profileData) setProfile(profileData);
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
            return { ...prevProfile, ...payload.new } as Profile;
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

    // Correctly subscribe to all connection changes for the user
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
    <div className="bg-black text-white min-h-screen flex justify-center pt-20">
      <div className="w-full max-w-3xl px-4">
        <header className="flex flex-col items-center text-center gap-4 mb-8">
          <Avatar className="w-36 h-36 border-4 border-gray-800">
            <AvatarImage src={profile.avatar_url || ''} alt={profile.username || 'User'} />
            <AvatarFallback className="bg-gray-700 text-5xl">
              {profile.username?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-bold">
              {profile.full_name || profile.username}
            </h1>
            <div className="flex justify-center gap-6 text-lg text-gray-400 mt-2">
              <span>
                <span className="font-bold text-white">{postCount}</span> Posts
              </span>
              <span>
                <span className="font-bold text-white">{connectionsCount}</span> Connections
              </span>
            </div>
            
            {profile.bio && (
              <p className="text-gray-300 mt-4 max-w-prose">{profile.bio}</p>
            )}

            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-4 text-gray-400">
                {profile.craft && (
                    <Link to={`/learning-portal?craft=${encodeURIComponent(profile.craft)}`} className="flex items-center gap-2 hover:text-white transition-colors">
                        <Briefcase size={16} />
                        <span>{profile.craft}</span>
                    </Link>
                )}
                {profile.location && (
                    <div className="flex items-center gap-2">
                        <MapPin size={16} />
                        <span>{profile.location}</span>
                    </div>
                )}
                {profile.website && (
                    <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-white transition-colors">
                        <Globe size={16} />
                        <span>{profile.website.replace(/^(https?|ftp):\/\//, '')}</span>
                    </a>
                )}
            </div>

          </div>
          <Button className="rounded-full bg-gray-800 hover:bg-gray-700 text-white font-semibold px-8 py-3 mt-4 text-base" onClick={() => setIsEditing(true)}>Edit Profile</Button>
        </header>
        
        <Tabs defaultValue="posts" className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-transparent border-t border-b border-gray-800 h-20 rounded-none">
            <TabsTrigger value="posts" className="text-gray-400 data-[state=active]:text-white data-[state=active]:bg-gray-800/50 rounded-none h-full text-base flex flex-col items-center justify-center gap-1">
              <Grid size={24} />
              <span>Posts</span>
            </TabsTrigger>
            <TabsTrigger value="portfolio" className="text-gray-400 data-[state=active]:text-white data-[state=active]:bg-gray-800/50 rounded-none h-full text-base flex flex-col items-center justify-center gap-1">
              <Briefcase size={24} />
              <span>Portfolio</span>
            </TabsTrigger>
            <TabsTrigger value="projects" className="text-gray-400 data-[state=active]:text-white data-[state=active]:bg-gray-800/50 rounded-none h-full text-base flex flex-col items-center justify-center gap-1">
              <Film size={24} />
              <span>Projects</span>
            </TabsTrigger>
            <TabsTrigger value="announcements" className="text-gray-400 data-[state=active]:text-white data-[state=active]:bg-gray-800/50 rounded-none h-full text-base flex flex-col items-center justify-center gap-1">
              <Rss size={24} />
              <span>Announcements</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="text-gray-400 data-[state=active]:text-white data-[state=active]:bg-gray-800/50 rounded-none h-full text-base flex flex-col items-center justify-center gap-1">
              <BarChart2 size={24} />
              <span>Analytics</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="py-8">
            <UserPosts targetUserId={user.id} />
          </TabsContent>
          <TabsContent value="portfolio" className="py-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">My Portfolio</h2>
              <Button onClick={() => setPortfolioDialogOpen(true)}>+ Add New Item</Button>
            </div>
            <PortfolioGrid userId={user.id} isOwner={true} onAddNew={() => setPortfolioDialogOpen(true)} />
          </TabsContent>
          <TabsContent value="projects" className="py-8">
            <UserProjects userId={user.id} />
          </TabsContent>
          <TabsContent value="announcements" className="py-8">
            <UserAnnouncements />
          </TabsContent>
          <TabsContent value="analytics" className="py-8">
            <RealTimeAnalytics />
          </TabsContent>
        </Tabs>

        <PortfolioUploadDialog isOpen={portfolioDialogOpen} onOpenChange={setPortfolioDialogOpen} />
      </div>
    </div>
  );
};

export default ProfilePage;
