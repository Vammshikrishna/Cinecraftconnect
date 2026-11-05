import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Share, Clipboard, ActivityIndicator } from 'react-native';
import { getSupabaseClient } from '@cinecraft/api';
import { Icon } from '../common/Icon';
import { useUserSettings } from '../../hooks/useUserSettings';

const ORANGE = '#FF4B33';
const APP_ORIGIN = 'https://cinecraftconnect.com';

/** Secure random invite code (same shape as the web app: 18 base-36 characters). */
const makeCode = (): string => {
  const bytes = new Uint8Array(12);
  const c: any = (globalThis as any).crypto;
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 18);
};

/**
 * Team tab: owner / admin can create a 7-day invite link (project_invites, exactly as the web app's Team tab),
 * copy it or share it. People open it on /projects/join/:code (see JoinProjectInviteScreen).
 */
export const ProjectInviteCard: React.FC<{ spaceId: string; userId?: string | null }> = ({ spaceId, userId }) => {
  const { themeColors: T } = useUserSettings();
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const link = code ? `${APP_ORIGIN}/projects/join/${code}` : '';

  const generate = async () => {
    if (!spaceId || busy) return;
    setBusy(true);
    try {
      const next = makeCode();
      const { error } = await (getSupabaseClient() as any).from('project_invites').insert([{
        project_id: spaceId,
        invite_code: next,
        created_by: userId || null,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }]);
      if (error) throw error;
      setCode(next);
    } catch {
      Alert.alert('Could not create the invite', 'Failed to generate an invite link. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const copy = () => {
    try {
      Clipboard.setString(link);
      Alert.alert('Copied', 'Invite link copied to the clipboard.');
    } catch {
      Alert.alert('Could not copy', 'Please try again.');
    }
  };

  const share = async () => {
    try {
      await Share.share({ message: `Join my project on CineCraft Connect: ${link}` });
    } catch {
      /* the share sheet was dismissed or is unavailable */
    }
  };

  return (
    <View style={{ borderWidth: 1, borderColor: T.border, backgroundColor: T.bgCard, borderRadius: 16, padding: 14, marginBottom: 14 }}>
      <Text style={{ color: T.textPrimary, fontSize: 14, fontWeight: '800' }}>Invite link</Text>
      {!code ? (
        <>
          <Text style={{ color: T.textMuted, fontSize: 12, marginTop: 4 }}>Create a link that lets people join this project. It works for 7 days.</Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Generate invite link"
            disabled={busy}
            onPress={generate}
            style={{ marginTop: 10, height: 42, borderRadius: 12, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Generate invite link</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text selectable style={{ color: T.textSecondary, fontSize: 12, marginTop: 6 }}>{link}</Text>
          <Text style={{ color: T.textMuted, fontSize: 12, marginTop: 4 }}>This link expires in 7 days. Share it with the people you want to invite.</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Copy invite link" onPress={copy} style={{ flex: 1, height: 42, borderRadius: 12, borderWidth: 1, borderColor: T.border, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="copy" size={15} color={T.textPrimary} />
              <Text style={{ color: T.textPrimary, fontWeight: '700' }}>Copy</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Share invite link" onPress={share} style={{ flex: 1, height: 42, borderRadius: 12, backgroundColor: ORANGE, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="share-2" size={15} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700' }}>Share</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
    </View>
  );
};

export default ProjectInviteCard;
