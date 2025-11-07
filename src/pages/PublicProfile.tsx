import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
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

interface Profile {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string;
  bio: string;
  craft: string;
  location: string;
  website: string;
}

const PublicProfile = () => {
  const [searchParams] = useSearchParams();
  const profileId = searchParams.get('id');
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'pending_sent' | 'pending_received' | 'connected'>('none');
  const [connectionId, setConnectionId] = useState<string | null>(null);

  useEffect(() => {
    if (profileId) {
      fetchProfile();
      fetchConnectionStatus();
    }
  }, [profileId]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: 'Error',
        description: 'Failed to load profile',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchConnectionStatus = async () => {
    if (!user || !profileId) return;

    try {
      const { data } = await supabase
        .from('user_connections')
        .select('*')
        .or(`and(follower_id.eq.${user.id},following_id.eq.${profileId}),and(follower_id.eq.${profileId},following_id.eq.${user.id})`)
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
      }
    } catch (error) {
      // No connection found
    }
  };

  const handleConnect = async () => {
    if (!user || !profileId) return;

    try {
      const { error } = await supabase
        .from('user_connections')
        .insert({
          follower_id: user.id,
          following_id: profileId,
          status: 'pending',
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Connection request sent',
      });
      fetchConnectionStatus();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send connection request',
        variant: 'destructive',
      });
    }
  };

  const handleCancelRequest = async () => {
    if (!connectionId) return;

    try {
      const { error } = await supabase
        .from('user_connections')
        .delete()
        .eq('id', connectionId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Connection request cancelled',
      });
      setConnectionStatus('none');
      setConnectionId(null);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Failed to cancel request',
        variant: 'destructive',
      });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Profile not found</h2>
          <Link to="/network">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Network
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Redirect to own profile page if viewing own profile
  if (user && profile.id === user.id) {
    window.location.href = '/profile';
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-24 pb-16">
        <Link to="/network" className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Network
        </Link>

        {/* Profile Header */}
        <Card className="mb-8 border-border bg-card">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row gap-6">
              <Avatar className="h-32 w-32">
                <AvatarImage src={profile.avatar_url} />
                <AvatarFallback className="bg-primary/10 text-primary text-3xl">
                  {getInitials(profile.full_name || profile.username || 'U')}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
                  <div>
                    <h1 className="text-3xl font-bold text-foreground mb-1">
                      {profile.full_name || profile.username}
                    </h1>
                    {profile.username && profile.full_name && (
                      <p className="text-muted-foreground">@{profile.username}</p>
                    )}
                  </div>

                  <div className="flex gap-2 mt-4 md:mt-0">
                    {connectionStatus === 'connected' ? (
                      <>
                        <Button variant="outline" className="border-border">
                          <UserCheck className="mr-2 h-4 w-4" />
                          Connected
                        </Button>
                        <Button asChild>
                          <Link to={`/chats?user=${profile.id}`}>
                            <MessageCircle className="mr-2 h-4 w-4" />
                            Message
                          </Link>
                        </Button>
                      </>
                    ) : connectionStatus === 'pending_sent' ? (
                      <Button
                        variant="outline"
                        onClick={handleCancelRequest}
                        className="border-border"
                      >
                        <Clock className="mr-2 h-4 w-4" />
                        Pending
                      </Button>
                    ) : connectionStatus === 'pending_received' ? (
                      <Badge variant="secondary" className="px-4 py-2">
                        <Clock className="mr-2 h-4 w-4" />
                        Received Request
                      </Badge>
                    ) : (
                      <>
                        <Button onClick={handleConnect}>
                          <UserPlus className="mr-2 h-4 w-4" />
                          Connect
                        </Button>
                        <Button variant="outline" asChild className="border-border">
                          <Link to={`/chats?user=${profile.id}`}>
                            <MessageCircle className="mr-2 h-4 w-4" />
                            Message
                          </Link>
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {profile.craft && (
                  <Badge className="mb-3">{profile.craft}</Badge>
                )}

                {profile.bio && (
                  <p className="text-foreground mb-4">{profile.bio}</p>
                )}

                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {profile.location && (
                    <div className="flex items-center">
                      <MapPin className="mr-2 h-4 w-4" />
                      {profile.location}
                    </div>
                  )}
                  {profile.website && (
                    <div className="flex items-center">
                      <Globe className="mr-2 h-4 w-4" />
                      <a
                        href={profile.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-primary transition-colors"
                      >
                        {profile.website}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Portfolio Section */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Briefcase className="mr-2 h-5 w-5" />
              Portfolio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PortfolioGrid userId={profile.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PublicProfile;
