import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Linking } from 'react-native';
import { formatMoney } from '@cinecraft/core';
import { Icon } from '../common/Icon';
import { useUserSettings } from '../../hooks/useUserSettings';
import type { ProductAccess } from '../../hooks/useBilling';

const ORANGE = '#FF4B33';
const WORD = { one_time: 'one-time', monthly: 'a month', yearly: 'a year' } as const;

/**
 * The line shown above a form that needs a separate paid product. Free during the beta; once live it either confirms
 * the purchase is active or offers to buy it. The form around it decides whether to block submitting (`needsPurchase`).
 */
export const ProductNotice: React.FC<{ access: ProductAccess; buying: boolean; onBuy: () => Promise<{ url?: string; error?: string }> }> = ({ access, buying, onBuy }) => {
  const { themeColors: T } = useUserSettings();
  if (!access.found) return null;

  if (!access.required) {
    return (
      <View style={[s.box, { borderColor: 'rgba(255,75,51,0.25)', backgroundColor: 'rgba(255,75,51,0.05)' }]}>
        <Icon name="sparkles" size={16} color={ORANGE} />
        <Text style={[s.text, { color: T.textSecondary, flex: 1 }]}>
          <Text style={{ fontWeight: '700', color: T.textPrimary }}>Free during the beta. </Text>This will be a paid {access.name?.toLowerCase()} later.
        </Text>
      </View>
    );
  }

  if (access.has_access) {
    return (
      <View style={[s.box, { borderColor: 'rgba(16,185,129,0.3)', backgroundColor: 'rgba(16,185,129,0.1)' }]}>
        <Icon name="check" size={16} color="#10B981" />
        <Text style={[s.text, { color: T.textSecondary, flex: 1 }]}>
          <Text style={{ fontWeight: '700', color: T.textPrimary }}>{access.name} is active</Text>
          {access.valid_until ? ` until ${new Date(access.valid_until).toLocaleDateString()}` : ''}
          {typeof access.uses_remaining === 'number' ? `, ${access.uses_remaining} ${access.uses_remaining === 1 ? 'submission' : 'submissions'} left` : ''}
        </Text>
      </View>
    );
  }

  const buy = async () => {
    const r = await onBuy();
    if (r.url) void Linking.openURL(r.url);
    else Alert.alert('Could not start the payment', r.error || 'Payments are not available yet.');
  };

  return (
    <View style={[s.card, { borderColor: T.border, backgroundColor: T.bgCard }]}>
      <Text style={{ fontWeight: '700', fontSize: 15, color: T.textPrimary }}>{access.name}</Text>
      {access.description ? <Text style={[s.text, { color: T.textSecondary, marginTop: 2 }]}>{access.description}</Text> : null}
      <View style={s.row}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: T.textPrimary }}>
          {formatMoney(access.price_minor ?? 0, access.currency)} <Text style={{ fontSize: 13, fontWeight: '400', color: T.textMuted }}>{WORD[access.billing || 'one_time']}</Text>
        </Text>
        <TouchableOpacity accessibilityRole="button" disabled={buying || access.is_active === false} onPress={buy} style={[s.btn, (buying || access.is_active === false) && { opacity: 0.5 }]}>
          {buying ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{access.is_active === false ? 'Not on sale yet' : 'Buy'}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const s = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12 },
  text: { fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12 },
  btn: { height: 40, borderRadius: 12, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  btnText: { color: '#fff', fontWeight: '700' },
});

export default ProductNotice;
