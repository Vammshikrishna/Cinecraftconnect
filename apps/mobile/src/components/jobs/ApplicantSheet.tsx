import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, Linking, ActivityIndicator } from 'react-native';
import { Icon } from '../common/Icon';
import { CachedImage } from '../common/CachedImage';
import { useUserSettings } from '../../hooks/useUserSettings';
import {
  PIPELINE_STAGES,
  INTERVIEW_MODE_LABELS,
  INTERVIEW_STATUS_LABELS,
  matchColor,
  normalizeScreeningQuestions,
  type ApplicationStatus,
  type InterviewMode,
} from '@cinecraft/core';
import {
  addNote,
  deleteNote,
  fetchNotes,
  proposeInterview,
  setApplicationStatus,
  setRating,
  setShortlisted,
  updateInterview,
  type ApplicantNote,
  type HiringApplicant,
  type HiringJob,
} from '../../services/jobsApi';
import { openResume } from '../../services/resumeFiles';
import { StarRating, StageBadge, MatchBadge, RejectModal, addInterviewToCalendar, ORANGE } from './JobsShared';

interface Props {
  applicant: HiringApplicant | null;
  job: HiringJob | null;
  userId: string;
  onClose: () => void;
  /** Called after any change so the workspace can refetch. */
  onChanged: () => void;
  onMessage: (applicant: HiringApplicant) => void;
}

const Section = ({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) => {
  const { themeColors } = useUserSettings();
  return (
    <View style={{ marginTop: 22 }}>
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: themeColors.textMuted }]}>{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
};

const pad = (n: number) => String(n).padStart(2, '0');
const dayString = (offsetDays: number) => {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export const ApplicantSheet = ({ applicant: a, job, userId, onClose, onChanged, onMessage }: Props) => {
  const { themeColors } = useUserSettings();
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<ApplicantNote[]>([]);
  const [noteDraft, setNoteDraft] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [showScheduler, setShowScheduler] = useState(false);
  const [iv, setIv] = useState({ date: dayString(1), time: '11:00', duration: '30', mode: 'video' as InterviewMode, location: '', notes: '' });

  const applicationId = a?.id;
  useEffect(() => {
    if (!applicationId) return;
    setShowScheduler(false);
    setNoteDraft('');
    setNotes([]);
    fetchNotes(applicationId).then(setNotes).catch(() => {});
  }, [applicationId]);

  const run = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      try {
        await fn();
        onChanged();
      } catch (e: any) {
        Alert.alert('Something went wrong', e?.message || 'Please try again.');
      } finally {
        setBusy(false);
      }
    },
    [onChanged]
  );

  if (!a || !job) return null;
  const p = a.applicant;
  const name = p?.full_name || p?.username || 'Applicant';
  const questions = normalizeScreeningQuestions(job.screening_questions);
  const mc = matchColor(a.match.score);
  const label = { color: themeColors.textMuted };

  const moveTo = (status: ApplicationStatus) => {
    if (status === a.status) return;
    if (status === 'rejected') setRejectOpen(true);
    else run(() => setApplicationStatus(a.id, status));
  };

  const schedule = () => {
    const when = new Date(`${iv.date}T${iv.time}:00`);
    if (Number.isNaN(when.getTime())) return Alert.alert('Check the date and time', 'Use the format 2026-10-12 and 14:30.');
    if (when.getTime() < Date.now()) return Alert.alert('Pick a time in the future');
    const duration = Number(iv.duration);
    if (!(duration >= 10 && duration <= 480)) return Alert.alert('Length must be between 10 and 480 minutes');
    run(async () => {
      await proposeInterview({
        application_id: a.id,
        job_id: job.id,
        proposed_by: userId,
        scheduled_at: when.toISOString(),
        duration_minutes: duration,
        mode: iv.mode,
        location: iv.location.trim() || null,
        notes: iv.notes.trim() || null,
      });
      setShowScheduler(false);
      setIv((v) => ({ ...v, location: '', notes: '' }));
    });
  };

  const submitNote = () => {
    const body = noteDraft.trim();
    if (!body) return;
    run(async () => {
      await addNote(a.id, userId, body);
      setNoteDraft('');
      setNotes(await fetchNotes(a.id));
    });
  };

  const field = [styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }];

  return (
    <>
      <Modal visible transparent animationType="slide" onRequestClose={onClose}>
        <View style={styles.backdrop}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
          <View style={[styles.sheet, { backgroundColor: themeColors.bgScreen, borderColor: themeColors.border }]}>
            <View style={styles.grabber} />
            <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* Header */}
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                {p?.avatar_url ? (
                  <CachedImage uri={p.avatar_url} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={{ color: ORANGE, fontWeight: '800', fontSize: 22 }}>{name.charAt(0).toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: themeColors.textPrimary }]} numberOfLines={1}>{name}</Text>
                  <Text style={{ color: themeColors.textSecondary, fontSize: 12 }} numberOfLines={2}>
                    {[p?.craft, p?.location].filter(Boolean).join(' · ') || 'No craft or location added'}
                  </Text>
                  <Text style={{ color: themeColors.textMuted, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                    Applied for {job.title}
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Icon name="x" size={22} color={themeColors.textSecondary} />
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <StageBadge status={a.status} />
                <MatchBadge match={a.match} />
                {a.is_shortlisted && (
                  <View style={[styles.chip, { backgroundColor: '#F59E0B' }]}>
                    <Text style={{ color: '#000', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 }}>SHORTLISTED</Text>
                  </View>
                )}
              </View>

              {/* Stage */}
              <Section title="HIRING STAGE">
                <View style={styles.stageGrid}>
                  {PIPELINE_STAGES.map((st) => {
                    const on = a.status === st.key;
                    return (
                      <TouchableOpacity
                        key={st.key}
                        disabled={busy}
                        onPress={() => moveTo(st.key)}
                        style={[styles.stageBtn, { borderColor: on ? st.color : themeColors.border, backgroundColor: on ? st.tint : 'transparent' }]}
                      >
                        <Text style={{ color: on ? st.color : themeColors.textSecondary, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 }}>{st.label.toUpperCase()}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {a.status === 'rejected' && a.rejection_reason ? (
                  <Text style={{ color: themeColors.textSecondary, fontSize: 12, marginTop: 8 }}>Reason shared with the candidate: {a.rejection_reason}</Text>
                ) : null}
                <Text style={{ color: themeColors.textMuted, fontSize: 11, marginTop: 8 }}>The candidate gets a notification whenever you move them.</Text>
              </Section>

              {/* Rating + shortlist */}
              <View style={[styles.sectionHead, { marginTop: 22, alignItems: 'flex-end' }]}>
                <View>
                  <Text style={[styles.sectionTitle, label, { marginBottom: 4 }]}>YOUR RATING</Text>
                  <StarRating value={a.rating} size={24} onChange={(v) => run(() => setRating(a.id, v))} />
                </View>
                <TouchableOpacity
                  disabled={busy}
                  onPress={() => run(() => setShortlisted([a.id], !a.is_shortlisted))}
                  style={[styles.pillBtn, { borderColor: a.is_shortlisted ? '#F59E0B' : themeColors.border, backgroundColor: a.is_shortlisted ? 'rgba(245,158,11,0.15)' : 'transparent' }]}
                >
                  <Icon name="star" size={14} color={a.is_shortlisted ? '#F59E0B' : themeColors.textSecondary} fill={a.is_shortlisted ? '#F59E0B' : 'none'} />
                  <Text style={{ color: a.is_shortlisted ? '#F59E0B' : themeColors.textPrimary, fontWeight: '700', fontSize: 12 }}>
                    {a.is_shortlisted ? 'Shortlisted' : 'Shortlist'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Match */}
              <Section title="WHY THIS SCORE">
                <View style={[styles.card, { borderColor: `${mc}44`, backgroundColor: themeColors.bgCard }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: mc, fontSize: 26, fontWeight: '800' }}>{a.match.score}%</Text>
                    <Text style={{ color: themeColors.textSecondary, fontSize: 12, fontWeight: '700' }}>{a.match.label}</Text>
                  </View>
                  {a.match.reasons.length ? (
                    a.match.reasons.map((r) => (
                      <View key={r} style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                        <Icon name="check-circle" size={14} color="#10B981" />
                        <Text style={{ color: themeColors.textPrimary, fontSize: 13, flex: 1 }}>{r}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={{ color: themeColors.textMuted, fontSize: 13, marginTop: 6 }}>Not enough profile information to compare yet.</Text>
                  )}
                  {(p?.skills?.length || 0) > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                      {p!.skills.slice(0, 12).map((sk) => (
                        <View key={sk} style={[styles.chip, { backgroundColor: themeColors.chipBg }]}>
                          <Text style={{ color: themeColors.textSecondary, fontSize: 11, fontWeight: '600' }}>{sk}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </Section>

              {/* Application */}
              <Section title="APPLICATION">
                {a.cover_letter ? (
                  <View style={[styles.card, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border }]}>
                    <Text style={{ color: themeColors.textPrimary, fontSize: 13, lineHeight: 19, fontStyle: 'italic' }}>“{a.cover_letter}”</Text>
                  </View>
                ) : null}
                {questions.map((q) => (
                  <View key={q.id} style={[styles.card, { borderColor: themeColors.border, marginTop: 8 }]}>
                    <Text style={{ color: themeColors.textSecondary, fontSize: 12, fontWeight: '700' }}>{q.label}</Text>
                    <Text style={{ color: themeColors.textPrimary, fontSize: 13, fontWeight: '600', marginTop: 2 }}>{a.answers?.[q.id] || 'No answer'}</Text>
                  </View>
                ))}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  {a.resume_url ? (
                    <TouchableOpacity
                      style={[styles.pillBtn, { borderColor: themeColors.border }]}
                      onPress={() => openResume(a.resume_url!).catch(() => Alert.alert('Could not open the file'))}
                    >
                      <Icon name="file-text" size={14} color={ORANGE} />
                      <Text style={styles.pillBtnText}>Open CV / portfolio</Text>
                    </TouchableOpacity>
                  ) : null}
                  {a.showreel_url ? (
                    <TouchableOpacity
                      style={[styles.pillBtn, { borderColor: themeColors.border }]}
                      onPress={() => Linking.openURL(a.showreel_url!).catch(() => Alert.alert('Could not open the link'))}
                    >
                      <Icon name="film" size={14} color={ORANGE} />
                      <Text style={styles.pillBtnText}>Showreel link</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity style={[styles.pillBtn, { borderColor: themeColors.border }]} onPress={() => onMessage(a)}>
                    <Icon name="message-square" size={14} color={ORANGE} />
                    <Text style={styles.pillBtnText}>Message</Text>
                  </TouchableOpacity>
                </View>
              </Section>

              {/* Interviews */}
              <Section
                title="INTERVIEWS"
                right={
                  <TouchableOpacity style={[styles.pillBtn, { borderColor: themeColors.border, paddingVertical: 5 }]} onPress={() => setShowScheduler((v) => !v)}>
                    <Icon name="calendar" size={13} color={ORANGE} />
                    <Text style={styles.pillBtnText}>Schedule</Text>
                  </TouchableOpacity>
                }
              >
                {showScheduler && (
                  <View style={[styles.card, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, gap: 10 }]}>
                    <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                      {[
                        ['Tomorrow', 1],
                        ['In 2 days', 2],
                        ['Next week', 7],
                      ].map(([lbl, off]) => (
                        <TouchableOpacity
                          key={lbl as string}
                          onPress={() => setIv((v) => ({ ...v, date: dayString(off as number) }))}
                          style={[styles.chip, { backgroundColor: iv.date === dayString(off as number) ? ORANGE : themeColors.chipBg }]}
                        >
                          <Text style={{ color: iv.date === dayString(off as number) ? '#fff' : themeColors.textSecondary, fontSize: 11, fontWeight: '700' }}>{lbl as string}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <View style={{ flex: 1.3 }}>
                        <Text style={[styles.miniLabel, label]}>Date (YYYY-MM-DD)</Text>
                        <TextInput style={field} value={iv.date} onChangeText={(t) => setIv({ ...iv, date: t })} autoCapitalize="none" keyboardType="numbers-and-punctuation" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.miniLabel, label]}>Time (24h)</Text>
                        <TextInput style={field} value={iv.time} onChangeText={(t) => setIv({ ...iv, time: t })} autoCapitalize="none" keyboardType="numbers-and-punctuation" />
                      </View>
                      <View style={{ flex: 0.8 }}>
                        <Text style={[styles.miniLabel, label]}>Minutes</Text>
                        <TextInput style={field} value={iv.duration} onChangeText={(t) => setIv({ ...iv, duration: t.replace(/\D/g, '') })} keyboardType="number-pad" />
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      {(Object.keys(INTERVIEW_MODE_LABELS) as InterviewMode[]).map((m) => (
                        <TouchableOpacity
                          key={m}
                          onPress={() => setIv({ ...iv, mode: m })}
                          style={[styles.stageBtn, { flex: 1, borderColor: iv.mode === m ? ORANGE : themeColors.border, backgroundColor: iv.mode === m ? 'rgba(255,75,51,0.1)' : 'transparent' }]}
                        >
                          <Text style={{ color: iv.mode === m ? ORANGE : themeColors.textSecondary, fontSize: 11, fontWeight: '800' }}>{INTERVIEW_MODE_LABELS[m]}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TextInput
                      style={field}
                      value={iv.location}
                      onChangeText={(t) => setIv({ ...iv, location: t })}
                      placeholder={iv.mode === 'in_person' ? 'Studio address' : 'Meeting link / number'}
                      placeholderTextColor={themeColors.textMuted}
                      autoCapitalize="none"
                    />
                    <TextInput
                      style={[field, { height: 64, paddingTop: 10, textAlignVertical: 'top' }]}
                      value={iv.notes}
                      onChangeText={(t) => setIv({ ...iv, notes: t })}
                      placeholder="Notes for the candidate"
                      placeholderTextColor={themeColors.textMuted}
                      multiline
                    />
                    <TouchableOpacity style={[styles.primaryBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={schedule}>
                      {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>Send invitation</Text>}
                    </TouchableOpacity>
                  </View>
                )}
                {a.interviews.length === 0 && !showScheduler ? (
                  <Text style={{ color: themeColors.textMuted, fontSize: 13 }}>No interviews scheduled yet.</Text>
                ) : null}
                {a.interviews.map((i) => (
                  <View key={i.id} style={[styles.card, { borderColor: themeColors.border, marginTop: 8, flexDirection: 'row', gap: 10, alignItems: 'center' }]}>
                    <View style={styles.ivIcon}>
                      <Icon name={i.mode === 'video' ? 'video' : i.mode === 'call' ? 'phone' : 'map-pin'} size={18} color="#3B82F6" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: themeColors.textPrimary, fontSize: 13, fontWeight: '700' }}>{fmtWhen(i.scheduled_at)} · {i.duration_minutes} min</Text>
                      <Text style={{ color: themeColors.textSecondary, fontSize: 11.5 }} numberOfLines={1}>
                        {INTERVIEW_MODE_LABELS[i.mode]}{i.location ? ` · ${i.location}` : ''}
                      </Text>
                      <Text style={{ fontSize: 10.5, fontWeight: '800', marginTop: 3, letterSpacing: 0.5, color: i.status === 'confirmed' ? '#10B981' : i.status === 'declined' || i.status === 'cancelled' ? '#EF4444' : '#F59E0B' }}>
                        {INTERVIEW_STATUS_LABELS[i.status].toUpperCase()}
                      </Text>
                    </View>
                    <TouchableOpacity
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      onPress={() => addInterviewToCalendar({ title: `Interview: ${name} – ${job.title}`, startsAt: i.scheduled_at, durationMinutes: i.duration_minutes, location: i.location, notes: i.notes })}
                    >
                      <Icon name="calendar" size={18} color={themeColors.textSecondary} />
                    </TouchableOpacity>
                    {(i.status === 'proposed' || i.status === 'confirmed') && (
                      <TouchableOpacity
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        onPress={() => Alert.alert('Cancel this interview?', undefined, [{ text: 'Keep' }, { text: 'Cancel interview', style: 'destructive', onPress: () => run(() => updateInterview(i.id, { status: 'cancelled' })) }])}
                      >
                        <Icon name="trash-2" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </Section>

              {/* Notes */}
              <Section title="TEAM NOTES (PRIVATE)">
                {notes.map((n) => (
                  <View key={n.id} style={[styles.card, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, marginBottom: 8 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: themeColors.textPrimary, fontSize: 12, fontWeight: '700', flex: 1 }} numberOfLines={1}>
                        {n.author?.full_name || n.author?.username || 'Team member'}{' '}
                        <Text style={{ color: themeColors.textMuted, fontWeight: '400' }}>· {new Date(n.created_at).toLocaleDateString()}</Text>
                      </Text>
                      {n.author_id === userId && (
                        <TouchableOpacity onPress={() => run(async () => { await deleteNote(n.id); setNotes(await fetchNotes(a.id)); })}>
                          <Icon name="trash-2" size={14} color={themeColors.textMuted} />
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={{ color: themeColors.textPrimary, fontSize: 13, marginTop: 4 }}>{n.body}</Text>
                  </View>
                ))}
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
                  <TextInput
                    style={[field, { flex: 1, minHeight: 44, maxHeight: 110, paddingTop: 10, textAlignVertical: 'top' }]}
                    value={noteDraft}
                    onChangeText={setNoteDraft}
                    placeholder="Add a note only your team can see…"
                    placeholderTextColor={themeColors.textMuted}
                    maxLength={2000}
                    multiline
                  />
                  <TouchableOpacity style={[styles.primaryBtn, { paddingHorizontal: 18, opacity: busy || !noteDraft.trim() ? 0.5 : 1 }]} disabled={busy || !noteDraft.trim()} onPress={submitNote}>
                    <Text style={styles.primaryBtnText}>Add</Text>
                  </TouchableOpacity>
                </View>
              </Section>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <RejectModal
        visible={rejectOpen}
        name={name}
        onCancel={() => setRejectOpen(false)}
        onConfirm={(reason) => {
          setRejectOpen(false);
          run(() => setApplicationStatus(a.id, 'rejected', reason));
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, overflow: 'hidden' },
  grabber: { width: 42, height: 4, borderRadius: 2, backgroundColor: 'rgba(148,163,184,0.5)', alignSelf: 'center', marginTop: 8 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarFallback: { backgroundColor: 'rgba(255,75,51,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,75,51,0.25)' },
  name: { fontSize: 18, fontWeight: '800' },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.9 },
  stageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stageBtn: { width: '31.5%', borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  pillBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  pillBtnText: { color: ORANGE, fontSize: 12, fontWeight: '800' },
  card: { borderWidth: 1, borderRadius: 16, padding: 12 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, height: 42, fontSize: 13 },
  miniLabel: { fontSize: 10.5, fontWeight: '700', marginBottom: 4 },
  primaryBtn: { backgroundColor: ORANGE, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13.5 },
  ivIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(59,130,246,0.12)', alignItems: 'center', justifyContent: 'center' },
});
