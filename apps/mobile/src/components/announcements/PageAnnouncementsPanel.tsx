import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Icon } from '../common/Icon';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';
import { ReportModal } from '../modals/ReportModal';
import { CreateAnnouncementModal } from '../modals/CreateAnnouncementModal';
import { AnnouncementBadges, AnnouncementCover, AnnouncementActions, AnnouncementMenuButton } from './AnnouncementParts';

const ORANGE = '#FF4B33';

const ago = (iso: string) => {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
};

/** A company page's own announcements. The team can post, pin and edit from here. */
export const PageAnnouncementsPanel = ({ pageId, canManage, userId }: { pageId: string; canManage: boolean; userId: string | null }) => {
  const { themeColors: T } = useUserSettings();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [reportFor, setReportFor] = useState<any | null>(null);

  const load = useCallback(async () => {
    const { data } = await (getSupabaseClient() as any).rpc('list_announcements', { p_limit: 30, p_before: null, p_filter: 'all', p_category: null, p_search: null, p_page_id: pageId });
    setItems(data || []);
    setLoading(false);
  }, [pageId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View>
      {canManage && (
        <TouchableOpacity onPress={() => setCreateOpen(true)} style={s.newBtn}>
          <Icon name="plus" size={14} color="#fff" />
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12.5 }}>New announcement</Text>
        </TouchableOpacity>
      )}

      {loading ? (
        <ActivityIndicator color={ORANGE} style={{ marginVertical: 24 }} />
      ) : items.length === 0 ? (
        <Text style={{ color: T.textMuted, textAlign: 'center', paddingVertical: 24 }}>
          {canManage ? 'Share news, events and openings with your followers.' : 'This company has not announced anything yet.'}
        </Text>
      ) : (
        items.map((a) => (
          <View key={a.id} style={[s.card, { backgroundColor: T.bgCard, borderColor: T.border }]}>
            <AnnouncementBadges item={a} />
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <Text style={{ color: T.textPrimary, fontSize: 15, fontWeight: '800', flex: 1 }}>{a.title}</Text>
              <AnnouncementMenuButton item={a} onEdit={setEditing} onChanged={load} />
            </View>
            <AnnouncementCover uri={a.image_url} />
            <Text style={{ color: T.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 4 }} numberOfLines={6}>
              {String(a.content).split('JOB_SHARE::')[0].trim()}
            </Text>
            <Text style={{ color: T.textMuted, fontSize: 11, marginTop: 6 }}>{ago(a.posted_at)}</Text>
            <AnnouncementActions item={a} userId={userId} onReport={setReportFor} />
          </View>
        ))
      )}

      <ReportModal visible={!!reportFor} onClose={() => setReportFor(null)} targetTitle="this announcement" targetType="announcement" targetId={reportFor?.id || ''} />
      {canManage && (
        <CreateAnnouncementModal
          visible={createOpen || !!editing}
          editing={editing}
          defaultPageId={pageId}
          onClose={() => {
            setCreateOpen(false);
            setEditing(null);
          }}
          onSuccess={load}
        />
      )}
    </View>
  );
};

const s = StyleSheet.create({
  newBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: ORANGE, height: 40, borderRadius: 12, marginBottom: 12 },
  card: { borderWidth: 1, borderRadius: 16, padding: 14, marginBottom: 12 },
});
