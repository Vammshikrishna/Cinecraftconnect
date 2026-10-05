import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useUserSettings } from '../../hooks/useUserSettings';

const ORANGE = '#FF4B33';

/** Bookings (gear and locations) and Quotes (services) are two halves of one "Orders" area. */
export const OrdersTabs = ({ current, navigation }: { current: 'bookings' | 'quotes'; navigation: any }) => {
  const { themeColors: T } = useUserSettings();
  const tab = (key: 'bookings' | 'quotes', label: string, route: string) => (
    <TouchableOpacity
      key={key}
      style={[styles.tab, current === key && { backgroundColor: T.bgCard }]}
      onPress={() => current !== key && navigation.replace(route)}
    >
      <Text style={{ color: current === key ? ORANGE : T.textSecondary, fontSize: 13, fontWeight: '800' }}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <View style={[styles.wrap, { backgroundColor: T.inputBg }]}>
      {tab('bookings', 'Bookings', 'MyBookings')}
      {tab('quotes', 'Quotes', 'MyQuotes')}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', margin: 14, marginBottom: 0, borderRadius: 12, padding: 3 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10 },
});
