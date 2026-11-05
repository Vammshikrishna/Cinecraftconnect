import { useState } from 'react';
import { UniversalShareSheet } from '@/components/common/UniversalShareSheet';
import { ShareIcon } from '@/components/icons/ShareIcon';

const ShareButton = ({ 
  postId, 
  shareCount, 
  previewUrl, 
  caption, 
  author 
}: { 
  postId: string, 
  shareCount: number,
  previewUrl?: string,
  caption?: string,
  author?: {
    username: string | null;
    avatar_url: string | null;
    is_verified?: boolean;
  }
}) => {
  const [currentShareCount] = useState(shareCount);
  const [showShareSheet, setShowShareSheet] = useState(false);

  return (
    <>
    <div className="flex items-center">
      <button
        aria-label="Share post"
        className="flex items-center gap-1.5 transition duration-300 group/share text-foreground/80 hover:text-primary"
        onClick={() => setShowShareSheet(true)}
      >
        <div className="p-2 -m-2 rounded-full flex items-center justify-center group-hover/share:bg-primary/10 transition-colors">
          <ShareIcon className="h-5 w-5" />
        </div>
        <span className="text-sm font-semibold">{currentShareCount}</span>
      </button>
    </div>

      <UniversalShareSheet
        isOpen={showShareSheet}
        onOpenChange={setShowShareSheet}
        shareType="post"
        shareId={postId}
        shareData={{
          postId: postId,
          previewUrl: previewUrl,
          caption: caption,
          author: author
        }}
      />
    </>
  );
};

export default ShareButton;
