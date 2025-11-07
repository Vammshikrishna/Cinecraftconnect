import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

const ShareButton = ({ postId }: { postId: number }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isShared, setIsShared] = useState(false);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    const checkShareStatus = async () => {
      const { data } = await supabase
        .from('shares')
        .select('post_id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (isMounted && data) {
        setIsShared(true);
      }
    };

    checkShareStatus();

    return () => {
      isMounted = false;
    };
  }, [user, postId]);

  const handleShare = async () => {
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'You must be logged in to share a post.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('shares')
        .insert({ post_id: postId, user_id: user.id });

      if (error) {
        if (error.code === '23505') { // Handle unique violation for duplicate shares
          toast({
            title: 'Already Shared',
            description: 'You have already shared this post.',
          });
          setIsShared(true); // Sync UI state
        } else {
          throw error;
        }
      } else {
        setIsShared(true);
        const shareUrl = `${window.location.origin}/post/${postId}`;
        try {
          await navigator.clipboard.writeText(shareUrl);
          toast({
            title: 'Success',
            description: 'Post shared and link copied to clipboard!',
          });
        } catch (copyError) {
          console.error('Failed to copy share link:', copyError);
          toast({
            title: 'Post Shared',
            description: 'Link could not be copied to clipboard.',
            variant: 'outline',
          });
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to share the post. Please try again.',
        variant: 'destructive',
      });
      console.error('Error sharing post:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleShare}
      disabled={isLoading || isShared}
    >
      <Share2 className="h-5 w-5" />
    </Button>
  );
};

export default ShareButton;
