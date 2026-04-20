import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
  Star,
} from 'lucide-react';
import { PortfolioGrid } from '@/components/portfolio/PortfolioGrid';
import { UserProjects } from '@/components/profile/UserProjects';
import { UserPosts } from '@/components/profile/UserPosts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatURL } from '@/lib/utils';
import { useAccountType } from '@/hooks/useAccountType';
import { useRecordView } from '@/hooks/useRecordView';

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
  account_type?: string;
  social_links?: {
    instagram?: string;
    linkedin?: string;
    twitter?: string;
    facebook?: string;
  };
}

const PublicProfile = () => {
  const { userId } = useParams();
  useRecordView(userId);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isFan } = useAccountType();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'pending_sent' | 'pending_received' | 'connected'>('none');
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [postCount, setPostCount] = useState(0);
  const [connectionsCount, setConnectionsCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);

  useEffect(() => {
    if (userId) {
      if (user && userId === user.id) {
        navigate('/profile');
        return;
      }
      fetchProfile();
      fetchConnectionStatus();
    } else {
      setLoading(false);
    }
  }, [userId, user, navigate]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId || '')
        .single();

      if (error || !data) throw error || new Error('Profile not found');
      // Cast data to Profile type, ensuring skills is treated as string[]
      setProfile({ ...data, skills: [] } as unknown as Profile);

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

  const fetchConnectionStatus = async () => {
    if (!user || !userId) return;

    try {
      // Check for sent request
      const { data: sentData } = await supabase
        .from('user_connections' as any)
        .select('id, status, follower_id')
        .eq('follower_id', user.id)
        .eq('following_id', userId)
        .maybeSingle();

      // Check for received request
      const { data: receivedData } = await supabase
        .from('user_connections' as any)
        .select('id, status, follower_id')
        .eq('follower_id', userId)
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
    if (!user || !userId) return;
    try {
      const { error } = await supabase.from('user_connections' as any).insert({ 
        follower_id: user.id, 
        following_id: userId, 
        status: isFan ? 'accepted' : 'pending' 
      });
      if (error) throw error;
      toast({ title: 'Success', description: isFan ? 'You are now following' : 'Connection request sent' });
      fetchConnectionStatus();
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

        <header className="glass-card mb-8 relative overflow-hidden group pb-8">
          {/* Cover Photo */}
          <div className="h-32 md:h-48 w-full relative overflow-hidden">
            {profile.cover_image_url ? (
              <img src={profile.cover_image_url} alt="Cover" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 via-primary/5 to-secondary/10" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
          </div>

          <div className="relative z-10 flex flex-col items-center text-center gap-4 -mt-16">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary to-secondary rounded-full blur opacity-75 group-hover:opacity-100 transition duration-500"></div>
              <Avatar className="w-32 h-32 border-4 border-background relative shadow-2xl">
                <AvatarImage src={profile.avatar_url || ''} alt={profile.username || 'User'} className="object-cover" />
                <AvatarFallback className="bg-muted text-4xl font-bold text-muted-foreground">
                  {profile.username?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="flex flex-col gap-2 items-center max-w-2xl px-4">
              {profile.account_type === 'fan' && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-500 rounded-full text-xs font-semibold mb-2">
                  <Star size={14} className="fill-amber-500" />
                  <span>Fan Account</span>
                </div>
              )}
              <h1 className="text-3xl md:text-4xl font-bold text-gradient">
                {profile.full_name || profile.username}
              </h1>

              {profile.bio && (
                <p className="text-muted-foreground text-sm md:text-base max-w-prose leading-relaxed mt-2 whitespace-pre-wrap">
                  {profile.bio}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-center gap-4 mt-4 text-sm text-muted-foreground">
                {profile.craft && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                    {profile.craft}
                  </Badge>
                )}
                {profile.location && (
                  <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/10 border border-secondary/20">
                    <MapPin size={14} />
                    {profile.location}
                  </span>
                )}
                {profile.website && (
                  <a href={formatURL(profile.website)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-primary transition-colors px-3 py-1 rounded-full bg-secondary/10 border border-secondary/20">
                    <Globe size={14} />
                    <span>{profile.website.replace(/^(https?|ftp):\/\//, '')}</span>
                  </a>
                )}
              </div>

              <div className="flex items-center justify-center gap-3 mt-4">
                {(profile.social_links?.instagram || profile.instagram_url) && (
                  <a href={formatURL((profile.social_links?.instagram || profile.instagram_url) as string)} target="_blank" rel="noopener noreferrer">
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

                {profile.youtube_url && (
                  <a href={formatURL(profile.youtube_url)} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:text-red-500 hover:bg-red-500/10 transition-all hover:scale-110">
                      <div className="flex items-center justify-center w-4 h-4 bg-current rounded-full">
                        <div className="w-0 h-0 border-t-[2px] border-t-transparent border-l-[4px] border-l-background border-b-[2px] border-b-transparent ml-0.5"></div>
                      </div>
                    </Button>
                  </a>
                )}
              </div>

              {profile.skills && profile.skills.length > 0 && (
                <div className="mt-4">
                  <div className="flex flex-wrap gap-2 justify-center">
                    {profile.skills.map((skill: string) => <Badge key={skill} variant="secondary" className="bg-secondary/20">{skill}</Badge>)}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 sm:gap-6 mt-6 py-4 border-t border-border/50 w-full justify-center flex-wrap">
                {profile.account_type !== 'fan' && (
                  <>
                    <div className="flex flex-col items-center px-2 sm:px-4">
                      <span className="text-2xl font-bold text-foreground">{postCount}</span>
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Posts</span>
                    </div>
                    <div className="hidden sm:block w-px h-8 bg-border/50" />
                  </>
                )}
                
                <div className="flex flex-col items-center px-2 sm:px-4">
                  <span className="text-2xl font-bold text-foreground">{followersCount}</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Followers</span>
                </div>
                
                {profile.account_type === 'fan' && (
                  <>
                    <div className="w-px h-8 bg-border/50" />
                    
                    <div className="flex flex-col items-center px-2 sm:px-4">
                      <span className="text-2xl font-bold text-foreground">{followingCount}</span>
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Following</span>
                    </div>
                  </>
                )}

                {profile.account_type !== 'fan' && (
                  <>
                    <div className="hidden sm:block w-px h-8 bg-border/50" />
                    <div className="flex flex-col items-center px-2 sm:px-4">
                      <span className="text-2xl font-bold text-foreground">{connectionsCount}</span>
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Connections</span>
                    </div>
                  </>
                )}
              </div>

              {isFan ? (
                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md mt-6">
                  {connectionStatus === 'connected' ? (
                    <Button onClick={handleCancelRequest} variant="outline" className="flex-1 border-primary/20 bg-background/50 backdrop-blur-sm hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/50"><UserCheck className="mr-2 h-4 w-4" />Following</Button>
                  ) : (
                    <Button onClick={handleConnect} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"><UserPlus className="mr-2 h-4 w-4" />Follow</Button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md mt-6">
                  {connectionStatus === 'connected' ? (
                    <Button disabled variant="outline" className="flex-1 border-primary/20 bg-background/50 backdrop-blur-sm"><UserCheck className="mr-2 h-4 w-4" />Connected</Button>
                  ) : connectionStatus === 'pending_sent' ? (
                    <Button onClick={handleCancelRequest} variant="outline" className="flex-1 border-primary/20 bg-background/50 backdrop-blur-sm text-yellow-500 hover:text-yellow-600 hover:bg-yellow-500/10"><Clock className="mr-2 h-4 w-4" />Request Sent</Button>
                  ) : (
                    <Button onClick={handleConnect} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"><UserPlus className="mr-2 h-4 w-4" />Connect</Button>
                  )}
                  {connectionStatus === 'connected' && (
                    <Button asChild className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/80">
                      <Link to={`/messages/${profile.id}`} className="flex items-center justify-center"><MessageCircle className="mr-2 h-4 w-4" />Message</Link>
                    </Button>
                  )}
                </div>
              )}
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
    </div>
  );
};

export default PublicProfile;
