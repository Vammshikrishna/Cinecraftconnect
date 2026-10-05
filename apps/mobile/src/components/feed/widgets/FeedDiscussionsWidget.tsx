import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Icon } from '../../common/Icon';
import { useUserSettings } from '../../../hooks/useUserSettings';
import { getSupabaseClient } from '@cinecraft/api';
import { UniversalShareSheet } from '../../common/UniversalShareSheet';

const ORANGE = '#FF4B33';
const MUTED = '#6B7280';
const BORDER = '#E5E7EB';

interface DiscussionRoomItem {
  id: string;
  title: string;
  description?: string | null;
  tags?: string[] | null;
  member_count?: number | null;
  created_at?: string;
  created_by?: string;
  creator_id?: string;
  user_id?: string;
  is_member?: boolean;
  isMember?: boolean;
}

interface FeedDiscussionsWidgetProps {
  rooms: DiscussionRoomItem[];
  onSeeAll?: () => void;
  onSelectRoom?: (room: DiscussionRoomItem) => void;
}

export const FeedDiscussionsWidget: React.FC<FeedDiscussionsWidgetProps> = ({
  rooms,
  onSeeAll,
  onSelectRoom,
}) => {
  const { themeColors, isDark } = useUserSettings();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [joinedRoomIds, setJoinedRoomIds] = useState<Set<string>>(new Set());
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<any>(null);

  useEffect(() => {
    const checkMemberships = async () => {
      try {
        const supabase = getSupabaseClient();
        const user = (await supabase.auth.getSession()).data.session?.user ?? null; // local session: getUser() is a network call
        if (user) {
          setCurrentUserId(user.id);
          const { data } = await (supabase.from('room_members' as any) as any)
            .select('room_id')
            .eq('user_id', user.id);
          if (data) {
            setJoinedRoomIds(new Set(data.map((m: any) => m.room_id)));
          }
        }
      } catch {
        // Ignored
      }
    };
    checkMemberships();
  }, []);

  if (!rooms || rooms.length === 0) return null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.sectionHeader}>
        <View style={styles.titleGroup}>
          <Icon name="DiscussionRoomIcon" size={18} color={ORANGE} />
          <Text style={[styles.sectionTitle, { color: themeColors.textPrimary }]}>Active Discussion Rooms</Text>
        </View>
        <TouchableOpacity onPress={onSeeAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.seeAllText, { color: themeColors.textSecondary }]}>Explore →</Text>
        </TouchableOpacity>
      </View>

      {/* Horizontal Carousel */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {rooms.map((room) => {
          const tagStr = (room.tags && room.tags[0]) || 'CINEMA';
          const memberCount = room.member_count || 3;
          const isMember =
            (currentUserId && (room.created_by === currentUserId || room.creator_id === currentUserId || room.user_id === currentUserId)) ||
            joinedRoomIds.has(room.id) ||
            room.is_member === true ||
            room.isMember === true;
          const ctaText = isMember ? 'Enter Room' : 'Join Room';

          return (
            <TouchableOpacity
              key={room.id}
              style={[
                styles.card,
                { backgroundColor: themeColors.bgCard, borderColor: themeColors.border },
              ]}
              activeOpacity={0.88}
              onPress={() => onSelectRoom?.(room)}
            >
              {/* Top Tags Row */}
              <View style={styles.topRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View
                    style={[
                      styles.roomStatusBadge,
                      {
                        backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5',
                        borderColor: isDark ? 'rgba(16, 185, 129, 0.3)' : '#A7F3D0',
                      },
                    ]}
                  >
                    <Text style={styles.roomStatusText}>ROOM // OPEN</Text>
                  </View>
                  <View
                    style={[
                      styles.categoryBadge,
                      {
                        backgroundColor: isDark ? 'rgba(255, 75, 51, 0.15)' : '#FFF7F5',
                        borderColor: isDark ? 'rgba(255, 75, 51, 0.3)' : '#FFE5DF',
                      },
                    ]}
                  >
                    <Text style={styles.categoryText}>CAT // {tagStr.toUpperCase()}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation();
                    setSelectedRoom(room);
                    setShareSheetVisible(true);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="more-vertical" size={16} color={themeColors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Title & Desc */}
              <Text style={[styles.roomTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
                {room.title}
              </Text>
              <Text style={[styles.roomDesc, { color: themeColors.textSecondary }]} numberOfLines={2}>
                {room.description || 'Open room for filmmakers, writers, and technical crew.'}
              </Text>

              {/* Footer Row */}
              <View style={[styles.cardFooter, { borderTopColor: themeColors.divider }]}>
                <View
                  style={[
                    styles.memberGroup,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F8FAFC',
                      borderColor: themeColors.border,
                    },
                  ]}
                >
                  <Text style={[styles.memberText, { color: themeColors.textSecondary }]}>
                    MEMBERS // {memberCount}
                  </Text>
                </View>
                <View style={styles.enterBtn}>
                  <Icon name="DiscussionRoomIcon" size={13} color="#FFFFFF" />
                  <Text style={styles.enterBtnText}>{ctaText}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <UniversalShareSheet
        visible={shareSheetVisible}
        onClose={() => setShareSheetVisible(false)}
        title={selectedRoom?.title || 'Discussion Room'}
        shareUrl={`https://cinecraftconnect.com/rooms/${selectedRoom?.id}`}
        itemType="room"
        itemData={selectedRoom}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  sectionTitle: {
    color: '#0D0D0D',
    fontSize: 16,
    fontFamily: 'Lora-Bold',
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  seeAllText: {
    color: '#4B5563',
    fontSize: 12,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 12,
    gap: 12,
  },
  card: {
    width: 250,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  roomStatusBadge: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roomStatusText: {
    color: '#059669',
    fontSize: 9.5,
    fontFamily: 'Inconsolata-Bold',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  categoryBadge: {
    backgroundColor: '#FFF7F5',
    borderWidth: 1,
    borderColor: '#FFE5DF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryText: {
    color: ORANGE,
    fontSize: 9.5,
    fontFamily: 'Inconsolata-Bold',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  roomTitle: {
    color: '#0D0D0D',
    fontSize: 16,
    fontFamily: 'Lora-Bold',
    fontWeight: '700',
    marginBottom: 6,
  },
  roomDesc: {
    color: '#475569',
    fontSize: 13,
    fontFamily: 'WorkSans-Regular',
    fontWeight: '400',
    lineHeight: 18,
    marginBottom: 14,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  memberGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  memberText: {
    color: '#64748B',
    fontSize: 9.5,
    fontFamily: 'Inconsolata-Bold',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  enterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FF4B33',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  enterBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'WorkSans-Bold',
    fontWeight: '700',
  },
});
