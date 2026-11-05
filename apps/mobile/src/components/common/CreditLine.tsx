import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useUserSettings } from '../../hooks/useUserSettings';

interface CreditLineProps {
  /** left side: what the credit is about (a project title, or a role) */
  lead: string;
  /** right side: who or what it credits (a role, or a person's name) */
  trail: string;
  /** small line under the row, for who confirmed it and when */
  note?: string;
  /** render the left side in the serif display face (titles) instead of the muted body face (roles) */
  serifLead?: boolean;
}

/** One line of a film-credits list: lead, a dotted leader, then trail. */
export const CreditLine: React.FC<CreditLineProps> = ({ lead, trail, note, serifLead = false }) => {
  const { themeColors } = useUserSettings();
  return (
    <View style={[styles.wrap, { borderBottomColor: themeColors.divider }]}>
      <View style={styles.row}>
        <Text
          numberOfLines={1}
          style={serifLead ? [styles.serif, { color: themeColors.textPrimary }] : [styles.sans, { color: themeColors.textSecondary }]}
        >
          {lead}
        </Text>
        <View style={styles.leaderBox} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text numberOfLines={1} style={[styles.leader, { color: themeColors.border }]}>
            {'· '.repeat(80)}
          </Text>
        </View>
        <Text
          numberOfLines={1}
          style={serifLead ? [styles.sansTrail, { color: themeColors.textSecondary }] : [styles.serifTrail, { color: themeColors.textPrimary }]}
        >
          {trail}
        </Text>
      </View>
      {!!note && <Text style={[styles.note, { color: themeColors.textMuted }]}>{note}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'baseline' },
  serif: { fontFamily: 'Lora-SemiBold', fontSize: 18, flexShrink: 1 },
  sans: { fontFamily: 'WorkSans-Regular', fontSize: 14, flexShrink: 1 },
  serifTrail: { fontFamily: 'Lora-SemiBold', fontSize: 16, flexShrink: 0, maxWidth: '55%', textAlign: 'right' },
  sansTrail: { fontFamily: 'WorkSans-Regular', fontSize: 14, flexShrink: 0, maxWidth: '55%', textAlign: 'right' },
  leaderBox: { flex: 1, minWidth: 24, marginHorizontal: 8, overflow: 'hidden', height: 18, justifyContent: 'center' },
  leader: { fontSize: 14, letterSpacing: 1 },
  note: { fontFamily: 'WorkSans-Regular', fontSize: 12, marginTop: 4 },
});

export default CreditLine;
