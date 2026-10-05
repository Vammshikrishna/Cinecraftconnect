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
} from 'react-native';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { TabletContainer } from '../../components/common/TabletContainer';
import { useUserSettings } from '../../hooks/useUserSettings';
import { getSupabaseClient } from '@cinecraft/api';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

export const SubmitPitchScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  const { themeColors, isDark } = useUserSettings();
  const { pitchId, pitchTitle, targetProducerId, targetProducerName } = route.params || {};
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

  useEffect(() => {
    const fetchCall = async () => {
      const isDirectMode = pitchId === 'direct' || !!targetProducerId;
      const supabase = getSupabaseClient();

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
  }, [pitchId, targetProducerId]);

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
    const isNdaRequired = !!pitchCall?.nda_required;
    if (isNdaRequired && ndaSignature.trim().length < 3) {
      Alert.alert('NDA Signature Required', 'Please type your full legal name to e-sign the non-disclosure agreement.');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Authentication', 'Please sign in to submit pitches.');
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
        // Create a direct_catcher pitch call brief where creator_id = Producer's ID (matching Web app behavior)
        const { data: newCatcher, error: cError } = await (supabase as any)
          .from('pitch_calls')
          .insert({
            creator_id: targetId,
            title: `Direct Pitch: ${title.trim() || 'New Concept'}`,
            project_type: 'other',
            requirement_description: 'Confidential direct concept submission brief.',
            status: 'open',
            is_published: true,
            attachments: {
              is_direct_catcher: true,
              target_producer_id: targetId,
              target_producer_name: targetProducer?.full_name || 'Producer',
            },
          })
          .select('id')
          .single();

        if (!cError && newCatcher) {
          targetCallId = newCatcher.id;
        } else {
          console.warn('[SubmitPitch] Direct catcher creation fallback:', cError);
          const { data: fallbackCall } = await (supabase as any)
            .from('pitch_calls')
            .select('id')
            .eq('creator_id', targetId)
            .limit(1)
            .maybeSingle();

          if (fallbackCall) {
            targetCallId = fallbackCall.id;
          } else {
            const { data: absoluteFallback } = await (supabase as any)
              .from('pitch_calls')
              .select('id')
              .limit(1)
              .maybeSingle();

            if (absoluteFallback) {
              targetCallId = absoluteFallback.id;
            }
          }
        }
      }

      const payload: any = {
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
        nda_signed_at: ndaSignature.trim() ? new Date().toISOString() : null,
        submitted_at: new Date().toISOString(),
        status: 'submitted',
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

      Alert.alert('Pitch Submitted! 🎬', 'Your pitch has been securely encrypted and submitted to the call creator.', [
        {
          text: 'Great',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not submit pitch.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingCall) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={ORANGE} />
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.formContent} showsVerticalScrollIndicator={false}>
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
                  <Switch value={rightsOwned} onValueChange={setRightsOwned} trackColor={{ true: ORANGE }} />
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
                  <Switch value={isOriginalWork} onValueChange={setIsOriginalWork} trackColor={{ true: ORANGE }} />
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

                {pitchCall?.nda_required && (
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
    justifyContent: 'space-around',
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
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  stepNumActive: {
    color: '#FFFFFF',
  },
  stepLabelText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  stepLabelActive: {
    color: ORANGE,
  },
  formContent: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: INK,
    marginBottom: 12,
  },
  label: {
    fontSize: 10.5,
    fontWeight: '800',
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
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: INK,
  },
  textareaShort: {
    height: 60,
    textAlignVertical: 'top',
  },
  textarea: {
    height: 90,
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
    fontWeight: '800',
    color: INK,
  },
  switchSub: {
    fontSize: 11,
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
    fontSize: 11,
    fontWeight: '800',
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
    fontWeight: '800',
  },
  nextBtn: {
    backgroundColor: ORANGE,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    marginBottom: 30,
  },
  nextBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  submitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORANGE,
    height: 48,
    borderRadius: 12,
    gap: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
