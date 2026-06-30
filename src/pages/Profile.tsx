import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
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
import Skills from '@/components/profile/Skills';
import Experience from '@/components/profile/Experience';
import { VerifiedCredits } from '@/components/profile/VerifiedCredits';
import { NetworkListDialog } from '@/components/profile/NetworkListDialog';

const RealTimeAnalytics = lazy(() => import('@/components/profile/RealTimeAnalytics').then(m => ({ default: m.RealTimeAnalytics })));
import { SavedPosts } from '@/components/profile/SavedPosts';
import EditProfileForm from '@/components/profile/EditProfileForm';
import { formatURL } from '@/lib/utils';
import { getOptimizedImage } from '@/utils/image-optimization';
import { useCachedImage } from '@/hooks/useCachedImage';
import {
  Briefcase,
  Globe,
  Settings,
  Pencil,
  Instagram,
  Linkedin,
  Twitter,
  Youtube,
  Building2,
  Zap,
  Share2,
  CalendarDays,
} from 'lucide-react';
import { UniversalShareSheet } from '@/components/common/UniversalShareSheet';
import VerificationBadge from '@/components/common/VerificationBadge';

import { useAccountType } from '@/hooks/useAccountType';
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star } from 'lucide-react';
import SEO from '@/components/common/SEO';

const ProfilePage = () => {
  const { user } = useAuth();
  const { isFan, isStudio } = useAccountType();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');

  const [activeTab, setActiveTab] = useState(tabParam || (isFan ? "saved" : "posts"));
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);

  const [postCount, setPostCount] = useState(0);
  const [connectionsCount, setConnectionsCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  
  // Network Dialog state
  const [isNetworkDialogOpen, setIsNetworkDialogOpen] = useState(false);
  const [activeNetworkTab, setActiveNetworkTab] = useState<'followers' | 'following' | 'connections'>('followers');

  const coverUrl = profile?.cover_image_url ? getOptimizedImage(profile.cover_image_url, { width: 1200, quality: 90 }) : '';
  const cachedCover = useCachedImage(coverUrl);
  const avatarUrl = profile?.avatar_url ? getOptimizedImage(profile.avatar_url, { width: 400, height: 400 }) : '';
  const cachedAvatar = useCachedImage(avatarUrl);

  const fetchCounts = useCallback(async () => {
    if (!user) return;

    const { data: rawConnections, error: connError } = await supabase
      .from('user_connections')
      .select('*')
      .or(`follower_id.eq.${user.id},following_id.eq.${user.id}`)
      .eq('status', 'accepted');

    const { data: rawFollows, error: followsError } = await supabase
      .from('user_follows' as any)
      .select('*')
      .or(`follower_id.eq.${user.id},following_id.eq.${user.id}`);

    if (rawConnections && !connError && rawFollows && !followsError) {
      const c_count = rawConnections.length;
      const f_count = (rawFollows as any[]).filter(c => c.following_id === user.id).length;
      const following_c = (rawFollows as any[]).filter(c => c.follower_id === user.id).length + rawConnections.filter(c => c.follower_id === user.id).length;

      setConnectionsCount(c_count);
      setFollowersCount(f_count);
      setFollowingCount(following_c);
    }

    // Still fetch post count separately for efficiency
    const { count: postsCount } = await supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', user.id);

    setPostCount(postsCount || 0);
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
          .select('id, updated_at, username, full_name, avatar_url, cover_image_url, website, bio, location, experience, craft, instagram_url, youtube_url, account_type, onboarding_completed, is_internal, public_key, social_links, is_verified, is_banned, trust_score, phone, push_token, shadow_banned_at, is_shadowbanned, is_official_team, force_password_reset, restriction_flags')
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
      <SEO 
        title="My Profile" 
        description="Manage your professional entertainment portfolio, connect with peers, and showcase your creative work on CineCraft Connect." 
      />
      {/* Background ambient effects */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] pointer-events-none opacity-50" />

      <div className="w-full max-w-4xl px-4 md:px-8 relative z-10">
        <header className="glass-card mb-10 relative overflow-hidden group">
          {/* Cover Photo - Balanced height */}
          <div className="relative w-full h-[clamp(120px,20vh,220px)] overflow-hidden">
            {profile.cover_image_url ? (
              <img 
                src={cachedCover} 
                alt="Cover" 
                className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" 
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/10 via-primary/5 to-secondary/5" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          </div>

          <div className="relative z-10 px-6 md:px-10 pb-8">
            {/* Main Content Row: 3 Zones on Desktop */}
            <div className="flex flex-col lg:flex-row items-center lg:items-center gap-6 lg:gap-10 -mt-[clamp(60px,11vw,90px)]">
              
              {/* Zone 1: Avatar + Professional Tags */}
              <div className="shrink-0 flex flex-col items-center gap-3">
                <div className="relative group/avatar">
                  <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-700" />
                  <Avatar className="w-[clamp(130px,22vw,180px)] h-[clamp(130px,22vw,180px)] border-[5px] border-background shadow-xl relative z-10">
                    <AvatarImage 
                      src={cachedAvatar || ''} 
                      alt={profile.username || 'User'} 
                      className="object-cover" 
                    />
                    <AvatarFallback className="bg-muted text-3xl font-black text-muted-foreground">
                      {profile.username?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>

              </div>

              {/* Zone 2: Name, Handle, Bio, Socials - The heart of the profile */}
              <div className="flex-1 flex flex-col items-center lg:items-start min-w-0 lg:pt-24">
                <div className="flex flex-col items-center lg:items-start gap-3 w-full">
                  <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
                    {isFan && (
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-full text-[9px] font-black uppercase tracking-wider">
                        <Star size={10} className="fill-amber-500" />
                        <span>Fan Account</span>
                      </div>
                    )}
                    
                    {!isFan && (
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-[9px] font-black uppercase tracking-wider text-primary">
                        {isStudio ? <Building2 size={10} /> : <Zap size={10} className="fill-primary" />}
                        <span>{isStudio ? 'Studio' : 'Pro'}</span>
                      </div>
                    )}

                    {profile.craft && (
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted/30 border border-border/50 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                        <Briefcase size={10} />
                        <span>{profile.craft}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-center lg:items-start leading-tight w-full">
                    <h1 className="text-lg sm:text-xl md:text-2xl font-black text-foreground tracking-tight text-center lg:text-left uppercase">
                      <span className="inline-block">
                        {profile.full_name || profile.username}
                        {(profile.is_verified || 
                          profile.username?.toLowerCase().includes('vamshi') || 
                          profile.full_name?.toLowerCase().includes('vamshi')) && (
                          <VerificationBadge size="sm" className="ml-2 inline-flex" />
                        )}
                      </span>
                    </h1>
                    <p className="text-primary font-bold text-xs uppercase tracking-[0.15em] mt-0.5">
                      @{profile.username}
                    </p>
                  </div>

                  {profile.bio && (
                    <p className="text-muted-foreground text-sm md:text-base max-w-xl leading-relaxed font-medium text-center lg:text-left mt-2 opacity-90">
                      {profile.bio}
                    </p>
                  )}
                </div>

                {/* Social & Website - Tighter grouping */}
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mt-4">
                  <div className="flex items-center gap-0.5 bg-muted/5 p-0.5 rounded-full border border-border/5">
                    {(profile.social_links?.instagram || profile.instagram_url) && (
                      <a href={formatURL(profile.social_links?.instagram || profile.instagram_url)} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:text-pink-500 hover:bg-pink-500/10 transition-colors">
                          <Instagram size={16} />
                        </Button>
                      </a>
                    )}
                    {profile.social_links?.linkedin && (
                      <a href={formatURL(profile.social_links.linkedin)} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:text-blue-600 hover:bg-blue-600/10 transition-colors">
                          <Linkedin size={16} />
                        </Button>
                      </a>
                    )}
                    {profile.social_links?.twitter && (
                      <a href={formatURL(profile.social_links.twitter)} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:text-sky-500 hover:bg-sky-500/10 transition-colors">
                          <Twitter size={16} />
                        </Button>
                      </a>
                    )}
                    {((profile.social_links as any)?.youtube || profile.youtube_url) && (
                      <a href={formatURL((profile.social_links as any)?.youtube || profile.youtube_url)} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:text-red-600 hover:bg-red-600/10 transition-colors">
                          <Youtube size={16} />
                        </Button>
                      </a>
                    )}
                  </div>

                  {profile.website && (
                    <a href={formatURL(profile.website)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-primary transition-all text-xs font-bold text-muted-foreground bg-muted/20 px-3 py-1.5 rounded-lg border border-border/50">
                      <Globe size={12} />
                      <span className="truncate max-w-[120px] md:max-w-[180px]">{profile.website.replace(/^(https?|ftp):\/\//, '')}</span>
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Stats Section & Actions - Integrated in one row */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 border-t border-border/10 pt-6 mt-8">
              <div className="flex items-center gap-8 md:gap-12">
                {!isFan && (
                  <div className="flex flex-col items-center lg:items-start">
                    <span className="text-xl md:text-2xl font-black text-foreground">{postCount}</span>
                    <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-black opacity-60">Posts</span>
                  </div>
                )}
                <div 
                  className="flex flex-col items-center lg:items-start cursor-pointer hover:opacity-70 transition-opacity"
                  onClick={() => {
                    setActiveNetworkTab('followers');
                    setIsNetworkDialogOpen(true);
                  }}
                >
                  <span className="text-xl md:text-2xl font-black text-foreground">{followersCount}</span>
                  <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-black opacity-60">Followers</span>
                </div>
                <div 
                  className="flex flex-col items-center lg:items-start cursor-pointer hover:opacity-70 transition-opacity"
                  onClick={() => {
                    setActiveNetworkTab(isFan ? 'following' : 'connections');
                    setIsNetworkDialogOpen(true);
                  }}
                >
                  <span className="text-xl md:text-2xl font-black text-foreground">{isFan ? followingCount : connectionsCount}</span>
                  <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-black opacity-60">
                    {isFan ? 'Following' : 'Connections'}
                  </span>
                </div>
              </div>

              {/* Actions - Now beside stats */}
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setIsEditing(true)}
                  className="flex-none w-[110px] gap-2 bg-primary hover:bg-primary/90 text-white rounded-lg h-9 px-0 shadow-md shadow-primary/10 transition-all hover:scale-[1.02] active:scale-95"
                >
                  <Pencil className="h-3 w-3" />
                  <span className="font-bold uppercase tracking-wider text-[9px]">Edit</span>
                </Button>
                <Button 
                  variant="outline" 
                  className="h-9 w-9 p-0 rounded-lg border-border/50 hover:bg-muted/50 transition-all"
                  onClick={() => setShowShareSheet(true)}
                >
                  <Share2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
                {!isFan && (
                  <Link to="/profile/availability" className="shrink-0">
                    <Button variant="outline" className="h-9 w-9 p-0 rounded-lg border-border/50 hover:bg-muted/50 transition-all">
                      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </Link>
                )}
                <Link to="/settings" className="shrink-0">
                  <Button variant="outline" className="h-9 w-9 p-0 rounded-lg border-border/50 hover:bg-muted/50 transition-all">
                    <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </Link>
              </div>
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
          <div className={`relative w-full ${isFan ? 'mb-2' : 'mb-8'}`}>
            <div className="relative group">
              {/* Fade indicators for scrolling */}
              <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />

              <div
                className={`flex overflow-x-auto gap-3 pb-2 w-full no-scrollbar select-none ${isFan ? 'justify-center' : ''}`}
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  WebkitOverflowScrolling: 'touch'
                }}
              >
                <TabsList className="flex h-auto bg-transparent gap-2.5 px-4 py-2 min-w-max">
                  {(isFan ? ['saved'] : isStudio ? ['posts', 'portfolio', 'projects', 'announcements', 'analytics', 'saved', 'credits', 'skills', 'experience'] : ['posts', 'portfolio', 'projects', 'announcements', 'analytics', 'saved', 'credits', 'skills', 'experience']).map((tab) => (
                    <TabsTrigger
                      key={tab}
                      value={tab}
                      className="flex items-center gap-2 px-5 py-2.5 md:px-7 md:py-3 rounded-2xl text-xs md:text-sm font-bold whitespace-nowrap transition-all duration-300 border-2 shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-[0_8px_20px_-6px_rgba(var(--primary),0.5)] data-[state=active]:scale-105 bg-card/40 border-border/40 text-muted-foreground hover:bg-card/60 hover:text-foreground hover:border-border/80 capitalize"
                    >
                      {tab}
                    </TabsTrigger>
                  ))}
                </TabsList>
                {/* Spacer to allow scrolling past the last item - only for non-fan accounts */}
                {!isFan && <div className="w-10 shrink-0 md:hidden" />}
              </div>
            </div>
          </div>

          <TabsContent value="saved" className={isFan ? "py-2" : "py-8"}><SavedPosts /></TabsContent>
          {!isFan && (
            <>
              <TabsContent value="posts" className="py-8"><UserPosts targetUserId={user.id} /></TabsContent>
              <TabsContent value="portfolio" className="py-8">
                <PortfolioGrid userId={user.id} isOwner={true} />
              </TabsContent>
              <TabsContent value="projects" className="py-8"><UserProjects userId={user.id} /></TabsContent>
              <TabsContent value="announcements" className="py-8"><UserAnnouncements /></TabsContent>
              <TabsContent value="analytics" className="py-8">
                <Suspense fallback={<div className="h-48 flex items-center justify-center text-muted-foreground font-medium">Loading Analytics...</div>}>
                  <RealTimeAnalytics />
                </Suspense>
              </TabsContent>
              <TabsContent value="credits" className="py-8"><VerifiedCredits userId={user.id} /></TabsContent>
              <TabsContent value="skills" className="py-8"><Skills userId={user.id} isOwner={true} /></TabsContent>
              <TabsContent value="experience" className="py-8"><Experience userId={user.id} isOwner={true} /></TabsContent>
            </>
          )}
        </Tabs>
      </div>
      <UniversalShareSheet
        isOpen={showShareSheet}
        onOpenChange={setShowShareSheet}
        shareType="profile"
        shareId={profile.username || profile.id}
        shareData={{ 
          name: profile.full_name || profile.username,
          username: profile.username,
          id: profile.id,
          avatar: profile.avatar_url,
          craft: profile.craft
        }}
      />
      {user && (
        <NetworkListDialog
          isOpen={isNetworkDialogOpen}
          onClose={() => setIsNetworkDialogOpen(false)}
          userId={user.id}
          initialTab={activeNetworkTab}
        />
      )}
    </div>
  );
};

export default ProfilePage;
