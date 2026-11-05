import type { ReactNode, CSSProperties } from 'react';
import { BadgeCheck, Briefcase, Camera, Check, Clapperboard, Home, Lock, MapPin, MessagesSquare, Search, Send, Star, Users, Paperclip } from 'lucide-react';
import { INK, ORANGE, ORANGE_INK, SANS, SERIF } from './tokens';

/* Mini versions of real CineCraft Connect screens, drawn for the landing page. The people, titles and prices are examples.
   Everything here is decorative (the phone is aria-hidden): the walkthrough text carries the same information. */
const APP_BG = '#F8F9FA';
const APP_MUTED = '#64748B';
const APP_LINE = '#E5E7EB';

// the app's bottom tabs, in its order: Home, Discussion Rooms, ProjectSpace, Jobs, Network (tab -1: a screen reached from More)
const Screen = ({ children, tab }: { children: ReactNode; tab: -1 | 0 | 1 | 2 | 3 | 4 }) => {
  const icons = [Home, MessagesSquare, Clapperboard, Briefcase, Users];
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: APP_BG, color: INK, fontFamily: SANS, fontSize: 12 }}>
      <div style={{ height: 40, flexShrink: 0 }} />
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>{children}</div>
      <div style={{ height: 50, flexShrink: 0, background: '#fff', borderTop: `1px solid ${APP_LINE}`, display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
        {icons.map((Icon, i) => (
          <Icon key={i} size={18} color={i === tab ? ORANGE : '#94A3B8'} strokeWidth={i === tab ? 2.4 : 1.8} />
        ))}
      </div>
    </div>
  );
};

const title: CSSProperties = { fontFamily: SERIF, fontWeight: 600, letterSpacing: '-0.01em' };

/* 1. profile with confirmed credits */
export const ProfileScreen = () => (
  <Screen tab={4}>
    <div style={{ height: 78, background: 'linear-gradient(120deg, #FF4B33, #7A1F12 85%)' }} />
    <div style={{ padding: '0 14px', marginTop: -30 }}>
      <div style={{ width: 62, height: 62, borderRadius: 31, background: '#fff', border: '3px solid #fff', boxShadow: '0 4px 14px rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', ...title, fontSize: 22, color: ORANGE_INK }}>EC</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8 }}>
        <span style={{ ...title, fontSize: 18 }}>Emma Clarke</span>
        <BadgeCheck size={16} color={ORANGE} />
      </div>
      <div style={{ color: APP_MUTED, marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}><Camera size={12} /> Cinematographer <span aria-hidden>·</span> <MapPin size={12} /> Los Angeles</div>
      <div style={{ display: 'flex', gap: 18, margin: '12px 0' }}>
        {[['482', 'Connections'], ['12', 'Projects'], ['4.9', 'Rating']].map(([v, l]) => (
          <div key={l}><div style={{ fontWeight: 700, fontSize: 15 }}>{v}</div><div style={{ color: APP_MUTED, fontSize: 10.5 }}>{l}</div></div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, background: ORANGE, color: '#fff', borderRadius: 10, padding: '8px 0', textAlign: 'center', fontWeight: 700 }}>Connect</div>
        <div style={{ flex: 1, border: `1px solid ${APP_LINE}`, background: '#fff', borderRadius: 10, padding: '8px 0', textAlign: 'center', fontWeight: 600 }}>Message</div>
      </div>
      <div style={{ ...title, fontSize: 14, margin: '14px 0 6px' }}>Filmography</div>
      {[['Harbour Lights', 'Director of photography', 'Feature film'], ['Northern Lights', 'Camera operator', 'Web series'], ['Golden Hour', 'Director of photography', 'Ad film']].map(([t, r, k]) => (
        <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: `1px solid ${APP_LINE}`, borderRadius: 12, padding: '8px 10px', marginBottom: 6 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...title, fontSize: 13 }}>{t}</div>
            <div style={{ color: APP_MUTED, fontSize: 11 }}>{r} · {k}</div>
          </div>
          <BadgeCheck size={16} color="#D97706" />
        </div>
      ))}
    </div>
  </Screen>
);

/* 2. job board */
export const JobsScreen = () => (
  <Screen tab={3}>
    <div style={{ padding: '4px 14px' }}>
      <div style={{ ...title, fontSize: 20, marginBottom: 8 }}>Jobs</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: `1px solid ${APP_LINE}`, borderRadius: 10, padding: '8px 10px', color: APP_MUTED }}><Search size={14} /> Search roles and crafts</div>
      <div style={{ display: 'flex', gap: 6, margin: '10px 0' }}>
        {['All', 'Cinematography', 'Editing', 'VFX'].map((c, i) => (
          <span key={c} style={{ padding: '4px 10px', borderRadius: 99, background: i === 0 ? INK : '#fff', color: i === 0 ? '#fff' : INK, border: `1px solid ${i === 0 ? INK : APP_LINE}`, fontSize: 11, fontWeight: 600 }}>{c}</span>
        ))}
      </div>
      {[
        { t: 'Colorist', c: 'Lantern Pictures', m: 'Feature film · Los Angeles · On-site', p: '$420 / day', d: 'Closes in 3 days', hot: true },
        { t: 'Assistant director', c: 'Neon Tide Studio', m: 'Music video · London · Hybrid', p: '$280 / day', d: 'Closes in 6 days', hot: false },
        { t: 'Sound designer', c: 'The Quiet Hour', m: 'Podcast · Remote', p: '$4,800 / project', d: 'Closes in 9 days', hot: false },
      ].map((j) => (
        <div key={j.t} style={{ background: '#fff', border: `1px solid ${j.hot ? ORANGE : APP_LINE}`, borderRadius: 14, padding: 11, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
            <div style={{ ...title, fontSize: 14 }}>{j.t}</div>
            <span style={{ color: ORANGE_INK, fontWeight: 700, fontSize: 11 }}>{j.d}</span>
          </div>
          <div style={{ color: APP_MUTED, margin: '2px 0 6px' }}>{j.c} · {j.m}</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 700 }}>{j.p}</span>
            {j.hot ? <span style={{ background: ORANGE, color: '#fff', padding: '5px 12px', borderRadius: 9, fontWeight: 700 }}>Apply Now</span> : <span style={{ color: APP_MUTED }}>Save</span>}
          </div>
        </div>
      ))}
    </div>
  </Screen>
);

/* 3. project space chat */
export const ProjectScreen = () => {
  const bubble = (mine: boolean): CSSProperties => ({
    maxWidth: '78%', alignSelf: mine ? 'flex-end' : 'flex-start', padding: '8px 11px', borderRadius: 14,
    borderBottomRightRadius: mine ? 4 : 14, borderBottomLeftRadius: mine ? 14 : 4,
    background: mine ? ORANGE : '#fff', color: mine ? '#fff' : INK, border: mine ? 'none' : `1px solid ${APP_LINE}`, lineHeight: 1.4,
  });
  return (
    <Screen tab={2}>
      <div style={{ padding: '2px 14px 8px', borderBottom: `1px solid ${APP_LINE}`, background: '#fff' }}>
        <div style={{ ...title, fontSize: 16 }}>Harbour Lights</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#059669', fontWeight: 700, fontSize: 10.5 }}><Lock size={11} /> END-TO-END ENCRYPTED</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8, overflow: 'hidden' }}>
          {['Chat', 'Tasks', 'Files', 'Call sheet', 'Shot list'].map((t, i) => (
            <span key={t} style={{ padding: '3px 10px', borderRadius: 99, background: i === 0 ? INK : '#F1F5F9', color: i === 0 ? '#fff' : INK, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{t}</span>
          ))}
        </div>
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={bubble(false)}><b style={{ color: ORANGE_INK, fontSize: 10.5 }}>Daniel · Director</b><br />Call time moved to 6:30 AM. New call sheet is in Files.</div>
        <div style={{ ...bubble(false), padding: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 30, height: 30, borderRadius: 8, background: '#FFF1EE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Paperclip size={14} color={ORANGE} /></span>
            <span><b>Call sheet · Day 12</b><br /><span style={{ color: APP_MUTED, fontSize: 10.5 }}>PDF · Tomorrow 6:30 AM</span></span>
          </div>
        </div>
        <div style={bubble(true)}>Got it. Bringing the 35mm set.</div>
        <div style={bubble(false)}><b style={{ color: ORANGE_INK, fontSize: 10.5 }}>Sophie · Producer</b><br />Location permit approved for the harbour.</div>
        <div style={bubble(true)}>Perfect, see everyone at the unit bus.</div>
      </div>
      <div style={{ position: 'absolute', left: 10, right: 10, bottom: 8, display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: `1px solid ${APP_LINE}`, borderRadius: 99, padding: '7px 8px 7px 14px', color: APP_MUTED }}>
        <span style={{ flex: 1 }}>Message the crew</span>
        <span style={{ width: 28, height: 28, borderRadius: 14, background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Send size={13} color="#fff" /></span>
      </div>
    </Screen>
  );
};

/* 4. equipment marketplace */
export const GearScreen = () => (
  <Screen tab={-1}>
    <div style={{ padding: '4px 14px' }}>
      <div style={{ ...title, fontSize: 20, marginBottom: 8 }}>Rent gear</div>
      <div style={{ background: '#fff', border: `1px solid ${APP_LINE}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ height: 118, background: 'linear-gradient(135deg, #1b1b1f, #3b2a26)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Camera size={46} color="#FF8A78" strokeWidth={1.4} /></div>
        <div style={{ padding: 11 }}>
          <div style={{ ...title, fontSize: 15 }}>ARRI Alexa Mini LF</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: APP_MUTED, margin: '3px 0 7px' }}><BadgeCheck size={13} color="#059669" /> Verified vendor · Frameworks Rentals</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Star size={13} color="#F59E0B" fill="#F59E0B" /><b>4.8</b><span style={{ color: APP_MUTED }}>(126 reviews)</span></div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 9 }}>
            <span><b style={{ fontSize: 16 }}>$950</b> <span style={{ color: APP_MUTED }}>/ day</span></span>
            <span style={{ background: ORANGE, color: '#fff', padding: '6px 12px', borderRadius: 9, fontWeight: 700 }}>Request quote</span>
          </div>
          <span style={{ marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4, background: '#ECFDF5', color: '#047857', padding: '3px 9px', borderRadius: 99, fontWeight: 600, fontSize: 10.5 }}><Check size={11} /> Available 14 to 18 Nov</span>
        </div>
      </div>
      {[['Cooke S4 prime set', '$310 / day'], ['Aputure 600d light', '$120 / day']].map(([n, p]) => (
        <div key={n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff', border: `1px solid ${APP_LINE}`, borderRadius: 12, padding: '9px 11px', marginTop: 8 }}>
          <span style={{ ...title, fontSize: 13 }}>{n}</span><b>{p}</b>
        </div>
      ))}
    </div>
  </Screen>
);

/* 5. pitch and announcements */
export const PitchScreen = () => (
  <Screen tab={0}>
    <div style={{ padding: '4px 14px' }}>
      <div style={{ ...title, fontSize: 20, marginBottom: 8 }}>Announcements</div>
      <div style={{ background: '#fff', border: `1px solid ${APP_LINE}`, borderRadius: 14, padding: 12 }}>
        <span style={{ background: '#FFF1EE', color: ORANGE_INK, padding: '2px 9px', borderRadius: 99, fontWeight: 700, fontSize: 10.5 }}>HIRING</span>
        <div style={{ ...title, fontSize: 15, margin: '8px 0 4px', lineHeight: 1.25 }}>Casting call: lead roles for a feature film</div>
        <div style={{ color: APP_MUTED }}>Auditions on 25 Oct, 10 AM, Los Angeles.</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, color: APP_MUTED, fontSize: 11 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><BadgeCheck size={13} color={ORANGE} /> Lantern Pictures</span><span>1.2k views</span>
        </div>
      </div>
      <div style={{ ...title, fontSize: 14, margin: '14px 0 6px' }}>Your pitch</div>
      <div style={{ background: '#fff', border: `1px solid ${APP_LINE}`, borderRadius: 14, padding: 12 }}>
        <div style={{ ...title, fontSize: 14 }}>The Quiet Hour</div>
        <div style={{ color: APP_MUTED, margin: '2px 0 8px' }}>Treatment and deck attached. Sent to 3 producers.</div>
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{ background: '#ECFDF5', color: '#047857', padding: '3px 9px', borderRadius: 99, fontWeight: 600, fontSize: 10.5 }}>Sent</span>
          <span style={{ background: '#F1F5F9', color: APP_MUTED, padding: '3px 9px', borderRadius: 99, fontWeight: 600, fontSize: 10.5 }}>Showreel linked</span>
        </div>
      </div>
      <div style={{ marginTop: 10, background: INK, color: '#fff', borderRadius: 12, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span><b>Open call</b> · short film series</span><span style={{ color: '#FF8A78', fontWeight: 700 }}>30 Nov</span>
      </div>
    </div>
  </Screen>
);

/* 6. discussion rooms: modelled on the app's room card (emoji, title, category badge, Active / Private, members, Enter / Join) */
export const DiscussionScreen = () => (
  <Screen tab={1}>
    <div style={{ padding: '4px 14px' }}>
      <div style={{ ...title, fontSize: 20, marginBottom: 8 }}>Discussion Rooms</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: `1px solid ${APP_LINE}`, borderRadius: 10, padding: '8px 10px', color: APP_MUTED }}><Search size={14} /> Search rooms</div>
      <div style={{ display: 'flex', gap: 6, margin: '10px 0' }}>
        {['All', 'Cinematography', 'Editing'].map((c, i) => (
          <span key={c} style={{ padding: '4px 10px', borderRadius: 99, background: i === 0 ? INK : '#fff', color: i === 0 ? '#fff' : INK, border: `1px solid ${i === 0 ? INK : APP_LINE}`, fontSize: 11, fontWeight: 600 }}>{c}</span>
        ))}
      </div>
      {[
        { e: '🎥', t: 'Cinematography Lounge', cat: 'CINEMATOGRAPHY', d: 'Lenses, lighting and camera moves. Share frames and ask for notes.', m: '1,284 members', ago: '2m ago', priv: false, cta: 'Enter Room' },
        { e: '✂️', t: "Editors' Cut", cat: 'EDITING', d: 'Pacing, workflows and feedback on rough cuts.', m: '642 members', ago: '14m ago', priv: true, cta: 'Join Discussion Room' },
      ].map((r) => (
        <div key={r.t} style={{ background: '#fff', border: `1px solid ${APP_LINE}`, borderRadius: 14, padding: 11, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 22 }}>{r.e}</span>
            <div style={{ ...title, fontSize: 14, lineHeight: 1.2 }}>{r.t}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <span style={{ fontFamily: "'Inconsolata', monospace", fontSize: 9.5, fontWeight: 700, letterSpacing: '0.06em', color: APP_MUTED, border: `1px solid ${APP_LINE}`, borderRadius: 5, padding: '1px 6px' }}>{r.cat}</span>
            {r.priv && <span style={{ fontSize: 9.5, fontWeight: 700, color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 5, padding: '1px 6px' }}>Private</span>}
            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: '#059669' }}><span style={{ width: 6, height: 6, borderRadius: 3, background: '#10B981' }} />Active</span>
          </div>
          <div style={{ color: APP_MUTED, lineHeight: 1.4, marginBottom: 8 }}>{r.d}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: APP_MUTED, fontSize: 10.5, marginBottom: 8 }}><span>{r.m}</span><span>{r.ago}</span></div>
          <div style={{ background: 'rgba(255,75,51,0.10)', color: ORANGE_INK, textAlign: 'center', fontWeight: 700, borderRadius: 9, padding: '7px 0' }}>{r.cta}</div>
        </div>
      ))}
    </div>
  </Screen>
);
