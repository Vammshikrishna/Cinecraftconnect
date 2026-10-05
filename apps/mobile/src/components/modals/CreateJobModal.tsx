import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  TouchableWithoutFeedback,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Icon } from '../common/Icon';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';
import {
  JOB_TYPES,
  JOB_TYPE_LABELS,
  EXPERIENCE_LEVELS,
  EXPERIENCE_LABELS,
  WORK_MODES,
  WORK_MODE_LABELS,
  PAY_PERIODS,
  PAY_PERIOD_LABELS,
  DEPARTMENTS,
  CURRENCIES,
  MAX_SCREENING_QUESTIONS,
  normalizeScreeningQuestions,
  validateJobForm,
  type JobType,
  type ExperienceLevel,
  type WorkMode,
  type PayPeriod,
  type ScreeningQuestion,
} from '@cinecraft/core';

const ORANGE = '#FF4B33';
const BLUE = '#1D72F2';

interface CreateJobModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (newJob: any) => void;
  onCreated?: () => void;
  /** Edit an existing posting or draft. */
  jobToEdit?: any | null;
  /** Start a new posting from an existing one. */
  duplicateFrom?: any | null;
  /** Post as this company page (e.g. when opened from the page itself). */
  defaultPageId?: string | null;
}

interface FormState {
  title: string;
  description: string;
  company: string;
  location: string;
  type: JobType;
  department: string;
  work_mode: WorkMode;
  experience_level: ExperienceLevel;
  requirements: string;
  currency: string;
  salary_min: string;
  salary_max: string;
  pay_period: PayPeriod | '';
  deadline: string; // YYYY-MM-DD (closes at the end of that day)
  shoot_start: string;
  shoot_end: string;
  openings: string;
  auto_close_on_hire: boolean;
  screening_questions: ScreeningQuestion[];
}

const EMPTY: FormState = {
  title: '',
  description: '',
  company: '',
  location: '',
  type: 'full-time',
  department: '',
  work_mode: 'onsite',
  experience_level: 'mid',
  requirements: '',
  currency: 'INR',
  salary_min: '',
  salary_max: '',
  pay_period: '',
  deadline: '',
  shoot_start: '',
  shoot_end: '',
  openings: '1',
  auto_close_on_hire: false,
  screening_questions: [],
};

const pad = (n: number) => String(n).padStart(2, '0');
const toDay = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const fromJob = (j: any): FormState => ({
  title: j.title || '',
  description: j.description || '',
  company: j.company || j.company_pages?.name || '',
  location: j.location || '',
  type: (j.type as JobType) || 'full-time',
  department: j.department || '',
  work_mode: (j.work_mode as WorkMode) || 'onsite',
  experience_level: (j.experience_level as ExperienceLevel) || 'mid',
  requirements: j.requirements || '',
  currency: j.currency || 'INR',
  salary_min: j.salary_min != null ? String(j.salary_min) : '',
  salary_max: j.salary_max != null ? String(j.salary_max) : '',
  pay_period: (j.pay_period as PayPeriod) || '',
  deadline: toDay(j.deadline),
  shoot_start: j.shoot_start || '',
  shoot_end: j.shoot_end || '',
  openings: String(j.openings ?? 1),
  auto_close_on_hire: !!j.auto_close_on_hire,
  screening_questions: normalizeScreeningQuestions(j.screening_questions),
});

export const CreateJobModal: React.FC<CreateJobModalProps> = ({ visible, onClose, onSuccess, onCreated, jobToEdit, duplicateFrom, defaultPageId }) => {
  const { themeColors } = useUserSettings();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedPageId, setSelectedPageId] = useState<string>('user');
  const [myPages, setMyPages] = useState<any[]>([]);
  const [saving, setSaving] = useState<'draft' | 'publish' | null>(null);

  const source = jobToEdit || duplicateFrom;
  const isEditing = !!jobToEdit?.id;
  const editingDraft = isEditing && !!jobToEdit?.is_draft;

  // Pages this person can post for (owner, admin or team member), loaded each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const supabase = getSupabaseClient() as any;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const [{ data: owned }, { data: member }, { data: admin }] = await Promise.all([
          supabase.from('company_pages').select('id').eq('owner_id', user.id),
          supabase.from('company_page_members').select('page_id').eq('user_id', user.id),
          supabase.from('company_page_admins').select('page_id').eq('user_id', user.id),
        ]);
        const ids = Array.from(new Set([...(owned || []).map((p: any) => p.id), ...(member || []).map((p: any) => p.page_id), ...(admin || []).map((p: any) => p.page_id)]));
        if (!ids.length) return setMyPages([]);
        const { data } = await supabase.from('company_pages').select('id, name, logo_url').in('id', ids);
        setMyPages(data || []);
      } catch {}
    })();
  }, [visible]);

  // (Re)load the form every time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setErrors({});
    if (source) {
      const f = fromJob(source);
      if (duplicateFrom && !jobToEdit) {
        f.title = `${f.title} (copy)`;
        f.deadline = '';
      }
      setForm(f);
      setSelectedPageId(source.page_id || 'user');
    } else {
      setForm(EMPTY);
      setSelectedPageId(defaultPageId || 'user');
    }
  }, [visible, source?.id, defaultPageId]);

  // when opened for a page, fill in the company name once the page list has loaded
  useEffect(() => {
    if (!visible || source || !defaultPageId) return;
    const page = myPages.find((p) => p.id === defaultPageId);
    if (page) setForm((prev) => (prev.company ? prev : { ...prev, company: page.name }));
  }, [visible, myPages, defaultPageId]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const choosePage = (id: string) => {
    setSelectedPageId(id);
    if (id !== 'user') {
      const page = myPages.find((p) => p.id === id);
      if (page) set('company', page.name);
    }
  };

  const addQuestion = () => {
    if (form.screening_questions.length >= MAX_SCREENING_QUESTIONS) return;
    set('screening_questions', [...form.screening_questions, { id: `q${Date.now().toString(36)}`, label: '', type: 'text', required: true }]);
  };
  const updateQuestion = (id: string, patch: Partial<ScreeningQuestion>) =>
    set('screening_questions', form.screening_questions.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  const removeQuestion = (id: string) => set('screening_questions', form.screening_questions.filter((q) => q.id !== id));

  // The deadline is a whole day: applications stay open until the end of it.
  const deadlineIso = () => (form.deadline && DATE_RE.test(form.deadline) ? new Date(`${form.deadline}T23:59:00`).toISOString() : null);

  const buildPayload = (asDraft: boolean) => ({
    title: form.title.trim(),
    description: form.description.trim(),
    company: form.company.trim(),
    location: form.location.trim() || null,
    type: form.type,
    department: form.department || null,
    work_mode: form.work_mode,
    experience_level: form.experience_level,
    requirements: form.requirements.trim() || null,
    currency: form.currency || 'INR',
    salary_min: form.salary_min !== '' ? Number(form.salary_min) : null,
    salary_max: form.salary_max !== '' ? Number(form.salary_max) : null,
    pay_period: form.salary_min !== '' || form.salary_max !== '' ? form.pay_period || null : null,
    deadline: deadlineIso(),
    shoot_start: DATE_RE.test(form.shoot_start) ? form.shoot_start : null,
    shoot_end: DATE_RE.test(form.shoot_end) ? form.shoot_end : null,
    openings: Math.max(1, Math.min(500, parseInt(form.openings || '1', 10) || 1)),
    screening_questions: normalizeScreeningQuestions(form.screening_questions),
    auto_close_on_hire: form.auto_close_on_hire,
    page_id: selectedPageId === 'user' ? null : selectedPageId,
    is_draft: asDraft,
    // a draft is never visible; publishing (re)opens the posting
    is_active: !asDraft,
  });

  const save = async (asDraft: boolean) => {
    const found = validateJobForm(
      {
        title: form.title,
        company: form.company,
        description: form.description,
        salary_min: form.salary_min !== '' ? Number(form.salary_min) : null,
        salary_max: form.salary_max !== '' ? Number(form.salary_max) : null,
        pay_period: form.pay_period || null,
        deadline: deadlineIso(),
        shoot_start: DATE_RE.test(form.shoot_start) ? form.shoot_start : null,
        shoot_end: DATE_RE.test(form.shoot_end) ? form.shoot_end : null,
        openings: parseInt(form.openings || '1', 10),
      },
      asDraft
    );
    if (form.deadline && !DATE_RE.test(form.deadline)) found.deadline = 'Use the format 2026-12-31';
    if (form.shoot_start && !DATE_RE.test(form.shoot_start)) found.shoot_start = 'Use the format 2026-12-31';
    if (form.shoot_end && !DATE_RE.test(form.shoot_end)) found.shoot_end = 'Use the format 2026-12-31';
    if (form.screening_questions.some((q) => !q.label.trim())) found.screening = 'Every screening question needs some text (or remove it).';
    if (form.screening_questions.some((q) => q.type === 'choice' && (q.options || []).filter(Boolean).length < 2)) {
      found.screening = 'A multiple-choice question needs at least two options.';
    }
    setErrors(found);
    const first = Object.values(found)[0];
    if (first) {
      Alert.alert('Please fix the highlighted fields', first);
      return;
    }

    setSaving(asDraft ? 'draft' : 'publish');
    try {
      const supabase = getSupabaseClient() as any;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('Please sign in to post a job.');
      const payload = buildPayload(asDraft);
      let saved: any;
      if (isEditing) {
        const { data, error } = await supabase.from('jobs').update(payload).eq('id', jobToEdit.id).select().single();
        if (error) throw error;
        saved = data;
      } else {
        const { data, error } = await supabase.from('jobs').insert({ ...payload, posted_by: user.id }).select().single();
        if (error) throw error;
        saved = data;
      }
      onSuccess?.(saved);
      onCreated?.();
      onClose();
      Alert.alert(
        asDraft ? 'Draft saved' : isEditing && !editingDraft ? 'Job updated' : 'Job published',
        asDraft ? 'Only you can see it until you publish.' : 'Your posting is live.'
      );
    } catch (e: any) {
      Alert.alert('Could not save the job', e?.message || 'Please try again.');
    } finally {
      setSaving(null);
    }
  };

  const T = themeColors;
  const inputStyle = (err?: string) => [styles.input, { backgroundColor: T.inputBg, borderColor: err ? '#EF4444' : T.border, color: T.textPrimary }];
  const Label = ({ text, err }: { text: string; err?: string }) => (
    <Text style={[styles.label, { color: err ? '#EF4444' : T.textSecondary }]}>{text}{err ? `  ·  ${err}` : ''}</Text>
  );
  const Chip = ({ on, label, onPress, color = ORANGE }: { on: boolean; label: string; onPress: () => void; color?: string }) => (
    <TouchableOpacity style={[styles.chip, { backgroundColor: on ? color : T.inputBg, borderColor: on ? color : T.border }]} onPress={onPress}>
      <Text style={[styles.chipText, { color: on ? '#FFFFFF' : T.textPrimary }]}>{on ? '✓ ' : ''}{label}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ maxHeight: '92%' }}>
              <View style={[styles.modalContent, { backgroundColor: T.bgCard }]}>
                <View style={[styles.handleBar, { backgroundColor: T.border }]} />
                <View style={styles.headerRow}>
                  <Text style={[styles.title, { color: T.textPrimary }]}>
                    {isEditing ? (editingDraft ? 'Finish your draft' : 'Edit job') : duplicateFrom ? 'Duplicate job' : 'Post a Crew Opening'}
                  </Text>
                  <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Icon name="x" size={20} color={T.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 24 }}>
                  {/* The role */}
                  <Label text="POST JOB AS" />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                    <TouchableOpacity
                      style={[styles.pageChip, { backgroundColor: selectedPageId === 'user' ? ORANGE : T.inputBg, borderColor: selectedPageId === 'user' ? ORANGE : T.border }]}
                      onPress={() => choosePage('user')}
                    >
                      <Icon name="user" size={14} color={selectedPageId === 'user' ? '#FFFFFF' : T.textPrimary} />
                      <Text style={[styles.pageChipText, { color: selectedPageId === 'user' ? '#FFFFFF' : T.textPrimary }]}>Personal Identity</Text>
                    </TouchableOpacity>
                    {myPages.map((page) => {
                      const on = selectedPageId === page.id;
                      return (
                        <TouchableOpacity
                          key={page.id}
                          style={[styles.pageChip, { backgroundColor: on ? BLUE : T.inputBg, borderColor: on ? BLUE : T.border }]}
                          onPress={() => choosePage(page.id)}
                        >
                          <Icon name="company" size={14} color={on ? '#FFFFFF' : T.textPrimary} />
                          <Text style={[styles.pageChipText, { color: on ? '#FFFFFF' : T.textPrimary }]}>{page.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <Label text="ROLE / JOB TITLE *" err={errors.title} />
                  <TextInput style={inputStyle(errors.title)} placeholder="e.g. Lead Focus Puller / 1st AC" placeholderTextColor={T.textMuted} value={form.title} onChangeText={(v) => set('title', v)} />

                  <Label text="PRODUCTION / STUDIO NAME *" err={errors.company} />
                  <TextInput style={inputStyle(errors.company)} placeholder="e.g. Geetha Arts" placeholderTextColor={T.textMuted} value={form.company} onChangeText={(v) => set('company', v)} />

                  <Label text="DEPARTMENT" />
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {DEPARTMENTS.map((d) => (
                        <Chip key={d} on={form.department === d} label={d} onPress={() => set('department', form.department === d ? '' : d)} color={BLUE} />
                      ))}
                    </View>
                  </ScrollView>

                  <Label text="JOB TYPE *" />
                  <View style={styles.chipGrid}>
                    {JOB_TYPES.map((t) => <Chip key={t} on={form.type === t} label={JOB_TYPE_LABELS[t]} onPress={() => set('type', t)} />)}
                  </View>

                  <Label text="EXPERIENCE LEVEL" />
                  <View style={styles.chipGrid}>
                    {EXPERIENCE_LEVELS.map((l) => <Chip key={l} on={form.experience_level === l} label={EXPERIENCE_LABELS[l]} onPress={() => set('experience_level', l)} color={BLUE} />)}
                  </View>

                  <Label text="WHERE" />
                  <View style={styles.chipGrid}>
                    {WORK_MODES.map((m) => <Chip key={m} on={form.work_mode === m} label={WORK_MODE_LABELS[m]} onPress={() => set('work_mode', m)} color={BLUE} />)}
                  </View>

                  <Label text="LOCATION / CITY" />
                  <TextInput style={inputStyle()} value={form.location} onChangeText={(v) => set('location', v)} placeholder="e.g. Hyderabad, Telangana" placeholderTextColor={T.textMuted} />

                  {/* Pay */}
                  <Label text="CURRENCY" />
                  <View style={styles.chipGrid}>
                    {CURRENCIES.map((c: any) => {
                      const code = typeof c === 'string' ? c : c.code;
                      return <Chip key={code} on={form.currency === code} label={code} onPress={() => set('currency', code)} color={BLUE} />;
                    })}
                  </View>
                  <View style={styles.rowTwoCol}>
                    <View style={{ flex: 1 }}>
                      <Label text="MIN PAY" err={errors.salary_min} />
                      <TextInput style={inputStyle(errors.salary_min)} placeholder="e.g. 50000" placeholderTextColor={T.textMuted} keyboardType="numeric" value={form.salary_min} onChangeText={(v) => set('salary_min', v.replace(/[^\d.]/g, ''))} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Label text="MAX PAY" err={errors.salary_max} />
                      <TextInput style={inputStyle(errors.salary_max)} placeholder="e.g. 150000" placeholderTextColor={T.textMuted} keyboardType="numeric" value={form.salary_max} onChangeText={(v) => set('salary_max', v.replace(/[^\d.]/g, ''))} />
                    </View>
                  </View>
                  <Label text="PAID" err={errors.pay_period} />
                  <View style={styles.chipGrid}>
                    {PAY_PERIODS.map((p) => <Chip key={p} on={form.pay_period === p} label={PAY_PERIOD_LABELS[p]} onPress={() => set('pay_period', form.pay_period === p ? '' : p)} color={BLUE} />)}
                  </View>

                  {/* Schedule */}
                  <View style={styles.rowTwoCol}>
                    <View style={{ flex: 1 }}>
                      <Label text="SHOOT STARTS" err={errors.shoot_start} />
                      <TextInput style={inputStyle(errors.shoot_start)} placeholder="YYYY-MM-DD" placeholderTextColor={T.textMuted} autoCapitalize="none" keyboardType="numbers-and-punctuation" value={form.shoot_start} onChangeText={(v) => set('shoot_start', v)} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Label text="SHOOT ENDS" err={errors.shoot_end} />
                      <TextInput style={inputStyle(errors.shoot_end)} placeholder="YYYY-MM-DD" placeholderTextColor={T.textMuted} autoCapitalize="none" keyboardType="numbers-and-punctuation" value={form.shoot_end} onChangeText={(v) => set('shoot_end', v)} />
                    </View>
                  </View>
                  <View style={styles.rowTwoCol}>
                    <View style={{ flex: 1.4 }}>
                      <Label text="APPLY BY" err={errors.deadline} />
                      <TextInput style={inputStyle(errors.deadline)} placeholder="YYYY-MM-DD (optional)" placeholderTextColor={T.textMuted} autoCapitalize="none" keyboardType="numbers-and-punctuation" value={form.deadline} onChangeText={(v) => set('deadline', v)} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Label text="OPENINGS" err={errors.openings} />
                      <TextInput style={inputStyle(errors.openings)} keyboardType="number-pad" value={form.openings} onChangeText={(v) => set('openings', v.replace(/\D/g, ''))} />
                    </View>
                  </View>

                  <Label text="JOB DESCRIPTION *" err={errors.description} />
                  <TextInput style={[...inputStyle(errors.description), styles.textArea]} placeholder="Describe the role, responsibilities and shooting schedule..." placeholderTextColor={T.textMuted} value={form.description} onChangeText={(v) => set('description', v)} multiline />

                  <Label text="REQUIREMENTS & QUALIFICATIONS" />
                  <TextInput style={[...inputStyle(), styles.textArea]} placeholder="Camera systems, licences, equipment experience, portfolio..." placeholderTextColor={T.textMuted} value={form.requirements} onChangeText={(v) => set('requirements', v)} multiline />

                  {/* Screening questions */}
                  <View style={styles.qHead}>
                    <Label text={`SCREENING QUESTIONS (${form.screening_questions.length}/${MAX_SCREENING_QUESTIONS})`} err={errors.screening} />
                    {form.screening_questions.length < MAX_SCREENING_QUESTIONS && (
                      <TouchableOpacity onPress={addQuestion} style={styles.addQ}>
                        <Icon name="plus" size={13} color={ORANGE} />
                        <Text style={{ color: ORANGE, fontSize: 12, fontWeight: '800' }}>Add</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {form.screening_questions.map((q) => (
                    <View key={q.id} style={[styles.qCard, { borderColor: T.border, backgroundColor: T.inputBg }]}>
                      <TextInput style={[styles.qInput, { color: T.textPrimary, borderColor: T.border }]} placeholder="Ask something quick (e.g. Do you own a camera kit?)" placeholderTextColor={T.textMuted} value={q.label} onChangeText={(v) => updateQuestion(q.id, { label: v })} maxLength={200} />
                      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                        {(['text', 'yesno', 'choice'] as const).map((t) => (
                          <Chip key={t} on={q.type === t} label={t === 'text' ? 'Short answer' : t === 'yesno' ? 'Yes / No' : 'Choice'} onPress={() => updateQuestion(q.id, { type: t, options: t === 'choice' ? q.options || ['', ''] : undefined })} color={BLUE} />
                        ))}
                        <TouchableOpacity style={{ marginLeft: 'auto' }} onPress={() => removeQuestion(q.id)}>
                          <Icon name="trash-2" size={16} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                      {q.type === 'choice' && (
                        <TextInput
                          style={[styles.qInput, { color: T.textPrimary, borderColor: T.border, marginTop: 8 }]}
                          placeholder="Options, separated by commas"
                          placeholderTextColor={T.textMuted}
                          value={(q.options || []).join(', ')}
                          onChangeText={(v) => updateQuestion(q.id, { options: v.split(',').map((o) => o.trim()) })}
                        />
                      )}
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 }}>
                        <Switch value={q.required} onValueChange={(v) => updateQuestion(q.id, { required: v })} trackColor={{ false: '#767577', true: ORANGE }} thumbColor="#FFFFFF" />
                        <Text style={{ color: T.textSecondary, fontSize: 12 }}>Required</Text>
                      </View>
                    </View>
                  ))}

                  <View style={[styles.switchRow, { backgroundColor: T.inputBg, borderColor: T.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.switchTitle, { color: T.textPrimary }]}>Auto-close when filled</Text>
                      <Text style={[styles.switchSub, { color: T.textSecondary }]}>Automatically close this listing when an applicant is hired.</Text>
                    </View>
                    <Switch value={form.auto_close_on_hire} onValueChange={(v) => set('auto_close_on_hire', v)} trackColor={{ false: '#767577', true: ORANGE }} thumbColor="#FFFFFF" />
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                    {(!isEditing || editingDraft) && (
                      <TouchableOpacity style={[styles.draftBtn, { borderColor: T.border }, !!saving && styles.btnDisabled]} disabled={!!saving} onPress={() => save(true)}>
                        {saving === 'draft' ? <ActivityIndicator size="small" color={ORANGE} /> : <Text style={[styles.draftBtnText, { color: T.textPrimary }]}>Save draft</Text>}
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity style={[styles.postBtn, !!saving && styles.btnDisabled]} disabled={!!saving} onPress={() => save(false)} activeOpacity={0.85}>
                      {saving === 'publish' ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.postBtnText}>{isEditing && !editingDraft ? 'Save changes' : 'Publish job'}</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 10 },
  handleBar: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  title: { fontSize: 18, fontWeight: '800' },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginBottom: 6, marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, marginBottom: 10 },
  textArea: { height: 90, textAlignVertical: 'top' },
  pageChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  pageChipText: { fontSize: 12, fontWeight: '700' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  chipText: { fontSize: 11.5, fontWeight: '700' },
  rowTwoCol: { flexDirection: 'row', gap: 10 },
  qHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  addQ: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4 },
  qCard: { borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 8 },
  qInput: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, fontSize: 13 },
  switchRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1, marginVertical: 10, gap: 12 },
  switchTitle: { fontSize: 13, fontWeight: '700' },
  switchSub: { fontSize: 11, marginTop: 2 },
  draftBtn: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  draftBtnText: { fontSize: 13.5, fontWeight: '800' },
  postBtn: { flex: 1.4, backgroundColor: ORANGE, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  postBtnText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '800' },
  btnDisabled: { opacity: 0.6 },
});

export default CreateJobModal;
