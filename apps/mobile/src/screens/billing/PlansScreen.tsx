import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { ENTITLEMENT_LABEL, formatMoney } from '@cinecraft/core';
import { getSupabaseClient } from '@cinecraft/api';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { TabletColumn } from '../../components/common/TabletContainer';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useResponsive } from '../../hooks/useResponsive';
import { useEntitlements, useGifts } from '../../hooks/useBilling';

const ORANGE = '#FF4B33';

interface PlanRow {
  code: string; name: string; audience: 'person' | 'organization'; description: string | null;
  price_monthly_minor: number; price_yearly_minor: number; currency: string; is_active: boolean; is_default: boolean; sort_order: number;
}
interface Ent { plan_code: string; key: string; value: unknown }

const describe = (key: string, value: unknown): { text: string; included: boolean } => {
  const label = ENTITLEMENT_LABEL[key] || key;
  if (value === false) return { text: label, included: false };
  if (value === true) return { text: label, included: true };
  if (value === null) return { text: `Unlimited ${label.toLowerCase()}`, included: true };
  if (typeof value === 'number') return value === 0 ? { text: label, included: false } : { text: `Up to ${value} ${label.toLowerCase()}`, included: true };
  return { text: label, included: true };
};

/** What each plan includes. During the beta everything is free and the buttons say so; going live changes only the data. */
export const PlansScreen: React.FC<{ navigation: any; embedded?: boolean }> = ({ navigation, embedded = false }) => {
  const { themeColors } = useUserSettings();
  const { isTablet } = useResponsive();
  const { isBeta, betaDaysLeft, planCode, loading: entLoading } = useEntitlements();
  const { waiting } = useGifts();
  const [yearly, setYearly] = useState(false);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [ents, setEnts] = useState<Ent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError(false);
    (async () => {
      try {
        const db = getSupabaseClient() as any;
        const [p, e] = await Promise.all([
          db.from('plans').select('*').order('sort_order'),
          db.from('plan_entitlements').select('plan_code, key, value'),
        ]);
        if (!alive) return;
        if (p.error || e.error) { setLoadError(true); return; }
        setPlans((p.data || []) as PlanRow[]);
        setEnts((e.data || []) as Ent[]);
      } catch {
        if (alive) setLoadError(true);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [attempt]);

  const shown = useMemo(() => plans.filter((p) => isBeta || p.is_active), [plans, isBeta]);
  const byPlan = useMemo(() => {
    const m = new Map<string, { key: string; value: unknown }[]>();
    ents.forEach((x) => m.set(x.plan_code, [...(m.get(x.plan_code) || []), { key: x.key, value: x.value }]));
    return m;
  }, [ents]);

  return (
    <View style={[styles.root, { backgroundColor: themeColors.bgScreen }]}>
      {!embedded && <Header title="Plans" showLogo={false} onBack={() => navigation.goBack()} />}
      {loading || entLoading ? (
        <View style={styles.center}><ActivityIndicator color={ORANGE} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <TabletColumn maxWidth="content">
            <Text style={[styles.lead, { color: themeColors.textSecondary }]}>Pick what fits how you work with CineCraft Connect.</Text>

            {waiting.length > 0 && (
              <TouchableOpacity accessibilityRole="button" style={styles.gift} onPress={() => navigation.navigate('Gifts')}>
                <Icon name="sparkles" size={20} color={ORANGE} />
                <Text style={[styles.giftText, { color: themeColors.textPrimary }]}>You have {waiting.length} {waiting.length === 1 ? 'gift' : 'gifts'} waiting</Text>
                <Text style={styles.giftLink}>Open</Text>
              </TouchableOpacity>
            )}

            {isBeta && (
              <View style={[styles.beta, { borderColor: 'rgba(255,75,51,0.3)' }]}>
                <Icon name="sparkles" size={20} color={ORANGE} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.betaTitle, { color: themeColors.textPrimary }]}>Everything is free during the beta</Text>
                  <Text style={[styles.body, { color: themeColors.textSecondary }]}>
                    Use every feature while we build. {betaDaysLeft ? `The beta runs for about ${betaDaysLeft} more ${betaDaysLeft === 1 ? 'day' : 'days'}. ` : ''}
                    We will tell you well before anything changes, and early members get a soft landing.
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity accessibilityRole="link" hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }} onPress={() => navigation.navigate('MyPayments')} style={{ alignSelf: 'center', marginVertical: 8 }}>
              <Text style={styles.link}>My payments and receipts</Text>
            </TouchableOpacity>

            <View style={[styles.toggle, { backgroundColor: themeColors.chipBg }]}>
              {[{ id: false, label: 'Monthly' }, { id: true, label: 'Yearly' }].map((o) => (
                <TouchableOpacity key={String(o.id)} accessibilityRole="tab" accessibilityState={{ selected: yearly === o.id }} onPress={() => setYearly(o.id)}
                  style={[styles.toggleItem, yearly === o.id && { backgroundColor: themeColors.bgCard }]}>
                  <Text style={{ fontWeight: '600', color: yearly === o.id ? themeColors.textPrimary : themeColors.textMuted }}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {loadError ? (
              <View style={[styles.card, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border, alignItems: 'center' }]}>
                <Text style={[styles.planName, { color: themeColors.textPrimary }]}>Could not load the plans</Text>
                <Text style={[styles.body, { color: themeColors.textSecondary, textAlign: 'center', marginTop: 4 }]}>Check your connection and try again.</Text>
                <TouchableOpacity accessibilityRole="button" style={[styles.btn, { paddingHorizontal: 24 }]} onPress={() => setAttempt((n) => n + 1)}>
                  <Text style={styles.btnText}>Try again</Text>
                </TouchableOpacity>
              </View>
            ) : !loading && shown.length === 0 ? (
              <Text style={[styles.body, { color: themeColors.textSecondary, textAlign: 'center', marginTop: 12 }]}>No plans are available right now.</Text>
            ) : null}
            <View style={isTablet ? styles.planGrid : undefined}>
            {shown.map((p) => {
              const price = yearly ? p.price_yearly_minor : p.price_monthly_minor;
              const current = planCode === p.code;
              return (
                <View key={p.code} style={[styles.card, isTablet && styles.cardTablet, { backgroundColor: themeColors.bgCard, borderColor: p.code === 'creator_pro' ? ORANGE : themeColors.border }]}>
                  <View style={styles.rowBetween}>
                    <Text style={[styles.planName, { color: themeColors.textPrimary }]}>{p.name}</Text>
                    {isBeta && !p.is_active ? <Text style={[styles.tag, { color: themeColors.textMuted, backgroundColor: themeColors.chipBg }]}>Preview</Text> : null}
                    {current ? <Text style={[styles.tag, { color: ORANGE, backgroundColor: 'rgba(255,75,51,0.12)' }]}>Your plan</Text> : null}
                  </View>
                  {p.description ? <Text style={[styles.body, { color: themeColors.textSecondary, marginTop: 4 }]}>{p.description}</Text> : null}
                  <Text style={[styles.price, { color: themeColors.textPrimary }]}>
                    {price === 0 ? 'Free' : formatMoney(price, p.currency)}
                    {price > 0 ? <Text style={[styles.per, { color: themeColors.textMuted }]}> / {yearly ? 'year' : 'month'}</Text> : null}
                  </Text>
                  <View style={{ gap: 10, marginTop: 14 }}>
                    {(byPlan.get(p.code) || []).map((e) => {
                      const d = describe(e.key, e.value);
                      return (
                        <View key={e.key} style={styles.feature}>
                          <Icon name={d.included ? 'check' : 'x'} size={16} color={d.included ? '#10B981' : themeColors.textMuted} />
                          <Text style={[styles.body, { flex: 1, color: d.included ? themeColors.textPrimary : themeColors.textMuted, textDecorationLine: d.included ? 'none' : 'line-through' }]}>{d.text}</Text>
                        </View>
                      );
                    })}
                  </View>
                  <TouchableOpacity
                    accessibilityRole="button"
                    disabled={isBeta || current}
                    style={[styles.btn, (isBeta || current) && { backgroundColor: themeColors.chipBg }]}
                    onPress={() => Alert.alert('Payments are not switched on yet', 'This will open the checkout once they are.')}
                  >
                    <Text style={[styles.btnText, (isBeta || current) && { color: themeColors.textSecondary }]}>{isBeta ? 'Free during the beta' : current ? 'Current plan' : 'Choose plan'}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
            </View>
          </TabletColumn>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 96 },
  lead: { fontSize: 14, marginBottom: 14, textAlign: 'center' },
  gift: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: ORANGE, backgroundColor: 'rgba(255,75,51,0.1)', borderRadius: 16, padding: 14, marginBottom: 12 },
  giftText: { flex: 1, fontWeight: '700' },
  giftLink: { color: ORANGE, fontWeight: '600' },
  beta: { flexDirection: 'row', gap: 10, borderWidth: 1, backgroundColor: 'rgba(255,75,51,0.05)', borderRadius: 16, padding: 14, marginBottom: 8 },
  betaTitle: { fontWeight: '700', fontSize: 15, marginBottom: 2 },
  link: { color: ORANGE, fontWeight: '600', fontSize: 14 },
  toggle: { flexDirection: 'row', alignSelf: 'center', borderRadius: 12, padding: 4, marginVertical: 12 },
  toggleItem: { height: 44, paddingHorizontal: 22, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: 22, padding: 18, marginBottom: 14 },
  // on a tablet the plans sit side by side (like the web), each taking an equal share of the row
  planGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'stretch' },
  cardTablet: { flexGrow: 1, flexBasis: '30%', marginBottom: 0 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  planName: { fontSize: 18, fontWeight: '700' },
  tag: { fontSize: 12, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  price: { fontSize: 30, fontWeight: '800', marginTop: 12 },
  per: { fontSize: 14, fontWeight: '400' },
  body: { fontSize: 14, lineHeight: 20 },
  feature: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  btn: { height: 48, borderRadius: 14, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

export default PlansScreen;
