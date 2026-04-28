import { Share2 } from 'lucide-react';
import { useState } from 'react';
import { InstagramShareSheet } from '@/components/feed/InstagramShareSheet';

const ShareButton = ({ postId, shareCount }: { postId: string, shareCount: number }) => {
  const [currentShareCount] = useState(shareCount);
  const [showShareSheet, setShowShareSheet] = useState(false);

  return (
    <>
    <div className="flex items-center">
      <button
        className="flex items-center gap-1.5 transition-all duration-300 group/share text-foreground/80 hover:text-primary"
        onClick={() => setShowShareSheet(true)}
      >
        <div className="p-2 -m-2 rounded-full group-hover/share:bg-primary/10 transition-colors">
          <Share2 className="h-6 w-6" />
        </div>
        <span className="text-[13px] font-semibold">{currentShareCount}</span>
      </button>
    </div>

      <InstagramShareSheet
        isOpen={showShareSheet}
        onOpenChange={setShowShareSheet}
        postId={postId}
      />
    </>
  );
};

export default ShareButton;
