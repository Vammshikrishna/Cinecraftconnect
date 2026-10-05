import { CachedImage } from '../../common/CachedImage';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Linking,
  Share,
} from 'react-native';
import { Icon } from '../../common/Icon';
import { FormattedText } from '../../common/FormattedText';
import { useUserSettings } from '../../../hooks/useUserSettings';
import { UniversalShareSheet } from '../../common/UniversalShareSheet';

const ORANGE = '#FF4B33';
const MUTED = '#6B7280';
const BORDER = '#E5E7EB';

interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  posted_at?: string;
  created_at?: string;
  profiles?: {
    full_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
  } | null;
  company_pages?: {
    id: string;
    name: string;
    logo_url?: string | null;
    slug?: string;
  } | null;
}

interface FeedAnnouncementWidgetProps {
  announcements: AnnouncementItem[];
  onSeeAll?: () => void;
  onDismiss?: (id: string) => void;
}

const extractSpotifyUrl = (text: string): string | null => {
  if (!text) return null;
  const match = text.match(/https?:\/\/open\.spotify\.com\/(track|album|playlist|episode|show)\/[a-zA-Z0-9]+/);
  return match ? match[0] : null;
};

const extractYouTubeId = (text: string): string | null => {
  if (!text) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = text.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
};

const SpotifyBanner: React.FC<{ url: string }> = ({ url }) => {
  const [data, setData] = useState<{ thumbnail_url?: string; title?: string; author_name?: string } | null>(null);

  useEffect(() => {
    fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`)
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch(() => {});
  }, [url]);

  if (!data?.thumbnail_url) return null;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => Linking.openURL(url)}
      style={styles.spotifyCard}
    >
      <Image
        source={{ uri: data.thumbnail_url }}
        style={styles.spotifyBgBlur}
        blurRadius={20}
      />
      <View style={styles.spotifyDarkOverlay} />

      <CachedImage uri={data.thumbnail_url} style={styles.spotifyCover} />

      <View style={styles.spotifyMeta}>
        <View style={styles.spotifyBrandRow}>
          <Icon name="spotify" size={16} />
          <Text style={styles.spotifyBrandText}>SPOTIFY</Text>
        </View>
        <Text style={styles.spotifyTrackTitle} numberOfLines={1}>
          {data.title || 'Spotify Track'}
        </Text>
        {!!data.author_name && (
          <Text style={styles.spotifyArtist} numberOfLines={1}>
            {data.author_name}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

export const FeedAnnouncementWidget: React.FC<FeedAnnouncementWidgetProps> = ({
  announcements,
  onSeeAll,
  onDismiss,
}) => {
  const { themeColors, isDark } = useUserSettings();
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});
  const [sharingAnn, setSharingAnn] = useState<any>(null);
  const [showShareSheet, setShowShareSheet] = useState(false);

  const visibleItems = announcements.filter((item) => !dismissed[item.id]);

  if (visibleItems.length === 0) return null;

  const handleShare = (ann: AnnouncementItem) => {
    setSharingAnn(ann);
    setShowShareSheet(true);
  };

  return (
    <View style={styles.container}>
      {/* Widget Section Header */}
      <View style={styles.sectionHeader}>
        <View style={styles.titleGroup}>
          <Icon name="megaphone" size={17} color={ORANGE} />
          <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Announcements</Text>
        </View>
        <TouchableOpacity onPress={onSeeAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.seeAllText, { color: themeColors.textSecondary }]}>View All →</Text>
        </TouchableOpacity>
      </View>

      {/* Horizontal Carousel */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {visibleItems.map((ann) => {
          const spotifyUrl = extractSpotifyUrl(ann.content);
          const youtubeId = extractYouTubeId(ann.content);
          const authorName =
            ann.company_pages?.name ||
            ann.profiles?.full_name ||
            ann.profiles?.username ||
            'COMMUNITY';
          const timeAgoStr = ann.posted_at || ann.created_at
            ? new Date(ann.posted_at || ann.created_at || '').toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })
            : 'Recent';

          // Clean text caption
          const textCaption = ann.content
            ? ann.content
                .replace(/https?:\/\/open\.spotify\.com\/[^\s]+/g, '')
                .replace(/https?:\/\/[^\s]+/g, '')
                .trim()
            : '';

          return (
            <View
              key={ann.id}
              style={[
                styles.card,
                { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
              ]}
            >
              {/* Card Header */}
              <View style={styles.cardHeader}>
                <View style={styles.avatarIconBox}>
                  {ann.company_pages?.logo_url ? (
                    <CachedImage uri={ann.company_pages.logo_url} style={styles.companyLogo} />
                  ) : (
                    <View style={styles.iconCircle}>
                      <Icon name="megaphone" size={18} color="#FFFFFF" />
                    </View>
                  )}
                </View>

                <View style={styles.headerTextGroup}>
                  <Text style={[styles.annTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
                    {ann.title}
                  </Text>
                  <View style={styles.timeRow}>
                    <Icon name="clock" size={11} color={themeColors.textMuted} />
                    <Text style={[styles.timeText, { color: themeColors.textMuted }]}>{timeAgoStr}</Text>
                  </View>
                </View>

                {/* Dismiss Button */}
                <TouchableOpacity
                  style={styles.dismissBtn}
                  onPress={() => {
                    setDismissed((prev) => ({ ...prev, [ann.id]: true }));
                    onDismiss?.(ann.id);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="x" size={14} color={themeColors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Rich Embedded Media */}
              {spotifyUrl ? (
                <SpotifyBanner url={spotifyUrl} />
              ) : youtubeId ? (
                <TouchableOpacity
                  activeOpacity={0.9}
                  style={styles.youtubeBanner}
                  onPress={() => Linking.openURL(`https://youtube.com/watch?v=${youtubeId}`)}
                >
                  <Image
                    source={{ uri: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` }}
                    style={styles.youtubeThumb}
                  />
                  <View style={styles.youtubeOverlay}>
                    <Icon name="youtube" size={44} />
                  </View>
                </TouchableOpacity>
              ) : null}

              {/* Text Description */}
              {!!textCaption && (
                <FormattedText
                  text={textCaption}
                  numberOfLines={spotifyUrl || youtubeId ? 2 : 4}
                  style={[styles.captionText, { color: themeColors.textSecondary }]}
                />
              )}

              {/* Footer */}
              <View style={[styles.cardFooter, { borderTopColor: themeColors.divider }]}>
                <View
                  style={[
                    styles.fromBadge,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F8FAFC',
                      borderColor: themeColors.border,
                    },
                  ]}
                >
                  <Text style={[styles.fromBadgeText, { color: themeColors.textSecondary }]} numberOfLines={1}>
                    FROM // {authorName.toUpperCase()}
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.shareBtn}
                  onPress={() => handleShare(ann)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="share" size={15} color={themeColors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
      <UniversalShareSheet
        visible={showShareSheet}
        onClose={() => setShowShareSheet(false)}
        title={sharingAnn?.title || 'Announcement'}
        shareUrl={`https://cinecraftconnect.com/announcements/${sharingAnn?.id}`}
        itemType="announcement"
        itemData={sharingAnn}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sectionTitle: {
    color: '#0D0D0D',
    fontSize: 16,
    fontFamily: 'Lora-Bold',
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  seeAllText: {
    color: '#4B5563',
    fontSize: 12,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 12,
  },
  card: {
    width: 290,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  avatarIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    overflow: 'hidden',
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  companyLogo: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F3F4F6',
  },
  headerTextGroup: {
    flex: 1,
    justifyContent: 'center',
  },
  annTitle: {
    color: '#0D0D0D',
    fontSize: 15,
    fontFamily: 'Lora-Bold',
    fontWeight: '700',
    marginBottom: 2,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    color: MUTED,
    fontSize: 11,
    fontFamily: 'WorkSans-Regular',
    fontWeight: '400',
  },
  dismissBtn: {
    padding: 4,
  },
  spotifyCard: {
    height: 96,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  spotifyBgBlur: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  spotifyDarkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(18, 18, 18, 0.85)',
  },
  spotifyCover: {
    width: 74,
    height: 74,
    borderRadius: 10,
    backgroundColor: '#333',
  },
  spotifyMeta: {
    flex: 1,
    justifyContent: 'center',
  },
  spotifyBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 3,
  },
  spotifyDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#1DB954',
  },
  spotifyBrandText: {
    color: '#1DB954',
    fontSize: 10,
    fontFamily: 'Inconsolata-Bold',
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  spotifyTrackTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Lora-Bold',
    fontWeight: '700',
  },
  spotifyArtist: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 11,
    fontFamily: 'WorkSans-Regular',
    marginTop: 2,
  },
  youtubeBanner: {
    height: 110,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 12,
    backgroundColor: '#000',
  },
  youtubeThumb: {
    width: '100%',
    height: '100%',
  },
  youtubeOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  youtubePlayCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 0, 0, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionText: {
    color: '#4B5563',
    fontSize: 13,
    fontFamily: 'WorkSans-Regular',
    fontWeight: '400',
    lineHeight: 18,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  fromBadge: {
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    maxWidth: '80%',
  },
  fromBadgeText: {
    color: '#FF4B33',
    fontSize: 9.5,
    fontFamily: 'Inconsolata-Bold',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  shareBtn: {
    padding: 4,
  },
});
