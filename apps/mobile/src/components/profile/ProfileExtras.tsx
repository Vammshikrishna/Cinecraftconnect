import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, TextInput, ScrollView, Alert, Linking, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Icon } from '../common/Icon';
import { CachedImage } from '../common/CachedImage';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';
import { pickAttachments } from '../../services/attachmentPicker';
import { uploadResume, openResume } from '../../services/resumeFiles';
import { toSafeUrl } from '../../utils/safeUrl';

const openSafe = (u?: string | null) => {
  const safe = toSafeUrl(u);
  if (safe) Linking.openURL(safe).catch(() => {});
  else Alert.alert('Link not supported', 'This link cannot be opened.');
};

const ORANGE = '#FF4B33';
const db = () => getSupabaseClient() as any;

export interface Highlights {
  showreel_url: string | null;
  showreel_title: string | null;
  languages: string[];
  gear: string[];
  cv_path: string | null;
  cv_public: boolean;
  hidden_sections: string[];
}
const EMPTY: Highlights = { showreel_url: null, showreel_title: null, languages: [], gear: [], cv_path: null, cv_public: false, hidden_sections: [] };

/** Loads one person's highlights (the database only returns them when the viewer may see this profile). */
export const useProfileHighlights = (userId?: string | null) => {
  const [data, setData] = useState<Highlights>(EMPTY);
  const load = useCallback(async () => {
    if (!userId) return;
    const { data: row } = await db().from('profile_highlights').select('*').eq('user_id', userId).maybeSingle();
    setData(row ? { ...EMPTY, ...row } : EMPTY);
  }, [userId]);
  useEffect(() => {
    load();
  }, [load]);
  return { highlights: data, reload: load };
};

export interface EndorsementInfo { skill_id: number; endorsements: number; endorsed_by_me: boolean; sample_names: string[] }

/** Endorsement counts per skill for one profile, and endorse / take back (connections only, enforced by the server). */
export const useSkillEndorsements = (userId?: string | null) => {
  const [info, setInfo] = useState<Record<number, EndorsementInfo>>({});
  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await db().rpc('skill_endorsement_summary', { p_user: userId });
    const map: Record<number, EndorsementInfo> = {};
    ((data || []) as EndorsementInfo[]).forEach((r) => { map[Number(r.skill_id)] = r; });
    setInfo(map);
  }, [userId]);
  useEffect(() => {
    load();
  }, [load]);
  const toggle = async (skillId: number) => {
    const { error } = await db().rpc('toggle_skill_endorsement', { p_skill_id: skillId });
    if (error) return Alert.alert('Could not endorse', error.message);
    load();
  };
  return { info, toggle };
};

const youtubeId = (url: string) => url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/)?.[1] || null;

/** The pinned showreel, languages, gear and CV at the top of a profile. */
export const ProfileHighlightsView = ({ highlights: h, isOwn, onEdit }: { highlights: Highlights; isOwn: boolean; onEdit?: () => void }) => {
  const { themeColors: T } = useUserSettings();
  const hasCv = !!h.cv_path && (h.cv_public || isOwn);
  const hasAny = !!h.showreel_url || h.languages.length > 0 || h.gear.length > 0 || hasCv;

  if (!hasAny) {
    return isOwn ? (
      <TouchableOpacity onPress={onEdit} activeOpacity={0.8} style={[s.empty, { borderColor: ORANGE + '66', backgroundColor: 'rgba(255,75,51,0.06)' }]}>
        <Text style={{ color: T.textPrimary, fontWeight: '900' }}>✨ Add your highlights</Text>
        <Text style={{ color: T.textSecondary, fontSize: 12.5, marginTop: 2 }}>Pin a showreel, list your gear and languages, and share a CV.</Text>
      </TouchableOpacity>
    ) : null;
  }

  const yt = h.showreel_url ? youtubeId(h.showreel_url) : null;
  return (
    <View style={[s.card, { backgroundColor: T.bgCard, borderColor: T.border }]}>
      {!!h.showreel_url && (
        <TouchableOpacity activeOpacity={0.9} onPress={() => openSafe(h.showreel_url)} style={s.reel}>
          {yt ? <CachedImage uri={`https://img.youtube.com/vi/${yt}/hqdefault.jpg`} style={StyleSheet.absoluteFillObject} resizeMode="cover" /> : <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(255,75,51,0.18)' }]} />}
          <View style={s.reelOverlay}>
            <View style={s.playBtn}><Icon name="play" size={22} color="#111" /></View>
          </View>
          <Text style={s.reelTitle} numberOfLines={1}>{h.showreel_title || 'Showreel'}</Text>
        </TouchableOpacity>
      )}
      <View style={{ padding: 12, gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: T.textMuted, fontSize: 11, fontWeight: '900', letterSpacing: 1, flex: 1 }}>HIGHLIGHTS</Text>
          {isOwn && <TouchableOpacity onPress={onEdit}><Text style={{ color: ORANGE, fontWeight: '800', fontSize: 12.5 }}>Edit</Text></TouchableOpacity>}
        </View>
        {h.languages.length > 0 && (
          <View style={s.chips}>
            <Text style={{ color: T.textMuted, fontSize: 12 }}>🗣</Text>
            {h.languages.map((l) => <View key={l} style={[s.chip, { backgroundColor: 'rgba(255,75,51,0.12)' }]}><Text style={{ color: ORANGE, fontSize: 12, fontWeight: '800' }}>{l}</Text></View>)}
          </View>
        )}
        {h.gear.length > 0 && (
          <View style={s.chips}>
            <Text style={{ color: T.textMuted, fontSize: 12 }}>🎥</Text>
            {h.gear.map((g) => <View key={g} style={[s.chip, { borderWidth: 1, borderColor: T.border }]}><Text style={{ color: T.textSecondary, fontSize: 12 }}>{g}</Text></View>)}
          </View>
        )}
        {hasCv && (
          <TouchableOpacity style={[s.cvBtn, { borderColor: T.border }]} onPress={() => openResume(h.cv_path!).catch((e) => Alert.alert('Could not open the file', e.message))}>
            <Icon name="file-text" size={14} color={T.textPrimary} />
            <Text style={{ color: T.textPrimary, fontWeight: '800', fontSize: 13 }}>{isOwn && !h.cv_public ? 'My CV (private)' : 'Download CV'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const agoText = (iso: string) => {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d}d ago` : `${Math.round(d / 30)}mo ago`;
};

/** "How you're connected" and a recent-activity strip for someone else's profile. */
export const ProfileContextStrip = ({ userId, showContext, onOpenProfile, onOpenPage }: {
  userId: string; showContext: boolean; onOpenProfile: (id: string, name: string) => void; onOpenPage: (slug: string) => void;
}) => {
  const { themeColors: T } = useUserSettings();
  const [ctx, setCtx] = useState<any>(null);
  const [act, setAct] = useState<any>(null);

  useEffect(() => {
    if (showContext) db().rpc('get_connection_context', { p_user: userId }).then(({ data }: any) => setCtx(data || null));
    db().rpc('get_profile_activity', { p_user: userId }).then(({ data }: any) => setAct(data || null));
  }, [userId, showContext]);

  const mutuals: any[] = ctx?.mutuals || [];
  const projects: any[] = ctx?.shared_projects || [];
  const pages: any[] = ctx?.shared_pages || [];
  const hasContext = mutuals.length > 0 || projects.length > 0 || pages.length > 0;
  const chips: { key: string; text: string }[] = [];
  if (act?.active_recently) chips.push({ key: 'active', text: 'Active this week' });
  if (act?.last_credit) chips.push({ key: 'credit', text: `Credit: ${act.last_credit.role} on ${act.last_credit.project} · ${agoText(act.last_credit.at)}` });
  if (act?.last_portfolio) chips.push({ key: 'port', text: `Portfolio: ${act.last_portfolio.title} · ${agoText(act.last_portfolio.at)}` });
  if (act?.last_award) chips.push({ key: 'award', text: `${act.last_award.kind === 'press' ? 'Press' : 'Award'}: ${act.last_award.title}` });
  if (act?.last_post_at && !act?.active_recently) chips.push({ key: 'post', text: `Last post ${agoText(act.last_post_at)}` });
  if (!hasContext && chips.length === 0) return null;

  return (
    <View style={[s.card, { backgroundColor: T.bgCard, borderColor: T.border, padding: 12, gap: 8 }]}>
      {hasContext && (
        <View style={{ gap: 6 }}>
          <Text style={{ color: T.textMuted, fontSize: 10.5, fontWeight: '900', letterSpacing: 1 }}>HOW YOU'RE CONNECTED</Text>
          {mutuals.length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flexDirection: 'row' }}>
                {mutuals.map((m, i) => (
                  <TouchableOpacity key={m.id} onPress={() => onOpenProfile(m.id, m.full_name)} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                    {m.avatar_url ? (
                      <CachedImage uri={m.avatar_url} style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: T.bgCard }} />
                    ) : (
                      <View style={{ width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: T.bgCard, backgroundColor: T.chipBg, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: ORANGE, fontSize: 10, fontWeight: '900' }}>{(m.full_name || '?').charAt(0).toUpperCase()}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={{ color: T.textPrimary, fontSize: 13, flex: 1 }}>
                {ctx.mutual_count} mutual connection{ctx.mutual_count === 1 ? '' : 's'}
                <Text style={{ color: T.textMuted }}>: {mutuals.slice(0, 2).map((m) => m.full_name).join(', ')}{ctx.mutual_count > 2 ? ` and ${ctx.mutual_count - 2} more` : ''}</Text>
              </Text>
            </View>
          )}
          {projects.length > 0 && (
            <Text style={{ color: T.textPrimary, fontSize: 13 }}>You're both in <Text style={{ color: T.textMuted }}>{projects.map((p) => p.name).join(', ')}</Text></Text>
          )}
          {pages.length > 0 && (
            <Text style={{ color: T.textPrimary, fontSize: 13 }}>
              You're both on{' '}
              {pages.map((p, i) => (
                <Text key={p.id} style={{ color: ORANGE, fontWeight: '700' }} onPress={() => onOpenPage(p.slug)}>{i > 0 ? ', ' : ''}{p.name}</Text>
              ))}
            </Text>
          )}
        </View>
      )}
      {chips.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {chips.map((c) => (
            <View key={c.key} style={[s.chip, { borderWidth: 1, borderColor: c.key === 'active' ? '#05966955' : T.border, backgroundColor: c.key === 'active' ? 'rgba(5,150,105,0.12)' : 'transparent' }]}>
              <Text style={{ color: c.key === 'active' ? '#059669' : T.textSecondary, fontSize: 11.5, fontWeight: c.key === 'active' ? '800' : '500' }}>{c.text}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const REL: Record<string, string> = { worked_with: 'Worked together', managed: 'Managed them', hired: 'Hired them', mentored: 'Mentored them' };

/** Recommendations on a profile. The person sees pending ones and approves or declines them. */
export const RecommendationsPanel = ({ userId, isOwner, refreshKey = 0 }: { userId: string; isOwner: boolean; refreshKey?: number }) => {
  const { themeColors: T } = useUserSettings();
  const [rows, setRows] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const { data } = await db().rpc('list_recommendations', { p_subject: userId });
    setRows(data || []);
    setLoaded(true);
  }, [userId]);
  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const respond = async (id: string, approve: boolean) => {
    const { error } = await db().rpc('respond_recommendation', { p_id: id, p_approve: approve });
    if (error) return Alert.alert('Could not update', error.message);
    load();
  };
  const remove = (r: any) =>
    Alert.alert('Remove recommendation', 'Remove this recommendation?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { const { error } = await db().from('profile_recommendations').delete().eq('id', r.id); if (error) return Alert.alert('Could not remove', error.message); load(); } },
    ]);

  if (!loaded) return <ActivityIndicator color={ORANGE} style={{ marginVertical: 24 }} />;
  if (rows.length === 0) {
    return <Text style={{ color: T.textMuted, textAlign: 'center', paddingVertical: 28 }}>{isOwner ? 'No recommendations yet. Connections you worked with can write one from your profile.' : 'No recommendations yet.'}</Text>;
  }
  return (
    <View>
      {rows.map((r) => (
        <View key={r.id} style={[s.card, { backgroundColor: T.bgCard, borderColor: r.status === 'pending' ? ORANGE : T.border, padding: 12, marginBottom: 8, gap: 8 }]}>
          {r.status === 'pending' && <Text style={{ color: ORANGE, fontSize: 10.5, fontWeight: '900', letterSpacing: 0.8 }}>{isOwner ? 'WAITING FOR YOUR APPROVAL' : 'WAITING FOR APPROVAL'}</Text>}
          <Text style={{ color: T.textPrimary, fontSize: 13.5, lineHeight: 19 }}>“{r.body}”</Text>
          <Text style={{ color: T.textMuted, fontSize: 12 }}>
            <Text style={{ color: T.textPrimary, fontWeight: '800' }}>{r.author_name}</Text> · {REL[r.relationship]}{r.project_title ? ` · ${r.project_title}` : ''} · {agoText(r.created_at)}
          </Text>
          <View style={{ flexDirection: 'row', gap: 14 }}>
            {isOwner && r.status === 'pending' && (
              <>
                <TouchableOpacity onPress={() => respond(r.id, true)}><Text style={{ color: ORANGE, fontWeight: '800' }}>Approve</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => respond(r.id, false)}><Text style={{ color: T.textSecondary, fontWeight: '700' }}>Decline</Text></TouchableOpacity>
              </>
            )}
            {(isOwner || r.is_mine) && r.status !== 'pending' && (
              <TouchableOpacity onPress={() => remove(r)}><Text style={{ color: '#DC2626', fontWeight: '700' }}>Remove</Text></TouchableOpacity>
            )}
          </View>
        </View>
      ))}
    </View>
  );
};

const SECTIONS: [string, string][] = [
  ['posts', 'Posts'], ['portfolio', 'Portfolio'], ['projects', 'Projects'], ['announcements', 'Announcements'],
  ['credits', 'Credits'], ['skills', 'Skills'], ['experience', 'Experience'], ['awards', 'Awards & press'],
];

/** Edit the highlights: showreel, languages, gear, CV and which sections visitors see. */
export const ProfileHighlightsModal = ({ visible, onClose, userId, current, onSaved }: {
  visible: boolean; onClose: () => void; userId: string; current: Highlights; onSaved: () => void;
}) => {
  const { themeColors: T } = useUserSettings();
  const input = { backgroundColor: T.inputBg, borderColor: T.border, color: T.textPrimary };
  const [reel, setReel] = useState('');
  const [reelTitle, setReelTitle] = useState('');
  const [languages, setLanguages] = useState('');
  const [gear, setGear] = useState('');
  const [cvPath, setCvPath] = useState<string | null>(null);
  const [cvPublic, setCvPublic] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setReel(current.showreel_url || '');
    setReelTitle(current.showreel_title || '');
    setLanguages(current.languages.join(', '));
    setGear(current.gear.join(', '));
    setCvPath(current.cv_path);
    setCvPublic(current.cv_public);
    setHidden(current.hidden_sections);
  }, [visible, current]);

  const pickCv = async () => {
    try {
      const [f] = await pickAttachments({ multiple: false });
      if (!f) return;
      setUploading(true);
      setCvPath(await uploadResume(f));
    } catch (e: any) {
      Alert.alert('Could not upload the file', e?.message || 'Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const split = (v: string) => v.split(',').map((x) => x.trim()).filter(Boolean);

  const save = async () => {
    setSaving(true);
    const { error } = await db().from('profile_highlights').upsert({
      user_id: userId,
      showreel_url: reel.trim() || null,
      showreel_title: reelTitle.trim() || null,
      languages: split(languages),
      gear: split(gear),
      cv_path: cvPath,
      cv_public: !!cvPath && cvPublic,
      hidden_sections: hidden,
    }, { onConflict: 'user_id' });
    setSaving(false);
    if (error) return Alert.alert('Could not save', error.message);
    onSaved();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.backdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[s.sheet, { backgroundColor: T.bgCard }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: T.textPrimary, fontSize: 17, fontWeight: '900', flex: 1 }}>Your highlights</Text>
            <TouchableOpacity onPress={onClose}><Icon name="x" size={20} color={T.textSecondary} /></TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 480, marginTop: 10 }} keyboardShouldPersistTaps="handled">
            <Text style={[s.label, { color: T.textMuted }]}>SHOWREEL LINK (HTTPS)</Text>
            <TextInput style={[s.input, input]} placeholder="https://youtu.be/..." placeholderTextColor={T.textMuted} value={reel} onChangeText={setReel} autoCapitalize="none" maxLength={300} />
            <TextInput style={[s.input, input]} placeholder="Title, e.g. Showreel 2026" placeholderTextColor={T.textMuted} value={reelTitle} onChangeText={setReelTitle} maxLength={100} />
            <Text style={[s.label, { color: T.textMuted }]}>LANGUAGES (COMMA SEPARATED)</Text>
            <TextInput style={[s.input, input]} placeholder="Telugu, Hindi, English" placeholderTextColor={T.textMuted} value={languages} onChangeText={setLanguages} />
            <Text style={[s.label, { color: T.textMuted }]}>GEAR (COMMA SEPARATED)</Text>
            <TextInput style={[s.input, input]} placeholder="ARRI Alexa Mini, Sony FX6" placeholderTextColor={T.textMuted} value={gear} onChangeText={setGear} />
            <Text style={[s.label, { color: T.textMuted }]}>CV</Text>
            {cvPath ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ color: T.textPrimary, flex: 1 }}>CV uploaded</Text>
                <TouchableOpacity onPress={() => { setCvPath(null); setCvPublic(false); }}><Text style={{ color: '#DC2626', fontWeight: '800' }}>Remove</Text></TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={[s.upload, { borderColor: T.border }]} onPress={pickCv} disabled={uploading}>
                {uploading ? <ActivityIndicator color={ORANGE} /> : <Text style={{ color: T.textSecondary }}>Upload a PDF or document (up to 10 MB)</Text>}
              </TouchableOpacity>
            )}
            {!!cvPath && (
              <TouchableOpacity onPress={() => setCvPublic((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <View style={[s.check, { borderColor: cvPublic ? ORANGE : T.border, backgroundColor: cvPublic ? ORANGE : 'transparent' }]}>{cvPublic && <Icon name="check" size={12} color="#fff" />}</View>
                <Text style={{ color: T.textPrimary }}>Let visitors download my CV</Text>
              </TouchableOpacity>
            )}
            <Text style={[s.label, { color: T.textMuted }]}>SECTIONS VISITORS CAN SEE</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {SECTIONS.map(([k, l]) => {
                const shown = !hidden.includes(k);
                return (
                  <TouchableOpacity key={k} onPress={() => setHidden(shown ? [...hidden, k] : hidden.filter((x) => x !== k))}
                    style={[s.chip, { borderWidth: 1, borderColor: shown ? ORANGE : T.border, backgroundColor: shown ? ORANGE : 'transparent' }]}>
                    <Text style={{ color: shown ? '#fff' : T.textMuted, fontSize: 12, fontWeight: '800', textDecorationLine: shown ? 'none' : 'line-through' }}>{l}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={{ color: T.textMuted, fontSize: 11.5, marginTop: 6 }}>You always see everything on your own profile.</Text>
          </ScrollView>
          <TouchableOpacity style={[s.primary, (saving || uploading) && { opacity: 0.6 }]} onPress={save} disabled={saving || uploading}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Save</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

/** Awards, festival selections and press, newest first. */
export const AwardsPanel = ({ userId, isOwner }: { userId: string; isOwner: boolean }) => {
  const { themeColors: T } = useUserSettings();
  const input = { backgroundColor: T.inputBg, borderColor: T.border, color: T.textPrimary };
  const [rows, setRows] = useState<any[]>([]);
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<'award' | 'festival' | 'press'>('award');
  const [title, setTitle] = useState('');
  const [org, setOrg] = useState('');
  const [year, setYear] = useState('');
  const [url, setUrl] = useState('');
  const KINDS = { award: '🏆 Award', festival: '🎬 Festival', press: '📰 Press' } as const;

  const load = useCallback(async () => {
    const { data } = await db().from('profile_awards').select('*').eq('user_id', userId)
      .order('year', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
    setRows(data || []);
  }, [userId]);
  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    const { error } = await db().from('profile_awards').insert({
      user_id: userId, kind, title: title.trim(), org: org.trim() || null, year: year ? parseInt(year, 10) : null, url: url.trim() || null,
    });
    if (error) return Alert.alert('Could not add', error.message);
    setTitle(''); setOrg(''); setYear(''); setUrl(''); setAdding(false);
    load();
  };

  const remove = (r: any) =>
    Alert.alert('Remove', `Remove "${r.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          const { error } = await db().from('profile_awards').delete().eq('id', r.id);
          if (error) return Alert.alert('Could not remove', error.message);
          setRows((prev) => prev.filter((x) => x.id !== r.id));
        },
      },
    ]);

  return (
    <View>
      {isOwner && (adding ? (
        <View style={[s.card, { backgroundColor: T.bgCard, borderColor: T.border, padding: 12, gap: 8 }]}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {(Object.keys(KINDS) as (keyof typeof KINDS)[]).map((k) => (
              <TouchableOpacity key={k} onPress={() => setKind(k)} style={[s.chip, { borderWidth: 1, borderColor: kind === k ? ORANGE : T.border, backgroundColor: kind === k ? 'rgba(255,75,51,0.12)' : 'transparent' }]}>
                <Text style={{ color: kind === k ? ORANGE : T.textSecondary, fontWeight: '800', fontSize: 12 }}>{KINDS[k]}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={[s.input, input, { marginTop: 0 }]} placeholder={kind === 'press' ? 'Headline or article title' : 'Title, e.g. Best Cinematography - Short Film'} placeholderTextColor={T.textMuted} value={title} onChangeText={setTitle} maxLength={120} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput style={[s.input, input, { flex: 1, marginTop: 0 }]} placeholder={kind === 'press' ? 'Outlet' : 'Festival / organisation'} placeholderTextColor={T.textMuted} value={org} onChangeText={setOrg} maxLength={120} />
            <TextInput style={[s.input, input, { width: 80, marginTop: 0 }]} placeholder="Year" placeholderTextColor={T.textMuted} value={year} onChangeText={setYear} keyboardType="number-pad" maxLength={4} />
          </View>
          <TextInput style={[s.input, input, { marginTop: 0 }]} placeholder="Link (https://...), optional" placeholderTextColor={T.textMuted} value={url} onChangeText={setUrl} autoCapitalize="none" maxLength={300} />
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <TouchableOpacity onPress={add} disabled={!title.trim()}><Text style={{ color: ORANGE, fontWeight: '800', opacity: title.trim() ? 1 : 0.5 }}>Add</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setAdding(false)}><Text style={{ color: T.textSecondary, fontWeight: '700' }}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity onPress={() => setAdding(true)} style={[s.cvBtn, { borderColor: ORANGE, alignSelf: 'flex-start', marginBottom: 10 }]}>
          <Icon name="plus" size={14} color={ORANGE} />
          <Text style={{ color: ORANGE, fontWeight: '800' }}>Add award, festival or press</Text>
        </TouchableOpacity>
      ))}

      {rows.length === 0 ? (
        <Text style={{ color: T.textMuted, textAlign: 'center', paddingVertical: 28 }}>
          {isOwner ? 'Nothing here yet. Add your awards, festival selections and press.' : 'No awards or press listed.'}
        </Text>
      ) : (
        rows.map((r) => (
          <TouchableOpacity key={r.id} activeOpacity={0.85} onPress={() => r.url && openSafe(r.url)} onLongPress={isOwner ? () => remove(r) : undefined}
            style={[s.card, { backgroundColor: T.bgCard, borderColor: T.border, padding: 12, marginBottom: 8 }]}>
            <Text style={{ color: T.textMuted, fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8 }}>{KINDS[r.kind as keyof typeof KINDS]?.toUpperCase()}{r.year ? ` · ${r.year}` : ''}</Text>
            <Text style={{ color: T.textPrimary, fontWeight: '800', fontSize: 14.5, marginTop: 2 }}>{r.title}</Text>
            {!!r.org && <Text style={{ color: T.textSecondary, fontSize: 13 }}>{r.org}</Text>}
            {!!r.url && <Text style={{ color: ORANGE, fontSize: 12, marginTop: 4 }}>Open link ↗</Text>}
          </TouchableOpacity>
        ))
      )}
      {isOwner && rows.length > 0 && <Text style={{ color: T.textMuted, fontSize: 11, textAlign: 'center' }}>Long-press an item to remove it</Text>}
    </View>
  );
};

/** How complete my profile is, and the next best things to add. Hidden once it is complete. */
export const ProfileCompletenessCard = ({ refreshKey = 0, onAction }: { refreshKey?: number; onAction: (key: string) => void }) => {
  const { themeColors: T } = useUserSettings();
  const [d, setD] = useState<{ score: number; missing: { key: string; label: string; points: number }[] } | null>(null);
  const [open, setOpen] = useState(true);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    db().rpc('my_profile_completeness').then(({ data }: any) => setD(data || null));
    db().rpc('profile_hint').then(({ data }: any) => setHint(data || null));
  }, [refreshKey]);

  if (!d || d.score >= 100) return null;
  const color = d.score >= 70 ? '#10B981' : d.score >= 40 ? '#F59E0B' : '#F43F5E';
  return (
    <View style={[s.card, { backgroundColor: T.bgCard, borderColor: T.border, padding: 12 }]}>
      <TouchableOpacity onPress={() => setOpen((o) => !o)} activeOpacity={0.8}>
        <Text style={{ color: T.textPrimary, fontWeight: '900', fontSize: 14 }}>Your profile is {d.score}% complete</Text>
        <Text style={{ color: T.textMuted, fontSize: 12 }}>Complete profiles get noticed more.</Text>
      </TouchableOpacity>
      <View style={{ height: 7, borderRadius: 4, backgroundColor: T.chipBg, overflow: 'hidden', marginTop: 8 }}>
        <View style={{ width: `${d.score}%`, height: '100%', backgroundColor: color, borderRadius: 4 }} />
      </View>
      {open && !!hint && (
        <Text style={{ color: ORANGE, fontSize: 12, backgroundColor: 'rgba(255,75,51,0.1)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginTop: 8 }}>{hint}</Text>
      )}
      {open && d.missing.slice(0, 4).map((m) => (
        <TouchableOpacity key={m.key} onPress={() => onAction(m.key)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
          <Text style={{ color: T.textPrimary, flex: 1, fontSize: 13.5 }}>○  {m.label}</Text>
          <Text style={{ color: ORANGE, fontWeight: '800', fontSize: 12 }}>+{m.points}%</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const s = StyleSheet.create({
  empty: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 14, padding: 14, marginHorizontal: 14, marginBottom: 12 },
  card: { borderWidth: 1, borderRadius: 14, overflow: 'hidden', marginHorizontal: 14, marginBottom: 12 },
  reel: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#111' },
  reelOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' },
  playBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  reelTitle: { position: 'absolute', left: 12, right: 12, bottom: 8, color: '#fff', fontWeight: '800', fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  chip: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  cvBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, paddingBottom: 28 },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginTop: 14 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 8 },
  upload: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  check: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  primary: { height: 46, borderRadius: 12, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginTop: 14 },
});
