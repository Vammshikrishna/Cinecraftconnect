import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Modal, TextInput, RefreshControl, Share } from 'react-native';
import { paymentsCsv } from '../../utils/paymentsCsv';
import { formatMoney, friendlyError } from '@cinecraft/core';
import { getSupabaseClient } from '@cinecraft/api';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { TabletColumn } from '../../components/common/TabletContainer';
import { useUserSettings } from '../../hooks/useUserSettings';

const ORANGE = '#FF4B33';

interface Order {
  id: string; receipt: string; kind: string; item: string; amount_minor: number; tax_minor: number; currency: string; status: string;
  created_at: string; paid_at: string | null; refunded_minor: number; dispute_status: string | null; can_report: boolean;
}
interface Billing {
  mode: 'beta' | 'live';
  subscription: { plan_code: string; plan_name: string; status: string; interval: string | null; period_end: string | null; cancel_at_period_end: boolean; paid: boolean; price_minor: number | null; currency: string | null } | null;
  products: { code: string; name: string; valid_until: string; uses_remaining: number | null }[];
  gifts: { label: string; from_name: string; until: string | null; starts_when_live: boolean }[];
  orders: Order[];
  payouts: { id: string; amount_minor: number; currency: string; status: string; created_at: string; paid_at: string | null }[];
}

const STATUS: Record<string, { label: string; color: string }> = {
  paid: { label: 'Paid', color: '#10B981' },
  fulfilled: { label: 'Paid', color: '#10B981' },
  settled: { label: 'Paid', color: '#10B981' },
  awaiting_payment: { label: 'Not finished', color: '#F59E0B' },
  refunded: { label: 'Refunded', color: '#94A3B8' },
  partially_refunded: { label: 'Partly refunded', color: '#94A3B8' },
  disputed: { label: 'Under review', color: '#EF4444' },
  cancelled: { label: 'Cancelled', color: '#94A3B8' },
};
const KIND: Record<string, string> = { subscription: 'Plan', vendor_verification: 'Business verification', marketplace_seller: 'Marketplace seller', booking: 'Booking', quote: 'Quote', promotion: 'Promotion' };
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const PAID = ['paid', 'fulfilled', 'settled', 'partially_refunded', 'refunded'];

/** Everything a person has paid for, what they hold now and when it ends, with receipts and a way to report a problem. */
export const MyPaymentsScreen: React.FC<{ navigation: any; embedded?: boolean }> = ({ navigation, embedded = false }) => {
  const { themeColors } = useUserSettings();
  const [b, setB] = useState<Billing | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Order | null>(null);
  const [reporting, setReporting] = useState<Order | null>(null);
  const [report, setReport] = useState('');

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [invoiceNos, setInvoiceNos] = useState<Record<string, string>>({});
  const [invoice, setInvoice] = useState<any | null>(null);
  const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

  // Numbered tax invoices exist only on newer databases; a missing function just leaves the plain receipt.
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await (getSupabaseClient() as any).rpc('my_invoice_numbers');
        if (error || !Array.isArray(data)) return;
        setInvoiceNos(Object.fromEntries(data.filter((r: any) => r.kind === 'invoice').map((r: any) => [r.order_id, r.invoice_no])));
      } catch { /* feature off */ }
    })();
  }, []);

  useEffect(() => {
    setInvoice(null);
    if (!receipt) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await (getSupabaseClient() as any).rpc('my_invoice', { p_order: receipt.id });
        if (!cancelled && !error && data) setInvoice(data);
      } catch { /* feature off */ }
    })();
    return () => { cancelled = true; };
  }, [receipt]);

  const exportCsv = async () => {
    if ((from && !DAY_RE.test(from)) || (to && !DAY_RE.test(to))) return Alert.alert('Check the dates', 'Use the format 2026-11-05, or leave a date empty.');
    if (from && to && to < from) return Alert.alert('Check the dates', 'The end date cannot be before the start date.');
    const { count, text } = paymentsCsv(b?.orders || [], from || undefined, to || undefined, invoiceNos);
    if (!count) return Alert.alert('No payments in that range', 'Change the dates and try again.');
    try {
      await Share.share({ title: 'CineCraft payments', message: text });
    } catch (e) {
      Alert.alert('Could not share the file', friendlyError(e));
    }
  };

  const load = useCallback(async () => {
    try {
      const { data, error } = await (getSupabaseClient() as any).rpc('my_billing');
      const missing = !!error && (error.code === 'PGRST202' || error.code === '42883' || /could not find the function/i.test(String(error.message || '')));
      setLoadError(!!error && !missing);
      setB(error || !data ? null : (data as Billing));
    } catch {
      setLoadError(true);
      setB(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const changeRenewal = async (cancel: boolean) => {
    const run = async () => {
      setBusy(true);
      try {
        const { data: res, error } = await getSupabaseClient().functions.invoke('manage-subscription', { body: { action: cancel ? 'cancel' : 'resume' } });
        if (error || (res as any)?.error) throw new Error((res as any)?.message || 'Payments are not available yet.');
        Alert.alert(cancel ? 'Your plan will end at the end of the period' : 'Your plan will keep renewing');
        void load();
      } catch (e) {
        Alert.alert('Could not change it', friendlyError(e));
      } finally {
        setBusy(false);
      }
    };
    if (!cancel) return run();
    Alert.alert('Stop renewing?', 'You keep this plan until the end of the period you paid for.', [
      { text: 'Keep renewing', style: 'cancel' },
      { text: 'Stop renewing', style: 'destructive', onPress: run },
    ]);
  };

  const sendReport = async () => {
    if (!reporting) return;
    setBusy(true);
    const { error } = await (getSupabaseClient() as any).rpc('open_order_dispute', { p_order_id: reporting.id, p_reason: report });
    setBusy(false);
    if (error) return Alert.alert('Could not send it', friendlyError(error));
    Alert.alert('We have your report', 'Our team will look at it and get back to you.');
    setReporting(null);
    setReport('');
    void load();
  };

  const sub = b?.subscription;
  const text = { color: themeColors.textPrimary };
  const muted = { color: themeColors.textSecondary };
  const card = { backgroundColor: themeColors.bgCard, borderColor: themeColors.border };

  return (
    <View style={[styles.root, { backgroundColor: themeColors.bgScreen }]}>
      {!embedded && <Header title="My payments" showLogo={false} onBack={() => navigation.goBack()} />}
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={ORANGE} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} tintColor={ORANGE} colors={[ORANGE]} onRefresh={() => { setRefreshing(true); void load(); }} />}>
          <TabletColumn>
            <Text style={[styles.lead, muted]}>What you have paid for, what you hold now, and your receipts.</Text>
            {loadError && !b ? (
              <View style={[styles.card, card, { alignItems: 'center' }]}>
                <Text style={[styles.h, text]}>Could not load your payments</Text>
                <Text style={[styles.body, muted, { textAlign: 'center', marginTop: 4 }]}>Check your connection and try again.</Text>
                <TouchableOpacity accessibilityRole="button" style={[styles.primary, { marginTop: 12 }]} onPress={() => { setLoading(true); void load(); }}>
                  <Text style={styles.primaryText}>Try again</Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {!(loadError && !b) && (<>
            {b?.mode === 'beta' && (
              <View style={styles.beta}>
                <Text style={[styles.body, muted]}><Text style={[styles.bold, text]}>Everything is free during the beta. </Text>Nothing has been charged. Gifts and plans you take now are kept for when plans begin.</Text>
              </View>
            )}

            <Text style={[styles.h, text]}>Your plan</Text>
            <View style={[styles.card, card]}>
              {sub ? (
                <>
                  <Text style={[styles.planName, text]}>{sub.plan_name}</Text>
                  <Text style={[styles.body, muted, { marginTop: 2 }]}>
                    {sub.paid && sub.price_minor != null ? `${formatMoney(sub.price_minor, sub.currency || 'INR')} ${sub.interval === 'yearly' ? 'a year' : 'a month'} · ` : ''}
                    {sub.status === 'past_due' ? 'Your last payment did not go through. ' : ''}
                    {sub.period_end ? (sub.cancel_at_period_end ? `Ends on ${date(sub.period_end)}` : sub.paid ? `Renews on ${date(sub.period_end)}` : `Until ${date(sub.period_end)}`) : 'No end date'}
                  </Text>
                  {sub.status === 'past_due' ? <Text style={[styles.body, { color: '#EF4444', marginTop: 6 }]}>Update your payment method to keep your plan.</Text> : null}
                  <View style={styles.actions}>
                    <TouchableOpacity accessibilityRole="button" style={[styles.ghost, { borderColor: themeColors.border }]} onPress={() => navigation.navigate('Plans')}>
                      <Text style={[styles.ghostText, text]}>Change plan</Text>
                    </TouchableOpacity>
                    {sub.paid ? (
                      sub.cancel_at_period_end ? (
                        <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.primary} onPress={() => changeRenewal(false)}><Text style={styles.primaryText}>Keep my plan</Text></TouchableOpacity>
                      ) : (
                        <TouchableOpacity accessibilityRole="button" disabled={busy} style={[styles.ghost, { borderColor: themeColors.border }]} onPress={() => changeRenewal(true)}><Text style={[styles.ghostText, text]}>Stop renewing</Text></TouchableOpacity>
                      )
                    ) : null}
                  </View>
                </>
              ) : (
                <View style={styles.rowBetween}>
                  <Text style={[styles.body, muted]}>You are on the free plan.</Text>
                  <TouchableOpacity accessibilityRole="button" style={[styles.ghost, { borderColor: themeColors.border }]} onPress={() => navigation.navigate('Plans')}><Text style={[styles.ghostText, text]}>See plans</Text></TouchableOpacity>
                </View>
              )}
            </View>

            {(b?.products.length || b?.gifts.length) ? (
              <>
                <Text style={[styles.h, text]}>What you hold</Text>
                <View style={[styles.card, card, { gap: 12 }]}>
                  {b!.products.map((p) => (
                    <View key={p.code}>
                      <Text style={[styles.bold, text]}>{p.name}</Text>
                      <Text style={[styles.small, muted]}>until {date(p.valid_until)}{typeof p.uses_remaining === 'number' ? ` · ${p.uses_remaining} ${p.uses_remaining === 1 ? 'use' : 'uses'} left` : ''}</Text>
                    </View>
                  ))}
                  {b!.gifts.map((g, i) => (
                    <View key={i}>
                      <Text style={[styles.bold, text]}>{g.label}</Text>
                      <Text style={[styles.small, muted]}>from {g.from_name} · {g.until ? `until ${date(g.until)}` : 'starts when plans begin'}</Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            <Text style={[styles.h, text]}>Payments and receipts</Text>
            {b?.orders.length ? (
              <View style={[styles.card, card]}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {([['From', from, setFrom], ['To', to, setTo]] as const).map(([lbl, val, set]) => (
                    <View key={lbl} style={{ flex: 1 }}>
                      <Text style={[styles.small, muted, { marginBottom: 4 }]}>{lbl}</Text>
                      <TextInput
                        value={val}
                        onChangeText={set}
                        accessibilityLabel={`${lbl} date`}
                        placeholder="2026-01-31"
                        placeholderTextColor={themeColors.textMuted}
                        maxLength={10}
                        keyboardType="numbers-and-punctuation"
                        autoCapitalize="none"
                        style={[styles.dateInput, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border }]}
                      />
                    </View>
                  ))}
                </View>
                <TouchableOpacity accessibilityRole="button" style={[styles.ghost, { borderColor: themeColors.border, marginTop: 10 }]} onPress={exportCsv}>
                  <Text style={[styles.ghostText, text]}>Download as spreadsheet</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {!b?.orders.length ? (
              <View style={[styles.card, card, { alignItems: 'center', paddingVertical: 28 }]}>
                <Text style={[styles.body, muted]}>You have not paid for anything yet.</Text>
              </View>
            ) : (
              b.orders.map((o) => {
                const st = STATUS[o.status];
                const open = o.dispute_status === 'open' || o.dispute_status === 'under_review';
                return (
                  <View key={o.id} style={[styles.card, card]}>
                    <View style={styles.rowBetween}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.bold, text]} numberOfLines={1}>{o.item}</Text>
                        <Text style={[styles.small, muted]}>{KIND[o.kind] || o.kind} · {date(o.paid_at || o.created_at)} · {invoiceNos[o.id] || o.receipt}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.bold, text]}>{formatMoney(o.amount_minor, o.currency)}</Text>
                        <Text style={[styles.small, { color: st?.color || themeColors.textMuted, fontWeight: '700' }]}>{st?.label || o.status}</Text>
                      </View>
                    </View>
                    {o.refunded_minor > 0 ? <Text style={[styles.small, muted, { marginTop: 6 }]}>{formatMoney(o.refunded_minor, o.currency)} refunded</Text> : null}
                    {open ? <Text style={[styles.small, { color: '#F59E0B', marginTop: 6 }]}>You reported a problem with this payment. We are looking at it.</Text> : null}
                    <View style={styles.actions}>
                      {PAID.includes(o.status) ? <TouchableOpacity accessibilityRole="button" hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }} onPress={() => setReceipt(o)}><Text style={styles.link}>View receipt</Text></TouchableOpacity> : null}
                      {o.can_report && !open ? <TouchableOpacity accessibilityRole="button" hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }} onPress={() => { setReporting(o); setReport(''); }}><Text style={[styles.link, { color: themeColors.textSecondary }]}>Report a problem</Text></TouchableOpacity> : null}
                    </View>
                  </View>
                );
              })
            )}

            {b?.payouts.length ? (
              <>
                <Text style={[styles.h, text]}>Your payouts</Text>
                {b.payouts.map((p) => (
                  <View key={p.id} style={[styles.card, card, styles.rowBetween]}>
                    <Text style={[styles.body, muted]}>{date(p.paid_at || p.created_at)}</Text>
                    <Text style={[styles.bold, text]}>{formatMoney(p.amount_minor, p.currency)}</Text>
                    <Text style={[styles.small, muted]}>{p.status === 'paid' ? 'Paid' : p.status === 'pending' || p.status === 'approved' ? 'On its way' : p.status}</Text>
                  </View>
                ))}
              </>
            ) : null}
            </>)}
          </TabletColumn>
        </ScrollView>
      )}

      <Modal visible={!!receipt} transparent animationType="fade" onRequestClose={() => setReceipt(null)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: themeColors.bgCard }]}>
            <Text style={[styles.planName, text]}>{invoice ? 'Tax invoice' : 'Receipt'} {invoice?.invoice_no || invoiceNos[receipt?.id || ''] || receipt?.receipt}</Text>
            <Text style={[styles.small, muted, { marginBottom: 10 }]}>CineCraft Connect</Text>
            {receipt ? (
              <>
                {[
                  ['Item', receipt.item],
                  ['Date', date(receipt.paid_at || receipt.created_at)],
                  ['Amount', formatMoney(invoice ? invoice.taxable_minor : receipt.amount_minor - receipt.tax_minor, receipt.currency)],
                  ...((invoice ? invoice.tax_minor : receipt.tax_minor) > 0
                    ? [[`${invoice?.tax_label || 'Tax'}${invoice?.tax_rate_bps > 0 ? ` (${invoice.tax_rate_bps / 100}%)` : ''}`, formatMoney(invoice ? invoice.tax_minor : receipt.tax_minor, receipt.currency)]]
                    : []),
                  ...(invoice?.supplier?.gstin ? [['GSTIN', String(invoice.supplier.gstin)]] : []),
                  ...(invoice?.sac_code ? [['SAC', String(invoice.sac_code)]] : []),
                  ['Total paid', formatMoney(receipt.amount_minor, receipt.currency)],
                  ...(receipt.refunded_minor > 0 ? [['Refunded', formatMoney(receipt.refunded_minor, receipt.currency)]] : []),
                ].map(([k, v]) => (
                  <View key={k} style={[styles.rowBetween, styles.line, { borderColor: themeColors.border }]}>
                    <Text style={[styles.body, muted]}>{k}</Text>
                    <Text style={[styles.body, text, { fontWeight: k === 'Total paid' ? '800' : '500' }]}>{v}</Text>
                  </View>
                ))}
              </>
            ) : null}
            <TouchableOpacity accessibilityRole="button" style={[styles.primary, { marginTop: 16 }]} onPress={() => setReceipt(null)}><Text style={styles.primaryText}>Done</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!reporting} transparent animationType="fade" onRequestClose={() => setReporting(null)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: themeColors.bgCard }]}>
            <Text style={[styles.planName, text]}>Report a problem</Text>
            <Text style={[styles.body, muted, { marginVertical: 8 }]}>{reporting ? `${reporting.item}, ${formatMoney(reporting.amount_minor, reporting.currency)}. ` : ''}Tell us what went wrong. We will review it and may refund you.</Text>
            <TextInput
              value={report}
              onChangeText={setReport}
              multiline
              maxLength={1000}
              accessibilityLabel="What happened"
              placeholder="What happened"
              placeholderTextColor={themeColors.textMuted}
              style={[styles.input, { backgroundColor: themeColors.inputBg, color: themeColors.textPrimary, borderColor: themeColors.border }]}
            />
            <View style={[styles.actions, { marginTop: 14 }]}>
              <TouchableOpacity accessibilityRole="button" style={[styles.ghost, { borderColor: themeColors.border }]} onPress={() => setReporting(null)}><Text style={[styles.ghostText, text]}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" disabled={busy || report.trim().length < 10} style={[styles.primary, (busy || report.trim().length < 10) && { opacity: 0.5 }]} onPress={sendReport}>
                <Text style={styles.primaryText}>{busy ? 'Sending' : 'Send report'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 96 },
  lead: { fontSize: 14, marginBottom: 12 },
  beta: { borderWidth: 1, borderColor: 'rgba(255,75,51,0.3)', backgroundColor: 'rgba(255,75,51,0.05)', borderRadius: 16, padding: 14, marginBottom: 8 },
  h: { fontSize: 14, fontWeight: '700', marginTop: 18, marginBottom: 8 },
  card: { borderWidth: 1, borderRadius: 18, padding: 14, marginBottom: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  planName: { fontSize: 18, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 20 },
  small: { fontSize: 12, lineHeight: 17 },
  bold: { fontSize: 14, fontWeight: '700' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, marginTop: 12 },
  primary: { height: 42, borderRadius: 12, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primaryText: { color: '#fff', fontWeight: '700' },
  ghost: { height: 42, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  ghostText: { fontWeight: '600' },
  link: { color: ORANGE, fontWeight: '600', fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 20 },
  sheet: { width: '100%', maxWidth: 520, alignSelf: 'center', borderRadius: 22, padding: 20 },
  line: { paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  dateInput: { height: 40, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 14 },
  input: { minHeight: 110, borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 14, textAlignVertical: 'top' },
});

export default MyPaymentsScreen;
