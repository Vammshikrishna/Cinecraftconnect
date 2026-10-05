import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Icon } from '../common/Icon';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';
import { pickAttachments, type PickedAttachment } from '../../services/attachmentPicker';
import { uploadVendorDoc, RESUME_MAX_BYTES } from '../../services/resumeFiles';

const ORANGE = '#FF4B33';
const db = () => getSupabaseClient() as any;
const pad = (n: number) => String(n).padStart(2, '0');
const isoDay = (offset = 0) => {
  const d = new Date(Date.now() + offset * 86_400_000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const EQUIPMENT_CATEGORIES = ['Camera', 'Lenses', 'Lighting', 'Audio', 'Grip', 'Stabilization', 'Monitors', 'Drones', 'Accessories', 'Other Equipment'];
const LOCATION_CATEGORIES = ['Studio', 'Outdoor Location', 'Residential', 'Commercial', 'Industrial', 'Historical', 'Modern', 'Warehouse', 'Office', 'Other Location'];
const VENDOR_CATEGORIES = ['Post-Production', 'Sound Design', 'Color Grading', 'VFX & Animation', 'Catering', 'Equipment Rental', 'Grip Truck Rental', 'Transportation', 'Casting', 'Location Scouting', 'Legal Services', 'Insurance', 'Accounting', 'Marketing & Distribution', 'Other Services'];

/** Shared bottom-sheet shell used by the three modals below. */
const Sheet = ({ visible, onClose, title, subtitle, children }: { visible: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode }) => {
  const { themeColors: T } = useUserSettings();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[s.sheet, { backgroundColor: T.bgCard, borderColor: T.border }]}>
            <View style={s.head}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: T.textPrimary, fontSize: 18, fontWeight: '800' }}>{title}</Text>
                {subtitle ? <Text style={{ color: T.textSecondary, fontSize: 12 }} numberOfLines={1}>{subtitle}</Text> : null}
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Icon name="x" size={20} color={T.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 30 }}>{children}</ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const useFieldStyle = () => {
  const { themeColors: T } = useUserSettings();
  return [s.input, { backgroundColor: T.inputBg, borderColor: T.border, color: T.textPrimary }];
};

// ── Quote request ─────────────────────────────────────────────────────────────────────────────────────────────────
export const QuoteRequestModal = ({
  visible, onClose, vendorId, vendorName, serviceId, serviceTitle, onRequested,
}: { visible: boolean; onClose: () => void; vendorId: string; vendorName: string; serviceId?: string | null; serviceTitle?: string | null; onRequested: () => void }) => {
  const { themeColors: T } = useUserSettings();
  const field = useFieldStyle();
  const [f, setF] = useState({ start: isoDay(), end: isoDay(), location: '', brief: '', crew: '', budget: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) setF({ start: isoDay(), end: isoDay(), location: '', brief: '', crew: '', budget: '' });
  }, [visible]);

  const submit = async () => {
    if (!DATE_RE.test(f.start) || !DATE_RE.test(f.end) || f.end < f.start) return Alert.alert('Check your dates', 'Use the format 2026-11-05. The end date cannot be before the start date.');
    if (f.brief.trim().length < 10) return Alert.alert('Tell the vendor what you need', 'At least 10 characters.');
    setBusy(true);
    try {
      const { data, error } = await db().rpc('request_vendor_quote', {
        p_vendor_id: vendorId,
        p_service_id: serviceId || null,
        p_start: f.start,
        p_end: f.end,
        p_location: f.location.trim() || null,
        p_brief: f.brief.trim(),
        p_crew: f.crew ? Number(f.crew) : null,
        p_budget: f.budget ? Number(f.budget) : null,
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.message);
      onClose();
      Alert.alert('Request sent', `${vendorName} will reply with a quote. You'll be notified.`, [{ text: 'OK', onPress: onRequested }]);
    } catch (e: any) {
      Alert.alert('Could not send the request', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const L = ({ t }: { t: string }) => <Text style={[s.label, { color: T.textMuted }]}>{t}</Text>;
  return (
    <Sheet visible={visible} onClose={onClose} title="Request a quote" subtitle={`${vendorName}${serviceTitle ? ` · ${serviceTitle}` : ''}`}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><L t="FROM (YYYY-MM-DD)" /><TextInput style={field} value={f.start} onChangeText={(v) => setF({ ...f, start: v, end: v > f.end ? v : f.end })} autoCapitalize="none" keyboardType="numbers-and-punctuation" /></View>
        <View style={{ flex: 1 }}><L t="TO" /><TextInput style={field} value={f.end} onChangeText={(v) => setF({ ...f, end: v })} autoCapitalize="none" keyboardType="numbers-and-punctuation" /></View>
      </View>
      <L t="LOCATION" />
      <TextInput style={field} value={f.location} onChangeText={(v) => setF({ ...f, location: v })} placeholder="Where is the shoot?" placeholderTextColor={T.textMuted} maxLength={200} />
      <L t="WHAT DO YOU NEED? *" />
      <TextInput style={[...field, { height: 100, paddingTop: 10, textAlignVertical: 'top' }]} multiline maxLength={1500} value={f.brief} onChangeText={(v) => setF({ ...f, brief: v })} placeholder="Type of production, what you need from them, special requirements…" placeholderTextColor={T.textMuted} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><L t="CREW SIZE" /><TextInput style={field} keyboardType="number-pad" value={f.crew} onChangeText={(v) => setF({ ...f, crew: v.replace(/\D/g, '') })} /></View>
        <View style={{ flex: 1 }}><L t="BUDGET ₹" /><TextInput style={field} keyboardType="numeric" value={f.budget} onChangeText={(v) => setF({ ...f, budget: v.replace(/[^\d.]/g, '') })} /></View>
      </View>
      <TouchableOpacity style={[s.submit, busy && { opacity: 0.6 }]} disabled={busy} onPress={submit}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Send request</Text>}
      </TouchableOpacity>
    </Sheet>
  );
};

// ── Vendor verification ───────────────────────────────────────────────────────────────────────────────────────────
export const VendorVerificationModal = ({
  visible, onClose, vendorId, vendorName, onSubmitted,
}: { visible: boolean; onClose: () => void; vendorId: string; vendorName: string; onSubmitted: () => void }) => {
  const { themeColors: T } = useUserSettings();
  const field = useFieldStyle();
  const [file, setFile] = useState<PickedAttachment | null>(null);
  const [registration, setRegistration] = useState('');
  const [website, setWebsite] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setFile(null);
      setRegistration('');
      setWebsite('');
      setNotes('');
    }
  }, [visible]);

  const pick = async () => {
    try {
      const [f] = await pickAttachments({ multiple: false });
      if (!f) return;
      if (f.size && f.size > RESUME_MAX_BYTES) return Alert.alert('File too large', 'Please attach a file up to 10 MB.');
      setFile(f);
    } catch (e: any) {
      Alert.alert('Could not attach the file', e?.message || 'Please try again.');
    }
  };

  const submit = async () => {
    if (!file) return Alert.alert('Attach a document', 'A registration certificate, licence or tax document.');
    setBusy(true);
    try {
      const ref = await uploadVendorDoc(file);
      const { data, error } = await db().rpc('submit_vendor_verification', {
        p_vendor_id: vendorId,
        p_document_ref: ref,
        p_registration: registration.trim() || null,
        p_website: website.trim() || null,
        p_notes: notes.trim() || null,
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.message);
      onClose();
      Alert.alert('Sent for review', "We'll notify you when your business is reviewed.", [{ text: 'OK', onPress: onSubmitted }]);
    } catch (e: any) {
      Alert.alert('Could not submit', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const L = ({ t }: { t: string }) => <Text style={[s.label, { color: T.textMuted }]}>{t}</Text>;
  return (
    <Sheet visible={visible} onClose={onClose} title="Get verified" subtitle={`${vendorName} · your document is private`}>
      <TouchableOpacity onPress={pick} style={[s.drop, { borderColor: T.border, backgroundColor: T.inputBg }]}>
        <Icon name={file ? 'file-text' : 'upload'} size={18} color={ORANGE} />
        <Text style={{ color: file ? T.textPrimary : T.textSecondary, fontSize: 13, fontWeight: '600', flex: 1 }} numberOfLines={1}>{file ? file.name : 'Attach a business document (PDF or photo, up to 10 MB)'}</Text>
      </TouchableOpacity>
      <L t="REGISTRATION / GST NUMBER (OPTIONAL)" />
      <TextInput style={field} value={registration} onChangeText={setRegistration} maxLength={80} />
      <L t="WEBSITE (OPTIONAL)" />
      <TextInput style={field} value={website} onChangeText={setWebsite} maxLength={200} autoCapitalize="none" placeholder="https://" placeholderTextColor={T.textMuted} />
      <L t="ANYTHING WE SHOULD KNOW? (OPTIONAL)" />
      <TextInput style={[...field, { height: 70, paddingTop: 10, textAlignVertical: 'top' }]} multiline maxLength={1000} value={notes} onChangeText={setNotes} />
      <TouchableOpacity style={[s.submit, (busy || !file) && { opacity: 0.5 }]} disabled={busy || !file} onPress={submit}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Submit for review</Text>}
      </TouchableOpacity>
    </Sheet>
  );
};

// ── Gear alerts ───────────────────────────────────────────────────────────────────────────────────────────────────
export const GearAlertsModal = ({ visible, onClose }: { visible: boolean; onClose: () => void }) => {
  const { themeColors: T } = useUserSettings();
  const field = useFieldStyle();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({ kind: 'gear' as 'gear' | 'service', keyword: '', category: '', max_price: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await db().auth.getUser();
    if (user) {
      const { data } = await db().from('gear_alerts').select('id, kind, category, keyword, max_price').eq('user_id', user.id).order('created_at', { ascending: false });
      setAlerts(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (visible) {
      load();
      setF((p) => ({ ...p, keyword: '', category: '', max_price: '' }));
    }
  }, [visible]);

  const create = async () => {
    if (!f.keyword.trim() && !f.category && !f.max_price) return Alert.alert('Add something to match', 'Enter a keyword, a category or a maximum price.');
    setSaving(true);
    try {
      const { data: { user } } = await db().auth.getUser();
      if (!user) throw new Error('Please sign in.');
      const { error } = await db().from('gear_alerts').insert({
        user_id: user.id,
        kind: f.kind,
        keyword: f.keyword.trim() || null,
        category: f.category || null,
        max_price: f.max_price ? Number(f.max_price) : null,
      });
      if (error) throw error;
      setF((p) => ({ ...p, keyword: '', category: '', max_price: '' }));
      load();
    } catch (e: any) {
      Alert.alert('Could not save the alert', e?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a: any) => {
    setAlerts((p) => p.filter((x) => x.id !== a.id));
    const { error } = await db().from('gear_alerts').delete().eq('id', a.id);
    if (error) load();
  };

  const describe = (a: any) => [a.kind === 'service' ? 'Vendor service' : 'Gear', a.keyword ? `“${a.keyword}”` : null, a.category, a.max_price ? `up to ₹${a.max_price}/day` : null].filter(Boolean).join(' · ');
  const L = ({ t }: { t: string }) => <Text style={[s.label, { color: T.textMuted }]}>{t}</Text>;

  return (
    <Sheet visible={visible} onClose={onClose} title="Alerts" subtitle="Get notified when matching gear, a location or a service is listed (up to 10)">
      {loading ? (
        <ActivityIndicator color={ORANGE} style={{ marginVertical: 12 }} />
      ) : alerts.length === 0 ? (
        <Text style={{ color: T.textMuted, fontSize: 13, marginBottom: 8 }}>You have no alerts yet.</Text>
      ) : (
        alerts.map((a) => (
          <View key={a.id} style={[s.alertRow, { borderColor: T.border }]}>
            <Text style={{ color: T.textPrimary, fontSize: 13, fontWeight: '700', flex: 1 }} numberOfLines={2}>{describe(a)}</Text>
            <TouchableOpacity onPress={() => remove(a)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="trash-2" size={17} color="#EF4444" />
            </TouchableOpacity>
          </View>
        ))
      )}

      <View style={[s.newBox, { borderColor: T.border }]}>
        <L t="NEW ALERT" />
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
          {(['gear', 'service'] as const).map((k) => (
            <TouchableOpacity key={k} onPress={() => setF({ ...f, kind: k, category: '' })} style={[s.chip, { flex: 1, alignItems: 'center', paddingVertical: 8, backgroundColor: f.kind === k ? ORANGE : T.inputBg, borderColor: f.kind === k ? ORANGE : T.border }]}>
              <Text style={{ color: f.kind === k ? '#fff' : T.textPrimary, fontSize: 12, fontWeight: '800' }}>{k === 'gear' ? 'Gear & locations' : 'Vendor services'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput style={field} value={f.keyword} onChangeText={(v) => setF({ ...f, keyword: v })} placeholder="Keyword, e.g. ARRI, gimbal" placeholderTextColor={T.textMuted} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {(f.kind === 'service' ? VENDOR_CATEGORIES : [...EQUIPMENT_CATEGORIES, ...LOCATION_CATEGORIES]).map((c) => (
              <TouchableOpacity key={c} onPress={() => setF({ ...f, category: f.category === c ? '' : c })} style={[s.chip, { backgroundColor: f.category === c ? ORANGE : T.inputBg, borderColor: f.category === c ? ORANGE : T.border }]}>
                <Text style={{ color: f.category === c ? '#fff' : T.textPrimary, fontSize: 11.5, fontWeight: '700' }}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
        <TextInput style={field} keyboardType="numeric" value={f.max_price} onChangeText={(v) => setF({ ...f, max_price: v.replace(/[^\d.]/g, '') })} placeholder={f.kind === 'service' ? 'Max day rate ₹ (optional)' : 'Max price per day ₹ (optional)'} placeholderTextColor={T.textMuted} />
        <TouchableOpacity style={[s.submit, { marginBottom: 0 }, (saving || alerts.length >= 10) && { opacity: 0.5 }]} disabled={saving || alerts.length >= 10} onPress={create}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Save alert</Text>}
        </TouchableOpacity>
      </View>
    </Sheet>
  );
};

const s = StyleSheet.create({
  sheet: { maxHeight: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0 },
  head: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 8, gap: 10 },
  label: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.7, marginBottom: 6, marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 44, fontSize: 14, marginBottom: 10 },
  submit: { backgroundColor: ORANGE, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 14.5 },
  drop: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, padding: 14, marginBottom: 12 },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8 },
  newBox: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 16, padding: 12, marginTop: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
});
