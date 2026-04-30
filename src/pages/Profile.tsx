import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
import Skills from '@/components/profile/Skills';
import Experience from '@/components/profile/Experience';
import { SavedPosts } from '@/components/profile/SavedPosts';
import EditProfileForm from '@/components/profile/EditProfileForm';
import { formatURL } from '@/lib/utils';
import { getOptimizedImage } from '@/utils/image-optimization';
import {
  Briefcase,
  MapPin,
  Globe,
  Settings,
  Pencil,
  Instagram,
  Linkedin,
  Twitter,
  Facebook,
  Youtube,
  Building2,
  Zap,
} from 'lucide-react';
import VerificationBadge from '@/components/common/VerificationBadge';

import { useAccountType } from '@/hooks/useAccountType';
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star } from 'lucide-react';

const ProfilePage = () => {
  const { user } = useAuth();
  const { isFan, isStudio } = useAccountType();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  
  const [activeTab, setActiveTab] = useState(tabParam || (isFan ? "saved" : "posts"));
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  const [postCount, setPostCount] = useState(0);
  const [connectionsCount, setConnectionsCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);

  const fetchCounts = useCallback(async () => {
    if (!user) return;

    // 1. Fetch all raw connections for this user
    const { data: rawConnections, error: connError } = await supabase
      .from('user_connections')
      .select('*')
      .or(`follower_id.eq.${user.id},following_id.eq.${user.id}`)
      .eq('status', 'accepted');

    if (rawConnections && !connError) {
      // 2. Fetch profiles for these connections and determine account types
      const userIds = Array.from(new Set(rawConnections.flatMap(c => [c.follower_id, c.following_id])));
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, account_type')
        .in('id', userIds);

      const profilesMap = new Map(profiles?.map(p => [p.id, p]));

      // 3. Categorize connections
      const connections = rawConnections.filter(c => {
        const otherId = c.follower_id === user.id ? c.following_id : c.follower_id;
        const otherProfile = profilesMap.get(otherId);
        // Standard connection if the other person is a creator or not specified
        return otherProfile?.account_type === 'creator' || !otherProfile?.account_type;
      });

      const fanFollowers = rawConnections.filter(c => {
        // Only count as fan follower if THEY follow US and they are a FAN
        if (c.following_id !== user.id) return false;
        const followerProfile = profilesMap.get(c.follower_id);
        return followerProfile?.account_type === 'fan';
      });

      setConnectionsCount(connections.length);
      setFollowersCount(fanFollowers.length);
    }

    // Still fetch post count separately for efficiency
    const { count: postsCount } = await supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', user.id);

    setPostCount(postsCount || 0);

    // Fetch following count (people this user follows who are NOT fan accounts usually)
    const { count: followingCount } = await supabase
      .from('user_connections')
      .select('id', { count: 'exact', head: true })
      .eq('follower_id', user.id)
      .eq('status', 'accepted');

    setFollowingCount(followingCount || 0);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchInitialData = async () => {
      try {
        // First get profile - this is top priority
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') throw error;
        if (profileData) setProfile(profileData as any);

        // Hide initial skeleton once layout is ready
        setLoading(false);

        // Fetch non-blocking counts after header is ready
        fetchCounts();
      } catch (error) {
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
      <div className="bg-background min-h-screen flex justify-center pt-20 pb-40">
        <div className="w-full max-w-4xl px-4 md:px-8">
          <div className="glass-card mb-8 rounded-xl overflow-hidden">
            <EnhancedSkeleton className="h-48 w-full" />
            <div className="flex flex-col items-center -mt-16 pb-8 gap-4 px-6">
              <EnhancedSkeleton className="w-32 h-32 rounded-full border-4 border-background" />
              <EnhancedSkeleton className="h-8 w-64" />
              <EnhancedSkeleton className="h-4 w-full max-w-md" />
              <div className="flex gap-4 mt-4">
                <EnhancedSkeleton className="h-10 w-32 rounded-full" />
                <EnhancedSkeleton className="h-10 w-10 rounded-full" />
              </div>
            </div>
          </div>
          <div className="flex gap-4 mb-6 overflow-hidden">
            {[1, 2, 3, 4, 5].map(i => (
              <EnhancedSkeleton key={i} className="h-10 w-24 rounded-full flex-shrink-0" />
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map(i => (
              <EnhancedSkeleton key={i} className="h-64 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!profile || !user) {
    return <div className="text-white bg-black h-screen flex items-center justify-center">User not found.</div>;
  }

  if (isEditing) {
    return (
      <div className="bg-background text-foreground min-h-screen flex justify-center py-12 pt-20 pb-24 relative overflow-hidden">
        {/* Background ambient effects */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] pointer-events-none opacity-50" />
        <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-secondary/15 rounded-full blur-[120px] pointer-events-none opacity-40" />

        <div className="w-full max-w-3xl px-4 relative z-10">
          <div className="glass-card p-8">
            <EditProfileForm
              profile={profile}
              onUpdate={handleProfileUpdate}
              setEditing={setIsEditing}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background text-foreground min-h-screen flex justify-center pt-20 pb-40 relative overflow-hidden">
      {/* Background ambient effects */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] pointer-events-none opacity-50" />

      <div className="w-full max-w-4xl px-4 md:px-8 relative z-10">
        <header className="glass-card mb-8 relative overflow-hidden group pb-8">
          {/* Cover Photo */}
          <div className="h-32 md:h-44 w-full relative overflow-hidden">
            {profile.cover_image_url ? (
              <img src={getOptimizedImage(profile.cover_image_url, { width: 1200, quality: 90 })} alt="Cover" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 via-primary/5 to-secondary/10" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          </div>

          <div className="relative z-10 flex flex-col items-start px-6 md:px-12 py-8">
            {/* Expanded Avatar and Identity Block */}
            <div className="flex items-start gap-6 md:gap-10 mb-8 -mt-20 md:-mt-28 w-full">
              <div className="shrink-0 flex flex-col items-center gap-4 -ml-2 md:-ml-4">
                <Avatar className="w-40 h-40 md:w-56 md:h-56 border-4 border-border shadow-2xl">
                  <AvatarImage src={getOptimizedImage(profile.avatar_url, { width: 512, height: 512 }) || ''} alt={profile.username || 'User'} className="object-cover" />
                  <AvatarFallback className="bg-muted text-4xl font-black text-muted-foreground">
                    {profile.username?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                {/* Craft and Location Badges stay in left column */}
                <div className="flex flex-col items-center gap-2 mt-2 w-full">
                  {profile.craft && (
                    <Link to={`/learning-portal?craft=${encodeURIComponent(profile.craft)}`} className="flex items-center gap-1.5 hover:text-primary transition-colors px-3 py-1 rounded-full bg-secondary/10 border border-secondary/20 text-[11px] font-medium w-full justify-center">
                      <Briefcase size={12} />
                      <span>{profile.craft}</span>
                    </Link>
                  )}
                  {profile.location && (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/10 border border-secondary/20 text-[11px] font-medium w-full justify-center text-muted-foreground whitespace-nowrap">
                      <MapPin size={12} />
                      <span>{profile.location}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-4 pt-16 md:pt-24 flex-1">
                <div className="flex flex-col gap-2">
                  {isFan ? (
                    <Link to="/pricing" className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-full text-[10px] font-black uppercase tracking-wider hover:bg-amber-500/20 transition-all cursor-pointer w-fit">
                      <Star size={12} className="fill-amber-500" />
                      <span>Fan Account</span>
                    </Link>
                  ) : isStudio ? (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/30 text-primary rounded-full text-[10px] font-black uppercase tracking-wider w-fit">
                      <Building2 size={12} />
                      <span>Studio / Company</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/30 text-primary rounded-full text-[10px] font-black uppercase tracking-wider w-fit">
                      <Zap size={12} className="fill-primary" />
                      <span>Creator Pro</span>
                    </div>
                  )}
                  <h1 className="text-xl md:text-3xl font-black text-foreground tracking-tight leading-tight flex items-center gap-2">
                    {profile.full_name || profile.username}
                    {profile.is_verified && <VerificationBadge size="lg" />}
                  </h1>
                </div>

                {profile.bio && (
                  <p className="text-muted-foreground text-sm md:text-base max-w-prose leading-relaxed font-medium">
                    {profile.bio}
                  </p>
                )}

                {/* Social Icons moved to below bio */}
                <div className="flex items-center gap-2 mt-2">
                  {(profile.social_links?.instagram || profile.instagram_url) && (
                    <a href={formatURL(profile.social_links?.instagram || profile.instagram_url)} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:text-pink-500 hover:bg-pink-500/10 transition-all hover:scale-110">
                        <Instagram size={18} />
                      </Button>
                    </a>
                  )}

                  {profile.social_links?.linkedin && (
                    <a href={formatURL(profile.social_links.linkedin)} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:text-blue-600 hover:bg-blue-600/10 transition-all hover:scale-110">
                        <Linkedin size={18} />
                      </Button>
                    </a>
                  )}

                  {profile.social_links?.twitter && (
                    <a href={formatURL(profile.social_links.twitter)} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:text-sky-500 hover:bg-sky-500/10 transition-all hover:scale-110">
                        <Twitter size={18} />
                      </Button>
                    </a>
                  )}

                  {profile.social_links?.facebook && (
                    <a href={formatURL(profile.social_links.facebook)} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:text-blue-500 hover:bg-blue-500/10 transition-all hover:scale-110">
                        <Facebook size={18} />
                      </Button>
                    </a>
                  )}

                  {((profile.social_links as any)?.youtube || profile.youtube_url) && (
                  <a href={formatURL((profile.social_links as any)?.youtube || profile.youtube_url)} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:text-red-600 hover:bg-red-600/10 transition-all hover:scale-110">
                        <Youtube size={18} />
                      </Button>
                    </a>
                  )}
                </div>
                
                {profile.website && (
                  <a href={formatURL(profile.website)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-primary transition-colors text-xs text-muted-foreground mt-2">
                    <Globe size={12} />
                    <span>{profile.website.replace(/^(https?|ftp):\/\//, '')}</span>
                  </a>
                )}
              </div>
            </div>

            {/* Compact Stats Row (Now only contains stats) */}
            <div className="flex flex-wrap items-center gap-8 mt-4 w-full px-2">
              <div className="flex items-center gap-6 py-2">
                {!isFan && (
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-foreground">{postCount}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Posts</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-foreground">{followersCount}</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Followers</span>
                </div>
                {isFan ? (
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-foreground">{followingCount}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Following</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-foreground">{connectionsCount}</span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Connections</span>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 mt-6 w-full justify-start">
              <Button
                onClick={() => setIsEditing(true)}
                className="gap-2 bg-primary hover:bg-primary/90 text-white rounded-full px-6 shadow-lg shadow-primary/20 transition-all hover:scale-105"
              >
                <Pencil className="h-4 w-4" />
                <span>Edit Profile</span>
              </Button>
              <Link to="/settings">
                <Button variant="outline" size="icon" className="rounded-full border-border/50 hover:bg-secondary/10 hover:text-foreground transition-all hover:scale-105">
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </header>

        <Tabs 
          value={activeTab} 
          onValueChange={(value) => {
            setActiveTab(value);
            setSearchParams({ tab: value });
          }} 
          className="w-full"
        >
          <div className="relative w-full mb-6">
            <div className="flex overflow-x-auto gap-2 pb-2 w-full" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <TabsList className="flex h-auto bg-transparent gap-2 p-0 min-w-max">
                {(isFan ? ['saved'] : isStudio ? ['posts', 'portfolio', 'projects', 'announcements', 'analytics', 'saved', 'skills', 'experience'] : ['posts', 'portfolio', 'projects', 'announcements', 'analytics', 'saved', 'skills', 'experience']).map((tab) => (
                  <TabsTrigger
                    key={tab}
                    value={tab}
                    className="flex items-center gap-1.5 px-4 py-1.5 md:px-6 md:py-2 rounded-full text-xs md:text-sm font-medium whitespace-nowrap transition-all duration-300 border shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-[0_0_15px_-3px_rgba(var(--primary),0.4)] data-[state=active]:scale-105 bg-secondary/30 border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground capitalize"
                  >
                    {tab}
                  </TabsTrigger>
                ))}
              </TabsList>
              <div className="w-4 shrink-0" />
            </div>
          </div>

          <TabsContent value="saved" className="py-8"><SavedPosts /></TabsContent>
          {!isFan && (
            <>
              <TabsContent value="posts" className="py-8"><UserPosts targetUserId={user.id} /></TabsContent>
              <TabsContent value="portfolio" className="py-8">
                <PortfolioGrid userId={user.id} isOwner={true} />
              </TabsContent>
              <TabsContent value="projects" className="py-8"><UserProjects userId={user.id} /></TabsContent>
              <TabsContent value="announcements" className="py-8"><UserAnnouncements /></TabsContent>
              <TabsContent value="analytics" className="py-8"><RealTimeAnalytics /></TabsContent>
              <TabsContent value="skills" className="py-8"><Skills userId={user.id} isOwner={true} /></TabsContent>
              <TabsContent value="experience" className="py-8"><Experience userId={user.id} isOwner={true} /></TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </div>
  );
};

export default ProfilePage;

