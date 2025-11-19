import { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useToast } from '@/hooks/use-toast';
import { 
  MapPin, 
  Globe, 
  Briefcase, 
  MessageCircle, 
  UserPlus, 
  UserCheck,
  Clock,
  ArrowLeft
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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const userId = searchParams.get('user');
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
        .eq('id', userId)
        .single();

      if (error || !data) throw error || new Error('Profile not found');
      setProfile(data);
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
        .from('user_connections')
        .select('id, status, follower_id')
        .or(`and(follower_id.eq.${user.id},following_id.eq.${userId}),and(follower_id.eq.${userId},following_id.eq.${user.id})`)
        .single();

      if (data) {
        setConnectionId(data.id);
        if (data.status === 'accepted') {
          setConnectionStatus('connected');
        } else if (data.follower_id === user.id) {
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
      const { error } = await supabase.from('user_connections').insert({ follower_id: user.id, following_id: userId, status: 'pending' });
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
      const { error } = await supabase.from('user_connections').delete().eq('id', connectionId);
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
          <Button asChild variant="outline"><Link to="/network"><ArrowLeft className="mr-2 h-4 w-4" />Back to Network</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-16 md:py-24">
        <Link to="/network" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6"><ArrowLeft className="mr-2 h-4 w-4" />Back to Network</Link>

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
                  {profile.location && <span className="flex items-center"><MapPin className="mr-1.5 h-4 w-4"/>{profile.location}</span>}
                  {profile.website && <a href={profile.website} target="_blank" rel="noopener noreferrer" className="flex items-center hover:text-primary"><Globe className="mr-1.5 h-4 w-4"/>{profile.website}</a>}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t">
              {profile.bio && <p className="text-center md:text-left">{profile.bio}</p>}
              
              {profile.skills && profile.skills.length > 0 && (
                  <div className="mt-4">
                      <h3 className="font-semibold mb-2 text-center md:text-left">Skills</h3>
                      <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                          {profile.skills.map(skill => <Badge key={skill} variant="secondary">{skill}</Badge>)}
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
