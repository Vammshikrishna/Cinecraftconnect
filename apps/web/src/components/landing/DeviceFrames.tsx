import type { ReactNode } from 'react';
import { BarChart3, Bell, Building2, MessagesSquare, BadgeCheck, Briefcase, CheckSquare, ClipboardList, Camera, Clapperboard, DollarSign, FileText, Home, Lightbulb, Megaphone, MessageCircle, MessageSquare, PlusSquare, Search, ShoppingBag, Star, Users, Scale } from 'lucide-react';
import { INK, ORANGE, ORANGE_INK, SANS, SERIF } from './tokens';

/* A laptop and a tablet drawn in CSS, with screens modelled on the real web app (its side navigation, feed, and project space).
   Sizes follow real proportions: the laptop screen is the largest, the tablet in between, and the phone (DeviceMock) the smallest.
   Decorative (hidden from assistive technology). The people, titles and prices are examples. */
export const LAPTOP_W = 560;
export const LAPTOP_H = 372;
export const TABLET_W = 400;
export const TABLET_H = 290;

const LINE = '#E5E7EB';
const MUTED = '#64748B';
const BG = '#F8F9FA';
const serif = { fontFamily: SERIF, fontWeight: 600 } as const;

export const LaptopFrame = ({ children }: { children: ReactNode }) => (
  <div aria-hidden="true" style={{ width: LAPTOP_W, height: LAPTOP_H, position: 'relative' }}>
    <div style={{ position: 'absolute', left: 0, top: 0, width: LAPTOP_W, height: LAPTOP_H - 16, borderRadius: '14px 14px 4px 4px', padding: '9px 9px 11px', boxSizing: 'border-box', background: 'linear-gradient(145deg, #34343a, #0b0b0d 60%)', boxShadow: '0 60px 80px -40px rgba(20,17,15,0.55), inset 0 0 0 1.5px rgba(255,255,255,0.14)' }}>
      <div style={{ width: '100%', height: '100%', borderRadius: 6, overflow: 'hidden', background: BG, position: 'relative' }}>
        {children}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(115deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 34%)' }} />
      </div>
    </div>
    <div style={{ position: 'absolute', left: -24, right: -24, top: LAPTOP_H - 17, height: 17, borderRadius: '2px 2px 14px 14px', background: 'linear-gradient(180deg, #d9d9dd, #a9a9b0)', boxShadow: '0 22px 30px -14px rgba(20,17,15,0.5)' }}>
      <div style={{ margin: '0 auto', width: 100, height: 5, borderRadius: '0 0 8px 8px', background: '#8a8a92' }} />
    </div>
  </div>
);

export const TabletFrame = ({ children }: { children: ReactNode }) => (
  <div aria-hidden="true" style={{ width: TABLET_W, height: TABLET_H, borderRadius: 26, padding: 10, boxSizing: 'border-box', background: 'linear-gradient(145deg, #34343a, #0b0b0d 60%)', boxShadow: '0 50px 70px -34px rgba(20,17,15,0.55), 0 30px 44px -28px rgba(255,75,51,0.3), inset 0 0 0 1.5px rgba(255,255,255,0.14)' }}>
    <div style={{ width: '100%', height: '100%', borderRadius: 17, overflow: 'hidden', background: BG, position: 'relative' }}>
      {children}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(115deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 36%)' }} />
    </div>
  </div>
);

const Initial = ({ t, c, s = 20 }: { t: string; c: string; s?: number }) => (
  <span style={{ width: s, height: s, borderRadius: s / 2, background: c, color: '#fff', fontSize: s * 0.42, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{t}</span>
);

/** The web app's Home: the real side navigation, the feed (a job share and a poll), and people to connect with. */
export const DesktopScreen = () => (
  <div style={{ position: 'absolute', inset: 0, display: 'flex', fontFamily: SANS, fontSize: 9, color: INK }}>
    <div style={{ width: 112, background: '#fff', borderRight: `1px solid ${LINE}`, padding: '9px 6px', display: 'flex', flexDirection: 'column', gap: 1 }}>
      <div style={{ ...serif, fontSize: 10.5, margin: '0 0 7px 4px' }}>CineCraft <span style={{ color: ORANGE_INK }}>Connect</span></div>
      {[[Home, 'Home', true], [Search, 'Search', false], [MessageSquare, 'Messages', false], [Bell, 'Notifications', false], [PlusSquare, 'Create', false], [Clapperboard, 'ProjectSpace', false], [Briefcase, 'Jobs', false], [Lightbulb, 'Pitch', false], [ShoppingBag, 'Marketplace', false], [Users, 'Network', false], [MessagesSquare, 'Discussions', false], [Building2, 'Pages', false], [Star, 'Ratings', false], [Megaphone, 'Announcements', false]].map(([Ic, l, on]) => {
        const I = Ic as typeof Home;
        return <div key={l as string} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', borderRadius: 6, background: on ? '#FFF1EE' : 'transparent', color: on ? ORANGE_INK : INK, fontWeight: on ? 700 : 500 }}><I size={11} />{l as string}</div>;
      })}
    </div>
    <div style={{ flex: 1, padding: '8px 10px', minWidth: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 5, marginBottom: 7 }}>
        {['For You', 'Following'].map((t, i) => <span key={t} style={{ padding: '3px 10px', borderRadius: 99, fontWeight: 700, background: i === 0 ? INK : '#fff', color: i === 0 ? '#fff' : INK, border: `1px solid ${i === 0 ? INK : LINE}` }}>{t}</span>)}
        <span style={{ marginLeft: 'auto', padding: '3px 8px', borderRadius: 99, border: `1px solid ${LINE}`, background: '#fff', color: MUTED }}>All crafts</span>
      </div>
      <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 9, padding: 8, marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <Initial t="EC" c="#B8321F" s={22} />
          <div style={{ lineHeight: 1.2 }}><b style={{ fontSize: 9.5 }}>Emma Clarke</b> <BadgeCheck size={9} color={ORANGE} style={{ display: 'inline', verticalAlign: '-1px' }} /><div style={{ color: MUTED, fontSize: 8 }}>Cinematographer · 2h</div></div>
        </div>
        <div style={{ marginBottom: 5, lineHeight: 1.35 }}>Wrapped day 12 on Harbour Lights. We are looking for a colorist to join the grade.</div>
        <div style={{ border: `1px solid ${ORANGE}`, borderRadius: 7, padding: '5px 7px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div><div style={{ ...serif, fontSize: 10 }}>Colorist</div><div style={{ color: MUTED, fontSize: 8 }}>Lantern Pictures · Los Angeles · $420 / day</div></div>
          <span style={{ background: ORANGE, color: '#fff', borderRadius: 5, padding: '3px 9px', fontWeight: 700 }}>Apply</span>
        </div>
      </div>
      <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 9, padding: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Initial t="DB" c="#4b6a8a" s={20} />
          <div style={{ lineHeight: 1.2 }}><b style={{ fontSize: 9.5 }}>Daniel Brooks</b><div style={{ color: MUTED, fontSize: 8 }}>Director · 5h</div></div>
        </div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Which lens for the night exteriors?</div>
        {[['35mm anamorphic', 62], ['50mm prime', 38]].map(([l, p]) => (
          <div key={l as string} style={{ position: 'relative', border: `1px solid ${LINE}`, borderRadius: 5, padding: '3px 7px', marginBottom: 3, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, width: `${p}%`, background: '#FFF1EE' }} />
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between' }}><span>{l as string}</span><b>{p as number}%</b></div>
          </div>
        ))}
      </div>
    </div>
    <div style={{ width: 118, background: '#fff', borderLeft: `1px solid ${LINE}`, padding: '9px 8px' }}>
      <div style={{ ...serif, fontSize: 10.5, marginBottom: 6 }}>People you may know</div>
      {[['LM', '#5a7aff', 'Lucas Moreau', 'Editor'], ['HW', '#7a5ac8', 'Hannah Weiss', 'Producer'], ['TR', '#4b7a5a', 'Tom Reilly', 'Gaffer']].map(([i, c, n, r]) => (
        <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 0', borderBottom: `1px solid ${LINE}` }}>
          <Initial t={i} c={c} s={20} />
          <div style={{ minWidth: 0, flex: 1, lineHeight: 1.2 }}><div style={{ fontWeight: 700, fontSize: 8.5 }}>{n}</div><div style={{ color: MUTED, fontSize: 7.5 }}>{r}</div></div>
          <span style={{ color: ORANGE_INK, fontWeight: 700, fontSize: 8 }}>Connect</span>
        </div>
      ))}
      <div style={{ ...serif, fontSize: 10.5, margin: '9px 0 4px' }}>Announcement</div>
      <div style={{ background: '#FFF7F4', border: '1px solid rgba(255,75,51,0.3)', borderRadius: 7, padding: 6, lineHeight: 1.3 }}><b style={{ color: ORANGE_INK, fontSize: 7.5 }}>HIRING</b><div style={{ fontWeight: 600 }}>Casting call: lead roles, 25 Oct</div></div>
    </div>
  </div>
);

/** The web app's project space: its real sections on the left, the call sheet and the budget in the middle. */
export const TabletScreen = () => (
  <div style={{ position: 'absolute', inset: 0, display: 'flex', fontFamily: SANS, color: INK, fontSize: 8.5 }}>
    <div style={{ width: 104, background: '#fff', borderRight: `1px solid ${LINE}`, padding: '9px 6px' }}>
      <div style={{ ...serif, fontSize: 11, margin: '0 0 1px 4px' }}>Harbour Lights</div>
      <div style={{ color: '#059669', fontWeight: 700, fontSize: 7.5, margin: '0 0 7px 4px' }}>ENCRYPTED</div>
      {([['Collaboration', [[MessageCircle, 'Chat'], [CheckSquare, 'Tasks'], [FileText, 'Files']]], ['Production office', [[ClipboardList, 'Call Sheet', true], [Camera, 'Shot List'], [Scale, 'Legal Docs'], [DollarSign, 'Budget/Sched']]], ['Team', [[Users, 'Team']]]] as [string, [typeof Home, string, boolean?][]][]).map(([g, items]) => (
        <div key={g} style={{ marginBottom: 5 }}>
          <div style={{ color: MUTED, fontSize: 7, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 2px 4px' }}>{g}</div>
          {items.map(([I, l, on]) => <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3.5px 5px', borderRadius: 5, background: on ? '#FFF1EE' : 'transparent', color: on ? ORANGE_INK : INK, fontWeight: on ? 700 : 500 }}><I size={10} />{l}</div>)}
        </div>
      ))}
    </div>
    <div style={{ flex: 1, padding: '9px 11px', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <div style={{ ...serif, fontSize: 13 }}>Call sheet · Day 12</div>
        <span style={{ color: '#059669', fontWeight: 700, fontSize: 7.5 }}>PUBLISHED TO CREW</span>
      </div>
      <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 8, overflow: 'hidden', marginBottom: 7 }}>
        {[['06:30', 'Unit call · Harbour car park'], ['07:15', 'Sc 14 · EXT. Harbour · Emma, Daniel'], ['11:00', 'Sc 15 · INT. Boat · Sophie'], ['17:30', 'Wrap · crew bus departs']].map(([tm, d], i) => (
          <div key={tm} style={{ display: 'flex', gap: 8, padding: '5px 8px', borderTop: i ? `1px solid ${LINE}` : 'none' }}><b style={{ color: ORANGE_INK, width: 30 }}>{tm}</b><span>{d}</span></div>
        ))}
      </div>
      <div style={{ background: '#fff', border: `1px solid ${LINE}`, borderRadius: 8, padding: '6px 8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}><b>Budget</b><span style={{ color: MUTED }}>$182,400 of $240,000</span></div>
        <div style={{ height: 6, borderRadius: 3, background: '#F1F5F9', overflow: 'hidden' }}><div style={{ width: '76%', height: '100%', background: ORANGE }} /></div>
        <div style={{ display: 'flex', gap: 10, marginTop: 5, color: MUTED }}><span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><BarChart3 size={9} /> 3 vendors paid</span><span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><CheckSquare size={9} /> 6 of 9 tasks done</span></div>
      </div>
    </div>
  </div>
);
