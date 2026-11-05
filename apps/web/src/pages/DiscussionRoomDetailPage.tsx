import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAppRole } from '@/hooks/useAppRole';
import { Users, Lock, Globe, MessageSquare, Calendar, ShieldAlert, ArrowLeft, UserPlus } from 'lucide-react';
import { BackButton } from '@/components/common/BackButton';
import { UniversalShareSheet } from '@/components/common/UniversalShareSheet';
import SEO from '@/components/common/SEO';
import { ScreenSkeleton } from '@/components/ui/enhanced-skeleton';
import { friendlyError } from '@cinecraft/core';
import { ShareIcon } from '@/components/icons/ShareIcon';
import { useAccountType } from '@/hooks/useAccountType';
import { joinRequestUiState } from '@/components/discussions/joinRequestStatus';

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
  const { push, replace } = useAppNavigation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { isInternal, loading: roleLoading } = useAppRole();
  const { isFan } = useAccountType();
  const [loadFailed, setLoadFailed] = useState(false);
  
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
    let redirecting = false;
    setLoadFailed(false);
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
            .select('status, created_at')
            .eq('room_id', roomId)
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(1)
        ]);

        const isOwner = user.id === data.creator_id;
        const isPublicRoom = data.room_type === 'public';
        const memberData = !!memberRes.data || isOwner || isInternal;
        setIsMember(memberData);

        // Auto-redirect if already a member/creator/staff, or if it is a public room
        if (memberData || isPublicRoom) {
          // replace, not push: with push the back button returned to this page, which redirected again (a trap)
          redirecting = true;
          replace(`/discussion-rooms/${roomId}/chat`, { noScroll: true });
          return;
        }

        // only a request that is still pending blocks a new one; a rejected request can be sent again
        setRequestStatus(joinRequestUiState(requestRes.data as any[]));
      } else {
        setIsMember(false);
        setRequestStatus('none');
      }
    } catch (error) {
      console.error('Error fetching room details:', error);
      setLoadFailed(true);
      toast({ title: 'Error', description: 'Failed to load discussion room details', variant: 'destructive' });
    } finally {
      // keep the skeleton up while we hand over to the chat, so this page never flashes
      if (!redirecting) setLoading(false);
    }
  };

  const handleJoinOrCreateRequest = async () => {
    if (!user) {
      // not an error: go straight to sign in (the button already says "Sign in to join")
      push(`/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
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
        description: friendlyError(err, "Could not submit join request."),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <ScreenSkeleton variant="detail" />;
  if (loadFailed) {
    return (
      <div className="flex h-dvh items-center justify-center flex-col gap-4 bg-background" role="alert">
        <h2 className="text-2xl font-bold">Could not load this room</h2>
        <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
        <Button onClick={() => fetchRoomDetails()}>Try again</Button>
      </div>
    );
  }
  if (!room) {
    return (
      <div className="flex h-dvh items-center justify-center flex-col gap-4 bg-background">
        <h2 className="text-2xl font-bold">Discussion Room Not Found</h2>
        <Button onClick={() => push('/discussion-rooms', { noScroll: true })}>View All Rooms</Button>
      </div>
    );
  }

  // Extra gate: secret or private rooms should not show details to anonymous visitors
  const isPrivate = room.room_type !== 'public';

  return (
    <div className="min-h-dvh bg-background pt-24 pb-[calc(env(safe-area-inset-bottom)+10rem)]">
      <SEO 
        title={`${room.title} - Discussion Room`}
        description={room.description || "Join this discussion room on CineCraft Connect."}
      />
      <div className="max-w-[1152px] mx-auto px-4 md:px-8">
        <BackButton className="mb-6" to="/discussion-rooms" />

        <div className="glass-card p-6 md:p-10 space-y-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-4 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="capitalize px-4 py-1 text-sm font-medium">
                  {room.room_categories?.name || 'General'}
                </Badge>
                <Badge variant={isPrivate ? "secondary" : "default"} className="capitalize px-4 py-1 text-sm font-medium flex items-center gap-1">
                  {isPrivate ? <Lock size={12} /> : <Globe size={12} />}
                  {room.room_type === 'public' ? 'Public room' : room.room_type === 'private' ? 'Private room' : room.room_type === 'secret' ? 'Secret room' : `${room.room_type} room`}
                </Badge>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gradient leading-tight min-w-0 break-words line-clamp-3" title={room.title}>
                {room.title}
              </h1>
            </div>
            
            <div className="flex flex-wrap gap-3">
              <Button aria-label="Share" variant="outline" size="icon" className="rounded-xl border-border/50" onClick={() => setShowShareSheet(true)}>
                <ShareIcon className="h-4 w-4" />
              </Button>
              {isMember ? (
                <Button 
                  className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 active:scale-[0.97] transition-[transform,background-color] duration-150"
                  onClick={() => push(`/discussion-rooms/${room.id}/chat`)}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Enter Chat
                </Button>
              ) : isPrivate && requestStatus === 'pending' ? (
                <Button disabled variant="outline" className="rounded-xl border-border/50">
                  Request Pending
                </Button>
              ) : isPrivate && isFan ? (
                <Button disabled variant="outline" className="rounded-xl border-border/50" title="Fan accounts cannot join private rooms">
                  Private room
                </Button>
              ) : (
                <Button 
                  className="bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 active:scale-[0.97] transition-[transform,background-color] duration-150"
                  disabled={isSubmitting}
                  onClick={handleJoinOrCreateRequest}
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  {isPrivate ? 'Request to Join' : !user ? 'Sign in to join' : 'Enter Discussion'}
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
                <p className="text-muted-foreground leading-relaxed whitespace-pre-line break-words">
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
                  <span>{new Intl.NumberFormat().format(room.member_count)} {room.member_count === 1 ? 'Member' : 'Members'} participating</span>
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
