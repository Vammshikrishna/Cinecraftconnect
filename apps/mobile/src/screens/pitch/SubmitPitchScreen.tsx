import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  InteractionManager,
  Linking,
} from 'react-native';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { isTabletDevice } from '../../utils/pageType';
import { TabletContainer } from '../../components/common/TabletContainer';
import { useUserSettings } from '../../hooks/useUserSettings';
import { getSupabaseClient } from '@cinecraft/api';
import { createDirectPitchCall, friendlyError, canSubmitPitch } from '@cinecraft/core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { pitchDraftKey, canEditPitch } from '@cinecraft/core';
import DocumentPicker from 'react-native-document-picker';
import {
  newSubmissionId, checkPitchAttachment, uploadPitchAttachment, removePitchAttachment, attachmentLabel, signPitchAttachment, PITCH_ATTACHMENT_MAX,
} from '@cinecraft/core';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

export const SubmitPitchScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  const { themeColors, isDark } = useUserSettings();
  const { pitchId, pitchTitle, targetProducerId, targetProducerName, editSubmissionId } = route.params || {};
  const [pitchCall, setPitchCall] = useState<any>(null);
  const [targetProducer, setTargetProducer] = useState<any>(null);
  const [loadingCall, setLoadingCall] = useState(true);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [logline, setLogline] = useState('');
  const [shortSynopsis, setShortSynopsis] = useState('');
  const [fullSynopsis, setFullSynopsis] = useState('');
  const [genre, setGenre] = useState('');
  const [language, setLanguage] = useState('Hindi');
  const [tone, setTone] = useState('');
  const [whyFits, setWhyFits] = useState('');

  // Legal & IP State
  const [guildRegNum, setGuildRegNum] = useState('');
  const [copyrightNum, setCopyrightNum] = useState('');
  const [rightsOwned, setRightsOwned] = useState(true);
  const [isOriginalWork, setIsOriginalWork] = useState(true);

  // NDA & Attachments
  const [treatmentUrl, setTreatmentUrl] = useState('');
  const [lookbookUrl, setLookbookUrl] = useState('');
  const [ndaSignature, setNdaSignature] = useState('');

  // editing a sent pitch (until the producer starts to review it) and the unfinished-form draft
  const [editing, setEditing] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const draftKeyRef = React.useRef<string | null>(null);

  // private file attachments (PDF / images), up to 3
  const [submissionId] = useState(() => newSubmissionId());
  const [attachmentPaths, setAttachmentPaths] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  const addAttachment = async () => {
    try {
      const file = await DocumentPicker.pickSingle({ type: [DocumentPicker.types.pdf, DocumentPicker.types.images] });
      const problem = checkPitchAttachment({ name: file.name || '', size: file.size }, attachmentPaths.length);
      if (problem) { Alert.alert('Cannot attach this file', problem); return; }
      setUploading(true);
      const supabase = getSupabaseClient();
      const { data: { user: me } } = await supabase.auth.getUser();
      if (!me) throw new Error('Sign in first');
      const body = await (await fetch(file.uri)).arrayBuffer();
      const ref = await uploadPitchAttachment(supabase, me.id, editSubmissionId || submissionId, body, file.name || 'file.pdf', attachmentPaths.length + 1);
      setAttachmentPaths((p) => [...p, ref]);
    } catch (e: any) {
      if (!DocumentPicker.isCancel(e)) Alert.alert('Upload failed', friendlyError(e, 'Please try again.'));
    } finally {
      setUploading(false);
    }
  };
  const dropAttachment = (ref: string) => {
    setAttachmentPaths((p) => p.filter((x) => x !== ref));
    removePitchAttachment(getSupabaseClient(), ref);
  };
  const openAttachment = async (ref: string) => {
    try { await Linking.openURL(await signPitchAttachment(getSupabaseClient(), ref)); } catch { Alert.alert('Could not open the file'); }
  };

  const draftReady = !loadingCall && !editing && !!draftKeyRef.current;
  useEffect(() => {
    if (!draftReady) return;
    const t = setTimeout(() => {
      const key = draftKeyRef.current;
      if (!key) return;
      if (!title && !logline && !shortSynopsis && !fullSynopsis) { AsyncStorage.removeItem(key).catch(() => { }); return; }
      AsyncStorage.setItem(key, JSON.stringify({ title, logline, shortSynopsis, fullSynopsis, genre, language, tone, whyFits, guildRegNum, copyrightNum, treatmentUrl, lookbookUrl, step })).catch(() => { });
    }, 600);
    return () => clearTimeout(t);
  }, [draftReady, title, logline, shortSynopsis, fullSynopsis, genre, language, tone, whyFits, guildRegNum, copyrightNum, treatmentUrl, lookbookUrl, step]);

  const discardDraft = () => {
    if (draftKeyRef.current) AsyncStorage.removeItem(draftKeyRef.current).catch(() => { });
    setTitle(''); setLogline(''); setShortSynopsis(''); setFullSynopsis(''); setTone(''); setWhyFits('');
    setGuildRegNum(''); setCopyrightNum(''); setTreatmentUrl(''); setLookbookUrl(''); setNdaSignature('');
    setStep(1); setDraftRestored(false);
  };

  useEffect(() => {
    const fetchCall = async () => {
      const isDirectMode = pitchId === 'direct' || !!targetProducerId;
      const supabase = getSupabaseClient();
      const { data: { user: me } } = await supabase.auth.getUser();
      draftKeyRef.current = editSubmissionId ? null : pitchDraftKey(me?.id, isDirectMode ? `direct:${targetProducerId || route.params?.to || ''}` : String(pitchId || ''));
      const restoreDraft = async () => {
        if (!draftKeyRef.current) return;
        try {
          const raw = await AsyncStorage.getItem(draftKeyRef.current);
          if (!raw) return;
          const d = JSON.parse(raw);
          setTitle(d.title || ''); setLogline(d.logline || ''); setShortSynopsis(d.shortSynopsis || ''); setFullSynopsis(d.fullSynopsis || '');
          if (d.genre) setGenre(d.genre);
          if (d.language) setLanguage(d.language);
          setTone(d.tone || ''); setWhyFits(d.whyFits || ''); setGuildRegNum(d.guildRegNum || ''); setCopyrightNum(d.copyrightNum || '');
          setTreatmentUrl(d.treatmentUrl || ''); setLookbookUrl(d.lookbookUrl || '');
          if (d.step) setStep(Math.min(3, Math.max(1, Number(d.step) || 1)));
          setDraftRestored(true);
        } catch { /* a broken draft is ignored */ }
      };

      if (isDirectMode) {
        const pId = targetProducerId || route.params?.to;
        if (pId) {
          try {
            const { data: producer } = await supabase
              .from('profiles')
              .select('id, full_name, avatar_url, craft')
              .eq('id', pId)
              .single();

            if (producer) {
              setTargetProducer(producer);
              setPitchCall({
                id: null,
                title: `Direct Pitch to ${producer.full_name}`,
                requirement_description: `Direct private screenplay pitch delivered directly to ${producer.full_name}.`,
                creator_id: producer.id,
              });
            }
          } catch (e) {
            console.warn('[SubmitPitch] Error fetching producer:', e);
          }
        }
        await restoreDraft();
        setLoadingCall(false);
        return;
      }

      if (!pitchId) {
        setLoadingCall(false);
        return;
      }

      try {
        const { data } = await (supabase.from('pitch_calls') as any)
          .select(`*, profiles:creator_id (full_name, avatar_url, craft)`)
          .eq('id', pitchId)
          .single();

        if (data) {
          setPitchCall(data);
          setGenre((data.genre || [])[0] || 'Drama');
          if (editSubmissionId && me) {
            const { data: mine } = await (supabase.from('pitch_submissions') as any).select('*').eq('id', editSubmissionId).eq('submitter_id', me.id).single();
            if (!mine || !canEditPitch(mine.status)) {
              Alert.alert('This pitch can no longer be edited', 'The producer has started to review it.');
              navigation.goBack();
              return;
            }
            setEditing(true);
            setTitle(mine.title || ''); setLogline(mine.logline || ''); setShortSynopsis(mine.short_synopsis || ''); setFullSynopsis(mine.full_synopsis || '');
            if (mine.genre) setGenre(mine.genre);
            if (mine.language) setLanguage(mine.language);
            setTone(mine.tone || ''); setWhyFits(mine.why_fits || '');
            setRightsOwned(!!mine.rights_owned); setIsOriginalWork(!!mine.is_original_work);
            setTreatmentUrl(mine.treatment_url || ''); setLookbookUrl(mine.lookbook_url || '');
            setAttachmentPaths(Array.isArray(mine.attachment_paths) ? mine.attachment_paths : []);
            try {
              const g = JSON.parse(mine.guild_registration_number || '{}');
              setGuildRegNum(g.swa_registration_number || ''); setCopyrightNum(g.copyright_registration_number || '');
            } catch { /* older format */ }
          } else {
            await restoreDraft();
          }
        }
      } catch (e) {
        console.warn('[SubmitPitch] Error:', e);
      } finally {
        setLoadingCall(false);
      }
    };
    const task = InteractionManager.runAfterInteractions(() => {
      fetchCall();
    });
    return () => task.cancel();
  }, [pitchId, targetProducerId, editSubmissionId]);

  const handleNextStep = () => {
    if (step === 1) {
      if (!title.trim() || !logline.trim() || !shortSynopsis.trim()) {
        Alert.alert('Validation Error', 'Pitch title, logline, and short synopsis are required.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!rightsOwned || !isOriginalWork) {
        Alert.alert('Legal Declaration', 'You must declare that you own the rights and this is your original work.');
        return;
      }
      setStep(3);
    }
  };

  const handleSubmitPitch = async () => {
    // a direct pitch always needs the NDA signature (the database enforces it too)
    const isNdaRequired = !editing && (!!pitchCall?.nda_required || pitchId === 'direct' || !!targetProducerId || !!targetProducer?.id);
    if (isNdaRequired && ndaSignature.trim().length < 3) {
      Alert.alert('NDA Signature Required', 'Please type your full legal name to e-sign the non-disclosure agreement.');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = getSupabaseClient();
      if (editing && editSubmissionId) {
        const { error: updateError } = await (supabase.from('pitch_submissions') as any).update({
          title: title.trim(), logline: logline.trim(), short_synopsis: shortSynopsis.trim(), full_synopsis: fullSynopsis.trim() || null,
          genre: genre || null, language: language || null, tone: tone.trim() || null, why_fits: whyFits.trim() || null,
          rights_owned: rightsOwned, is_original_work: isOriginalWork, treatment_url: treatmentUrl.trim() || null, lookbook_url: lookbookUrl.trim() || null,
          guild_registration_number: JSON.stringify({ swa_registration_number: guildRegNum.trim(), copyright_registration_number: copyrightNum.trim() }),
          attachment_paths: attachmentPaths,
        }).eq('id', editSubmissionId);
        if (updateError) throw updateError;
        // leave the form at once; the message is a toast and its button would only run after it fades (a second tap could resubmit)
        navigation.goBack();
        Alert.alert('Pitch updated', 'Your changes were saved.');
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Authentication', 'Please sign in to submit pitches.');
        return;
      }
      // The shared rule (same as the web): fans never, creators always, studios only with a writer-side craft. The database checks it too.
      const { data: me } = await (supabase.from('profiles') as any).select('craft, account_type').eq('id', user.id).maybeSingle();
      if (!canSubmitPitch(me?.craft, me?.account_type)) {
        Alert.alert('Not available for your account', 'Pitches can be submitted by writers, directors and creators. Your account type or craft does not allow it.');
        return;
      }

      const guildData = {
        swa_registration_number: guildRegNum.trim(),
        copyright_registration_number: copyrightNum.trim(),
      };

      const isDirectMode = pitchId === 'direct' || !!targetProducerId || !!targetProducer?.id;
      const targetId = targetProducerId || targetProducer?.id || pitchCall?.creator_id;

      let targetCallId = pitchId;

      if (isDirectMode && targetId) {
        // the database creates the private brief (and checks blocks and the daily limit)
        try {
          targetCallId = await createDirectPitchCall(supabase, targetId, title.trim(), targetProducer?.full_name);
        } catch (err: any) {
          Alert.alert('Could not send the direct pitch', friendlyError(err, 'Please try again.'));
          return;
        }
      }

      const payload: any = {
        id: submissionId,
        attachment_paths: attachmentPaths,
        pitch_call_id: targetCallId,
        submitter_id: user.id,
        title: title.trim(),
        logline: logline.trim(),
        short_synopsis: shortSynopsis.trim(),
        full_synopsis: fullSynopsis.trim() || null,
        genre: genre || 'Drama',
        language: language,
        tone: tone.trim() || null,
        why_fits: whyFits.trim() || null,
        rights_owned: rightsOwned,
        is_original_work: isOriginalWork,
        treatment_url: treatmentUrl.trim() || null,
        lookbook_url: lookbookUrl.trim() || null,
        guild_registration_number: JSON.stringify(guildData),
        nda_signature: ndaSignature.trim() || null,
        attachments: {
          target_producer_id: targetId,
          is_direct_pitch: isDirectMode,
        },
      };

      const { error } = await (supabase.from('pitch_submissions') as any).insert(payload);

      if (error) {
        if (error.code === '23505') {
          Alert.alert('Already Submitted', 'You have already submitted a pitch to this call or producer.');
        } else {
          throw error;
        }
        return;
      }

      if (draftKeyRef.current) AsyncStorage.removeItem(draftKeyRef.current).catch(() => { });
      // leave the form at once so it cannot be submitted twice while the message is still showing
      navigation.goBack();
      Alert.alert('Pitch Submitted! 🎬', 'Your pitch has been securely encrypted and submitted to the call creator.');
    } catch (err: any) {
      Alert.alert('Error', friendlyError(err, 'Could not submit pitch.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingCall) {
    return (
      <View style={{ flex: 1, backgroundColor: themeColors.bgScreen }}>
        <Header title="Submit Script Pitch" showLogo={false} onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ORANGE} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bgScreen }]}>
      <Header
        title="Submit Script Pitch"
        showLogo={false}
        onBack={() => navigation.goBack()}
      />

      {draftRestored && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, margin: 12, marginBottom: 0, padding: 10, borderRadius: 12, backgroundColor: '#FEF3C7' }}>
          <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: '#B45309' }}>We restored the draft you started on this phone.</Text>
          <TouchableOpacity onPress={discardDraft} accessibilityRole="button" accessibilityLabel="Start over"><Text style={{ fontSize: 12, fontWeight: '700', color: '#B45309', textDecorationLine: 'underline' }}>Start over</Text></TouchableOpacity>
        </View>
      )}
      {editing && (
        <View style={{ margin: 12, marginBottom: 0, padding: 10, borderRadius: 12, backgroundColor: '#FFF1EE' }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: ORANGE }}>Editing your pitch. You can change it until the producer starts to review it.</Text>
        </View>
      )}

      {/* Step Indicator Header */}
      <View
        style={[
          styles.stepHeader,
          { backgroundColor: themeColors.bgCard, borderBottomColor: themeColors.border },
        ]}
      >
        {[
          { num: 1, label: 'Story' },
          { num: 2, label: 'Legal & IP' },
          { num: 3, label: 'NDA & Attachments' },
        ].map((s) => (
          <View key={s.num} style={styles.stepItem}>
            <View
              style={[
                styles.stepCircle,
                { backgroundColor: isDark ? themeColors.chipBg : '#F1F5F9' },
                step >= s.num && styles.stepCircleActive,
              ]}
            >
              <Text
                style={[
                  styles.stepNum,
                  { color: themeColors.textSecondary },
                  step >= s.num && styles.stepNumActive,
                ]}
              >
                {s.num}
              </Text>
            </View>
            <Text
              style={[
                styles.stepLabelText,
                { color: themeColors.textMuted },
                step === s.num && styles.stepLabelActive,
              ]}
            >
              {s.label}
            </Text>
          </View>
        ))}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.formContent} contentContainerStyle={{ paddingBottom: isTabletDevice ? 64 : 32 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TabletContainer maxWidth={720}>
            {step === 1 && (
              <View>
                <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>1. Pitch Story Details</Text>

                <Text style={[styles.label, { color: themeColors.textMuted }]}>PITCH / CONCEPT TITLE *</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: themeColors.inputBg,
                      borderColor: themeColors.border,
                      color: themeColors.textPrimary,
                    },
                  ]}
                  placeholder="e.g. Tumbbad: Dark Folk Horror Concept"
                  placeholderTextColor={themeColors.textMuted}
                  value={title}
                  onChangeText={setTitle}
                />

                <Text style={[styles.label, { color: themeColors.textMuted }]}>LOGLINE (ONE SENTENCE HOOK) *</Text>
                <TextInput
                  style={[
                    styles.input,
                    styles.textareaShort,
                    {
                      backgroundColor: themeColors.inputBg,
                      borderColor: themeColors.border,
                      color: themeColors.textPrimary,
                    },
                  ]}
                  placeholder="When a young archaeologist unlocks a cursed temple..."
                  placeholderTextColor={themeColors.textMuted}
                  multiline
                  numberOfLines={2}
                  value={logline}
                  onChangeText={setLogline}
                />

                <Text style={[styles.label, { color: themeColors.textMuted }]}>SHORT SYNOPSIS *</Text>
                <TextInput
                  style={[
                    styles.input,
                    styles.textarea,
                    {
                      backgroundColor: themeColors.inputBg,
                      borderColor: themeColors.border,
                      color: themeColors.textPrimary,
                    },
                  ]}
                  placeholder="Overview of core plot, central conflict, and protagonist journey..."
                  placeholderTextColor={themeColors.textMuted}
                  multiline
                  numberOfLines={4}
                  value={shortSynopsis}
                  onChangeText={setShortSynopsis}
                />

                <Text style={[styles.label, { color: themeColors.textMuted }]}>FULL SYNOPSIS (PROTECTED)</Text>
                <TextInput
                  style={[
                    styles.input,
                    styles.textarea,
                    {
                      backgroundColor: themeColors.inputBg,
                      borderColor: themeColors.border,
                      color: themeColors.textPrimary,
                    },
                  ]}
                  placeholder="Detailed 3-act story arc (unlocked under NDA)..."
                  placeholderTextColor={themeColors.textMuted}
                  multiline
                  numberOfLines={4}
                  value={fullSynopsis}
                  onChangeText={setFullSynopsis}
                />

                <Text style={[styles.label, { color: themeColors.textMuted }]}>GENRE</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: themeColors.inputBg,
                      borderColor: themeColors.border,
                      color: themeColors.textPrimary,
                    },
                  ]}
                  placeholder="e.g. Psychological Thriller"
                  placeholderTextColor={themeColors.textMuted}
                  value={genre}
                  onChangeText={setGenre}
                />

                <Text style={[styles.label, { color: themeColors.textMuted }]}>WHY THIS FITS THIS CALL</Text>
                <TextInput
                  style={[
                    styles.input,
                    styles.textareaShort,
                    {
                      backgroundColor: themeColors.inputBg,
                      borderColor: themeColors.border,
                      color: themeColors.textPrimary,
                    },
                  ]}
                  placeholder="Explain why your script aligns with producer's requirement..."
                  placeholderTextColor={themeColors.textMuted}
                  multiline
                  value={whyFits}
                  onChangeText={setWhyFits}
                />

                <TouchableOpacity style={styles.nextBtn} onPress={handleNextStep}>
                  <Text style={styles.nextBtnText}>Continue to Legal & IP →</Text>
                </TouchableOpacity>
              </View>
            )}

            {step === 2 && (
              <View>
                <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>2. Guild Registration & Legal Declarations</Text>

                <Text style={[styles.label, { color: themeColors.textMuted }]}>SWA / WGA GUILD REGISTRATION NUMBER</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: themeColors.inputBg,
                      borderColor: themeColors.border,
                      color: themeColors.textPrimary,
                    },
                  ]}
                  placeholder="e.g. SWA-2026-98174"
                  placeholderTextColor={themeColors.textMuted}
                  value={guildRegNum}
                  onChangeText={setGuildRegNum}
                />

                <Text style={[styles.label, { color: themeColors.textMuted }]}>COPYRIGHT REGISTRATION NUMBER (OPTIONAL)</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: themeColors.inputBg,
                      borderColor: themeColors.border,
                      color: themeColors.textPrimary,
                    },
                  ]}
                  placeholder="e.g. ROC-L-88219/2026"
                  placeholderTextColor={themeColors.textMuted}
                  value={copyrightNum}
                  onChangeText={setCopyrightNum}
                />

                <View
                  style={[
                    styles.switchRow,
                    { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
                  ]}
                >
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={[styles.switchTitle, { color: themeColors.textPrimary }]}>I Own All IP Rights</Text>
                    <Text style={[styles.switchSub, { color: themeColors.textSecondary }]}>I own 100% of rights to submit this story.</Text>
                  </View>
                  <Switch accessibilityLabel="I Own All IP Rights" value={rightsOwned} onValueChange={setRightsOwned} trackColor={{ true: ORANGE }} />
                </View>

                <View
                  style={[
                    styles.switchRow,
                    { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
                  ]}
                >
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={[styles.switchTitle, { color: themeColors.textPrimary }]}>Declared Original Work</Text>
                    <Text style={[styles.switchSub, { color: themeColors.textSecondary }]}>This script is an original creation.</Text>
                  </View>
                  <Switch accessibilityLabel="Declared Original Work" value={isOriginalWork} onValueChange={setIsOriginalWork} trackColor={{ true: ORANGE }} />
                </View>

                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={[
                      styles.backStepBtn,
                      { backgroundColor: isDark ? themeColors.chipBg : '#F1F5F9' },
                    ]}
                    onPress={() => setStep(1)}
                  >
                    <Text style={[styles.backStepText, { color: themeColors.textSecondary }]}>← Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.nextBtn, { flex: 1 }]} onPress={handleNextStep}>
                    <Text style={styles.nextBtnText}>Continue to NDA →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {step === 3 && (
              <View>
                <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>3. NDA E-Signature & Attachments</Text>

                <Text style={[styles.label, { color: themeColors.textMuted }]}>TREATMENT / DECK LINK (GOOGLE DRIVE, DROPBOX)</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: themeColors.inputBg,
                      borderColor: themeColors.border,
                      color: themeColors.textPrimary,
                    },
                  ]}
                  placeholder="https://drive.google.com/file/d/..."
                  placeholderTextColor={themeColors.textMuted}
                  value={treatmentUrl}
                  onChangeText={setTreatmentUrl}
                />

                <Text style={[styles.label, { color: themeColors.textMuted }]}>LOOKBOOK / MOODBOARD LINK</Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: themeColors.inputBg,
                      borderColor: themeColors.border,
                      color: themeColors.textPrimary,
                    },
                  ]}
                  placeholder="https://..."
                  placeholderTextColor={themeColors.textMuted}
                  value={lookbookUrl}
                  onChangeText={setLookbookUrl}
                />

                <Text style={[styles.label, { color: themeColors.textMuted, marginTop: 12 }]}>ATTACH FILES (OPTIONAL, UP TO {PITCH_ATTACHMENT_MAX}: PDF OR IMAGE, 15 MB EACH)</Text>
                {attachmentPaths.map((ref, i) => (
                  <View key={ref} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
                    <TouchableOpacity onPress={() => openAttachment(ref)} accessibilityRole="link" style={{ flex: 1, minHeight: 36, justifyContent: 'center' }}>
                      <Text style={{ color: ORANGE, fontWeight: '700' }}>{attachmentLabel(ref, i)}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => dropAttachment(ref)} accessibilityRole="button" accessibilityLabel={`Remove ${attachmentLabel(ref, i)}`} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name="x" size={16} color={themeColors.iconMuted} />
                    </TouchableOpacity>
                  </View>
                ))}
                {attachmentPaths.length < PITCH_ATTACHMENT_MAX && (
                  <TouchableOpacity onPress={addAttachment} disabled={uploading} accessibilityRole="button" style={{ minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: themeColors.border, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
                    {uploading ? <ActivityIndicator color={ORANGE} /> : <Text style={{ fontWeight: '700', color: themeColors.textPrimary }}>+ Add a file</Text>}
                  </TouchableOpacity>
                )}

                {!editing && (!!pitchCall?.nda_required || pitchId === 'direct' || !!targetProducerId || !!targetProducer?.id) && (
                  <View
                    style={[
                      styles.ndaBox,
                      {
                        backgroundColor: isDark ? themeColors.chipBg : '#FEF3C7',
                        borderColor: isDark ? themeColors.border : '#FDE68A',
                      },
                    ]}
                  >
                    <View style={styles.ndaTitleRow}>
                      <Icon name="shield" size={16} color="#D97706" />
                      <Text style={styles.ndaTitleText}>CONFIDENTIAL NON-DISCLOSURE AGREEMENT</Text>
                    </View>
                    <Text style={[styles.ndaSub, { color: isDark ? themeColors.textSecondary : '#B45309' }]}>
                      By signing below, you e-sign the confidentiality agreement with the producer. Your timestamped legal identity will be permanently logged.
                    </Text>
                    <Text style={[styles.label, { color: themeColors.textMuted }]}>TYPE YOUR FULL LEGAL NAME TO E-SIGN *</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: themeColors.inputBg,
                          borderColor: themeColors.border,
                          color: themeColors.textPrimary,
                        },
                      ]}
                      placeholder="e.g. Rahul Sharma"
                      placeholderTextColor={themeColors.textMuted}
                      value={ndaSignature}
                      onChangeText={setNdaSignature}
                      accessibilityLabel="NDA signature, type your full legal name"
                    />
                  </View>
                )}

                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={[
                      styles.backStepBtn,
                      { backgroundColor: isDark ? themeColors.chipBg : '#F1F5F9' },
                    ]}
                    onPress={() => setStep(2)}
                  >
                    <Text style={[styles.backStepText, { color: themeColors.textSecondary }]}>← Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                    onPress={handleSubmitPitch}
                    disabled={submitting}
                  >
                    {submitting ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Icon name="check" size={16} color="#FFFFFF" strokeWidth={2.5} />
                        <Text style={styles.submitBtnText}>Submit Pitch Deck</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </TabletContainer>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: isTabletDevice ? 'center' : 'space-around',
    gap: isTabletDevice ? 72 : 0,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  stepItem: {
    alignItems: 'center',
    gap: 4,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: ORANGE,
  },
  stepNum: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  stepNumActive: {
    color: '#FFFFFF',
  },
  stepLabelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  stepLabelActive: {
    color: ORANGE,
  },
  formContent: {
    padding: isTabletDevice ? 24 : 16,
  },
  sectionTitle: {
    fontSize: isTabletDevice ? 22 : 18,
    fontWeight: '700',
    color: INK,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.6,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: isTabletDevice ? 16 : 12,
    paddingVertical: isTabletDevice ? 14 : 10,
    fontSize: isTabletDevice ? 15 : 14,
    color: INK,
  },
  textareaShort: {
    height: isTabletDevice ? 84 : 60,
    textAlignVertical: 'top',
  },
  textarea: {
    height: isTabletDevice ? 140 : 90,
    textAlignVertical: 'top',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: INK,
  },
  switchSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  ndaBox: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
  },
  ndaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  ndaTitleText: {
    color: '#D97706',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  ndaSub: {
    color: '#B45309',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    marginBottom: 30,
  },
  backStepBtn: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  backStepText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '700',
  },
  nextBtn: {
    backgroundColor: ORANGE,
    height: isTabletDevice ? 54 : 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 30,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  submitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORANGE,
    height: isTabletDevice ? 54 : 48,
    borderRadius: 12,
    gap: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
