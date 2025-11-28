import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import EnhancedRealTimeChat from '@/components/chat/EnhancedRealTimeChat';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string;
}

const ChatPage = () => {
  const { user } = useAuth();
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const [partner, setPartner] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!conversationId || !user) {
      setLoading(false);
      return;
    }

    const fetchPartnerProfile = async (partnerId: string) => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
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

    fetchPartnerProfile(conversationId);

  }, [conversationId, user]);

  const channelId = useMemo(() => {
    if (!user || !partner) return null;
    return [user.id, partner.id].sort().join('-');
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
    <div className="h-screen pt-0 lg:pt-16">
      <EnhancedRealTimeChat
        roomId={channelId}
        partnerId={partner.id}
        partnerName={partner.full_name}
        partnerAvatarUrl={partner.avatar_url}
        onBackClick={() => navigate('/chats')}
      />
    </div>
  );
};

export default ChatPage;
