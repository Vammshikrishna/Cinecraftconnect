import { fetchProfileExtras, mergeProfileExtras } from '@/lib/profileExtras';
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
import { ShareIcon } from '@/components/icons/ShareIcon';

const RealTimeAnalytics = lazy(() => import('@/components/profile/RealTimeAnalytics').then(m => ({ default: m.RealTimeAnalytics })));
import { SavedPosts } from '@/components/profile/SavedPosts';
import EditProfileForm from '@/components/profile/EditProfileForm';
import { ProfileHighlights, ProfileHighlightsDialog, useProfileHighlights } from '@/components/profile/ProfileHighlights';
import { ProfileCompleteness } from '@/components/profile/ProfileCompleteness';
import { AwardsSection } from '@/components/profile/AwardsSection';
import { RecommendationsSection } from '@/components/profile/RecommendationsSection';
import { formatURL } from '@/lib/utils';
import { getOptimizedImage } from '@/utils/image-optimization';
import { useCachedImage } from '@/hooks/useCachedImage';
import { resolveProfileTab, FAN_PROFILE_TABS, CREATOR_PROFILE_TABS } from './profileTabs';
import { Briefcase, Globe, Settings, Pencil, Instagram, Linkedin, Twitter, Youtube, Building2, Zap, CalendarDays, ChevronDown, UserCheck } from 'lucide-react';
import { UniversalShareSheet } from '@/components/common/UniversalShareSheet';
import { AccountSwitcherSheet } from '@/components/profile/AccountSwitcherSheet';
import VerificationBadge from '@/components/common/VerificationBadge';

import { useAccountType } from '@/hooks/useAccountType';
import { EnhancedSkeleton } from '@/components/ui/enhanced-skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star } from 'lucide-react';
import SEO from '@/components/common/SEO';
import { ProfileHero } from '@/components/profile/ProfileHero';
import { ProfileDetailsCard } from '@/components/profile/ProfileDetailsCard';
import { LoadError } from '@/components/settings/LoadError';
import { ProfileSkeleton } from '@/components/profile/ProfileSkeleton';

const ProfilePage = () => {
  const { user } = useAuth();
  const { isFan, isStudio } = useAccountType();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');

  const [requestedTab, setActiveTab] = useState(tabParam || (isFan ? "saved" : "posts"));
  const activeTab = resolveProfileTab(requestedTab, isFan);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [highlightsOpen, setHighlightsOpen] = useState(false);
  const [completenessKey, setCompletenessKey] = useState(0);
  // my availability, as other people see it (shown in "At a glance")
  const [myAvailability, setMyAvailability] = useState<any>(null);
  useEffect(() => {
    if (!user || (profile as any)?.account_type === 'fan') return;
    (supabase as any).rpc('get_profile_availability', { p_user: user.id }).then(({ data }: any) => setMyAvailability(data || null));
  }, [user?.id, (profile as any)?.account_type, completenessKey]);
  const { highlights, reload: reloadHighlights } = useProfileHighlights(user?.id);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [isAccountSwitcherOpen, setIsAccountSwitcherOpen] = useState(false);

  const [postCount, setPostCount] = useState(0);
  const [connectionsCount, setConnectionsCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  
  // Network Dialog state
  const [isNetworkDialogOpen, setIsNetworkDialogOpen] = useState(false);
  const [activeNetworkTab, setActiveNetworkTab] = useState<'followers' | 'following' | 'connections'>('followers');

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
          .select('id, updated_at, username, full_name, avatar_url, website, bio, location, experience, craft, account_type, accept_direct_pitches, onboarding_completed, is_internal, public_key, is_verified, is_banned, trust_score, is_official_team')
          .eq('id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') throw error;
        if (profileData) {
          let extras = null;
          try { extras = await fetchProfileExtras(user.id); } catch { /* optional */ }
          setProfile(mergeProfileExtras(profileData as any, extras));
        }

        // Hide initial skeleton once layout is ready
        setLoading(false);

        // Fetch non-blocking counts after header is ready
        fetchCounts();
      } catch (error) {
        setLoadFailed(true);
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
  }, [user, fetchCounts, reloadKey]);

  const handleProfileUpdate = (updatedProfile: Profile) => {
    setProfile(updatedProfile);
    setIsEditing(false);
  };

  if (loading) {
    return (
      <div className="bg-background min-h-dvh flex justify-center pt-20 pb-40">
        <div className="w-full max-w-[1400px] px-4 md:px-8">
          <ProfileSkeleton />
        </div>
      </div>
    );
  }

  if (!profile || !user) {
    return (
      <div className="text-foreground bg-background min-h-dvh flex flex-col items-center justify-center gap-4 px-4">
        <LoadError
          title={loadFailed ? 'Could not load your profile' : 'Profile not found'}
          message={loadFailed ? 'Check your connection and try again.' : 'We could not find your profile.'}
          onRetry={() => { setLoadFailed(false); setLoading(true); setReloadKey((k) => k + 1); }}
        />
        <Button variant="outline" asChild><Link to="/feed">Go to feed</Link></Button>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="bg-background text-foreground min-h-dvh flex justify-center py-12 pt-20 pb-24 relative overflow-hidden">
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
    <div className="bg-background text-foreground min-h-dvh flex justify-center pt-20 pb-40 relative overflow-hidden">
      <SEO 
        title="My Profile" 
        description="Manage your professional entertainment portfolio, connect with peers, and showcase your creative work on CineCraft Connect." 
      />
      {/* Background ambient effects */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] pointer-events-none opacity-50" />

      <div className="w-full max-w-[1400px] px-4 md:px-8 relative z-10">
        <div className="mb-10">
          <ProfileHero
            profile={profile as any}
            avatarSrc={cachedAvatar || ''}
            handle={
              <button type="button" onClick={() => setIsAccountSwitcherOpen(true)} className="inline-flex items-center gap-1.5 hover:opacity-85 focus:outline-none" title="Switch Account">
                <span>@{profile.username}</span>
                <ChevronDown size={16} />
              </button>
            }
            stats={[
              ...(!isFan ? [{ label: 'Posts', value: postCount }] : []),
              { label: 'Followers', value: followersCount, onClick: () => { setActiveNetworkTab('followers'); setIsNetworkDialogOpen(true); } },
              { label: isFan ? 'Following' : 'Connections', value: isFan ? followingCount : connectionsCount, onClick: () => { setActiveNetworkTab(isFan ? 'following' : 'connections'); setIsNetworkDialogOpen(true); } },
            ]}
            aside={!isFan ? <ProfileDetailsCard availability={myAvailability} unions={(profile as any).union_membership} /> : null}
            actions={<>
                <Button
                  onClick={() => setIsEditing(true)}
                  title="Edit profile"
                  aria-label="Edit profile"
                  className="flex-none bg-primary hover:bg-primary/90 text-white rounded-lg h-11 w-11 md:h-9 md:w-9 p-0 shadow-md shadow-primary/10 transition hover:scale-[1.04] active:scale-95"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  className="h-11 w-11 md:h-9 md:w-9 p-0 rounded-lg border-border/50 hover:bg-muted/50 transition text-primary"
                  onClick={() => setIsAccountSwitcherOpen(true)}
                  title="Switch Accounts"
                  aria-label="Switch Accounts"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                </Button>
                <Button aria-label="Share" 
                  variant="outline" 
                  className="h-11 w-11 md:h-9 md:w-9 p-0 rounded-lg border-border/50 hover:bg-muted/50 transition"
                  onClick={() => setShowShareSheet(true)}
                >
                  <ShareIcon className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
                {!isFan && (
                  <Link to="/profile/availability" className="shrink-0">
                    <Button aria-label="My availability calendar" variant="outline" className="h-11 w-11 md:h-9 md:w-9 p-0 rounded-lg border-border/50 hover:bg-muted/50 transition">
                      <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </Link>
                )}
                <Link to="/settings" className="shrink-0">
                  <Button aria-label="Settings" variant="outline" className="h-11 w-11 md:h-9 md:w-9 p-0 rounded-lg border-border/50 hover:bg-muted/50 transition">
                    <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </Link>
            </>}
          />
        </div>

        {!isFan && (
          <div className="space-y-4 mb-8">
            <ProfileCompleteness
              refreshKey={completenessKey}
              onAction={(key) => {
                if (['avatar', 'cover', 'bio', 'craft', 'location', 'link'].includes(key)) setIsEditing(true);
                else if (key === 'showreel') setHighlightsOpen(true);
                else if (key === 'availability') setIsEditing(true); // availability is part of Edit profile now
                else { setActiveTab(key); setSearchParams({ tab: key }, { replace: true }); }
              }}
            />
            <ProfileHighlights highlights={highlights} isOwn onEdit={() => setHighlightsOpen(true)} />
          </div>
        )}

        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            setActiveTab(value);
            setSearchParams({ tab: value }, { replace: true });
          }}
          className="w-full"
        >
          <div className={`relative w-full ${isFan ? 'mb-2' : 'mb-8'}`}>
            <div className="relative group">
              {/* Fade indicators for scrolling */}
              <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity" />

              <div
                className={`flex overflow-x-auto gap-3 pb-2 w-full no-scrollbar select-none ${isFan ? 'justify-center' : ''}`}
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  WebkitOverflowScrolling: 'touch'
                }}
              >
                <TabsList className="flex h-auto bg-transparent gap-2.5 px-4 py-2 min-w-max">
                  {(isFan ? FAN_PROFILE_TABS : CREATOR_PROFILE_TABS).map((tab) => (
                    <TabsTrigger
                      key={tab}
                      value={tab}
                      className="flex items-center gap-2 px-5 py-2.5 md:px-7 md:py-3 rounded-2xl font-serif font-semibold capitalize tracking-tight text-[13px] md:text-[13px] whitespace-nowrap transition-[background-color,color,border-color] duration-200 border-2 shrink-0 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:border-primary data-[state=active]:shadow-[0_8px_20px_-6px_hsl(var(--primary)/0.5)] bg-card/40 border-border/40 text-muted-foreground hover:bg-card/60 hover:text-foreground hover:border-border/80"
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
              <TabsContent value="posts" className="py-8"><UserPosts targetUserId={user.id} isOwner={true} /></TabsContent>
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
              <TabsContent value="credits" className="py-8"><VerifiedCredits userId={user.id} isOwn /></TabsContent>
              <TabsContent value="skills" className="py-8"><Skills userId={user.id} isOwner={true} /></TabsContent>
              <TabsContent value="experience" className="py-8"><Experience userId={user.id} isOwner={true} /></TabsContent>
              <TabsContent value="awards" className="py-8"><AwardsSection userId={user.id} isOwner /></TabsContent>
              <TabsContent value="recommendations" className="py-8"><RecommendationsSection userId={user.id} isOwner /></TabsContent>
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
      <AccountSwitcherSheet
        isOpen={isAccountSwitcherOpen}
        onOpenChange={setIsAccountSwitcherOpen}
      />
      {user && <ProfileHighlightsDialog open={highlightsOpen} onOpenChange={setHighlightsOpen} userId={user.id} current={highlights} onSaved={() => { reloadHighlights(); setCompletenessKey(k => k + 1); }} />}
    </div>
  );
};

export default ProfilePage;
