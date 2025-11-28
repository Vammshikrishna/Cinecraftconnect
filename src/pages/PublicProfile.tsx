import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
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
} from 'lucide-react';
import { PortfolioGrid } from '@/components/portfolio/PortfolioGrid';
import { UserProjects } from '@/components/profile/UserProjects';
import { UserPosts } from '@/components/profile/UserPosts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
}

const PublicProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'pending_sent' | 'pending_received' | 'connected'>('none');
  const [connectionId, setConnectionId] = useState<string | null>(null);

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
      const { data } = await supabase
        .from('user_connections' as any)
        .select('id, status, follower_id')
        .or(`and(follower_id.eq.${user.id},following_id.eq.${userId}),and(follower_id.eq.${userId},following_id.eq.${user.id})`)
        .single();

      const connectionData = data as any;

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
        setConnectionStatus('none');
      }
    } catch (error) {
      setConnectionStatus('none');
    }
  };

  const handleConnect = async () => {
    if (!user || !userId) return;
    try {
      const { error } = await supabase.from('user_connections' as any).insert({ follower_id: user.id, following_id: userId, status: 'pending' });
      if (error) throw error;
      toast({ title: 'Success', description: 'Connection request sent' });
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
      toast({ title: 'Success', description: 'Connection request cancelled' });
      setConnectionStatus('none');
      setConnectionId(null);
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to cancel request', variant: 'destructive' });
    }
  };

  const getInitials = (name: string) => name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

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
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 pt-16 pb-24 md:py-24">
        <button onClick={() => navigate(-1)} className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6 hover:underline bg-transparent border-0 p-0 cursor-pointer"><ArrowLeft className="mr-2 h-4 w-4" />Go Back</button>

        <Card>
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <Avatar className="h-28 w-28 md:h-36 md:w-36 border-4 border-primary/20">
                <AvatarImage src={profile.avatar_url} />
                <AvatarFallback className="text-4xl">{getInitials(profile.full_name || profile.username)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-3xl font-bold">{profile.full_name || profile.username}</h1>
                <p className="text-muted-foreground">@{profile.username}</p>
                {profile.craft && <Badge className="mt-2">{profile.craft}</Badge>}

                <div className="flex flex-wrap gap-4 mt-4 text-sm text-muted-foreground justify-center md:justify-start">
                  {profile.location && <span className="flex items-center"><MapPin className="mr-1.5 h-4 w-4" />{profile.location}</span>}
                  {profile.website && <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center hover:text-primary"><Globe className="mr-1.5 h-4 w-4" />{profile.website}</a>}
                </div>

                {(profile as any).social_links && (
                  <div className="flex items-center justify-center md:justify-start gap-4 mt-4">
                    {(profile as any).social_links.instagram && (
                      <a href={(profile as any).social_links.instagram} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-pink-500 transition-colors">
                        <Instagram size={20} />
                      </a>
                    )}
                    {(profile as any).social_links.linkedin && (
                      <a href={(profile as any).social_links.linkedin} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-blue-500 transition-colors">
                        <Linkedin size={20} />
                      </a>
                    )}
                    {(profile as any).social_links.twitter && (
                      <a href={(profile as any).social_links.twitter} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-blue-400 transition-colors">
                        <Twitter size={20} />
                      </a>
                    )}
                    {(profile as any).social_links.facebook && (
                      <a href={(profile as any).social_links.facebook} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-blue-600 transition-colors">
                        <Facebook size={20} />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-6 border-t">
              {profile.bio && <p className="text-center md:text-left">{profile.bio}</p>}

              {profile.skills && profile.skills.length > 0 && (
                <div className="mt-4">
                  <h3 className="font-semibold mb-2 text-center md:text-left">Skills</h3>
                  <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                    {profile.skills.map((skill: string) => <Badge key={skill} variant="secondary">{skill}</Badge>)}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 pt-6 border-t flex flex-col sm:flex-row gap-3">
              {connectionStatus === 'connected' ? (
                <Button disabled variant="outline" className="flex-1"><UserCheck className="mr-2 h-4 w-4" />Connected</Button>
              ) : connectionStatus === 'pending_sent' ? (
                <Button onClick={handleCancelRequest} variant="outline" className="flex-1"><Clock className="mr-2 h-4 w-4" />Request Sent</Button>
              ) : (
                <Button onClick={handleConnect} className="flex-1"><UserPlus className="mr-2 h-4 w-4" />Connect</Button>
              )}
              <Button asChild className="flex-1">
                <Link to={`/dm/${profile.id}`}><MessageCircle className="mr-2 h-4 w-4" />Message</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8">
          <Tabs defaultValue="portfolio" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-muted/50">
              <TabsTrigger value="portfolio">Portfolio</TabsTrigger>
              <TabsTrigger value="projects">Projects</TabsTrigger>
              <TabsTrigger value="posts">Posts</TabsTrigger>
            </TabsList>
            <TabsContent value="portfolio" className="py-6">
              <PortfolioGrid userId={profile.id} isOwner={false} />
            </TabsContent>
            <TabsContent value="projects" className="py-6">
              <UserProjects userId={profile.id} />
            </TabsContent>
            <TabsContent value="posts" className="py-6">
              <UserPosts targetUserId={profile.id} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default PublicProfile;
