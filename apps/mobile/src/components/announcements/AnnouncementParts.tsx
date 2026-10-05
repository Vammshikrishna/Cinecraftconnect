import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Icon } from '../common/Icon';
import { CachedImage } from '../common/CachedImage';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';

const ORANGE = '#FF4B33';
const db = () => getSupabaseClient() as any;

export const ANNOUNCEMENT_CATEGORIES: { value: string; label: string; color: string }[] = [
  { value: 'general', label: 'General', color: '#64748B' },
  { value: 'event', label: 'Event', color: '#8B5CF6' },
  { value: 'hiring', label: 'Hiring', color: '#3B82F6' },
  { value: 'release', label: 'Release', color: '#10B981' },
  { value: 'news', label: 'News', color: '#F59E0B' },
  { value: 'maintenance', label: 'Maintenance', color: '#EF4444' },
];

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const ago = (iso: string) => {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  const h = Math.round(mins / 60);
  return h < 24 ? `${h}h` : `${Math.round(h / 24)}d`;
};

/** Pinned / category / audience / scheduled / expiry marks shown above an announcement. */
export const AnnouncementBadges = ({ item }: { item: any }) => {
  const { themeColors: T } = useUserSettings();
  const cat = ANNOUNCEMENT_CATEGORIES.find((c) => c.value === item.category);
  const bits: React.ReactNode[] = [];
  if (item.is_pinned) bits.push(<View key="pin" style={s.row}><Icon name="pin" size={11} color={ORANGE} /><Text style={[s.badgeText, { color: ORANGE }]}>PINNED</Text></View>);
  if (item.unread) bits.push(<View key="new" style={[s.dot]} />);
  if (cat && item.category !== 'general') bits.push(<View key="cat" style={[s.pill, { backgroundColor: `${cat.color}22` }]}><Text style={[s.badgeText, { color: cat.color }]}>{cat.label.toUpperCase()}</Text></View>);
  if (item.audience === 'followers') bits.push(<Text key="aud" style={[s.badgeText, { color: T.textMuted }]}>FOLLOWERS ONLY</Text>);
  if (item.audience === 'team') bits.push(<Text key="aud" style={[s.badgeText, { color: T.textMuted }]}>TEAM ONLY</Text>);
  if (item.scheduled) bits.push(<Text key="sch" style={[s.badgeText, { color: '#F59E0B' }]}>GOES LIVE {fmtDateTime(item.posted_at).toUpperCase()}</Text>);
  if (item.expired) bits.push(<Text key="exp" style={[s.badgeText, { color: '#EF4444' }]}>EXPIRED</Text>);
  else if (item.expires_at) bits.push(<Text key="until" style={[s.badgeText, { color: T.textMuted }]}>UNTIL {fmtDate(item.expires_at).toUpperCase()}</Text>);
  if (item.edited_at) bits.push(<Text key="ed" style={{ color: T.textMuted, fontSize: 10 }}>edited</Text>);
  if (bits.length === 0) return null;
  return <View style={s.badgesRow}>{bits}</View>;
};

/**
 * The three-dot menu for whoever publishes the announcement (the server decides who that is: "can_manage"):
 * Edit, Pin / Unpin, Edit history and Delete. `force` is for the person's own profile list.
 */
export const AnnouncementMenuButton = ({ item, onEdit, onChanged, force = false }: { item: any; onEdit?: (item: any) => void; onChanged: () => void; force?: boolean }) => {
  const { themeColors: T } = useUserSettings();
  if ((!item.can_manage && !force) || item.is_system) return null;

  const togglePin = async () => {
    const { error } = await db().from('announcements').update({ is_pinned: !item.is_pinned }).eq('id', item.id);
    if (error) return Alert.alert(item.is_pinned ? 'Could not unpin' : 'Could not pin', error.message);
    onChanged();
  };

  const history = async () => {
    const { data } = await db().from('announcement_edits').select('old_title, old_content, edited_at').eq('announcement_id', item.id).order('edited_at', { ascending: false }).limit(5);
    if (!data || data.length === 0) return Alert.alert('Edit history', 'No earlier versions are saved.');
    Alert.alert('Edit history', data.map((r: any) => `Before ${fmtDateTime(r.edited_at)}\n"${r.old_title}"\n${String(r.old_content).slice(0, 160)}`).join('\n\n'));
  };

  const remove = () =>
    Alert.alert('Delete announcement', 'Are you sure you want to delete this announcement?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await db().from('announcements').delete().eq('id', item.id);
          if (error) return Alert.alert('Could not delete', error.message);
          onChanged();
        },
      },
    ]);

  const open = () => {
    const buttons: any[] = [];
    if (onEdit) buttons.push({ text: 'Edit', onPress: () => onEdit(item) });
    buttons.push({ text: item.is_pinned ? 'Unpin' : 'Pin to top', onPress: togglePin });
    if (item.edited_at) buttons.push({ text: 'Edit history', onPress: history });
    buttons.push({ text: 'Delete', style: 'destructive', onPress: remove });
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(item.title || 'Announcement', undefined, buttons);
  };

  return (
    <TouchableOpacity onPress={open} style={{ padding: 6 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Announcement options">
      <Icon name="more-vertical" size={18} color={T.textSecondary} />
    </TouchableOpacity>
  );
};

/** A platform broadcast (staff news) in the same list. No reactions or comments. */
export const PlatformCard = ({ item }: { item: any }) => {
  const { themeColors: T } = useUserSettings();
  return (
    <View style={[s.platform, { backgroundColor: 'rgba(255,75,51,0.06)', borderColor: 'rgba(255,75,51,0.3)' }]}>
      <View style={s.row}>
        <Icon name="megaphone" size={12} color={ORANGE} />
        <Text style={{ color: ORANGE, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 }}>PLATFORM NEWS</Text>
        {item.unread ? <View style={s.dot} /> : null}
      </View>
      <AnnouncementCover uri={item.image_url} />
      <Text style={{ color: T.textPrimary, fontSize: 15, fontWeight: '800', marginTop: 6 }}>{item.title}</Text>
      <Text style={{ color: T.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 4 }}>{item.content}</Text>
      <Text style={{ color: T.textMuted, fontSize: 11, marginTop: 8 }}>{ago(item.posted_at)} ago</Text>
    </View>
  );
};

export const AnnouncementCover = ({ uri }: { uri?: string | null }) =>
  uri ? <CachedImage uri={uri} style={s.cover} resizeMode="cover" /> : null;

/** Views (owner only) and report (readers). */
export const AnnouncementActions = ({ item, userId, onReport }: { item: any; userId: string | null; onReport: (item: any) => void }) => {
  const { themeColors: T } = useUserSettings();
  const showViews = !!item.can_manage;
  const showReport = !!userId && item.author_id !== userId;
  if (!showViews && !showReport) return null;
  return (
    <View style={s.actions}>
      {showViews ? (
        <View style={s.row}>
          <Icon name="eye" size={13} color={T.textMuted} />
          <Text style={{ color: T.textMuted, fontSize: 11.5 }}>{item.view_count || 0} views</Text>
        </View>
      ) : <View />}
      {showReport ? (
        <TouchableOpacity onPress={() => onReport(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="flag" size={13} color={T.textMuted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  manageRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  manageBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, height: 26 },
  platform: { borderWidth: 1, borderRadius: 16, padding: 14, marginHorizontal: 16, marginBottom: 14 },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ORANGE },
  cover: { width: '100%', height: 170, borderRadius: 14, marginBottom: 10 },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
});
