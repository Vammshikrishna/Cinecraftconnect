import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, ActivityIndicator } from 'react-native';
import { getSupabaseClient } from '@cinecraft/api';
import { friendlyError } from '@cinecraft/core';
import { Icon } from '../common/Icon';
import { LoadErrorState } from '../common/LoadErrorState';
import { useUserSettings } from '../../hooks/useUserSettings';

const ORANGE = '#FF4B33';
const STATUSES: { id: string; label: string }[] = [
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'in-progress', label: 'In progress' },
  { id: 'completed', label: 'Completed' },
  { id: 'delayed', label: 'Delayed' },
];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isRealDate = (s: string) => {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

interface Props {
  projectId: string;
  spaceId?: string;
  readOnly?: boolean;
}

/** Schedule phases of the shoot (schedule_items), the mobile counterpart of the web Budget and schedule tab. */
export const ProjectSchedulePhases: React.FC<Props> = ({ projectId, spaceId, readOnly }) => {
  const { themeColors: T } = useUserSettings();
  const db = getSupabaseClient() as any;
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState('scheduled');

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const filter = spaceId && spaceId !== projectId ? `project_id.eq.${projectId},project_id.eq.${spaceId}` : `project_id.eq.${projectId}`;
      const { data, error } = await db.from('schedule_items').select('*').or(filter).order('start_date', { ascending: true });
      if (error) throw error;
      setItems(data || []);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [projectId, spaceId]);

  useEffect(() => { load(); }, [load]);

  const reset = () => {
    setEditingId(null); setTitle(''); setDescription(''); setStartDate(''); setEndDate(''); setStatus('scheduled'); setFormOpen(false);
  };

  const openEdit = (it: any) => {
    setEditingId(it.id);
    setTitle(it.title || '');
    setDescription(it.description || '');
    setStartDate(String(it.start_date || '').slice(0, 10));
    setEndDate(it.end_date ? String(it.end_date).slice(0, 10) : '');
    setStatus(it.status || 'scheduled');
    setFormOpen(true);
  };

  const save = async () => {
    if (readOnly || saving) return;
    const t = title.trim();
    if (!t) { Alert.alert('Phase title needed', 'Give the phase a title.'); return; }
    if (!isRealDate(startDate.trim())) { Alert.alert('Check the start date', 'Enter the start date as YYYY-MM-DD, for example 2026-03-15.'); return; }
    if (endDate.trim() && !isRealDate(endDate.trim())) { Alert.alert('Check the end date', 'Enter the end date as YYYY-MM-DD, or leave it empty.'); return; }
    if (endDate.trim() && endDate.trim() < startDate.trim()) { Alert.alert('Check the dates', 'The end date cannot be before the start date.'); return; }
    setSaving(true);
    try {
      const payload = {
        title: t,
        description: description.trim() || null,
        start_date: startDate.trim(),
        end_date: endDate.trim() || null,
        status,
      };
      if (editingId) {
        const { error } = await db.from('schedule_items').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        // schedule_items.project_id points at the project SPACE (as on web), not at the project row, so the space id is required
        if (!spaceId) {
          Alert.alert('Could not save the phase', 'This project space is still loading. Please try again in a moment.');
          return;
        }
        const { error } = await db.from('schedule_items').insert([{ project_id: spaceId, ...payload }]);
        if (error) throw error;
      }
      reset();
      load();
    } catch (e: any) {
      Alert.alert('Could not save the phase', friendlyError(e, 'Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = (it: any) => {
    if (readOnly) return;
    Alert.alert('Delete this phase?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { data, error } = await db.from('schedule_items').delete().eq('id', it.id).select('id');
            if (error) throw error;
            if (!data || data.length === 0) {
              Alert.alert('Could not delete', 'The phase was not deleted. You may not have permission, or it no longer exists.');
              return;
            }
            setItems((p) => p.filter((x) => x.id !== it.id));
          } catch (e: any) {
            Alert.alert('Could not delete the phase', friendlyError(e, 'Please try again.'));
            load();
          }
        },
      },
    ]);
  };

  const field = { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 42, fontSize: 13, marginBottom: 10, backgroundColor: T.inputBg, borderColor: T.border, color: T.textPrimary } as const;

  return (
    <View style={{ marginTop: 22 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <View>
          <Text style={{ color: ORANGE, fontSize: 11, fontWeight: '800', letterSpacing: 1 }}>PRODUCTION ROADMAP</Text>
          <Text style={{ color: T.textPrimary, fontSize: 17, fontWeight: '800' }}>Schedule phases</Text>
        </View>
        {!readOnly && !formOpen ? (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Schedule a phase" onPress={() => setFormOpen(true)} style={{ height: 36, paddingHorizontal: 14, borderRadius: 10, backgroundColor: ORANGE, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="plus" size={14} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Add phase</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {formOpen && !readOnly ? (
        <View style={{ borderWidth: 1, borderColor: T.border, backgroundColor: T.bgCard, borderRadius: 16, padding: 12, marginBottom: 12 }}>
          <Text style={{ color: T.textMuted, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>{editingId ? 'EDIT PHASE' : 'NEW PHASE'}</Text>
          <TextInput accessibilityLabel="Phase title" style={field} placeholder="Phase title, e.g. Principal photography" placeholderTextColor={T.textMuted} value={title} onChangeText={setTitle} maxLength={120} />
          <TextInput accessibilityLabel="Phase description" style={[field, { height: 64, paddingTop: 10, textAlignVertical: 'top' }]} placeholder="Description (optional)" placeholderTextColor={T.textMuted} value={description} onChangeText={setDescription} multiline maxLength={500} />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput accessibilityLabel="Start date" style={[field, { flex: 1 }]} placeholder="Start YYYY-MM-DD" placeholderTextColor={T.textMuted} value={startDate} onChangeText={setStartDate} autoCapitalize="none" keyboardType="numbers-and-punctuation" maxLength={10} />
            <TextInput accessibilityLabel="End date" style={[field, { flex: 1 }]} placeholder="End YYYY-MM-DD" placeholderTextColor={T.textMuted} value={endDate} onChangeText={setEndDate} autoCapitalize="none" keyboardType="numbers-and-punctuation" maxLength={10} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {STATUSES.map((s) => {
              const on = status === s.id;
              return (
                <TouchableOpacity key={s.id} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setStatus(s.id)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, backgroundColor: on ? ORANGE : T.inputBg, borderColor: on ? ORANGE : T.border }}>
                  <Text style={{ color: on ? '#fff' : T.textPrimary, fontSize: 12, fontWeight: '700' }}>{s.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cancel" onPress={reset} style={{ flex: 1, height: 42, borderRadius: 12, borderWidth: 1, borderColor: T.border, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: T.textPrimary, fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Save phase" disabled={saving} onPress={save} style={{ flex: 1, height: 42, borderRadius: 12, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', opacity: saving ? 0.6 : 1 }}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>{editingId ? 'Save changes' : 'Add phase'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator color={ORANGE} style={{ marginVertical: 14 }} />
      ) : failed && items.length === 0 ? (
        <LoadErrorState style={{ marginTop: 16 }} message="Could not load the schedule. Check your connection and try again." onRetry={() => { setLoading(true); load(); }} />
      ) : items.length === 0 ? (
        <Text style={{ color: T.textMuted, fontSize: 13 }}>No phases scheduled yet.</Text>
      ) : (
        items.map((it) => {
          const st = STATUSES.find((s) => s.id === it.status)?.label || 'Scheduled';
          const range = it.end_date && it.end_date !== it.start_date ? `${String(it.start_date).slice(0, 10)} to ${String(it.end_date).slice(0, 10)}` : String(it.start_date || '').slice(0, 10);
          return (
            <View key={it.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: T.border, backgroundColor: T.bgCard, borderRadius: 14, padding: 12, marginBottom: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: T.textPrimary, fontSize: 14, fontWeight: '700' }} numberOfLines={2}>{it.title}</Text>
                <Text style={{ color: T.textSecondary, fontSize: 12, marginTop: 2 }}>{range} · {st}{it.is_locked ? ' · Locked' : ''}</Text>
                {it.description ? <Text style={{ color: T.textMuted, fontSize: 12, marginTop: 2 }} numberOfLines={2}>{it.description}</Text> : null}
              </View>
              {!readOnly ? (
                <>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Edit phase ${it.title}`} onPress={() => openEdit(it)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Icon name="edit-2" size={15} color={T.iconSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Delete phase ${it.title}`} onPress={() => remove(it)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Icon name="trash-2" size={15} color={T.iconMuted} />
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
          );
        })
      )}
    </View>
  );
};

export default ProjectSchedulePhases;
