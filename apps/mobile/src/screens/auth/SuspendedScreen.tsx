import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { Icon } from '../../components/common/Icon';
import { getSupabaseClient } from '@cinecraft/api';

export const SuspendedScreen = ({ navigation }: { navigation: any }) => {
  const handleSignOut = async () => {
    try {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Landing' }],
      });
    } catch (e: any) {
      Alert.alert('Error', 'Failed to sign out.');
    }
  };

  const handleAppeal = () => {
    Alert.alert(
      'Appeal Decision',
      'Please email support@cinecraftconnect.com to appeal your suspension reference CC-ENF-B001.'
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />
      <View style={styles.content}>
        {/* Ban Icon Container */}
        <View style={styles.iconCircle}>
          <Icon name="x" size={48} color="#DC2626" strokeWidth={3} />
        </View>

        {/* Title */}
        <Text style={styles.title}>Access Restricted</Text>

        {/* Banned Label */}
        <View style={styles.badge}>
          <Icon name="shield" size={14} color="#DC2626" />
          <Text style={styles.badgeText}>Account Suspended</Text>
        </View>

        {/* Description */}
        <Text style={styles.description}>
          Your account has been suspended for violating CineCraft Connect community standards or terms of service. Access to all platform features has been permanently revoked.
        </Text>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.appealBtn} onPress={handleAppeal}>
            <Text style={styles.appealBtnText}>Appeal this decision</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
            <Icon name="arrow-left" size={16} color="#9CA3AF" />
            <Text style={styles.signOutBtnText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          CineCraft Governance Engine • Ref: CC-ENF-B001
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 40,
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(220, 38, 38, 0.3)',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(220, 38, 38, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 99,
    marginBottom: 24,
    gap: 6,
  },
  badgeText: {
    color: '#DC2626',
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  description: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  actions: {
    width: '100%',
    gap: 16,
  },
  appealBtn: {
    backgroundColor: 'rgba(220, 38, 38, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.3)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  appealBtnText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  signOutBtnText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    color: 'rgba(156, 163, 175, 0.3)',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
  },
});

export default SuspendedScreen;
