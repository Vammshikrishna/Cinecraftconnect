import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Linking, BackHandler } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { HELP_ARTICLES, HELP_CATEGORIES, articlesInCategory, getHelpArticle, popularHelpArticles, searchHelp, type HelpArticle } from '@cinecraft/core';
import { Icon } from '../../components/common/Icon';
import { TabletContainer } from '../../components/common/TabletContainer';

/* The pages behind the landing footer (About, Features, Support Hub, Privacy, Terms, Cookies), all native and bundled, so they read offline.
   The Support Hub uses the same help articles as the signed-in Help Center (packages/core/src/help.ts). */

const ORANGE = '#FF4B33';
const ORANGE_INK = '#C4301B';
const INK = '#14110F';
const MUTED = '#5B544E';
const FAINT = '#6F6862';
const LINE = 'rgba(20, 17, 15, 0.1)';
const TINT = '#FFF1EE';
const SUPPORT_EMAIL = 'support@cinecraftconnect.com';

export type InfoPage = 'about' | 'features' | 'support' | 'privacy' | 'terms' | 'cookie';

type Card = { icon: string; title: string; text: string; tags?: string[] };
type Sec = { title: string; paras?: string[]; bullets?: string[]; cards?: Card[]; note?: string };

const ABOUT: Sec[] = [
  { title: 'What we believe', cards: [
    { icon: 'users', title: 'Community first', text: 'We believe the best work happens when creators support one another. Our platform fosters genuine, un-gamified professional connections.' },
    { icon: 'shield', title: 'Security and privacy', text: 'Every pitch, conversation and project space is protected. We enforce E2EE encryption so your creative property remains strictly yours.' },
    { icon: 'heart', title: 'Creative freedom', text: 'No algorithm decides what you see or who hires you. Your craft speaks for itself, free from vanity metrics.' },
    { icon: 'globe', title: 'Borderless cinema', text: 'From Mumbai to Los Angeles, CineCraft bridges creative communities across continents without barriers.' },
    { icon: 'lightbulb', title: 'Innovation led', text: 'Constant iteration guided by creator feedback, not investor dashboards. We build what the industry actually needs.' },
    { icon: 'film', title: 'Story first', text: 'Every feature decision starts with one question: does this help a creator tell a better story?' },
  ] },
  { title: 'The story behind CineCraft', paras: [
    'Founded by a team of creators and software developers, CineCraft Connect was built to solve the real-world problems we faced while making content across films, TV, YouTube, ad campaigns and digital media.',
    'After years of using fragmented tools (spreadsheets for casting, WhatsApp for coordination, email chains for script feedback) we decided to build the platform we always wished existed.',
    'Today, CineCraft Connect is open for its first users. Join us at launch and help shape the platform for the entire entertainment community.',
  ] },
];

const FEATURES: Sec[] = [
  { title: 'Every tool your production needs', cards: [
    { icon: 'home', title: 'Community Feed', text: 'Your personalized stream of industry updates, behind-the-scenes content and creative inspiration from films, TV, YouTube and every format.', tags: ['Photo & Video Posts', 'Industry News', 'Behind The Scenes', 'Creator Spotlights'] },
    { icon: 'users', title: 'Creator Network', text: 'Discover and connect with professionals across every discipline: film directors, TV producers, YouTubers, brand filmmakers, podcast creators and more.', tags: ['Smart Matching', 'Craft Filters', 'Mutual Connections', 'Portfolio Previews'] },
    { icon: 'film', title: 'Project Management', text: 'Organize any production from concept to delivery. Track scenes, manage assets and collaborate with your crew in real time, whether it is a feature film or a Reels campaign.', tags: ['Scene Tracking', 'Asset Library', 'Crew Roles', 'Production Timeline'] },
    { icon: 'store', title: 'Equipment Marketplace', text: 'Rent and list professional gear from verified creators and studios. Cinema cameras, lenses, drones, lighting rigs, audio equipment and studio spaces.', tags: ['Verified Listings', 'Secure Payments', 'Insurance Options', 'Local Pickups'] },
    { icon: 'briefcase', title: 'Job Board', text: 'The most active job board across the entertainment industry. Film, TV, OTT, YouTube, ad films, brand content, music videos, podcast productions and more.', tags: ['All Formats', 'Portfolio Integration', 'Direct Messaging', 'Verified Employers'] },
    { icon: 'message-circle', title: 'Discussion Rooms', text: 'Craft-specific communities for every corner of entertainment: cinematography, editing, sound, production design, digital content, advertising and live events.', tags: ['Spatial Audio', 'Screen Sharing', 'Whiteboarding', 'Room Categories'] },
    { icon: 'building', title: 'Company Pages', text: 'Dedicated profiles for studios, agencies and production houses. Showcase your portfolio, list job openings and manage your team in one space.', tags: ['Team Roster', 'Verified Jobs', 'Studio Portfolio', 'Brand Assets'] },
    { icon: 'store', title: 'Verified Vendors', text: 'Find trusted service providers for your next production, from catering and transport to specialized VFX houses and legal counsel.', tags: ['Service Listings', 'Direct Booking', 'Location Filters', 'Vendor Badges'] },
    { icon: 'star', title: 'Ratings & Reviews', text: 'Build professional credibility with a transparent rating system. Review collaborators, equipment renters and vendors after a project is completed.', tags: ['Verified Reviews', 'Project-tied Feedback', 'Dispute Resolution', 'Trust Scores'] },
    { icon: 'megaphone', title: 'Industry Announcements', text: 'Broadcast major updates to your network. Share festival selections, project wraps, casting calls and release dates.', tags: ['Push Notifications', 'Custom Banners', 'Analytics', 'Targeted Reach'] },
  ] },
  { title: 'Choose your access level', cards: [
    { icon: 'eye', title: 'Fan Account', text: 'For enthusiasts and fans. View-only access to public feeds, announcements and discussions. Cannot post jobs, rent equipment, pitch stories or directly message industry professionals.' },
    { icon: 'badge-check', title: 'Creator Pro', text: 'For individual filmmakers and creators. Full access to the creator network, project spaces, job board, pitching and marketplace. Standard platform fees apply to equipment rentals and job promotions.' },
    { icon: 'building', title: 'Studio / Company', text: 'For production houses and agencies. Everything in Pro, plus Company Pages, multi-user project management and verified job postings. Requires business verification.' },
  ] },
  { title: 'Built into every account', cards: [
    { icon: 'globe', title: 'Global Network', text: 'Connect with professionals worldwide.' },
    { icon: 'lock', title: 'Secure Workflow', text: 'Your data and assets are encrypted.' },
    { icon: 'zap', title: 'Instant Updates', text: 'Real-time sync across all devices.' },
    { icon: 'check-circle', title: 'Pro Verification', text: 'Build trust with verified badges.' },
  ] },
];

const PRIVACY: Sec[] = [
  { title: 'Introduction', paras: ['CineCraft Connect acts as the Data Controller under GDPR guidelines for all data collected through our platform. This Privacy Policy applies to all users of our web and mobile applications.'] },
  { title: 'Data we collect', cards: [
    { icon: 'user', title: 'Identity', text: 'First name, last name, username, and craft or role.' },
    { icon: 'message-circle', title: 'Contact details', text: 'Email address and linked social handles.' },
    { icon: 'phone', title: 'Technical data', text: 'IP address, browser type, and native device info.' },
    { icon: 'zap', title: 'Usage activity', text: 'How you use our casting and project features.' },
    { icon: 'film', title: 'Profile information', text: 'Showreels, job histories, project files, and ratings.' },
    { icon: 'lock', title: 'Communications', text: 'Encrypted message metadata for security auditing.' },
  ] },
  { title: 'How we use data', cards: [
    { icon: 'search', title: 'Casting & directory', text: 'To present your credentials within searches, allowing directors to coordinate hires.' },
    { icon: 'lock', title: 'Encrypted communication', text: 'To synchronize end-to-end encrypted direct messaging and project space channels.' },
    { icon: 'shield', title: 'Platform integrity', text: 'To audit operations and prevent malicious script injections or fraudulent project postings.' },
    { icon: 'zap', title: 'Service improvement', text: 'To analyze usage patterns and improve platform features and performance over time.' },
  ] },
  { title: 'Data sharing', paras: [
    'We do not sell your personal data to third parties. We may share your data with trusted service providers who assist in operating the platform, subject to strict confidentiality agreements.',
    'We may disclose your information if required by law, court order, or to protect the rights, property, or safety of CineCraft Connect, our users, or the public.',
  ] },
  { title: 'Your GDPR rights', cards: [
    { icon: 'eye', title: 'Access', text: 'Request a copy of the personal data we hold about you.' },
    { icon: 'edit', title: 'Rectification', text: 'Request correction of inaccurate or incomplete data.' },
    { icon: 'trash', title: 'Erasure', text: 'Request deletion of your personal data under certain conditions.' },
    { icon: 'download', title: 'Portability', text: 'Request transfer of your data to another service provider.' },
  ] },
  { title: 'Account deletion', paras: ['In compliance with App Store and Google Play guidelines, you can request full account deletion via Account Settings. Your account, profile, and the data linked to it are permanently deleted from our production data stores. Copies in routine encrypted backups are removed as those backups rotate out.'] },
];

const TERMS: Sec[] = [
  { title: 'Agreement to terms', paras: ['By accessing or using CineCraft Connect (the "Platform"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Platform. These terms apply to all visitors, creators, and others who access or use the Service.'], note: 'CineCraft Connect reserves the right to update these terms at any time. Continued use constitutes acceptance of updated terms.' },
  { title: 'User accounts', cards: [
    { icon: 'lock', title: 'Responsibility', text: 'You are responsible for safeguarding credentials, session keys, and local E2EE private PIN codes. Any database changes under your token are your legal responsibility.' },
    { icon: 'user', title: 'Age requirements', text: 'You must be at least 18 years of age to contract casting positions or advertise camera gear rentals on this platform.' },
    { icon: 'check-circle', title: 'Accurate information', text: 'You agree to provide accurate, current, and complete information during registration and to update it as necessary.' },
    { icon: 'shield', title: 'Account security', text: 'Immediately notify us of any unauthorized use of your account or any breach of security you become aware of.' },
  ] },
  { title: 'Content & conduct', paras: ['Our Service allows you to post portfolios, link showreels, and communicate in encrypted project rooms. You represent and warrant that:'], bullets: [
    'You own or have licensing rights to all uploaded showreels and scripts.',
    'Your content does not infringe the privacy or copyright of any crew member.',
    'You will not post deceptive bids, dummy casting offers, or fraudulent vendor listings.',
    'You will not harass, threaten, or demean other members of the platform.',
    'You will not use the platform for any unlawful purpose or prohibited activity.',
  ] },
  { title: 'Intellectual property', paras: [
    'You retain all ownership rights to content you create and upload. By posting content, you grant us a limited, non-exclusive license to display and distribute it within the platform.',
    'The CineCraft Connect platform, including its design, code, branding, and all non-user-generated content, is owned by CineCraft Connect and protected by applicable intellectual property laws.',
  ] },
  { title: 'Limitation of liability', paras: [
    'In no event shall CineCraft Connect, its founders, or licensing partners be liable for any indirect, incidental, or consequential damages resulting from communications or rentals coordinated through our network tools.',
    'The Platform is provided on an "as is" and "as available" basis without warranties of any kind, either express or implied.',
    'Pitch Marketplace Exclusion: CineCraft Connect is a neutral marketplace platform. We are explicitly held harmless for any intellectual property disputes, script theft allegations, compensation disagreements, or creative ownership claims arising between writers (submitters) and call creators (producers) using the Pitch feature. The platform\'s role is limited to facilitating introductions and storing timestamped evidence, not adjudicating disputes.',
  ] },
  { title: 'Pitch Marketplace: dispute resolution', paras: ['This section governs all disputes arising from use of the Pitch feature, including pitch submission, review, or any resulting collaboration or IP claim.'], bullets: [
    'Mandatory Arbitration: All disputes must be resolved through binding private arbitration, not through public courts, except where applicable law explicitly prohibits this.',
    'Arbitration Body: Arbitration shall be conducted under the rules of the Society of Mediators and Arbitrators of India (SAMA) or any mutually agreed arbitration body.',
    'Venue: Arbitration proceedings shall take place in Hyderabad, Telangana, India, and may be conducted in English or Hindi.',
    'Class Action Waiver: Users waive all rights to participate in class-action lawsuits or class-wide arbitration against CineCraft Connect arising from Pitch feature disputes.',
    'Hold Harmless: Writers and call creators agree to hold CineCraft Connect harmless and indemnify it against any claims, damages, or legal costs arising from disputes between platform users.',
    'Evidence Admissibility: Parties agree that server-side timestamps, access logs, NDA signatures, and guild registration numbers stored by CineCraft Connect constitute valid and admissible evidence in any arbitration or court proceeding.',
  ], note: 'Governing law for Pitch disputes: Indian Copyright Act (1957), Information Technology Act (2000), and the Arbitration and Conciliation Act (1996).' },
  { title: 'Pitch-specific IP declarations', paras: ['By submitting a pitch through the CineCraft Connect Pitch Marketplace, writers and creators make the following legally binding declarations:'], bullets: [
    'Rights Ownership: You confirm you are the sole or authorised owner of all rights to the submitted story, script, or concept.',
    'Original Work: You declare the submission is an original creative work and has not been plagiarised from any existing copyrighted material.',
    'Guild Registration: If a Screenwriters Association (SWA) or WGA registration number is provided, you confirm it is accurate and belongs to the submitted work.',
    'False Declaration Liability: Submitting a pitch with false declarations constitutes fraudulent misrepresentation and may be prosecuted under the Indian Penal Code, Section 420, and the IT Act.',
    'NDA Binding Effect: If a Non-Disclosure Agreement (NDA) is signed via the platform\'s e-signature feature, it constitutes a valid clickwrap agreement under the Indian IT Act, 2000, and is legally binding on both parties.',
    'Call Creator Obligation: Call creators who sign an NDA to access protected pitch content are bound to maintain confidentiality and may not use the pitch concept without formal agreement with the writer.',
  ], note: 'Register your script before pitching: writers are strongly encouraged to register their work with the Screenwriters Association (SWA) before submitting. SWA registration provides government-backed copyright proof that significantly strengthens your legal position in any dispute.' },
  { title: 'Governing law', paras: ['These Terms shall be governed by and construed in accordance with applicable laws. Any disputes shall be resolved through binding arbitration in accordance with standard arbitration rules.'] },
];

const COOKIE: Sec[] = [
  { title: 'What are cookies?', paras: ['Cookies are small data blocks downloaded onto your device\'s browser memory when visiting websites. They allow the host application to maintain session consistency, secure private workspaces, and store interface theme configurations.'] },
  { title: 'How we use cookies', cards: [
    { icon: 'lock', title: 'Essential cookies (required)', text: 'Required to maintain your encrypted session. Stores JWT auth tokens to verify API access. Cannot be disabled.' },
    { icon: 'settings', title: 'Functional cookies (optional)', text: 'Configure interface aesthetics, keeping forced-light parameters active across logins, and caching showreel lists.' },
    { icon: 'zap', title: 'Analytical cookies (optional)', text: 'Optionally calculate anonymous server load metrics, tracking peak casting schedules to prevent latency spikes.' },
  ] },
  { title: 'Controlling cookies', paras: ['Most browser settings allow you to block, audit, or purge local cookies. Doing so will invalidate cached authentication state and log you out of protected workspaces.'] },
  { title: 'Cookie preferences', paras: ['You can manage your cookie preferences at any time through our Cookie Consent Banner, accessible from the settings menu. Withdrawing consent for optional cookies will not affect core functionality.'], note: 'Essential cookies cannot be disabled as they are required for the platform to function securely.' },
];

const META: Record<Exclude<InfoPage, 'support'>, { label: string; title: string; intro: string; sections: Sec[]; meta?: string }> = {
  about: { label: 'About', title: 'Empowering every creator in entertainment.', intro: 'CineCraft Connect was born from a simple observation: the entertainment industry is built on collaboration, yet the tools we use are fragmented. Whether you make feature films, TV shows, YouTube content, Instagram campaigns, ad films or podcasts, we exist to restore clarity, connection and security to your creative pipeline.', sections: ABOUT },
  features: { label: 'Features', title: 'Every tool your production needs.', intro: 'Film, TV, YouTube, Instagram, ad campaigns, music videos and podcasts: CineCraft Connect is built for every creator in the entertainment industry.', sections: FEATURES },
  privacy: { label: 'Legal', title: 'Privacy Policy', meta: 'Last updated April 17, 2026', intro: 'We respect your privacy and are committed to protecting your personal data. This policy explains how we collect, use, and safeguard your information.', sections: PRIVACY },
  terms: { label: 'Legal', title: 'Terms of Service', meta: 'Effective July 25, 2026', intro: 'By accessing or using CineCraft Connect, you agree to be bound by these Terms of Service and our Privacy Policy.', sections: TERMS },
  cookie: { label: 'Legal', title: 'Cookie Policy', meta: 'Last updated April 17, 2026', intro: 'This policy explains what cookies are, how we use them, and how you can control them when using CineCraft Connect.', sections: COOKIE },
};

const mail = (subject: string) =>
  Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`).catch(() => {});

const Pill = ({ text }: { text: string }) => (
  <View style={s.pill}><Text style={s.pillText}>{text}</Text></View>
);

const CardView = ({ c }: { c: Card }) => (
  <View style={s.card}>
    <View style={s.tile}><Icon name={c.icon} size={20} color={ORANGE} /></View>
    <Text style={s.cardTitle}>{c.title}</Text>
    <Text style={s.cardText}>{c.text}</Text>
    {c.tags && <View style={s.tags}>{c.tags.map((t) => <Pill key={t} text={t} />)}</View>}
  </View>
);

const SectionView = ({ sec, n }: { sec: Sec; n: number }) => (
  <View style={s.sec}>
    <Text style={s.secTitle}><Text style={s.secNum}>{String(n).padStart(2, '0')}  </Text>{sec.title}</Text>
    {sec.paras?.map((p, i) => <Text key={i} style={s.para}>{p}</Text>)}
    {sec.bullets?.map((b, i) => (
      <View key={i} style={s.bullet}><View style={s.dot} /><Text style={s.bulletText}>{b}</Text></View>
    ))}
    {sec.cards?.map((c) => <CardView key={c.title} c={c} />)}
    {sec.note && <View style={s.note}><Text style={s.noteText}>{sec.note}</Text></View>}
  </View>
);

const ArticleView = ({ a, open }: { a: HelpArticle; open: (id: string) => void }) => (
  <View>
    <Text style={s.h2}>{a.title}</Text>
    <Text style={s.para}>{a.summary}</Text>
    {a.steps?.map((st, i) => (
      <View key={i} style={s.bullet}><Text style={s.stepNum}>{i + 1}</Text><Text style={s.bulletText}>{st}</Text></View>
    ))}
    {a.body.map((p, i) => <Text key={i} style={s.para}>{p}</Text>)}
    {a.related && a.related.length > 0 && <Text style={s.kicker}>RELATED</Text>}
    {a.related?.map((id) => {
      const r = getHelpArticle(id);
      return r ? <ArticleRow key={id} a={r} open={open} /> : null;
    })}
  </View>
);

const ArticleRow = ({ a, open }: { a: HelpArticle; open: (id: string) => void }) => (
  <TouchableOpacity style={s.row} onPress={() => open(a.id)} accessibilityRole="button" activeOpacity={0.8}>
    <View style={{ flex: 1 }}>
      <Text style={s.rowTitle}>{a.title}</Text>
      <Text style={s.rowSub} numberOfLines={2}>{a.summary}</Text>
    </View>
    <Icon name="chevron-right" size={18} color={FAINT} />
  </TouchableOpacity>
);

type SupportView = { name: 'home' } | { name: 'category'; id: string } | { name: 'article'; id: string };

const SupportHub = ({ view, setView }: { view: SupportView; setView: (v: SupportView) => void }) => {
  const [q, setQ] = useState('');
  const results = useMemo(() => (q.trim().length > 1 ? searchHelp(q) : []), [q]);
  const openArticle = (id: string) => setView({ name: 'article', id });

  if (view.name === 'article') {
    const a = getHelpArticle(view.id);
    if (!a) return <Text style={s.para}>This article is not available.</Text>;
    return <ArticleView a={a} open={openArticle} />;
  }
  if (view.name === 'category') {
    const cat = HELP_CATEGORIES.find((c) => c.id === view.id);
    return (
      <View>
        <Text style={s.h2}>{cat?.title}</Text>
        <Text style={s.para}>{cat?.description}</Text>
        {articlesInCategory(view.id).map((a) => <ArticleRow key={a.id} a={a} open={openArticle} />)}
      </View>
    );
  }
  return (
    <View>
      <View style={s.search}>
        <Icon name="search" size={18} color={FAINT} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search help articles" placeholderTextColor={FAINT} style={s.searchInput} accessibilityLabel="Search help articles" returnKeyType="search" />
        {q.length > 0 && <TouchableOpacity onPress={() => setQ('')} accessibilityLabel="Clear search" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><Icon name="x" size={18} color={FAINT} /></TouchableOpacity>}
      </View>
      {q.trim().length > 1 ? (
        results.length === 0 ? <Text style={s.para}>No articles match "{q}". Try other words, or email us below.</Text> : results.map((a) => <ArticleRow key={a.id} a={a} open={openArticle} />)
      ) : (
        <>
          <Text style={s.kicker}>POPULAR</Text>
          {popularHelpArticles().map((a) => <ArticleRow key={a.id} a={a} open={openArticle} />)}
          <Text style={[s.kicker, { marginTop: 22 }]}>BROWSE BY TOPIC</Text>
          {HELP_CATEGORIES.map((c) => (
            <TouchableOpacity key={c.id} style={s.row} onPress={() => setView({ name: 'category', id: c.id })} accessibilityRole="button" activeOpacity={0.8}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{c.title}</Text>
                <Text style={s.rowSub}>{c.description} · {articlesInCategory(c.id).length}</Text>
              </View>
              <Icon name="chevron-right" size={18} color={FAINT} />
            </TouchableOpacity>
          ))}
          <View style={s.contact}>
            <Text style={s.cardTitle}>Cannot sign in, or still stuck?</Text>
            <Text style={s.cardText}>Email us from the address on your account and say what happened. We reply by email.</Text>
            <TouchableOpacity style={s.mailBtn} onPress={() => mail('Help with CineCraft Connect')} accessibilityRole="button" activeOpacity={0.85}>
              <Text style={s.mailBtnText}>Email support</Text>
            </TouchableOpacity>
            <Text style={s.fine}>{SUPPORT_EMAIL} · {HELP_ARTICLES.length} articles in this hub</Text>
          </View>
        </>
      )}
    </View>
  );
};

export const InfoPagesScreen = ({ navigation, route }: any) => {
  const page: InfoPage = route?.params?.page ?? 'about';
  const [view, setView] = useState<SupportView>({ name: 'home' });

  const back = () => {
    if (page === 'support' && view.name !== 'home') {
      setView(view.name === 'article' ? { name: 'home' } : { name: 'home' });
      return true;
    }
    navigation.goBack();
    return true;
  };
  useFocusEffect(React.useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', back);
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, view]));

  const m = page === 'support' ? null : META[page];
  return (
    <TabletContainer>
      <View style={s.bar}>
        <TouchableOpacity onPress={back} accessibilityRole="button" accessibilityLabel="Back" style={s.back} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="arrow-left" size={22} color={INK} />
        </TouchableOpacity>
        <Text style={s.barTitle}>{page === 'support' ? 'Support Hub' : m!.title.length > 28 ? m!.label : m!.title}</Text>
      </View>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {page === 'support' ? (
          view.name === 'home' ? (
            <>
              <Text style={s.label}>SUPPORT HUB</Text>
              <Text style={s.title}>How can we help?</Text>
              <Text style={s.intro}>Answers for every kind of account. No sign in needed.</Text>
              <SupportHub view={view} setView={setView} />
            </>
          ) : <SupportHub view={view} setView={setView} />
        ) : (
          <>
            <Text style={s.label}>{m!.label.toUpperCase()}</Text>
            <Text style={s.title}>{m!.title}</Text>
            {m!.meta && <Text style={s.meta}>{m!.meta}</Text>}
            <Text style={s.intro}>{m!.intro}</Text>
            {m!.sections.map((sec, i) => <SectionView key={sec.title} sec={sec} n={i + 1} />)}
            {(page === 'about' || page === 'features') && (
              <TouchableOpacity style={s.cta} onPress={() => navigation.navigate('Register')} accessibilityRole="button" activeOpacity={0.85}>
                <Text style={s.ctaText}>Create your profile</Text>
              </TouchableOpacity>
            )}
            {(page === 'privacy' || page === 'terms' || page === 'cookie') && (
              <TouchableOpacity onPress={() => mail('Question about a CineCraft Connect policy')} accessibilityRole="button" style={s.policyMail}>
                <Text style={s.fine}>Questions about this policy? {SUPPORT_EMAIL}</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </ScrollView>
    </TabletContainer>
  );
};

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: LINE, backgroundColor: '#fff' },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  barTitle: { flex: 1, color: INK, fontFamily: 'WorkSans-Bold', fontSize: 17 },
  scroll: { padding: 20, paddingBottom: 56, backgroundColor: '#fff' },
  label: { color: ORANGE_INK, fontFamily: 'Inconsolata-Bold', fontSize: 13, letterSpacing: 1.6, marginBottom: 10 },
  title: { color: INK, fontFamily: 'WorkSans-Bold', fontSize: 32, lineHeight: 37, letterSpacing: -0.8, marginBottom: 10 },
  meta: { color: MUTED, fontFamily: 'Inconsolata-Bold', fontSize: 13, letterSpacing: 1, marginBottom: 12 },
  intro: { color: MUTED, fontSize: 16.5, lineHeight: 26, marginBottom: 24 },
  sec: { marginBottom: 26 },
  secTitle: { color: INK, fontFamily: 'WorkSans-Bold', fontSize: 21, lineHeight: 27, letterSpacing: -0.3, marginBottom: 12 },
  secNum: { color: ORANGE_INK, fontFamily: 'Inconsolata-Bold', fontSize: 16 },
  h2: { color: INK, fontFamily: 'WorkSans-Bold', fontSize: 24, lineHeight: 30, letterSpacing: -0.4, marginBottom: 8 },
  para: { color: MUTED, fontSize: 15.5, lineHeight: 25, marginBottom: 12 },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: ORANGE, marginTop: 9 },
  bulletText: { flex: 1, color: INK, fontSize: 15, lineHeight: 23 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: TINT, color: ORANGE_INK, fontFamily: 'Inconsolata-Bold', fontSize: 13, textAlign: 'center', lineHeight: 24, overflow: 'hidden' },
  card: { padding: 18, borderRadius: 20, borderWidth: 1, borderColor: LINE, backgroundColor: '#fff', marginBottom: 12 },
  tile: { width: 42, height: 42, borderRadius: 13, backgroundColor: TINT, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  cardTitle: { color: INK, fontFamily: 'WorkSans-Bold', fontSize: 18, lineHeight: 23, marginBottom: 6 },
  cardText: { color: MUTED, fontSize: 15, lineHeight: 23 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  pill: { backgroundColor: TINT, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 99 },
  pillText: { color: ORANGE_INK, fontFamily: 'WorkSans-SemiBold', fontSize: 13 },
  note: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255, 75, 51, 0.25)', backgroundColor: 'rgba(255, 75, 51, 0.05)', marginTop: 6 },
  noteText: { color: MUTED, fontSize: 14, lineHeight: 22, fontStyle: 'italic' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: LINE, marginBottom: 20 },
  searchInput: { flex: 1, color: INK, fontSize: 16, paddingVertical: 10 },
  kicker: { color: FAINT, fontFamily: 'Inconsolata-Bold', fontSize: 12, letterSpacing: 1.6, marginBottom: 8, marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: LINE },
  rowTitle: { color: INK, fontFamily: 'WorkSans-SemiBold', fontSize: 16, marginBottom: 2 },
  rowSub: { color: MUTED, fontSize: 14, lineHeight: 20 },
  contact: { marginTop: 28, padding: 20, borderRadius: 22, borderWidth: 1, borderColor: ORANGE, backgroundColor: '#fff' },
  mailBtn: { marginTop: 14, minHeight: 48, borderRadius: 14, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  mailBtnText: { color: INK, fontFamily: 'WorkSans-Bold', fontSize: 16 },
  fine: { color: FAINT, fontSize: 13, marginTop: 10, textAlign: 'center' },
  cta: { minHeight: 52, borderRadius: 14, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  ctaText: { color: INK, fontFamily: 'WorkSans-Bold', fontSize: 16 },
  policyMail: { minHeight: 44, justifyContent: 'center' },
});

export default InfoPagesScreen;
