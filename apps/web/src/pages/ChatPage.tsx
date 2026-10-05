import { useEffect, useState, useMemo } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import EnhancedRealTimeChat from '@/components/chat/EnhancedRealTimeChat';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { generateDirectRoomId } from '@/lib/chat-utils';

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string;
  is_verified?: boolean;
}

const ChatPage = () => {
  const { user } = useAuth();
  const { conversationId, userId } = useParams<{ conversationId: string; userId: string }>();
  const activeId = conversationId || userId;
  const { push } = useAppNavigation();
  const location = useLocation();
  const initialState = location.state as { partner?: Profile } | null;
  const [partner, setPartner] = useState<Profile | null>(initialState?.partner || null);
  const [loading, setLoading] = useState(!initialState?.partner);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeId || !user || activeId === 'undefined') {
      console.warn("Invalid activeId:", activeId);
      setLoading(false);
      return;
    }

    const fetchPartnerProfile = async (partnerId: string) => {
      // If we have initial data, we can skip or do a background refresh
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, is_verified')
        .eq('id', partnerId)
        .single();

      if (error) {
        console.error("Error fetching partner profile:", error);
        setError('Could not load user profile. The chat cannot be started.');
        setPartner(null);
      } else {
        setPartner(data as any);
      }
      setLoading(false);
    };

    fetchPartnerProfile(activeId);

  }, [activeId, user]);

  const channelId = useMemo(() => {
    if (!user || !partner) return null;
    return generateDirectRoomId(user.id, partner.id);
  }, [user, partner]);

  if (loading) {
    return <div className="h-screen w-full flex items-center justify-center"><LoadingSpinner size="lg" /></div>;
  }

  if (error) {
    return <div className="text-center p-8 text-destructive">{error}</div>;
  }

  if (!partner || !channelId) {
    return <div className="text-center p-8">Could not load chat. Invalid user or conversation.</div>;
  }

  return (
    <div className="h-[100dvh] pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] lg:pt-20 flex flex-col relative">
      <EnhancedRealTimeChat
        roomId={channelId}
        partnerId={partner.id}
        partnerName={partner.full_name}
        partnerAvatarUrl={partner.avatar_url}
        partnerIsVerified={partner.is_verified}
        onBackClick={() => push('/messages', { noScroll: true })}
      />
    </div>
  );
};

export default ChatPage;
