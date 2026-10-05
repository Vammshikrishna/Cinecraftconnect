import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { subscribeNetworkStatus } from '../../services/offlineCache';
import { Icon } from './Icon';

export const OfflineBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState(false);
  const [showRestored, setShowRestored] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeNetworkStatus((isConnected) => {
      const offline = !isConnected;
      
      if (wasOffline && isConnected) {
        setShowRestored(true);
        const timer = setTimeout(() => {
          setShowRestored(false);
        }, 3000);
        setIsOffline(false);
        setWasOffline(false);
        return () => clearTimeout(timer);
      }

      if (offline) {
        setWasOffline(true);
        setIsOffline(true);
        setShowRestored(false);
      } else {
        setIsOffline(false);
      }
    });
    return () => unsubscribe();
  }, [wasOffline]);

  if (showRestored) {
    return (
      <View style={styles.restoredContainer}>
        <Icon name="check-circle" size={14} color="#065F46" />
        <Text style={styles.restoredText}>Back Online — Auto-updating screens...</Text>
      </View>
    );
  }

  if (!isOffline) return null;

  return (
    <View style={styles.bannerContainer}>
      <Icon name="wifi-off" size={14} color="#FFFFFF" />
      <Text style={styles.bannerText}>No internet is connected, please connect to internet</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  bannerContainer: {
    backgroundColor: '#EF4444',
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  bannerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Lora-Medium',
    fontWeight: '600',
  },
  restoredContainer: {
    backgroundColor: '#D1FAE5',
    borderColor: '#6EE7B7',
    borderBottomWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  restoredText: {
    color: '#065F46',
    fontSize: 12,
    fontFamily: 'Lora-Medium',
    fontWeight: '600',
  },
});

export default OfflineBanner;
