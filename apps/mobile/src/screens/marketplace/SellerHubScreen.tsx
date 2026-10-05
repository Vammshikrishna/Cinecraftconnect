import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { CachedImage } from '../../components/common/CachedImage';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';
import { VendorVerificationModal } from '../../components/marketplace/MarketplaceModals';

const ORANGE = '#FF4B33';

export const SellerHubScreen = ({ navigation }: { navigation: any }) => {
  const { themeColors: T } = useUserSettings();
  const [listings, setListings] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [verifyFor, setVerifyFor] = useState<any | null>(null);

  const load = useCallback(async () => {
    try {
      const { data, error } = await (getSupabaseClient() as any).rpc('seller_hub_stats');
      if (error) throw error;
      setListings(data?.listings || []);
      setVendors(data?.vendors || []);
    } catch (e) {
      console.warn('[SellerHub] fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totals = useMemo(
    () => ({
      views: listings.reduce((n, l) => n + l.views, 0),
      saves: listings.reduce((n, l) => n + l.saves, 0),
      pending: listings.reduce((n, l) => n + l.pending, 0),
      revenue: listings.reduce((n, l) => n + Number(l.revenue), 0),
      openQuotes: vendors.reduce((n, v) => n + v.requested, 0),
    }),
    [listings, vendors]
  );

  const toggleActive = async (l: any) => {
    setListings((prev) => prev.map((x) => (x.id === l.id ? { ...x, is_active: !x.is_active } : x)));
    const { error } = await (getSupabaseClient() as any).from('marketplace_listings').update({ is_active: !l.is_active }).eq('id', l.id);
    if (error) {
      Alert.alert('Could not update the listing', error.message);
      load();
    }
  };

  const Tile = ({ icon, label, value }: { icon: string; label: string; value: string | number }) => (
    <View style={[styles.tile, { backgroundColor: T.bgCard, borderColor: T.border }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name={icon} size={13} color={T.textMuted} />
        <Text style={{ color: T.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 }}>{label}</Text>
      </View>
      <Text style={{ color: T.textPrimary, fontSize: 22, fontWeight: '800', marginTop: 4 }}>{value}</Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: T.bgScreen }]}>
      <Header title="Seller Hub" showLogo={false} onBack={() => navigation.goBack()} />
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" color={ORANGE} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 14, paddingBottom: 50 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={ORANGE} />}
        >
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            <TouchableOpacity style={[styles.nav, { borderColor: T.border, backgroundColor: T.bgCard }]} onPress={() => navigation.navigate('MyBookings')}>
              <Icon name="calendar" size={14} color={ORANGE} />
              <Text style={{ color: T.textPrimary, fontSize: 12.5, fontWeight: '800' }}>Bookings{totals.pending > 0 ? ` (${totals.pending})` : ''}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.nav, { borderColor: T.border, backgroundColor: T.bgCard }]} onPress={() => navigation.navigate('MyQuotes')}>
              <Icon name="file-text" size={14} color={ORANGE} />
              <Text style={{ color: T.textPrimary, fontSize: 12.5, fontWeight: '800' }}>Quotes{totals.openQuotes > 0 ? ` (${totals.openQuotes})` : ''}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tiles}>
            <Tile icon="eye" label="VIEWS" value={totals.views} />
            <Tile icon="heart" label="SAVES" value={totals.saves} />
            <Tile icon="calendar" label="PENDING" value={totals.pending} />
            <Tile icon="dollar-sign" label="BOOKED VALUE" value={`₹${totals.revenue.toLocaleString()}`} />
          </View>

          <Text style={[styles.section, { color: T.textSecondary }]}>YOUR LISTINGS ({listings.length})</Text>
          {listings.length === 0 ? (
            <Text style={{ color: T.textMuted, fontSize: 13 }}>You have not listed anything yet.</Text>
          ) : (
            listings.map((l) => (
              <View key={l.id} style={[styles.card, { backgroundColor: T.bgCard, borderColor: T.border }]}>
                <TouchableOpacity activeOpacity={0.85} style={{ flexDirection: 'row', gap: 12 }} onPress={() => navigation.navigate('MarketplaceDetail', { listingId: l.id, listingTitle: l.title })}>
                  {l.image ? <CachedImage uri={l.image} style={styles.thumb} /> : <View style={[styles.thumb, { backgroundColor: T.inputBg, alignItems: 'center', justifyContent: 'center' }]}><Icon name="shopping-bag" size={20} color={T.textMuted} /></View>}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: T.textPrimary, fontSize: 14.5, fontWeight: '800' }} numberOfLines={2}>{l.title}</Text>
                    <Text style={{ color: T.textSecondary, fontSize: 11.5 }}>₹{Number(l.price_per_day).toLocaleString()}/day{l.is_bundle ? ' · bundle' : ''}{!l.is_active ? ' · paused' : ''}{l.admin_flagged ? ' · under review' : ''}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 6 }}>
                      <Text style={[styles.stat, { color: T.textSecondary }]}>👁 {l.views}</Text>
                      <Text style={[styles.stat, { color: T.textSecondary }]}>♥ {l.saves}</Text>
                      <Text style={[styles.stat, { color: l.pending ? '#F59E0B' : T.textMuted }]}>{l.pending} pending</Text>
                      <Text style={[styles.stat, { color: '#10B981' }]}>{l.confirmed} confirmed</Text>
                      <Text style={[styles.stat, { color: ORANGE }]}>₹{Number(l.revenue).toLocaleString()}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.pause, { borderColor: T.border }]} onPress={() => toggleActive(l)}>
                  <Icon name={l.is_active ? 'lock' : 'refresh-cw'} size={13} color={ORANGE} />
                  <Text style={{ color: ORANGE, fontSize: 12, fontWeight: '800' }}>{l.is_active ? 'Pause listing' : 'Resume listing'}</Text>
                </TouchableOpacity>
              </View>
            ))
          )}

          <Text style={[styles.section, { color: T.textSecondary, marginTop: 20 }]}>YOUR VENDOR BUSINESSES ({vendors.length})</Text>
          {vendors.length === 0 ? (
            <Text style={{ color: T.textMuted, fontSize: 13 }}>No vendor business yet.</Text>
          ) : (
            vendors.map((v) => (
              <View key={v.id} style={[styles.card, { backgroundColor: T.bgCard, borderColor: T.border }]}>
                <TouchableOpacity activeOpacity={0.85} style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }} onPress={() => navigation.navigate('VendorDetail', { vendorId: v.id })}>
                  {v.logo_url ? <CachedImage uri={v.logo_url} style={[styles.thumb, { width: 52, height: 52 }]} /> : <View style={[styles.thumb, { width: 52, height: 52, backgroundColor: T.inputBg }]} />}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ color: T.textPrimary, fontSize: 14.5, fontWeight: '800', flexShrink: 1 }} numberOfLines={1}>{v.business_name}</Text>
                      {v.is_verified ? <Icon name="badge-check" size={15} color={ORANGE} /> : null}
                    </View>
                    <Text style={{ color: T.textSecondary, fontSize: 11.5, marginTop: 2 }}>
                      {v.requested} new · {v.quoted} quoted · {v.accepted} accepted · {v.completed} done
                    </Text>
                    <Text style={{ color: T.textMuted, fontSize: 11.5 }}>Won ₹{Number(v.won_value).toLocaleString()}</Text>
                  </View>
                </TouchableOpacity>
                {!v.is_verified &&
                  (v.verification_status === 'pending' ? (
                    <Text style={{ color: '#F59E0B', fontSize: 12, fontWeight: '800', marginTop: 10 }}>Verification under review</Text>
                  ) : (
                    <TouchableOpacity style={[styles.pause, { borderColor: T.border }]} onPress={() => setVerifyFor(v)}>
                      <Icon name="badge-check" size={13} color={ORANGE} />
                      <Text style={{ color: ORANGE, fontSize: 12, fontWeight: '800' }}>{v.verification_status === 'rejected' ? 'Resubmit for verification' : 'Get verified'}</Text>
                    </TouchableOpacity>
                  ))}
              </View>
            ))
          )}
        </ScrollView>
      )}

      {verifyFor && <VendorVerificationModal visible onClose={() => setVerifyFor(null)} vendorId={verifyFor.id} vendorName={verifyFor.business_name} onSubmitted={load} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  nav: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 12, height: 40 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '48.5%', borderWidth: 1, borderRadius: 14, padding: 12 },
  section: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, marginTop: 18, marginBottom: 8 },
  card: { borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 10 },
  thumb: { width: 72, height: 72, borderRadius: 12 },
  stat: { fontSize: 12, fontWeight: '700' },
  pause: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderRadius: 999, height: 34, marginTop: 10 },
});

export default SellerHubScreen;
