import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal, ScrollView, Linking, KeyboardAvoidingView, Platform } from 'react-native';
import { Icon } from '../common/Icon';
import { CachedImage } from '../common/CachedImage';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';
import { pickAndUploadImage } from '../../services/imageUploadService';
import { pickAttachments, type PickedAttachment } from '../../services/attachmentPicker';
import { uploadPageDoc, RESUME_MAX_BYTES } from '../../services/resumeFiles';

const ORANGE = '#FF4B33';
const db = () => getSupabaseClient() as any;

// ── Insights ──────────────────────────────────────────────────────────────────────────────────────────────────────
export const PageInsightsPanel = ({ pageId }: { pageId: string }) => {
  const { themeColors: T } = useUserSettings();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    db()
      .rpc('page_analytics', { p_page_id: pageId })
      .then(({ data: d }: any) => setData(d))
      .finally(() => setLoading(false));
  }, [pageId]);

  if (loading) return <ActivityIndicator color={ORANGE} style={{ marginVertical: 24 }} />;
  if (!data || data.error) return <Text style={{ color: T.textMuted, textAlign: 'center', paddingVertical: 20 }}>Insights are only available to the page team.</Text>;

  const daily: { day: string; views: number; followers: number }[] = data.daily || [];
  const max = Math.max(1, ...daily.map((d) => d.views));
  const Tile = ({ icon, label, value, sub }: { icon: string; label: string; value: string | number; sub?: string }) => (
    <View style={[s.tile, { backgroundColor: T.bgCard, borderColor: T.border }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Icon name={icon} size={13} color={T.textMuted} />
        <Text style={{ color: T.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 }}>{label}</Text>
      </View>
      <Text style={{ color: T.textPrimary, fontSize: 24, fontWeight: '800', marginTop: 4 }}>{value}</Text>
      {sub ? <Text style={{ color: T.textSecondary, fontSize: 11, marginTop: 2 }}>{sub}</Text> : null}
    </View>
  );

  return (
    <View>
      <View style={s.tiles}>
        <Tile icon="eye" label="PAGE VIEWS" value={data.views} sub={`${data.views_30d} in 30 days`} />
        <Tile icon="users" label="FOLLOWERS" value={data.followers} sub={`+${data.followers_30d} in 30 days`} />
        <Tile icon="file-text" label="POSTS" value={data.posts} sub={`${data.posts_30d} in 30 days`} />
        <Tile icon="briefcase" label="OPEN JOBS" value={data.open_jobs} sub={data.applications != null ? `${data.applications} applications` : undefined} />
      </View>
      <View style={[s.chartBox, { backgroundColor: T.bgCard, borderColor: T.border }]}>
        <Text style={{ color: T.textMuted, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.7 }}>LAST 14 DAYS · VIEWS</Text>
        <View style={s.chart}>
          {daily.map((d) => (
            <View key={d.day} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
              <View style={{ width: '70%', height: Math.max(3, (d.views / max) * 70), backgroundColor: ORANGE, borderRadius: 3, opacity: 0.85 }} />
            </View>
          ))}
        </View>
        <Text style={{ color: T.textMuted, fontSize: 11, marginTop: 8 }}>{data.unique_viewers} different people have viewed this page. Visits by your own team are not counted.</Text>
      </View>
    </View>
  );
};

// ── Showcase ──────────────────────────────────────────────────────────────────────────────────────────────────────
export const PageShowcasePanel = ({ pageId, canManage }: { pageId: string; canManage: boolean }) => {
  const { themeColors: T } = useUserSettings();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState('');

  const load = useCallback(async () => {
    const { data } = await db().from('company_page_showcase').select('id, kind, url, caption, created_at').eq('page_id', pageId).order('created_at', { ascending: false });
    setItems(data || []);
    setLoading(false);
  }, [pageId]);

  useEffect(() => {
    load();
  }, [load]);

  const insert = async (kind: 'image' | 'video', url: string) => {
    const { data: { user } } = await db().auth.getUser();
    const { error } = await db().from('company_page_showcase').insert({ page_id: pageId, kind, url, added_by: user?.id });
    if (error) throw error;
  };

  const addImage = async () => {
    setBusy(true);
    try {
      const url = await pickAndUploadImage('portfolios', 'page-showcase');
      if (url) {
        await insert('image', url);
        await load();
      }
    } catch (e: any) {
      Alert.alert('Could not add the photo', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const addVideo = async () => {
    const url = link.trim();
    if (!/^https:\/\//i.test(url)) return Alert.alert('Paste a link that starts with https://');
    setBusy(true);
    try {
      await insert('video', url);
      setLink('');
      await load();
    } catch (e: any) {
      Alert.alert('Could not add the link', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const remove = (id: string) =>
    Alert.alert('Remove this from the showcase?', undefined, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const { error } = await db().from('company_page_showcase').delete().eq('id', id);
          if (error) Alert.alert('Could not remove', error.message);
          else load();
        },
      },
    ]);

  const videos = items.filter((i) => i.kind === 'video');
  const images = items.filter((i) => i.kind === 'image');

  return (
    <View>
      {canManage && (
        <View style={[s.addBox, { borderColor: T.border }]}>
          <TouchableOpacity disabled={busy} onPress={addImage} style={[s.addBtn, { borderColor: T.border }]}>
            {busy ? <ActivityIndicator color={ORANGE} /> : <Icon name="image-plus" size={15} color={ORANGE} />}
            <Text style={{ color: ORANGE, fontWeight: '800', fontSize: 12.5 }}>Add a photo</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <TextInput
              value={link}
              onChangeText={setLink}
              placeholder="Showreel link (YouTube, Vimeo…)"
              placeholderTextColor={T.textMuted}
              autoCapitalize="none"
              style={[s.input, { flex: 1, backgroundColor: T.inputBg, borderColor: T.border, color: T.textPrimary }]}
            />
            <TouchableOpacity disabled={busy || !link.trim()} onPress={addVideo} style={[s.addGo, (busy || !link.trim()) && { opacity: 0.5 }]}>
              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12.5 }}>Add</Text>
            </TouchableOpacity>
          </View>
          <Text style={{ color: T.textMuted, fontSize: 11, marginTop: 6 }}>Up to 12 items.</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={ORANGE} style={{ marginVertical: 20 }} />
      ) : items.length === 0 ? (
        <Text style={{ color: T.textMuted, textAlign: 'center', paddingVertical: 24 }}>
          {canManage ? 'Add photos and showreels to show what this company does.' : 'This company has not added a showcase yet.'}
        </Text>
      ) : (
        <>
          {videos.map((v) => (
            <View key={v.id} style={[s.videoRow, { backgroundColor: T.bgCard, borderColor: T.border }]}>
              <TouchableOpacity style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }} onPress={() => Linking.openURL(v.url).catch(() => {})}>
                <View style={s.playBox}><Icon name="play" size={16} color="#fff" /></View>
                <Text style={{ color: T.textPrimary, fontSize: 13, fontWeight: '700', flex: 1 }} numberOfLines={2}>{v.url.replace(/^https?:\/\//, '')}</Text>
              </TouchableOpacity>
              {canManage && (
                <TouchableOpacity onPress={() => remove(v.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Icon name="trash-2" size={16} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          ))}
          <View style={s.grid}>
            {images.map((img) => (
              <View key={img.id} style={s.gridItem}>
                <CachedImage uri={img.url} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                {canManage && (
                  <TouchableOpacity onPress={() => remove(img.id)} style={s.gridDelete}>
                    <Icon name="trash-2" size={13} color="#DC2626" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
};

// ── Verification request ──────────────────────────────────────────────────────────────────────────────────────────
export const PageVerificationModal = ({
  visible, onClose, pageId, pageName, onSubmitted,
}: { visible: boolean; onClose: () => void; pageId: string; pageName: string; onSubmitted: () => void }) => {
  const { themeColors: T } = useUserSettings();
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
    if (!file) return;
    setBusy(true);
    try {
      const ref = await uploadPageDoc(file);
      const { data, error } = await db().rpc('submit_page_verification', {
        p_page_id: pageId,
        p_document_ref: ref,
        p_registration: registration.trim() || null,
        p_website: website.trim() || null,
        p_notes: notes.trim() || null,
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.message);
      onClose();
      Alert.alert('Sent for review', "We'll notify you when your page is reviewed.", [{ text: 'OK', onPress: onSubmitted }]);
    } catch (e: any) {
      Alert.alert('Could not submit', e?.message || 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const field = [s.input, { backgroundColor: T.inputBg, borderColor: T.border, color: T.textPrimary }];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[s.sheet, { backgroundColor: T.bgCard, borderColor: T.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, paddingBottom: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: T.textPrimary, fontSize: 18, fontWeight: '800' }}>Get {pageName} verified</Text>
                <Text style={{ color: T.textSecondary, fontSize: 12 }}>Your document is private: only you and our review team can open it.</Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Icon name="x" size={20} color={T.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: 30 }}>
              <TouchableOpacity onPress={pick} style={[s.drop, { borderColor: T.border, backgroundColor: T.inputBg }]}>
                <Icon name={file ? 'file-text' : 'upload'} size={18} color={ORANGE} />
                <Text style={{ color: file ? T.textPrimary : T.textSecondary, fontSize: 13, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                  {file ? file.name : 'Attach a company document (PDF or photo, up to 10 MB)'}
                </Text>
              </TouchableOpacity>
              <TextInput style={field} value={registration} onChangeText={setRegistration} placeholder="Registration / GST number (optional)" placeholderTextColor={T.textMuted} maxLength={80} />
              <TextInput style={field} value={website} onChangeText={setWebsite} placeholder="Official website (optional)" placeholderTextColor={T.textMuted} autoCapitalize="none" maxLength={200} />
              <TextInput style={[...field, { height: 70, paddingTop: 10, textAlignVertical: 'top' }]} value={notes} onChangeText={setNotes} placeholder="Anything we should know? (optional)" placeholderTextColor={T.textMuted} multiline maxLength={1000} />
              <TouchableOpacity style={[s.submit, (busy || !file) && { opacity: 0.5 }]} disabled={busy || !file} onPress={submit}>
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>Submit for review</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const s = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: '48.5%', borderWidth: 1, borderRadius: 14, padding: 12 },
  chartBox: { borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 10 },
  chart: { flexDirection: 'row', height: 76, alignItems: 'flex-end', gap: 3, marginTop: 10 },
  addBox: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, padding: 12, marginBottom: 14 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: 999, height: 38 },
  addGo: { backgroundColor: ORANGE, borderRadius: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 42, fontSize: 13, marginBottom: 10 },
  videoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 10, marginBottom: 8 },
  playBox: { width: 38, height: 38, borderRadius: 12, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridItem: { width: '48.5%', aspectRatio: 4 / 3, borderRadius: 14, overflow: 'hidden', backgroundColor: 'rgba(148,163,184,0.2)' },
  gridDelete: { position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  sheet: { maxHeight: '90%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0 },
  drop: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderStyle: 'dashed', borderRadius: 14, padding: 14, marginBottom: 12 },
  submit: { backgroundColor: ORANGE, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 14.5 },
});
