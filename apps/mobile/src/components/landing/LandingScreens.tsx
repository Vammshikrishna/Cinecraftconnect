import React from 'react';
import { View, Text, TextProps, ViewStyle } from 'react-native';
import { Icon } from '../common/Icon';

/* Mini versions of real CineCraft Connect screens, drawn for the landing screen. The people, titles and prices are examples.
   They are decorative (the phone is hidden from screen readers): the walkthrough text carries the same information.
   Text here ignores the system font size on purpose: the mini screens are pictures, and bigger text would break their layout. */
const APP_BG = '#F8F9FA';
const MUTED = '#64748B';
const LINE = '#E5E7EB';
const INK = '#14110F';
const ORANGE = '#FF4B33';
const ORANGE_INK = '#C4301B';

const T = ({ style, ...rest }: TextProps) => <Text allowFontScaling={false} style={[{ color: INK, fontSize: 12 }, style]} {...rest} />;
const title = { fontFamily: 'Lora-SemiBold' } as const;
const row: ViewStyle = { flexDirection: 'row', alignItems: 'center' };

// the app's bottom tabs, in its order: Home, Discussion Rooms, ProjectSpace, Jobs, Network (-1: a screen reached from More)
const Chrome = ({ children, tab }: { children: React.ReactNode; tab: number }) => (
  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: APP_BG }}>
    <View style={{ height: 40 }} />
    <View style={{ flex: 1, overflow: 'hidden' }}>{children}</View>
    <View style={{ height: 50, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: LINE, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' }}>
      {['home', 'message-circle', 'film', 'briefcase', 'users'].map((n, i) => (
        <Icon key={n} name={n} size={18} color={i === tab ? ORANGE : '#94A3B8'} strokeWidth={i === tab ? 2.4 : 1.8} />
      ))}
    </View>
  </View>
);

const Pill = ({ children, bg, color }: { children: string; bg: string; color: string }) => (
  <View style={{ backgroundColor: bg, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99, alignSelf: 'flex-start' }}>
    <T style={{ color, fontWeight: '700', fontSize: 10.5 }}>{children}</T>
  </View>
);

/* 1. profile with confirmed credits */
export const ProfileScreen = () => (
  <Chrome tab={4}>
    <View style={{ height: 78, backgroundColor: '#B8321F' }} />
    <View style={{ paddingHorizontal: 14, marginTop: -30 }}>
      <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: '#fff', borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 4 }}>
        <T style={{ ...title, fontSize: 22, color: ORANGE_INK }}>EC</T>
      </View>
      <View style={{ ...row, gap: 5, marginTop: 8 }}>
        <T style={{ ...title, fontSize: 18 }}>Emma Clarke</T>
        <Icon name="badge-check" size={16} color={ORANGE} />
      </View>
      <T style={{ color: MUTED, marginTop: 2 }}>Cinematographer · Los Angeles</T>
      <View style={{ flexDirection: 'row', gap: 18, marginVertical: 12 }}>
        {[['482', 'Connections'], ['12', 'Projects'], ['4.9', 'Rating']].map(([v, l]) => (
          <View key={l}><T style={{ fontWeight: '700', fontSize: 15 }}>{v}</T><T style={{ color: MUTED, fontSize: 10.5 }}>{l}</T></View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1, backgroundColor: ORANGE, borderRadius: 10, paddingVertical: 8, alignItems: 'center' }}><T style={{ color: '#fff', fontWeight: '700' }}>Connect</T></View>
        <View style={{ flex: 1, backgroundColor: '#fff', borderWidth: 1, borderColor: LINE, borderRadius: 10, paddingVertical: 8, alignItems: 'center' }}><T style={{ fontWeight: '600' }}>Message</T></View>
      </View>
      <T style={{ ...title, fontSize: 14, marginTop: 14, marginBottom: 6 }}>Filmography</T>
      {[['Harbour Lights', 'DoP · Feature film'], ['Northern Lights', 'Camera operator · Web series'], ['Golden Hour', 'DoP · Ad film']].map(([t, r]) => (
        <View key={t} style={{ ...row, gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: LINE, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 6 }}>
          <View style={{ flex: 1 }}>
            <T style={{ ...title, fontSize: 13 }}>{t}</T>
            <T style={{ color: MUTED, fontSize: 11 }}>{r}</T>
          </View>
          <Icon name="badge-check" size={16} color="#D97706" />
        </View>
      ))}
    </View>
  </Chrome>
);

/* 2. job board */
export const JobsScreen = () => (
  <Chrome tab={3}>
    <View style={{ paddingHorizontal: 14, paddingTop: 4 }}>
      <T style={{ ...title, fontSize: 20, marginBottom: 8 }}>Jobs</T>
      <View style={{ ...row, gap: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: LINE, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }}>
        <Icon name="search" size={14} color={MUTED} /><T style={{ color: MUTED }}>Search roles and crafts</T>
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginVertical: 10 }}>
        {['All', 'Cinematography', 'Editing'].map((c, i) => (
          <View key={c} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: i === 0 ? INK : '#fff', borderWidth: 1, borderColor: i === 0 ? INK : LINE }}>
            <T style={{ color: i === 0 ? '#fff' : INK, fontSize: 11, fontWeight: '600' }}>{c}</T>
          </View>
        ))}
      </View>
      {[
        { t: 'Colorist', c: 'Lantern Pictures · Feature film · Los Angeles', p: '$420 / day', d: 'Closes in 3 days', hot: true },
        { t: 'Assistant director', c: 'Neon Tide Studio · Music video · London', p: '$280 / day', d: 'Closes in 6 days', hot: false },
        { t: 'Sound designer', c: 'The Quiet Hour · Podcast · Remote', p: '$4,800 / project', d: 'Closes in 9 days', hot: false },
      ].map((j) => (
        <View key={j.t} style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: j.hot ? ORANGE : LINE, borderRadius: 14, padding: 11, marginBottom: 8 }}>
          <View style={{ ...row, justifyContent: 'space-between' }}>
            <T style={{ ...title, fontSize: 14 }}>{j.t}</T>
            <T style={{ color: ORANGE_INK, fontWeight: '700', fontSize: 11 }}>{j.d}</T>
          </View>
          <T style={{ color: MUTED, marginTop: 2, marginBottom: 6 }} numberOfLines={1}>{j.c}</T>
          <View style={{ ...row, justifyContent: 'space-between' }}>
            <T style={{ fontWeight: '700' }}>{j.p}</T>
            {j.hot ? <View style={{ backgroundColor: ORANGE, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 9 }}><T style={{ color: '#fff', fontWeight: '700' }}>Apply Now</T></View> : <T style={{ color: MUTED }}>Save</T>}
          </View>
        </View>
      ))}
    </View>
  </Chrome>
);

/* 3. project space chat */
const Bubble = ({ mine, children }: { mine: boolean; children: React.ReactNode }) => (
  <View style={{ maxWidth: '80%', alignSelf: mine ? 'flex-end' : 'flex-start', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 14, borderBottomRightRadius: mine ? 4 : 14, borderBottomLeftRadius: mine ? 14 : 4, backgroundColor: mine ? ORANGE : '#fff', borderWidth: mine ? 0 : 1, borderColor: LINE }}>
    {children}
  </View>
);
export const ProjectScreen = () => (
  <Chrome tab={2}>
    <View style={{ paddingHorizontal: 14, paddingBottom: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: LINE }}>
      <T style={{ ...title, fontSize: 16 }}>Harbour Lights</T>
      <View style={{ ...row, gap: 4 }}><Icon name="lock" size={11} color="#059669" /><T style={{ color: '#059669', fontWeight: '700', fontSize: 10.5 }}>END-TO-END ENCRYPTED</T></View>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
        {['Chat', 'Tasks', 'Files', 'Call sheet'].map((t, i) => (
          <View key={t} style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 99, backgroundColor: i === 0 ? INK : '#F1F5F9' }}>
            <T style={{ color: i === 0 ? '#fff' : INK, fontSize: 11, fontWeight: '600' }}>{t}</T>
          </View>
        ))}
      </View>
    </View>
    <View style={{ padding: 12, gap: 8 }}>
      <Bubble mine={false}><T style={{ color: ORANGE_INK, fontWeight: '700', fontSize: 10.5 }}>Daniel · Director</T><T>Call time moved to 6:30 AM. New call sheet is in Files.</T></Bubble>
      <Bubble mine={false}>
        <View style={{ ...row, gap: 8 }}>
          <View style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: '#FFF1EE', alignItems: 'center', justifyContent: 'center' }}><Icon name="paperclip" size={14} color={ORANGE} /></View>
          <View><T style={{ fontWeight: '700' }}>Call sheet · Day 12</T><T style={{ color: MUTED, fontSize: 10.5 }}>PDF · Tomorrow 6:30 AM</T></View>
        </View>
      </Bubble>
      <Bubble mine><T style={{ color: '#fff' }}>Got it. Bringing the 35mm set.</T></Bubble>
      <Bubble mine={false}><T style={{ color: ORANGE_INK, fontWeight: '700', fontSize: 10.5 }}>Sophie · Producer</T><T>Location permit approved for the harbour.</T></Bubble>
    </View>
    <View style={{ position: 'absolute', left: 10, right: 10, bottom: 8, ...row, gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: LINE, borderRadius: 99, paddingLeft: 14, paddingRight: 8, paddingVertical: 7 }}>
      <T style={{ flex: 1, color: MUTED }}>Message the crew</T>
      <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' }}><Icon name="send" size={13} color="#fff" /></View>
    </View>
  </Chrome>
);

/* 4. equipment marketplace */
export const GearScreen = () => (
  <Chrome tab={-1}>
    <View style={{ paddingHorizontal: 14, paddingTop: 4 }}>
      <T style={{ ...title, fontSize: 20, marginBottom: 8 }}>Rent gear</T>
      <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: LINE, borderRadius: 16, overflow: 'hidden' }}>
        <View style={{ height: 112, backgroundColor: '#2a1f1d', alignItems: 'center', justifyContent: 'center' }}><Icon name="camera" size={46} color="#FF8A78" strokeWidth={1.4} /></View>
        <View style={{ padding: 11 }}>
          <T style={{ ...title, fontSize: 15 }}>ARRI Alexa Mini LF</T>
          <View style={{ ...row, gap: 4, marginTop: 3, marginBottom: 7 }}><Icon name="badge-check" size={13} color="#059669" /><T style={{ color: MUTED }} numberOfLines={1}>Verified vendor · Frameworks Rentals</T></View>
          <View style={{ ...row, gap: 4 }}><Icon name="star" size={13} color="#F59E0B" fill="#F59E0B" /><T style={{ fontWeight: '700' }}>4.8</T><T style={{ color: MUTED }}>(126 reviews)</T></View>
          <View style={{ ...row, justifyContent: 'space-between', marginTop: 9 }}>
            <View style={row}><T style={{ fontWeight: '700', fontSize: 16 }}>$950</T><T style={{ color: MUTED }}> / day</T></View>
            <View style={{ backgroundColor: ORANGE, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9 }}><T style={{ color: '#fff', fontWeight: '700' }}>Request quote</T></View>
          </View>
          <View style={{ marginTop: 8 }}><Pill bg="#ECFDF5" color="#047857">Available 14 to 18 Nov</Pill></View>
        </View>
      </View>
      {[['Cooke S4 prime set', '$310 / day'], ['Aputure 600d light', '$120 / day']].map(([n, p]) => (
        <View key={n} style={{ ...row, justifyContent: 'space-between', backgroundColor: '#fff', borderWidth: 1, borderColor: LINE, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 9, marginTop: 8 }}>
          <T style={{ ...title, fontSize: 13 }}>{n}</T><T style={{ fontWeight: '700' }}>{p}</T>
        </View>
      ))}
    </View>
  </Chrome>
);

/* 5. pitch and announcements */
export const PitchScreen = () => (
  <Chrome tab={0}>
    <View style={{ paddingHorizontal: 14, paddingTop: 4 }}>
      <T style={{ ...title, fontSize: 20, marginBottom: 8 }}>Announcements</T>
      <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: LINE, borderRadius: 14, padding: 12 }}>
        <Pill bg="#FFF1EE" color={ORANGE_INK}>HIRING</Pill>
        <T style={{ ...title, fontSize: 15, marginTop: 8, marginBottom: 4, lineHeight: 19 }}>Casting call: lead roles for a feature film</T>
        <T style={{ color: MUTED }}>Auditions on 25 Oct, 10 AM, Los Angeles.</T>
        <View style={{ ...row, justifyContent: 'space-between', marginTop: 10 }}>
          <View style={{ ...row, gap: 4 }}><Icon name="badge-check" size={13} color={ORANGE} /><T style={{ color: MUTED, fontSize: 11 }}>Lantern Pictures</T></View>
          <T style={{ color: MUTED, fontSize: 11 }}>1.2k views</T>
        </View>
      </View>
      <T style={{ ...title, fontSize: 14, marginTop: 14, marginBottom: 6 }}>Your pitch</T>
      <View style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: LINE, borderRadius: 14, padding: 12 }}>
        <T style={{ ...title, fontSize: 14 }}>The Quiet Hour</T>
        <T style={{ color: MUTED, marginTop: 2, marginBottom: 8 }}>Treatment and deck attached. Sent to 3 producers.</T>
        <View style={{ flexDirection: 'row', gap: 6 }}><Pill bg="#ECFDF5" color="#047857">Sent</Pill><Pill bg="#F1F5F9" color={MUTED}>Showreel linked</Pill></View>
      </View>
      <View style={{ ...row, justifyContent: 'space-between', marginTop: 10, backgroundColor: INK, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
        <T style={{ color: '#fff' }}><T style={{ color: '#fff', fontWeight: '700' }}>Open call</T> · short film series</T>
        <T style={{ color: '#FF8A78', fontWeight: '700' }}>30 Nov</T>
      </View>
    </View>
  </Chrome>
);

/* 6. discussion rooms: the app's room card (emoji, title, category badge, Private / Active, members, Enter Room / Join) */
export const DiscussionScreen = () => (
  <Chrome tab={1}>
    <View style={{ paddingHorizontal: 14, paddingTop: 4 }}>
      <T style={{ ...title, fontSize: 20, marginBottom: 8 }}>Discussion Rooms</T>
      <View style={{ ...row, gap: 6, backgroundColor: '#fff', borderWidth: 1, borderColor: LINE, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }}>
        <Icon name="search" size={14} color={MUTED} /><T style={{ color: MUTED }}>Search rooms</T>
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginVertical: 10 }}>
        {['All', 'Cinematography', 'Editing'].map((c, i) => (
          <View key={c} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: i === 0 ? INK : '#fff', borderWidth: 1, borderColor: i === 0 ? INK : LINE }}>
            <T style={{ color: i === 0 ? '#fff' : INK, fontSize: 11, fontWeight: '600' }}>{c}</T>
          </View>
        ))}
      </View>
      {[
        { e: '🎥', t: 'Cinematography Lounge', cat: 'CINEMATOGRAPHY', d: 'Lenses, lighting and camera moves. Share frames and ask for notes.', m: '1,284 members', ago: '2m ago', priv: false, cta: 'Enter Room' },
        { e: '✂️', t: "Editors' Cut", cat: 'EDITING', d: 'Pacing, workflows and feedback on rough cuts.', m: '642 members', ago: '14m ago', priv: true, cta: 'Join Discussion Room' },
      ].map((r) => (
        <View key={r.t} style={{ backgroundColor: '#fff', borderWidth: 1, borderColor: LINE, borderRadius: 14, padding: 11, marginBottom: 8 }}>
          <View style={{ ...row, gap: 8, marginBottom: 6 }}>
            <T style={{ fontSize: 22 }}>{r.e}</T>
            <T style={{ ...title, fontSize: 14, flex: 1 }}>{r.t}</T>
          </View>
          <View style={{ ...row, gap: 6, marginBottom: 6 }}>
            <View style={{ borderWidth: 1, borderColor: LINE, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1 }}><T style={{ fontFamily: 'Inconsolata-Bold', fontSize: 9.5, color: MUTED }}>{r.cat}</T></View>
            {r.priv && <View style={{ backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1 }}><T style={{ fontSize: 9.5, fontWeight: '700', color: '#B45309' }}>Private</T></View>}
            <View style={{ ...row, gap: 4, marginLeft: 'auto' }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' }} /><T style={{ fontSize: 10, fontWeight: '700', color: '#059669' }}>Active</T></View>
          </View>
          <T style={{ color: MUTED, lineHeight: 17, marginBottom: 8 }}>{r.d}</T>
          <View style={{ ...row, justifyContent: 'space-between', marginBottom: 8 }}><T style={{ color: MUTED, fontSize: 10.5 }}>{r.m}</T><T style={{ color: MUTED, fontSize: 10.5 }}>{r.ago}</T></View>
          <View style={{ backgroundColor: 'rgba(255,75,51,0.10)', borderRadius: 9, paddingVertical: 7, alignItems: 'center' }}><T style={{ color: ORANGE_INK, fontWeight: '700' }}>{r.cta}</T></View>
        </View>
      ))}
    </View>
  </Chrome>
);
