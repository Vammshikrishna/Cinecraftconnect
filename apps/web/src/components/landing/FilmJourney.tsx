import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowRight, BadgeCheck, Briefcase, Camera, Lightbulb, Lock, Megaphone, MessagesSquare, ShieldCheck, Star, Users } from 'lucide-react';
import { CRAFTS, PHASES } from './film3d/crafts';
import { setFilmState, useFilmState } from './film3d/filmStore';
import { ROLE_HOW, STATION_ROLES } from './film3d/subcrafts';
import { CRAFT_HOW, FEATURE_DETAIL, FEATURE_LABEL, FeatureId } from './film3d/craftFeatures';
import DeviceMock from './DeviceMock';
import { DiscussionScreen, GearScreen, JobsScreen, PitchScreen, ProfileScreen, ProjectScreen } from './AppScreens';
import { CARD, INK, LINE, MONO, MUTED, ORANGE, ORANGE_INK, SANS, SERIF } from './tokens';

/* "How a film gets made": a tall section you scroll through normally. The 3D studio behind it (fixed, drawn by FilmWorld) follows your
   scroll and flies to one craft at a time; this sticky card says which craft, and which phase of making a film it belongs to.
   The card and the hidden list below carry the same words as real text, so the story does not depend on the 3D. */
const PER_CRAFT_VH = 34;

// an icon for each app feature a craft can lean on
const FEATURE_ICON: Record<FeatureId, typeof BadgeCheck> = {
  profile: BadgeCheck, network: Users, jobs: Briefcase, project: Lock, gear: Camera, vendors: ShieldCheck,
  pitch: Lightbulb, announce: Megaphone, rooms: MessagesSquare, ratings: Star,
};
// the app screen that shows a craft's main feature, drawn inside a phone beside the explanation
const FEATURE_SCREEN: Record<FeatureId, () => JSX.Element> = {
  profile: ProfileScreen, network: ProfileScreen, ratings: ProfileScreen, jobs: JobsScreen, project: ProjectScreen, rooms: DiscussionScreen,
  gear: GearScreen, vendors: GearScreen, pitch: PitchScreen, announce: PitchScreen,
};
// the last craft of each phase gets a small call to action (a chapter ends with a next step)
const PHASE_END = new Set(PHASES.map((p) => CRAFTS.map((c) => c.phase).lastIndexOf(p.id)));
export const JOURNEY_HEIGHT_VH = 100 + CRAFTS.length * PER_CRAFT_VH + 40;

/** From inside the long journey, "See how it works" goes straight to the section (smooth scrolling across many screens is slow and janky). */
const jumpToHowItWorks = (e: MouseEvent<HTMLAnchorElement>) => {
  const el = document.getElementById('how-it-works');
  if (!el) return;
  e.preventDefault();
  el.scrollIntoView({ behavior: 'auto', block: 'start' });
  history.replaceState(null, '', '#how-it-works');
};

/** Remembers the role a visitor picked, so sign-up can start with it selected. */
export const rememberRole = (role: string | null) => {
  try { if (role) sessionStorage.setItem('cc_landing_role', role); } catch { /* storage can be blocked */ }
};

/** Scrolls the page to the moment the camera is at station `i` (0..23) of the journey. */
export const scrollToStation = (i: number, role: string | null) => {
  const j = document.getElementById('film-journey');
  if (!j) return;
  const top = j.getBoundingClientRect().top + window.scrollY;
  const span = Math.max(j.offsetHeight - window.innerHeight, 1);
  const y = top + ((i + 1 - 0.6) / (25 - 0.6)) * span;
  setFilmState({ role });
  window.scrollTo({ top: y, behavior: 'auto' });
};

const FilmJourney = () => {
  const { active, stage, role: pickedRole } = useFilmState();
  const craft = active >= 0 ? CRAFTS[active] : null;
  const phaseIdx = craft ? PHASES.findIndex((p) => p.id === craft.phase) : stage === 'outro' ? PHASES.length - 1 : -1;
  const roles = craft ? STATION_ROLES[craft.name] ?? [] : [];
  // the role the visitor chose, if it belongs to this station; otherwise the station's own story
  const role = craft && pickedRole && roles.includes(pickedRole) ? pickedRole : null;
  const how0 = role && ROLE_HOW[role] ? ROLE_HOW[role] : craft ? CRAFT_HOW[craft.name] : null;
  // every craft has its own discussion room, so that feature is always listed (after the ones the role leans on most)
  const how = how0 ? { ...how0, features: how0.features.includes('rooms') ? how0.features : [...how0.features, 'rooms' as const] } : null;
  const myRole = role ?? (roles.length === 1 ? roles[0] : null);

  return (
    <section id="film-journey" aria-labelledby="film-title" style={{ position: 'relative', height: `${JOURNEY_HEIGHT_VH}vh` }}>
      <style>{`
        .film-sticky { position: sticky; top: 0; height: 100vh; display: flex; align-items: center; pointer-events: none; }
        .film-card { pointer-events: auto; }
        @keyframes film-swap-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .film-swap { animation: film-swap-in 300ms cubic-bezier(.22,1,.36,1); }
        @keyframes film-nudge { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(5px); } }
        .film-nudge { animation: film-nudge 1.6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .film-swap, .film-nudge { animation: none; } }
        @media (max-width: 1023px) { .film-phone { display: none !important; } }
        @media (max-width: 767px) {
          .film-roles { display: none !important; }
          .film-feats { display: flex !important; flex-wrap: wrap; gap: 6px !important; }
          .film-feats li { align-items: center !important; gap: 6px !important; padding: 4px 10px 4px 5px; border-radius: 99px; background: #FFF1EE; }
          .film-feats li > span:first-child { width: 22px !important; height: 22px !important; border-radius: 11px !important; background: transparent !important; }
          .film-feats li > span:first-child svg { width: 14px; height: 14px; }
          .film-feats li > span:last-child > span:first-child { font-size: 13px !important; }
          .film-how { font-size: 15px !important; line-height: 1.45 !important; margin-bottom: 10px !important; }
          .film-card { max-height: 54svh; overflow: hidden; } .film-sticky { align-items: flex-end; padding-bottom: 18px; } .film-name { font-size: 26px !important; margin-bottom: 0 !important; } .film-line, .film-desc, .film-phone { display: none !important; } .film-card { padding: 16px 18px 16px !important; } }
      `}</style>

      <h2 id="film-title" className="sr-only">How entertainment gets made, by 24 crafts</h2>
      <ol className="sr-only">
        {CRAFTS.map((c) => (<li key={c.name}>{c.phase}: the {c.name} {c.line}. On CineCraft Connect: {CRAFT_HOW[c.name]?.how} Features: {CRAFT_HOW[c.name]?.features.map((f) => FEATURE_LABEL[f]).join(', ')}.</li>))}
      </ol>

      <div className="film-sticky px-4 md:px-12">
        {/* always on screen during the journey: a way out for people who just want the app */}
        <a
          href="#how-it-works"
          onClick={jumpToHowItWorks}
          className="film-skip landing-btn landing-btn-ghost landing-focus"
          style={{ position: 'absolute', top: 84, right: 20, pointerEvents: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '0 16px', borderRadius: 99, background: 'rgba(251,250,248,0.92)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: `1px solid ${LINE}`, boxShadow: '0 14px 30px -20px rgba(20,17,15,0.5)', color: INK, fontFamily: SANS, fontSize: 14, fontWeight: 700, textDecoration: 'none' }}
        >
          Skip the film <ArrowDown size={15} aria-hidden="true" />
        </a>
        <div className="max-w-[1280px] mx-auto w-full">
          <div
            className="film-card"
            style={{ width: 'min(780px, 100%)', padding: '22px 24px 20px', borderRadius: 28, background: 'rgba(251,250,248,0.86)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', border: `1px solid ${LINE}`, boxShadow: '0 30px 60px -34px rgba(20,17,15,0.45)', fontFamily: SANS }}
          >
            {/* the four phases of making a film */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
              {PHASES.map((p, i) => (
                <div key={p.id}>
                  <div style={{ height: 4, borderRadius: 4, background: i <= phaseIdx ? ORANGE : LINE, transition: 'background-color 240ms' }} />
                  <div style={{ marginTop: 7, fontFamily: MONO, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: i === phaseIdx ? ORANGE_INK : MUTED }}>{p.id}</div>
                </div>
              ))}
            </div>

            <div key={craft ? craft.name : stage} className="film-swap">
              {craft && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', color: MUTED }}>
                    <span style={{ color: ORANGE_INK }}>{`${String(phaseIdx + 1).padStart(2, '0')} · ${craft.phase.toUpperCase()}`}</span>
                    <span>{String(active + 1).padStart(2, '0')} / 24</span>
                  </div>
                  <div className="film-name" style={{ fontWeight: 700, fontSize: 38, lineHeight: 1.05, letterSpacing: '-0.03em', color: INK, margin: '8px 0 6px' }}>{craft.name}</div>
                  <p className="film-line" style={{ fontSize: 18, lineHeight: 1.45, color: MUTED, margin: 0 }}>{craft.name === '1st AC' || craft.name === '1st AD' ? `The ${craft.name}` : `The ${craft.name.toLowerCase()}`} {craft.line}.</p>
                  {how && (() => {
                    const Screen = FEATURE_SCREEN[how0?.features.includes('rooms') ? 'rooms' : how.features[0]];
                    return (
                      <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${LINE}`, display: 'flex', gap: 22, alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {roles.length > 1 && (
                            <div role="group" className="film-roles" aria-label={`Roles in ${craft.name}`} style={{ marginBottom: 12 }}>
                              <div style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: MUTED, marginBottom: 6 }}>Pick your role</div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {roles.map((r) => (
                                  <button key={r} type="button" aria-pressed={role === r} onClick={() => setFilmState({ role: role === r ? null : r })} className="landing-focus" style={{ minHeight: 36, padding: '0 13px', borderRadius: 99, fontFamily: SANS, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', background: role === r ? INK : 'transparent', color: role === r ? '#fff' : INK, border: `1px solid ${role === r ? INK : LINE}` }}>{r}</button>
                                ))}
                              </div>
                            </div>
                          )}
                          <div style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: ORANGE_INK, marginBottom: 6 }}>{role ? `As a ${role}` : 'On CineCraft Connect'}</div>
                          <p className="film-how [text-wrap:pretty]" style={{ fontSize: 17, lineHeight: 1.5, color: INK, margin: '0 0 14px', fontWeight: 500 }}>{how.how}</p>
                          <ul className="film-feats" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 9 }}>
                            {how.features.map((f) => {
                              const Icon = FEATURE_ICON[f];
                              return (
                                <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                                  <span style={{ width: 32, height: 32, borderRadius: 10, background: '#FFF1EE', color: ORANGE_INK, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={16} aria-hidden="true" /></span>
                                  <span style={{ minWidth: 0 }}>
                                    <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: INK, lineHeight: 1.25 }}>{FEATURE_LABEL[f]}</span>
                                    <span className="film-desc" style={{ display: 'block', fontSize: 14, color: MUTED, lineHeight: 1.4 }}>{FEATURE_DETAIL[f]}</span>
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                          {myRole && (
                            <Link to="/register" onClick={() => rememberRole(myRole)} className="landing-btn landing-btn-orange landing-focus" style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '0 16px', borderRadius: 12, background: ORANGE, color: INK, fontFamily: SANS, fontSize: 14.5, fontWeight: 700, textDecoration: 'none' }}>
                              Create your profile as {/^[AEIOU]/.test(myRole) ? 'an' : 'a'} {myRole} <ArrowRight size={15} aria-hidden="true" />
                            </Link>
                          )}
                          {PHASE_END.has(active) && (
                            <a href="#how-it-works" onClick={jumpToHowItWorks} className="landing-focus" style={{ marginTop: 14, marginLeft: myRole ? 16 : 0, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: INK, textDecoration: 'underline', textUnderlineOffset: 4, textDecorationColor: LINE }}>
                              See how it works <ArrowDown size={14} aria-hidden="true" />
                            </a>
                          )}
                        </div>
                        {/* the app screen for this craft's main feature */}
                        <div className="film-phone" style={{ width: 172, height: 360, flexShrink: 0, position: 'relative' }}>
                          <div style={{ position: 'absolute', left: 0, top: 0, width: 288, height: 600, transform: 'scale(0.6)', transformOrigin: 'top left' }}>
                            <DeviceMock><Screen /></DeviceMock>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
              {!craft && stage === 'intro' && (
                <>
                  <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: ORANGE_INK }}>How content gets made</div>
                  <div className="film-name" style={{ fontWeight: 700, fontSize: 38, lineHeight: 1.05, letterSpacing: '-0.03em', color: INK, margin: '8px 0 6px' }}>
                    Meet the <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, color: ORANGE_INK }}>24 crafts.</span>
                  </div>
                  <p style={{ fontSize: 18, lineHeight: 1.45, color: MUTED, margin: '0 0 12px' }}>A film, a series, a YouTube video, an ad or a podcast: they are all made by the same crafts, in the same order. Keep scrolling to watch it happen.</p>
                  <div className="film-nudge" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: INK }}><ArrowDown size={16} aria-hidden="true" /> Scroll</div>
                </>
              )}
              {!craft && stage === 'outro' && (
                <>
                  <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: ORANGE_INK }}>Now showing</div>
                  <div className="film-name" style={{ fontWeight: 700, fontSize: 38, lineHeight: 1.05, letterSpacing: '-0.03em', color: INK, margin: '8px 0 6px' }}>
                    All 24, in <span style={{ fontFamily: SERIF, fontStyle: 'italic', fontWeight: 500, color: ORANGE_INK }}>one network.</span>
                  </div>
                  <p style={{ fontSize: 18, lineHeight: 1.45, color: MUTED, margin: '0 0 14px' }}>Every one of these crafts is on CineCraft Connect. Here is how it works.</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    <a href="#how-it-works" onClick={jumpToHowItWorks} className="landing-btn landing-btn-ink landing-focus" style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, padding: '12px 20px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', background: INK, color: '#fff', minHeight: 46 }}>
                      See how it works <ArrowDown size={16} aria-hidden="true" />
                    </a>
                    <Link to="/register" className="landing-btn landing-btn-ghost landing-focus" style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, padding: '12px 18px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', background: CARD, color: INK, border: `1px solid ${LINE}`, minHeight: 46 }}>
                      Join <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FilmJourney;
