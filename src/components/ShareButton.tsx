import { Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { InstagramShareSheet } from '@/components/feed/InstagramShareSheet';

const ShareButton = ({ postId, shareCount }: { postId: string, shareCount: number }) => {
  const [currentShareCount] = useState(shareCount);
  const [showShareSheet, setShowShareSheet] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-primary hover:bg-primary/10 flex items-center"
        onClick={() => setShowShareSheet(true)}
      >
        <Share2 className="h-5 w-5 mr-1" />
        <span>{currentShareCount}</span>
      </Button>

      <InstagramShareSheet
        isOpen={showShareSheet}
        onOpenChange={setShowShareSheet}
        postId={postId}
      />
    </>
  );
};

export default ShareButton;
