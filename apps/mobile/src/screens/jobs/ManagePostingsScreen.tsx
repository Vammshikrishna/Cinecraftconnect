import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  RefreshControl,
} from 'react-native';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { CachedImage } from '../../components/common/CachedImage';
import { getSupabaseClient } from '@cinecraft/api';
import { useUserSettings } from '../../hooks/useUserSettings';
import { CreateJobModal } from '../../components/modals/CreateJobModal';
import { ApplicantSheet } from '../../components/jobs/ApplicantSheet';
import { StarRating, StageBadge, MatchBadge, ORANGE } from '../../components/jobs/JobsShared';
import {
  PIPELINE_STAGES,
  getStage,
  getDeadlineInfo,
  jobShareMessage,
  formatSalary,
  type ApplicationStatus,
} from '@cinecraft/core';
import {
  fetchHiringJobs,
  fetchAnalytics,
  setApplicationStatus,
  setShortlisted,
  setJobOpen,
  deleteJob,
  type HiringJob,
  type HiringApplicant,
} from '../../services/jobsApi';

type Tab = 'pipeline' | 'list' | 'analytics';
type Sort = 'match' | 'newest' | 'rating';

const NEXT_STAGE: Partial<Record<ApplicationStatus, ApplicationStatus>> = {
  pending: 'reviewing',
  reviewing: 'interviewing',
  interviewing: 'offered',
  offered: 'accepted',
};

const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export const ManagePostingsScreen = ({ navigation, route }: { navigation: any; route?: any }) => {
  const { themeColors } = useUserSettings();
  const T = themeColors;
  const [jobs, setJobs] = useState<HiringJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(route?.params?.jobId || null);
  const [tab, setTab] = useState<Tab>('pipeline');
  const [stageFilter, setStageFilter] = useState<ApplicationStatus | 'all'>('all');
  const [sort, setSort] = useState<Sort>('match');
  const [openApplicantId, setOpenApplicantId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ visible: boolean; edit?: HiringJob | null; duplicate?: HiringJob | null }>({ visible: false });
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [busyJob, setBusyJob] = useState(false);
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (uid: string) => {
    try {
      // Postings whose deadline passed are closed in the database before we read them.
      await (getSupabaseClient() as any).rpc('close_overdue_jobs');
      const list = await fetchHiringJobs(uid);
      setJobs(list);
      setSelectedJobId((cur) => (cur && list.some((j) => j.id === cur) ? cur : list.find((j) => !j.is_draft)?.id || list[0]?.id || null));
    } catch (e) {
      console.warn('[ManagePostings] Fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await getSupabaseClient().auth.getUser();
      if (!user || !active) return setLoading(false);
      setUserId(user.id);
      load(user.id);
    })();
    return () => {
      active = false;
    };
  }, [load]);

  // New applications and status changes by teammates appear without pulling to refresh.
  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`manage_postings_${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_applications' }, () => {
        if (refetchTimer.current) clearTimeout(refetchTimer.current);
        refetchTimer.current = setTimeout(() => load(userId), 600);
      })
      .subscribe();
    return () => {
      if (refetchTimer.current) clearTimeout(refetchTimer.current);
      supabase.removeChannel(channel);
    };
  }, [userId, load]);

  const refetch = useCallback(() => {
    if (userId) load(userId);
  }, [userId, load]);

  const drafts = useMemo(() => jobs.filter((j) => j.is_draft), [jobs]);
  const published = useMemo(() => jobs.filter((j) => !j.is_draft), [jobs]);
  const job = jobs.find((j) => j.id === selectedJobId) || null;

  useEffect(() => {
    setStageFilter('all');
    setAnalytics(null);
  }, [selectedJobId]);

  useEffect(() => {
    if (tab !== 'analytics' || !job || job.is_draft) return;
    setAnalyticsLoading(true);
    fetchAnalytics(job.id)
      .then(setAnalytics)
      .catch(() => setAnalytics(null))
      .finally(() => setAnalyticsLoading(false));
  }, [tab, job?.id]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    (job?.applications || []).forEach((a) => (c[a.status] = (c[a.status] || 0) + 1));
    return c;
  }, [job]);

  const visibleApplicants = useMemo(() => {
    let list = [...(job?.applications || [])];
    if (tab === 'pipeline' && stageFilter !== 'all') list = list.filter((a) => a.status === stageFilter);
    if (tab === 'list') {
      list.sort((a, b) =>
        sort === 'match' ? b.match.score - a.match.score : sort === 'rating' ? (b.rating || 0) - (a.rating || 0) : +new Date(b.created_at) - +new Date(a.created_at)
      );
    }
    return list;
  }, [job, tab, stageFilter, sort]);

  const openApplicant: HiringApplicant | null = job?.applications.find((a) => a.id === openApplicantId) || null;

  const guard = async (fn: () => Promise<void>, ok?: string) => {
    setBusyJob(true);
    try {
      await fn();
      refetch();
      if (ok) Alert.alert(ok);
    } catch (e: any) {
      Alert.alert('Something went wrong', e?.message || 'Please try again.');
    } finally {
      setBusyJob(false);
    }
  };

  const advance = (a: HiringApplicant) => {
    const next = NEXT_STAGE[a.status];
    if (next) guard(() => setApplicationStatus(a.id, next));
  };

  const confirmDelete = (j: HiringJob) =>
    Alert.alert(`Delete "${j.title}"?`, j.is_draft ? 'This draft will be removed.' : 'The posting and all of its applications will be removed. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => guard(() => deleteJob(j.id)) },
    ]);

  const shareJob = (j: HiringJob) =>
    Share.share({ message: jobShareMessage({ ...(j as any), company: j.company_pages?.name || j.company }, j.id) }).catch(() => {});

  const exportCsv = (j: HiringJob) => {
    const rows = [['Name', 'Craft', 'Location', 'Stage', 'Match %', 'Rating', 'Shortlisted', 'Applied', 'Showreel']];
    j.applications.forEach((a) =>
      rows.push([
        a.applicant?.full_name || a.applicant?.username || '',
        a.applicant?.craft || '',
        a.applicant?.location || '',
        getStage(a.status).label,
        String(a.match.score),
        a.rating ? String(a.rating) : '',
        a.is_shortlisted ? 'Yes' : '',
        new Date(a.created_at).toLocaleDateString(),
        a.showreel_url || '',
      ])
    );
    Share.share({ title: `${j.title} – applicants`, message: rows.map((r) => r.map(csvCell).join(',')).join('\n') }).catch(() => {});
  };

  const messageApplicant = (a: HiringApplicant) => {
    setOpenApplicantId(null);
    navigation.navigate('Conversation', { recipientId: a.applicant_id, recipientName: a.applicant?.full_name || a.applicant?.username });
  };

  const jobState = (j: HiringJob) => {
    const dl = getDeadlineInfo(j.deadline);
    if (j.is_draft) return { label: 'DRAFT', color: '#64748B' };
    if (!j.is_active || dl?.expired) return { label: 'CLOSED', color: '#EF4444' };
    return { label: 'LIVE', color: '#10B981' };
  };

  const ApplicantRow = ({ a }: { a: HiringApplicant }) => {
    const p = a.applicant;
    const name = p?.full_name || p?.username || 'Applicant';
    const next = NEXT_STAGE[a.status];
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={() => setOpenApplicantId(a.id)} style={[styles.applicantCard, { backgroundColor: T.bgCard, borderColor: T.border }]}>
        <View style={styles.row}>
          {p?.avatar_url ? (
            <CachedImage uri={p.avatar_url} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={{ color: ORANGE, fontWeight: '800', fontSize: 16 }}>{name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.applicantName, { color: T.textPrimary }]} numberOfLines={1}>{name}</Text>
            <Text style={{ color: T.textSecondary, fontSize: 11.5 }} numberOfLines={1}>
              {[p?.craft, p?.location].filter(Boolean).join(' · ') || 'No craft or location added'}
            </Text>
          </View>
          <MatchBadge match={a.match} />
          <TouchableOpacity
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => guard(() => setShortlisted([a.id], !a.is_shortlisted))}
            style={[styles.starBtn, a.is_shortlisted && { backgroundColor: 'rgba(245,158,11,0.18)' }]}
          >
            <Icon name="star" size={15} color={a.is_shortlisted ? '#F59E0B' : '#94A3B8'} fill={a.is_shortlisted ? '#F59E0B' : 'none'} />
          </TouchableOpacity>
        </View>
        <View style={[styles.row, { marginTop: 10, justifyContent: 'space-between' }]}>
          <View style={styles.row}>
            <StageBadge status={a.status} />
            <StarRating value={a.rating} readOnly size={13} />
          </View>
          <Text style={{ color: T.textMuted, fontSize: 11 }}>{new Date(a.created_at).toLocaleDateString()}</Text>
        </View>
        {tab === 'pipeline' && next && (
          <TouchableOpacity style={[styles.nextBtn, { borderColor: getStage(next).color }]} onPress={() => advance(a)}>
            <Text style={{ color: getStage(next).color, fontSize: 12, fontWeight: '800' }}>Move to {getStage(next).label}</Text>
            <Icon name="chevron-right" size={14} color={getStage(next).color} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const DraftRow = ({ j }: { j: HiringJob }) => (
    <View style={[styles.draftCard, { backgroundColor: T.bgCard, borderColor: T.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: T.textPrimary, fontWeight: '800', fontSize: 13.5 }} numberOfLines={1}>{j.title || 'Untitled draft'}</Text>
        <Text style={{ color: T.textMuted, fontSize: 11.5 }}>Draft · only you can see it</Text>
      </View>
      <TouchableOpacity style={[styles.smallBtn, { borderColor: T.border }]} onPress={() => setEditor({ visible: true, edit: j })}>
        <Text style={styles.smallBtnText}>Continue</Text>
      </TouchableOpacity>
      <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => confirmDelete(j)}>
        <Icon name="trash-2" size={16} color="#EF4444" />
      </TouchableOpacity>
    </View>
  );

  const Stat = ({ label, value }: { label: string; value: number | string }) => (
    <View style={[styles.statBox, { backgroundColor: T.bgCard, borderColor: T.border }]}>
      <Text style={{ color: T.textPrimary, fontSize: 22, fontWeight: '800' }}>{value}</Text>
      <Text style={{ color: T.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.6, marginTop: 2 }}>{label}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: T.bgScreen }]}>
        <Header title="Manage Postings" showLogo={false} onBack={() => navigation.goBack()} />
        <View style={styles.center}><ActivityIndicator size="large" color={ORANGE} /></View>
      </View>
    );
  }

  const state = job ? jobState(job) : null;
  const dl = job ? getDeadlineInfo(job.deadline) : null;
  const pay = job ? formatSalary(job as any) : null;
  const total = job?.applications.length || 0;

  return (
    <View style={[styles.container, { backgroundColor: T.bgScreen }]}>
      <Header
        title="Manage Postings"
        showLogo={false}
        onBack={() => navigation.goBack()}
        rightAction={
          <TouchableOpacity onPress={() => setEditor({ visible: true })} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityLabel="Post a job">
            <Icon name="plus" size={22} color={ORANGE} />
          </TouchableOpacity>
        }
      />

      {jobs.length === 0 ? (
        <View style={styles.center}>
          <Icon name="briefcase" size={40} color={T.textMuted} />
          <Text style={[styles.emptyTitle, { color: T.textPrimary }]}>No Job Postings Found</Text>
          <Text style={{ color: T.textSecondary, fontSize: 13, marginBottom: 14 }}>You have not posted any production openings yet.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setEditor({ visible: true })}>
            <Text style={styles.primaryBtnText}>Post a job</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); refetch(); }} tintColor={ORANGE} />}
        >
          {drafts.length > 0 && (
            <>
              <Text style={[styles.sectionHeader, { color: T.textSecondary }]}>DRAFTS ({drafts.length})</Text>
              {drafts.map((d) => <DraftRow key={d.id} j={d} />)}
            </>
          )}

          {published.length > 0 && (
            <>
              <Text style={[styles.sectionHeader, { color: T.textSecondary, marginTop: drafts.length ? 14 : 0 }]}>YOUR JOB POSTINGS ({published.length})</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                {published.map((j) => {
                  const on = j.id === selectedJobId;
                  const st = jobState(j);
                  return (
                    <TouchableOpacity
                      key={j.id}
                      style={[styles.jobPill, { backgroundColor: on ? 'rgba(255,75,51,0.08)' : T.bgCard, borderColor: on ? ORANGE : T.border }]}
                      onPress={() => setSelectedJobId(j.id)}
                    >
                      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: st.color }} />
                      <Text style={{ color: on ? ORANGE : T.textSecondary, fontSize: 12.5, fontWeight: '700', maxWidth: 150 }} numberOfLines={1}>{j.title}</Text>
                      <View style={[styles.countBadge, { backgroundColor: on ? ORANGE : '#94A3B8' }]}>
                        <Text style={styles.countText}>{j.applications.length}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}

          {job && !job.is_draft && (
            <View style={[styles.jobCard, { backgroundColor: T.bgCard, borderColor: T.border }]}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.jobTitle, { color: T.textPrimary }]}>{job.title}</Text>
                  <Text style={{ color: T.textSecondary, fontSize: 12.5, marginTop: 2 }}>
                    {job.company_pages?.name || job.company}{pay ? ` · ${pay}` : ''}
                  </Text>
                  {dl && (
                    <Text style={{ color: dl.urgent ? '#F59E0B' : T.textMuted, fontSize: 11, fontWeight: '800', marginTop: 4, letterSpacing: 0.4 }}>
                      {dl.label.toUpperCase()}
                    </Text>
                  )}
                </View>
                {state && (
                  <View style={[styles.statePill, { backgroundColor: `${state.color}22` }]}>
                    <Text style={{ color: state.color, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 }}>{state.label}</Text>
                  </View>
                )}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={[styles.smallBtn, { borderColor: T.border }]} onPress={() => setEditor({ visible: true, edit: job })}>
                    <Icon name="edit" size={13} color={ORANGE} /><Text style={styles.smallBtnText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.smallBtn, { borderColor: T.border }]} onPress={() => setEditor({ visible: true, duplicate: job })}>
                    <Icon name="copy" size={13} color={ORANGE} /><Text style={styles.smallBtnText}>Duplicate</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.smallBtn, { borderColor: T.border }]} onPress={() => shareJob(job)}>
                    <Icon name="share" size={13} color={ORANGE} /><Text style={styles.smallBtnText}>Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.smallBtn, { borderColor: T.border }]} disabled={busyJob} onPress={() => guard(() => setJobOpen(job.id, !job.is_active || !!dl?.expired))}>
                    <Icon name={job.is_active && !dl?.expired ? 'lock' : 'refresh-cw'} size={13} color={ORANGE} />
                    <Text style={styles.smallBtnText}>{job.is_active && !dl?.expired ? 'Close' : 'Reopen'}</Text>
                  </TouchableOpacity>
                  {total > 0 && (
                    <TouchableOpacity style={[styles.smallBtn, { borderColor: T.border }]} onPress={() => exportCsv(job)}>
                      <Icon name="download" size={13} color={ORANGE} /><Text style={styles.smallBtnText}>Export</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[styles.smallBtn, { borderColor: 'rgba(239,68,68,0.4)' }]} onPress={() => confirmDelete(job)}>
                    <Icon name="trash-2" size={13} color="#EF4444" /><Text style={[styles.smallBtnText, { color: '#EF4444' }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>

              {/* Tabs */}
              <View style={[styles.tabs, { backgroundColor: T.inputBg }]}>
                {([['pipeline', 'Pipeline'], ['list', 'List'], ['analytics', 'Analytics']] as [Tab, string][]).map(([k, label]) => (
                  <TouchableOpacity key={k} style={[styles.tab, tab === k && { backgroundColor: T.bgCard }]} onPress={() => setTab(k)}>
                    <Text style={{ color: tab === k ? ORANGE : T.textSecondary, fontSize: 12.5, fontWeight: '800' }}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {tab === 'pipeline' && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {[{ key: 'all' as const, label: 'All', color: ORANGE, tint: 'rgba(255,75,51,0.14)', n: total }, ...PIPELINE_STAGES.map((s) => ({ key: s.key, label: s.label, color: s.color, tint: s.tint, n: counts[s.key] || 0 }))].map((s) => {
                      const on = stageFilter === s.key;
                      return (
                        <TouchableOpacity
                          key={s.key}
                          onPress={() => setStageFilter(s.key)}
                          style={[styles.stageChip, { borderColor: on ? s.color : T.border, backgroundColor: on ? s.tint : 'transparent' }]}
                        >
                          <Text style={{ color: on ? s.color : T.textSecondary, fontSize: 12, fontWeight: '800' }}>{s.label}</Text>
                          <Text style={{ color: on ? s.color : T.textMuted, fontSize: 12, fontWeight: '800' }}>{s.n}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              )}

              {tab === 'list' && total > 1 && (
                <View style={[styles.row, { marginTop: 12, gap: 8 }]}>
                  <Text style={{ color: T.textMuted, fontSize: 11, fontWeight: '800' }}>SORT</Text>
                  {([['match', 'Best match'], ['rating', 'Rating'], ['newest', 'Newest']] as [Sort, string][]).map(([k, label]) => (
                    <TouchableOpacity key={k} onPress={() => setSort(k)} style={[styles.sortChip, { backgroundColor: sort === k ? ORANGE : T.inputBg }]}>
                      <Text style={{ color: sort === k ? '#fff' : T.textSecondary, fontSize: 11.5, fontWeight: '700' }}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={{ marginTop: 14 }}>
                {tab === 'analytics' ? (
                  analyticsLoading ? (
                    <ActivityIndicator color={ORANGE} style={{ marginVertical: 24 }} />
                  ) : !analytics || analytics.error ? (
                    <Text style={{ color: T.textMuted, textAlign: 'center', paddingVertical: 20 }}>Analytics are not available for this posting yet.</Text>
                  ) : (
                    <>
                      <View style={styles.statGrid}>
                        <Stat label="VIEWS" value={analytics.views} />
                        <Stat label="PEOPLE" value={analytics.unique_viewers} />
                        <Stat label="SAVES" value={analytics.saves} />
                        <Stat label="APPLIED" value={analytics.applications} />
                      </View>
                      <Text style={{ color: T.textSecondary, fontSize: 12, marginTop: 10 }}>
                        {analytics.unique_viewers > 0
                          ? `${Math.round((analytics.applications / analytics.unique_viewers) * 100)}% of people who viewed this job applied.`
                          : 'No views yet — share the job to get it in front of people.'}
                      </Text>
                      <Text style={[styles.sectionHeader, { color: T.textSecondary, marginTop: 16 }]}>HIRING FUNNEL</Text>
                      {PIPELINE_STAGES.map((s) => {
                        const n = analytics.by_status?.[s.key] || 0;
                        const pct = analytics.applications ? (n / analytics.applications) * 100 : 0;
                        return (
                          <View key={s.key} style={{ marginBottom: 10 }}>
                            <View style={[styles.row, { justifyContent: 'space-between' }]}>
                              <Text style={{ color: T.textPrimary, fontSize: 12.5, fontWeight: '700' }}>{s.label}</Text>
                              <Text style={{ color: T.textSecondary, fontSize: 12.5, fontWeight: '700' }}>{n}</Text>
                            </View>
                            <View style={[styles.bar, { backgroundColor: T.inputBg }]}>
                              <View style={{ width: `${pct}%`, height: '100%', borderRadius: 4, backgroundColor: s.color }} />
                            </View>
                          </View>
                        );
                      })}
                      {(analytics.daily || []).length > 0 && (
                        <>
                          <Text style={[styles.sectionHeader, { color: T.textSecondary, marginTop: 8 }]}>LAST 14 DAYS</Text>
                          <View style={styles.chart}>
                            {(analytics.daily as any[]).slice(-14).map((d) => {
                              const max = Math.max(1, ...(analytics.daily as any[]).map((x) => x.views));
                              return (
                                <View key={d.day} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
                                  <View style={{ width: '70%', height: Math.max(3, (d.views / max) * 70), backgroundColor: ORANGE, borderRadius: 3, opacity: 0.85 }} />
                                </View>
                              );
                            })}
                          </View>
                        </>
                      )}
                    </>
                  )
                ) : visibleApplicants.length === 0 ? (
                  <View style={[styles.emptyBox, { backgroundColor: T.inputBg, borderColor: T.border }]}>
                    <Text style={{ color: T.textMuted, fontSize: 12.5 }}>
                      {total === 0 ? 'No applicants for this role yet.' : 'Nobody in this stage.'}
                    </Text>
                  </View>
                ) : (
                  visibleApplicants.map((a) => <ApplicantRow key={a.id} a={a} />)
                )}
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {userId && (
        <ApplicantSheet
          applicant={openApplicant}
          job={job}
          userId={userId}
          onClose={() => setOpenApplicantId(null)}
          onChanged={refetch}
          onMessage={messageApplicant}
        />
      )}

      <CreateJobModal
        visible={editor.visible}
        jobToEdit={editor.edit || null}
        duplicateFrom={editor.duplicate || null}
        onClose={() => setEditor({ visible: false })}
        onCreated={refetch}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '800' },
  content: { padding: 16, paddingBottom: 60 },
  sectionHeader: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  jobPill: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8, gap: 7 },
  countBadge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  countText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  jobCard: { borderRadius: 18, padding: 14, borderWidth: 1 },
  jobTitle: { fontSize: 17, fontWeight: '800' },
  statePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  smallBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  smallBtnText: { color: ORANGE, fontSize: 12, fontWeight: '800' },
  tabs: { flexDirection: 'row', borderRadius: 12, padding: 3, marginTop: 14 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
  stageChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  sortChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  applicantCard: { borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { backgroundColor: 'rgba(255,75,51,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,75,51,0.2)' },
  applicantName: { fontSize: 14, fontWeight: '800' },
  starBtn: { padding: 6, borderRadius: 8 },
  nextBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderRadius: 10, height: 34, marginTop: 10 },
  draftCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 14, padding: 12, marginBottom: 8 },
  emptyBox: { borderRadius: 12, borderWidth: 1, padding: 18, alignItems: 'center' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statBox: { width: '48%', borderWidth: 1, borderRadius: 14, padding: 12 },
  bar: { height: 8, borderRadius: 4, marginTop: 5, overflow: 'hidden' },
  chart: { flexDirection: 'row', height: 76, alignItems: 'flex-end', gap: 3 },
  primaryBtn: { backgroundColor: ORANGE, borderRadius: 12, paddingHorizontal: 22, height: 44, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13.5 },
});

export default ManagePostingsScreen;
