import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Share,
  Clipboard,
  InteractionManager,
} from 'react-native';
import { Icon } from '../../components/common/Icon';
import { TabletContainer } from '../../components/common/TabletContainer';
import { useUserSettings } from '../../hooks/useUserSettings';
import { useResponsive } from '../../hooks/useResponsive';
import { getSupabaseClient } from '@cinecraft/api';

const ORANGE = '#FF4B33';

export interface UserAvailability {
  id: string;
  start_date: string;
  end_date: string;
  status: 'free' | 'tentative' | 'booked';
  notes?: string;
  source_type?: 'personal' | 'schedule';
  source_project_id?: string | null;
}

export const AvailabilityCalendarScreen = ({ route, navigation }: { route?: any; navigation: any }) => {
  const { themeColors, isDark } = useUserSettings();
  const { isTablet } = useResponsive();
  const supabase = getSupabaseClient();

  const routeUserId = route?.params?.userId;
  const routeUserName = route?.params?.userName;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [availabilities, setAvailabilities] = useState<UserAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Date selections & status to apply
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [statusToApply, setStatusToApply] = useState<'booked' | 'tentative' | 'free'>('booked');

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [targetProfileName, setTargetProfileName] = useState<string>(routeUserName || '');
  const [targetProfileAccountType, setTargetProfileAccountType] = useState<string | null>(null);

  const targetUserId = routeUserId || currentUserId;
  const isOwnCalendar = !routeUserId || (currentUserId && routeUserId === currentUserId);

  const fetchAvailability = useCallback(async () => {
    try {
      setLoading(true);
      const { data: authData } = await supabase.auth.getUser();
      const loggedInId = authData?.user?.id;
      if (loggedInId) setCurrentUserId(loggedInId);

      const activeUserId = routeUserId || loggedInId;
      if (!activeUserId) {
        setLoading(false);
        return;
      }

      if (routeUserId && routeUserId !== loggedInId) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('full_name, username, account_type')
          .eq('id', routeUserId)
          .single();
        if (prof) {
          if (!routeUserName) setTargetProfileName(prof.full_name || prof.username || '');
          if (prof.account_type) setTargetProfileAccountType(prof.account_type);
        }
      }

      const { data, error } = await supabase
        .from('global_user_availability_view' as any)
        .select('*')
        .eq('user_id', activeUserId);

      if (error) {
        const { data: rawData } = await supabase
          .from('user_availability' as any)
          .select('*')
          .eq('user_id', activeUserId);
        if (rawData) setAvailabilities(rawData as unknown as UserAvailability[]);
      } else if (data) {
        setAvailabilities(data as unknown as UserAvailability[]);
      }
    } catch (error) {
      console.error('Error fetching availability:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase, routeUserId, routeUserName]);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      fetchAvailability();
    });
    return () => task.cancel();
  }, [fetchAvailability]);

  // Calendar math
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const formatDateStr = (dayNum: number) => {
    const m = String(month + 1).padStart(2, '0');
    const d = String(dayNum).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  const toggleDateSelection = (dateStr: string) => {
    if (!isOwnCalendar) return;
    setSelectedDates(prev =>
      prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
    );
  };

  const handleApplyStatus = async () => {
    if (!currentUserId || !isOwnCalendar || selectedDates.length === 0) return;

    setSaving(true);
    try {
      await supabase
        .from('user_availability' as any)
        .delete()
        .eq('user_id', currentUserId)
        .in('start_date', selectedDates)
        .in('end_date', selectedDates);

      if (statusToApply !== 'free') {
        const newEntries = selectedDates.map(dateStr => ({
          user_id: currentUserId,
          start_date: dateStr,
          end_date: dateStr,
          status: statusToApply,
        }));

        const { error } = await supabase
          .from('user_availability' as any)
          .insert(newEntries);

        if (error) throw error;
      }

      Alert.alert(
        'Availability Updated',
        `Marked ${selectedDates.length} ${selectedDates.length === 1 ? 'day' : 'days'} as ${statusToApply.toUpperCase()}.`
      );
      setSelectedDates([]);
      await fetchAvailability();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update availability.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePersonalEntry = async (item: UserAvailability) => {
    if (!isOwnCalendar) return;
    if (item.source_type === 'schedule') {
      Alert.alert('Project Schedule Commitment', 'ProjectSpace schedule items are managed directly in their respective ProjectSpace.');
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from('user_availability' as any)
        .delete()
        .eq('id', item.id);

      if (error) throw error;
      Alert.alert('Deleted', 'Availability entry removed.');
      await fetchAvailability();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to remove availability.');
    } finally {
      setSaving(false);
    }
  };

  // Builds a real .ics file body from the schedule and hands it to the system share sheet
  // (same output as the web "Download .ics file" button).
  const handleExportICal = async () => {
    const esc = (t: string) =>
      t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const compact = (d: string) => d.split('T')[0].replace(/-/g, '');
    const nextDay = (d: string) => {
      const dt = new Date(d.split('T')[0] + 'T00:00:00');
      dt.setDate(dt.getDate() + 1);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      return `${y}${m}${day}`;
    };
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CineCraft Connect//Availability//EN', 'CALSCALE:GREGORIAN'];
    availabilities.forEach((a) => {
      if (!a.start_date) return;
      const endStr = a.end_date || a.start_date;
      lines.push(
        'BEGIN:VEVENT',
        `UID:${a.id}@cinecraftconnect`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${compact(a.start_date)}`,
        `DTEND;VALUE=DATE:${nextDay(endStr)}`,
        `SUMMARY:${esc(String(a.status || '').toUpperCase() + ((a as any).notes ? ' - ' + (a as any).notes : ''))}`,
        'END:VEVENT'
      );
    });
    lines.push('END:VCALENDAR');
    try {
      await Share.share({ title: 'cinecraft-availability.ics', message: lines.join('\r\n') });
    } catch (e: any) {
      Alert.alert('Export failed', e?.message || 'Could not export your calendar.');
    }
  };

  // Range helper to match Web expandDates logic with clean date string matching
  const getDayAvailability = (dateStr: string) => {
    return availabilities.filter(a => {
      if (!a.start_date) return false;
      const start = a.start_date.split('T')[0];
      const end = (a.end_date || a.start_date).split('T')[0];
      return dateStr >= start && dateStr <= end;
    });
  };

  const daysGrid = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    daysGrid.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    daysGrid.push(d);
  }

  // Filtered availabilities for the schedule agenda section
  const currentMonthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
  const activeMonthAvailabilities = availabilities.filter(a => {
    const start = a.start_date ? a.start_date.split('T')[0] : '';
    const end = a.end_date ? a.end_date.split('T')[0] : start;
    if (selectedDates.length > 0) {
      return selectedDates.some(selDate => selDate >= start && selDate <= end);
    }
    return start.startsWith(currentMonthStr) || end.startsWith(currentMonthStr);
  });

  const displayName = isOwnCalendar ? 'Crew Availability' : `${targetProfileName || 'Crew Member'}'s Availability`;
  const displaySubtitle = isOwnCalendar ? 'Manage your personal schedule and sync with other apps' : `View ${targetProfileName || 'crew member'}'s availability schedule`;

  return (
    <TabletContainer
      backgroundColor={themeColors.bgScreen}
      maxWidth={800}
      header={
        <View style={[styles.headerContainer, { backgroundColor: themeColors.bgScreen, borderBottomColor: themeColors.border }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Icon name="arrow-left" size={20} color={themeColors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>{displayName}</Text>
            <Text style={[styles.headerSubtitle, { color: themeColors.textSecondary }]}>
              {displaySubtitle}
            </Text>
          </View>
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {!isOwnCalendar && targetProfileAccountType === 'fan' ? (
          <View style={[styles.card, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border, padding: 24, alignItems: 'center' }]}>
            <Icon name="calendar" size={32} color={themeColors.textSecondary} />
            <Text style={[styles.cardTitle, { color: themeColors.textPrimary, marginTop: 12, textAlign: 'center' }]}>
              Crew Availability Unavailable
            </Text>
            <Text style={[styles.cardDesc, { color: themeColors.textSecondary, textAlign: 'center', marginTop: 4 }]}>
              Availability Calendars are only available for Creator, Pro, and Studio crew accounts.
            </Text>
            <TouchableOpacity
              style={[styles.inlineApplyBtn, { marginTop: 16, paddingHorizontal: 20, paddingVertical: 10 }]}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.inlineApplyBtnText}>Back</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Main Calendar Card - Web Parity Header & Grid */}
            <View style={[styles.card, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
          {/* Card Header: "Select Dates" (Own) or "Availability Calendar" (Visitor) */}
          <View style={styles.cardHeaderRow}>
            <View style={styles.cardTitleGroup}>
              <Icon name="calendar" size={18} color={ORANGE} />
              <Text style={[styles.cardHeaderTitle, { color: themeColors.textPrimary }]}>
                {isOwnCalendar ? 'Select Dates' : `${targetProfileName || 'Crew'}'s Schedule`}
              </Text>
            </View>

            {isOwnCalendar ? (
              <View style={[styles.inlineControlGroup, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' }]}>
                <View style={styles.statusPillsInline}>
                  {(['booked', 'tentative', 'free'] as const).map(st => {
                    const isSelected = statusToApply === st;
                    const activeColor =
                      st === 'booked' ? '#EF4444' : st === 'tentative' ? '#EAB308' : '#22C55E';
                    return (
                      <TouchableOpacity
                        key={st}
                        style={[
                          styles.inlineStatusPill,
                          isSelected && { backgroundColor: activeColor },
                        ]}
                        onPress={() => setStatusToApply(st)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.inlineStatusText,
                            { color: isSelected ? '#FFFFFF' : themeColors.textSecondary },
                          ]}
                        >
                          {st.charAt(0).toUpperCase() + st.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <TouchableOpacity
                  style={[
                    styles.inlineApplyBtn,
                    { opacity: selectedDates.length === 0 || saving ? 0.5 : 1 },
                  ]}
                  onPress={handleApplyStatus}
                  disabled={selectedDates.length === 0 || saving}
                  activeOpacity={0.8}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.inlineApplyBtnText}>Apply</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.inlineApplyBtn, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}
                onPress={() => navigation.navigate('Conversation', { recipientId: targetUserId, recipientName: targetProfileName })}
                activeOpacity={0.8}
              >
                <Icon name="message-square" size={12} color="#FFFFFF" />
                <Text style={styles.inlineApplyBtnText}>Message</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Month Header & Controls */}
          <View style={styles.monthNavRow}>
            <TouchableOpacity style={styles.monthNavBtn} onPress={prevMonth} activeOpacity={0.7}>
              <Icon name="chevron-left" size={20} color={themeColors.textPrimary} />
            </TouchableOpacity>
            <Text style={[styles.monthNavTitle, { color: themeColors.textPrimary }]}>
              {monthNames[month]} {year}
            </Text>
            <TouchableOpacity style={styles.monthNavBtn} onPress={nextMonth} activeOpacity={0.7}>
              <Icon name="chevron-right" size={20} color={themeColors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Weekday Labels */}
          <View style={styles.weekdaysRow}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((w, idx) => (
              <Text key={idx} style={[styles.weekdayText, { color: themeColors.textSecondary }]}>
                {w}
              </Text>
            ))}
          </View>

          {/* Days Grid */}
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={ORANGE} />
            </View>
          ) : (
            <View style={styles.daysGrid}>
              {daysGrid.map((dayNum, index) => {
                if (dayNum === null) {
                  return <View key={`empty-${index}`} style={styles.dayCellEmpty} />;
                }

                const dateStr = formatDateStr(dayNum);
                const isSelected = selectedDates.includes(dateStr);
                const dayAvail = getDayAvailability(dateStr);

                const hasBookedPersonal = dayAvail.some(a => a.status === 'booked' && a.source_type !== 'schedule');
                const hasBookedProject = dayAvail.some(a => a.status === 'booked' && a.source_type === 'schedule');
                const hasTentative = dayAvail.some(a => a.status === 'tentative');

                return (
                  <TouchableOpacity
                    key={dateStr}
                    style={[
                      styles.dayCell,
                      { borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' },
                      isSelected && { borderColor: ORANGE, borderWidth: 2, backgroundColor: 'rgba(255,75,51,0.12)' },
                      !isSelected && hasBookedPersonal && { backgroundColor: 'rgba(239,68,68,0.2)' },
                      !isSelected && hasBookedProject && { backgroundColor: 'rgba(168,85,247,0.2)' },
                      !isSelected && hasTentative && { backgroundColor: 'rgba(234,179,8,0.2)' },
                    ]}
                    onPress={() => toggleDateSelection(dateStr)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dayNumberText,
                        { color: themeColors.textPrimary },
                        isSelected && { color: ORANGE, fontWeight: 'bold' },
                        !isSelected && hasBookedPersonal && { color: '#EF4444', fontWeight: 'bold' },
                        !isSelected && hasBookedProject && { color: '#A855F7', fontWeight: 'bold' },
                        !isSelected && hasTentative && { color: '#EAB308', fontWeight: 'bold' },
                      ]}
                    >
                      {dayNum}
                    </Text>

                    {/* Indicator dots matching Web */}
                    <View style={styles.dotsRow}>
                      {hasBookedPersonal && <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />}
                      {hasBookedProject && <View style={[styles.dot, { backgroundColor: '#A855F7' }]} />}
                      {hasTentative && <View style={[styles.dot, { backgroundColor: '#EAB308' }]} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Color Legend (Personal Booked, Project Booked, Tentative) */}
          <View style={[styles.legendRow, { borderTopColor: themeColors.border }]}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDotBox, { backgroundColor: 'rgba(239,68,68,0.2)', borderColor: '#EF4444' }]} />
              <Text style={[styles.legendText, { color: themeColors.textSecondary }]}>Personal Booked</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDotBox, { backgroundColor: 'rgba(168,85,247,0.2)', borderColor: '#A855F7' }]} />
              <Text style={[styles.legendText, { color: themeColors.textSecondary }]}>Project Booked</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDotBox, { backgroundColor: 'rgba(234,179,8,0.2)', borderColor: '#EAB308' }]} />
              <Text style={[styles.legendText, { color: themeColors.textSecondary }]}>Tentative</Text>
            </View>
          </View>
        </View>

        {/* ProjectSpace Connection & Schedule Commitments Card */}
        <View style={[styles.card, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
          <View style={styles.agendaHeaderRow}>
            <View>
              <Text style={[styles.cardTitle, { color: themeColors.textPrimary }]}>Schedule & Project Connections</Text>
              <Text style={[styles.cardDesc, { color: themeColors.textSecondary, marginBottom: 0 }]}>
                {selectedDates.length > 0
                  ? `Showing commitments for ${selectedDates.length} selected date(s)`
                  : `Active schedule commitments for ${monthNames[month]} ${year}`}
              </Text>
            </View>
            {selectedDates.length > 0 && (
              <TouchableOpacity style={styles.clearSelBtn} onPress={() => setSelectedDates([])}>
                <Text style={styles.clearSelText}>Clear Selection</Text>
              </TouchableOpacity>
            )}
          </View>

          {activeMonthAvailabilities.length === 0 ? (
            <View style={styles.emptyAgendaBox}>
              <Icon name="calendar" size={24} color={themeColors.textSecondary} />
              <Text style={[styles.emptyAgendaText, { color: themeColors.textSecondary }]}>
                No scheduled commitments found for this selection.
              </Text>
            </View>
          ) : (
            <View style={styles.agendaList}>
              {activeMonthAvailabilities.map((item) => {
                const isProjectItem = item.source_type === 'schedule';
                const badgeColor = isProjectItem ? '#A855F7' : item.status === 'booked' ? '#EF4444' : '#EAB308';
                const badgeBg = isProjectItem ? 'rgba(168,85,247,0.12)' : item.status === 'booked' ? 'rgba(239,68,68,0.12)' : 'rgba(234,179,8,0.12)';

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.agendaCard,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                        borderColor: themeColors.border,
                      },
                    ]}
                  >
                    <View style={styles.agendaCardTop}>
                      <View style={styles.agendaTitleWrap}>
                        <View style={[styles.agendaBadge, { backgroundColor: badgeBg }]}>
                          <Text style={[styles.agendaBadgeText, { color: badgeColor }]}>
                            {isProjectItem ? 'PROJECTSPACE SCHEDULE' : item.status.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={[styles.agendaTitle, { color: themeColors.textPrimary }]} numberOfLines={1}>
                          {item.notes || (isProjectItem ? 'Project Shoot Commitment' : 'Personal Availability')}
                        </Text>
                        <Text style={[styles.agendaDates, { color: themeColors.textSecondary }]}>
                          📅 {item.start_date} {item.end_date && item.end_date !== item.start_date ? `to ${item.end_date}` : ''}
                        </Text>
                      </View>

                      {/* Action Button: Connect to ProjectSpace if Project Item, or Delete if Personal Item */}
                      {isProjectItem ? (
                        <TouchableOpacity
                          style={[styles.projectConnectBtn, { backgroundColor: 'rgba(168,85,247,0.15)', borderColor: '#A855F7' }]}
                          onPress={() => {
                            if (item.source_project_id) {
                              navigation.navigate('ProjectSpace', { projectId: item.source_project_id });
                            } else {
                              navigation.navigate('MainTabs', { screen: 'Projects' });
                            }
                          }}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.projectConnectBtnText}>Open Project Space</Text>
                          <Icon name="arrow-right" size={12} color="#A855F7" />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          style={styles.deletePersonalBtn}
                          onPress={() => handleDeletePersonalEntry(item)}
                          activeOpacity={0.7}
                        >
                          <Icon name="trash-2" size={14} color="#EF4444" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Sync Options Card - Web Parity */}
        <View style={[styles.card, { backgroundColor: themeColors.bgCard, borderColor: themeColors.border }]}>
          <Text style={[styles.cardTitle, { color: themeColors.textPrimary }]}>Export Calendar</Text>
          <Text style={[styles.cardDesc, { color: themeColors.textSecondary }]}>
            Export your schedule as an .ics file and import it into Google Calendar, Apple Calendar, or Outlook.
          </Text>

          <View style={styles.syncSection}>
            <TouchableOpacity
              style={[styles.syncBtn, { borderColor: themeColors.border, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC' }]}
              onPress={handleExportICal}
              activeOpacity={0.7}
            >
              <Icon name="link" size={16} color={themeColors.textPrimary} />
              <Text style={[styles.syncBtnText, { color: themeColors.textPrimary }]}>Export .ics file</Text>
            </TouchableOpacity>
            <Text style={[styles.syncHint, { color: themeColors.textSecondary }]}>
              This is a one-time snapshot of your current schedule; it does not stay in sync automatically.
            </Text>
          </View>
        </View>
        </>
        )}
      </ScrollView>
    </TabletContainer>
  );
};

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 6,
    marginRight: 10,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18.5,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 11.5,
    marginTop: 2,
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 10,
  },
  cardTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  inlineControlGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusPillsInline: {
    flexDirection: 'row',
    gap: 4,
  },
  inlineStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  inlineStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  inlineApplyBtn: {
    backgroundColor: ORANGE,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  inlineApplyBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 14,
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthNavBtn: {
    padding: 8,
  },
  monthNavTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  weekdayText: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  loadingBox: {
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCellEmpty: {
    width: '14.28%',
    height: 44,
  },
  dayCell: {
    width: '14.28%',
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  dayNumberText: {
    fontSize: 13,
    fontWeight: '600',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDotBox: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
  },
  agendaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  clearSelBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,75,51,0.1)',
    borderRadius: 6,
  },
  clearSelText: {
    color: ORANGE,
    fontSize: 11,
    fontWeight: '700',
  },
  emptyAgendaBox: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyAgendaText: {
    fontSize: 12,
    textAlign: 'center',
  },
  agendaList: {
    gap: 10,
  },
  agendaCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  agendaCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  agendaTitleWrap: {
    flex: 1,
  },
  agendaBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  agendaBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  agendaTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  agendaDates: {
    fontSize: 11,
  },
  projectConnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  projectConnectBtnText: {
    color: '#A855F7',
    fontSize: 11,
    fontWeight: '800',
  },
  deletePersonalBtn: {
    padding: 8,
  },
  syncSection: {
    marginTop: 10,
  },
  syncSectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  syncBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  syncHint: {
    fontSize: 10.5,
    lineHeight: 14,
  },
  importRow: {
    flexDirection: 'row',
    gap: 8,
  },
  importInput: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 12,
  },
  saveImportBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AvailabilityCalendarScreen;
