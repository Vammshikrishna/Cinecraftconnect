import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  TextInput,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Icon } from '../../components/common/Icon';
import { getSupabaseClient } from '@cinecraft/api';
import { friendlyError } from '@cinecraft/core';

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

  const [appeal, setAppeal] = useState<{ status: string; decision_note: string | null } | null>(null);
  const [writing, setWriting] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const supabase: any = getSupabaseClient();
        const uid = (await supabase.auth.getSession()).data.session?.user?.id;
        if (!uid) return;
        const { data } = await supabase.from('appeals').select('status, decision_note').eq('user_id', uid).order('created_at', { ascending: false }).limit(1).maybeSingle();
        if (data) setAppeal(data);
      } catch {}
    })();
  }, []);

  const sendAppeal = async () => {
    setSending(true);
    try {
      const supabase: any = getSupabaseClient();
      const { error } = await supabase.rpc('submit_appeal', { p_message: message });
      if (error) throw error;
      setAppeal({ status: 'pending', decision_note: null });
      setWriting(false);
    } catch (e: any) {
      Alert.alert('Could not send your appeal', friendlyError(e, 'Please try again.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0D0D0D" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
          {appeal?.status === 'pending' ? (
            <Text style={styles.description}>Your appeal has been sent. We will let you know the decision.</Text>
          ) : writing ? (
            <View style={{ gap: 10 }}>
              <TextInput
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={2000}
                placeholder="Explain why this decision should change (at least 20 characters)"
                placeholderTextColor="#64748B"
                style={{ minHeight: 110, borderWidth: 1, borderColor: '#374151', borderRadius: 12, padding: 12, color: '#F9FAFB', textAlignVertical: 'top' }}
              />
              {message.trim().length < 20 && (
                <Text style={{ color: '#9CA3AF', fontSize: 12 }} accessibilityLiveRegion="polite">{message.trim().length}/20 characters minimum</Text>
              )}
              <TouchableOpacity style={[styles.appealBtn, (sending || message.trim().length < 20) && { opacity: 0.5 }]} onPress={sendAppeal} disabled={sending || message.trim().length < 20}>
                {sending ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.appealBtnText}>Send appeal</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setWriting(false)} disabled={sending} style={{ minHeight: 44, justifyContent: 'center' }} accessibilityRole="button">
                <Text style={[styles.signOutBtnText, { textAlign: 'center' }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {!!appeal && appeal.status !== 'pending' && (
                <Text style={[styles.description, { marginBottom: 8 }]}>
                  Your last appeal was {appeal.status === 'reversed' ? 'accepted' : 'reviewed and the decision stands'}{appeal.decision_note ? ': ' + appeal.decision_note : '.'}
                </Text>
              )}
              <TouchableOpacity style={styles.appealBtn} onPress={() => setWriting(true)}>
                <Text style={styles.appealBtnText}>Appeal this decision</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
            <Icon name="arrow-left" size={16} color="#9CA3AF" />
            <Text style={styles.signOutBtnText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          CineCraft Governance Engine • Ref: CC-ENF-B001
        </Text>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 32,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
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
    fontWeight: '700',
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
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
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
    maxWidth: 480,
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
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  footer: {
    marginTop: 32,
    color: 'rgba(156, 163, 175, 0.65)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
});

export default SuspendedScreen;
