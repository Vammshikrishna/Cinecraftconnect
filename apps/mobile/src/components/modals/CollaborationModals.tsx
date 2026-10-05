import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Icon } from '../common/Icon';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';
import { Sheet, useInput } from './NetworkModals';

const ORANGE = '#FF4B33';
const db = () => getSupabaseClient() as any;
const todayIso = () => new Date().toISOString().slice(0, 10);
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

interface Base { visible: boolean; onClose: () => void; targetId: string; targetName: string }

const Primary = ({ label, onPress, disabled, busy }: { label: string; onPress: () => void; disabled?: boolean; busy?: boolean }) => (
  <TouchableOpacity style={[s.primary, (disabled || busy) && { opacity: 0.5 }]} onPress={onPress} disabled={disabled || busy}>
    {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>{label}</Text>}
  </TouchableOpacity>
);

/** Ask someone to hold their dates for a role. They accept, decline or counter; accepted dates become Tentative in their calendar. */
export const RequestDatesModal = ({ visible, onClose, targetId, targetName }: Base) => {
  const { themeColors: T } = useUserSettings();
  const input = useInput();
  const [start, setStart] = useState(todayIso());
  const [end, setEnd] = useState(todayIso());
  const [role, setRole] = useState('');
  const [rate, setRate] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [project, setProject] = useState('');
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (visible) { setStart(todayIso()); setEnd(todayIso()); setRole(''); setRate(''); setProject(''); setNote(''); }
  }, [visible]);

  const send = async () => {
    if (!isDate(start) || !isDate(end)) return Alert.alert('Dates', 'Enter dates as YYYY-MM-DD.');
    setSending(true);
    const { error } = await db().rpc('request_date_hold', {
      p_target: targetId, p_start: start, p_end: end, p_role: role.trim(), p_rate: rate ? parseInt(rate, 10) : null,
      p_currency: currency || 'INR', p_note: note.trim() || null, p_project_title: project.trim() || null,
    });
    setSending(false);
    if (error) return Alert.alert('Could not send the request', error.message);
    Alert.alert('Request sent', `${targetName} will be notified.`);
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={`Hold ${targetName}'s dates`} subtitle="They can accept, decline or send a counter offer.">
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput style={[s.input, input, { flex: 1 }]} placeholder="From (YYYY-MM-DD)" placeholderTextColor={T.textMuted} value={start} onChangeText={setStart} maxLength={10} />
        <TextInput style={[s.input, input, { flex: 1 }]} placeholder="To (YYYY-MM-DD)" placeholderTextColor={T.textMuted} value={end} onChangeText={setEnd} maxLength={10} />
      </View>
      <TextInput style={[s.input, input]} placeholder="Role you need, e.g. Editor" placeholderTextColor={T.textMuted} value={role} onChangeText={setRole} maxLength={80} />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput style={[s.input, input, { width: 64 }]} value={currency} onChangeText={(v) => setCurrency(v.toUpperCase())} maxLength={3} autoCapitalize="characters" />
        <TextInput style={[s.input, input, { flex: 1 }]} placeholder="Rate per day (optional)" placeholderTextColor={T.textMuted} value={rate} onChangeText={setRate} keyboardType="number-pad" />
      </View>
      <TextInput style={[s.input, input]} placeholder="Project (optional)" placeholderTextColor={T.textMuted} value={project} onChangeText={setProject} maxLength={120} />
      <TextInput style={[s.input, input, { minHeight: 70, textAlignVertical: 'top' }]} placeholder="Note (optional)" placeholderTextColor={T.textMuted} value={note} onChangeText={setNote} maxLength={500} multiline />
      <Primary label="Send request" onPress={send} disabled={!role.trim()} busy={sending} />
    </Sheet>
  );
};

/** A personal invitation to one of my project spaces. */
export const InviteToProjectModal = ({ visible, onClose, targetId, targetName }: Base) => {
  const { themeColors: T } = useUserSettings();
  const input = useInput();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [space, setSpace] = useState<string | null>(null);
  const [role, setRole] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true); setSpace(null); setRole(''); setMessage('');
    db().rpc('my_invitable_projects').then(({ data }: any) => { setProjects(data || []); setLoading(false); });
  }, [visible]);

  const send = async () => {
    if (!space) return;
    setSending(true);
    const { error } = await db().rpc('invite_to_project', { p_space: space, p_invitee: targetId, p_crew_role: role.trim() || null, p_message: message.trim() || null });
    setSending(false);
    if (error) return Alert.alert('Could not send the invitation', error.message);
    Alert.alert('Invitation sent', `${targetName} will be notified.`);
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={`Invite ${targetName} to a project`} subtitle="They join the project space once they accept.">
      {loading ? <ActivityIndicator color={ORANGE} style={{ marginVertical: 20 }} /> : projects.length === 0 ? (
        <Text style={{ color: T.textMuted, textAlign: 'center', paddingVertical: 16 }}>You do not manage any project space yet. Create one first, then invite people.</Text>
      ) : (
        <>
          {projects.map((p) => (
            <TouchableOpacity key={p.id} onPress={() => setSpace(p.id)} style={[s.option, { borderColor: space === p.id ? ORANGE : T.border, backgroundColor: space === p.id ? 'rgba(255,75,51,0.1)' : 'transparent' }]}>
              <Text style={{ color: T.textPrimary, fontWeight: '800', flex: 1 }} numberOfLines={1}>{p.name}</Text>
              {space === p.id && <Icon name="check" size={16} color={ORANGE} />}
            </TouchableOpacity>
          ))}
          <TextInput style={[s.input, input]} placeholder="Role, e.g. Editor (optional)" placeholderTextColor={T.textMuted} value={role} onChangeText={setRole} maxLength={80} />
          <TextInput style={[s.input, input, { minHeight: 70, textAlignVertical: 'top' }]} placeholder="Message (optional)" placeholderTextColor={T.textMuted} value={message} onChangeText={setMessage} maxLength={300} multiline />
          <Primary label="Send invitation" onPress={send} disabled={!space} busy={sending} />
        </>
      )}
    </Sheet>
  );
};

const RELATIONS: [string, string][] = [['worked_with', 'We worked together'], ['managed', 'I managed them'], ['hired', 'I hired them'], ['mentored', 'I mentored them']];

/** A few honest lines about working with someone. They approve it before it shows on their profile. */
export const RecommendModal = ({ visible, onClose, targetId, targetName, onDone }: Base & { onDone?: () => void }) => {
  const { themeColors: T } = useUserSettings();
  const input = useInput();
  const [relationship, setRelationship] = useState('worked_with');
  const [project, setProject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (visible) { setRelationship('worked_with'); setProject(''); setBody(''); }
  }, [visible]);

  const send = async () => {
    setSending(true);
    const { error } = await db().rpc('write_recommendation', { p_subject: targetId, p_relationship: relationship, p_body: body.trim(), p_project_title: project.trim() || null });
    setSending(false);
    if (error) return Alert.alert('Could not send the recommendation', error.message);
    Alert.alert('Recommendation sent', `${targetName} will approve it before it shows on their profile.`);
    onClose();
    onDone?.();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={`Recommend ${targetName}`} subtitle={`Only connections can recommend. ${targetName} approves it first.`}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        {RELATIONS.map(([k, l]) => (
          <TouchableOpacity key={k} onPress={() => setRelationship(k)} style={[s.chip, { borderWidth: 1, borderColor: relationship === k ? ORANGE : T.border, backgroundColor: relationship === k ? ORANGE : 'transparent' }]}>
            <Text style={{ color: relationship === k ? '#fff' : T.textSecondary, fontSize: 12, fontWeight: '800' }}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput style={[s.input, input]} placeholder="Project (optional)" placeholderTextColor={T.textMuted} value={project} onChangeText={setProject} maxLength={120} />
      <TextInput style={[s.input, input, { minHeight: 110, textAlignVertical: 'top' }]} placeholder="What was it like working with them? (20 to 600 characters)" placeholderTextColor={T.textMuted} value={body} onChangeText={setBody} maxLength={600} multiline />
      <Text style={{ color: T.textMuted, fontSize: 11, alignSelf: 'flex-end', marginTop: 4 }}>{body.length}/600</Text>
      <Primary label="Send" onPress={send} disabled={body.trim().length < 20} busy={sending} />
    </Sheet>
  );
};

/** Save someone into one of my private crew shortlists, with a note. */
export const AddToShortlistModal = ({ visible, onClose, targetId, targetName }: Base) => {
  const { themeColors: T } = useUserSettings();
  const input = useInput();
  const [lists, setLists] = useState<any[]>([]);
  const [member, setMember] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [note, setNote] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await db().rpc('my_shortlists');
    const ls = (data || []) as any[];
    setLists(ls);
    const map: Record<string, boolean> = {};
    ls.forEach((l) => { if ((l.members || []).some((m: any) => m.id === targetId)) map[l.id] = true; });
    setMember(map);
    setLoading(false);
  };
  useEffect(() => {
    if (visible) { setNote(''); setName(''); load(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const toggle = async (listId: string) => {
    const on = !member[listId];
    setMember((m) => ({ ...m, [listId]: on }));
    const { error } = on
      ? await db().from('crew_shortlist_members').insert({ shortlist_id: listId, person_id: targetId, note: note.trim() || null })
      : await db().from('crew_shortlist_members').delete().eq('shortlist_id', listId).eq('person_id', targetId);
    if (error && error.code !== '23505') {
      setMember((m) => ({ ...m, [listId]: !on }));
      Alert.alert('Could not update the shortlist', error.message);
    }
  };

  const create = async () => {
    const { data: { user } } = await db().auth.getUser();
    if (!user || !name.trim()) return;
    const { data, error } = await db().from('crew_shortlists').insert({ owner_id: user.id, name: name.trim() }).select('id').single();
    if (error) return Alert.alert('Could not create the shortlist', error.message);
    await db().from('crew_shortlist_members').insert({ shortlist_id: data.id, person_id: targetId, note: note.trim() || null });
    setName('');
    load();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={`Shortlist ${targetName}`} subtitle="Private to you.">
      <TextInput style={[s.input, input, { marginTop: 0 }]} placeholder="Note about them (optional)" placeholderTextColor={T.textMuted} value={note} onChangeText={setNote} maxLength={300} />
      {loading ? <ActivityIndicator color={ORANGE} style={{ marginVertical: 16 }} /> : (
        <View style={{ marginTop: 10 }}>
          {lists.length === 0 && <Text style={{ color: T.textMuted, textAlign: 'center', paddingVertical: 10 }}>No shortlists yet. Create one below.</Text>}
          {lists.map((l) => (
            <TouchableOpacity key={l.id} onPress={() => toggle(l.id)} style={[s.option, { borderColor: member[l.id] ? ORANGE : T.border, backgroundColor: member[l.id] ? 'rgba(255,75,51,0.1)' : 'transparent' }]}>
              <Text style={{ color: T.textPrimary, fontWeight: '800', flex: 1 }} numberOfLines={1}>{l.name} <Text style={{ color: T.textMuted, fontWeight: '400' }}>· {(l.members || []).length}</Text></Text>
              {member[l.id] && <Icon name="check" size={16} color={ORANGE} />}
            </TouchableOpacity>
          ))}
        </View>
      )}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
        <TextInput style={[s.input, input, { flex: 1, marginTop: 0 }]} placeholder="New shortlist" placeholderTextColor={T.textMuted} value={name} onChangeText={setName} maxLength={80} onSubmitEditing={create} />
        <TouchableOpacity onPress={create} disabled={!name.trim()} style={[s.addBtn, !name.trim() && { opacity: 0.5 }]}><Icon name="plus" size={18} color="#fff" /></TouchableOpacity>
      </View>
    </Sheet>
  );
};

const s = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 8 },
  primary: { height: 46, borderRadius: 12, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  chip: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  addBtn: { width: 42, height: 42, borderRadius: 10, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
});
