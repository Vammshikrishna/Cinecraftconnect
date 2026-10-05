import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAppRole } from '@/hooks/useAppRole';
import { 
  Users, 
  Lock, 
  Globe, 
  MessageSquare,
  Calendar,
  ShieldAlert,
  ArrowLeft,
  UserPlus,
  Share2
} from 'lucide-react';
import { BackButton } from '@/components/common/BackButton';
import { UniversalShareSheet } from '@/components/common/UniversalShareSheet';
import SEO from '@/components/common/SEO';

interface DiscussionRoom {
  id: string;
  title: string;
  description: string | null;
  room_type: 'public' | 'private' | 'secret';
  category_id: string;
  creator_id: string;
  member_count: number;
  created_at: string;
  room_categories?: { name: string } | null;
}

const DiscussionRoomDetailPage = () => {
  const { roomId } = useParams();
  const { push } = useAppNavigation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { isInternal, loading: roleLoading } = useAppRole();
  
  const [room, setRoom] = useState<DiscussionRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMember, setIsMember] = useState(false);
  const [requestStatus, setRequestStatus] = useState<'none' | 'pending' | 'loading'>('loading');
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (roomId && !roleLoading) {
      fetchRoomDetails();
    }
  }, [roomId, user, isInternal, roleLoading]);

  const fetchRoomDetails = async () => {
    setLoading(true);
    try {
      // 1. Fetch room details
      const { data, error } = await supabase
        .from('discussion_rooms')
        .select('*, room_categories(name)')
        .eq('id', roomId || '')
        .maybeSingle();

      if (error) throw error;
      
      if (!data) {
        setRoom(null);
        setLoading(false);
        return;
      }

      setRoom(data as any);

      // 2. If logged in, check membership & join request status
      if (user && roomId) {
        const [memberRes, requestRes] = await Promise.all([
          supabase
            .from('room_members')
            .select('role')
            .eq('room_id', roomId)
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('room_join_requests')
            .select('status')
            .eq('room_id', roomId)
            .eq('user_id', user.id)
            .maybeSingle()
        ]);

        const isOwner = user.id === data.creator_id;
        const isPublicRoom = data.room_type === 'public';
        const memberData = !!memberRes.data || isOwner || isInternal;
        setIsMember(memberData);

        // Auto-redirect if already a member/creator/staff, or if it is a public room
        if (memberData || isPublicRoom) {
          push(`/discussion-rooms/${roomId}/chat`, { noScroll: true });
          return;
        }

        if (requestRes.data) {
          setRequestStatus('pending');
        } else {
          setRequestStatus('none');
        }
      } else {
        setIsMember(false);
        setRequestStatus('none');
      }
    } catch (error) {
      console.error('Error fetching room details:', error);
      toast({ title: 'Error', description: 'Failed to load discussion room details', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleJoinOrCreateRequest = async () => {
    if (!user) {
      toast({
        title: 'Sign in required',
        description: 'Redirecting to sign in page...',
        variant: 'destructive'
      });
      push(`/auth?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }

    if (!room) return;

    if (room.room_type === 'public') {
      // For public rooms, auto-enroll user when they click "Enter Discussion"
      // This is handled automatically by the Chat Interface, so just push to chat
      push(`/discussion-rooms/${room.id}/chat`);
      return;
    }

    if (isInternal) {
      push(`/discussion-rooms/${room.id}/chat`);
      return;
    }

    // Otherwise, it's a private room and we need to submit a join request
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('room_join_requests')
        .insert({
          room_id: room.id,
          user_id: user.id,
          status: 'pending'
        });

      if (error) throw error;

      setRequestStatus('pending');
      toast({
        title: "Request Sent",
        description: "Your request to join this private room has been sent to the admin.",
      });
    } catch (err: any) {
      console.error('Error sending join request:', err);
      toast({
        title: "Request Failed",
        description: err.message || "Could not submit join request.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-background"><LoadingSpinner size="lg" /></div>;

  if (!room) {
    return (
      <div className="flex h-screen items-center justify-center flex-col gap-4 bg-background">
        <h2 className="text-2xl font-bold">Discussion Room Not Found</h2>
        <Button onClick={() => push('/discussion-rooms', { noScroll: true })}>View All Rooms</Button>
      </div>
    );
  }

  // Extra gate: secret or private rooms should not show details to anonymous visitors
  const isPrivate = room.room_type !== 'public';

  return (
    <div className="min-h-screen bg-background pt-24 pb-40">
      <SEO 
        title={`${room.title} - Discussion Room`}
        description={room.description || "Join this discussion room on CineCraft Connect."}
      />
      <div className="max-w-4xl mx-auto px-4 md:px-8">
        <BackButton className="mb-6" to="/discussion-rooms" />

        <div className="glass-card p-6 md:p-10 space-y-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="capitalize px-4 py-1 text-sm font-medium">
                  {room.room_categories?.name || 'General'}
                </Badge>
                <Badge variant={isPrivate ? "destructive" : "default"} className="capitalize px-4 py-1 text-sm font-medium flex items-center gap-1">
                  {isPrivate ? <Lock size={12} /> : <Globe size={12} />}
                  {room.room_type} Room
                </Badge>
              </div>
              <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-gradient leading-tight">
                {room.title}
              </h1>
            </div>
            
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="icon" className="rounded-xl border-border/50" onClick={() => setShowShareSheet(true)}>
                <Share2 className="h-4 w-4" />
              </Button>
              {isMember ? (
                <Button 
                  className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                  onClick={() => push(`/discussion-rooms/${room.id}/chat`)}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Enter Chat
                </Button>
              ) : isPrivate && requestStatus === 'pending' ? (
                <Button disabled variant="outline" className="rounded-xl border-border/50">
                  Request Pending
                </Button>
              ) : (
                <Button 
                  className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
                  disabled={isSubmitting}
                  onClick={handleJoinOrCreateRequest}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  {isPrivate ? 'Request to Join' : 'Enter Discussion'}
                </Button>
              )}
            </div>
          </div>

          <Separator className="bg-border/50" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <section className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-primary" />
                  About the Discussion Room
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {room.description || 'No description provided.'}
                </p>
              </section>
            </div>

            <div className="glass-card p-6 space-y-6 border-primary/10">
              <h3 className="text-lg font-semibold border-b border-border/50 pb-2">Room Stats</h3>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <span>{room.member_count} Members participating</span>
                </div>

                <div className="flex items-center gap-3 text-muted-foreground">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  <span>
                    Created {new Date(room.created_at).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <UniversalShareSheet
        isOpen={showShareSheet}
        onOpenChange={setShowShareSheet}
        shareType="room"
        shareId={room.id}
        shareData={{
          roomId: room.id,
          title: room.title,
          category: room.room_categories?.name,
          memberCount: room.member_count,
          roomType: room.room_type,
          isActive: false
        }}
      />
    </div>
  );
};

export default DiscussionRoomDetailPage;
