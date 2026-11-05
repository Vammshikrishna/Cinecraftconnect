import { ReportModal } from '../../components/modals/ReportModal';
import { showToast } from '../../contexts/ToastContext';
import { UniversalShareSheet } from '../../components/common/UniversalShareSheet';
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  findNodeHandle,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
  Share,
  InteractionManager,
  DeviceEventEmitter,
} from 'react-native';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { TabletContainer } from '../../components/common/TabletContainer';
import { getSupabaseClient } from '@cinecraft/api';
import { VerificationBadge } from '../../components/common/VerificationBadge';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useResponsive } from '../../hooks/useResponsive';
import { isTabletDevice } from '../../utils/pageType';
import { CachedImage } from '../../components/common/CachedImage';
import { useAccountType } from '../../hooks/useAccountType';
import { useAppRole } from '../../hooks/useAppRole';
import { resolveCurrentUserId, getCacheSync, saveCache } from '../../services/offlineCache';
import { pickAttachments, type PickedAttachment } from '../../services/attachmentPicker';
import { uploadResume, RESUME_MAX_BYTES, isAllowedResumeType } from '../../services/resumeFiles';
import {
  JOB_TYPE_LABELS,
  EXPERIENCE_LABELS,
  WORK_MODE_LABELS,
  formatSalary,
  formatShootDates,
  getDeadlineInfo,
  jobShareMessage,
  normalizeScreeningQuestions,
} from '@cinecraft/core';
import { ScreenSkeleton } from '../../components/common/Skeleton';
import { friendlyError } from '@cinecraft/core';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

export const JobDetailScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  const { themeColors, isDark } = useUserSettings();
  const { isTablet, isLandscape } = useResponsive();
  const twoCol = isTablet && isLandscape;
  const { isFan } = useAccountType();
  const { isInternal } = useAppRole();
  const { jobId, jobTitle } = route.params || {};

  const [job, setJob] = useState<any>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isApplied, setIsApplied] = useState(false);
  const [applicantCount, setApplicationCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Application Form State
  const [coverNote, setCoverNote] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const applyFormRef = useRef<View>(null);
  // The hero button used to submit a blank application. It now takes the person to the real form below.
  const goToApplyForm = () => {
    const scroller: any = scrollRef.current;
    const form: any = applyFormRef.current;
    const node = scroller ? findNodeHandle(scroller) : null;
    if (form && node) {
      form.measureLayout(node, (_x: number, y: number) => scroller.scrollTo({ y: Math.max(0, y - 12), animated: true }), () => {});
    }
  };
  const [portfolioLink, setPortfolioLink] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [resumeFile, setResumeFile] = useState<PickedAttachment | null>(null);
  const [applying, setApplying] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    const fetchJobDetail = async () => {
      try {
        const supabase = getSupabaseClient();
        let currentUser: any = null;
        try {
          const { data: { session } } = await supabase.auth.getSession();
          currentUser = session?.user || null;
        } catch {}
        if (!currentUser) {
          try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            currentUser = authUser;
          } catch {}
        }
        if (!currentUser) {
          const uid = await resolveCurrentUserId();
          if (uid) currentUser = { id: uid };
        }

        if (currentUser?.id) setCurrentUserId(currentUser.id);

        if (!jobId) return;

        // Check local cache for immediate zero-latency bookmark status
        const cached = getCacheSync<any>('jobs_user_info');
        if (cached?.bookmarkedJobIds?.includes(jobId) && active) {
          setBookmarked(true);
        }

        // Job, applied/bookmarked state and applicant count are independent: fetch them together.
        const uid = currentUser?.id;
        const [jobRes, appRes, bookRes, countRes]: any[] = await Promise.all([
          (supabase.from('jobs') as any)
            .select(`
            *,
            profiles:posted_by (
              id,
              full_name,
              avatar_url,
              username
            ),
            company_pages:page_id (
              id,
              name,
              logo_url,
              slug,
              tagline,
              description,
              headquarters,
              company_size
            )
          `)
            .eq('id', jobId)
            .single(),
          uid
            ? (supabase.from('job_applications') as any).select('id').eq('job_id', jobId).eq('applicant_id', uid).maybeSingle()
            : Promise.resolve(null),
          uid
            ? (supabase as any).from('job_bookmarks').select('id').eq('job_id', jobId).eq('user_id', uid).maybeSingle()
            : Promise.resolve(null),
          (supabase.from('job_applications') as any).select('*', { count: 'exact', head: true }).eq('job_id', jobId),
        ]);

        if (jobRes.error) throw jobRes.error;
        if (active) {
          setJob(jobRes.data);
          setLoading(false);
          // Count a view (the database de-duplicates per person per day and ignores the poster).
          if (uid) (supabase as any).rpc('record_job_view', { p_job_id: jobId }).then(() => {}, () => {});
          if (appRes?.data) setIsApplied(true);
          if (uid) setBookmarked(!!bookRes?.data);
          setApplicationCount(countRes?.count || 0);
        }
      } catch (e) {
        console.warn('[JobDetail] Error:', e);
      } finally {
        if (active) setLoading(false);
      }
    };

    let active = true;
    fetchJobDetail();
    const task = { cancel: () => {} };

    return () => {
      active = false;
      task.cancel();
    };
  }, [jobId]);

  // Real-time listener for cross-screen bookmark changes
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('jobBookmarkChanged', (event) => {
      if (event?.jobId === jobId) {
        setBookmarked(event.isBookmarked);
      }
    });
    return () => sub.remove();
  }, [jobId]);

  // Supabase Realtime channel for job_bookmarks
  useEffect(() => {
    if (!jobId) return;
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`job_detail_bookmark_${jobId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_bookmarks' },
        async (payload: any) => {
          const uid = currentUserId || (await resolveCurrentUserId());
          if (!uid) return;
          if (payload.eventType === 'DELETE') {
            const { data } = await (supabase as any)
              .from('job_bookmarks')
              .select('id')
              .eq('job_id', jobId)
              .eq('user_id', uid)
              .maybeSingle();
            const isNowBookmarked = !!data;
            setBookmarked(isNowBookmarked);
            DeviceEventEmitter.emit('jobBookmarkChanged', { jobId, isBookmarked: isNowBookmarked });
          } else if (payload.eventType === 'INSERT') {
            if (payload.new?.user_id === uid && payload.new?.job_id === jobId) {
              setBookmarked(true);
              DeviceEventEmitter.emit('jobBookmarkChanged', { jobId, isBookmarked: true });
            }
          }
        }
      )
      .subscribe();


    return () => {
      try {
        channel.unsubscribe();
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [jobId, currentUserId]);

  const handleToggleBookmark = async () => {
    let userId = currentUserId;
    if (!userId) {
      userId = await resolveCurrentUserId();
      if (userId) setCurrentUserId(userId);
    }
    if (!userId) {
      Alert.alert('Sign In Required', 'Please sign in to save jobs.');
      return;
    }

    const nextBookmarked = !bookmarked;
    setBookmarked(nextBookmarked);

    // Update cached jobs_user_info
    const cached = getCacheSync<any>('jobs_user_info') || {};
    const existing = cached.bookmarkedJobIds || [];
    const updatedIds = nextBookmarked
      ? Array.from(new Set([...existing, jobId]))
      : existing.filter((id: string) => id !== jobId);
    saveCache('jobs_user_info', { ...cached, bookmarkedJobIds: updatedIds });

    // Broadcast across screens in real-time
    DeviceEventEmitter.emit('jobBookmarkChanged', { jobId, isBookmarked: nextBookmarked });
    showToast({ title: nextBookmarked ? 'Job saved' : 'Removed from saved', type: 'success' });

    const supabase = getSupabaseClient();
    try {
      if (!nextBookmarked) {
        const { error } = await (supabase as any)
          .from('job_bookmarks')
          .delete()
          .eq('user_id', userId)
          .eq('job_id', jobId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('job_bookmarks')
          .upsert({ user_id: userId, job_id: jobId }, { onConflict: 'user_id,job_id' });
        if (error) throw error;
      }
    } catch (e) {
      console.warn('[JobDetail] Toggle bookmark error:', e);
      setBookmarked(!nextBookmarked);
      DeviceEventEmitter.emit('jobBookmarkChanged', { jobId, isBookmarked: !nextBookmarked });
      Alert.alert('Could not update your saved jobs', friendlyError(e, 'Please try again.'));
    }
  };

  const pickResume = async () => {
    try {
      const [file] = await pickAttachments({ multiple: false });
      if (!file) return;
      if (file.size && file.size > RESUME_MAX_BYTES) {
        Alert.alert('File too large', 'Please attach a file up to 10 MB.');
        return;
      }
      if (!isAllowedResumeType(file)) {
        Alert.alert('That file type is not allowed', 'Attach a PDF, JPG or PNG.');
        return;
      }
      setResumeFile(file);
    } catch (e: any) {
      Alert.alert('Could not attach the file', friendlyError(e, 'Please try again.'));
    }
  };

  const handleApply = async () => {
    if (!currentUserId || !jobId) {
      Alert.alert('Sign in Required', 'Please sign in to submit a job application.');
      return;
    }
    const deadlineState = getDeadlineInfo(job?.deadline);
    if (job && (!job.is_active || deadlineState?.expired)) {
      Alert.alert('Applications are closed', 'This job is no longer accepting applications.');
      return;
    }
    const questions = normalizeScreeningQuestions(job?.screening_questions);
    const missing = questions.find((q) => q.required && !(answers[q.id] || '').trim());
    if (missing) {
      Alert.alert('Please answer all required questions', missing.label);
      return;
    }
    if (portfolioLink.trim() && !/^https?:\/\//i.test(portfolioLink.trim())) {
      Alert.alert('Check your showreel link', 'It must start with http:// or https://');
      return;
    }

    setApplying(true);
    try {
      const supabase = getSupabaseClient();
      // Private bucket: stored as a reference, opened by the hiring team through a short-lived signed link.
      const resumeRef = resumeFile ? await uploadResume(resumeFile) : null;
      const { error } = await (supabase.from('job_applications') as any).insert({
        job_id: jobId,
        applicant_id: currentUserId,
        cover_letter: coverNote.trim() || null,
        showreel_url: portfolioLink.trim() || null,
        resume_url: resumeRef,
        answers,
        status: 'pending',
      });

      if (error) throw error;

      setIsApplied(true);
      setApplicationCount((prev) => prev + 1);
      Alert.alert('Application Submitted! 🎬', 'Your application has been delivered to the hiring team. You will be notified when its status changes.');
    } catch (err: any) {
      Alert.alert('Error', friendlyError(err, 'Failed to submit application.'));
    } finally {
      setApplying(false);
    }
  };

  const handleWithdraw = async () => {
    Alert.alert('Withdraw Application', 'Are you sure you want to withdraw your job application?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: async () => {
          try {
            const supabase = getSupabaseClient();
            const { error: withdrawError } = await (supabase.from('job_applications') as any)
              .delete()
              .eq('job_id', jobId)
              .eq('applicant_id', currentUserId);
            if (withdrawError) throw withdrawError;

            setIsApplied(false);
            setApplicationCount((prev) => Math.max(0, prev - 1));
            Alert.alert('Withdrawn', 'Your application has been removed.');
          } catch (e: any) {
            Alert.alert('Error', friendlyError(e, 'Could not withdraw application.'));
          }
        },
      },
    ]);
  };

  const [showShareSheet, setShowShareSheet] = useState(false);

  // Share opens the in-app share sheet (send to people, rooms, Share to Feed, copy link, share outside the app)
  const handleShare = async () => {
    if (job) { setShowShareSheet(true); return; }
    try {
      await Share.share({
        message: job
          ? jobShareMessage({ ...job, company: job.company_pages?.name || job.company }, job.id)
          : `Check out this film production opening for "${jobTitle}" on CineCraft Connect!`,
      });
    } catch (e) {
      // Ignored
    }
  };

  const isOwner = currentUserId === job?.posted_by;
  const companyName = job?.company_pages?.name || job?.company || 'CineCraft Studio';
  const logoUrl = job?.company_pages?.logo_url; // Strictly Studio logo, not user avatar

  if (loading) {
    return (
      <View style={styles.container}>
        <Header title="Job Details" showLogo={false} onBack={() => navigation.goBack()} />
        <ScreenSkeleton variant="detail" />
      </View>
    );
  }

  // The job could not be loaded (deleted, no access, or no connection): say so instead of showing a made-up job.
  if (!job) {
    return (
      <View style={styles.container}>
        <Header title="Job Details" showLogo={false} onBack={() => navigation.goBack()} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 }}>
          <Icon name="briefcase" size={40} color={themeColors.iconMuted} />
          <Text style={{ fontSize: 18, fontWeight: '700', color: themeColors.textPrimary }}>{jobTitle || 'This job'} could not be loaded</Text>
          <Text style={{ fontSize: 13, color: themeColors.textSecondary, textAlign: 'center' }}>It may have been removed, or your connection dropped.</Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            style={{ marginTop: 12, minHeight: 44, paddingHorizontal: 22, borderRadius: 22, backgroundColor: '#FF4B33', justifyContent: 'center' }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const currentJob = job;

  const salaryFormatted = formatSalary(currentJob) || 'On discussion';
  const deadline = getDeadlineInfo(job?.deadline);
  const isClosed = !!job && (!job.is_active || !!deadline?.expired);
  const screeningQuestions = normalizeScreeningQuestions(job?.screening_questions);
  const shootDates = formatShootDates(currentJob);
  const whereText = [
    currentJob.work_mode === 'remote' ? 'Remote' : currentJob.location,
    currentJob.work_mode && currentJob.work_mode !== 'remote' ? WORK_MODE_LABELS[currentJob.work_mode as keyof typeof WORK_MODE_LABELS] : null,
  ].filter(Boolean).join(' · ') || 'Location on request';

  return (
    <TabletContainer
      maxWidth="content"
      backgroundColor={themeColors.bgScreen}
      header={
        <Header
          title="Job Details"
          showLogo={false}
          onBack={() => navigation.goBack()}
          rightAction={
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Report" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={() => setReportOpen(true)}>
                <Icon name="flag" size={18} color={themeColors.iconSecondary} />
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" accessibilityLabel="Share" hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={handleShare}>
                <Icon name="share" size={18} color={themeColors.textPrimary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleToggleBookmark}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel={bookmarked ? 'Remove saved job' : 'Bookmark job'}
                accessibilityState={{ selected: !!bookmarked }}
              >
                <Icon
                  name="bookmark"
                  size={18}
                  color={bookmarked ? ORANGE : themeColors.textPrimary}
                  fill={bookmarked ? ORANGE : 'none'}
                />
              </TouchableOpacity>
            </View>
          }
        />
      }
    >
      <ScrollView ref={scrollRef} contentContainerStyle={[styles.content, isTablet && { padding: 24, paddingBottom: 72 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={twoCol ? { flexDirection: 'row', alignItems: 'flex-start', gap: 20 } : undefined}>
        <View style={twoCol ? { width: '40%' } : undefined}>
        {/* Main Hero Card */}
        <View style={[styles.heroCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
          {/* Organization Header Row: Studio Logo + Name */}
          <View style={[styles.orgHeaderRow, { borderBottomColor: themeColors.divider }]}>
            {logoUrl ? (
              <CachedImage uri={logoUrl} style={[styles.studioLogoImg, { borderColor: themeColors.border }]} />
            ) : (
              <View style={[styles.studioLogoFallback, { backgroundColor: isDark ? 'rgba(255, 75, 51, 0.15)' : '#FFF7F5', borderColor: isDark ? 'rgba(255, 75, 51, 0.3)' : '#FFE5DF' }]}>
                <Text style={styles.studioLogoFallbackText}>
                  {companyName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}

            <View style={{ flex: 1 }}>
              <Text style={[styles.studioNameText, { color: themeColors.textPrimary }]} numberOfLines={1}>
                {companyName}
              </Text>
              {job?.company_pages?.tagline && (
                <Text style={styles.studioTaglineText} numberOfLines={1}>
                  {job.company_pages.tagline}
                </Text>
              )}
            </View>

            <View style={[styles.hiringBadge, isClosed ? { backgroundColor: 'rgba(100,116,139,0.15)', borderColor: 'rgba(100,116,139,0.35)' } : { backgroundColor: isDark ? 'rgba(255, 75, 51, 0.15)' : '#FFF7F5', borderColor: isDark ? 'rgba(255, 75, 51, 0.3)' : '#FFE5DF' }]}>
              <Text style={[styles.hiringBadgeText, isClosed && { color: '#64748B' }]}>{isClosed ? 'CLOSED' : 'HIRING NOW'}</Text>
            </View>
          </View>

          {/* Job Title & Type Pill */}
          <View style={styles.pillRow}>
            <View style={[styles.typePill, { backgroundColor: isDark ? 'rgba(255, 75, 51, 0.15)' : '#FFF7F5', borderColor: isDark ? 'rgba(255, 75, 51, 0.3)' : '#FFE5DF' }]}>
              <Text style={styles.typePillText}>
                {(JOB_TYPE_LABELS[currentJob.type as keyof typeof JOB_TYPE_LABELS] || currentJob.type || 'Full-time').toUpperCase()}
              </Text>
            </View>
            {!isClosed && deadline ? (
              <View style={[styles.typePill, { backgroundColor: deadline.urgent ? 'rgba(245,158,11,0.15)' : 'rgba(100,116,139,0.12)', borderColor: deadline.urgent ? 'rgba(245,158,11,0.4)' : 'rgba(100,116,139,0.3)' }]}>
                <Text style={[styles.typePillText, { color: deadline.urgent ? '#F59E0B' : themeColors.textSecondary }]}>{deadline.label.toUpperCase()}</Text>
              </View>
            ) : null}
          </View>

          <Text style={[styles.jobTitleText, { color: themeColors.textPrimary }]}>{currentJob.title}</Text>

          {/* Location & Applicants Meta */}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Icon name="map-pin" size={13} color={themeColors.iconSecondary} />
              <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>{whereText}</Text>
            </View>
            <View style={styles.metaItem}>
              <Icon name="users" size={13} color={themeColors.iconSecondary} />
              <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>
                {applicantCount > 0 ? `${applicantCount} Applicants` : 'Be first to apply'}
              </Text>
            </View>
          </View>

          {/* Action CTA Header Row */}
          <View style={styles.heroActionRow}>
            {isOwner ? (
              <TouchableOpacity
                style={[styles.manageBtn, { backgroundColor: isDark ? '#FFFFFF' : INK }]}
                onPress={() => navigation.navigate('ManagePostings')}
              >
                <Icon name="settings" size={16} color={isDark ? INK : '#FFFFFF'} />
                <Text style={[styles.manageBtnText, { color: isDark ? INK : '#FFFFFF' }]}>Manage Posting & Applicants</Text>
              </TouchableOpacity>
            ) : isFan || isInternal ? (
              <View style={[styles.appliedBadgeBox, { backgroundColor: isDark ? 'rgba(255, 75, 51, 0.1)' : '#FFF0ED', borderColor: isDark ? 'rgba(255, 75, 51, 0.3)' : '#FFE5DF' }]}>
                <Icon name="info" size={14} color={ORANGE} />
                <Text style={[styles.appliedBadgeText, { color: ORANGE }]}>
                  {isFan ? 'Viewer Mode (Fan Account)' : 'Governance Mode (Internal)'}
                </Text>
              </View>
            ) : isApplied ? (
              <View style={styles.appliedActionRow}>
                <TouchableOpacity activeOpacity={0.8} onPress={() => navigation.navigate('MyApplications')} style={[styles.appliedBadgeBox, { backgroundColor: isDark ? 'rgba(22, 163, 74, 0.15)' : '#F0FDF4', borderColor: isDark ? 'rgba(22, 163, 74, 0.3)' : '#BBF7D0' }]}>
                  <Icon name="check-circle" size={15} color="#16A34A" />
                  <Text style={styles.appliedBadgeText}>Applied · Track</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.withdrawBtn, { backgroundColor: isDark ? 'rgba(220, 38, 38, 0.15)' : '#FEF2F2', borderColor: isDark ? 'rgba(220, 38, 38, 0.3)' : '#FECACA' }]} onPress={handleWithdraw}>
                  <Icon name="trash-2" size={14} color="#DC2626" />
                  <Text style={styles.withdrawBtnText}>Withdraw</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={[styles.applyHeroBtn, isClosed && { backgroundColor: '#64748B' }]} onPress={goToApplyForm} disabled={applying || isClosed}>
                {applying ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.applyHeroBtnText}>{isClosed ? 'Applications Closed' : 'Apply Now'}</Text>
                    {!isClosed && <Icon name="external-link" size={15} color="#FFFFFF" />}
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Quick Specs Grid */}
        <View style={styles.specsGrid}>
          {[
            { label: 'JOB TYPE', value: (JOB_TYPE_LABELS[currentJob.type as keyof typeof JOB_TYPE_LABELS] || currentJob.type || 'Contract').toUpperCase(), accent: false },
            { label: 'EXPERIENCE', value: EXPERIENCE_LABELS[currentJob.experience_level as keyof typeof EXPERIENCE_LABELS] || currentJob.experience_level || '—', accent: false },
            { label: 'PAY', value: salaryFormatted, accent: true },
            { label: 'STATUS', value: isClosed ? 'Closed' : applicantCount > 5 ? 'High Demand' : 'Active', accent: false },
            ...(currentJob.department ? [{ label: 'DEPARTMENT', value: currentJob.department, accent: false }] : []),
            ...(shootDates ? [{ label: 'SHOOT DATES', value: shootDates, accent: false }] : []),
            ...(currentJob.openings && currentJob.openings > 1 ? [{ label: 'OPENINGS', value: String(currentJob.openings), accent: false }] : []),
          ].map((spec) => (
            <View key={spec.label} style={[styles.specBox, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
              <Text style={[styles.specLabel, { color: themeColors.textMuted }]}>{spec.label}</Text>
              <Text style={[styles.specVal, { color: spec.accent ? ORANGE : themeColors.textPrimary }]}>{spec.value}</Text>
            </View>
          ))}
        </View>

        </View>
        <View style={twoCol ? { flex: 1 } : undefined}>
        {/* Role Overview Section */}
        <View style={[styles.sectionCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
          <Text style={[styles.sectionHeaderTitle, { color: themeColors.textPrimary }]}>Role Overview</Text>
          <Text style={[styles.bodyParagraph, { color: themeColors.textSecondary }]}>{currentJob.description}</Text>
        </View>

        {/* Technical Requirements Section */}
        {currentJob.requirements && (
          <View style={[styles.sectionCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
            <Text style={[styles.sectionHeaderTitle, { color: themeColors.textPrimary }]}>Key Requirements</Text>
            {currentJob.requirements.split('\n').filter((r: string) => r.trim()).map((req: string, idx: number) => (
              <View key={idx} style={styles.reqBulletRow}>
                <Icon name="check-circle" size={14} color={ORANGE} />
                <Text style={[styles.reqBulletText, { color: themeColors.textSecondary }]}>{req.replace(/^[\-\*]\s*/, '')}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Application Form Box / Role Notice */}
        {isFan || isInternal ? (
          <View style={[styles.sectionCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border, alignItems: 'center', paddingVertical: 20 }]}>
            <Icon name={isFan ? 'eye' : 'shield'} size={24} color={ORANGE} />
            <Text style={[styles.applyFormTitle, { color: themeColors.textPrimary, marginTop: 10, textAlign: 'center' }]}>
              {isFan ? 'Fan Account Viewer Mode' : 'Internal Account'}
            </Text>
            <Text style={[styles.applyFormSub, { color: themeColors.textSecondary, textAlign: 'center', maxWidth: 320 }]}>
              {isFan
                ? 'Role applications and direct pitches are reserved for verified Creator and Studio accounts. Browse open roles freely!'
                : 'Role applications are disabled for internal administrative and moderation accounts.'}
            </Text>
          </View>
        ) : !isApplied && !isOwner && isClosed ? (
          <View style={[styles.sectionCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border, alignItems: 'center', paddingVertical: 20 }]}>
            <Icon name="lock" size={22} color={themeColors.iconMuted} />
            <Text style={[styles.applyFormTitle, { color: themeColors.textPrimary, marginTop: 8 }]}>Applications are closed</Text>
            <Text style={[styles.applyFormSub, { color: themeColors.textSecondary, textAlign: 'center' }]}>This job is no longer accepting applications.</Text>
          </View>
        ) : !isApplied && !isOwner ? (
          <View ref={applyFormRef} collapsable={false} style={[styles.applyFormCard, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
            <Text style={[styles.applyFormTitle, { color: themeColors.textPrimary }]}>Direct Application Note</Text>
            <Text style={[styles.applyFormSub, { color: themeColors.textSecondary }]}>
              Attach custom showreel link or note to the hiring production team.
            </Text>

            {screeningQuestions.map((q) => (
              <View key={q.id}>
                <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>{q.label.toUpperCase()}{q.required ? ' *' : ''}</Text>
                {q.type === 'text' ? (
                  <TextInput
                    style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
                    placeholder="Your answer"
                    placeholderTextColor={themeColors.textMuted}
                    value={answers[q.id] || ''}
                    onChangeText={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
                    maxLength={500}
                  />
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                    {(q.type === 'yesno' ? ['Yes', 'No'] : q.options || []).map((opt) => {
                      const on = answers[q.id] === opt;
                      return (
                        <TouchableOpacity
                          key={opt}
                          onPress={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                          style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: on ? ORANGE : themeColors.border, backgroundColor: on ? ORANGE : themeColors.inputBg }}
                        >
                          <Text style={{ color: on ? '#FFFFFF' : themeColors.textPrimary, fontSize: 12, fontWeight: '700' }}>{opt}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            ))}

            <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>CV / PORTFOLIO FILE (Optional, up to 10 MB)</Text>
            <TouchableOpacity
              onPress={pickResume}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: themeColors.border, borderRadius: 12, padding: 12, marginBottom: 12, backgroundColor: themeColors.inputBg }}
            >
              <Icon name={resumeFile ? 'file-text' : 'upload'} size={18} color={ORANGE} />
              <Text style={{ color: resumeFile ? themeColors.textPrimary : themeColors.textSecondary, fontSize: 13, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                {resumeFile ? resumeFile.name : 'Attach a PDF, JPG or PNG'}
              </Text>
              {resumeFile ? (
                <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" onPress={() => setResumeFile(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Icon name="x" size={16} color={themeColors.iconMuted} />
                </TouchableOpacity>
              ) : null}
            </TouchableOpacity>

            <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>SHOWREEL / PORTFOLIO LINK</Text>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
              placeholder="https://vimeo.com/your-showreel"
              placeholderTextColor={themeColors.textMuted}
              autoCapitalize="none"
              value={portfolioLink}
              onChangeText={setPortfolioLink}
            />

            <Text style={[styles.inputLabel, { color: themeColors.textSecondary }]}>COVER NOTE TO PRODUCER (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: themeColors.inputBg, borderColor: themeColors.border, color: themeColors.textPrimary }]}
              placeholder="Highlight relevant film credits or rig experience..."
              placeholderTextColor={themeColors.textMuted}
              multiline
              value={coverNote}
              onChangeText={setCoverNote}
            />

            <TouchableOpacity
              style={[styles.submitAppBtn, applying && { opacity: 0.7 }]}
              onPress={handleApply}
              disabled={applying}
            >
              {applying ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.submitAppBtnText}>Submit Application →</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Recruiter / Hiring Poster Widget */}
        {job?.profiles && (
          <View style={[styles.recruiterWidget, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
            {job.profiles.avatar_url ? (
              <CachedImage uri={job.profiles.avatar_url} style={styles.recruiterAvatar} />
            ) : (
              <View style={[styles.recruiterAvatar, styles.recruiterAvatarFallback, { backgroundColor: isDark ? 'rgba(255, 75, 51, 0.15)' : '#FFF7F5', borderColor: isDark ? 'rgba(255, 75, 51, 0.3)' : '#FFE5DF' }]}>
                <Text style={styles.recruiterAvatarFallbackText}>
                  {(job.profiles.full_name || job.profiles.username || 'H').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.recruiterTitle, { color: themeColors.textSecondary }]}>Posted by Hiring Team</Text>
              <Text style={[styles.recruiterName, { color: themeColors.textPrimary }]}>
                {job.profiles.full_name || job.profiles.username}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.msgPosterBtn, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}
              onPress={() =>
                navigation.navigate('Conversation', {
                  recipientId: job.profiles.id,
                  recipientName: job.profiles.full_name || job.profiles.username,
                })
              }
            >
              <Icon name="message-square" size={14} color={ORANGE} />
              <Text style={[styles.msgPosterBtnText, { color: themeColors.textPrimary }]}>Message</Text>
            </TouchableOpacity>
          </View>
        )}
        </View>
        </View>
      </ScrollView>
      {!!job && (
        <UniversalShareSheet
          visible={showShareSheet}
          onClose={() => setShowShareSheet(false)}
          title={job.title}
          shareUrl={`https://cinecraftconnect.com/jobs/${job.id}`}
          itemType="job"
          itemData={{
            id: job.id,
            title: job.title,
            company: job.company_pages?.name || job.company,
            location: job.location,
            type: job.type,
            logoUrl: job.company_pages?.logo_url,
            salary: formatSalary(job) || undefined,
            description: String(job.description || '').slice(0, 160),
          }}
          onShareToFeed={(isInternal || isFan) ? undefined : () => {
            setShowShareSheet(false);
            navigation.navigate('CreatePost', {
              sharedJob: {
                id: job.id,
                jobId: job.id,
                title: job.title,
                company: job.company_pages?.name || job.company,
                location: job.location,
                type: job.type,
                logoUrl: job.company_pages?.logo_url,
                salary: formatSalary(job) || undefined,
                description: String(job.description || '').slice(0, 160),
              },
            });
          }}
        />
      )}
      <ReportModal
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetTitle="this job posting"
        targetType="job"
        targetId={jobId}
      />
    </TabletContainer>
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
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: isTabletDevice ? 24 : 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  orgHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  studioLogoImg: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  studioLogoFallback: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  studioLogoFallbackText: {
    color: ORANGE,
    fontSize: 20,
    fontWeight: '700',
  },
  studioNameText: {
    fontSize: 16,
    fontWeight: '700',
    color: INK,
  },
  studioTaglineText: {
    fontSize: 12,
    color: ORANGE,
    fontWeight: '700',
    marginTop: 1,
  },
  hiringBadge: {
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  hiringBadgeText: {
    color: ORANGE,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  pillRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  typePill: {
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typePillText: {
    color: ORANGE,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  jobTitleText: {
    fontSize: isTabletDevice ? 26 : 20,
    fontWeight: '700',
    color: INK,
    fontFamily: 'Lora-Bold',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  heroActionRow: {
    marginTop: 4,
  },
  applyHeroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ORANGE,
    height: isTabletDevice ? 52 : 46,
    borderRadius: 14,
    gap: 8,
  },
  applyHeroBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: INK,
    height: 46,
    borderRadius: 14,
    gap: 8,
  },
  manageBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  appliedActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  appliedBadgeBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    height: 44,
    borderRadius: 12,
    gap: 6,
  },
  appliedBadgeText: {
    color: '#16A34A',
    fontSize: 14,
    fontWeight: '700',
  },
  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 16,
    height: 44,
    borderRadius: 12,
    gap: 6,
  },
  withdrawBtnText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  specsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  specBox: {
    flexGrow: 1,
    flexBasis: '47%', // two per row that fill the whole row (48% + gap left a strip empty on the right)
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: isTabletDevice ? 16 : 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  specLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  specVal: {
    fontSize: isTabletDevice ? 15 : 13,
    fontWeight: '700',
    color: INK,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: isTabletDevice ? 22 : 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: INK,
    marginBottom: 10,
  },
  bodyParagraph: {
    fontSize: isTabletDevice ? 15 : 14,
    color: '#475569',
    lineHeight: isTabletDevice ? 23 : 20,
  },
  reqBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  reqBulletText: {
    flex: 1,
    fontSize: isTabletDevice ? 14 : 13,
    color: '#475569',
    lineHeight: isTabletDevice ? 21 : 18,
  },
  applyFormCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
  },
  applyFormTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: INK,
  },
  applyFormSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
    marginTop: 6,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: isTabletDevice ? 13 : 10,
    fontSize: isTabletDevice ? 15 : 14,
    color: INK,
  },
  textArea: {
    height: isTabletDevice ? 120 : 80,
    textAlignVertical: 'top',
  },
  submitAppBtn: {
    backgroundColor: ORANGE,
    borderRadius: 12,
    height: isTabletDevice ? 52 : 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  submitAppBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  recruiterWidget: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  recruiterAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F3F4F6',
  },
  recruiterAvatarFallback: {
    backgroundColor: 'rgba(255, 75, 51, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 51, 0.2)',
  },
  recruiterAvatarFallbackText: {
    color: '#FF4B33',
    fontSize: 16,
    fontWeight: '700',
  },
  recruiterTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  recruiterName: {
    fontSize: 14,
    fontWeight: '700',
    color: INK,
    marginTop: 1,
  },
  msgPosterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  msgPosterBtnText: {
    color: ORANGE,
    fontSize: 12,
    fontWeight: '700',
  },
});

export default JobDetailScreen;
