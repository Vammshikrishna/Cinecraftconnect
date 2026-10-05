import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Linking,
  InteractionManager,
} from 'react-native';
import { Header } from '../../components/Header';
import { Icon } from '../../components/common/Icon';
import { getSupabaseClient } from '@cinecraft/api';
import { EditPageModal, ManageMembersModal } from '../../components/modals';
import { TabletContainer } from '../../components/common/TabletContainer';
import { CachedImage } from '../../components/common/CachedImage';
import { useUserSettings } from '../../hooks/useUserSettings';
import { UniversalShareSheet } from '../../components/common/UniversalShareSheet';
import { ReportModal } from '../../components/modals/ReportModal';
import { CreateJobModal } from '../../components/modals/CreateJobModal';
import { useAccountType } from '../../hooks/useAccountType';
import { PageInsightsPanel, PageShowcasePanel, PageVerificationModal } from '../../components/pages/PageGrowth';
import { PageAnnouncementsPanel } from '../../components/announcements/PageAnnouncementsPanel';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

export const CompanyPageDetailScreen = ({ route, navigation }: { route: any; navigation: any }) => {
  const { pageId, pageSlug } = route.params || {};
  const { themeColors, isDark } = useUserSettings();

  const [page, setPage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [pageRole, setPageRole] = useState<string | null>(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const { isFan } = useAccountType();
  const [activeTab, setActiveTab] = useState<'about' | 'posts' | 'announcements' | 'jobs' | 'showcase' | 'team' | 'insights'>('about');
  const [jobs, setJobs] = useState<any[]>([]);
  const [invite, setInvite] = useState<any | null>(null);
  const [teamBusy, setTeamBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [jobModalVisible, setJobModalVisible] = useState(false);

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [membersModalVisible, setMembersModalVisible] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);

  const fetchPageDetails = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseClient();

      const user = (await supabase.auth.getSession()).data.session?.user ?? null; // local session: getUser() is a network call
      if (user) setCurrentUserId(user.id);

      let query = ((supabase as any).from('company_pages') as any).select('*');
      if (pageId) {
        query = query.eq('id', pageId);
      } else if (pageSlug) {
        query = query.eq('slug', pageSlug);
      }
      const { data, error } = await query.single();

      if (!error && data) {
        setPage(data);
        setFollowerCount(data.follower_count || 0);
        // count a view (the database ignores the team's own visits and repeats within 12 hours)
        if (user) (supabase as any).rpc('record_page_view', { p_page_id: data.id }).then(() => {}, () => {});

        if (user) {
          const { data: follow } = await ((supabase as any).from('company_page_followers') as any)
            .select('id')
            .eq('page_id', data.id)
            .eq('user_id', user.id)
            .maybeSingle();

          if (follow) setIsFollowing(true);
        }

        // Fetch Posts
        try {
          const { data: postsData } = await ((supabase as any).from('posts') as any)
            .select('*')
            .eq('page_id', data.id)
            .order('created_at', { ascending: false })
            .limit(30);

          if (postsData) setPosts(postsData);
        } catch (e) {}

        // Open jobs of this company
        try {
          const { data: jobsData } = await ((supabase as any).from('jobs') as any)
            .select('*')
            .eq('page_id', data.id)
            .eq('is_active', true)
            .eq('is_draft', false)
            .order('created_at', { ascending: false })
            .limit(30);
          const now = Date.now();
          setJobs((jobsData || []).filter((j: any) => !j.deadline || new Date(j.deadline).getTime() > now));
        } catch (e) {}

        // An invitation to join this team, waiting for an answer
        setInvite(null);
        if (user && data.owner_id !== user.id) {
          try {
            const { data: inv } = await ((supabase as any).from('company_page_invites') as any)
              .select('id, title, department')
              .eq('page_id', data.id)
              .eq('invitee_id', user.id)
              .eq('status', 'pending')
              .maybeSingle();
            setInvite(inv || null);
          } catch (e) {}
        }

        // Page admins can edit the page and manage the team (team members are only listed)
        if (user && data.owner_id !== user.id) {
          try {
            const { data: adminRow } = await ((supabase as any).from('company_page_admins') as any)
              .select('role')
              .eq('page_id', data.id)
              .eq('user_id', user.id)
              .maybeSingle();
            setPageRole(adminRow?.role || null);
          } catch (e) {}
        }

        // Fetch Members
        try {
          const { data: membersData } = await ((supabase as any).from('company_page_members') as any)
            .select(`
              *,
              profiles:user_id (
                id,
                full_name,
                username,
                avatar_url
              )
            `)
            .eq('page_id', data.id);

          if (membersData) setMembers(membersData);
        } catch (e) {}
      }
    } catch (e) {
      console.warn('[CompanyPageDetail] Error:', e);
    } finally {
      setLoading(false);
    }
  }, [pageId, pageSlug]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      fetchPageDetails();
    });
    return () => task.cancel();
  }, [fetchPageDetails]);

  const toggleFollow = async () => {
    if (!currentUserId || !page) return;
    const nextState = !isFollowing;
    setIsFollowing(nextState);
    setFollowerCount((prev) => (nextState ? prev + 1 : Math.max(0, prev - 1)));

    try {
      const supabase = getSupabaseClient();
      let error: any = null;
      if (!nextState) {
        ({ error } = await ((supabase as any).from('company_page_followers') as any)
          .delete()
          .eq('page_id', page.id)
          .eq('user_id', currentUserId));
      } else {
        ({ error } = await ((supabase as any).from('company_page_followers') as any).insert({
          page_id: page.id,
          user_id: currentUserId,
        }));
      }
      if (error) throw error;
    } catch (e) {
      console.warn('Toggle follow error:', e);
      setIsFollowing(!nextState);
      setFollowerCount((prev) => (nextState ? Math.max(0, prev - 1) : prev + 1));
    }
  };

  const handleDeletePage = () => {
    Alert.alert(
      'Delete Company Page',
      'Are you sure you want to delete this company page? This action is permanent.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const supabase = getSupabaseClient();
              const { error } = await ((supabase as any).from('company_pages') as any)
                .delete()
                .eq('id', page.id);

              if (error) throw error;
              navigation.goBack();
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to delete page.');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.bgScreen }]}>
        <Header showLogo={false} onBack={() => navigation.goBack()} />
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={ORANGE} />
        </View>
      </View>
    );
  }

  if (!page) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.bgScreen }]}>
        <Header showLogo={false} onBack={() => navigation.goBack()} />
        <View style={styles.loadingCenter}>
          <Icon name="company" size={48} color={themeColors.textMuted} />
          <Text style={[styles.notFoundTitle, { color: themeColors.textPrimary }]}>Page Not Found</Text>
          <Text style={[styles.notFoundSub, { color: themeColors.textSecondary }]}>The requested company page does not exist.</Text>
        </View>
      </View>
    );
  }

  const isOwner = !!(currentUserId && page.owner_id && currentUserId === page.owner_id);
  const isPageAdmin = pageRole === 'super_admin' || pageRole === 'content_admin';
  const isManager = isOwner || isPageAdmin;
  const canSeeInsights = isOwner || !!pageRole;
  const isMember = !!currentUserId && members.some((m) => m.user_id === currentUserId);

  const answerInvite = async (accept: boolean) => {
    if (!invite) return;
    setTeamBusy(true);
    try {
      const { data, error } = await (getSupabaseClient() as any).rpc('respond_page_invite', { p_invite_id: invite.id, p_accept: accept });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.message);
      setInvite(null);
      fetchPageDetails();
    } catch (e: any) {
      Alert.alert('Could not answer', e?.message || 'Please try again.');
    } finally {
      setTeamBusy(false);
    }
  };

  const leaveTeam = () =>
    Alert.alert(`Leave the ${page.name} team?`, undefined, [
      { text: 'Stay', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          setTeamBusy(true);
          try {
            const { data, error } = await (getSupabaseClient() as any).rpc('leave_page_team', { p_page_id: page.id });
            if (error) throw error;
            if (data?.success === false) throw new Error(data.message);
            fetchPageDetails();
          } catch (e: any) {
            Alert.alert('Could not leave', e?.message || 'Please try again.');
          } finally {
            setTeamBusy(false);
          }
        },
      },
    ]);
  const initialChar = (page.name || 'S').charAt(0).toUpperCase();

  let industries: string[] = [];
  if (Array.isArray(page.industry)) {
    industries = page.industry;
  } else if (typeof page.industry === 'string') {
    industries = page.industry.split(',');
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bgScreen }]}>
      <Header
        title={page.name}
        showLogo={false}
        onBack={() => navigation.goBack()}
        rightAction={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {!!currentUserId && !isManager && (
              <TouchableOpacity onPress={() => setReportOpen(true)} style={{ padding: 6 }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Icon name="flag" size={18} color={themeColors.textSecondary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setShowShareSheet(true)}
              style={{ padding: 6 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="share" size={20} color={themeColors.textPrimary} />
            </TouchableOpacity>
          </View>
        }
      />

      <TabletContainer maxWidth={720} backgroundColor={themeColors.bgScreen}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Cover Hero Banner */}
          <View style={styles.heroContainer}>
            {page.cover_image_url ? (
              <CachedImage uri={page.cover_image_url} style={styles.heroCoverImage} resizeMode="cover" />
            ) : (
              <View style={[styles.heroCoverGradient, { backgroundColor: isDark ? '#1F1F1F' : '#FFF7F5' }]} />
            )}

            {/* Overlapping Logo Avatar */}
            <View style={[styles.heroLogoOverlapped, { backgroundColor: themeColors.bgCard, borderColor: themeColors.bgCard }]}>
              {page.logo_url ? (
                <CachedImage uri={page.logo_url} style={styles.heroLogoImage} resizeMode="cover" />
              ) : (
                <View style={[styles.heroLogoFallback, { backgroundColor: themeColors.chipBg }]}>
                  <Text style={styles.heroLogoFallbackText}>{initialChar}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Profile Info Header */}
          <View style={styles.profileHeaderSection}>
            <View style={styles.titleRow}>
              <Text style={[styles.nameText, { color: themeColors.textPrimary }]}>{page.name}</Text>
              {!!page.is_verified && (
                <Icon name="badge-check" size={18} color={ORANGE} fill={ORANGE} />
              )}
            </View>

            {page.tagline ? <Text style={[styles.taglineText, { color: themeColors.textSecondary }]}>{page.tagline}</Text> : null}

            {/* Location & Size Pills */}
            <View style={styles.metaPillsRow}>
              {page.headquarters ? (
                <View style={[styles.metaPill, { backgroundColor: isDark ? 'rgba(255,75,51,0.12)' : '#FFF7F5', borderColor: isDark ? 'rgba(255,75,51,0.25)' : '#FFE5DF' }]}>
                  <Icon name="map-pin" size={11} color={ORANGE} />
                  <Text style={styles.metaPillText}>{page.headquarters}</Text>
                </View>
              ) : null}

              {page.company_size ? (
                <View style={[styles.metaPill, { backgroundColor: isDark ? 'rgba(255,75,51,0.12)' : '#FFF7F5', borderColor: isDark ? 'rgba(255,75,51,0.25)' : '#FFE5DF' }]}>
                  <Icon name="users" size={11} color={ORANGE} />
                  <Text style={styles.metaPillText}>{page.company_size} crew</Text>
                </View>
              ) : null}

              <View style={[styles.metaPill, { backgroundColor: isDark ? 'rgba(255,75,51,0.12)' : '#FFF7F5', borderColor: isDark ? 'rgba(255,75,51,0.25)' : '#FFE5DF' }]}>
                <Icon name="users" size={11} color={ORANGE} />
                <Text style={styles.metaPillText}>{followerCount.toLocaleString()} followers</Text>
              </View>
            </View>

            {/* Industries */}
            {industries.length > 0 && (
              <View style={styles.industriesRow}>
                {industries.map((ind, idx) => (
                  <View key={idx} style={[styles.indPill, { backgroundColor: themeColors.chipBg, borderColor: themeColors.border }]}>
                    <Text style={[styles.indPillText, { color: themeColors.textSecondary }]}>IND // {String(ind).trim().toUpperCase()}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.actionBtnRow}>
              {isManager ? (
                <>
                  <TouchableOpacity
                    style={[styles.editBtn, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}
                    onPress={() => setEditModalVisible(true)}
                  >
                    <Icon name="edit" size={14} color={themeColors.textPrimary} />
                    <Text style={[styles.editBtnText, { color: themeColors.textPrimary }]}>Edit Page</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.membersBtn, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}
                    onPress={() => setMembersModalVisible(true)}
                  >
                    <Icon name="users" size={14} color={themeColors.textPrimary} />
                    <Text style={[styles.membersBtnText, { color: themeColors.textPrimary }]}>Team ({members.length})</Text>
                  </TouchableOpacity>

                  {isOwner && !page.is_verified && (
                    <TouchableOpacity
                      style={[styles.membersBtn, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}
                      onPress={() => setVerifyOpen(true)}
                    >
                      <Icon name="badge-check" size={14} color={ORANGE} />
                      <Text style={[styles.membersBtnText, { color: themeColors.textPrimary }]}>Verify</Text>
                    </TouchableOpacity>
                  )}
                  {isOwner && (
                    <TouchableOpacity style={styles.deleteBtn} onPress={handleDeletePage}>
                      <Icon name="trash-2" size={14} color="#DC2626" />
                    </TouchableOpacity>
                  )}
                </>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.followBtn,
                    isFollowing && [styles.followBtnActive, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }],
                  ]}
                  onPress={toggleFollow}
                >
                  <Text style={[styles.followBtnText, isFollowing && [styles.followBtnTextActive, { color: themeColors.textSecondary }]]}>
                    {isFollowing ? 'Following' : '+ Follow Page'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {invite ? (
            <View style={[styles.inviteBox, { backgroundColor: 'rgba(255,75,51,0.08)', borderColor: 'rgba(255,75,51,0.3)' }]}>
              <Text style={{ color: themeColors.textPrimary, fontSize: 13.5, fontWeight: '800' }}>{page.name} invited you to join their team</Text>
              <Text style={{ color: themeColors.textSecondary, fontSize: 12, marginTop: 2 }}>
                {[invite.title, invite.department].filter(Boolean).join(' · ') || 'Team member'} · you are listed on the page once you accept.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <TouchableOpacity disabled={teamBusy} onPress={() => answerInvite(true)} style={[styles.inviteBtn, { backgroundColor: ORANGE, opacity: teamBusy ? 0.6 : 1 }]}>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12.5 }}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={teamBusy} onPress={() => answerInvite(false)} style={[styles.inviteBtn, { borderWidth: 1, borderColor: themeColors.border }]}>
                  <Text style={{ color: themeColors.textPrimary, fontWeight: '800', fontSize: 12.5 }}>Decline</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : isMember && !isOwner ? (
            <TouchableOpacity disabled={teamBusy} onPress={leaveTeam} style={{ alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 6 }}>
              <Text style={{ color: themeColors.textMuted, fontSize: 12, fontWeight: '700' }}>Leave team</Text>
            </TouchableOpacity>
          ) : null}

          {/* Tab Switcher: About | Posts | Jobs | Team */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.tabUnderlineRow, { borderBottomColor: themeColors.divider }]} contentContainerStyle={{ gap: 20, paddingRight: 8 }}>
            <TouchableOpacity
              style={[styles.tabUnderlineBtn, activeTab === 'about' && styles.tabUnderlineBtnActive]}
              onPress={() => setActiveTab('about')}
            >
              <Text style={[styles.tabUnderlineText, { color: themeColors.textSecondary }, activeTab === 'about' && styles.tabUnderlineTextActive]}>
                ABOUT
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabUnderlineBtn, activeTab === 'posts' && styles.tabUnderlineBtnActive]}
              onPress={() => setActiveTab('posts')}
            >
              <Text style={[styles.tabUnderlineText, { color: themeColors.textSecondary }, activeTab === 'posts' && styles.tabUnderlineTextActive]}>
                POSTS ({posts.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabUnderlineBtn, activeTab === 'announcements' && styles.tabUnderlineBtnActive]}
              onPress={() => setActiveTab('announcements')}
            >
              <Text style={[styles.tabUnderlineText, { color: themeColors.textSecondary }, activeTab === 'announcements' && styles.tabUnderlineTextActive]}>
                NEWS
              </Text>
            </TouchableOpacity>

            {!isFan && (
              <TouchableOpacity
                style={[styles.tabUnderlineBtn, activeTab === 'jobs' && styles.tabUnderlineBtnActive]}
                onPress={() => setActiveTab('jobs')}
              >
                <Text style={[styles.tabUnderlineText, { color: themeColors.textSecondary }, activeTab === 'jobs' && styles.tabUnderlineTextActive]}>
                  JOBS ({jobs.length})
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.tabUnderlineBtn, activeTab === 'showcase' && styles.tabUnderlineBtnActive]}
              onPress={() => setActiveTab('showcase')}
            >
              <Text style={[styles.tabUnderlineText, { color: themeColors.textSecondary }, activeTab === 'showcase' && styles.tabUnderlineTextActive]}>
                SHOWCASE
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabUnderlineBtn, activeTab === 'team' && styles.tabUnderlineBtnActive]}
              onPress={() => setActiveTab('team')}
            >
              <Text style={[styles.tabUnderlineText, { color: themeColors.textSecondary }, activeTab === 'team' && styles.tabUnderlineTextActive]}>
                TEAM ({members.length})
              </Text>
            </TouchableOpacity>

            {canSeeInsights && (
              <TouchableOpacity
                style={[styles.tabUnderlineBtn, activeTab === 'insights' && styles.tabUnderlineBtnActive]}
                onPress={() => setActiveTab('insights')}
              >
                <Text style={[styles.tabUnderlineText, { color: themeColors.textSecondary }, activeTab === 'insights' && styles.tabUnderlineTextActive]}>
                  INSIGHTS
                </Text>
              </TouchableOpacity>
            )}
          </ScrollView>

          {/* Tab Content */}
          {activeTab === 'about' && (
            <View style={[styles.sectionBox, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
              <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Overview</Text>
              <Text style={[styles.bodyText, { color: themeColors.textSecondary }]}>
                {page.description || 'No detailed overview provided for this company.'}
              </Text>

              {page.website ? (
                <TouchableOpacity
                  style={styles.websiteRow}
                  onPress={() => Linking.openURL(/^https?:\/\//i.test(page.website) ? page.website : `https://${page.website}`).catch(() => {})}
                >
                  <Icon name="globe" size={14} color={ORANGE} />
                  <Text style={styles.websiteText}>{page.website}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          {activeTab === 'posts' && (
            <View style={[styles.sectionBox, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
              <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Company Posts & Announcements</Text>
              {posts.length === 0 ? (
                <Text style={[styles.emptyText, { color: themeColors.textMuted }]}>No published posts yet.</Text>
              ) : (
                posts.map((post) => (
                  <View key={post.id} style={[styles.postCard, { borderBottomColor: themeColors.divider }]}>
                    {post.title ? <Text style={[styles.postTitle, { color: themeColors.textPrimary }]}>{post.title}</Text> : null}
                    <Text style={[styles.postContent, { color: themeColors.textPrimary }]}>{post.content}</Text>
                    <Text style={[styles.postDate, { color: themeColors.textMuted }]}>
                      {new Date(post.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                ))
              )}
            </View>
          )}

          {activeTab === 'announcements' && (
            <View style={{ marginHorizontal: 16 }}>
              <PageAnnouncementsPanel pageId={page.id} canManage={isManager} userId={currentUserId} />
            </View>
          )}

          {activeTab === 'showcase' && (
            <View style={{ marginHorizontal: 16 }}>
              <PageShowcasePanel pageId={page.id} canManage={isManager} />
            </View>
          )}

          {activeTab === 'insights' && canSeeInsights && (
            <View style={{ marginHorizontal: 16 }}>
              <PageInsightsPanel pageId={page.id} />
            </View>
          )}

          {activeTab === 'jobs' && (
            <View style={[styles.sectionBox, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={[styles.sectionTitle, { color: themeColors.textPrimary, marginBottom: 0 }]}>Open positions</Text>
                {isManager && (
                  <TouchableOpacity onPress={() => setJobModalVisible(true)} style={[styles.inviteBtn, { backgroundColor: ORANGE, paddingHorizontal: 12 }]}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>+ Post a job</Text>
                  </TouchableOpacity>
                )}
              </View>
              {jobs.length === 0 ? (
                <Text style={[styles.emptyText, { color: themeColors.textMuted }]}>No open positions right now.</Text>
              ) : (
                jobs.map((j) => (
                  <TouchableOpacity
                    key={j.id}
                    activeOpacity={0.8}
                    onPress={() => navigation.navigate('JobDetail', { jobId: j.id, jobTitle: j.title })}
                    style={[styles.postCard, { borderBottomColor: themeColors.divider }]}
                  >
                    <Text style={[styles.postTitle, { color: themeColors.textPrimary }]}>{j.title}</Text>
                    <Text style={[styles.postContent, { color: themeColors.textSecondary }]} numberOfLines={2}>{j.description}</Text>
                    <Text style={[styles.postDate, { color: themeColors.textMuted }]}>
                      {[j.location, String(j.type || '').replace('-', ' ')].filter(Boolean).join(' · ')}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}

          {activeTab === 'team' && (
            <View style={[styles.sectionBox, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
              <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Team Members</Text>
              {members.length === 0 ? (
                <Text style={[styles.emptyText, { color: themeColors.textMuted }]}>No team members listed yet.</Text>
              ) : (
                members.map((m) => (
                  <View key={m.id} style={[styles.memberRow, { borderBottomColor: themeColors.divider }]}>
                    <View style={[styles.memberAvatar, { backgroundColor: themeColors.chipBg }]}>
                      {m.profiles?.avatar_url ? (
                        <CachedImage uri={m.profiles.avatar_url} style={styles.memberAvatarImg} />
                      ) : (
                        <Text style={styles.memberAvatarText}>
                          {(m.profiles?.full_name || 'U').charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.memberName, { color: themeColors.textPrimary }]}>{m.profiles?.full_name || 'Team Member'}</Text>
                      <Text style={[styles.memberRole, { color: themeColors.textSecondary }]}>{[m.title, m.department].filter(Boolean).join(' · ') || 'Team member'}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      </TabletContainer>

      {/* Edit Page Modal */}
      {isManager && (
        <EditPageModal
          visible={editModalVisible}
          page={page}
          onClose={() => setEditModalVisible(false)}
          onUpdated={fetchPageDetails}
        />
      )}

      {/* Manage Members Modal */}
      {isManager && (
        <ManageMembersModal
          visible={membersModalVisible}
          pageId={page.id}
          onClose={() => setMembersModalVisible(false)}
          onUpdated={fetchPageDetails}
          isOwner={isOwner}
        />
      )}

      {isOwner && (
        <PageVerificationModal visible={verifyOpen} onClose={() => setVerifyOpen(false)} pageId={page.id} pageName={page.name} onSubmitted={fetchPageDetails} />
      )}
      {!isManager && (
        <ReportModal
          visible={reportOpen}
          onClose={() => setReportOpen(false)}
          targetTitle="this company page"
          targetType="user"
          targetId={page.owner_id}
        />
      )}
      {isManager && (
        <CreateJobModal visible={jobModalVisible} onClose={() => setJobModalVisible(false)} defaultPageId={page.id} onCreated={fetchPageDetails} />
      )}

      <UniversalShareSheet
        visible={showShareSheet}
        onClose={() => setShowShareSheet(false)}
        title={page?.name || 'Company Page'}
        shareUrl={`https://cinecraftconnect.com/pages/${page?.slug || page?.id}`}
        itemType="company"
        itemData={page}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  inviteBox: { marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderRadius: 16, padding: 14 },
  inviteBtn: { height: 36, paddingHorizontal: 18, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  content: {
    paddingBottom: 40,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  notFoundTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: INK,
    marginTop: 12,
  },
  notFoundSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  heroContainer: {
    width: '100%',
    height: 120,
    backgroundColor: '#E2E8F0',
    position: 'relative',
  },
  heroCoverImage: {
    width: '100%',
    height: '100%',
  },
  heroCoverGradient: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFF7F5',
  },
  heroLogoOverlapped: {
    position: 'absolute',
    bottom: -30,
    left: 16,
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
    overflow: 'hidden',
  },
  heroLogoImage: {
    width: '100%',
    height: '100%',
  },
  heroLogoFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#FFF7F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLogoFallbackText: {
    color: ORANGE,
    fontSize: 28,
    fontWeight: '900',
  },
  profileHeaderSection: {
    paddingTop: 36,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  nameText: {
    fontSize: 24,
    fontWeight: '900',
    color: INK,
    fontFamily: 'Lora-Bold',
  },
  taglineText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 10,
  },
  metaPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 4,
  },
  metaPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: ORANGE,
  },
  industriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  indPill: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  indPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  followBtn: {
    flex: 1,
    backgroundColor: ORANGE,
    borderRadius: 12,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followBtnActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  followBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  followBtnTextActive: {
    color: '#64748B',
  },
  editBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    height: 42,
    gap: 6,
  },
  editBtnText: {
    color: INK,
    fontSize: 13,
    fontWeight: '800',
  },
  membersBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    height: 42,
    gap: 6,
  },
  membersBtnText: {
    color: INK,
    fontSize: 13,
    fontWeight: '800',
  },
  deleteBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabUnderlineRow: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginHorizontal: 16,
    marginBottom: 14,
    flexGrow: 0,
  },
  tabUnderlineBtn: {
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabUnderlineBtnActive: {
    borderBottomColor: ORANGE,
  },
  tabUnderlineText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  tabUnderlineTextActive: {
    color: ORANGE,
  },
  sectionBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    marginHorizontal: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: INK,
    fontFamily: 'Lora-Bold',
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
  },
  websiteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  websiteText: {
    fontSize: 12.5,
    color: ORANGE,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 12.5,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  postCard: {
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingVertical: 10,
  },
  postTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: INK,
    marginBottom: 4,
  },
  postContent: {
    fontSize: 12.5,
    color: '#64748B',
    lineHeight: 18,
  },
  postDate: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 4,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF7F5',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  memberAvatarImg: {
    width: '100%',
    height: '100%',
  },
  memberAvatarText: {
    color: ORANGE,
    fontSize: 14,
    fontWeight: '800',
  },
  memberName: {
    fontSize: 13.5,
    fontWeight: '800',
    color: INK,
  },
  memberRole: {
    fontSize: 11,
    color: '#64748B',
  },
});

export default CompanyPageDetailScreen;
