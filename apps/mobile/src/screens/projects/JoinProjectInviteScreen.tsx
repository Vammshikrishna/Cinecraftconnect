import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { getSupabaseClient } from '@cinecraft/api';
import { friendlyError } from '@cinecraft/core';
import { useUserSettings } from '../../hooks/useUserSettings';
import { Header } from '../../components/Header';

const ORANGE = '#FF4B33';

/** Friendly wording for the codes the join_project_by_invite function can raise. */
const inviteMessage = (e: any): string => {
  const raw = String(e?.message || e?.details || '').toLowerCase();
  if (raw.includes('expired')) return 'This invite link has expired. Ask the project owner for a new one.';
  if (raw.includes('max') || raw.includes('used') || raw.includes('limit') || raw.includes('no longer')) return 'This invite link has been used up. Ask the project owner for a new one.';
  if (raw.includes('invalid') || raw.includes('not found') || raw.includes('no rows')) return 'This invite link is not valid. Check the link or ask the project owner for a new one.';
  return friendlyError(e, 'This invite link could not be used.');
};

/** /projects/join/:code - redeems a project invite link (Team > Invite link) and opens the project space. */
export const JoinProjectInviteScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  const { themeColors: T } = useUserSettings();
  const code: string | undefined = route?.params?.code;
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!code) {
      setError('This invite link is not valid.');
      return;
    }
    (async () => {
      try {
        const { data, error: rpcError } = await (getSupabaseClient() as any).rpc('join_project_by_invite', { p_code: code });
        if (rpcError) throw rpcError;
        navigation.replace('ProjectSpace', { projectId: data });
      } catch (e: any) {
        setError(inviteMessage(e));
      }
    })();
  }, [code, navigation]);

  const goBack = () => {
    try {
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.navigate('MainTabs');
    } catch {
      /* nothing to go back to */
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.bgScreen }}>
      <Header title="Project invite" showLogo={false} onBack={goBack} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 }}>
        {error ? (
          <>
            <Text style={{ color: T.textPrimary, fontSize: 20, fontWeight: '700', textAlign: 'center' }}>Could not join the project</Text>
            <Text style={{ color: T.textMuted, marginTop: 8, textAlign: 'center' }}>{error}</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back to projects" onPress={() => navigation.navigate('MainTabs', { screen: 'Projects' })} style={{ marginTop: 18, height: 44, paddingHorizontal: 24, borderRadius: 14, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Back to projects</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <ActivityIndicator color={ORANGE} size="large" />
            <Text style={{ color: T.textMuted, marginTop: 12 }}>Joining the project…</Text>
          </>
        )}
      </View>
    </View>
  );
};

export default JoinProjectInviteScreen;
