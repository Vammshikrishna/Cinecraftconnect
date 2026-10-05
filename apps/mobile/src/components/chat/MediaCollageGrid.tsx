import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Image,
} from 'react-native';
import { CachedImage } from '../common/CachedImage';
import { Icon } from '../common/Icon';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_MAX_WIDTH = Math.min(270, Math.round(SCREEN_WIDTH * 0.74));

const imageRatioCache = new Map<string, number>();

export interface MediaCollageItem {
  url: string;
  type: 'image' | 'video' | 'file';
  name?: string;
  size?: number;
}

export function parseMediaUrls(
  raw: string | null | undefined,
  fallbackType?: string | null
): MediaCollageItem[] {
  if (!raw || typeof raw !== 'string') return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];

  // 1. JSON Array string e.g. ["url1", "url2"] or [{ url: "...", type: "..." }]
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item: any) => {
            const url = typeof item === 'string' ? item : item?.url;
            if (!url || typeof url !== 'string') return null;
            const explicitType = typeof item === 'object' ? item?.type : null;
            const isVid = Boolean(
              explicitType === 'video' ||
              url.match(/\.(mp4|mov|mkv|webm|avi|3gp)$/i)
            );
            const isImg = Boolean(
              explicitType === 'image' ||
              url.match(/\.(jpg|jpeg|png|gif|webp|heic)$/i) ||
              (!isVid && !url.match(/\.(pdf|doc|docx|xls|xlsx|txt|zip)$/i))
            );
            return {
              url,
              type: isVid ? 'video' : isImg ? 'image' : 'file',
              name: typeof item === 'object' ? item?.name : undefined,
              size: typeof item === 'object' ? item?.size : undefined,
            } as MediaCollageItem;
          })
          .filter(Boolean) as MediaCollageItem[];
      }
    } catch {
      // Fallback to single URL
    }
  }

  // 2. Ignore raw JSON object ciphertexts if any left over
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed?.encryptedStorageUrl || parsed?.storageUrl) {
        // If it has a storageUrl, use it as fallback
        const url = parsed.encryptedStorageUrl || parsed.storageUrl;
        return [{ url, type: 'file' }];
      }
    } catch {
      return [];
    }
  }

  // 3. Single URL
  const isVid = Boolean(
    fallbackType === 'video' ||
    trimmed.match(/\.(mp4|mov|mkv|webm|avi|3gp)$/i)
  );
  const isImg = Boolean(
    fallbackType === 'image' ||
    trimmed.match(/\.(jpg|jpeg|png|gif|webp|heic)$/i) ||
    (!isVid && !trimmed.match(/\.(pdf|doc|docx|xls|xlsx|txt|zip)$/i))
  );

  return [
    {
      url: trimmed,
      type: isVid ? 'video' : isImg ? 'image' : 'file',
    },
  ];
}

interface MediaCollageGridProps {
  mediaUrl?: string | null;
  mediaType?: string | null;
  onOpenImage?: (url: string, index: number, allUrls: string[]) => void;
  onOpenFile?: (url: string) => void;
  onLongPress?: () => void;
  maxWidth?: number;
  isOwn?: boolean;
  overlayMeta?: React.ReactNode;
  containerStyle?: any;
  imageContainerStyle?: any;
}

export const MediaCollageGrid: React.FC<MediaCollageGridProps> = React.memo(({
  mediaUrl,
  mediaType,
  onOpenImage,
  onOpenFile,
  onLongPress,
  maxWidth = GRID_MAX_WIDTH,
  isOwn = false,
  overlayMeta,
  containerStyle,
  imageContainerStyle,
}) => {
  const items = React.useMemo(() => parseMediaUrls(mediaUrl, mediaType), [mediaUrl, mediaType]);

  const count = items?.length || 0;
  const singleImageUrl = count === 1 && items[0]?.type === 'image' ? items[0].url : null;
  const [imageRatio, setImageRatio] = React.useState<number>(() => {
    if (singleImageUrl && imageRatioCache.has(singleImageUrl)) {
      return imageRatioCache.get(singleImageUrl)!;
    }
    return 1.15;
  });

  React.useEffect(() => {
    if (!singleImageUrl) return;
    if (imageRatioCache.has(singleImageUrl)) {
      setImageRatio(imageRatioCache.get(singleImageUrl)!);
      return;
    }
    Image.getSize(
      singleImageUrl,
      (w, h) => {
        if (w > 0 && h > 0) {
          const rawRatio = w / h;
          // Clamp ratio between 0.72 (portrait 3:4 / selfie) and 1.85 (widescreen 16:9 / panorama)
          const clamped = Math.max(0.72, Math.min(1.85, rawRatio));
          imageRatioCache.set(singleImageUrl, clamped);
          setImageRatio(clamped);
        }
      },
      () => {
        // Fallback silently if offline or network error
      }
    );
  }, [singleImageUrl]);

  if (!items || items.length === 0) return null;

  const allImageUrls = React.useMemo(() => {
    return items.filter((i) => i.type === 'image').map((i) => i.url);
  }, [items]);

  const handleItemPress = (item: MediaCollageItem, index: number) => {
    if (item.type === 'image') {
      const imgIdx = allImageUrls.indexOf(item.url);
      onOpenImage?.(item.url, imgIdx >= 0 ? imgIdx : index, allImageUrls.length > 0 ? allImageUrls : [item.url]);
    } else {
      onOpenFile?.(item.url);
    }
  };

  // --- 1 ITEM RENDER ---
  if (count === 1) {
    const item = items[0];

    if (item.type === 'image') {
      const containerHeight = Math.min(320, Math.max(140, Math.round(maxWidth / imageRatio)));
      return (
        <TouchableOpacity
          onPress={() => handleItemPress(item, 0)}
          onLongPress={onLongPress}
          activeOpacity={0.9}
          style={[
            styles.singleImageContainer,
            { width: maxWidth, height: containerHeight },
            containerStyle,
            imageContainerStyle,
          ]}
        >
          <CachedImage
            uri={item.url}
            style={styles.singleImage}
            resizeMode="cover"
          />
          {overlayMeta ? (
            <View style={styles.floatingMetaOverlay}>
              {overlayMeta}
            </View>
          ) : null}
        </TouchableOpacity>
      );
    }

    if (item.type === 'video') {
      return (
        <TouchableOpacity
          onPress={() => handleItemPress(item, 0)}
          onLongPress={onLongPress}
          activeOpacity={0.88}
          style={[styles.singleVideoContainer, { width: maxWidth }, containerStyle, imageContainerStyle]}
        >
          <View style={styles.videoPlaceholder}>
            <View style={styles.playButtonCircle}>
              <Icon name="play" size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.videoLabel}>Video Attachment</Text>
          </View>
          {overlayMeta ? (
            <View style={styles.floatingMetaOverlay}>
              {overlayMeta}
            </View>
          ) : null}
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        onPress={() => handleItemPress(item, 0)}
        onLongPress={onLongPress}
        activeOpacity={0.85}
        style={[
          styles.singleDocContainer,
          { width: maxWidth, backgroundColor: isOwn ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.06)' },
          containerStyle,
        ]}
      >
        <View style={styles.docIconWrap}>
          <Icon name="file-text" size={20} color={isOwn ? '#FFFFFF' : '#FF4B33'} />
        </View>
        <View style={styles.docInfo}>
          <Text
            style={[styles.docTitle, { color: isOwn ? '#FFFFFF' : '#1E293B' }]}
            numberOfLines={1}
          >
            {item.name || 'Document Attachment'}
          </Text>
          <Text
            style={[styles.docSub, { color: isOwn ? 'rgba(255,255,255,0.7)' : '#64748B' }]}
          >
            Tap to open
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  // --- 2 ITEMS (Equal 2 columns) ---
  if (count === 2) {
    const colWidth = (maxWidth - 4) / 2;
    return (
      <View style={[{ position: 'relative', width: maxWidth }, containerStyle]}>
        <View style={[styles.gridContainer, { width: maxWidth }, imageContainerStyle]}>
          {items.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => handleItemPress(item, idx)}
              onLongPress={onLongPress}
              activeOpacity={0.9}
              style={[styles.twoColBox, { width: colWidth, height: 150 }]}
            >
              {item.type === 'video' ? (
                <View style={styles.gridVideoThumb}>
                  <Icon name="play" size={20} color="#FFFFFF" />
                </View>
              ) : (
                <CachedImage
                  uri={item.url}
                  style={StyleSheet.absoluteFillObject}
                  resizeMode="cover"
                />
              )}
            </TouchableOpacity>
          ))}
        </View>
        {overlayMeta ? (
          <View style={styles.floatingMetaOverlay}>
            {overlayMeta}
          </View>
        ) : null}
      </View>
    );
  }

  // --- 3 ITEMS (WhatsApp 1 Left Hero + 2 Stacked Right) ---
  if (count === 3) {
    const leftWidth = Math.floor(maxWidth * 0.54);
    const rightWidth = maxWidth - leftWidth - 4;
    const heroHeight = 196;
    const subHeight = (heroHeight - 4) / 2;

    return (
      <View style={[{ position: 'relative', width: maxWidth }, containerStyle]}>
        <View style={[styles.threeColRow, { width: maxWidth }, imageContainerStyle]}>
          {/* Left Hero */}
          <TouchableOpacity
            onPress={() => handleItemPress(items[0], 0)}
            onLongPress={onLongPress}
            activeOpacity={0.9}
            style={[styles.threeLeftHero, { width: leftWidth, height: heroHeight }]}
          >
            {items[0].type === 'video' ? (
              <View style={styles.gridVideoThumb}>
                <Icon name="play" size={24} color="#FFFFFF" />
              </View>
            ) : (
              <CachedImage
                uri={items[0].url}
                style={StyleSheet.absoluteFillObject}
                resizeMode="cover"
              />
            )}
          </TouchableOpacity>

          {/* Right Stacked 2 */}
          <View style={[styles.threeRightStack, { width: rightWidth, height: heroHeight }]}>
            {items.slice(1, 3).map((item, idx) => {
              const actualIdx = idx + 1;
              return (
                <TouchableOpacity
                  key={actualIdx}
                  onPress={() => handleItemPress(item, actualIdx)}
                  onLongPress={onLongPress}
                  activeOpacity={0.9}
                  style={[styles.threeRightBox, { width: rightWidth, height: subHeight }]}
                >
                  {item.type === 'video' ? (
                    <View style={styles.gridVideoThumb}>
                      <Icon name="play" size={18} color="#FFFFFF" />
                    </View>
                  ) : (
                    <CachedImage
                      uri={item.url}
                      style={StyleSheet.absoluteFillObject}
                      resizeMode="cover"
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        {overlayMeta ? (
          <View style={styles.floatingMetaOverlay}>
            {overlayMeta}
          </View>
        ) : null}
      </View>
    );
  }

  // --- 4+ ITEMS (2x2 Grid with "+N" badge on 4th tile) ---
  const displayItems = items.slice(0, 4);
  const remainingCount = count - 4;
  const tileWidth = (maxWidth - 4) / 2;
  const tileHeight = 110;

  return (
    <View style={[{ position: 'relative', width: maxWidth }, containerStyle]}>
      <View style={[styles.gridWrap, { width: maxWidth }, imageContainerStyle]}>
        {displayItems.map((item, idx) => {
          const isFourth = idx === 3;
          const hasMore = isFourth && remainingCount > 0;

          return (
            <TouchableOpacity
              key={idx}
              onPress={() => handleItemPress(item, idx)}
              onLongPress={onLongPress}
              activeOpacity={0.9}
              style={[styles.tileBox, { width: tileWidth, height: tileHeight }]}
            >
              {item.type === 'video' ? (
                <View style={styles.gridVideoThumb}>
                  <Icon name="play" size={20} color="#FFFFFF" />
                </View>
              ) : (
                <CachedImage
                  uri={item.url}
                  style={StyleSheet.absoluteFillObject}
                  resizeMode="cover"
                />
              )}
              {hasMore && (
                <View style={styles.moreOverlay}>
                  <Text style={styles.moreText}>+{remainingCount + 1}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      {overlayMeta ? (
        <View style={styles.floatingMetaOverlay}>
          {overlayMeta}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  singleImageContainer: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  floatingMetaOverlay: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    zIndex: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  singleImage: {
    width: '100%',
    height: '100%',
  },
  singleVideoContainer: {
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 75, 51, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  videoLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  singleDocContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    gap: 10,
  },
  docIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docInfo: {
    flex: 1,
  },
  docTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  docSub: {
    fontSize: 11,
    marginTop: 2,
  },
  gridContainer: {
    flexDirection: 'row',
    gap: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  twoColBox: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  threeColRow: {
    flexDirection: 'row',
    gap: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  threeLeftHero: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  threeRightStack: {
    justifyContent: 'space-between',
  },
  threeRightBox: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  tileBox: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  gridVideoThumb: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
