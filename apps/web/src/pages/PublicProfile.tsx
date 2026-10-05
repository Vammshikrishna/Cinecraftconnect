import { fetchProfileExtras, mergeProfileExtras } from '@/lib/profileExtras';
import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { useAuth } from '@/contexts/AuthContext';
import { canCreatePitchCall, canSubmitPitch } from '@/hooks/usePitch';
import { supabase } from '@/integrations/supabase/client';

import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import {
  MapPin,
  Globe,
  MessageCircle,
  UserPlus,
  UserCheck,
  Clock,
  Instagram,
  Linkedin,
  Twitter,
  Facebook,
  Youtube,
  Star,
  Building2,
  Zap,
  Flag,
  Briefcase,
  Share2,
  CalendarDays,
} from 'lucide-react';
import { UniversalShareSheet } from '@/components/common/UniversalShareSheet';
import { NetworkListDialog } from '@/components/profile/NetworkListDialog';
import ReportDialog from '@/components/common/ReportDialog';
import BlockUserButton from '@/components/common/BlockUserButton';
import VerificationBadge from '@/components/common/VerificationBadge';
import { PortfolioGrid } from '@/components/portfolio/PortfolioGrid';
import { UserProjects } from '@/components/profile/UserProjects';
import { UserPosts } from '@/components/profile/UserPosts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { VerifiedCredits } from '@/components/profile/VerifiedCredits';
import Skills from '@/components/profile/Skills';
import Experience from '@/components/profile/Experience';
import { formatURL } from '@/lib/utils';
import { useAccountType } from '@/hooks/useAccountType';
import { useRecordView } from '@/hooks/useRecordView';
import { useAppRole } from '@/hooks/useAppRole';
import { Pencil } from 'lucide-react';
import SEO from '@/components/common/SEO';
import { getOptimizedImage } from '@/utils/image-optimization';
import { useCachedImage } from '@/hooks/useCachedImage';
import { BackButton } from '@/components/common/BackButton';
import { ConnectNoteDialog } from '@/components/network/ConnectNoteDialog';
import { IntroductionDialog } from '@/components/network/IntroductionDialog';
import { ProfileHighlights, useProfileHighlights } from '@/components/profile/ProfileHighlights';
import { AwardsSection } from '@/components/profile/AwardsSection';
import { useBlockedUsers } from '@/hooks/useBlockedUsers';
import { ProfileContextStrip } from '@/components/profile/ProfileContextStrip';
import { RequestDatesDialog, InviteToProjectDialog, RecommendDialog, AddToShortlistDialog } from '@/components/profile/CollaborationDialogs';
import { RecommendationsSection } from '@/components/profile/RecommendationsSection';
import { AvailabilityBadge } from '@/components/network/AvailabilityBadge';

interface Profile {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string;
  bio: string;
  craft: string;
  location: string;
  website: string;
  skills: string[];
  cover_image_url?: string;
  instagram_url?: string;
  youtube_url?: string;
  is_verified?: boolean;
  account_type?: string;
  social_links?: {
    instagram?: string;
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    youtube?: string;
  };
}

const PublicProfile = () => {
  const { userId } = useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  useRecordView(profile?.id);

  // availability: the database only returns it when this person lets me see it
  useEffect(() => {
    if (!profile?.id) return;
    (supabase as any).rpc('get_profile_availability', { p_user: profile.id })
      .then(({ data }: any) => setAvailability(data || null));
  }, [profile?.id]);
  const { push } = useAppNavigation();
  const { user, profile: myProfile } = useAuth();
  const { isFan } = useAccountType();
  const { isAdmin, isInternal } = useAppRole();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'pending_sent' | 'pending_received' | 'connected'>('none');
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(false);
  const [availability, setAvailability] = useState<any>(null);
  // what the viewer may see: ok | private | unavailable | blocked_by_me | self | not_found
  const [access, setAccess] = useState<any>(null);
  const { unblock } = useBlockedUsers();
  const [searchParams, setSearchParams] = useSearchParams();
  const [canMessage, setCanMessage] = useState(false);
  const [workDialog, setWorkDialog] = useState<null | 'dates' | 'invite' | 'recommend' | 'shortlist'>(null);
  const [recKey, setRecKey] = useState(0);

  useEffect(() => {
    if (!profile?.id || !user) { setCanMessage(false); return; }
    (supabase as any).rpc('can_message_user', { p_user: profile.id }).then(({ data }: any) => setCanMessage(!!data));
  }, [profile?.id, user?.id]);
  const { highlights } = useProfileHighlights(profile?.id);
  const [postCount, setPostCount] = useState<number>(0);
  const [connectionsCount, setConnectionsCount] = useState<number>(0);
  const [followersCount, setFollowersCount] = useState<number>(0);
  const [followingCount, setFollowingCount] = useState<number>(0);
  const [isMutualFollow, setIsMutualFollow] = useState(false);
  
  // Network Dialog state
  const [isNetworkDialogOpen, setIsNetworkDialogOpen] = useState(false);
  const [activeNetworkTab, setActiveNetworkTab] = useState<'followers' | 'following' | 'connections'>('followers');

  const [isReportOpen, setIsReportOpen] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);

  const coverUrl = profile?.cover_image_url ? getOptimizedImage(profile.cover_image_url, { height: 400 }) : '';
  const cachedCover = useCachedImage(coverUrl);
  const avatarUrl = profile?.avatar_url ? getOptimizedImage(profile.avatar_url, { width: 400, height: 400 }) : '';
  const cachedAvatar = useCachedImage(avatarUrl);

  useEffect(() => {
    if (userId) {
      if (user && userId === user.id) {
        push('/profile', { noScroll: true });
        return;
      }
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [userId, user?.id, push]);

  const fetchProfile = async () => {
    setLoading(true);
    setAccess(null);
    try {
      let identifier = (userId || '').trim();
      // Strip leading '@' if present
      if (identifier.startsWith('@')) {
        identifier = identifier.substring(1);
      }
      
      if (!identifier || identifier.toLowerCase() === 'undefined' || identifier.toLowerCase() === 'null') {
        console.warn('Blocked fetch for invalid identifier:', identifier);
        setLoading(false);
        return;
      }

      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier) || 
                    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
      
      
      let data: any = null;
      let error: any = null;

      // An id or an exact username (resolved on the server). Display names are not used any more.
      let resolvedId: string | null = isUUID ? identifier : null;
      if (!resolvedId) {
        const { data: rid } = await (supabase as any).rpc('resolve_profile_id', { p_identifier: identifier });
        resolvedId = rid || null;
      }
      if (resolvedId) {
        const { data: acc } = await (supabase as any).rpc('get_profile_access', { p_user: resolvedId });
        setAccess(acc || null);
        if (acc?.state === 'self') {
          push('/profile', { noScroll: true });
          return;
        }
        if (acc?.state === 'unavailable' || acc?.state === 'not_found') {
          setProfile(null);
          return;
        }
      }
      if (resolvedId) {
        const res = await supabase.from('profiles').select('id, updated_at, username, full_name, avatar_url, cover_image_url, website, bio, location, experience, craft, account_type, accept_direct_pitches, onboarding_completed, is_internal, public_key, is_verified, is_banned, trust_score, is_official_team').eq('id', resolvedId).maybeSingle();
        data = res.data;
        error = res.error;
      }

      if (error || !data) {
        console.warn('Profile resolution failed:', { identifier, error: error?.message });
        throw error || new Error('Profile not found or is restricted');
      }
      
      // Check if this is the user's own profile (resolved by username)
      if (user && data.id === user.id) {
        push('/profile', { noScroll: true });
        return;
      }

      // Cast data to Profile type, ensuring skills is treated as string[]
      let extras = null;
      try { extras = await fetchProfileExtras(data.id); } catch { /* hidden or absent */ }
      setProfile(mergeProfileExtras({ ...data, skills: (data as any).skills || [] } as any, extras) as unknown as Profile);

      // Now fetch connection status and other counts with the resolved UUID
      fetchConnectionStatus(data.id);
      
      // real counts from the server (the old code downloaded every follow row, which the API caps at 1,000)
      const { data: counts } = await (supabase as any).rpc('get_profile_counts', { p_user: data.id });
      if (counts) {
        setConnectionsCount(Number(counts.connections || 0));
        setFollowersCount(Number(counts.followers || 0));
        setFollowingCount(Number(counts.following || 0));
        setPostCount(Number(counts.posts || 0));
      }

    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({ title: 'Error', description: 'Failed to load profile', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchConnectionStatus = async (resolvedId: string, currentProfileData?: any) => {
    if (!user || !resolvedId) return;

    // Use currentProfileData if passed, fallback to state
    const isFollowRelationship = isFan || (currentProfileData ? currentProfileData.account_type === 'fan' : profile?.account_type === 'fan');

    try {
      const { data: rel } = await (supabase as any).rpc('get_relationship', { p_user: resolvedId });
      if (!rel) {
        setConnectionId(null);
        setConnectionStatus('none');
        return;
      }
      if (isFollowRelationship) {
        setConnectionId(rel.follow_id || null);
        setConnectionStatus(rel.following ? 'connected' : 'none');
        setIsMutualFollow(!!(rel.following && rel.followed_by));
        return;
      }
      setConnectionId(rel.connection_id || null);
      setConnectionStatus(rel.connection_status || 'none');
    } catch (error) {
      console.error('Error fetching connection status:', error);
      setConnectionStatus('none');
    }
  };

  const handleConnect = async () => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Redirecting to sign in page...',
        variant: 'destructive'
      });
      push(`/auth?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (!profile?.id) return;
    const isFollowRelationship = isFan || profile.account_type === 'fan';
    
    try {
      if (isFollowRelationship) {
        const { error } = await supabase.from('user_follows' as any).insert({ 
          follower_id: user.id, 
          following_id: profile.id
        });
        toast({ title: 'Success', description: 'You are now following' });
        setFollowersCount(prev => prev + 1);
      } else {
        const { error } = await supabase.from('user_connections').insert({ 
          follower_id: user.id, 
          following_id: profile.id, 
          status: 'pending' 
        });
        if (error) throw error;
        toast({ title: 'Success', description: 'Connection request sent' });
      }
      fetchConnectionStatus(profile.id);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to send request', variant: 'destructive' });
    }
  };

  // Connect (non-fan): send the request, optionally with a short note
  const sendConnectionWithNote = async (note?: string) => {
    if (!user || !profile?.id) return;
    try {
      const { error } = await (supabase as any).from('user_connections').insert({
        follower_id: user.id,
        following_id: profile.id,
        status: 'pending',
        note: note || null,
      });
      if (error) throw error;
      toast({ title: 'Success', description: 'Connection request sent' });
      fetchConnectionStatus(profile.id);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to send request', variant: 'destructive' });
    }
  };

  const handleCancelRequest = async () => {
    if (!connectionId) return;
    const isFollowRelationship = isFan || profile?.account_type === 'fan';
    
    try {
      if (isFollowRelationship) {
        const { error } = await supabase.from('user_follows' as any).delete().eq('id', connectionId);
        toast({ title: 'Success', description: 'Unfollowed successfully' });
        setFollowersCount(prev => Math.max(0, prev - 1));
      } else {
        const { error } = await supabase.from('user_connections').delete().eq('id', connectionId);
        if (error) throw error;
        toast({ title: 'Success', description: 'Connection request cancelled' });
      }
      setConnectionStatus('none');
      setConnectionId(null);
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to cancel', variant: 'destructive' });
    }
  };


  if (loading) return <div className="flex h-screen items-center justify-center"><LoadingSpinner size="lg" /></div>;

  if (!profile) {
    return (
      <div className="flex h-screen items-center justify-center text-center">
        <div>
          <h2 className="text-2xl font-bold mb-2">{access?.state === 'unavailable' ? 'This profile is unavailable' : 'Profile Not Found'}</h2>
          <p className="text-muted-foreground mb-4 max-w-sm mx-auto">{access?.state === 'unavailable' ? 'It may have been removed or is not visible to you.' : 'The link may be mistyped, or the person changed their username.'}</p>
          <Button variant="outline" className="mb-3" onClick={() => push('/network')}>Find people in the Network</Button>
          <BackButton />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background text-foreground min-h-screen flex justify-center pt-20 pb-40 relative overflow-hidden">
      <SEO 
        title={profile ? `${profile.full_name || profile.username} | ${profile.craft || 'Creator'}` : 'Professional Profile'} 
        description={profile?.bio || `View the professional portfolio and credits of ${profile?.full_name || 'this creator'} on CineCraft Connect.`} 
      />
      {/* Background ambient effects */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[100px] pointer-events-none opacity-50" />

      <div className="w-full max-w-4xl px-4 md:px-8 relative z-10">
        <div className="flex items-center justify-between gap-3 mb-6">
          <BackButton className="mb-0" />

          {/* Availability, Share, Flag buttons aligned to the right corner */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap ml-auto">
            {profile.account_type !== 'fan' && (
              <Button 
                variant="outline"
                className="h-9 px-3.5 border-primary/20 bg-card/70 backdrop-blur-md hover:bg-primary/10 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm text-foreground"
                onClick={() => push(`/profile/availability/${profile.id}`)}
              >
                <CalendarDays className="h-4 w-4 text-primary" />
                <span>Availability</span>
              </Button>
            )}

            {user && (
              <Button 
                variant="outline" 
                size="icon" 
                className="h-9 w-9 rounded-full border-border/60 bg-card/70 backdrop-blur-md hover:bg-primary/10 hover:text-primary flex items-center justify-center shrink-0 shadow-sm" 
                onClick={() => setShowShareSheet(true)}
                title="Share Profile"
              >
                <Share2 className="h-4 w-4" />
              </Button>
            )}

            {user && (
              <Button 
                variant="outline" 
                size="icon" 
                className="h-9 w-9 rounded-full border-border/60 bg-card/70 backdrop-blur-md hover:bg-rose-500/10 hover:text-rose-500 flex items-center justify-center shrink-0 shadow-sm" 
                onClick={() => setIsReportOpen(true)}
                title="Report Profile"
              >
                <Flag className="h-4 w-4" />
              </Button>
            )}
            {profile && <BlockUserButton targetId={profile.id} targetName={profile.full_name || profile.username || undefined} />}
          </div>
        </div>

        <header className="glass-card mb-10 relative overflow-hidden group">
          {/* Cover Photo - Balanced height */}
          <div className="relative w-full h-[clamp(120px,20vh,220px)] overflow-hidden">
            {profile.cover_image_url ? (
              <img loading="lazy" decoding="async" 
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
            {/* Main Content Row: 2 Zones on Desktop (Avatar & Info) */}
            <div className="flex flex-col lg:flex-row items-center lg:items-center gap-6 lg:gap-10 -mt-[clamp(60px,11vw,90px)]">
              
              {/* Zone 1: Avatar + Professional Tags */}
              <div className="shrink-0 flex flex-col items-center gap-3">
                <div className="relative group/avatar">
                  <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-700" />
                  <Avatar className="w-[clamp(130px,22vw,180px)] h-[clamp(130px,22vw,180px)] border-[5px] border-background shadow-xl relative z-10">
                    <AvatarImage 
                      src={cachedAvatar} 
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
              <div className="flex-1 flex flex-col items-center lg:items-start min-w-0 lg:pt-24 w-full">
                <div className="flex flex-col items-center lg:items-start gap-3 w-full">
                  <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
                    {profile.account_type === 'fan' ? (
                      <div className="font-mono text-[10px] uppercase tracking-widest font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                        TYPE // FAN
                      </div>
                    ) : (
                      <div className="font-mono text-[10px] uppercase tracking-widest font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded">
                        TYPE // {profile.account_type === 'studio' ? 'STUDIO' : 'PRO'}
                      </div>
                    )}

                    <AvailabilityBadge status={availability?.status} />
                    {profile.craft && (
                      <div className="font-mono text-[10px] uppercase tracking-widest font-bold text-muted-foreground bg-muted/10 border border-border/40 px-2 py-0.5 rounded">
                        CRAFT // {profile.craft}
                      </div>
                    )}
                    {profile.location && (
                      <div className="font-mono text-[10px] uppercase tracking-widest font-bold text-muted-foreground bg-muted/10 border border-border/40 px-2 py-0.5 rounded">
                        LOC // {profile.location}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-center lg:items-start leading-tight w-full">
                    <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl font-bold text-foreground tracking-tight text-center lg:text-left">
                      <span className="inline-block">
                        {profile.full_name || profile.username}
                        {profile.is_verified && (
                          <VerificationBadge size="sm" className="ml-1.5 align-middle" />
                        )}
                      </span>
                    </h1>
                    <p className="font-mono text-primary font-bold text-[11px] uppercase tracking-widest mt-0.5">
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
                      <a href={formatURL((profile.social_links?.instagram || profile.instagram_url) as string)} target="_blank" rel="noopener noreferrer">
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
                    {profile.social_links?.facebook && (
                      <a href={formatURL(profile.social_links.facebook)} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:text-blue-500 hover:bg-blue-500/10 transition-colors">
                          <Facebook size={16} />
                        </Button>
                      </a>
                    )}
                    {((profile.social_links?.youtube || profile.youtube_url) as string) && (
                      <a href={formatURL((profile.social_links?.youtube || profile.youtube_url) as string)} target="_blank" rel="noopener noreferrer">
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
                {profile.account_type !== 'fan' && (
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
                    setActiveNetworkTab(profile.account_type === 'fan' ? 'following' : 'connections');
                    setIsNetworkDialogOpen(true);
                  }}
                >
                  <span className="text-xl md:text-2xl font-black text-foreground">{profile.account_type === 'fan' ? followingCount : connectionsCount}</span>
                  <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-black opacity-60">
                    {profile.account_type === 'fan' ? 'Following' : 'Connections'}
                  </span>
                </div>
              </div>

              {/* Actions - Beside stats */}
              <div className="flex items-center justify-center md:justify-end gap-1.5 w-full md:w-auto">
                {!isInternal && access?.state !== 'blocked_by_me' ? (
                  <>
                    {(isFan || profile.account_type === 'fan') ? (
                      <>
                        {connectionStatus === 'connected' ? (
                          <Button onClick={handleCancelRequest} variant="outline" className="h-8 px-3 md:px-4 border-primary/20 bg-background/50 backdrop-blur-sm hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/50 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center justify-center"><UserCheck className="mr-1 h-3 w-3" />Following</Button>
                        ) : (
                          <Button onClick={handleConnect} className="h-8 px-3 md:px-4 bg-primary text-white hover:bg-primary/90 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center justify-center"><UserPlus className="mr-1 h-3 w-3" />Follow</Button>
                        )}
                        {(isFan && profile.account_type === 'fan' && isMutualFollow) && (
                          <Button 
                            className="h-8 px-3 md:px-4 bg-secondary text-white hover:bg-secondary/80 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center justify-center"
                            onClick={() => push(`/messages/${profile.id}`)}
                          >
                            <MessageCircle className="mr-1 h-3 w-3" />Message
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        {connectionStatus === 'connected' ? (
                          <Button disabled variant="outline" className="h-8 px-3 md:px-4 border-primary/20 bg-background/50 backdrop-blur-sm rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center justify-center"><UserCheck className="mr-1 h-3 w-3" />Connected</Button>
                        ) : connectionStatus === 'pending_sent' ? (
                          <Button onClick={handleCancelRequest} variant="outline" className="h-8 px-3 md:px-4 border-primary/20 bg-background/50 backdrop-blur-sm text-yellow-500 hover:text-yellow-600 hover:bg-yellow-500/10 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center justify-center"><Clock className="mr-1 h-3 w-3" />Request Sent</Button>
                        ) : (
                          <Button onClick={() => (user ? setNoteOpen(true) : handleConnect())} className="h-8 px-3 md:px-4 bg-primary text-white hover:bg-primary/90 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center justify-center"><UserPlus className="mr-1 h-3 w-3" />Connect</Button>
                        )}
                        {profile.account_type !== 'fan' && (
                          <Button asChild variant="outline" className="h-8 px-3 md:px-4 border-primary/20 bg-background/50 backdrop-blur-sm rounded-full text-[9px] font-bold uppercase tracking-wider"><a href={`/crew-sheet/${profile.username || profile.id}`} target="_blank" rel="noopener noreferrer">Crew sheet</a></Button>
                        )}
                        {user && connectionStatus === 'none' && (
                          <Button onClick={() => setIntroOpen(true)} variant="outline" className="h-8 px-3 md:px-4 border-primary/20 bg-background/50 backdrop-blur-sm rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center justify-center">Ask for introduction</Button>
                        )}
                        {(connectionStatus === 'connected' || canMessage) && (
                          <Button 
                            className="h-8 px-3 md:px-4 bg-secondary text-white hover:bg-secondary/80 rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center justify-center"
                            onClick={() => push(`/messages/${profile.id}`)}
                          >
                            <MessageCircle className="mr-1 h-3 w-3" />Message
                          </Button>
                        )}
                        {profile && (profile as any).accept_direct_pitches !== false && canSubmitPitch((myProfile as any)?.craft || '', (myProfile as any)?.account_type || '') && canCreatePitchCall(profile.craft || '', profile.account_type || '') && (
                          <Button 
                            className="h-8 px-3 md:px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-full text-[9px] font-bold uppercase tracking-wider flex items-center justify-center gap-1 shrink-0"
                            onClick={() => push(`/pitch/direct/submit?to=${profile.id}`)}
                          >
                            <Zap className="h-3 w-3" /> Direct Pitch
                          </Button>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <div className="bg-muted/30 border border-border/50 px-3 py-1 rounded-full text-[9px] text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-1.5 flex-1 md:flex-none justify-center">
                    <Zap className="w-3 h-3" /> Observation Mode
                  </div>
                )}
                
                {isAdmin && (
                  <Button
                    variant="outline"
                    className="h-8 w-8 p-0 border-primary/20 hover:bg-primary/10 hover:text-primary rounded-full flex items-center justify-center shrink-0"
                    onClick={() => push(`/admin/users?id=${profile.id}`)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </header>

        {access && access.state !== 'blocked_by_me' && (
          <ProfileContextStrip userId={profile.id} showContext={!!user && access.state !== 'self'} />
        )}

        {user && !isFan && !isInternal && profile.account_type !== 'fan' && access && (access.state === 'ok' || access.state === 'private') && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setWorkDialog('dates')}>Request dates</Button>
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setWorkDialog('invite')}>Invite to project</Button>
            {connectionStatus === 'connected' && <Button size="sm" variant="outline" className="rounded-full" onClick={() => setWorkDialog('recommend')}>Recommend</Button>}
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => setWorkDialog('shortlist')}>Shortlist</Button>
          </div>
        )}

        {access?.state === 'blocked_by_me' && (
          <div className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-5 text-center space-y-3">
            <p className="font-bold">You blocked {profile.full_name || profile.username}</p>
            <p className="text-sm text-muted-foreground">They cannot message you or send you requests. Unblock them to see their work and connect again.</p>
            <Button variant="outline" onClick={async () => {
              const { error } = await unblock(profile.id);
              if (error) toast({ title: 'Could not unblock', description: (error as any).message, variant: 'destructive' });
              else { toast({ title: 'User unblocked' }); fetchProfile(); }
            }}>Unblock</Button>
          </div>
        )}
        {access?.state === 'private' && (
          <div className="mt-6 rounded-2xl border bg-card/40 p-8 text-center space-y-1">
            <p className="font-bold text-lg">This profile is private</p>
            <p className="text-sm text-muted-foreground">
              {access.visibility === 'connections' ? 'Connect with ' + (profile.full_name || profile.username) + ' to see their work, skills and credits.' : (profile.full_name || profile.username) + ' keeps their work private.'}
            </p>
          </div>
        )}

        {profile.account_type !== 'fan' && access?.state !== 'blocked_by_me' && access?.state !== 'private' && <div className="mt-6"><ProfileHighlights highlights={highlights} isOwn={false} /></div>}

        {access?.state === 'blocked_by_me' || access?.state === 'private' ? null : profile.account_type !== 'fan' ? (
          <div className={isFan ? "mt-4" : "mt-8"}>
            <Tabs defaultValue={(() => { const t = searchParams.get('tab'); const all = ['posts', 'portfolio', 'projects', 'credits', 'skills', 'experience', 'awards', 'recommendations']; if (t && all.includes(t) && !highlights.hidden_sections.includes(t)) return t; return (all.find(t => !highlights.hidden_sections.includes(t) || user?.id === profile.id)) || 'posts'; })()} onValueChange={(v) => setSearchParams({ tab: v }, { replace: true })} key={highlights.hidden_sections.join(',')} className="w-full">
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
                      {(isFan ? ['posts'] : ['posts', 'portfolio', 'projects', 'credits', 'skills', 'experience', 'awards', 'recommendations'].filter(t => !highlights.hidden_sections.includes(t) || user?.id === profile.id)).map((tab) => (
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

              <TabsContent value="posts" className={isFan ? "py-2" : "py-6"}>
                <UserPosts targetUserId={profile.id} isOwner={user?.id === profile.id} />
              </TabsContent>
              <TabsContent value="portfolio" className="py-6">
                <PortfolioGrid userId={profile.id} isOwner={false} />
              </TabsContent>
              <TabsContent value="projects" className="py-6">
                <UserProjects userId={profile.id} />
              </TabsContent>
              <TabsContent value="credits" className="py-6">
                <VerifiedCredits userId={profile.id} />
              </TabsContent>
              <TabsContent value="skills" className="py-6">
                <Skills userId={profile.id} isOwner={false} />
              </TabsContent>
              <TabsContent value="experience" className="py-6">
                <Experience userId={profile.id} isOwner={false} />
              </TabsContent>
              <TabsContent value="awards" className="py-6">
                <AwardsSection userId={profile.id} isOwner={false} />
              </TabsContent>
              <TabsContent value="recommendations" className="py-6">
                <RecommendationsSection key={recKey} userId={profile.id} isOwner={false} />
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="mt-8 text-center p-8 glass-card border border-border/50 text-muted-foreground">
            <Star className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">Fan Account</h2>
            <p>This user is a Cinecraft Fan. Fans support creators by watching, liking, and participating in discussions.</p>
          </div>
        )}
      </div>
      {profile && (
        <ReportDialog
          open={isReportOpen}
          onOpenChange={setIsReportOpen}
          targetType="user"
          targetId={profile.id}
        />
      )}
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
      <NetworkListDialog
        isOpen={isNetworkDialogOpen}
        onClose={() => setIsNetworkDialogOpen(false)}
        userId={profile.id}
        initialTab={activeNetworkTab}
      />
      {profile && (
        <>
          <RequestDatesDialog open={workDialog === 'dates'} onOpenChange={(o) => !o && setWorkDialog(null)} targetId={profile.id} targetName={profile.full_name || profile.username || 'this person'} />
          <InviteToProjectDialog open={workDialog === 'invite'} onOpenChange={(o) => !o && setWorkDialog(null)} targetId={profile.id} targetName={profile.full_name || profile.username || 'this person'} />
          <RecommendDialog open={workDialog === 'recommend'} onOpenChange={(o) => !o && setWorkDialog(null)} targetId={profile.id} targetName={profile.full_name || profile.username || 'this person'} onDone={() => setRecKey(k => k + 1)} />
          <AddToShortlistDialog open={workDialog === 'shortlist'} onOpenChange={(o) => !o && setWorkDialog(null)} targetId={profile.id} targetName={profile.full_name || profile.username || 'this person'} />
        </>
      )}
      <IntroductionDialog open={introOpen} onOpenChange={setIntroOpen} targetId={profile.id} targetName={profile.full_name || profile.username || 'this person'} />
      <ConnectNoteDialog
        open={noteOpen}
        onOpenChange={setNoteOpen}
        name={profile.full_name || profile.username || 'this person'}
        onSend={sendConnectionWithNote}
      />
    </div>
  );
};

export default PublicProfile;
