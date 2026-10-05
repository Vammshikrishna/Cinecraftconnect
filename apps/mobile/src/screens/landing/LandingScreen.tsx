import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { AppLogo } from '../../components/common/AppLogo';
import { TabletContainer } from '../../components/common/TabletContainer';
import { useUserSettings } from '../../hooks/useUserSettings';

const { width } = Dimensions.get('window');

const CREAM = '#F8F5F0';
const INK = '#0D0D0D';
const ORANGE = '#f97316';

const ROLES = [
  'Directors',
  'YouTubers',
  'Cinematographers',
  'TV Producers',
  'Editors',
  'Instagram Creators',
  'Writers',
  'Ad Film Makers',
  'VFX Artists',
  'Music Video Directors',
  'Sound Designers',
  'Content Creators',
  'Showrunners',
  'Podcast Creators',
];

const PILLARS = [
  { val: 'Free', lbl: 'To Join' },
  { val: 'E2EE', lbl: 'Encrypted Chat' },
  { val: 'All', lbl: 'Platforms' },
  { val: '24/7', lbl: 'Uptime Goal' },
];

const FEATURES = [
  {
    n: '01',
    title: 'Creator Network',
    desc: 'Connect with professionals across films, TV shows, YouTube channels, Instagram brands, ad agencies, and music videos. Smart craft-based discovery.',
  },
  {
    n: '02',
    title: 'Project Spaces',
    desc: 'Collaborative rooms with end-to-end encrypted chat for any production — from feature films to Reels campaigns. Script feedback, shot lists, and scheduling, all in one place.',
  },
  {
    n: '03',
    title: 'Job Board',
    desc: 'Browse and post roles across every format — film sets, YouTube productions, ad campaigns, brand shoots, podcast studios, OTT shows, and more.',
  },
  {
    n: '04',
    title: 'Equipment Marketplace',
    desc: 'Rent and list professional gear — cinema cameras, lenses, lighting, audio, drones, and studio equipment — from verified creators and studios.',
  },
  {
    n: '05',
    title: 'Story Pitching',
    desc: 'Pitch your concepts directly to producers, brands, and studios. Submit showreels, storyboards, and concept decks from your profile.',
  },
  {
    n: '06',
    title: 'Discussion Rooms',
    desc: 'Craft-specific communities for every corner of the entertainment industry — film, TV, digital, music, advertising, and podcasting.',
  },
  {
    n: '07',
    title: 'Company Pages',
    desc: 'Dedicated profiles for studios, agencies, and production houses to showcase portfolios and list jobs.',
  },
  {
    n: '08',
    title: 'Verified Vendors',
    desc: 'Find trusted service providers for your next production, from catering to VFX houses.',
  },
  {
    n: '09',
    title: 'Ratings & Reviews',
    desc: 'Build professional credibility with transparent ratings after successful project completion.',
  },
  {
    n: '10',
    title: 'Industry Announcements',
    desc: 'Broadcast major updates, festival selections, and casting calls to your entire network.',
  },
];

const TIERS = [
  {
    type: 'Fan Account',
    desc: 'Designed for enthusiasts and fans.',
    access: 'View-only access to public feeds and discussions.',
    restrictions: 'Cannot post jobs, rent equipment, pitch stories, or message professionals.',
  },
  {
    type: 'Creator Pro',
    desc: 'For individual filmmakers and creators.',
    access: 'Full access to the creator network, project spaces, job board, and marketplace.',
    restrictions: 'Standard platform fees apply.',
  },
  {
    type: 'Studio / Company',
    desc: 'For production houses and agencies.',
    access: 'Everything in Pro, plus Company Pages and multi-user project management.',
    restrictions: 'Requires official business verification.',
  },
];

export const LandingScreen = ({ navigation }: { navigation: any }) => {
  const [roleIdx, setRoleIdx] = useState(0);
  const [txt, setTxt] = useState('');
  const [del, setDel] = useState(false);

  // Exact character-by-character typewriter loop matching web Index.tsx
  useEffect(() => {
    const word = ROLES[roleIdx];
    let timer: NodeJS.Timeout;

    if (!del && txt.length < word.length) {
      timer = setTimeout(() => {
        setTxt(word.slice(0, txt.length + 1));
      }, 70);
    } else if (!del && txt.length === word.length) {
      timer = setTimeout(() => {
        setDel(true);
      }, 1800);
    } else if (del && txt.length > 0) {
      timer = setTimeout(() => {
        setTxt(word.slice(0, txt.length - 1));
      }, 35);
    } else {
      setDel(false);
      setRoleIdx((prev) => (prev + 1) % ROLES.length);
    }

    return () => clearTimeout(timer);
  }, [txt, del, roleIdx]);

  const { themeColors, isDark } = useUserSettings();

  return (
    <TabletContainer backgroundColor={themeColors.bgScreen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── Top Navbar Brand ── */}
        <View style={[styles.navHeader, { borderBottomColor: themeColors.border }]}>
          <AppLogo size="md" textColor={isDark ? 'cream' : 'ink'} />

          <TouchableOpacity
            style={[styles.signInHeaderBtn, { borderColor: themeColors.border }]}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={[styles.signInHeaderBtnText, { color: themeColors.textPrimary }]}>Sign In</Text>
          </TouchableOpacity>
        </View>

        {/* ── Hero Section ── */}
        <View style={styles.heroSection}>
          {/* Eyebrow Slug */}
          <View style={styles.slugRow}>
            <View style={styles.slugDot} />
            <Text style={[styles.slugText, { color: themeColors.textMuted }]}>EXT. PLATFORM LANDING — ENTERTAINMENT INDUSTRY</Text>
          </View>

          {/* Issue Eyebrow */}
          <View style={styles.issueRow}>
            <Text style={[styles.issueText, { color: themeColors.textMuted }]}>NOW LAUNCHING</Text>
            <View style={[styles.issueDivider, { backgroundColor: themeColors.border }]} />
            <Text style={[styles.issueText, { color: themeColors.textMuted }]}>2026</Text>
          </View>

          {/* Main Headline */}
          <Text style={[styles.heroHeadline, { color: themeColors.textPrimary }]}>
            Where <Text style={styles.typewriterText}>{txt}</Text>
            <Text style={styles.typewriterCursor}>|</Text>
            {'\n'}
            <Text style={[styles.heroHeadlineItalic, { color: themeColors.textSecondary }]}>build their next project.</Text>
          </Text>

          <Text style={[styles.heroSub, { color: themeColors.textSecondary }]}>
            The professional network for the entire entertainment industry — films, TV, YouTube, Instagram, ad films, music videos, podcasts, and every format in between.
          </Text>

          {/* Primary Action Buttons */}
          <View style={styles.ctaRow}>
            <TouchableOpacity
              style={[styles.primaryCta, { backgroundColor: isDark ? '#FFFFFF' : INK }]}
              onPress={() => navigation.navigate('Register')}
              activeOpacity={0.85}
            >
              <Text style={[styles.primaryCtaText, { color: isDark ? '#0D0D0D' : '#FFFFFF' }]}>Create Crew Profile →</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryCta, { borderColor: themeColors.border }]}
              onPress={() => navigation.navigate('Login')}
              activeOpacity={0.85}
            >
              <Text style={[styles.secondaryCtaText, { color: themeColors.textPrimary }]}>[ Sign In ]</Text>
            </TouchableOpacity>
          </View>

          {/* Scene Metadata */}
          <View style={styles.sceneMetaRow}>
            <Text style={[styles.sceneMetaText, { color: themeColors.textMuted }]}>Scene 01</Text>
            <Text style={[styles.sceneMetaDot, { color: themeColors.textMuted }]}>•</Text>
            <Text style={[styles.sceneMetaText, { color: themeColors.textMuted }]}>Roll A</Text>
            <Text style={[styles.sceneMetaDot, { color: themeColors.textMuted }]}>•</Text>
            <Text style={[styles.sceneMetaText, { color: themeColors.textMuted }]}>24.00 FPS</Text>
          </View>
        </View>

        {/* ── Launch Pillars (Dark Strip) ── */}
        <View style={styles.pillarsContainer}>
          <View style={styles.pillarsGrid}>
            {PILLARS.map((p, idx) => (
              <View
                key={idx}
                style={[
                  styles.pillarCell,
                  idx % 2 === 0 && styles.pillarBorderRight,
                  idx < 2 && styles.pillarBorderBottom,
                ]}
              >
                <Text style={styles.pillarVal}>{p.val}</Text>
                <Text style={styles.pillarLbl}>{p.lbl}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Manifesto Section ── */}
        <View style={[styles.manifestoSection, { borderBottomColor: themeColors.divider }]}>
          <View style={styles.slugRow}>
            <View style={styles.slugDot} />
            <Text style={[styles.slugText, { color: themeColors.textMuted }]}>INT. MANIFESTO ROOM — CONTINUOUS</Text>
          </View>
          <Text style={[styles.manifestoHeading, { color: themeColors.textPrimary }]}>
            Built for the entire entertainment industry.
          </Text>
          <Text style={[styles.manifestoFileSlug, { color: themeColors.textMuted }]}>[ File: CC_MANIFESTO.TXT ]</Text>

          <Text style={[styles.manifestoParagraph, { color: themeColors.textSecondary }]}>
            Whether you're making feature films, TV shows, YouTube videos, Instagram content, ad films, or music videos — CineCraft Connect is the professional home for every creator in the entertainment industry.
          </Text>
          <Text style={[styles.manifestoParagraph, { color: themeColors.textSecondary }]}>
            One platform, every format. End-to-end encrypted messaging in project spaces, a unified crew network, a verified equipment marketplace, and a job board that spans all of entertainment.
          </Text>
        </View>

        {/* ── Platform Modules (10 Feature Cards) ── */}
        <View style={styles.featuresSection}>
          <View style={styles.slugRow}>
            <View style={styles.slugDot} />
            <Text style={[styles.slugText, { color: themeColors.textMuted }]}>EXT. ECOSYSTEM SPECS — SEQUENCE INDEX</Text>
          </View>
          <Text style={[styles.featuresSectionTitle, { color: themeColors.textPrimary }]}>Platform Modules</Text>
          <Text style={[styles.featuresSectionSub, { color: themeColors.textSecondary }]}>
            Unified pipelines for casting, pitching, and secure coordination.
          </Text>

          <View style={styles.featuresList}>
            {FEATURES.map((item, idx) => (
              <View key={idx} style={[styles.featureCard, { borderBottomColor: themeColors.divider }]}>
                <View style={styles.featureHeaderRow}>
                  <Text style={styles.featureNum}>[ {item.n} ]</Text>
                  <Text style={[styles.featureTitle, { color: themeColors.textPrimary }]}>{item.title}</Text>
                </View>
                <Text style={[styles.featureDesc, { color: themeColors.textSecondary }]}>{item.desc}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Account Tiers Summary ── */}
        <View style={[styles.tiersSection, { backgroundColor: isDark ? themeColors.bgCard : '#F2EFE8' }]}>
          <View style={styles.slugRow}>
            <View style={styles.slugDot} />
            <Text style={[styles.slugText, { color: themeColors.textMuted }]}>INT. GATEWAY CONTROLS — MEMBERSHIP</Text>
          </View>
          <Text style={[styles.tiersSectionTitle, { color: themeColors.textPrimary }]}>Account Tiers</Text>

          {TIERS.map((tier, idx) => (
            <View key={idx} style={[styles.tierCard, { backgroundColor: isDark ? themeColors.chipBg : CREAM, borderColor: themeColors.border }]}>
              <Text style={[styles.tierType, { color: themeColors.textPrimary }]}>{tier.type}</Text>
              <Text style={[styles.tierDesc, { color: themeColors.textSecondary }]}>{tier.desc}</Text>

              <View style={styles.tierMetaBlock}>
                <Text style={styles.tierMetaLabel}>ACCESS</Text>
                <Text style={[styles.tierMetaVal, { color: themeColors.textPrimary }]}>{tier.access}</Text>
              </View>

              <View style={styles.tierMetaBlock}>
                <Text style={[styles.tierMetaLabelMuted, { color: themeColors.textMuted }]}>RESTRICTIONS</Text>
                <Text style={[styles.tierMetaValMuted, { color: themeColors.textSecondary }]}>{tier.restrictions}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Dark CTA Section with CUT. Watermark ── */}
        <View style={styles.darkCtaSection}>
          <Text style={styles.cutWatermark}>CUT.</Text>
          <View style={styles.darkCtaContent}>
            <View style={styles.slugRowCenter}>
              <View style={styles.slugDot} />
              <Text style={styles.slugTextDark}>EXT. THE NEXT SCENE — NIGHT</Text>
            </View>

            <Text style={styles.darkCtaHeading}>
              Ready to frame your next production?
            </Text>

            <Text style={styles.darkCtaSub}>
              Create your crew account, set up cryptographic backup keys, and start collaborating on a beautiful, distraction-free film network.
            </Text>

            <View style={styles.darkCtaBtnGroup}>
              <TouchableOpacity
                style={styles.darkJoinBtn}
                onPress={() => navigation.navigate('Register')}
              >
                <Text style={styles.darkJoinBtnText}>Join Community →</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.darkSignInBtn}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={styles.darkSignInBtnText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Complete Footer ── */}
        <View style={styles.footer}>
          <View style={styles.footerBrandRow}>
            <AppLogo size="md" textColor="cream" />
          </View>

          <Text style={styles.footerSlug}>
            THE ENTERTAINMENT INDUSTRY NETWORK — ALL PIPELINES SECURED
          </Text>

          <Text style={styles.footerCopyright}>
            © 2026 CineCraft Connect.
          </Text>
        </View>
      </ScrollView>
    </TabletContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CREAM,
  },
  content: {
    paddingBottom: 40,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(13, 13, 13, 0.08)',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  logoIconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF4B33',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  navBrandCine: {
    color: INK,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  navBrandConnect: {
    color: '#FF4B33',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  signInHeaderBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(13, 13, 13, 0.2)',
    borderRadius: 4,
  },
  signInHeaderBtnText: {
    color: INK,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  heroSection: {
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 36,
  },
  slugRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  slugRowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  slugDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ORANGE,
  },
  slugText: {
    color: 'rgba(13, 13, 13, 0.4)',
    fontSize: 9.5,
    fontWeight: '800',
    fontFamily: 'monospace',
    letterSpacing: 1.5,
  },
  slugTextDark: {
    color: 'rgba(248, 245, 240, 0.4)',
    fontSize: 9.5,
    fontWeight: '800',
    fontFamily: 'monospace',
    letterSpacing: 1.5,
  },
  issueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  issueText: {
    color: 'rgba(13, 13, 13, 0.35)',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
    letterSpacing: 1.2,
  },
  issueDivider: {
    width: 24,
    height: 1,
    backgroundColor: 'rgba(13, 13, 13, 0.15)',
  },
  heroHeadline: {
    color: INK,
    fontSize: 32,
    fontWeight: '300',
    lineHeight: 38,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  typewriterText: {
    color: ORANGE,
    fontWeight: '700',
  },
  typewriterCursor: {
    color: ORANGE,
    fontWeight: '700',
  },
  heroHeadlineItalic: {
    fontStyle: 'italic',
    color: 'rgba(13, 13, 13, 0.55)',
    fontWeight: '300',
  },
  heroSub: {
    color: 'rgba(13, 13, 13, 0.65)',
    fontSize: 14.5,
    lineHeight: 22,
    marginBottom: 28,
  },
  ctaRow: {
    flexDirection: 'column',
    gap: 12,
    marginBottom: 32,
  },
  primaryCta: {
    backgroundColor: INK,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 4,
    alignItems: 'center',
  },
  primaryCtaText: {
    color: CREAM,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  secondaryCta: {
    borderWidth: 1,
    borderColor: INK,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 4,
    alignItems: 'center',
  },
  secondaryCtaText: {
    color: INK,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sceneMetaRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  sceneMetaText: {
    color: 'rgba(13, 13, 13, 0.3)',
    fontSize: 10,
    fontFamily: 'monospace',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  sceneMetaDot: {
    color: 'rgba(13, 13, 13, 0.2)',
    fontSize: 10,
  },
  pillarsContainer: {
    backgroundColor: INK,
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  pillarsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  pillarCell: {
    width: '50%',
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  pillarBorderRight: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.1)',
  },
  pillarBorderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  pillarVal: {
    color: ORANGE,
    fontSize: 28,
    fontWeight: '300',
    marginBottom: 4,
  },
  pillarLbl: {
    color: 'rgba(248, 245, 240, 0.35)',
    fontSize: 9.5,
    fontWeight: '800',
    fontFamily: 'monospace',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  manifestoSection: {
    paddingHorizontal: 20,
    paddingVertical: 32,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(13, 13, 13, 0.08)',
  },
  manifestoHeading: {
    color: INK,
    fontSize: 24,
    fontWeight: '300',
    lineHeight: 30,
    marginBottom: 6,
  },
  manifestoFileSlug: {
    color: 'rgba(13, 13, 13, 0.35)',
    fontSize: 10,
    fontFamily: 'monospace',
    letterSpacing: 1.2,
    marginBottom: 16,
  },
  manifestoParagraph: {
    color: 'rgba(13, 13, 13, 0.65)',
    fontSize: 13.5,
    lineHeight: 21,
    marginBottom: 12,
  },
  featuresSection: {
    paddingHorizontal: 20,
    paddingVertical: 32,
  },
  featuresSectionTitle: {
    color: INK,
    fontSize: 24,
    fontWeight: '300',
    marginBottom: 4,
  },
  featuresSectionSub: {
    color: 'rgba(13, 13, 13, 0.5)',
    fontSize: 13,
    marginBottom: 20,
  },
  featuresList: {
    gap: 16,
  },
  featureCard: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(13, 13, 13, 0.08)',
  },
  featureHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  featureNum: {
    color: ORANGE,
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  featureTitle: {
    color: INK,
    fontSize: 16,
    fontWeight: '700',
  },
  featureDesc: {
    color: 'rgba(13, 13, 13, 0.6)',
    fontSize: 13,
    lineHeight: 19,
    paddingLeft: 28,
  },
  tiersSection: {
    paddingHorizontal: 20,
    paddingVertical: 32,
    backgroundColor: '#F2EFE8',
  },
  tiersSectionTitle: {
    color: INK,
    fontSize: 24,
    fontWeight: '300',
    marginBottom: 18,
  },
  tierCard: {
    backgroundColor: CREAM,
    borderWidth: 1,
    borderColor: 'rgba(13, 13, 13, 0.1)',
    borderRadius: 6,
    padding: 18,
    marginBottom: 16,
  },
  tierType: {
    color: INK,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  tierDesc: {
    color: 'rgba(13, 13, 13, 0.6)',
    fontSize: 12.5,
    marginBottom: 14,
  },
  tierMetaBlock: {
    marginBottom: 10,
  },
  tierMetaLabel: {
    color: ORANGE,
    fontSize: 9.5,
    fontWeight: '800',
    fontFamily: 'monospace',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  tierMetaLabelMuted: {
    color: 'rgba(13, 13, 13, 0.4)',
    fontSize: 9.5,
    fontWeight: '800',
    fontFamily: 'monospace',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  tierMetaVal: {
    color: 'rgba(13, 13, 13, 0.75)',
    fontSize: 12,
    lineHeight: 17,
  },
  tierMetaValMuted: {
    color: 'rgba(13, 13, 13, 0.55)',
    fontSize: 12,
    lineHeight: 17,
  },
  darkCtaSection: {
    backgroundColor: INK,
    paddingVertical: 48,
    paddingHorizontal: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  cutWatermark: {
    position: 'absolute',
    top: 20,
    alignSelf: 'center',
    color: 'rgba(248, 245, 240, 0.03)',
    fontSize: 140,
    fontWeight: '900',
    letterSpacing: -6,
  },
  darkCtaContent: {
    position: 'relative',
    zIndex: 2,
    alignItems: 'center',
  },
  darkCtaHeading: {
    color: CREAM,
    fontSize: 26,
    fontWeight: '300',
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: 14,
  },
  darkCtaSub: {
    color: 'rgba(248, 245, 240, 0.55)',
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  darkCtaBtnGroup: {
    width: '100%',
    gap: 12,
  },
  darkJoinBtn: {
    backgroundColor: ORANGE,
    paddingVertical: 14,
    borderRadius: 4,
    alignItems: 'center',
  },
  darkJoinBtnText: {
    color: CREAM,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  darkSignInBtn: {
    borderWidth: 1,
    borderColor: 'rgba(248, 245, 240, 0.2)',
    paddingVertical: 13,
    borderRadius: 4,
    alignItems: 'center',
  },
  darkSignInBtnText: {
    color: 'rgba(248, 245, 240, 0.7)',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(13, 13, 13, 0.08)',
    alignItems: 'center',
  },
  footerBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  footerBrandCine: {
    color: INK,
    fontSize: 14,
    fontWeight: '900',
  },
  footerBrandConnect: {
    color: '#FF4B33',
    fontSize: 14,
    fontWeight: '900',
  },
  footerSlug: {
    color: 'rgba(13, 13, 13, 0.35)',
    fontSize: 8.5,
    fontFamily: 'monospace',
    letterSpacing: 1.2,
    textAlign: 'center',
    marginBottom: 6,
  },
  footerCopyright: {
    color: 'rgba(13, 13, 13, 0.3)',
    fontSize: 9.5,
    textAlign: 'center',
  },
});
