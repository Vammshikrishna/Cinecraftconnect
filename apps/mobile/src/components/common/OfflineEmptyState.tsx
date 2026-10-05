import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Icon } from './Icon';
import { useUserSettings } from '../../contexts/SettingsContext';

export const OfflineEmptyState = () => {
  const { themeColors } = useUserSettings();

  return (
    <View style={styles.container}>
      <View style={[styles.card, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
        <View style={styles.iconBox}>
          <Icon name="wifi-off" size={30} color="#FF4B33" />
        </View>
        <Text style={[styles.title, { color: themeColors.textPrimary }]}>
          Please connect to the internet to view this page.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    paddingBottom: 24,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    marginHorizontal: 12,
    marginVertical: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 75, 51, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 17,
    fontFamily: 'Lora-Bold',
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'WorkSans-Regular',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
    maxWidth: 320,
  },
});
