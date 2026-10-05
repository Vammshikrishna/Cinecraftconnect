import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, ActivityIndicator, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Icon } from '../common/Icon';
import { CachedImage } from '../common/CachedImage';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';

const ORANGE = '#FF4B33';
const db = () => getSupabaseClient() as any;

export const Sheet = ({ visible, onClose, title, subtitle, children }: { visible: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode }) => {
  const { themeColors: T } = useUserSettings();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.backdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[s.sheet, { backgroundColor: T.bgCard }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: T.textPrimary, fontSize: 17, fontWeight: '900', flex: 1 }} numberOfLines={2}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name="x" size={20} color={T.textSecondary} />
            </TouchableOpacity>
          </View>
          {!!subtitle && <Text style={{ color: T.textSecondary, fontSize: 13, marginTop: 4 }}>{subtitle}</Text>}
          <ScrollView style={{ maxHeight: 460, marginTop: 12 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export const useInput = () => {
  const { themeColors: T } = useUserSettings();
  return { backgroundColor: T.inputBg, borderColor: T.border, color: T.textPrimary };
};

/** Crew availability: status, rate range, cities and who can see it. */
export const AvailabilityModal = ({ visible, onClose, userId }: { visible: boolean; onClose: () => void; userId: string | null }) => {
  const { themeColors: T } = useUserSettings();
  const input = useInput();
  const [status, setStatus] = useState<'open' | 'booked' | 'not_looking'>('not_looking');
  const [bookedUntil, setBookedUntil] = useState('');
  const [rateMin, setRateMin] = useState('');
  const [rateMax, setRateMax] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [cities, setCities] = useState('');
  const [note, setNote] = useState('');
  const [visibility, setVisibility] = useState<'everyone' | 'connections'>('everyone');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !userId) return;
    db().from('profile_availability').select('*').eq('user_id', userId).maybeSingle().then(({ data }: any) => {
      if (!data) return;
      setStatus(data.status);
      setBookedUntil(data.booked_until || '');
      setRateMin(data.rate_min != null ? String(data.rate_min) : '');
      setRateMax(data.rate_max != null ? String(data.rate_max) : '');
      setCurrency(data.rate_currency || 'INR');
      setCities((data.cities || []).join(', '));
      setNote(data.note || '');
      setVisibility(data.visibility || 'everyone');
    });
  }, [visible, userId]);

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    const { error } = await db().from('profile_availability').upsert({
      user_id: userId,
      status,
      booked_until: status === 'booked' && /^\d{4}-\d{2}-\d{2}$/.test(bookedUntil) ? bookedUntil : null,
      rate_min: rateMin ? parseInt(rateMin, 10) : null,
      rate_max: rateMax ? parseInt(rateMax, 10) : null,
      rate_currency: currency || 'INR',
      cities: cities.split(',').map((c) => c.trim()).filter(Boolean),
      note: note.trim() || null,
      visibility,
    }, { onConflict: 'user_id' });
    setSaving(false);
    if (error) return Alert.alert('Could not save', error.message);
    onClose();
  };

  const Chip = ({ label, sub, active, onPress }: { label: string; sub?: string; active: boolean; onPress: () => void }) => (
    <TouchableOpacity onPress={onPress} style={[s.option, { borderColor: active ? ORANGE : T.border, backgroundColor: active ? 'rgba(255,75,51,0.1)' : 'transparent' }]}>
      <Text style={{ color: T.textPrimary, fontWeight: '800', fontSize: 14 }}>{label}</Text>
      {!!sub && <Text style={{ color: T.textSecondary, fontSize: 12 }}>{sub}</Text>}
    </TouchableOpacity>
  );

  return (
    <Sheet visible={visible} onClose={onClose} title="Your availability" subtitle="Let producers and crew know when you can take work.">
      <Chip label="Open to work" sub='Show an "Open to work" badge' active={status === 'open'} onPress={() => setStatus('open')} />
      <Chip label="Booked" sub="Working now; show until a date" active={status === 'booked'} onPress={() => setStatus('booked')} />
      <Chip label="Not looking" sub="No badge" active={status === 'not_looking'} onPress={() => setStatus('not_looking')} />

      {status === 'booked' && (
        <TextInput style={[s.input, input]} placeholder="Booked until (YYYY-MM-DD)" placeholderTextColor={T.textMuted} value={bookedUntil} onChangeText={setBookedUntil} maxLength={10} />
      )}
      <Text style={[s.label, { color: T.textMuted }]}>RATE PER DAY (OPTIONAL)</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput style={[s.input, input, { width: 64 }]} value={currency} onChangeText={(v) => setCurrency(v.toUpperCase())} maxLength={3} autoCapitalize="characters" />
        <TextInput style={[s.input, input, { flex: 1 }]} placeholder="Min" placeholderTextColor={T.textMuted} value={rateMin} onChangeText={setRateMin} keyboardType="number-pad" />
        <TextInput style={[s.input, input, { flex: 1 }]} placeholder="Max" placeholderTextColor={T.textMuted} value={rateMax} onChangeText={setRateMax} keyboardType="number-pad" />
      </View>
      <Text style={[s.label, { color: T.textMuted }]}>CITIES YOU CAN WORK IN</Text>
      <TextInput style={[s.input, input]} placeholder="Hyderabad, Mumbai, Chennai" placeholderTextColor={T.textMuted} value={cities} onChangeText={setCities} />
      <Text style={[s.label, { color: T.textMuted }]}>NOTE (OPTIONAL)</Text>
      <TextInput style={[s.input, input, { minHeight: 64, textAlignVertical: 'top' }]} placeholder="Own ARRI Alexa Mini, available for shorts and ads" placeholderTextColor={T.textMuted} value={note} onChangeText={setNote} maxLength={200} multiline />
      <Text style={[s.label, { color: T.textMuted }]}>WHO CAN SEE THIS</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label="Everyone" active={visibility === 'everyone'} onPress={() => setVisibility('everyone')} />
        <Chip label="Connections only" active={visibility === 'connections'} onPress={() => setVisibility('connections')} />
      </View>
      <TouchableOpacity style={[s.primary, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Save</Text>}
      </TouchableOpacity>
    </Sheet>
  );
};

/** Private note and tags for one connection: only you can see them. */
export const ConnectionNotesModal = ({ visible, onClose, userId, otherId, name, note: initialNote, tags: initialTags, onSaved }: {
  visible: boolean; onClose: () => void; userId: string | null; otherId: string; name: string; note?: string | null; tags?: string[]; onSaved: () => void;
}) => {
  const { themeColors: T } = useUserSettings();
  const input = useInput();
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setNote(initialNote || '');
      setTags(initialTags || []);
      setDraft('');
    }
  }, [visible, initialNote, initialTags]);

  const addTag = (t: string) => {
    const v = t.trim().toLowerCase().slice(0, 24);
    if (v && !tags.includes(v) && tags.length < 10) setTags([...tags, v]);
    setDraft('');
  };

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    const empty = !note.trim() && tags.length === 0;
    const { error } = empty
      ? await db().from('connection_notes').delete().eq('owner_id', userId).eq('other_id', otherId)
      : await db().from('connection_notes').upsert({ owner_id: userId, other_id: otherId, note: note.trim() || null, tags }, { onConflict: 'owner_id,other_id' });
    setSaving(false);
    if (error) return Alert.alert('Could not save', error.message);
    onSaved();
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={`Notes on ${name}`} subtitle="Private to you. Remember where you met and what they are great at.">
      <TextInput style={[s.input, input, { minHeight: 90, textAlignVertical: 'top' }]} placeholder="DOP on Short X, great with low light, based in Hyderabad" placeholderTextColor={T.textMuted} value={note} onChangeText={setNote} maxLength={500} multiline />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {tags.map((t) => (
          <TouchableOpacity key={t} onPress={() => setTags(tags.filter((x) => x !== t))} style={[s.tag, { backgroundColor: 'rgba(255,75,51,0.12)' }]}>
            <Text style={{ color: ORANGE, fontWeight: '800', fontSize: 12 }}>#{t}  ✕</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput style={[s.input, input]} placeholder="Add a tag and press return" placeholderTextColor={T.textMuted} value={draft} onChangeText={setDraft} onSubmitEditing={() => addTag(draft)} maxLength={24} autoCapitalize="none" />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
        {['dop', 'editor', 'sound', 'vfx', 'hired', 'trusted'].filter((t) => !tags.includes(t)).map((t) => (
          <TouchableOpacity key={t} onPress={() => addTag(t)} style={[s.tag, { borderWidth: 1, borderColor: T.border }]}>
            <Text style={{ color: T.textSecondary, fontSize: 12 }}>+ {t}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={[s.primary, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Save</Text>}
      </TouchableOpacity>
    </Sheet>
  );
};

/** Ask a mutual connection to introduce you. The introduced person still decides whether to accept. */
export const IntroductionModal = ({ visible, onClose, targetId, targetName }: { visible: boolean; onClose: () => void; targetId: string; targetName: string }) => {
  const { themeColors: T } = useUserSettings();
  const input = useInput();
  const [options, setOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [via, setVia] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setVia(null);
    setNote('');
    db().rpc('introduction_options', { p_target: targetId }).then(({ data }: any) => {
      setOptions(data || []);
      setLoading(false);
    });
  }, [visible, targetId]);

  const send = async () => {
    if (!via) return;
    setSending(true);
    const { error } = await db().rpc('request_introduction', { p_target: targetId, p_via: via, p_note: note.trim() || null });
    setSending(false);
    if (error) return Alert.alert('Could not ask for the introduction', error.message);
    Alert.alert('Introduction requested', 'They will be notified.');
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={`Ask for an introduction to ${targetName}`} subtitle="Pick a mutual connection who can introduce you.">
      {loading ? (
        <ActivityIndicator color={ORANGE} style={{ marginVertical: 20 }} />
      ) : options.length === 0 ? (
        <Text style={{ color: T.textMuted, textAlign: 'center', paddingVertical: 16 }}>You have no mutual connections with {targetName}, so there is nobody to introduce you.</Text>
      ) : (
        <>
          {options.map((o) => (
            <TouchableOpacity key={o.id} onPress={() => setVia(o.id)} style={[s.option, { flexDirection: 'row', alignItems: 'center', gap: 10, borderColor: via === o.id ? ORANGE : T.border, backgroundColor: via === o.id ? 'rgba(255,75,51,0.1)' : 'transparent' }]}>
              {o.avatar_url ? (
                <CachedImage uri={o.avatar_url} style={{ width: 34, height: 34, borderRadius: 17 }} />
              ) : (
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: T.chipBg, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: ORANGE, fontWeight: '900' }}>{(o.full_name || o.username || '?').charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ color: T.textPrimary, fontWeight: '800' }} numberOfLines={1}>{o.full_name || o.username}</Text>
                <Text style={{ color: T.textSecondary, fontSize: 12 }} numberOfLines={1}>{o.craft || 'Filmmaker'}</Text>
              </View>
            </TouchableOpacity>
          ))}
          <TextInput style={[s.input, input, { minHeight: 70, textAlignVertical: 'top' }]} placeholder="Tell them why you would like to meet (optional)" placeholderTextColor={T.textMuted} value={note} onChangeText={setNote} maxLength={300} multiline />
          <TouchableOpacity style={[s.primary, (!via || sending) && { opacity: 0.5 }]} onPress={send} disabled={!via || sending}>
            {sending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Ask for introduction</Text>}
          </TouchableOpacity>
        </>
      )}
    </Sheet>
  );
};

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, paddingBottom: 28 },
  option: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8, flex: undefined },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 8 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginTop: 14 },
  primary: { height: 46, borderRadius: 12, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  tag: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
});
