import { Share2, Link as LinkIcon, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ShareToConnectionDialog } from '@/components/feed/ShareToConnectionDialog';

const ShareButton = ({ postId, shareCount }: { postId: string, shareCount: number }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isShared, setIsShared] = useState(false);
  const [currentShareCount, setCurrentShareCount] = useState(shareCount);
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);

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

  const recordShare = async () => {
    if (!user) return;

    // Optimistic update if not already shared
    if (!isShared) {
      setCurrentShareCount(prev => prev + 1);
      setIsShared(true);

      try {
        const { error } = await supabase
          .from('shares')
          .insert({ post_id: postId, user_id: user.id });

        if (error && error.code !== '23505') {
          throw error;
        }
      } catch (error) {
        console.error('Error recording share:', error);
        // Rollback
        setCurrentShareCount(prev => prev - 1);
        setIsShared(false);
      }
    }
  };

  const handleNativeShare = async () => {
    const shareUrl = `${window.location.origin}/feed?post=${postId}`;
    const shareData = {
      title: 'Check out this post on ReelSphere',
      text: 'I found this interesting post on ReelSphere Connect',
      url: shareUrl,
    };

    if (navigator.share && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        await recordShare();
        toast({
          title: 'Shared successfully',
          description: 'Thanks for sharing!',
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Error sharing:', error);
          toast({
            title: 'Error',
            description: 'Failed to share content.',
            variant: 'destructive',
          });
        }
      }
    } else {
      // Fallback to copy link
      handleCopyLink();
    }
  };

  const handleCopyLink = async () => {
    const shareUrl = `${window.location.origin}/feed?post=${postId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      await recordShare();
      toast({
        title: 'Link Copied',
        description: 'Post link copied to clipboard!',
      });
    } catch (error) {
      console.error('Failed to copy link:', error);
      toast({
        title: 'Error',
        description: 'Failed to copy link.',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-primary hover:bg-primary/10 flex items-center"
          >
            <Share2 className="h-5 w-5 mr-1" />
            <span>{currentShareCount}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-card border-border">
          <DropdownMenuItem onClick={handleNativeShare} className="cursor-pointer">
            <Share2 className="mr-2 h-4 w-4" />
            <span>Share via...</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowConnectionDialog(true)} className="cursor-pointer">
            <Send className="mr-2 h-4 w-4" />
            <span>Send to Connection</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleCopyLink} className="cursor-pointer">
            <LinkIcon className="mr-2 h-4 w-4" />
            <span>Copy Link</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ShareToConnectionDialog
        isOpen={showConnectionDialog}
        onOpenChange={setShowConnectionDialog}
        postId={postId}
      />
    </>
  );
};

export default ShareButton;
