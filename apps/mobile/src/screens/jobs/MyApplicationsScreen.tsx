import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { getSupabaseClient } from '@cinecraft/api';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { useUserSettings } from '../../hooks/useUserSettings';
import { addInterviewToCalendar, ORANGE } from '../../components/jobs/JobsShared';
import { getStage, stageProgress, formatSalary, JOB_TYPE_LABELS, INTERVIEW_MODE_LABELS } from '@cinecraft/core';
import { respondToInterview } from '../../services/jobsApi';

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const ago = (iso: string) => {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString();
};

export const MyApplicationsScreen = ({ navigation }: { navigation: any }) => {
  const { themeColors: T } = useUserSettings();
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyInterview, setBusyInterview] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const supabase = getSupabaseClient() as any;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data, error } = await supabase
        .from('job_applications')
        .select('id, status, created_at, status_updated_at, rejection_reason, jobs:job_id (id, title, company, location, type, salary_min, salary_max, currency, pay_period)')
        .eq('applicant_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data || []) as any[];
      const byApp: Record<string, any[]> = {};
      if (rows.length) {
        const { data: ivs } = await supabase
          .from('job_interviews')
          .select('id, application_id, scheduled_at, duration_minutes, mode, location, notes, status')
          .in('application_id', rows.map((r) => r.id))
          .order('scheduled_at', { ascending: true });
        (ivs || []).forEach((iv: any) => (byApp[iv.application_id] ||= []).push(iv));
      }
      setApplications(rows.map((r) => ({ ...r, interviews: byApp[r.id] || [] })));
    } catch (e) {
      console.warn('[MyApplications] fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Status changes and interview invites arrive without pulling to refresh.
  useEffect(() => {
    if (!userId) return;
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`my_applications_${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_applications', filter: `applicant_id=eq.${userId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_interviews' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, load]);

  const respond = async (interviewId: string, accept: boolean) => {
    setBusyInterview(interviewId);
    try {
      await respondToInterview(interviewId, accept);
      load();
    } catch (e: any) {
      Alert.alert('Could not update the interview', e?.message || 'Please try again.');
    } finally {
      setBusyInterview(null);
    }
  };

  const withdraw = (appId: string) =>
    Alert.alert('Withdraw application', 'Are you sure you want to withdraw this application?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Withdraw',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await (getSupabaseClient() as any).from('job_applications').delete().eq('id', appId);
            if (error) throw error;
            setApplications((prev) => prev.filter((a) => a.id !== appId));
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Could not withdraw the application.');
          }
        },
      },
    ]);

  return (
    <View style={[styles.container, { backgroundColor: T.bgScreen }]}>
      <Header title="My Applications" showLogo={false} onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={ORANGE} />}
      >
        {loading ? (
          <ActivityIndicator color={ORANGE} style={{ marginTop: 40 }} />
        ) : applications.length === 0 ? (
          <View style={{ alignItems: 'center', marginTop: 60 }}>
            <Icon name="file-text" size={36} color={T.textMuted} />
            <Text style={{ color: T.textPrimary, fontSize: 17, fontWeight: '800', marginTop: 10 }}>No applications yet</Text>
            <Text style={{ color: T.textMuted, marginTop: 4, textAlign: 'center' }}>Your applications will show up here as you apply.</Text>
            <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.primaryBtnText}>Discover jobs</Text>
            </TouchableOpacity>
          </View>
        ) : (
          applications.map((app) => {
            const stage = getStage(app.status);
            const progress = stageProgress(app.status);
            const job = app.jobs;
            const pay = job ? formatSalary(job) : null;
            const open = (app.interviews || []).filter((i: any) => i.status === 'proposed' || i.status === 'confirmed');
            return (
              <View key={app.id} style={[styles.appCard, { backgroundColor: T.bgCard, borderColor: T.border }]}>
                <TouchableOpacity activeOpacity={0.8} disabled={!job} onPress={() => navigation.navigate('JobDetail', { jobId: job.id, jobTitle: job.title })}>
                  <View style={styles.headerRow}>
                    <Text style={[styles.title, { color: T.textPrimary }]} numberOfLines={2}>{job?.title || 'Job removed'}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: stage.tint }]}>
                      <Text style={[styles.statusText, { color: stage.color }]}>{stage.applicantLabel.toUpperCase()}</Text>
                    </View>
                  </View>
                  <View style={styles.companyRow}>
                    <Icon name="briefcase" size={13} color={T.textSecondary} />
                    <Text style={{ color: T.textSecondary, fontSize: 12.5, fontWeight: '600' }}>{job?.company}</Text>
                  </View>
                </TouchableOpacity>

                {/* Progress */}
                <View style={{ flexDirection: 'row', gap: 5, marginTop: 12 }}>
                  {Array.from({ length: progress.total }).map((_, i) => (
                    <View key={i} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: progress.stopped ? stage.tint : i <= progress.index ? stage.color : 'rgba(148,163,184,0.25)' }} />
                  ))}
                </View>
                <Text style={{ color: T.textMuted, fontSize: 11, marginTop: 6 }}>
                  {app.status_updated_at && app.status !== 'pending' ? `Updated ${ago(app.status_updated_at)}` : 'Waiting for the hiring team to look at it'}
                </Text>
                {app.status === 'rejected' && app.rejection_reason ? (
                  <View style={[styles.reason, { backgroundColor: stage.tint }]}>
                    <Text style={{ color: stage.color, fontSize: 12.5 }}>{app.rejection_reason}</Text>
                  </View>
                ) : null}

                {/* Interviews */}
                {open.map((iv: any) => (
                  <View key={iv.id} style={styles.ivCard}>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <View style={styles.ivIcon}>
                        <Icon name="calendar" size={18} color="#3B82F6" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: T.textPrimary, fontSize: 13, fontWeight: '800' }}>
                          {iv.status === 'confirmed' ? 'Interview confirmed' : 'Interview invitation'}
                        </Text>
                        <Text style={{ color: T.textPrimary, fontSize: 13, fontWeight: '700', marginTop: 2 }}>
                          {fmtWhen(iv.scheduled_at)} · {iv.duration_minutes} min
                        </Text>
                        <Text style={{ color: T.textSecondary, fontSize: 11.5, marginTop: 2 }}>
                          {iv.location || INTERVIEW_MODE_LABELS[iv.mode as keyof typeof INTERVIEW_MODE_LABELS]}
                        </Text>
                        {iv.notes ? <Text style={{ color: T.textSecondary, fontSize: 11.5, marginTop: 2 }}>{iv.notes}</Text> : null}
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                      {iv.status === 'proposed' ? (
                        <>
                          <TouchableOpacity style={[styles.ivBtn, { backgroundColor: ORANGE, opacity: busyInterview === iv.id ? 0.6 : 1 }]} disabled={busyInterview === iv.id} onPress={() => respond(iv.id, true)}>
                            <Icon name="check" size={14} color="#fff" />
                            <Text style={{ color: '#fff', fontSize: 12.5, fontWeight: '800' }}>Confirm</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.ivBtn, { borderWidth: 1, borderColor: T.border }]} disabled={busyInterview === iv.id} onPress={() => respond(iv.id, false)}>
                            <Icon name="x" size={14} color={T.textPrimary} />
                            <Text style={{ color: T.textPrimary, fontSize: 12.5, fontWeight: '800' }}>Decline</Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        <>
                          <TouchableOpacity
                            style={[styles.ivBtn, { borderWidth: 1, borderColor: T.border }]}
                            onPress={() => addInterviewToCalendar({ title: `Interview: ${job?.title || 'Job'}`, startsAt: iv.scheduled_at, durationMinutes: iv.duration_minutes, location: iv.location, notes: iv.notes })}
                          >
                            <Icon name="calendar" size={14} color={T.textPrimary} />
                            <Text style={{ color: T.textPrimary, fontSize: 12.5, fontWeight: '800' }}>Add to calendar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.ivBtn} disabled={busyInterview === iv.id} onPress={() => respond(iv.id, false)}>
                            <Text style={{ color: '#EF4444', fontSize: 12.5, fontWeight: '800' }}>Can't make it</Text>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                ))}

                <View style={styles.footerRow}>
                  <Text style={{ color: T.textMuted, fontSize: 11, flex: 1 }} numberOfLines={1}>
                    {[job?.location, job ? JOB_TYPE_LABELS[job.type as keyof typeof JOB_TYPE_LABELS] || job.type : null, pay].filter(Boolean).join(' · ')}
                  </Text>
                  <Text style={{ color: T.textMuted, fontSize: 11 }}>Applied {ago(app.created_at)}</Text>
                  {(app.status === 'pending' || app.status === 'reviewing') && (
                    <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} onPress={() => withdraw(app.id)}>
                      <Icon name="trash-2" size={15} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 14, paddingBottom: 40 },
  appCard: { borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 },
  title: { fontSize: 15, fontWeight: '800', flex: 1 },
  statusBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  statusText: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.5 },
  companyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reason: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginTop: 8 },
  ivCard: { borderWidth: 1, borderColor: 'rgba(59,130,246,0.35)', backgroundColor: 'rgba(59,130,246,0.06)', borderRadius: 14, padding: 12, marginTop: 12 },
  ivIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(59,130,246,0.14)', alignItems: 'center', justifyContent: 'center' },
  ivBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 36, borderRadius: 10, justifyContent: 'center' },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(148,163,184,0.3)' },
  primaryBtn: { backgroundColor: ORANGE, borderRadius: 12, paddingHorizontal: 22, height: 44, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13.5 },
});

export default MyApplicationsScreen;
