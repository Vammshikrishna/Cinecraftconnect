import React, { useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { AppLogo } from '../../components/common/AppLogo';
import { TabletContainer } from '../../components/common/TabletContainer';
import { Icon } from '../../components/common/Icon';
import { isTabletDevice } from '../../utils/pageType';
import { prefersReducedMotion } from '../../utils/motion';
import { Stage3D } from '../../components/landing/Stage3D';
import { ProjectScreen } from '../../components/landing/LandingScreens';
import { Walkthrough } from '../../components/landing/Walkthrough';
// The 24 crafts as plain data (shared with the website). No 3D: the live scene made scrolling lag on phones.
import { CRAFTS, PHASES } from '../../../../web/src/components/landing/film3d/crafts';

/* The landing screen shows the product instead of describing it: a 3D hero phone, an interactive walkthrough of the real app screens,
   then the rest of the platform. Same structure as the web page. It keeps its own light palette on purpose (it is the first thing a
   visitor sees, whatever theme the app uses). Small orange text uses ORANGE_INK (readable on this background); the brand orange is for fills. */
const BG = '#FBFAF8';
const CARD = '#FFFFFF';
const INK = '#14110F';
const MUTED = '#5B544E';
const FAINT = '#6F6862';
const LINE = 'rgba(20, 17, 15, 0.1)';
const ORANGE = '#FF4B33';
const ORANGE_INK = '#C4301B';

const MORE = [
  { icon: 'message-circle', title: 'Discussion rooms', desc: 'Craft communities across film, TV, digital, music, advertising and podcasting.' },
  { icon: 'building', title: 'Company pages', desc: 'Studios, agencies and production houses show their portfolio and list jobs.' },
  { icon: 'shield', title: 'Verified vendors', desc: 'Trusted partners for your next shoot, from catering to VFX houses.' },
  { icon: 'star', title: 'Ratings and reviews', desc: 'Build credibility with transparent ratings after a project is completed.' },
  { icon: 'megaphone', title: 'Industry announcements', desc: 'Share festival selections, casting calls and news with your followers.' },
  { icon: 'bell', title: 'Job alerts', desc: 'Hear first about roles that match your craft, city and pay.' },
];

const TIERS = [
  { type: 'Fan account', desc: 'For enthusiasts and fans.', access: 'View-only access to public feeds and discussions.', limits: 'Cannot post jobs, rent equipment, pitch stories or message professionals.', featured: false },
  { type: 'Creator Pro', desc: 'For individual filmmakers and creators.', access: 'Full access to the creator network, project spaces, job board and marketplace.', limits: 'Standard platform fees apply.', featured: true },
  { type: 'Studio or company', desc: 'For production houses and agencies.', access: 'Everything in Pro, plus company pages and multi-user project management.', limits: 'Requires official business verification.', featured: false },
];

const HERO_CALLOUTS: [{ icon: string; title: string; sub: string }, { icon: string; title: string; sub: string }] = [
  { icon: 'bell', title: 'New job matches your alert', sub: 'Colorist · Los Angeles' },
  { icon: 'badge-check', title: 'Credit confirmed', sub: 'Harbour Lights · DoP' },
];

export const LandingScreen = ({ navigation }: { navigation: any }) => {
  const scrollRef = useRef<ScrollView>(null);
  const howY = useRef(0);
  const craftsY = useRef(0);
  const reduce = prefersReducedMotion();
  // the hero phone is fixed: turned slightly, floating
  const heroTurn = useRef(new Animated.Value(-12)).current;
  const one = useRef(new Animated.Value(1)).current;
  const heroPop = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  React.useEffect(() => {
    if (reduce) return;
    Animated.timing(heroPop, { toValue: 1, duration: 600, delay: 500, useNativeDriver: true }).start();
  }, [heroPop, reduce]);

  const hero = (
    <View style={[styles.heroText, isTabletDevice && { flex: 1 }]}>
      <Text style={[styles.h1, isTabletDevice && styles.h1Tablet]} accessibilityRole="header">
        <Text style={[styles.h1, isTabletDevice && styles.h1Tablet]}>Where Entertainment Talent, Opportunities and Production </Text>
        <Text style={[styles.h1, isTabletDevice && styles.h1Tablet, styles.h1Accent]}>Come Together.</Text>
      </Text>
      <Text style={styles.sub}>
        Films, series, YouTube, Instagram, ads, music videos and podcasts: whatever you make, find crew and jobs, run your shoot in an encrypted project space, rent gear and build a profile of credits confirmed by the people you worked with.
      </Text>
      <View style={[styles.ctaRow, isTabletDevice && { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }]}>
        <TouchableOpacity style={styles.primaryCta} onPress={() => navigation.navigate('Register')} activeOpacity={0.85} accessibilityRole="button">
          <Text style={styles.primaryCtaText}>Create your profile</Text>
          <Icon name="arrow-right" size={18} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryCta} onPress={() => scrollRef.current?.scrollTo({ y: craftsY.current, animated: !reduce })} activeOpacity={0.8} accessibilityRole="button">
          <Text style={styles.secondaryCtaText}>See how content gets made</Text>
        </TouchableOpacity>
      </View>
      <View style={{ gap: 10, marginTop: 6 }}>
        {[['check-circle', 'Free to join'], ['lock', 'End-to-end encrypted chat'], ['film', 'Films, TV, YouTube, Instagram, ads, music and podcasts']].map(([ic, label]) => (
          <View key={label} style={styles.perk}><Icon name={ic} size={17} color={ORANGE} /><Text style={styles.perkText}>{label}</Text></View>
        ))}
      </View>
    </View>
  );

  return (
    <TabletContainer backgroundColor={BG}>
      <ScrollView ref={scrollRef} style={{ backgroundColor: BG }} showsVerticalScrollIndicator={false}>
        {/* ── Hero ── */}
        <View>
          <LinearGradient pointerEvents="none" colors={['rgba(255, 75, 51, 0.16)', 'rgba(255, 180, 120, 0.08)', 'rgba(251, 250, 248, 0)']} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
          <View style={[styles.navHeader, isTabletDevice && { paddingHorizontal: 48, paddingVertical: 22 }]}>
            <AppLogo size="md" textColor="ink" onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: !reduce })} />
            <TouchableOpacity style={styles.signInBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" onPress={() => navigation.navigate('Login')}>
              <Text style={styles.signInText}>Sign in</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.heroWrap, isTabletDevice && styles.heroWrapTablet]}>
            {hero}
            <View style={[{ marginTop: 28 }, isTabletDevice && { flex: 1, marginTop: 0 }]}>
              <Stage3D turn={heroTurn} fade={one} pop={heroPop} callouts={HERO_CALLOUTS}>
                <ProjectScreen />
              </Stage3D>
            </View>
          </View>
        </View>

        {/* ── How content gets made: the 24 crafts, in the order the work happens ── */}
        <View style={[styles.section, isTabletDevice && styles.sectionTablet]} onLayout={(e) => { craftsY.current = e.nativeEvent.layout.y; }}>
          <Text style={styles.eyebrow} accessibilityRole="header">HOW CONTENT GETS MADE</Text>
          <Text style={[styles.h2, isTabletDevice && styles.h2Tablet]}>
            Meet the <Text style={[styles.h2, isTabletDevice && styles.h2Tablet, styles.h1Accent]}>24 crafts.</Text>
          </Text>
          <Text style={styles.lead}>A film, a series, a YouTube video, an ad or a podcast: they are all made by the same crafts, in the same order. Every one of them is on CineCraft Connect.</Text>
          <View style={isTabletDevice ? styles.grid3 : { gap: 12 }}>
            {PHASES.map((ph, i) => (
              <View key={ph.id} style={[styles.phaseCard, isTabletDevice && { width: '48%', flexGrow: 1 }]}>
                <Text style={styles.phaseKicker}>{`${String(i + 1).padStart(2, '0')} · ${ph.id.toUpperCase()}`}</Text>
                <Text style={styles.phaseLine}>{ph.line}</Text>
                <View style={styles.chips}>
                  {CRAFTS.filter((c) => c.phase === ph.id).map((c) => (
                    <View key={c.name} style={styles.chip}><Text style={styles.chipText}>{c.name}</Text></View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* ── How it works ── */}
        <View style={[styles.section, isTabletDevice && styles.sectionTablet]} onLayout={(e) => { howY.current = e.nativeEvent.layout.y; }}>
          <Text style={styles.eyebrow} accessibilityRole="header">HOW IT WORKS</Text>
          <Text style={[styles.h2, isTabletDevice && styles.h2Tablet]}>
            From first credit to <Text style={[styles.h2, isTabletDevice && styles.h2Tablet, styles.h1Accent]}>final cut.</Text>
          </Text>
          <Text style={styles.lead}>Pick a step and watch the app. These are example screens, so you can see how it works before you join.</Text>
          <Walkthrough />
        </View>

        {/* ── More ── */}
        <View style={[styles.section, isTabletDevice && styles.sectionTablet]}>
          <Text style={styles.eyebrow} accessibilityRole="header">AND THERE IS MORE</Text>
          <Text style={[styles.h2, isTabletDevice && styles.h2Tablet, { marginBottom: 22 }]}>Everything else a production runs on.</Text>
          <View style={isTabletDevice ? styles.grid3 : { gap: 12 }}>
            {MORE.map((m) => (
              <View key={m.title} style={[styles.moreCard, isTabletDevice && { width: '31.5%', flexGrow: 1 }]}>
                <View style={styles.moreIcon}><Icon name={m.icon} size={21} color={ORANGE} /></View>
                <Text style={styles.moreTitle}>{m.title}</Text>
                <Text style={styles.moreDesc}>{m.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Account types ── */}
        <View style={[styles.section, isTabletDevice && styles.sectionTablet]}>
          <Text style={styles.eyebrow} accessibilityRole="header">JOIN</Text>
          <Text style={[styles.h2, isTabletDevice && styles.h2Tablet, { marginBottom: 22 }]}>Choose how you join.</Text>
          <View style={isTabletDevice ? { flexDirection: 'row', gap: 14, alignItems: 'stretch' } : { gap: 12 }}>
            {TIERS.map((t) => (
              <View key={t.type} style={[styles.tier, t.featured && { borderColor: ORANGE }, isTabletDevice && { flex: 1 }]}>
                <Text style={styles.tierType}>{t.type}</Text>
                <Text style={styles.tierDesc}>{t.desc}</Text>
                <Text style={styles.tierLabel}>WHAT YOU GET</Text>
                <Text style={styles.tierVal}>{t.access}</Text>
                <Text style={[styles.tierLabel, { color: FAINT, marginTop: 12 }]}>LIMITS</Text>
                <Text style={[styles.tierVal, { color: MUTED }]}>{t.limits}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Closing ── */}
        <View style={[styles.closingWrap, isTabletDevice && { paddingHorizontal: 48 }]}>
          <View style={styles.closing}>
            <LinearGradient pointerEvents="none" colors={['rgba(255, 75, 51, 0)', 'rgba(255, 75, 51, 0.5)']} style={StyleSheet.absoluteFill} />
            <Text style={[styles.closingTitle, isTabletDevice && { fontSize: 52, lineHeight: 54 }]} accessibilityRole="header">
              Ready to frame your <Text style={[styles.closingTitle, isTabletDevice && { fontSize: 52, lineHeight: 54 }, { fontFamily: 'Lora-Medium', color: '#FF8A78' }]}>next production?</Text>
            </Text>
            <Text style={styles.closingSub}>Create your account, set up your encryption backup key, and start working with the people who make entertainment.</Text>
            <TouchableOpacity style={styles.closingCta} onPress={() => navigation.navigate('Register')} activeOpacity={0.85} accessibilityRole="button">
              <Text style={styles.closingCtaText}>Join CineCraft Connect</Text>
              <Icon name="arrow-right" size={18} color={INK} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.closingLink} onPress={() => navigation.navigate('Login')} activeOpacity={0.7} accessibilityRole="button">
              <Text style={styles.closingLinkText}>Sign in</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <AppLogo size="md" textColor="ink" onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: !reduce })} />
          <Text style={styles.footerSlug}>THE ENTERTAINMENT INDUSTRY NETWORK</Text>
          <View style={styles.footerCols}>
            {FOOTER_LINKS.map((g) => (
              <View key={g.title} style={styles.footerCol}>
                <Text style={styles.footerHead}>{g.title}</Text>
                {g.items.map((l) => (
                  <TouchableOpacity key={l.page} onPress={() => navigation.navigate('InfoPage', { page: l.page })} accessibilityRole="link" hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }} style={styles.footerLinkBtn}>
                    <Text style={styles.footerLink}>{l.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
          <Text style={styles.footerCopyright}>© 2026 CineCraft Connect.</Text>
        </View>
      </ScrollView>
    </TabletContainer>
  );
};

const FOOTER_LINKS = [
  { title: 'Product', items: [{ label: 'About', page: 'about' }, { label: 'Features', page: 'features' }] },
  { title: 'Help', items: [{ label: 'Support Hub', page: 'support' }] },
  { title: 'Legal', items: [{ label: 'Privacy', page: 'privacy' }, { label: 'Terms', page: 'terms' }, { label: 'Cookies', page: 'cookie' }] },
];

const styles = StyleSheet.create({
  navHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  signInBtn: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: LINE, backgroundColor: CARD },
  signInText: { color: INK, fontFamily: 'WorkSans-SemiBold', fontSize: 15 },

  heroWrap: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 36 },
  heroWrapTablet: { flexDirection: 'row', alignItems: 'center', gap: 32, paddingHorizontal: 48, paddingTop: 24, paddingBottom: 64 },
  heroText: {},
  badge: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', backgroundColor: CARD, borderWidth: 1, borderColor: LINE, borderRadius: 99, paddingHorizontal: 14, paddingVertical: 7, marginBottom: 20 },
  badgeText: { color: INK, fontFamily: 'WorkSans-SemiBold', fontSize: 14 },
  h1: { color: INK, fontFamily: 'WorkSans-Bold', fontSize: 33, lineHeight: 37, letterSpacing: -1.1, marginBottom: 16 },
  h1Tablet: { fontSize: 50, lineHeight: 55, letterSpacing: -1.8 },
  h1Accent: { fontFamily: 'Lora-Medium', color: ORANGE_INK, letterSpacing: -0.6 },
  sub: { color: MUTED, fontSize: 17, lineHeight: 26, marginBottom: 24 },
  ctaRow: { gap: 10, marginBottom: 20 },
  primaryCta: { minHeight: 54, borderRadius: 14, backgroundColor: INK, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 22 },
  primaryCtaText: { color: '#fff', fontFamily: 'WorkSans-Bold', fontSize: 16 },
  secondaryCta: { minHeight: 54, borderRadius: 14, borderWidth: 1, borderColor: LINE, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  secondaryCtaText: { color: INK, fontFamily: 'WorkSans-Bold', fontSize: 16 },
  phaseCard: { backgroundColor: CARD, borderWidth: 1, borderColor: LINE, borderRadius: 22, padding: 20 },
  phaseKicker: { color: ORANGE_INK, fontFamily: 'Inconsolata-Bold', fontSize: 13, letterSpacing: 1.8, marginBottom: 6 },
  phaseLine: { color: MUTED, fontSize: 15, lineHeight: 22, marginBottom: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#FFF1EE', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { color: INK, fontFamily: 'WorkSans-SemiBold', fontSize: 13.5 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  perkText: { color: MUTED, fontSize: 15 },

  section: { paddingHorizontal: 20, paddingTop: 44, paddingBottom: 20 },
  sectionTablet: { paddingHorizontal: 48, paddingTop: 64, paddingBottom: 28 },
  eyebrow: { color: ORANGE_INK, fontFamily: 'Inconsolata-Bold', fontSize: 14, letterSpacing: 2.4, marginBottom: 12 },
  h2: { color: INK, fontFamily: 'WorkSans-Bold', fontSize: 32, lineHeight: 35, letterSpacing: -1.1, marginBottom: 12 },
  h2Tablet: { fontSize: 46, lineHeight: 49, letterSpacing: -1.6 },
  lead: { color: MUTED, fontSize: 16, lineHeight: 25, marginBottom: 24 },

  grid3: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  moreCard: { backgroundColor: CARD, borderWidth: 1, borderColor: LINE, borderRadius: 22, padding: 22 },
  moreIcon: { width: 44, height: 44, borderRadius: 13, backgroundColor: '#FFF1EE', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  moreTitle: { color: INK, fontFamily: 'WorkSans-Bold', fontSize: 20, letterSpacing: -0.4, marginBottom: 6 },
  moreDesc: { color: MUTED, fontSize: 15, lineHeight: 23 },

  tier: { backgroundColor: CARD, borderWidth: 1, borderColor: LINE, borderRadius: 22, padding: 22 },
  tierType: { color: INK, fontFamily: 'WorkSans-Bold', fontSize: 22, letterSpacing: -0.5, marginBottom: 4 },
  tierDesc: { color: MUTED, fontSize: 15, marginBottom: 18 },
  tierLabel: { color: ORANGE_INK, fontFamily: 'Inconsolata-Bold', fontSize: 13, letterSpacing: 1.8, marginBottom: 3 },
  tierVal: { color: INK, fontSize: 15, lineHeight: 22 },

  closingWrap: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 36 },
  closing: { backgroundColor: INK, borderRadius: 28, overflow: 'hidden', paddingHorizontal: 24, paddingVertical: 44, alignItems: 'center' },
  closingTitle: { color: '#fff', fontFamily: 'WorkSans-Bold', fontSize: 34, lineHeight: 37, letterSpacing: -1.2, textAlign: 'center', marginBottom: 14 },
  closingSub: { color: 'rgba(255, 255, 255, 0.78)', fontSize: 16, lineHeight: 25, textAlign: 'center', marginBottom: 26 },
  closingCta: { alignSelf: 'stretch', minHeight: 54, borderRadius: 14, backgroundColor: ORANGE, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  closingCtaText: { color: INK, fontFamily: 'WorkSans-Bold', fontSize: 16 },
  closingLink: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  closingLinkText: { color: '#fff', fontFamily: 'WorkSans-SemiBold', fontSize: 16, textDecorationLine: 'underline' },

  footer: { paddingHorizontal: 20, paddingVertical: 28, borderTopWidth: 1, borderTopColor: LINE, alignItems: 'center' },
  footerCols: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', marginTop: 18, marginBottom: 18, gap: 12 },
  footerCol: { flex: 1 },
  footerHead: { color: INK, fontFamily: 'WorkSans-Bold', fontSize: 13, marginBottom: 6 },
  footerLinkBtn: { minHeight: 36, justifyContent: 'center' },
  footerLink: { color: MUTED, fontSize: 14 },
  footerSlug: { color: FAINT, fontFamily: 'Inconsolata-Regular', fontSize: 12, letterSpacing: 1.2, textAlign: 'center', marginTop: 10, marginBottom: 6 },
  footerCopyright: { color: FAINT, fontSize: 12, textAlign: 'center' },
});
