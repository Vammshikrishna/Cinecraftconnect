import { Share2 } from 'lucide-react';
import { useState } from 'react';
import { UniversalShareSheet } from '@/components/common/UniversalShareSheet';

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
        className="flex items-center gap-1.5 transition-all duration-300 group/share text-foreground/80 hover:text-primary"
        onClick={() => setShowShareSheet(true)}
      >
        <div className="p-2 -m-2 rounded-full group-hover/share:bg-primary/10 transition-colors">
          <Share2 className="h-6 w-6" />
        </div>
        <span className="text-[13px] font-semibold">{currentShareCount}</span>
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
