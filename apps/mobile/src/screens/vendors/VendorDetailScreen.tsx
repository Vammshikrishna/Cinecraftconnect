import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Share,
  InteractionManager,
} from 'react-native';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { getSupabaseClient } from '@cinecraft/api';
import { ServicePackageModal } from '../../components/modals/ServicePackageModal';
import { TabletContainer } from '../../components/common/TabletContainer';
import { CachedImage } from '../../components/common/CachedImage';
import { useUserSettings } from '../../hooks/useUserSettings';
import { UniversalShareSheet } from '../../components/common/UniversalShareSheet';
import { QuoteRequestModal, VendorVerificationModal } from '../../components/marketplace/MarketplaceModals';
import { LeaveReviewModal } from '../../components/modals/LeaveReviewModal';
import { ReportModal } from '../../components/modals/ReportModal';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

export const VendorDetailScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  const { vendorId, vendorName, category, location, imageUrl } = route.params || {};
  const { themeColors, isDark } = useUserSettings();

  const [vendor, setVendor] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [serviceModalVisible, setServiceModalVisible] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const fetchVendorDetails = useCallback(async () => {
    if (!vendorId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const supabase = getSupabaseClient();
      const user = (await supabase.auth.getSession()).data.session?.user ?? null; // local session: getUser() is a network call
      if (user) setCurrentUserId(user.id);

      let vendorData = null;
      try {
        const { data: rpcData, error: rpcError } = await ((supabase as any).rpc('get_vendor_with_rating', {
          vendor_uuid: vendorId,
        }) as any);
        if (!rpcError && rpcData && rpcData.length > 0) {
          vendorData = rpcData[0];
        }
      } catch (e) {
        // Fall back
      }

      if (!vendorData) {
        const { data: vData } = await ((supabase as any).from('vendors') as any)
          .select('*')
          .eq('id', vendorId)
          .single();
        vendorData = vData;
      }

      setVendor(vendorData);

      // Fetch vendor services packages
      const { data: servicesData } = await ((supabase as any).from('vendor_services') as any)
        .select('*')
        .eq('vendor_id', vendorId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (servicesData) setServices(servicesData);
    } catch (e) {
      console.warn('[VendorDetail] Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      fetchVendorDetails();
    });
    return () => task.cancel();
  }, [fetchVendorDetails]);

  const handleShare = () => {
    setShowShareSheet(true);
  };

  const handleContactVendor = () => {
    const ownerId = vendor?.owner_id;
    if (!ownerId) {
      navigation.navigate('Messages');
      return;
    }
    navigation.navigate('Conversation', { recipientId: ownerId, recipientName: vendor?.business_name });
  };

  const name = vendor?.business_name || vendorName || 'Vendor Profile';
  const cat = vendor?.category
    ? Array.isArray(vendor.category)
      ? vendor.category.join(' // ').toUpperCase()
      : String(vendor.category).toUpperCase()
    : category || 'PRODUCTION VENDOR';

  const loc = vendor?.location || location || 'Pan-India';

  const images =
    vendor?.images && vendor.images.length > 0
      ? vendor.images
      : vendor?.logo_url || imageUrl
      ? [vendor?.logo_url || imageUrl]
      : [];

  const servicesOfferedPills =
    vendor?.services_offered && Array.isArray(vendor.services_offered)
      ? vendor.services_offered
      : typeof vendor?.services_offered === 'string'
      ? vendor.services_offered.split(',')
      : [];

  const isOwner = currentUserId && vendor && currentUserId === vendor.owner_id;
  const reviewCount = vendor?.review_count || 0;
  const ratingValue = vendor?.rating || vendor?.average_rating;
  const initialChar = name.charAt(0).toUpperCase();

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.bgScreen }]}>
        <Header title="Vendor Profile" showLogo={false} onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ORANGE} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bgScreen }]}>
      <Header
        title="Vendor Profile"
        showLogo={false}
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity onPress={handleShare} style={styles.headerIconBtn}>
            <Icon name="share" size={18} color={themeColors.textPrimary} />
          </TouchableOpacity>
        }
      />

      <TabletContainer maxWidth={720} backgroundColor={themeColors.bgScreen}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Banner Gallery Image Container */}
          <View style={styles.mainImageContainer}>
            {images.length > 0 ? (
              <CachedImage uri={images[activeImageIndex]} style={styles.mainImage} resizeMode="cover" />
            ) : (
              <View style={[styles.bannerFallback, { backgroundColor: themeColors.chipBg }]}>
                <Icon name="store" size={48} color={ORANGE} />
                <Text style={[styles.bannerFallbackText, { color: themeColors.textPrimary }]}>{name}</Text>
              </View>
            )}

            {!!vendor?.is_verified && (
              <View style={styles.verifiedBadgeBanner}>
                <Icon name="badge-check" size={12} color="#FFFFFF" />
                <Text style={styles.verifiedBadgeBannerText}>VERIFIED BUSINESS</Text>
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
                  <CachedImage uri={img} style={styles.thumbImage} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Main Info Card */}
          <View style={[styles.card, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
            <View style={styles.logoTitleRow}>
              {/* Vendor Logo */}
              <View style={[styles.logoWrapper, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
                {vendor?.logo_url ? (
                  <CachedImage uri={vendor.logo_url} style={styles.logoImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.logoFallback, { backgroundColor: themeColors.chipBg }]}>
                    <Text style={styles.logoFallbackText}>{initialChar}</Text>
                  </View>
                )}
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[styles.titleText, { color: themeColors.textPrimary }]}>{name}</Text>
                <View style={styles.locationRow}>
                  <Icon name="map-pin" size={13} color={themeColors.textSecondary} />
                  <Text style={[styles.locationText, { color: themeColors.textSecondary }]}>{loc}</Text>
                </View>
              </View>
            </View>

            <View style={styles.badgeRow}>
              <View style={[styles.categoryPill, { backgroundColor: isDark ? 'rgba(255,75,51,0.12)' : '#FFF7F5', borderColor: isDark ? 'rgba(255,75,51,0.25)' : '#FFE5DF' }]}>
                <Text style={styles.categoryPillText}>{cat}</Text>
              </View>

              {/* ONLY render rating if review_count > 0 or real rating value exists */}
              {reviewCount > 0 && ratingValue ? (
                <View style={styles.ratingBox}>
                  <Icon name="star" size={12} color="#F59E0B" fill="#F59E0B" />
                  <Text style={styles.ratingNum}>{Number(ratingValue).toFixed(1)}</Text>
                  <Text style={[styles.ratingSub, { color: themeColors.textSecondary }]}>({reviewCount} reviews)</Text>
                </View>
              ) : vendor?.is_verified ? (
                <View style={styles.verifiedTagPill}>
                  <Icon name="check" size={10} color="#059669" strokeWidth={3} />
                  <Text style={styles.verifiedTagPillText}>VERIFIED</Text>
                </View>
              ) : null}
            </View>

            {/* Desk Contact Row */}
            {(vendor?.phone || vendor?.email || vendor?.website) && (
              <View style={styles.contactInfoRow}>
                {vendor?.phone && (
                  <View style={styles.contactItem}>
                    <Icon name="phone" size={12} color={ORANGE} />
                    <Text style={[styles.contactItemText, { color: themeColors.textPrimary }]}>{vendor.phone}</Text>
                  </View>
                )}
                {vendor?.email && (
                  <View style={styles.contactItem}>
                    <Icon name="mail" size={12} color={ORANGE} />
                    <Text style={[styles.contactItemText, { color: themeColors.textPrimary }]}>{vendor.email}</Text>
                  </View>
                )}
              </View>
            )}

            <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />

            {/* About Us */}
            <Text style={[styles.sectionHeading, { color: themeColors.textPrimary }]}>About Business & Equipment Fleet</Text>
            <Text style={[styles.descriptionParagraph, { color: themeColors.textSecondary }]}>
              {vendor?.description ||
                'Professional film equipment rental supplier & production services house.'}
            </Text>

            {/* Services Offered Pills */}
            {servicesOfferedPills.length > 0 && (
              <>
                <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />
                <Text style={[styles.sectionHeading, { color: themeColors.textPrimary }]}>Services & Inventory Specialities</Text>
                <View style={styles.servicesPillsRow}>
                  {servicesOfferedPills.map((srv: string, idx: number) => (
                    <View key={idx} style={[styles.serviceOfferedPill, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
                      <Icon name="check-circle" size={12} color={ORANGE} />
                      <Text style={[styles.serviceOfferedText, { color: themeColors.textPrimary }]}>{srv.trim()}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Service Packages Header + Add Package Button (if Owner) */}
            <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />
            <View style={styles.servicePackagesHeaderRow}>
              <Text style={[styles.sectionHeading, { color: themeColors.textPrimary }]}>
                Service Packages {services.length > 0 ? `(${services.length})` : ''}
              </Text>

              {isOwner && (
                <TouchableOpacity
                  style={styles.addPackageBtn}
                  onPress={() => setServiceModalVisible(true)}
                >
                  <Icon name="plus" size={13} color="#FFFFFF" strokeWidth={3} />
                  <Text style={styles.addPackageBtnText}>Add Package</Text>
                </TouchableOpacity>
              )}
            </View>

            {services.length > 0 ? (
              services.map((srv: any) => (
                <TouchableOpacity
                  key={srv.id}
                  style={[styles.packageCardItem, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}
                  onPress={() =>
                    navigation.navigate('VendorServiceDetail', {
                      serviceId: srv.id,
                      serviceTitle: srv.title,
                      vendorId: vendorId,
                    })
                  }
                >
                  <View style={styles.packageCardHeader}>
                    <Text style={[styles.packageTitle, { color: themeColors.textPrimary }]}>{srv.title}</Text>
                    <Text style={styles.packageDayRate}>₹{srv.day_rate ? srv.day_rate.toLocaleString() : '0'} / day</Text>
                  </View>
                  {srv.description ? (
                    <Text style={[styles.packageDesc, { color: themeColors.textSecondary }]} numberOfLines={2}>
                      {srv.description}
                    </Text>
                  ) : null}
                  <View style={styles.packageArrowRow}>
                    <Text style={styles.packageArrowText}>View Package Details →</Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <Text style={[styles.noPackagesText, { color: themeColors.textMuted }]}>
                No service packages published yet. {isOwner ? 'Tap "+ Add Package" to list your first package!' : ''}
              </Text>
            )}

            <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />

            {vendor && !isOwner && (
              <>
                <TouchableOpacity
                  style={[styles.contactBtn, { marginBottom: 10 }]}
                  onPress={() => (currentUserId ? setQuoteOpen(true) : Alert.alert('Sign In Required', 'Please sign in to request a quote.'))}
                >
                  <Icon name="file-text" size={16} color="#FFFFFF" />
                  <Text style={styles.contactBtnText}>Request a quote</Text>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                  <TouchableOpacity
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: 12, borderWidth: 1, borderColor: themeColors.border, backgroundColor: themeColors.chipBg }}
                    onPress={() => (currentUserId ? setReviewOpen(true) : Alert.alert('Sign In Required', 'Please sign in to review.'))}
                  >
                    <Icon name="star" size={14} color="#F59E0B" fill="#F59E0B" />
                    <Text style={{ color: themeColors.textPrimary, fontSize: 12.5, fontWeight: '800' }}>Leave a review</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: 12, borderWidth: 1, borderColor: themeColors.border, backgroundColor: themeColors.chipBg }}
                    onPress={() => (currentUserId ? setReportOpen(true) : Alert.alert('Sign In Required', 'Please sign in to report.'))}
                  >
                    <Icon name="flag" size={14} color={themeColors.textSecondary} />
                    <Text style={{ color: themeColors.textSecondary, fontSize: 12.5, fontWeight: '800' }}>Report</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            {isOwner && vendor && (
              <View style={{ gap: 10, marginBottom: 10 }}>
                {!vendor.is_verified && (
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: 12, borderWidth: 1, borderColor: themeColors.border, backgroundColor: themeColors.chipBg }}
                    onPress={() => setVerifyOpen(true)}
                  >
                    <Icon name="badge-check" size={14} color={ORANGE} />
                    <Text style={{ color: themeColors.textPrimary, fontSize: 12.5, fontWeight: '800' }}>Get verified</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, borderRadius: 12, borderWidth: 1, borderColor: themeColors.border, backgroundColor: themeColors.chipBg }}
                  onPress={() => navigation.navigate('MyQuotes')}
                >
                  <Icon name="file-text" size={14} color={ORANGE} />
                  <Text style={{ color: themeColors.textPrimary, fontSize: 12.5, fontWeight: '800' }}>View quote requests</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Contact Vendor */}
            <TouchableOpacity style={styles.contactBtn} onPress={handleContactVendor}>
              <Icon name="message-square" size={16} color="#FFFFFF" />
              <Text style={styles.contactBtnText}>Message Vendor Booking Desk 💬</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </TabletContainer>

      {vendor && !isOwner && (
        <>
          <QuoteRequestModal visible={quoteOpen} onClose={() => setQuoteOpen(false)} vendorId={vendor.id} vendorName={vendor.business_name} onRequested={() => navigation.navigate('MyQuotes')} />
          <LeaveReviewModal visible={reviewOpen} onClose={() => setReviewOpen(false)} vendorId={vendor.id} onSuccess={fetchVendorDetails} />
          {/* the business owner is the reportable "user" (moderation can act on accounts) */}
          <ReportModal visible={reportOpen} onClose={() => setReportOpen(false)} targetTitle="this vendor" targetType="user" targetId={vendor.owner_id} />
        </>
      )}
      {isOwner && vendor && (
        <VendorVerificationModal visible={verifyOpen} onClose={() => setVerifyOpen(false)} vendorId={vendor.id} vendorName={vendor.business_name} onSubmitted={fetchVendorDetails} />
      )}

      {/* Add Service Package Modal */}
      {vendorId && (
        <ServicePackageModal
          visible={serviceModalVisible}
          onClose={() => setServiceModalVisible(false)}
          vendorId={vendorId}
          onSuccess={fetchVendorDetails}
        />
      )}
      <UniversalShareSheet
        visible={showShareSheet}
        onClose={() => setShowShareSheet(false)}
        title={vendor?.business_name || vendorName || 'Vendor Profile'}
        shareUrl={`https://cinecraftconnect.com/vendor/${vendorId}`}
        itemType="vendor"
        itemData={vendor}
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
  headerIconBtn: {
    padding: 4,
  },
  mainImageContainer: {
    width: '100%',
    height: 250,
    backgroundColor: INK,
    position: 'relative',
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  bannerFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFF7F5',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bannerFallbackText: {
    color: INK,
    fontSize: 16,
    fontWeight: '900',
    fontFamily: 'Lora-Bold',
  },
  verifiedBadgeBanner: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#10B981',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedBadgeBannerText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '900',
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
  logoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  logoWrapper: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: '#FFF7F5',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#FFE5DF',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  logoFallback: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF7F5',
  },
  logoFallbackText: {
    fontSize: 22,
    fontWeight: '900',
    color: ORANGE,
  },
  titleText: {
    fontSize: 20,
    fontWeight: '900',
    color: INK,
    fontFamily: 'Lora-Bold',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  locationText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
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
    fontSize: 10,
    fontWeight: '800',
  },
  ratingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingNum: {
    color: '#D97706',
    fontSize: 12,
    fontWeight: '800',
  },
  ratingSub: {
    fontSize: 11,
    color: '#64748B',
  },
  verifiedTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  verifiedTagPillText: {
    color: '#059669',
    fontSize: 10,
    fontWeight: '900',
  },
  contactInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  contactItemText: {
    fontSize: 11.5,
    color: INK,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '900',
    color: INK,
    fontFamily: 'Lora-Bold',
  },
  descriptionParagraph: {
    fontSize: 13.5,
    color: '#475569',
    lineHeight: 20,
    marginTop: 6,
  },
  servicesPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  serviceOfferedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
  },
  serviceOfferedText: {
    fontSize: 12,
    fontWeight: '700',
    color: INK,
  },
  servicePackagesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  addPackageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ORANGE,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  addPackageBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '800',
  },
  packageCardItem: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  packageCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  packageTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: INK,
  },
  packageDayRate: {
    fontSize: 13,
    fontWeight: '900',
    color: ORANGE,
  },
  packageDesc: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 6,
  },
  packageArrowRow: {
    alignItems: 'flex-end',
  },
  packageArrowText: {
    fontSize: 11,
    fontWeight: '800',
    color: ORANGE,
  },
  noPackagesText: {
    fontSize: 12.5,
    color: '#64748B',
    fontStyle: 'italic',
    marginVertical: 4,
  },
  contactBtn: {
    backgroundColor: ORANGE,
    borderRadius: 14,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  contactBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});

export default VendorDetailScreen;
