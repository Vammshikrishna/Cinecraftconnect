import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Icon } from '../common/Icon';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useAppRole } from '../../hooks/useAppRole';

const ORANGE = '#FF4B33';

const Blocked = ({ navigation }: { navigation: any }) => {
  const { themeColors } = useUserSettings();
  return (
    <View style={[styles.wrap, { backgroundColor: themeColors.bgScreen }]}>
      <View style={styles.icon}><Icon name="shield" size={30} color={ORANGE} /></View>
      <Text style={[styles.title, { color: themeColors.textPrimary }]}>Not available for staff accounts</Text>
      <Text style={[styles.body, { color: themeColors.textSecondary }]}>
        Internal accounts are for governance, moderation and support. They do not post, message, apply or rate.
      </Text>
      <TouchableOpacity accessibilityRole="button" onPress={() => navigation?.goBack?.()} style={styles.btn}>
        <Text style={styles.btnText}>Go back</Text>
      </TouchableOpacity>
    </View>
  );
};

/**
 * Wraps a screen that belongs to the social side of the app (writing posts, direct messages, applications, bookings,
 * ratings). Staff accounts see a short explanation instead. The database refuses the same actions too
 * (see docs/STAFF_ACCOUNT_RULES.md). Wrap each screen once, at module level, so it is not remounted on every render.
 */
export const withStaffBlock = <P extends { navigation?: any }>(Screen: React.ComponentType<P>) => {
  const Wrapped = (props: P) => {
    const { isInternal } = useAppRole();
    if (isInternal) return <Blocked navigation={props.navigation} />;
    return <Screen {...props} />;
  };
  Wrapped.displayName = `StaffBlock(${(Screen as any).displayName || (Screen as any).name || 'Screen'})`;
  return Wrapped;
};

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  icon: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(255,75,51,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  body: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8, maxWidth: 320 },
  btn: { marginTop: 22, height: 46, paddingHorizontal: 28, borderRadius: 14, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
