import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Linking, Alert, ActivityIndicator } from 'react-native';
import {
  collabLine, fetchCollaborators, formatSchedule, isScheduledFuture, removeCollaborator, reschedulePost, respondToCollaboration,
  type LinkPreview, type PostCollabs,
} from '@cinecraft/core';
import { getSupabaseClient } from '@cinecraft/api';
import { Icon } from '../common/Icon';
import { useUserSettings } from '../../hooks/useUserSettings';
import { friendlyError } from '@cinecraft/core';

const ORANGE = '#FF4B33';

/** Shown to the author of a post that is waiting for its publish time. */
export const ScheduledBanner: React.FC<{ postId: string; scheduledAt: string; onChanged?: () => void }> = ({ postId, scheduledAt, onChanged }) => {
  const { themeColors } = useUserSettings();
  const [busy, setBusy] = useState(false);
  if (!isScheduledFuture(scheduledAt)) return null;

  const publishNow = async () => {
    setBusy(true);
    try {
      await reschedulePost(getSupabaseClient(), postId, null);
      Alert.alert('Published', 'Your post is live now.');
      onChanged?.();
    } catch (e: any) {
      Alert.alert('Could not publish', friendlyError(e, 'Please try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.banner, { borderColor: '#FF4B3355', backgroundColor: '#FF4B330D' }]} accessibilityRole="summary">
      <Icon name="clock" size={16} color={ORANGE} />
      <Text style={[styles.bannerText, { color: themeColors.textPrimary }]}>
        Scheduled for <Text style={{ fontWeight: '700' }}>{formatSchedule(scheduledAt)}</Text>. Only you can see it until then.
      </Text>
      <TouchableOpacity onPress={publishNow} disabled={busy} style={styles.bannerBtn} accessibilityRole="button" accessibilityLabel="Publish now">
        {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.bannerBtnText}>Publish now</Text>}
      </TouchableOpacity>
    </View>
  );
};

/** "with Sam and Ria", plus accept / decline for a person who was invited. */
export const CollaboratorsLine: React.FC<{ postId: string; currentUserId?: string | null; onOpenProfile?: (id: string) => void }> = ({ postId, currentUserId, onOpenProfile }) => {
  const { themeColors } = useUserSettings();
  const [data, setData] = useState<PostCollabs | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const map = await fetchCollaborators(getSupabaseClient(), [postId]);
    setData(map[postId] ?? null);
  }, [postId]);
  useEffect(() => { load(); }, [load]);
  if (!data) return null;

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); await load(); } catch (e: any) { Alert.alert('Could not update', friendlyError(e, 'Please try again.')); } finally { setBusy(false); }
  };

  return (
    <View style={{ marginHorizontal: 12, marginTop: 6, gap: 8 }}>
      {data.my_status === 'pending' && (
        <View style={[styles.invite, { borderColor: '#FF4B3355', backgroundColor: '#FF4B330D' }]}>
          <Text style={{ color: themeColors.textPrimary, fontSize: 13 }}>You were invited to be credited on this post.</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <TouchableOpacity style={styles.bannerBtn} disabled={busy} onPress={() => act(() => respondToCollaboration(getSupabaseClient(), postId, true))} accessibilityRole="button">
              <Text style={styles.bannerBtnText}>Accept</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.bannerBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: themeColors.border }]} disabled={busy} onPress={() => act(() => respondToCollaboration(getSupabaseClient(), postId, false))} accessibilityRole="button">
              <Text style={[styles.bannerBtnText, { color: themeColors.textPrimary }]}>Decline</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {data.accepted.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 }}>
          <Icon name="users" size={14} color={themeColors.iconSecondary} />
          <Text style={{ fontSize: 13, color: themeColors.textSecondary }} accessibilityLabel={collabLine(data.accepted)}>
            {data.accepted.map((p, i) => (
              <Text key={p.id}>
                {i === 0 ? 'with ' : i === data.accepted.length - 1 ? ' and ' : ', '}
                <Text style={{ fontWeight: '700', color: themeColors.textPrimary }} onPress={() => onOpenProfile?.(p.id)}>{p.full_name || `@${p.username}`}</Text>
              </Text>
            ))}
          </Text>
          {data.my_status === 'accepted' && !!currentUserId && (
            <TouchableOpacity disabled={busy} onPress={() => act(() => removeCollaborator(getSupabaseClient(), postId, currentUserId))} accessibilityRole="button" accessibilityLabel="Remove me from this post" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={{ fontSize: 12, textDecorationLine: 'underline', color: themeColors.textSecondary }}>Remove me</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {data.is_author && data.pending.length > 0 && (
        <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>Waiting for {data.pending.map((p) => p.full_name || `@${p.username}`).join(', ')} to answer.</Text>
      )}
    </View>
  );
};

/** The title, description and picture of the first link in a post. */
export const LinkPreviewCard: React.FC<{ preview: LinkPreview; compact?: boolean }> = ({ preview }) => {
  const { themeColors } = useUserSettings();
  let host = preview.site || '';
  try { host = host || new URL(preview.url).hostname.replace(/^www\./, ''); } catch { /* keep what we have */ }
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => { if (/^https?:\/\//i.test(preview.url)) Linking.openURL(preview.url).catch(() => { }); }}
      style={[styles.link, { borderColor: themeColors.border, backgroundColor: themeColors.bgCard }]}
      accessibilityRole="link"
      accessibilityLabel={`Link: ${preview.title}, ${host}`}
    >
      {!!preview.image && <Image source={{ uri: preview.image }} style={styles.linkImg} resizeMode="cover" />}
      <View style={{ flex: 1, padding: 10 }}>
        <Text style={{ fontSize: 12, color: themeColors.textSecondary }} numberOfLines={1}>{host}</Text>
        <Text style={{ fontSize: 14, fontWeight: '700', color: themeColors.textPrimary, marginTop: 2 }} numberOfLines={2}>{preview.title}</Text>
        {!!preview.description && <Text style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 3 }} numberOfLines={2}>{preview.description}</Text>}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, padding: 10, marginHorizontal: 12, marginTop: 8, flexWrap: 'wrap' },
  bannerText: { flex: 1, fontSize: 13, minWidth: 160 },
  bannerBtn: { backgroundColor: ORANGE, borderRadius: 16, paddingHorizontal: 14, minHeight: 36, minWidth: 70, alignItems: 'center', justifyContent: 'center' },
  bannerBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  invite: { borderWidth: 1, borderRadius: 14, padding: 10 },
  link: { flexDirection: 'row', overflow: 'hidden', borderWidth: 1, borderRadius: 14, marginHorizontal: 12, marginTop: 8 },
  linkImg: { width: 96, height: 'auto' as any, minHeight: 84 },
});
