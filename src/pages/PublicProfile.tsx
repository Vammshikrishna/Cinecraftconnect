import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
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
  ArrowLeft,
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
} from 'lucide-react';
import ReportDialog from '@/components/common/ReportDialog';
import VerificationBadge from '@/components/common/VerificationBadge';
import { PortfolioGrid } from '@/components/portfolio/PortfolioGrid';
import { UserProjects } from '@/components/profile/UserProjects';
import { UserPosts } from '@/components/profile/UserPosts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatURL } from '@/lib/utils';
import { useAccountType } from '@/hooks/useAccountType';
import { useRecordView } from '@/hooks/useRecordView';
import { useAppRole } from '@/hooks/useAppRole';
import { Pencil } from 'lucide-react';
import SEO from '@/components/common/SEO';
import { getOptimizedImage } from '@/utils/image-optimization';

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
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isFan } = useAccountType();
  const { isAdmin, isInternal } = useAppRole();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'pending_sent' | 'pending_received' | 'connected'>('none');
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [postCount, setPostCount] = useState(0);
  const [connectionsCount, setConnectionsCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [isReportOpen, setIsReportOpen] = useState(false);

  useEffect(() => {
    if (userId) {
      if (user && userId === user.id) {
        navigate('/profile');
        return;
      }
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [userId, user, navigate]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      // Determine if userId is a UUID or a username
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId || '');
      
      let query = supabase.from('profiles').select('*');
      
      if (isUUID) {
        query = query.eq('id', userId || '');
      } else {
        query = query.eq('username', userId || '');
      }

      const { data, error } = await query.maybeSingle();

      if (error || !data) throw error || new Error('Profile not found');
      
      // Check if this is the user's own profile (resolved by username)
      if (user && data.id === user.id) {
        navigate('/profile');
        return;
      }

      // Cast data to Profile type, ensuring skills is treated as string[]
      setProfile({ ...data, skills: (data as any).skills || [] } as unknown as Profile);

      // Now fetch connection status and other counts with the resolved UUID
      fetchConnectionStatus(data.id);
      
      // 1. Fetch raw connection data for categorization
      const { data: rawConnections, error: connError } = await supabase
        .from('user_connections')
        .select('*')
        .or(`follower_id.eq.${data.id},following_id.eq.${data.id}`)
        .eq('status', 'accepted');

      if (rawConnections && !connError) {
        // Collect all unique user IDs involved in these connections
        const userIds = Array.from(new Set(rawConnections.flatMap(c => [c.follower_id, c.following_id])));
        
        // Fetch profiles for these users to check their account types
        const { data: relatedProfiles } = await supabase
          .from('profiles')
          .select('id, account_type')
          .in('id', userIds);

        const profilesMap = new Map(relatedProfiles?.map(p => [p.id, p]));

        // Categorize based on the platform's social model:
        // - Connections: Creator-to-Creator links
        // - Followers: Fans following this Creator
        const c_count = rawConnections.filter(c => {
          const otherId = c.follower_id === data.id ? c.following_id : c.follower_id;
          const otherProfile = profilesMap.get(otherId);
          return otherProfile?.account_type === 'creator' || !otherProfile?.account_type;
        }).length;

        const f_count = rawConnections.filter(c => {
          if (c.following_id !== data.id) return false;
          const followerProfile = profilesMap.get(c.follower_id);
          return followerProfile?.account_type === 'fan';
        }).length;

        const following_c = rawConnections.filter(c => c.follower_id === data.id).length;

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

  const fetchConnectionStatus = async (resolvedId: string) => {
    if (!user || !resolvedId) return;

    try {
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
    if (!user || !profile?.id) return;
    try {
      const { error } = await supabase.from('user_connections' as any).insert({ 
        follower_id: user.id, 
        following_id: profile.id, 
        status: isFan ? 'accepted' : 'pending' 
      });
      if (error) throw error;
      toast({ title: 'Success', description: isFan ? 'You are now following' : 'Connection request sent' });
      fetchConnectionStatus(profile.id);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to send request', variant: 'destructive' });
    }
  };

  const handleCancelRequest = async () => {
    if (!connectionId) return;
    try {
      const { error } = await supabase.from('user_connections' as any).delete().eq('id', connectionId);
      if (error) throw error;
      toast({ title: 'Success', description: isFan ? 'Unfollowed successfully' : 'Connection request cancelled' });
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
          <Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="mr-2 h-4 w-4" />Go Back</Button>
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
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6 pl-0 hover:bg-transparent hover:text-primary transition-colors flex items-center gap-2 group"
        >
          <div className="p-2 rounded-full group-hover:bg-primary/10 transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </div>
          <span>Go Back</span>
        </Button>

        <header className="glass-card mb-10 relative overflow-hidden group">
          {/* Cover Photo - Balanced height */}
          <div className="relative w-full h-[clamp(120px,20vh,220px)] overflow-hidden">
            {profile.cover_image_url ? (
              <img 
                src={getOptimizedImage(profile.cover_image_url, { height: 400 })} 
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
                      src={getOptimizedImage(profile.avatar_url, { width: 400, height: 400 })} 
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
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-full text-[9px] font-black uppercase tracking-wider">
                        <Star size={10} className="fill-amber-500" />
                        <span>Fan Account</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/20 text-[9px] font-black uppercase tracking-wider text-primary">
                        {profile.account_type === 'studio' ? <Building2 size={10} /> : <Zap size={10} className="fill-primary" />}
                        <span>{profile.account_type === 'studio' ? 'Studio' : 'Pro'}</span>
                      </div>
                    )}

                    {profile.craft && (
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted/30 border border-border/50 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                        <Briefcase size={10} />
                        <span>{profile.craft}</span>
                      </div>
                    )}
                    {profile.location && (
                      <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted/20 border border-border/30 text-[9px] font-medium text-muted-foreground">
                        <MapPin size={10} />
                        <span>{profile.location}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-center lg:items-start leading-tight w-full">
                    <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-foreground tracking-tight text-center lg:text-left">
                      <span className="inline-block">
                        {profile.full_name || profile.username}
                        {profile.is_verified && (
                          <VerificationBadge size="sm" className="ml-1.5 align-middle" />
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
                <div className="flex flex-col items-center lg:items-start">
                  <span className="text-xl md:text-2xl font-black text-foreground">{followersCount}</span>
                  <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-black opacity-60">Followers</span>
                </div>
                <div className="flex flex-col items-center lg:items-start">
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
                    {profile.account_type === 'fan' ? (
                      <div className="flex items-center gap-2">
                        {connectionStatus === 'connected' ? (
                          <Button onClick={handleCancelRequest} variant="outline" className="h-9 w-[110px] border-primary/20 bg-background/50 backdrop-blur-sm hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/50 rounded-lg text-[10px] font-bold uppercase tracking-wider"><UserCheck className="mr-2 h-3 w-3" />Following</Button>
                        ) : (
                          <Button onClick={handleConnect} className="h-9 w-[110px] bg-primary text-white hover:bg-primary/90 rounded-lg text-[10px] font-bold uppercase tracking-wider"><UserPlus className="mr-2 h-3 w-3" />Follow</Button>
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
                          <Button asChild className="h-9 w-[110px] bg-secondary text-white hover:bg-secondary/80 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                            <Link to={`/messages/${profile.id}`} className="flex items-center justify-center"><MessageCircle className="mr-2 h-3 w-3" />Message</Link>
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
                    onClick={() => navigate(`/admin/users?id=${profile.id}`)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
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
          <div className="mt-8">
            <Tabs defaultValue="posts" className="w-full">
              <TabsList className={`grid w-full bg-muted/50 ${isFan ? 'grid-cols-1 max-w-sm mx-auto' : 'grid-cols-3'}`}>
                <TabsTrigger value="posts">Posts</TabsTrigger>
                {!isFan && (
                  <>
                    <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
                    <TabsTrigger value="projects">Projects</TabsTrigger>
                  </>
                )}
              </TabsList>
              <TabsContent value="posts" className="py-6">
                <UserPosts targetUserId={profile.id} />
              </TabsContent>
              {!isFan && (
                <>
                  <TabsContent value="portfolio" className="py-6">
                    <PortfolioGrid userId={profile.id} isOwner={false} />
                  </TabsContent>
                  <TabsContent value="projects" className="py-6">
                    <UserProjects userId={profile.id} />
                  </TabsContent>
                </>
              )}
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
    </div>
  );
};

export default PublicProfile;
