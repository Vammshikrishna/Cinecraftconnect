import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, StyleProp, ViewStyle, DimensionValue } from 'react-native';
import { Icon } from '../common/Icon';
import { useUserSettings } from '../../hooks/useUserSettings';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

export type ExploreItemType =
  | 'project'
  | 'user'
  | 'discussion'
  | 'post'
  | 'announcement'
  | 'vendor'
  | 'marketplace'
  | 'company';

export interface ExploreItem {
  id: string;
  type: ExploreItemType;
  title?: string;
  name?: string;
  username?: string;
  full_name?: string;
  description?: string;
  content?: string;
  avatar_url?: string;
  image_url?: string;
  video_url?: string;
  logo_url?: string;
  author?: {
    username?: string;
    full_name?: string;
    is_verified?: boolean;
  } | null;
  is_verified?: boolean;
  price_per_day?: number;
  listing_type?: 'equipment' | 'location';
  business_name?: string;
  location?: string;
  city?: string;
  category?: string;
  phone?: string;
  email?: string;
  status?: string;
  average_rating?: number;
  review_count?: number;
  like_count?: number;
  comment_count?: number;
  genre?: string[];
  craft?: string;
  member_count?: number;
  industry?: string | string[];
  headquarters?: string;
}

export interface ExploreCardProps {
  item: ExploreItem;
  navigation: any;
  cardWidth?: DimensionValue;
  cardHeight?: DimensionValue;
  style?: StyleProp<ViewStyle>;
}

// 4 Corner brackets component matching Web CornerBrackets
const CornerBrackets = () => (
  <>
    <View style={[styles.bracket, styles.bracketTL]} />
    <View style={[styles.bracket, styles.bracketTR]} />
    <View style={[styles.bracket, styles.bracketBL]} />
    <View style={[styles.bracket, styles.bracketBR]} />
  </>
);

// Black pill type badge matching Web TypeBadge
const TypeBadge = ({ iconName, label }: { iconName: string; label: string }) => (
  <View style={styles.typeBadgeContainer}>
    <Icon name={iconName} size={10} color="rgba(255,255,255,0.9)" />
    <Text style={styles.typeBadgeText}>{label.toUpperCase()}</Text>
  </View>
);

export const ExploreCard: React.FC<ExploreCardProps> = React.memo(({
  item,
  navigation,
  cardWidth,
  cardHeight,
  style,
}) => {
  const { themeColors, isDark } = useUserSettings();
  const [imgError, setImgError] = useState(false);
  const themeInner = { backgroundColor: themeColors.bgCard, borderColor: themeColors.border };

  const dynamicCardStyle: StyleProp<ViewStyle> = [
    styles.cardBox,
    cardWidth !== undefined ? { width: cardWidth } : null,
    cardHeight !== undefined ? { height: cardHeight } : null,
    cardWidth !== undefined ? { marginBottom: 0 } : null,
    style,
  ];

  const getGradientBg = (id: string) => {
    const colors = ['#EC4899', '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B'];
    const idx = (id || '0').charCodeAt(0) % colors.length;
    return colors[idx];
  };

  const renderContent = () => {
    switch (item.type) {
      case 'post': {
        // Video post
        if (item.video_url) {
          return (
            <TouchableOpacity
              style={dynamicCardStyle}
              activeOpacity={0.92}
              onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
            >
              <View style={styles.mediaContainer}>
                {item.image_url && !imgError ? (
                  <Image
                    source={{ uri: item.image_url }}
                    style={styles.fullImg}
                    resizeMode="cover"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <View style={[styles.fullImg, { backgroundColor: '#0F172A' }]} />
                )}
                <TypeBadge iconName="layers" label="POST" />
                <View style={styles.playIconOverlay}>
                  <Icon name="play" size={20} color="#FFFFFF" fill="#FFFFFF" />
                </View>
              </View>
            </TouchableOpacity>
          );
        }

        // Image post
        if (item.image_url && !imgError) {
          return (
            <TouchableOpacity
              style={dynamicCardStyle}
              activeOpacity={0.92}
              onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
            >
              <View style={styles.mediaContainer}>
                <Image
                  source={{ uri: item.image_url }}
                  style={styles.fullImg}
                  resizeMode="cover"
                  onError={() => setImgError(true)}
                />
                <TypeBadge iconName="layers" label="POST" />
              </View>
            </TouchableOpacity>
          );
        }

        // Job Share post
        if (item.content?.includes('JOB_SHARE::')) {
          let shareData: any = {};
          try {
            const parts = item.content.split('JOB_SHARE::');
            shareData = JSON.parse(parts[parts.length - 1].trim());
          } catch (e) { }

          return (
            <TouchableOpacity
              style={dynamicCardStyle}
              activeOpacity={0.92}
              onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
            >
              <View style={[styles.cardInner, styles.hiringBg]}>
                <TypeBadge iconName="megaphone" label="HIRING" />
                <View style={styles.hiringCenter}>
                  <View style={styles.hiringLogoBox}>
                    {shareData.logoUrl && !imgError ? (
                      <Image
                        source={{ uri: shareData.logoUrl }}
                        style={styles.fullImg}
                        onError={() => setImgError(true)}
                      />
                    ) : (
                      <Text style={styles.hiringLogoFallback}>
                        {(shareData.company || 'J').charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <Text style={styles.hiringTitle} numberOfLines={2}>
                    {shareData.title || 'Production Opening'}
                  </Text>
                  <View style={styles.applyNowPill}>
                    <Text style={styles.applyNowText}>Apply Now</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }

        // Text Insight post
        const textExcerpt = (item.content || '').split('JOB_SHARE::')[0].split('POST_SHARE::')[0].trim();
        return (
          <TouchableOpacity
            style={dynamicCardStyle}
            activeOpacity={0.92}
            onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
          >
            <View style={[styles.cardInner, { backgroundColor: getGradientBg(item.id) }]}>
              <TypeBadge iconName="message-square" label="INSIGHT" />
              <View style={styles.centerTextContainer}>
                <Text style={styles.insightText} numberOfLines={5}>
                  {textExcerpt}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      }

      case 'project': {
        const projectImage = item.image_url;
        return (
          <TouchableOpacity
            style={dynamicCardStyle}
            activeOpacity={0.92}
            onPress={() => navigation.navigate('ProjectSpace', { projectId: item.id })}
          >
            <CornerBrackets />
            <View style={[styles.cardInner, themeInner]}>
              <TypeBadge iconName="layers" label="PROJECT SPACE" />
              <View style={styles.cardHeroMedia}>
                {projectImage && !imgError ? (
                  <Image
                    source={{ uri: projectImage }}
                    style={styles.fullImg}
                    resizeMode="cover"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <View style={[styles.fullImg, { backgroundColor: getGradientBg(item.id) }]}>
                    <Icon name="film" size={24} color="rgba(255,255,255,0.4)" />
                  </View>
                )}
                <View style={styles.projectStatusPill}>
                  <Text style={styles.projectStatusText}>
                    STATUS // {(item.status || 'ACTIVE').toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                <Text style={[styles.projectTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
                  {item.title || item.name}
                </Text>
                <Text style={[styles.projectDesc, { color: themeColors.textSecondary }]} numberOfLines={2}>
                  {item.description || 'Professional production workspace for cinematic collaboration.'}
                </Text>

                <View style={[styles.projectFooter, { borderTopColor: themeColors.divider }]}>
                  {!!item.genre?.[0] && (
                    <View style={styles.metaIconRow}>
                      <Icon name="film" size={9} color={ORANGE} />
                      <Text style={[styles.metaIconText, { color: themeColors.textSecondary }]} numberOfLines={1}>
                        GENRE // {item.genre[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                  {!!item.location && (
                    <View style={styles.metaIconRow}>
                      <Icon name="map-pin" size={9} color={ORANGE} />
                      <Text style={[styles.metaIconText, { color: themeColors.textSecondary }]} numberOfLines={1}>
                        LOC // {item.location.toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </TouchableOpacity>
        );
      }

      case 'user': {
        const craftsStr = item.craft || 'CREATOR';
        const initial = (item.full_name || item.username || 'U').charAt(0).toUpperCase();

        return (
          <TouchableOpacity
            style={dynamicCardStyle}
            activeOpacity={0.92}
            onPress={() => navigation.navigate('PublicProfile', { userId: item.id })}
          >
            <CornerBrackets />
            <View style={[styles.cardInner, styles.userCardCenter, themeInner]}>
              <View style={styles.userAvatarCircle}>
                {item.avatar_url && !imgError ? (
                  <Image
                    source={{ uri: item.avatar_url }}
                    style={styles.fullImg}
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <View style={[styles.fullImg, { backgroundColor: getGradientBg(item.id) }]}>
                    <Text style={styles.userInitialText}>{initial}</Text>
                  </View>
                )}
              </View>

              <View style={styles.userNameRow}>
                <Text style={[styles.userFullName, { color: themeColors.textPrimary }]} numberOfLines={1}>
                  {item.full_name || item.username}
                </Text>
                {!!item.is_verified && (
                  <Icon name="badge-check" size={13} color={ORANGE} fill={ORANGE} />
                )}
              </View>

              <View style={styles.userCraftPill}>
                <Icon name="zap" size={7} color={ORANGE} fill={ORANGE} />
                <Text style={styles.userCraftText} numberOfLines={1}>
                  {craftsStr.toUpperCase()}
                </Text>
              </View>

              <Text style={[styles.userBioQuote, { color: themeColors.textSecondary }]} numberOfLines={2}>
                "{item.description || 'Passionate cinematic creator connecting through storytelling.'}"
              </Text>
            </View>
          </TouchableOpacity>
        );
      }

      case 'discussion': {
        return (
          <TouchableOpacity
            style={dynamicCardStyle}
            activeOpacity={0.92}
            onPress={() => navigation.navigate('DiscussionRoomDetail', { roomId: item.id })}
          >
            <CornerBrackets />
            <View style={[styles.cardInner, styles.discPadding, themeInner]}>
              <View style={styles.discHeaderRow}>
                <View style={styles.discIconBox}>
                  <Icon name="message-square" size={12} color={ORANGE} />
                </View>
                <View style={styles.discHeaderTextCol}>
                  <Text style={styles.discHeaderText1}>DISCUSSION</Text>
                  <Text style={styles.discHeaderText2}>ROOM</Text>
                </View>
              </View>

              <Text style={[styles.discRoomTitle, { color: themeColors.textPrimary }]} numberOfLines={2}>
                {item.title}
              </Text>

              <View style={styles.discDescLeftBar}>
                <Text style={[styles.discDescText, { color: themeColors.textSecondary }]} numberOfLines={2}>
                  {item.description || 'Verified cinematic craft discussion room.'}
                </Text>
              </View>

              <View style={styles.discFooterRow}>
                <Icon name="users" size={10} color={ORANGE} />
                <Text style={[styles.discMemberText, { color: themeColors.textSecondary }]}>
                  {item.member_count || 0} MEMBERS
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      }

      case 'announcement': {
        return (
          <TouchableOpacity
            style={dynamicCardStyle}
            activeOpacity={0.92}
            onPress={() => navigation.navigate('Announcements')}
          >
            <View style={[styles.cardInner, styles.newsBg]}>
              <TypeBadge iconName="megaphone" label="NEWS" />
              <View style={styles.newsCenter}>
                <View style={styles.newsIconCircle}>
                  <Icon name="megaphone" size={22} color="#F97316" />
                </View>
                <Text style={styles.newsTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <View style={styles.readUpdateBtn}>
                  <Text style={styles.readUpdateText}>Read Update</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        );
      }

      case 'company': {
        const initial = (item.name || 'S').charAt(0).toUpperCase();
        const ind = Array.isArray(item.industry)
          ? item.industry[0]
          : item.industry || 'PRODUCTION';

        return (
          <TouchableOpacity
            style={dynamicCardStyle}
            activeOpacity={0.92}
            onPress={() => navigation.navigate('CompanyPageDetail', { pageId: item.id })}
          >
            <CornerBrackets />
            <View style={[styles.cardInner, themeInner]}>
              <View style={styles.studioTopLikesBadge}>
                <Icon name="users" size={9} color={ORANGE} />
                <Text style={styles.studioTopLikesText}>{item.like_count || 0}</Text>
              </View>

              <View style={styles.companyHeroBanner}>
                {item.image_url && !imgError ? (
                  <Image
                    source={{ uri: item.image_url }}
                    style={styles.fullImg}
                    resizeMode="cover"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <View style={[styles.fullImg, { backgroundColor: '#1E293B' }]}>
                    <Icon name="company" size={24} color="rgba(255,255,255,0.2)" />
                  </View>
                )}
              </View>

              <View style={styles.companyBodyCenter}>
                <View style={styles.companyLogoOverlap}>
                  {item.logo_url && !imgError ? (
                    <Image
                      source={{ uri: item.logo_url }}
                      style={styles.fullImg}
                      onError={() => setImgError(true)}
                    />
                  ) : (
                    <Text style={styles.companyLogoFallbackText}>{initial}</Text>
                  )}
                </View>

                <View style={styles.companyIndBadge}>
                  <Text style={styles.companyIndText} numberOfLines={1}>
                    {ind.toUpperCase()}
                  </Text>
                </View>

                <Text style={[styles.companyName, { color: themeColors.textPrimary }]} numberOfLines={1}>
                  {item.name}
                </Text>

                <View style={styles.companyLocRow}>
                  <Icon name="map-pin" size={8} color={ORANGE} />
                  <Text style={[styles.companyLocText, { color: themeColors.textSecondary }]} numberOfLines={1}>
                    LOC // {(item.location || item.headquarters || 'GLOBAL').toUpperCase()}
                  </Text>
                </View>

                <Text style={[styles.companyDescQuote, { color: themeColors.textSecondary }]} numberOfLines={1}>
                  "{item.description || 'Soulful cinematic entertainment & production.'}"
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      }

      case 'vendor': {
        const initial = (item.business_name || 'V').charAt(0).toUpperCase();

        return (
          <TouchableOpacity
            style={dynamicCardStyle}
            activeOpacity={0.92}
            onPress={() => navigation.navigate('VendorDetail', { vendorId: item.id })}
          >
            <CornerBrackets />
            <View style={[styles.cardInner, themeInner]}>
              <TypeBadge iconName="vendor" label="VENDOR" />
              <View style={styles.vendorLogoBanner}>
                {item.logo_url && !imgError ? (
                  <Image
                    source={{ uri: item.logo_url }}
                    style={styles.fullImg}
                    resizeMode="cover"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <View style={[styles.fullImg, { backgroundColor: getGradientBg(item.id) }]}>
                    <Text style={styles.vendorLogoFallback}>{initial}</Text>
                  </View>
                )}
              </View>

              <View style={styles.cardBody}>
                <View style={styles.catPillRow}>
                  <Text style={styles.catPillText} numberOfLines={1}>
                    CAT // {String(item.category || 'RENTAL').toUpperCase()}
                  </Text>
                </View>
                <Text style={[styles.vendorLocSub, { color: themeColors.textSecondary }]} numberOfLines={1}>
                  LOC // {(item.city || item.location || 'GLOBAL').toUpperCase()}
                </Text>

                <Text style={[styles.vendorName, { color: themeColors.textPrimary }]} numberOfLines={1}>
                  {item.business_name}
                </Text>

                <Text style={[styles.vendorDesc, { color: themeColors.textSecondary }]} numberOfLines={2}>
                  {item.description || 'Verified cinematic craft professional service provider.'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      }

      case 'marketplace': {
        const listingType = item.listing_type || 'EQUIPMENT';
        return (
          <TouchableOpacity
            style={dynamicCardStyle}
            activeOpacity={0.92}
            onPress={() => navigation.navigate('MarketplaceDetail', { listingId: item.id })}
          >
            <CornerBrackets />
            <View style={[styles.cardInner, themeInner]}>
              <TypeBadge iconName="shopping-bag" label={listingType.toUpperCase()} />
              <View style={styles.gearImageBanner}>
                {item.image_url && !imgError ? (
                  <Image
                    source={{ uri: item.image_url }}
                    style={styles.fullImg}
                    resizeMode="cover"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <View style={[styles.fullImg, { backgroundColor: '#334155' }]}>
                    <Icon name="shopping-bag" size={24} color="rgba(255,255,255,0.4)" />
                  </View>
                )}
              </View>

              <View style={styles.cardBody}>
                <View style={styles.gearPriceRow}>
                  <View style={styles.catBluePill}>
                    <Text style={styles.catBlueText} numberOfLines={1}>
                      CAT // {String(item.category || 'GEAR').toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.gearPriceText}>
                    ₹{item.price_per_day ? item.price_per_day.toLocaleString() : '0'}
                  </Text>
                </View>

                <Text style={[styles.gearLocSub, { color: themeColors.textSecondary }]} numberOfLines={1}>
                  LOC // {(item.location || 'GLOBAL').toUpperCase()}
                </Text>

                <Text style={[styles.gearTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
                  {item.title}
                </Text>

                <Text style={[styles.gearDesc, { color: themeColors.textSecondary }]} numberOfLines={2}>
                  {item.description || 'Verified cinematic production resource listing.'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      }

      default:
        return null;
    }
  };

  return renderContent();
});

const styles = StyleSheet.create({
  cardBox: {
    width: '48%',
    height: 225,
    marginBottom: 12,
    position: 'relative',
  },
  cardInner: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  fullImg: {
    width: '100%',
    height: '100%',
  },
  bracket: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderColor: ORANGE,
    zIndex: 20,
  },
  bracketTL: {
    top: 4,
    left: 4,
    borderTopWidth: 1.5,
    borderLeftWidth: 1.5,
  },
  bracketTR: {
    top: 4,
    right: 4,
    borderTopWidth: 1.5,
    borderRightWidth: 1.5,
  },
  bracketBL: {
    bottom: 4,
    left: 4,
    borderBottomWidth: 1.5,
    borderLeftWidth: 1.5,
  },
  bracketBR: {
    bottom: 4,
    right: 4,
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
  },
  typeBadgeContainer: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 15,
  },
  typeBadgeText: {
    color: '#FFFFFF',
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  mediaContainer: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
  },
  playIconOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 15,
  },
  hiringBg: {
    backgroundColor: '#FFF7F5',
    borderColor: '#FFE5DF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  hiringCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  hiringLogoBox: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  hiringLogoFallback: {
    fontSize: 20,
    fontWeight: '900',
    color: ORANGE,
  },
  hiringTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: INK,
    fontFamily: 'Lora-Bold',
    textAlign: 'center',
  },
  applyNowPill: {
    backgroundColor: ORANGE,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  applyNowText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '900',
  },
  centerTextContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    marginTop: 16,
  },
  insightText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    fontFamily: 'Lora-Bold',
    textAlign: 'center',
    lineHeight: 18,
  },
  cardHeroMedia: {
    width: '100%',
    height: 95,
    position: 'relative',
    backgroundColor: '#0F172A',
  },
  projectStatusPill: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: ORANGE,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  projectStatusText: {
    color: '#FFFFFF',
    fontSize: 7.5,
    fontWeight: '900',
  },
  cardBody: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
  },
  projectTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: INK,
    fontFamily: 'Lora-Bold',
  },
  projectDesc: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  projectFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 6,
    gap: 2,
  },
  metaIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaIconText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#64748B',
  },
  userCardCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  userAvatarCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    marginBottom: 6,
  },
  userInitialText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 54,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  userFullName: {
    fontSize: 12.5,
    fontWeight: '900',
    color: INK,
    fontFamily: 'Lora-Bold',
  },
  userCraftPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 6,
  },
  userCraftText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: ORANGE,
  },
  userBioQuote: {
    fontSize: 10,
    color: '#64748B',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  discPadding: {
    padding: 12,
    justifyContent: 'space-between',
  },
  discHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  discIconBox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discHeaderTextCol: {
    justifyContent: 'center',
  },
  discHeaderText1: {
    fontSize: 8.5,
    fontWeight: '900',
    color: INK,
  },
  discHeaderText2: {
    fontSize: 7.5,
    fontWeight: '900',
    color: ORANGE,
  },
  discRoomTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: ORANGE,
    fontFamily: 'Lora-Bold',
    marginVertical: 4,
  },
  discDescLeftBar: {
    borderLeftWidth: 2,
    borderLeftColor: '#FFE5DF',
    paddingLeft: 6,
  },
  discDescText: {
    fontSize: 10,
    color: '#64748B',
    fontStyle: 'italic',
  },
  discFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  discMemberText: {
    fontSize: 8.5,
    fontWeight: '900',
    color: ORANGE,
  },
  newsBg: {
    backgroundColor: '#FFF7F5',
    borderColor: '#FFE5DF',
    padding: 12,
  },
  newsCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  newsIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFE5DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  newsTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: INK,
    fontFamily: 'Lora-Bold',
    textAlign: 'center',
  },
  readUpdateBtn: {
    borderWidth: 1,
    borderColor: ORANGE,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  readUpdateText: {
    color: ORANGE,
    fontSize: 9,
    fontWeight: '900',
  },
  studioTopLikesBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#0D0D0D',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 15,
  },
  studioTopLikesText: {
    color: '#FFFFFF',
    fontSize: 8.5,
    fontWeight: '900',
  },
  companyHeroBanner: {
    width: '100%',
    height: 80,
    backgroundColor: '#0F172A',
  },
  companyBodyCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
    marginTop: -22,
  },
  companyLogoOverlap: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: ORANGE,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  companyLogoFallbackText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  companyIndBadge: {
    backgroundColor: ORANGE,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: -8,
    marginBottom: 4,
  },
  companyIndText: {
    color: '#FFFFFF',
    fontSize: 7.5,
    fontWeight: '900',
  },
  companyName: {
    fontSize: 13,
    fontWeight: '900',
    color: INK,
    fontFamily: 'Lora-Bold',
    textAlign: 'center',
  },
  companyLocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginVertical: 2,
  },
  companyLocText: {
    fontSize: 8.5,
    color: '#64748B',
    fontWeight: '800',
  },
  companyDescQuote: {
    fontSize: 9.5,
    color: '#64748B',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  vendorLogoBanner: {
    width: '100%',
    height: 95,
    backgroundColor: '#FFF7F5',
  },
  vendorLogoFallback: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 90,
  },
  catPillRow: {
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  catPillText: {
    fontSize: 7.5,
    fontWeight: '900',
    color: ORANGE,
  },
  vendorLocSub: {
    fontSize: 8,
    fontWeight: '800',
    color: '#64748B',
    marginTop: 2,
  },
  vendorName: {
    fontSize: 13,
    fontWeight: '900',
    color: INK,
    fontFamily: 'Lora-Bold',
    marginTop: 2,
  },
  vendorDesc: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  gearImageBanner: {
    width: '100%',
    height: 95,
    backgroundColor: '#F1F5F9',
  },
  gearPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catBluePill: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  catBlueText: {
    fontSize: 7.5,
    fontWeight: '900',
    color: '#2563EB',
  },
  gearPriceText: {
    fontSize: 11,
    fontWeight: '900',
    color: ORANGE,
  },
  gearLocSub: {
    fontSize: 8,
    fontWeight: '800',
    color: '#64748B',
    marginTop: 2,
  },
  gearTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: INK,
    fontFamily: 'Lora-Bold',
    marginTop: 2,
  },
  gearDesc: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
});

export default ExploreCard;
