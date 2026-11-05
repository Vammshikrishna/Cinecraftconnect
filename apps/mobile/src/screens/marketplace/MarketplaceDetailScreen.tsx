import { ReportModal } from '../../components/modals/ReportModal';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Image,
  Alert,
  ActivityIndicator,
  Share,
  InteractionManager,
} from 'react-native';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { getSupabaseClient } from '@cinecraft/api';
import { TabletContainer } from '../../components/common/TabletContainer';
import { useUserSettings } from '../../hooks/useUserSettings';
import { UniversalShareSheet } from '../../components/common/UniversalShareSheet';
import { CachedImage } from '../../components/common/CachedImage';
import { LeaveReviewModal } from '../../components/modals/LeaveReviewModal';
import { BookingRequestModal } from '../../components/marketplace/BookingRequestModal';
import { ScreenSkeleton } from '../../components/common/Skeleton';
import { LoadErrorState } from '../../components/common/LoadErrorState';
import { isTabletDevice } from '../../utils/pageType';
import { useAccountType } from '../../hooks/useAccountType';
import { useAppRole } from '../../hooks/useAppRole';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

export const MarketplaceDetailScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  const { listingId, listingTitle, price, location, imageUrl, owner } = route.params || {};
  const { themeColors, isDark } = useUserSettings();
  const { isFan } = useAccountType();
  const { isInternal } = useAppRole();
  // Booking is for creators and studios; staff only look. Fans have no Marketplace, but the rule is kept here too.
  const canBook = !isFan && !isInternal;

  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const fetchListingDetails = useCallback(async () => {
    if (!listingId) return;
    setLoading(true);
    setLoadError(false);
    try {
      const supabase = getSupabaseClient();
      // Local session (no network round trip) — getUser() used to block everything else.
      const { data: sessData } = await supabase.auth.getSession();
      const user = sessData?.session?.user || null;
      if (user) setCurrentUserId(user.id);

      // The wishlist flag and the listing are independent: request them together.
      const [wishRes, listingRes]: any[] = await Promise.all([
        user
          ? ((supabase as any).from('marketplace_wishlists') as any)
            .select('id').eq('listing_id', listingId).eq('user_id', user.id).maybeSingle()
          : Promise.resolve(null),
        ((supabase as any).from('marketplace_listings') as any).select('*').eq('id', listingId).single(),
      ]);
      if (wishRes?.data) setIsWishlisted(true);
      if (listingRes.error) throw listingRes.error;
      const listingData = listingRes.data;

      // Seller profile and bundle items are independent of each other.
      const sellerPromise = listingData.user_id
        ? ((supabase as any).from('profiles') as any)
          .select('id, username, full_name, avatar_url, craft').eq('id', listingData.user_id).single()
        : Promise.resolve({ data: null });
      const bundlePromise = (async () => {
        if (!listingData.is_bundle) return [] as any[];
        const { data: bItems } = await ((supabase as any).from('marketplace_bundle_items') as any)
          .select('item_id').eq('bundle_id', listingId);
        if (!bItems || bItems.length === 0) return [] as any[];
        const { data: items } = await ((supabase as any).from('marketplace_listings') as any)
          .select('*').in('id', bItems.map((b: any) => b.item_id));
        return items || [];
      })();
      const [sellerRes, bundleItems]: any[] = await Promise.all([sellerPromise, bundlePromise]);
      const profileData = sellerRes?.data || null;

      setListing({
        ...listingData,
        profiles: profileData,
        bundle_items: bundleItems,
      });
      // Count a view (the database de-duplicates per person per day and ignores the owner).
      if (user) (supabase as any).rpc('record_listing_view', { p_listing_id: listingId }).then(() => {}, () => {});
    } catch (e) {
      console.warn('[MarketplaceDetail] Fetch error:', e);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    const interactionTask = InteractionManager.runAfterInteractions(() => {
      fetchListingDetails();
    });
    return () => {
      interactionTask.cancel();
    };
  }, [fetchListingDetails]);

  const toggleWishlist = async () => {
    if (!currentUserId) {
      Alert.alert('Sign In Required', 'Please sign in to save items to your wishlist.');
      return;
    }

    const nextState = !isWishlisted;
    setIsWishlisted(nextState);

    try {
      const supabase = getSupabaseClient();
      let res: any;
      if (!nextState) {
        res = await ((supabase as any).from('marketplace_wishlists') as any)
          .delete()
          .eq('listing_id', listingId)
          .eq('user_id', currentUserId);
      } else {
        res = await ((supabase as any).from('marketplace_wishlists') as any).insert({
          listing_id: listingId,
          user_id: currentUserId,
        });
      }
      if (res?.error) throw res.error;
    } catch (e) {
      console.warn('Wishlist toggle error:', e);
      setIsWishlisted(!nextState);
    }
  };

  const handleShare = () => {
    setShowShareSheet(true);
  };

  const handleContactSeller = () => {
    const sellerId = listing?.profiles?.id || listing?.user_id;
    if (!sellerId) {
      navigation.navigate('Messages');
      return;
    }
    navigation.navigate('Conversation', { recipientId: sellerId, recipientName: listing?.profiles?.full_name || listing?.profiles?.username });
  };

  const handleRequestBooking = () => {
    if (!canBook || !listing) return;
    if (!currentUserId) {
      Alert.alert('Sign In Required', 'Please sign in to request booking.');
      return;
    }
    if (currentUserId === listing?.user_id) {
      navigation.navigate('MyBookings');
      return;
    }
    setBookingModalVisible(true);
  };

  const images =
    listing?.images && listing.images.length > 0
      ? listing.images
      : imageUrl ? [imageUrl] : [];

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.bgScreen }]}>
        <Header title="Listing Details" showLogo={false} onBack={() => navigation.goBack()} />
        <ScreenSkeleton variant="detail" />
      </View>
    );
  }

  if (loadError && !listing) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.bgScreen }]}>
        <Header title="Listing Details" showLogo={false} onBack={() => navigation.goBack()} />
        <LoadErrorState onRetry={fetchListingDetails} />
      </View>
    );
  }

  const title = listing?.title || listingTitle || 'Listing';
  const sellerName = listing?.profiles?.full_name || listing?.profiles?.username || owner || 'Member';
  const sellerAvatar = listing?.profiles?.avatar_url;
  const sellerCraft = listing?.profiles?.craft || '';

  const pricePerDay = listing?.price_per_day
    ? `₹${listing.price_per_day.toLocaleString()}`
    : price || 'Negotiable';
  const pricePerWeek = listing?.price_per_week ? `₹${listing.price_per_week.toLocaleString()}` : null;

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bgScreen }]}>
      <Header
        title="Listing Details"
        showLogo={false}
        onBack={() => navigation.goBack()}
        rightAction={
          <View style={styles.headerRightActions}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={isWishlisted ? "Remove from wishlist" : "Save to wishlist"} accessibilityState={{ selected: isWishlisted }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={toggleWishlist} style={styles.headerIconBtn}>
              <Icon
                name="heart"
                size={18}
                color={isWishlisted ? '#EF4444' : themeColors.textPrimary}
                fill={isWishlisted ? '#EF4444' : 'transparent'}
              />
            </TouchableOpacity>

            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Report" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={() => setReportOpen(true)} style={styles.headerIconBtn}>
              <Icon name="flag" size={18} color={themeColors.iconSecondary} />
            </TouchableOpacity>

            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Share" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={handleShare} style={styles.headerIconBtn}>
              <Icon name="share" size={18} color={themeColors.textPrimary} />
            </TouchableOpacity>
          </View>
        }
      />

      <TabletContainer maxWidth="content" backgroundColor={themeColors.bgScreen}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Main Image View */}
          <View style={styles.mainImageContainer}>
            {images[activeImageIndex] ? (
              <CachedImage uri={images[activeImageIndex]} style={styles.mainImage} resizeMode="cover" />
            ) : (
              <View style={[styles.mainImage, { alignItems: 'center', justifyContent: 'center', backgroundColor: themeColors.chipBg }]}>
                <Icon name="image" size={40} color={themeColors.iconMuted} />
                <Text style={{ color: themeColors.textMuted, marginTop: 8, fontSize: 13 }}>No photos yet</Text>
              </View>
            )}

            {listing?.is_bundle && (
              <View style={styles.bundleBadge}>
                <Text style={styles.bundleBadgeText}>📦 BUNDLE</Text>
              </View>
            )}
          </View>

          {/* Thumbnail Selector Row */}
          {images.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.thumbRow, { backgroundColor: themeColors.bgCard }]}>
              {images.map((img: string, idx: number) => (
                <TouchableOpacity
                  key={idx}
                  onPress={() => setActiveImageIndex(idx)}
                  style={[
                    styles.thumbBox,
                    { borderColor: activeImageIndex === idx ? ORANGE : themeColors.border },
                  ]}
                >
                  <CachedImage uri={img} style={styles.thumbImage} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Main Listing Specs Card */}
          <View style={[styles.card, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
            <View style={styles.categoryConditionRow}>
              <View style={[styles.categoryPill, { backgroundColor: isDark ? 'rgba(255,75,51,0.12)' : '#FFF7F5', borderColor: isDark ? 'rgba(255,75,51,0.25)' : '#FFE5DF' }]}>
                <Text style={styles.categoryPillText}>{(listing?.category || 'EQUIPMENT').toUpperCase()}</Text>
              </View>

              {listing?.condition_grade && (
                <View style={[styles.conditionPill, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
                  <Text style={[styles.conditionPillText, { color: themeColors.textSecondary }]}>Grade {listing.condition_grade}</Text>
                </View>
              )}
            </View>

            <Text style={[styles.titleText, { color: themeColors.textPrimary }]}>{title}</Text>

            <View style={styles.locationRow}>
              <Icon name="map-pin" size={13} color={themeColors.iconSecondary} />
              <Text style={[styles.locationText, { color: themeColors.textSecondary }]}>{listing?.location || location || 'Pan-India'}</Text>
            </View>

            {/* Pricing Row */}
            <View style={[styles.priceCardRow, { backgroundColor: isDark ? '#1F1F1F' : '#F8FAFC', borderColor: themeColors.border }]}>
              <View style={styles.dailyPriceGroup}>
                <Text style={[styles.priceLabelText, { color: themeColors.textSecondary }]}>DAILY RENTAL RATE</Text>
                <View style={styles.priceNumRow}>
                  <Text style={styles.priceNum}>{pricePerDay}</Text>
                  <Text style={[styles.pricePerText, { color: themeColors.textSecondary }]}>/ day</Text>
                </View>
              </View>

              {pricePerWeek && (
                <View style={styles.weeklyPriceGroup}>
                  <Text style={[styles.priceLabelText, { color: themeColors.textSecondary }]}>WEEKLY DISCOUNT RATE</Text>
                  <Text style={[styles.weeklyPriceNum, { color: themeColors.textPrimary }]}>{pricePerWeek} / wk</Text>
                </View>
              )}
            </View>

            <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />

            {/* Description */}
            <Text style={[styles.sectionHeading, { color: themeColors.textPrimary }]}>Description & Equipment Overview</Text>
            <Text style={[styles.descriptionParagraph, { color: themeColors.textSecondary }]}>
              {listing?.description || 'No description provided.'}
            </Text>

            {/* Bundle Included Items */}
            {listing?.bundle_items && listing.bundle_items.length > 0 && (
              <>
                <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />
                <Text style={[styles.sectionHeading, { color: themeColors.textPrimary }]}>Included Kit Items ({listing.bundle_items.length})</Text>
                {listing.bundle_items.map((bItem: any) => (
                  <View key={bItem.id} style={[styles.bundleItemRow, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
                    <Icon name="check-circle" size={14} color={ORANGE} />
                    <Text style={[styles.bundleItemTitle, { color: themeColors.textPrimary }]}>{bItem.title}</Text>
                  </View>
                ))}
              </>
            )}

            {/* Specifications */}
            {listing?.specifications && Object.keys(listing.specifications).length > 0 && (
              <>
                <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />
                <Text style={[styles.sectionHeading, { color: themeColors.textPrimary }]}>Kit Specifications</Text>
                {Object.entries(listing.specifications).map(([key, val]) => (
                  <View key={key} style={styles.specItemRow}>
                    <Text style={[styles.specKey, { color: themeColors.textSecondary }]}>{key.toUpperCase()}:</Text>
                    <Text style={[styles.specVal, { color: themeColors.textPrimary }]}>{String(val)}</Text>
                  </View>
                ))}
              </>
            )}

            <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />

            {/* Seller Profile Card */}
            <View style={[styles.sellerCard, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
              <View style={styles.sellerInfoRow}>
                {sellerAvatar ? (
                  <CachedImage uri={sellerAvatar} style={styles.sellerAvatar} />
                ) : (
                  <View style={styles.sellerAvatarFallback}>
                    <Text style={styles.sellerFallbackText}>{sellerName.charAt(0).toUpperCase()}</Text>
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <Text style={[styles.sellerNameText, { color: themeColors.textPrimary }]}>{sellerName}</Text>
                  {sellerCraft ? <Text style={[styles.sellerCraftText, { color: themeColors.textSecondary }]}>{sellerCraft}</Text> : null}
                </View>

                <TouchableOpacity style={styles.messageSellerBtn} onPress={handleContactSeller}>
                  <Icon name="message-square" size={14} color="#FFFFFF" />
                  <Text style={styles.messageSellerBtnText}>Message</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Action Buttons Row: Request Booking & Leave Review */}
            <View style={styles.actionBtnsRow}>
              {canBook && (
              <TouchableOpacity
                style={[styles.bookingBtn, { flex: 2 }, bookingLoading && { opacity: 0.7 }]}
                onPress={handleRequestBooking}
                disabled={bookingLoading}
              >
                {bookingLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.bookingBtnText}>{currentUserId && currentUserId === listing?.user_id ? 'Manage Bookings →' : 'Request Booking Dates →'}</Text>
                )}
              </TouchableOpacity>
              )}

              {!isInternal && (
              <TouchableOpacity
                style={[styles.reviewBtn, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}
                onPress={() => {
                  if (!currentUserId) return Alert.alert('Sign In Required', 'Please sign in to review.');
                  if (currentUserId === listing?.user_id) return Alert.alert('Not allowed', 'You cannot review your own listing.');
                  setReviewModalVisible(true);
                }}
              >
                <Icon name="star" size={16} color="#F59E0B" fill="#F59E0B" />
                <Text style={[styles.reviewBtnText, { color: themeColors.textPrimary }]}>Rate & Review</Text>
              </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      </TabletContainer>

      {/* Leave Review Modal */}
      <LeaveReviewModal
        visible={reviewModalVisible}
        onClose={() => setReviewModalVisible(false)}
        listingId={listingId}
        onSuccess={fetchListingDetails}
      />
      <BookingRequestModal
        visible={bookingModalVisible}
        onClose={() => setBookingModalVisible(false)}
        listing={listing}
        onRequested={() => navigation.navigate('MyBookings')}
      />
      <ReportModal
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetTitle="this listing"
        targetType="listing"
        targetId={listingId}
      />
      <UniversalShareSheet
        visible={showShareSheet}
        onClose={() => setShowShareSheet(false)}
        title={listing?.title || listingTitle || 'Listing'}
        shareUrl={`https://cinecraftconnect.com/marketplace/${listingId}`}
        itemType="marketplace"
        itemData={listing}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBtn: {
    padding: 4,
  },
  mainImageContainer: {
    width: '100%',
    height: isTabletDevice ? 400 : 250,
    backgroundColor: INK,
    position: 'relative',
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  bundleBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#9333EA',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  bundleBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  thumbRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  thumbBox: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    marginRight: 8,
    overflow: 'hidden',
  },
  thumbBoxActive: {
    borderColor: ORANGE,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  card: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  categoryConditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  categoryPill: {
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  categoryPillText: {
    color: ORANGE,
    fontSize: 12,
    fontWeight: '700',
  },
  conditionPill: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  conditionPillText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  titleText: {
    fontSize: 20,
    fontWeight: '700',
    color: INK,
    fontFamily: 'Lora-Bold',
    lineHeight: 25,
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  locationText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  priceCardRow: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  dailyPriceGroup: {},
  priceLabelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  priceNumRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceNum: {
    fontSize: 20,
    fontWeight: '700',
    color: ORANGE,
  },
  pricePerText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
    marginLeft: 3,
  },
  weeklyPriceGroup: {
    alignItems: 'flex-end',
  },
  weeklyPriceNum: {
    fontSize: 13,
    fontWeight: '700',
    color: INK,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: INK,
    fontFamily: 'Lora-Bold',
    marginBottom: 8,
  },
  descriptionParagraph: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  bundleItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  bundleItemTitle: {
    fontSize: 13,
    color: INK,
    fontWeight: '700',
  },
  specItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  specKey: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  specVal: {
    fontSize: 12,
    fontWeight: '700',
    color: INK,
  },
  sellerCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  sellerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sellerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  sellerAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF7F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerFallbackText: {
    color: ORANGE,
    fontSize: 18,
    fontWeight: '700',
  },
  sellerNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: INK,
  },
  sellerCraftText: {
    fontSize: 12,
    color: '#64748B',
  },
  messageSellerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: INK,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 5,
  },
  messageSellerBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  bookingBtn: {
    backgroundColor: ORANGE,
    borderRadius: 14,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  actionBtnsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  reviewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 14,
    height: 48,
    gap: 6,
  },
  reviewBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

export default MarketplaceDetailScreen;
