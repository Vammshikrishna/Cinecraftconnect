import { CachedImage } from '../common/CachedImage';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
  ScrollView,
  Alert,
} from 'react-native';
import { Icon } from '../common/Icon';
import { useUserSettings } from '../../hooks/useUserSettings';
import { getSupabaseClient } from '@cinecraft/api';
import { StoryListingModal } from './StoryListingModal';
import { NDAContractsModal } from './NDAContractsModal';

const ORANGE = '#FF4B33';
const INK = '#0D0D0D';

export const StoryExchangeTab: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { themeColors, isDark } = useUserSettings();
  const [listings, setListings] = useState<any[]>([]);
  const [myInterests, setMyInterests] = useState<any[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [genreFilter, setGenreFilter] = useState('all');
  const [formatFilter, setFormatFilter] = useState('all');
  const [stageFilter, setStageFilter] = useState('all');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedListing, setSelectedListing] = useState<any | null>(null);
  const [ndaModalOpen, setNdaModalOpen] = useState(false);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);

      let query = (supabase as any)
        .from('story_listings')
        .select(`
          *,
          profiles:creator_id (id, full_name, avatar_url, username, craft, is_verified)
        `)
        .order('created_at', { ascending: false });

      if (genreFilter !== 'all') query = query.eq('genre', genreFilter);
      if (formatFilter !== 'all') query = query.eq('format', formatFilter);
      if (stageFilter !== 'all') query = query.eq('stage', stageFilter);

      const { data, error } = await query;

      if (!error && data) {
        setListings(data);
      } else {
        setListings([]);
      }

      // Fetch user interests & incoming requests if authenticated
      if (user) {
        const { data: interests } = await (supabase as any)
          .from('story_interests')
          .select('*')
          .eq('interested_by', user.id);
        setMyInterests(interests || []);

        const { data: incoming } = await (supabase as any)
          .from('story_interests')
          .select('*, story:story_id(*), profiles:interested_by(full_name, avatar_url, craft, is_verified)')
          .eq('story.creator_id', user.id);
        setIncomingRequests(incoming || []);
      }
    } catch (e) {
      console.warn('[StoryExchangeTab] Fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [genreFilter, formatFilter, stageFilter]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  useEffect(() => {
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel('story_exchange_rt_mobile')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'story_listings' }, () => {
        fetchListings();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'story_interests' }, () => {
        fetchListings();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchListings]);

  const filteredListings = listings.filter((l) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const title = (l.title || '').toLowerCase();
    const logline = (l.logline || '').toLowerCase();
    return title.includes(q) || logline.includes(q);
  });

  const handleRequestAccess = (listing: any) => {
    if (!currentUserId) {
      Alert.alert('Sign In Required', 'Please sign in to request access to full script synopses.');
      return;
    }
    setSelectedListing(listing);
    if (listing.nda_required) {
      setNdaModalOpen(true);
    } else {
      submitInterest(listing.id, 'unsigned');
    }
  };

  const submitInterest = async (storyId: string, ndaSig: string) => {
    if (!currentUserId) return;
    try {
      const supabase = getSupabaseClient();
      const payload = {
        story_id: storyId,
        interested_by: currentUserId,
        status: 'pending',
        nda_signed_at: ndaSig !== 'unsigned' ? new Date().toISOString() : null,
      };

      const { error } = await (supabase as any).from('story_interests').insert(payload);
      if (error) throw error;

      Alert.alert('Request Sent 📨', 'Your interest has been submitted to the writer for approval.');
      fetchListings();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not express interest.');
    }
  };

  const handleApproveInterest = async (requestId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await (supabase as any)
        .from('story_interests')
        .update({ status: 'approved' })
        .eq('id', requestId);
      if (error) throw error;

      Alert.alert('Approved! ✅', 'Full concept synopsis is now visible to the producer.');
      fetchListings();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to approve request.');
    }
  };

  const handleDeclineInterest = async (requestId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await (supabase as any)
        .from('story_interests')
        .update({ status: 'declined' })
        .eq('id', requestId);
      if (error) throw error;

      Alert.alert('Declined', 'Access request declined.');
      fetchListings();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to decline request.');
    }
  };

  const renderStoryCard = ({ item }: { item: any }) => {
    const isOwner = currentUserId === item.creator_id;
    const interest = myInterests.find((i) => i.story_id === item.id);
    const accessApproved = interest?.status === 'approved';
    const writerName = item.profiles?.full_name || item.profiles?.username || 'Writer';
    const avatarUrl = item.profiles?.avatar_url;

    return (
      <View
        style={[
          styles.card,
          { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
        ]}
      >
        {/* Header: Writer Profile + Badges */}
        <View style={styles.cardHeader}>
          {avatarUrl ? (
            <CachedImage uri={avatarUrl} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>{writerName.charAt(0).toUpperCase()}</Text>
            </View>
          )}

          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={[styles.writerName, { color: themeColors.textPrimary }]} numberOfLines={1}>
                {writerName}
              </Text>
              {item.profiles?.is_verified && (
                <Icon name="badge-check" size={14} color={ORANGE} />
              )}
            </View>
            <Text style={[styles.writerCraft, { color: themeColors.textSecondary }]} numberOfLines={1}>
              {item.profiles?.craft || 'Writer'}
            </Text>
          </View>

          <View style={styles.badgeRow}>
            <View style={styles.formatBadge}>
              <Text style={styles.formatBadgeText}>{(item.format || 'film').toUpperCase()}</Text>
            </View>
            {item.nda_required && (
              <View style={styles.ndaBadge}>
                <Icon name="shield" size={10} color="#D97706" />
                <Text style={styles.ndaBadgeText}>NDA</Text>
              </View>
            )}
          </View>
        </View>

        {/* Title & Logline */}
        <Text style={[styles.storyTitle, { color: themeColors.textPrimary }]}>{item.title}</Text>
        <Text style={[styles.logline, { color: themeColors.textSecondary }]} numberOfLines={2}>
          "{item.logline}"
        </Text>

        {/* Teaser Synopsis */}
        <View
          style={[
            styles.teaserBox,
            { backgroundColor: isDark ? themeColors.chipBg : '#F8FAFC', borderColor: themeColors.border },
          ]}
        >
          <Text style={[styles.teaserLabel, { color: themeColors.textMuted }]}>TEASER SYNOPSIS</Text>
          <Text style={[styles.teaserText, { color: themeColors.textSecondary }]} numberOfLines={3}>
            {item.synopsis_teaser}
          </Text>
        </View>

        {/* Unlocked Full Synopsis if Approved */}
        {accessApproved && (
          <View style={styles.unlockedBox}>
            <View style={styles.unlockedHeader}>
              <Icon name="check-circle" size={14} color="#16A34A" />
              <Text style={styles.unlockedHeaderText}>Full Synopsis Unlocked</Text>
            </View>
            <Text style={styles.fullSynopsisText}>
              {item.synopsis_full || 'No full synopsis provided.'}
            </Text>

            <TouchableOpacity
              style={styles.chatBtn}
              onPress={() => navigation.navigate('Messages', { recipientId: item.creator_id })}
            >
              <Icon name="message-square" size={14} color="#FFFFFF" />
              <Text style={styles.chatBtnText}>Open Chat with Writer</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Meta & Action Footer */}
        <View style={[styles.cardFooter, { borderTopColor: themeColors.divider }]}>
          <View style={styles.metaCol}>
            <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>
              Stage: <Text style={[styles.metaBold, { color: themeColors.textPrimary }]}>{item.stage || 'Concept'}</Text>
            </Text>
            <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>
              Deal: <Text style={[styles.metaBold, { color: themeColors.textPrimary }]}>{item.asking_deal || 'Negotiable'}</Text>
            </Text>
          </View>

          {isOwner ? (
            <View style={styles.ownerBadge}>
              <Text style={styles.ownerBadgeText}>Your Listing</Text>
            </View>
          ) : interest ? (
            interest.status === 'declined' ? (
              <View style={styles.declinedBadge}>
                <Text style={styles.declinedText}>Access Declined</Text>
              </View>
            ) : interest.status === 'pending' ? (
              <View style={styles.pendingBadge}>
                <Icon name="clock" size={12} color="#D97706" />
                <Text style={styles.pendingText}>Access Pending</Text>
              </View>
            ) : null
          ) : (
            <TouchableOpacity
              style={styles.requestAccessBtn}
              onPress={() => handleRequestAccess(item)}
            >
              <Icon name="lock" size={12} color="#FFFFFF" />
              <Text style={styles.requestAccessText}>
                {item.nda_required ? 'Sign NDA & View' : 'Request Access'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.bgScreen }]}>
      {/* Top Banner & Post Concept Button */}
      <View
        style={[
          styles.headerBanner,
          { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
        ]}
      >
        <View style={{ flex: 1 }}>
          <View style={styles.bannerTitleRow}>
            <Icon name="sparkles" size={18} color="#D97706" />
            <Text style={[styles.bannerTitle, { color: themeColors.textPrimary }]}>Story Exchange</Text>
          </View>
          <Text style={[styles.bannerSub, { color: themeColors.textSecondary }]}>
            Browse original story concepts listed by verified writers, or publish ideas to connect with producers.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.listConceptBtn}
          onPress={() => setCreateModalOpen(true)}
        >
          <Icon name="plus" size={14} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.listConceptBtnText}>List Concept</Text>
        </TouchableOpacity>
      </View>

      {/* Incoming Requests for Writers */}
      {incomingRequests.length > 0 && (
        <View style={styles.requestsSection}>
          <Text style={styles.requestsHeader}>
            INCOMING ACCESS REQUESTS ({incomingRequests.length})
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {incomingRequests.map((req) => (
              <View
                key={req.id}
                style={[
                  styles.reqCard,
                  { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
                ]}
              >
                <Text style={[styles.reqProducerName, { color: themeColors.textPrimary }]} numberOfLines={1}>
                  {req.profiles?.full_name || 'Producer'}
                </Text>
                <Text style={[styles.reqStoryTitle, { color: themeColors.textSecondary }]} numberOfLines={1}>
                  Target: {req.story?.title || 'Story Concept'}
                </Text>
                {req.status === 'pending' ? (
                  <View style={styles.reqBtnRow}>
                    <TouchableOpacity
                      style={styles.approveBtn}
                      onPress={() => handleApproveInterest(req.id)}
                    >
                      <Text style={styles.approveBtnText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.declineBtn,
                        { backgroundColor: isDark ? themeColors.chipBg : '#F1F5F9' },
                      ]}
                      onPress={() => handleDeclineInterest(req.id)}
                    >
                      <Text style={styles.declineBtnText}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={[styles.reqStatusDone, { color: themeColors.textMuted }]}>Status: {req.status.toUpperCase()}</Text>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Search Input & Category Filters */}
      <View style={styles.searchContainer}>
        <View
          style={[
            styles.searchBox,
            { backgroundColor: themeColors.inputBg, borderColor: themeColors.border },
          ]}
        >
          <Icon name="search" size={16} color={themeColors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: themeColors.textPrimary }]}
            placeholder="Search story concepts, loglines..."
            placeholderTextColor={themeColors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPills}>
          {['all', 'Action', 'Thriller', 'Drama', 'Comedy', 'Horror', 'Sci-Fi'].map((g) => (
            <TouchableOpacity
              key={g}
              style={[
                styles.filterPill,
                { backgroundColor: isDark ? themeColors.chipBg : '#FFFFFF', borderColor: themeColors.border },
                genreFilter === g && styles.filterPillActive,
              ]}
              onPress={() => setGenreFilter(g)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  { color: genreFilter === g ? '#FFFFFF' : themeColors.textSecondary },
                  genreFilter === g && styles.filterPillTextActive,
                ]}
              >
                {g === 'all' ? 'All Genres' : g}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Story Listings */}
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={ORANGE} />
        </View>
      ) : (
        <FlatList
          data={filteredListings}
          renderItem={renderStoryCard}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon name="book-open" size={40} color={themeColors.textMuted} />
              <Text style={[styles.emptyTitle, { color: themeColors.textPrimary }]}>No Story Concepts Found</Text>
              <Text style={[styles.emptySub, { color: themeColors.textSecondary }]}>
                Be the first writer to publish an original concept in the Story Exchange.
              </Text>
            </View>
          }
        />
      )}

      {/* Modals */}
      <StoryListingModal
        visible={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={fetchListings}
      />

      {selectedListing && (
        <NDAContractsModal
          visible={ndaModalOpen}
          onClose={() => setNdaModalOpen(false)}
          writerName={selectedListing.profiles?.full_name || 'Writer'}
          producerName="Producer"
          storyTitle={selectedListing.title}
          onSign={(sig) => {
            setNdaModalOpen(false);
            submitInterest(selectedListing.id, sig);
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerLoading: {
    paddingVertical: 50,
    alignItems: 'center',
  },
  headerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 14,
    marginBottom: 12,
    gap: 10,
  },
  bannerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  bannerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: INK,
  },
  bannerSub: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
  listConceptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ORANGE,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 5,
  },
  listConceptBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  requestsSection: {
    marginHorizontal: 14,
    marginBottom: 12,
  },
  requestsHeader: {
    fontSize: 10.5,
    fontWeight: '800',
    color: ORANGE,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  reqCard: {
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    borderRadius: 12,
    padding: 10,
    width: 200,
  },
  reqProducerName: {
    fontSize: 13,
    fontWeight: '800',
    color: INK,
  },
  reqStoryTitle: {
    fontSize: 11,
    color: '#64748B',
    marginVertical: 4,
  },
  reqBtnRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
  },
  approveBtn: {
    flex: 1,
    backgroundColor: '#16A34A',
    borderRadius: 6,
    paddingVertical: 5,
    alignItems: 'center',
  },
  approveBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  declineBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingVertical: 5,
    alignItems: 'center',
  },
  declineBtnText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '800',
  },
  reqStatusDone: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    marginTop: 4,
  },
  searchContainer: {
    marginHorizontal: 14,
    marginBottom: 12,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: INK,
  },
  filterPills: {
    gap: 6,
  },
  filterPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  filterPillActive: {
    backgroundColor: ORANGE,
    borderColor: ORANGE,
  },
  filterPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 14,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
  },
  avatarFallback: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFF7F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: ORANGE,
    fontSize: 16,
    fontWeight: '800',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  writerName: {
    fontSize: 14,
    fontWeight: '800',
    color: INK,
  },
  writerCraft: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 4,
  },
  formatBadge: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  formatBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748B',
  },
  ndaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 3,
  },
  ndaBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#D97706',
  },
  storyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: INK,
    marginBottom: 4,
  },
  logline: {
    fontSize: 13,
    color: ORANGE,
    fontStyle: 'italic',
    lineHeight: 18,
    marginBottom: 10,
  },
  teaserBox: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
  },
  teaserLabel: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  teaserText: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 18,
  },
  unlockedBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  unlockedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  unlockedHeaderText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#15803D',
  },
  fullSynopsisText: {
    fontSize: 13,
    color: '#166534',
    lineHeight: 19,
    marginBottom: 10,
  },
  chatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16A34A',
    height: 38,
    borderRadius: 8,
    gap: 6,
  },
  chatBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '800',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  metaCol: {
    gap: 2,
  },
  metaText: {
    fontSize: 11,
    color: '#64748B',
  },
  metaBold: {
    fontWeight: '800',
    color: INK,
    textTransform: 'capitalize',
  },
  ownerBadge: {
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  ownerBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: ORANGE,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  pendingText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
  },
  declinedBadge: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  declinedText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#EF4444',
  },
  requestAccessBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ORANGE,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 5,
  },
  requestAccessText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: INK,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 260,
  },
});

export default StoryExchangeTab;
