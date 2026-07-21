import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
} from 'lucide-react';
import { UniversalShareSheet } from '@/components/common/UniversalShareSheet';
import { NetworkListDialog } from '@/components/profile/NetworkListDialog';
import ReportDialog from '@/components/common/ReportDialog';
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
  const { push } = useAppNavigation();
  const { user } = useAuth();
  const { isFan } = useAccountType();
  const { isAdmin, isInternal } = useAppRole();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'pending_sent' | 'pending_received' | 'connected'>('none');
  const [connectionId, setConnectionId] = useState<string | null>(null);
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
  }, [userId, user, push]);

  const fetchProfile = async () => {
    setLoading(true);
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
      
      console.log('Fetching profile for:', { identifier, isUUID });
      
      let data: any = null;
      let error: any = null;

      // Step 1: Try UUID lookup if applicable
      if (isUUID) {
        console.log('Attempting UUID lookup for:', identifier);
        const res = await supabase.from('profiles').select('id, updated_at, username, full_name, avatar_url, cover_image_url, website, bio, location, experience, craft, instagram_url, youtube_url, account_type, onboarding_completed, is_internal, public_key, social_links, is_verified, is_banned, trust_score, phone, push_token, shadow_banned_at, is_shadowbanned, is_official_team, force_password_reset, restriction_flags').eq('id', identifier).maybeSingle();
        data = res.data;
        error = res.error;
      }

      // Step 2: Try Username lookup
      if (!data && !error) {
        console.log('Attempting Username lookup for:', identifier);
        const res = await supabase.from('profiles').select('id, updated_at, username, full_name, avatar_url, cover_image_url, website, bio, location, experience, craft, instagram_url, youtube_url, account_type, onboarding_completed, is_internal, public_key, social_links, is_verified, is_banned, trust_score, phone, push_token, shadow_banned_at, is_shadowbanned, is_official_team, force_password_reset, restriction_flags').ilike('username', identifier).maybeSingle();
        data = res.data;
        error = res.error;
      }

      // Step 3: Try Full Name lookup (Last resort for manual links/legacy data)
      if (!data && !error && !isUUID && identifier.length > 3) {
        console.log('Attempting Full Name lookup for:', identifier);
        const res = await supabase.from('profiles').select('id, updated_at, username, full_name, avatar_url, cover_image_url, website, bio, location, experience, craft, instagram_url, youtube_url, account_type, onboarding_completed, is_internal, public_key, social_links, is_verified, is_banned, trust_score, phone, push_token, shadow_banned_at, is_shadowbanned, is_official_team, force_password_reset, restriction_flags').ilike('full_name', identifier).maybeSingle();
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
      setProfile({ ...data, skills: (data as any).skills || [] } as unknown as Profile);

      // Now fetch connection status and other counts with the resolved UUID
      fetchConnectionStatus(data.id);
      
      // 1. Fetch raw connection data
      const { data: rawConnections, error: connError } = await supabase
        .from('user_connections')
        .select('*')
        .or(`follower_id.eq.${data.id},following_id.eq.${data.id}`)
        .eq('status', 'accepted');

      const { data: rawFollows, error: followsError } = await supabase
        .from('user_follows' as any)
        .select('*')
        .or(`follower_id.eq.${data.id},following_id.eq.${data.id}`);

      console.log('Connections data:', rawConnections, 'error:', connError);
      console.log('Follows data:', rawFollows, 'error:', followsError);

      if (rawConnections && !connError && rawFollows && !followsError) {
        const c_count = rawConnections.length;
        const f_count = (rawFollows as any[]).filter(c => c.following_id === data.id).length;
        const following_c = (rawFollows as any[]).filter(c => c.follower_id === data.id).length + rawConnections.filter(c => c.follower_id === data.id).length;

        setConnectionsCount(c_count);
        setFollowersCount(f_count);
        setFollowingCount(following_c);
      }

      // Fetch posts count separately
      const { count: pCount } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('author_id', data.id);
      
      setPostCount(pCount || 0);

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
      if (isFollowRelationship) {
        const { data: followData } = await supabase
          .from('user_follows' as any)
          .select('id')
          .eq('follower_id', user.id)
          .eq('following_id', resolvedId)
          .maybeSingle();
        
        if (followData) {
          setConnectionId((followData as any).id);
          setConnectionStatus('connected');
        } else {
          setConnectionId(null);
          setConnectionStatus('none');
        }

        const { data: reverseFollowData } = await supabase
          .from('user_follows' as any)
          .select('id')
          .eq('follower_id', resolvedId)
          .eq('following_id', user.id)
          .maybeSingle();
        
        setIsMutualFollow(!!(followData && reverseFollowData));

        return;
      }

      // Check for sent request
      const { data: sentData } = await supabase
        .from('user_connections' as any)
        .select('id, status, follower_id')
        .eq('follower_id', user.id)
        .eq('following_id', resolvedId)
        .maybeSingle();

      // Check for received request
      const { data: receivedData } = await supabase
        .from('user_connections' as any)
        .select('id, status, follower_id')
        .eq('follower_id', resolvedId)
        .eq('following_id', user.id)
        .maybeSingle();

      const connectionData = (sentData || receivedData) as any;

      if (connectionData) {
        setConnectionId(connectionData.id);
        if (connectionData.status === 'accepted') {
          setConnectionStatus('connected');
        } else if (connectionData.follower_id === user.id) {
          setConnectionStatus('pending_sent');
        } else {
          setConnectionStatus('pending_received');
        }
      } else {
        setConnectionId(null);
        setConnectionStatus('none');
      }
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
          <h2 className="text-2xl font-bold mb-4">Profile Not Found</h2>
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
        <BackButton className="mb-6" />

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
              <div className="flex items-center gap-3">
                {!isInternal ? (
                  <>
                    {(isFan || profile.account_type === 'fan') ? (
                      <div className="flex items-center gap-2">
                        {connectionStatus === 'connected' ? (
                          <Button onClick={handleCancelRequest} variant="outline" className="h-9 w-[110px] border-primary/20 bg-background/50 backdrop-blur-sm hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/50 rounded-lg text-[10px] font-bold uppercase tracking-wider"><UserCheck className="mr-2 h-3 w-3" />Following</Button>
                        ) : (
                          <Button onClick={handleConnect} className="h-9 w-[110px] bg-primary text-white hover:bg-primary/90 rounded-lg text-[10px] font-bold uppercase tracking-wider"><UserPlus className="mr-2 h-3 w-3" />Follow</Button>
                        )}
                        {(isFan && profile.account_type === 'fan' && isMutualFollow) && (
                          <Button 
                            className="h-9 w-[110px] bg-secondary text-white hover:bg-secondary/80 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                            onClick={() => push(`/messages/${profile.id}`)}
                          >
                            <MessageCircle className="mr-2 h-3 w-3" />Message
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {connectionStatus === 'connected' ? (
                          <Button disabled variant="outline" className="h-9 w-[110px] border-primary/20 bg-background/50 backdrop-blur-sm rounded-lg text-[10px] font-bold uppercase tracking-wider"><UserCheck className="mr-2 h-3 w-3" />Connected</Button>
                        ) : connectionStatus === 'pending_sent' ? (
                          <Button onClick={handleCancelRequest} variant="outline" className="h-9 w-[120px] border-primary/20 bg-background/50 backdrop-blur-sm text-yellow-500 hover:text-yellow-600 hover:bg-yellow-500/10 rounded-lg text-[10px] font-bold uppercase tracking-wider"><Clock className="mr-2 h-3 w-3" />Request Sent</Button>
                        ) : (
                          <Button onClick={handleConnect} className="h-9 w-[110px] bg-primary text-white hover:bg-primary/90 rounded-lg text-[10px] font-bold uppercase tracking-wider"><UserPlus className="mr-2 h-3 w-3" />Connect</Button>
                        )}
                        {connectionStatus === 'connected' && (
                          <Button 
                            className="h-9 w-[110px] bg-secondary text-white hover:bg-secondary/80 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                            onClick={() => push(`/messages/${profile.id}`)}
                          >
                            <MessageCircle className="mr-2 h-3 w-3" />Message
                          </Button>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="bg-muted/30 border border-border/50 px-4 py-1.5 rounded-lg text-[10px] text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-2">
                    <Zap className="w-3 h-3" /> Observation Mode
                  </div>
                )}
                
                {isAdmin && (
                  <Button
                    variant="outline"
                    className="h-9 w-9 p-0 border-primary/20 hover:bg-primary/10 hover:text-primary rounded-lg"
                    onClick={() => push(`/admin/users?id=${profile.id}`)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                
                {user && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 rounded-full hover:bg-primary/10 hover:text-primary" 
                    onClick={() => setShowShareSheet(true)}
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                )}
                
                {user && (
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-rose-500/10 hover:text-rose-500" onClick={() => setIsReportOpen(true)}>
                    <Flag className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </header>

        {profile.account_type !== 'fan' ? (
          <div className={isFan ? "mt-4" : "mt-8"}>
            <Tabs defaultValue="posts" className="w-full">
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
                      {(isFan ? ['posts'] : ['posts', 'portfolio', 'projects', 'credits', 'skills', 'experience']).map((tab) => (
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
    </div>
  );
};

export default PublicProfile;
