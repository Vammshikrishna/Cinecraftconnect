import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";

const DirectMessagePage = () => {
  const { userId: recipientId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const findOrCreateConversation = async () => {
      if (!user || !recipientId) {
        setError("User or recipient not found.");
        setLoading(false);
        return;
      }
      
      // Prevent user from starting a conversation with themselves
      if (user.id === recipientId) {
        navigate("/chat"); // Redirect to chat list
        return;
      }
  
      try {
        setLoading(true);
  
        // Call the RPC function to find or create a conversation
        const { data, error: rpcError } = await supabase.rpc('get_or_create_conversation', {
          p_user_id_1: user.id,
          p_user_id_2: recipientId
        });
  
        if (rpcError) {
          throw rpcError;
        }
  
        if (data) {
          // Navigate to the conversation
          navigate(`/chat/${data}`);
        } else {
          throw new Error("Failed to get or create conversation.");
        }
        
      } catch (e: any) {
        console.error("Error finding or creating conversation:", e);
        setError("There was an error starting your conversation. Please try again.");
        setLoading(false);
      }
    };

    findOrCreateConversation();
  }, [user, recipientId, navigate]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="text-center">
            <LoadingSpinner size="lg" />
            <p className="mt-4 text-muted-foreground">Starting conversation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
        <p className="mb-4 text-destructive">{error}</p>
        <Button onClick={() => navigate('/chat')}>Back to Chats</Button>
      </div>
    );
  }

  return null; // Should not be reached, as it will either be loading, show an error, or navigate away.
};

export default DirectMessagePage;
