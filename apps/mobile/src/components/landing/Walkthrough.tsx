import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Animated, StyleSheet } from 'react-native';
import { Icon } from '../common/Icon';
import { prefersReducedMotion } from '../../utils/motion';
import { isTabletDevice } from '../../utils/pageType';
import { Stage3D, CalloutData } from './Stage3D';
import { DiscussionScreen, GearScreen, JobsScreen, PitchScreen, ProfileScreen, ProjectScreen } from './LandingScreens';

const ORANGE = '#FF4B33';
const ORANGE_INK = '#C4301B';
const INK = '#14110F';
const MUTED = '#5B544E';
const FAINT = '#6F6862';
const LINE = 'rgba(20, 17, 15, 0.1)';

type Step = { id: string; n: string; short: string; title: string; body: string; points: string[]; Screen: React.ComponentType; tilt: number; callouts: [CalloutData, CalloutData] };

export const STEPS: Step[] = [
  {
    id: 'profile', n: '01', short: 'Profile', title: 'Build a profile that proves your work', Screen: ProfileScreen, tilt: -16,
    body: 'Add your craft, showreel and credits. A project creator adds your role and you confirm it, so every credit on your profile is real.',
    points: ['Credits confirmed by the people you worked with', 'Find and connect with crew by craft', 'Verified badge for trusted profiles'],
    callouts: [{ icon: 'badge-check', title: 'Credit confirmed', sub: 'Harbour Lights · DoP' }, { icon: 'user-plus', title: 'New connection request', sub: 'Daniel Brooks · Director' }],
  },
  {
    id: 'work', n: '02', short: 'Work & crew', title: 'Find work and crew across every format', Screen: JobsScreen, tilt: 13,
    body: 'Browse jobs for films, series, ads, music videos and YouTube, or post a role of your own. Apply with the screening questions the hirer sets.',
    points: ['Deadlines, openings and shoot dates on every job', 'Job alerts that match your craft and city', 'Track every application in one place'],
    callouts: [{ icon: 'bell', title: 'New job matches your alert', sub: 'Colorist · Los Angeles' }, { icon: 'eye', title: 'Application viewed', sub: 'Lantern Pictures' }],
  },
  {
    id: 'produce', n: '03', short: 'Production', title: 'Run the whole production in one space', Screen: ProjectScreen, tilt: -12,
    body: 'Every production gets a private project space: end-to-end encrypted chat, tasks, files, call sheets and shot lists, shared with your crew.',
    points: ['End-to-end encrypted crew chat', 'Tasks, files, call sheet and shot list', 'Start a call with your crew from the space'],
    callouts: [{ icon: 'lock', title: 'End-to-end encrypted', sub: 'Only your crew can read it' }, { icon: 'file-text', title: 'Call sheet updated', sub: 'Day 12 · 6:30 AM' }],
  },
  {
    id: 'gear', n: '04', short: 'Gear', title: 'Rent the gear you need, from verified vendors', Screen: GearScreen, tilt: 14,
    body: 'Rent cameras, lenses and lighting from verified studios and vendors. Compare listings, read reviews and ask for a quote.',
    points: ['Verified vendors with ratings and reviews', 'Ask for a quote and check availability', 'Compare listings and read reviews first'],
    callouts: [{ icon: 'star', title: 'Quote received', sub: '$950 / day' }, { icon: 'badge-check', title: 'Verified vendor', sub: 'Frameworks Rentals' }],
  },
  {
    id: 'pitch', n: '05', short: 'Pitch & news', title: 'Pitch your story and tell the network', Screen: PitchScreen, tilt: -10,
    body: 'Send your pitch, showreel and deck straight to producers and studios. Studios and creators announce casting calls and festival news to their followers.',
    points: ['Pitch to producers, brands and studios', 'Announcements with scheduling and expiry', 'Studio pages to show your portfolio'],
    callouts: [{ icon: 'megaphone', title: 'Casting call posted', sub: 'Lantern Pictures' }, { icon: 'clock', title: 'Open call closes soon', sub: 'Short film series · 30 Nov' }],
  },
  {
    id: 'rooms', n: '06', short: 'Community', title: "Join your craft's community", Screen: DiscussionScreen, tilt: 12,
    body: 'Every craft has its own discussion rooms. Ask a question, share your work, learn a technique, or meet the people you might work with next.',
    points: ['Rooms for every craft, public or private', 'Share work and get notes from your peers', 'Meet collaborators before you work together'],
    callouts: [{ icon: 'message-circle', title: 'New reply in Cinematography Lounge', sub: '3 people answered' }, { icon: 'users', title: 'Room invite', sub: "Editors' Cut · private room" }],
  },
];

const Detail = ({ step }: { step: Step }) => (
  <View>
    <Text style={styles.body}>{step.body}</Text>
    {step.points.map((p) => (
      <View key={p} style={styles.point}>
        <Icon name="badge-check" size={17} color={ORANGE} />
        <Text style={styles.pointText}>{p}</Text>
      </View>
    ))}
  </View>
);

/** How it works: pick a step and the 3D phone turns to that part of the app. Driven by the visitor's taps (nothing hijacks scrolling).
    With reduced motion the phone cuts straight to the new screen. */
export const Walkthrough = () => {
  const reduce = prefersReducedMotion();
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(0);
  const latest = useRef(0);
  const turn = useRef(new Animated.Value(STEPS[0].tilt)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const pick = (i: number) => {
    if (i === latest.current) return;
    latest.current = i;
    setActive(i);
    if (reduce) {
      turn.setValue(STEPS[i].tilt);
      setShown(i);
      return;
    }
    Animated.spring(turn, { toValue: STEPS[i].tilt, stiffness: 70, damping: 15, mass: 1, useNativeDriver: true }).start();
    // swap the screen while it is invisible, then show the new one and bring its notification cards in
    Animated.timing(fade, { toValue: 0, duration: 110, useNativeDriver: true }).start(({ finished }) => {
      if (!mounted.current) return;
      if (finished) setShown(latest.current);
      pop.setValue(0);
      Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(pop, { toValue: 1, duration: 360, useNativeDriver: true }),
      ]).start();
    });
  };

  const step = STEPS[active];
  const Shown = STEPS[shown].Screen;

  const stage = (
    <Stage3D turn={turn} fade={fade} pop={pop} callouts={STEPS[shown].callouts}>
      <Shown />
    </Stage3D>
  );

  if (isTabletDevice) {
    return (
      <View style={styles.tabletRow}>
        <View style={{ flex: 1, gap: 10 }} accessibilityRole="tablist">
          {STEPS.map((s, i) => {
            const on = i === active;
            return (
              <View key={s.id} style={[styles.stepCard, on && styles.stepCardOn]}>
                <TouchableOpacity onPress={() => pick(i)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={styles.stepHead} activeOpacity={0.8}>
                  <Text style={[styles.stepNum, { color: on ? ORANGE_INK : FAINT }]}>{s.n}</Text>
                  <Text style={styles.stepTitle}>{s.title}</Text>
                </TouchableOpacity>
                {on && <View style={{ paddingHorizontal: 18, paddingBottom: 16, paddingLeft: 50 }}><Detail step={s} /></View>}
              </View>
            );
          })}
        </View>
        <View style={{ flex: 1.1 }}>{stage}</View>
      </View>
    );
  }

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="tablist">
        {STEPS.map((s, i) => {
          const on = i === active;
          return (
            <TouchableOpacity key={s.id} onPress={() => pick(i)} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={`Step ${s.n}: ${s.short}`} style={[styles.chip, on && styles.chipOn]} activeOpacity={0.8}>
              <Text style={[styles.chipNum, { color: on ? '#FFB4A8' : FAINT }]}>{s.n}</Text>
              <Text style={[styles.chipText, { color: on ? '#fff' : INK }]}>{s.short}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {stage}
      <View style={styles.detailCard} accessibilityLiveRegion="polite">
        <Text style={styles.detailTitle}>{step.title}</Text>
        <Detail step={step} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  tabletRow: { flexDirection: 'row', gap: 36, alignItems: 'flex-start' },
  stepCard: { borderRadius: 20, borderWidth: 1, borderColor: LINE },
  stepCardOn: { backgroundColor: '#fff', borderColor: ORANGE, elevation: 6, shadowColor: ORANGE, shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 10 } },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, minHeight: 60 },
  stepNum: { fontFamily: 'Inconsolata-Bold', fontSize: 15 },
  stepTitle: { flex: 1, color: INK, fontFamily: 'WorkSans-Bold', fontSize: 18, lineHeight: 23, letterSpacing: -0.3 },
  chips: { gap: 8, paddingVertical: 4, paddingRight: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 16, borderRadius: 99, borderWidth: 1, borderColor: LINE, backgroundColor: '#fff' },
  chipOn: { backgroundColor: INK, borderColor: INK },
  chipNum: { fontFamily: 'Inconsolata-Bold', fontSize: 13 },
  chipText: { fontFamily: 'WorkSans-SemiBold', fontSize: 15 },
  detailCard: { marginTop: 8, padding: 20, borderRadius: 22, backgroundColor: '#fff', borderWidth: 1, borderColor: ORANGE },
  detailTitle: { color: INK, fontFamily: 'WorkSans-Bold', fontSize: 21, lineHeight: 26, letterSpacing: -0.4, marginBottom: 10 },
  body: { color: MUTED, fontSize: 16, lineHeight: 25, marginBottom: 12 },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginBottom: 8 },
  pointText: { flex: 1, color: INK, fontSize: 15, lineHeight: 22 },
});
