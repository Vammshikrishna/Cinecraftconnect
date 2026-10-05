import React, { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, Download, Loader2, AlertCircle } from 'lucide-react';
import { downloadAndDecryptAttachment } from '@/lib/e2ee/attachments/decrypt';
import { cn } from '@/lib/utils';

interface ImageLightboxModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: string[];
  initialIndex?: number;
  senderName?: string;
}

// Global cache for decrypted image URLs in lightbox
const lightboxCache = new Map<string, string>();

async function resolveImageSrc(rawSrc: string): Promise<string> {
  if (!rawSrc) return '';
  if (lightboxCache.has(rawSrc)) return lightboxCache.get(rawSrc)!;

  if (typeof rawSrc === 'string' && rawSrc.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(rawSrc);
      if (parsed && (parsed.encryptedStorageUrl || parsed.storageUrl) && (parsed.fileKeyB64 || parsed.fileKey)) {
        const res = await downloadAndDecryptAttachment(
          parsed.encryptedStorageUrl || parsed.storageUrl,
          parsed.fileKeyB64 || parsed.fileKey,
          parsed.encryptedMetadataB64 || parsed.metadata
        );
        lightboxCache.set(rawSrc, res.blobUrl);
        return res.blobUrl;
      }
    } catch (e) {
      console.error('[ImageLightboxModal] E2EE parsing error:', e);
    }
  }

  lightboxCache.set(rawSrc, rawSrc);
  return rawSrc;
}

export const ImageLightboxModal: React.FC<ImageLightboxModalProps> = ({
  open,
  onOpenChange,
  images,
  initialIndex = 0,
  senderName,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showControls, setShowControls] = useState(true);
  const [activeSrc, setActiveSrc] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    if (open) {
      setCurrentIndex(Math.max(0, Math.min(initialIndex, images.length - 1)));
      setShowControls(true);
    }
  }, [open, initialIndex, images.length]);

  const rawCurrentSrc = images[currentIndex] || images[0] || '';

  // Resolve raw source (handle E2EE payloads or standard URLs)
  useEffect(() => {
    if (!open || !rawCurrentSrc) {
      setActiveSrc('');
      setLoading(false);
      setError(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(false);

    resolveImageSrc(rawCurrentSrc)
      .then((blobUrl) => {
        if (!isMounted) return;
        if (blobUrl) {
          setActiveSrc(blobUrl);
          setLoading(false);
        } else {
          setError(true);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('[ImageLightboxModal] Resolve error:', err);
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [open, rawCurrentSrc]);

  const handleNext = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (images.length > 1) {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }
  }, [images.length]);

  const handlePrev = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (images.length > 1) {
      setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    }
  }, [images.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, handleNext, handlePrev, onOpenChange]);

  if (!open || images.length === 0) return null;

  const hasMultiple = images.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="!fixed !inset-0 !w-screen !h-screen !left-0 !top-0 !translate-x-0 !translate-y-0 !p-0 !border-none !bg-black backdrop-blur-2xl !shadow-none !max-w-none outline-none !z-[1001] !flex !flex-col overflow-hidden select-none"
      >
        <DialogHeader className="sr-only flex-none">
          <DialogTitle>Image Viewer</DialogTitle>
          <DialogDescription>Responsive full screen image preview</DialogDescription>
        </DialogHeader>

        {/* Main Full-Screen Center Image Canvas (Occupies 100% viewport height and width) */}
        <div
          className="relative flex-1 min-h-0 w-full flex items-center justify-center p-0 overflow-hidden cursor-pointer z-10"
          onClick={() => setShowControls((prev) => !prev)}
        >
          {/* Left Arrow Navigation Button */}
          {hasMultiple && (
            <button
              type="button"
              onClick={handlePrev}
              className={cn(
                "absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-40 p-2.5 sm:p-3 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md border border-white/15 transition-all shadow-2xl hover:scale-110 active:scale-95 cursor-pointer",
                !showControls && "opacity-0 pointer-events-none"
              )}
              title="Previous photo"
            >
              <ChevronLeft className="h-6 w-6 sm:h-8 sm:w-8" />
            </button>
          )}

          {/* Image Display */}
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-white/80 z-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-xs font-medium tracking-wide">Loading image...</span>
            </div>
          ) : error || !activeSrc ? (
            <div className="flex items-center gap-2 p-4 bg-destructive/20 border border-destructive/30 text-destructive-foreground rounded-2xl text-xs font-medium z-20">
              <AlertCircle className="h-5 w-5" />
              <span>Failed to display image preview</span>
            </div>
          ) : (
            <img loading="lazy" decoding="async"
              key={activeSrc}
              src={activeSrc}
              alt={`Preview ${currentIndex + 1}`}
              className="max-w-full max-h-full w-auto h-auto object-contain transition-transform duration-200 pointer-events-auto"
              onClick={(e) => {
                e.stopPropagation();
                setShowControls((prev) => !prev);
              }}
            />
          )}

          {/* Right Arrow Navigation Button */}
          {hasMultiple && (
            <button
              type="button"
              onClick={handleNext}
              className={cn(
                "absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-40 p-2.5 sm:p-3 rounded-full bg-black/60 hover:bg-black/90 text-white backdrop-blur-md border border-white/15 transition-all shadow-2xl hover:scale-110 active:scale-95 cursor-pointer",
                !showControls && "opacity-0 pointer-events-none"
              )}
              title="Next photo"
            >
              <ChevronRight className="h-6 w-6 sm:h-8 sm:w-8" />
            </button>
          )}
        </div>

        {/* Top Header Bar - Floating Translucent Overlay */}
        <div
          className={cn(
            "absolute top-0 inset-x-0 h-12 sm:h-14 flex items-center justify-between px-3 sm:px-5 z-30 bg-gradient-to-b from-black/80 via-black/30 to-transparent transition-opacity duration-300 pointer-events-none",
            !showControls && "opacity-0"
          )}
        >
          <div className="flex flex-col text-left pointer-events-auto leading-tight">
            {senderName && (
              <span className="text-white font-semibold text-xs sm:text-sm tracking-wide drop-shadow-sm truncate max-w-[200px] sm:max-w-xs">
                {senderName}
              </span>
            )}
            <span className="text-white/60 text-[10px] font-medium tracking-wider">
              {hasMultiple ? `${currentIndex + 1} of ${images.length}` : 'Photo'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 pointer-events-auto">
            {activeSrc && (
              <a
                href={activeSrc}
                download={`image_${currentIndex + 1}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                title="Download Image"
                onClick={(e) => e.stopPropagation()}
              >
                <Download className="h-4 w-4" />
              </a>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="text-white/80 hover:text-white hover:bg-white/10 rounded-full h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                onOpenChange(false);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Bottom Thumbnail Strip - Floating Translucent Overlay */}
        {hasMultiple && (
          <div
            className={cn(
              "absolute bottom-0 inset-x-0 py-3 px-4 flex items-center justify-center gap-2 overflow-x-auto bg-gradient-to-t from-black/85 via-black/40 to-transparent z-30 custom-scrollbar transition-opacity duration-300 pointer-events-auto",
              !showControls && "opacity-0 pointer-events-none"
            )}
          >
            {images.map((imgSrc, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                className={cn(
                  "w-12 h-12 rounded-lg overflow-hidden border-2 transition-all shrink-0 cursor-pointer shadow-lg",
                  idx === currentIndex
                    ? "border-primary scale-110 ring-2 ring-primary/50"
                    : "border-transparent opacity-60 hover:opacity-100"
                )}
              >
                <img loading="lazy" decoding="async" src={imgSrc} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ImageLightboxModal;
