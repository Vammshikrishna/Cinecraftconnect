import { CachedImage } from '../../common/CachedImage';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Icon } from '../../common/Icon';
import { useUserSettings } from '../../../hooks/useUserSettings';
import { UniversalShareSheet } from '../../common/UniversalShareSheet';

const ORANGE = '#FF4B33';

export interface ProjectItem {
  id: string;
  title: string;
  description?: string | null;
  status?: string | null;
  location?: string | null;
  genre?: string[] | string | null;
  required_roles?: string[] | null;
  roles_count?: number | null;
  image_url?: string | null;
  cover_url?: string | null;
  created_at?: string;
  creator?: {
    full_name?: string | null;
    avatar_url?: string | null;
  } | null;
}

interface FeedProjectsWidgetProps {
  projects: ProjectItem[];
  onSeeAll?: () => void;
  onSelectProject?: (project: ProjectItem) => void;
  onViewSpace?: (project: ProjectItem) => void;
  onToggleBookmark?: (projectId: string) => void;
  bookmarkedIds?: Record<string, boolean>;
}

export const FeedProjectsWidget: React.FC<FeedProjectsWidgetProps> = ({
  projects,
  onSeeAll,
  onSelectProject,
  onViewSpace,
  onToggleBookmark,
  bookmarkedIds = {},
}) => {
  const { themeColors, isDark } = useUserSettings();
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [selectedProj, setSelectedProj] = useState<any>(null);

  if (!projects || projects.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.sectionHeader}>
        <View style={styles.titleGroup}>
          <Icon name="film" size={17} color={ORANGE} />
          <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Trending ProjectSpaces</Text>
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
        {projects.map((proj) => {
          const displayImage = proj.cover_url || proj.image_url;
          const isBookmarked = !!bookmarkedIds[proj.id];

          // Compute roles count
          let rolesCount = 0;
          if (Array.isArray(proj.required_roles)) {
            rolesCount = proj.required_roles.length;
          } else if (typeof proj.roles_count === 'number') {
            rolesCount = proj.roles_count;
          }

          // Format genres
          let genreStr = 'ACTION';
          if (Array.isArray(proj.genre) && proj.genre.length > 0) {
            genreStr = proj.genre.map((g: any) => String(g).toUpperCase()).join(', ');
          } else if (typeof proj.genre === 'string' && proj.genre) {
            genreStr = proj.genre.toUpperCase();
          }

          const statusStr = String(proj.status || 'ACTIVE').toUpperCase();
          const locStr = proj.location || 'HYDERABAD, TELANGANA, IND';

          // Format timestamp
          const timeAgoStr = proj.created_at
            ? new Date(proj.created_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })
            : 'Recent';

          return (
            <TouchableOpacity
              key={proj.id}
              style={[
                styles.card,
                {
                  backgroundColor: themeColors.bgCard,
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                },
              ]}
              activeOpacity={0.92}
              onPress={() => onSelectProject?.(proj)}
            >
              {/* Top Row: Left Poster + Right Info */}
              <View style={styles.cardTopRow}>
                {/* Left Square Poster */}
                <View style={[styles.cardPosterContainer, { backgroundColor: themeColors.chipBg }]}>
                  {displayImage ? (
                    <CachedImage uri={displayImage} style={styles.cardPosterImage} resizeMode="cover" />
                  ) : (
                    <LinearGradient
                      colors={['#FF5E3A', '#FFA41B']}
                      style={styles.cardPosterPlaceholder}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Icon name="film" size={24} color="#FFFFFF" strokeWidth={2.2} />
                    </LinearGradient>
                  )}
                </View>

                {/* Right Info Column */}
                <View style={styles.cardInfoColumn}>
                  {/* Header Sub-row: Scene Status Badge + Top Actions */}
                  <View style={styles.sceneBookmarkRow}>
                    <View
                      style={[
                        styles.sceneBadge,
                        {
                          backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
                          borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.25)',
                        },
                      ]}
                    >
                      <View style={styles.sceneGreenDot} />
                      <Text style={[styles.sceneBadgeText, { color: isDark ? '#34D399' : '#059669' }]}>
                        [SCENE: {statusStr}]
                      </Text>
                    </View>

                    <View style={styles.topActionsGroup}>
                      <TouchableOpacity
                        onPress={() => onToggleBookmark?.(proj.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={styles.actionIconTouch}
                      >
                        <Icon
                          name="bookmark"
                          size={15}
                          color={isBookmarked ? ORANGE : (isDark ? '#9CA3AF' : '#64748B')}
                          fill={isBookmarked ? ORANGE : 'none'}
                          strokeWidth={isBookmarked ? 2.5 : 1.8}
                        />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionIconTouch}
                        onPress={() => {
                          setSelectedProj(proj);
                          setShareSheetVisible(true);
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Icon name="more-vertical" size={15} color={isDark ? '#9CA3AF' : '#64748B'} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Title */}
                  <Text style={[styles.projectTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
                    {proj.title}
                  </Text>

                  {/* Subtitle / Description */}
                  <Text style={[styles.projectLogline, { color: themeColors.textSecondary }]} numberOfLines={1}>
                    {proj.description || 'Exploring creative collaborations & production spaces.'}
                  </Text>
                </View>
              </View>

              {/* Location Tag */}
              <View
                style={[
                  styles.slugTagLocationRow,
                  {
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                  },
                ]}
              >
                <Icon name="map-pin" size={10.5} color={isDark ? '#94A3B8' : '#64748B'} />
                <Text style={[styles.slugTagGrayText, { color: isDark ? '#CBD5E1' : '#475569' }]} numberOfLines={1}>
                  LOC // {locStr.toUpperCase()}
                </Text>
              </View>

              {/* Roles & Genre Chips */}
              <View style={styles.slugTagsSecondaryRow}>
                {/* Roles Open */}
                <TouchableOpacity
                  style={[
                    styles.slugTagRed,
                    {
                      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2',
                      borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)',
                    },
                  ]}
                  onPress={() => onSelectProject?.(proj)}
                  activeOpacity={0.8}
                >
                  <Icon name="users" size={10} color="#EF4444" />
                  <Text style={styles.slugTagRedText}>ROLES // {rolesCount} OPEN</Text>
                </TouchableOpacity>

                {/* Genre */}
                <View
                  style={[
                    styles.slugTagGray,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                      borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                    },
                  ]}
                >
                  <Icon name="film" size={10} color={isDark ? '#94A3B8' : '#64748B'} />
                  <Text style={[styles.slugTagGrayText, { color: isDark ? '#CBD5E1' : '#475569' }]} numberOfLines={1}>
                    GENRE // {genreStr}
                  </Text>
                </View>
              </View>

              {/* Footer Row: Time Ago + Action Buttons */}
              <View
                style={[
                  styles.cardFooterRow,
                  { borderTopColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9' },
                ]}
              >
                <Text style={[styles.timeAgoText, { color: isDark ? '#94A3B8' : '#94A3B8' }]}>
                  {timeAgoStr}
                </Text>

                <View style={styles.footerActionsGroup}>
                  {/* Roles Button */}
                  <TouchableOpacity
                    style={[
                      styles.rolesActionBtn,
                      {
                        backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2',
                        borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.25)',
                      },
                    ]}
                    onPress={() => onSelectProject?.(proj)}
                    activeOpacity={0.8}
                  >
                    <Icon name="users" size={10} color="#EF4444" />
                    <Text style={styles.rolesActionBtnText}>Roles ({rolesCount})</Text>
                  </TouchableOpacity>

                  {/* View Space Button */}
                  <TouchableOpacity
                    style={styles.viewSpaceBtn}
                    onPress={() => (onViewSpace ? onViewSpace(proj) : onSelectProject?.(proj))}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.viewSpaceBtnText}>View Space</Text>
                    <Icon name="chevron-right" size={11} color="#FFFFFF" strokeWidth={2.8} />
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <UniversalShareSheet
        visible={shareSheetVisible}
        onClose={() => setShareSheetVisible(false)}
        title={selectedProj?.title || 'ProjectSpace'}
        shareUrl={`https://cinecraftconnect.com/projects/${selectedProj?.id}`}
        itemType="project"
        itemData={selectedProj}
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
    marginBottom: 10,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sectionTitle: {
    color: '#0D0D0D',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  seeAllText: {
    color: '#4B5563',
    fontSize: 12.5,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 14,
    gap: 12,
  },
  card: {
    width: 310,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardPosterContainer: {
    width: 66,
    height: 66,
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardPosterImage: {
    width: '100%',
    height: '100%',
  },
  cardPosterPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfoColumn: {
    flex: 1,
    justifyContent: 'space-between',
    minHeight: 66,
  },
  sceneBookmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  sceneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4.5,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    paddingHorizontal: 6.5,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  sceneGreenDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#10B981',
  },
  sceneBadgeText: {
    color: '#059669',
    fontSize: 8.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  topActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  actionIconTouch: {
    padding: 2,
  },
  projectTitle: {
    color: '#0F172A',
    fontSize: 15.5,
    fontFamily: Platform.OS === 'ios' ? 'Lora-Bold' : 'serif',
    fontWeight: '800',
    letterSpacing: -0.2,
    marginTop: 2,
  },
  projectLogline: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '400',
    marginTop: 1,
  },
  slugTagLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 7.5,
    paddingVertical: 3,
    borderRadius: 5,
    alignSelf: 'flex-start',
    marginTop: 8,
    maxWidth: '100%',
  },
  slugTagsSecondaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 5.5,
    marginTop: 6,
  },
  slugTagGray: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 7.5,
    paddingVertical: 3,
    borderRadius: 5,
  },
  slugTagGrayText: {
    color: '#475569',
    fontSize: 8.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  slugTagRed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 7.5,
    paddingVertical: 3,
    borderRadius: 5,
  },
  slugTagRedText: {
    color: '#EF4444',
    fontSize: 8.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 6,
  },
  timeAgoText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '500',
  },
  footerActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rolesActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3.5,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    paddingHorizontal: 7.5,
    paddingVertical: 4,
    borderRadius: 7,
  },
  rolesActionBtnText: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '700',
  },
  viewSpaceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2.5,
    backgroundColor: '#FF4B33',
    paddingHorizontal: 8.5,
    paddingVertical: 4.5,
    borderRadius: 7,
    shadowColor: '#FF4B33',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 2,
  },
  viewSpaceBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
});
