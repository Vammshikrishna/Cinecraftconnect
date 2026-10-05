import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, TextInput, Switch, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Icon } from '../common/Icon';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';
import { describeAlert, JOB_TYPES, JOB_TYPE_LABELS, WORK_MODES, WORK_MODE_LABELS, type JobAlertCriteria } from '@cinecraft/core';
import { ORANGE } from './JobsShared';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Pre-fills the form from the current search. */
  prefill?: JobAlertCriteria;
}

const db = () => getSupabaseClient() as any;

/** Saved searches: a notification when a matching job is posted (same as the web app's Job alerts). */
export const JobAlertsModal = ({ visible, onClose, prefill }: Props) => {
  const { themeColors: T } = useUserSettings();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ keywords: '', job_type: '', work_mode: '', location: '', min_salary: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await db().auth.getUser();
    if (user) {
      const { data } = await db().from('job_alerts').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      setAlerts(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!visible) return;
    load();
    setForm({
      keywords: prefill?.keywords || '',
      job_type: prefill?.job_type || '',
      work_mode: prefill?.work_mode || '',
      location: prefill?.location || '',
      min_salary: prefill?.min_salary ? String(prefill.min_salary) : '',
    });
  }, [visible]);

  const create = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await db().auth.getUser();
      if (!user) throw new Error('Please sign in.');
      const { error } = await db().from('job_alerts').insert({
        user_id: user.id,
        keywords: form.keywords.trim() || null,
        job_type: form.job_type || null,
        work_mode: form.work_mode || null,
        location: form.location.trim() || null,
        min_salary: form.min_salary ? Number(form.min_salary) : null,
      });
      if (error) throw error;
      Alert.alert('Alert saved', "We'll notify you when a matching job is posted.");
      load();
    } catch (e: any) {
      Alert.alert('Could not save the alert', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (a: any) => {
    setAlerts((p) => p.map((x) => (x.id === a.id ? { ...x, is_active: !x.is_active } : x)));
    const { error } = await db().from('job_alerts').update({ is_active: !a.is_active }).eq('id', a.id);
    if (error) load();
  };

  const remove = async (a: any) => {
    setAlerts((p) => p.filter((x) => x.id !== a.id));
    const { error } = await db().from('job_alerts').delete().eq('id', a.id);
    if (error) load();
  };

  const field = [styles.input, { backgroundColor: T.inputBg, borderColor: T.border, color: T.textPrimary }];
  const chip = (on: boolean) => [styles.chip, { backgroundColor: on ? ORANGE : T.inputBg, borderColor: on ? ORANGE : T.border }];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: T.bgScreen, borderColor: T.border }]}>
          <View style={styles.headRow}>
            <Text style={{ color: T.textPrimary, fontSize: 18, fontWeight: '800' }}>Job alerts</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="x" size={20} color={T.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 36 }} keyboardShouldPersistTaps="handled">
            <Text style={{ color: T.textSecondary, fontSize: 12.5, marginBottom: 12 }}>
              Get notified the moment a job that fits you is posted. You can keep up to 10 alerts.
            </Text>
            {loading ? (
              <ActivityIndicator color={ORANGE} style={{ marginVertical: 12 }} />
            ) : alerts.length === 0 ? (
              <Text style={{ color: T.textMuted, fontSize: 13 }}>You have no alerts yet.</Text>
            ) : (
              alerts.map((a) => (
                <View key={a.id} style={[styles.alertRow, { borderColor: T.border, backgroundColor: T.bgCard }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: T.textPrimary, fontSize: 13, fontWeight: '700' }} numberOfLines={2}>{describeAlert(a)}</Text>
                    <Text style={{ color: T.textMuted, fontSize: 11 }}>{a.is_active ? 'Active' : 'Paused'}</Text>
                  </View>
                  <Switch value={!!a.is_active} onValueChange={() => toggle(a)} trackColor={{ false: '#767577', true: ORANGE }} thumbColor="#FFFFFF" />
                  <TouchableOpacity onPress={() => remove(a)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Icon name="trash-2" size={17} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))
            )}

            <View style={[styles.newBox, { borderColor: T.border }]}>
              <Text style={{ color: T.textMuted, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 }}>NEW ALERT</Text>
              <TextInput style={field} placeholder="Keywords, e.g. focus puller" placeholderTextColor={T.textMuted} value={form.keywords} onChangeText={(v) => setForm({ ...form, keywords: v })} />
              <View style={styles.chipRow}>
                {JOB_TYPES.map((t) => (
                  <TouchableOpacity key={t} style={chip(form.job_type === t)} onPress={() => setForm({ ...form, job_type: form.job_type === t ? '' : t })}>
                    <Text style={{ color: form.job_type === t ? '#fff' : T.textPrimary, fontSize: 11.5, fontWeight: '700' }}>{JOB_TYPE_LABELS[t]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.chipRow}>
                {WORK_MODES.map((m) => (
                  <TouchableOpacity key={m} style={chip(form.work_mode === m)} onPress={() => setForm({ ...form, work_mode: form.work_mode === m ? '' : m })}>
                    <Text style={{ color: form.work_mode === m ? '#fff' : T.textPrimary, fontSize: 11.5, fontWeight: '700' }}>{WORK_MODE_LABELS[m]}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput style={field} placeholder="City" placeholderTextColor={T.textMuted} value={form.location} onChangeText={(v) => setForm({ ...form, location: v })} />
              <TextInput style={field} placeholder="Minimum pay (optional)" placeholderTextColor={T.textMuted} keyboardType="numeric" value={form.min_salary} onChangeText={(v) => setForm({ ...form, min_salary: v.replace(/\D/g, '') })} />
              <TouchableOpacity style={[styles.saveBtn, (saving || alerts.length >= 10) && { opacity: 0.5 }]} disabled={saving || alerts.length >= 10} onPress={create}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save alert</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { maxHeight: '88%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0 },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8 },
  newBox: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 16, padding: 12, marginTop: 14 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 42, fontSize: 13, marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  saveBtn: { backgroundColor: ORANGE, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13.5 },
});
