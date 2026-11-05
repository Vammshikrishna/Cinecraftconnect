import React from 'react';
import { View, StyleSheet } from 'react-native';

export const PHONE_W = 288;
export const PHONE_H = 600;

/** A phone frame drawn with views. Decorative: the text next to it says everything it shows. */
export const PhoneMock = ({ children }: { children: React.ReactNode }) => (
  <View style={styles.frame} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <View style={styles.screen}>
      {children}
      <View style={styles.island} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  frame: {
    width: PHONE_W,
    height: PHONE_H,
    borderRadius: 46,
    padding: 9,
    backgroundColor: '#17171b',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    elevation: 6,
    shadowColor: '#FF4B33',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
  },
  screen: { flex: 1, borderRadius: 37, overflow: 'hidden', backgroundColor: '#F8F9FA' },
  island: { position: 'absolute', top: 10, alignSelf: 'center', width: 84, height: 24, borderRadius: 14, backgroundColor: '#0b0b0d' },
});
