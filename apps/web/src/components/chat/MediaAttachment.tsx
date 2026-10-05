import React, { useState } from 'react';
import { FileText, Download, Play, ImageOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MediaAttachmentProps {
  url?: string | null;
  type?: string | null;
  alt?: string;
  className?: string;
  onSelectMedia?: (clickedUrl: string, index?: number, allUrls?: string[]) => void;
}

function parseMediaUrls(url: string | null | undefined): string[] {
  if (!url || typeof url !== 'string') return [];
  const trimmed = url.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter((i): i is string => typeof i === 'string' && i.length > 0);
      }
    } catch {
      return [trimmed];
    }
  }
  return [trimmed];
}

export const MediaAttachment: React.FC<MediaAttachmentProps> = ({
  url,
  type = 'image',
  alt = 'Attachment',
  className,
  onSelectMedia,
}) => {
  const [failedIndices, setFailedIndices] = useState<Set<number>>(new Set());

  const items = React.useMemo(() => parseMediaUrls(url), [url]);

  if (!url || items.length === 0) return null;

  const handleImageError = (index: number) => {
    setFailedIndices((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  };

  const handleMediaClick = (clickedUrl: string, idx: number) => {
    if (onSelectMedia) {
      onSelectMedia(clickedUrl, idx, items);
    } else {
      window.open(clickedUrl, '_blank');
    }
  };

  const mediaType = type || 'image';
  const count = items.length;

  // --- SINGLE ITEM RENDER ---
  if (count === 1) {
    const singleUrl = items[0];

    if (mediaType === 'image') {
      if (failedIndices.has(0)) {
        return (
          <div className={cn(
            "flex items-center gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/30 max-w-xs text-muted-foreground select-none",
            className
          )}>
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <ImageOff className="w-4 h-4 text-muted-foreground/70" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-foreground/80 truncate">{alt || 'Attachment'}</span>
              <span className="text-[10px] text-muted-foreground/70">Image unavailable</span>
            </div>
          </div>
        );
      }

      return (
        <img
          src={singleUrl}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => handleImageError(0)}
          className={cn(
            "max-w-full h-auto max-h-[300px] object-cover rounded-xl cursor-pointer hover:scale-[1.01] transition-transform duration-200 shadow-sm",
            className
          )}
          onClick={() => handleMediaClick(singleUrl, 0)}
        />
      );
    }

    if (mediaType === 'video') {
      return (
        <div
          className={cn("relative group cursor-pointer rounded-xl overflow-hidden shadow-sm", className)}
          onClick={() => handleMediaClick(singleUrl, 0)}
        >
          <video src={singleUrl} className="max-w-full h-auto max-h-[300px] rounded-xl" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-all">
            <div className="w-12 h-12 rounded-full bg-primary/80 flex items-center justify-center text-primary-foreground shadow-lg">
              <Play className="h-6 w-6 fill-current ml-0.5" />
            </div>
          </div>
        </div>
      );
    }

    // Default File / Document
    const fileName = singleUrl.split('/').pop()?.split('?')[0] || 'Attachment';
    return (
      <a
        href={singleUrl}
        download={fileName}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "flex items-center gap-3 p-3 bg-secondary/40 hover:bg-secondary/70 border border-border/40 rounded-xl text-foreground transition-colors max-w-sm",
          className
        )}
      >
        <FileText className="h-8 w-8 text-primary shrink-0" />
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xs font-bold truncate">{fileName}</span>
          <span className="text-[10px] text-muted-foreground">Document Attachment</span>
        </div>
        <Download className="h-4 w-4 text-muted-foreground shrink-0" />
      </a>
    );
  }

  // --- MULTI-IMAGE GRID: 2 ITEMS ---
  if (count === 2) {
    return (
      <div className={cn("grid grid-cols-2 gap-1 rounded-2xl overflow-hidden max-w-[320px] sm:max-w-[380px] border border-border/10 shadow-sm", className)}>
        {items.map((itemUrl, idx) => (
          <div
            key={idx}
            className="relative h-36 sm:h-44 cursor-pointer overflow-hidden group bg-black/10 flex items-center justify-center"
            onClick={() => handleMediaClick(itemUrl, idx)}
          >
            {failedIndices.has(idx) ? (
              <div className="flex flex-col items-center justify-center text-muted-foreground gap-1">
                <ImageOff className="w-5 h-5 opacity-50" />
                <span className="text-[10px] opacity-70">Unavailable</span>
              </div>
            ) : (
              <img
                src={itemUrl}
                alt={`Attachment ${idx + 1}`}
                loading="lazy"
                decoding="async"
                onError={() => handleImageError(idx)}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            )}
          </div>
        ))}
      </div>
    );
  }

  // --- MULTI-IMAGE GRID: 3 ITEMS (WhatsApp 1 Left Hero + 2 Stacked Right) ---
  if (count === 3) {
    return (
      <div className={cn("grid grid-cols-2 gap-1 rounded-2xl overflow-hidden max-w-[320px] sm:max-w-[380px] border border-border/10 shadow-sm", className)}>
        <div
          className="relative col-span-1 row-span-2 h-[172px] sm:h-[204px] cursor-pointer overflow-hidden group bg-black/10 flex items-center justify-center"
          onClick={() => handleMediaClick(items[0], 0)}
        >
          {failedIndices.has(0) ? (
            <div className="flex flex-col items-center justify-center text-muted-foreground gap-1">
              <ImageOff className="w-6 h-6 opacity-50" />
              <span className="text-[10px] opacity-70">Unavailable</span>
            </div>
          ) : (
            <img
              src={items[0]}
              alt="Attachment 1"
              loading="lazy"
              decoding="async"
              onError={() => handleImageError(0)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          )}
        </div>
        <div
          className="relative col-span-1 h-[84px] sm:h-[100px] cursor-pointer overflow-hidden group bg-black/10 flex items-center justify-center"
          onClick={() => handleMediaClick(items[1], 1)}
        >
          {failedIndices.has(1) ? (
            <ImageOff className="w-4 h-4 text-muted-foreground/60" />
          ) : (
            <img
              src={items[1]}
              alt="Attachment 2"
              loading="lazy"
              decoding="async"
              onError={() => handleImageError(1)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          )}
        </div>
        <div
          className="relative col-span-1 h-[84px] sm:h-[100px] cursor-pointer overflow-hidden group bg-black/10 flex items-center justify-center"
          onClick={() => handleMediaClick(items[2], 2)}
        >
          {failedIndices.has(2) ? (
            <ImageOff className="w-4 h-4 text-muted-foreground/60" />
          ) : (
            <img
              src={items[2]}
              alt="Attachment 3"
              loading="lazy"
              decoding="async"
              onError={() => handleImageError(2)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          )}
        </div>
      </div>
    );
  }

  // --- MULTI-IMAGE GRID: 4 or 5+ ITEMS (2x2 Grid with "+N" badge on 4th tile) ---
  const displayItems = items.slice(0, 4);
  const remainingCount = count - 4;

  return (
    <div className={cn("grid grid-cols-2 gap-1 rounded-2xl overflow-hidden max-w-[320px] sm:max-w-[380px] border border-border/10 shadow-sm", className)}>
      {displayItems.map((itemUrl, idx) => {
        const isFourth = idx === 3;
        const hasMore = isFourth && remainingCount > 0;

        return (
          <div
            key={idx}
            className="relative h-28 sm:h-34 cursor-pointer overflow-hidden group bg-black/10 flex items-center justify-center"
            onClick={() => handleMediaClick(itemUrl, idx)}
          >
            {failedIndices.has(idx) ? (
              <div className="flex flex-col items-center justify-center text-muted-foreground gap-1">
                <ImageOff className="w-5 h-5 opacity-50" />
                <span className="text-[9px] opacity-70">Unavailable</span>
              </div>
            ) : (
              <img
                src={itemUrl}
                alt={`Attachment ${idx + 1}`}
                loading="lazy"
                decoding="async"
                onError={() => handleImageError(idx)}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            )}
            {hasMore && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center text-white font-black text-xl sm:text-2xl shadow-inner tracking-wider">
                +{remainingCount + 1}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MediaAttachment;
