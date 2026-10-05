import React, { useState, useEffect, useCallback } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  InteractionManager,
} from 'react-native';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { getSupabaseClient } from '@cinecraft/api';
import { TabletContainer } from '../../components/common/TabletContainer';
import { useUserSettings } from '../../hooks/useUserSettings';
import { QuoteRequestModal } from '../../components/marketplace/MarketplaceModals';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

export const VendorServiceDetailScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  const { serviceId, serviceTitle, vendorId } = route.params || {};
  const { themeColors, isDark } = useUserSettings();

  const [service, setService] = useState<any>(null);
  const [vendor, setVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  useEffect(() => {
    getSupabaseClient().auth.getSession().then(({ data }: any) => setMeId(data?.session?.user?.id || null)).catch(() => {});
  }, []);

  const fetchServiceDetails = useCallback(async () => {
    if (!serviceId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const supabase = getSupabaseClient();

      const { data: serviceData, error: sErr } = await ((supabase as any).from('vendor_services') as any)
        .select('*')
        .eq('id', serviceId)
        .single();

      if (sErr) throw sErr;
      setService(serviceData);

      const targetVendorId = serviceData?.vendor_id || vendorId;
      if (targetVendorId) {
        const { data: vData } = await ((supabase as any).from('vendors') as any)
          .select('*')
          .eq('id', targetVendorId)
          .single();
        setVendor(vData);
      }
    } catch (e) {
      console.warn('[VendorServiceDetail] Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [serviceId, vendorId]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      fetchServiceDetails();
    });
    return () => task.cancel();
  }, [fetchServiceDetails]);

  const handleContactVendor = () => {
    const ownerId = vendor?.owner_id;
    if (!ownerId) {
      navigation.navigate('Messages');
      return;
    }
    navigation.navigate('Conversation', { recipientId: ownerId, recipientName: vendor?.business_name });
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.bgScreen }]}>
        <Header title="Service Package" showLogo={false} onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ORANGE} />
        </View>
      </View>
    );
  }

  const title = service?.title || serviceTitle || 'Service Package';
  const vendorName = vendor?.business_name || 'Verified Vendor';

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bgScreen }]}>
      <Header
        title="Service Package"
        showLogo={false}
        onBack={() => navigation.goBack()}
      />

      <TabletContainer maxWidth={720} backgroundColor={themeColors.bgScreen}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={[styles.card, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
            <Text style={[styles.titleText, { color: themeColors.textPrimary }]}>{title}</Text>
            <Text style={[styles.vendorSub, { color: themeColors.textSecondary }]}>Package provided by {vendorName}</Text>

            {/* Pricing Header Card */}
            <View style={[styles.priceCard, { backgroundColor: isDark ? 'rgba(255,75,51,0.12)' : '#FFF7F5', borderColor: isDark ? 'rgba(255,75,51,0.25)' : '#FFE5DF' }]}>
              <Text style={styles.priceLabel}>DAY RENTAL RATE</Text>
              <View style={styles.priceNumRow}>
                <Text style={styles.priceNum}>₹{service?.day_rate ? service.day_rate.toLocaleString() : '0'}</Text>
                <Text style={[styles.pricePerText, { color: themeColors.textSecondary }]}>/ day</Text>
              </View>
            </View>

            {/* Highlights Row */}
            <View style={styles.highlightsRow}>
              {service?.coverage_area && (
                <View style={[styles.highlightPill, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
                  <Icon name="map-pin" size={13} color={ORANGE} />
                  <Text style={[styles.highlightPillText, { color: themeColors.textPrimary }]}>{service.coverage_area}</Text>
                </View>
              )}

              {service?.min_booking_days && (
                <View style={[styles.highlightPill, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
                  <Icon name="calendar" size={13} color={ORANGE} />
                  <Text style={[styles.highlightPillText, { color: themeColors.textPrimary }]}>Min {service.min_booking_days} day(s)</Text>
                </View>
              )}

              {service?.crew_capacity && (
                <View style={[styles.highlightPill, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
                  <Icon name="users" size={13} color={ORANGE} />
                  <Text style={[styles.highlightPillText, { color: themeColors.textPrimary }]}>Up to {service.crew_capacity} crew</Text>
                </View>
              )}
            </View>

            <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />

            {/* Description */}
            <Text style={[styles.sectionHeading, { color: themeColors.textPrimary }]}>Service Package Description</Text>
            <Text style={[styles.descriptionParagraph, { color: themeColors.textSecondary }]}>
              {service?.description || 'Full production service package for camera, lighting & grip.'}
            </Text>

            {/* Service Checklist */}
            {service?.service_checklist && service.service_checklist.length > 0 && (
              <>
                <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />
                <Text style={[styles.sectionHeading, { color: themeColors.textPrimary }]}>What's Included in Package</Text>
                {service.service_checklist.map((item: string, idx: number) => (
                  <View key={idx} style={styles.checkItemRow}>
                    <Icon name="check-circle" size={14} color={ORANGE} />
                    <Text style={[styles.checkItemText, { color: themeColors.textPrimary }]}>{item}</Text>
                  </View>
                ))}
              </>
            )}

            {/* Supported Production Types */}
            {service?.production_types && service.production_types.length > 0 && (
              <>
                <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />
                <Text style={[styles.sectionHeading, { color: themeColors.textPrimary }]}>Supported Production Formats</Text>
                <View style={styles.prodTypesRow}>
                  {service.production_types.map((pt: string) => (
                    <View key={pt} style={[styles.prodTypeTag, { backgroundColor: themeColors.chipBg }]}>
                      <Text style={[styles.prodTypeTagText, { color: themeColors.textSecondary }]}>{pt}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            <View style={[styles.divider, { backgroundColor: themeColors.divider }]} />

            {vendor && meId !== vendor.owner_id && (
              <TouchableOpacity
                style={[styles.contactBtn, { marginBottom: 10 }]}
                onPress={() => (meId ? setQuoteOpen(true) : Alert.alert('Sign In Required', 'Please sign in to request a quote.'))}
              >
                <Icon name="file-text" size={16} color="#FFFFFF" />
                <Text style={styles.contactBtnText}>Request a quote</Text>
              </TouchableOpacity>
            )}

            {/* Contact Button */}
            <TouchableOpacity style={styles.contactBtn} onPress={handleContactVendor}>
              <Icon name="message-square" size={16} color="#FFFFFF" />
              <Text style={styles.contactBtnText}>Contact Vendor for Booking 💬</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </TabletContainer>
      {vendor && service && (
        <QuoteRequestModal visible={quoteOpen} onClose={() => setQuoteOpen(false)} vendorId={vendor.id} vendorName={vendor.business_name} serviceId={service.id} serviceTitle={service.title} onRequested={() => navigation.navigate('MyQuotes')} />
      )}
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
  card: {
    backgroundColor: '#FFFFFF',
    margin: 16,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  titleText: {
    fontSize: 22,
    fontWeight: '900',
    color: INK,
    fontFamily: 'Lora-Bold',
    marginBottom: 2,
  },
  vendorSub: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 14,
  },
  priceCard: {
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    marginBottom: 14,
  },
  priceLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: ORANGE,
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  priceNumRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceNum: {
    fontSize: 26,
    fontWeight: '900',
    color: ORANGE,
  },
  pricePerText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
    marginLeft: 3,
  },
  highlightsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  highlightPill: {
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
  highlightPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: INK,
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
    marginBottom: 8,
  },
  descriptionParagraph: {
    fontSize: 13.5,
    color: '#475569',
    lineHeight: 20,
  },
  checkItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  checkItemText: {
    fontSize: 13,
    color: INK,
    fontWeight: '600',
  },
  prodTypesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  prodTypeTag: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  prodTypeTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
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

export default VendorServiceDetailScreen;
