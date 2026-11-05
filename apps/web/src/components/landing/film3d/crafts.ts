/* The 24 crafts of making a film, in the order the work happens. Each one is a 3D person in the landing page background. */
export type PhaseId = 'Develop' | 'Prepare' | 'Shoot' | 'Finish';

export const PHASES: { id: PhaseId; line: string }[] = [
  { id: 'Develop', line: 'An idea becomes a story, a plan and a team.' },
  { id: 'Prepare', line: 'Everything is designed, dressed and scheduled before a camera rolls.' },
  { id: 'Shoot', line: 'On set, every department works as one.' },
  { id: 'Finish', line: 'The footage becomes the film.' },
];

export type PropId =
  | 'laptop' | 'briefcase' | 'megaphone' | 'clipboard' | 'mapPin' | 'easel' | 'setModel' | 'mannequin' | 'palette' | 'walkie'
  | 'camera' | 'lens' | 'light' | 'dolly' | 'boom' | 'mask' | 'dancer' | 'stunt' | 'continuity' | 'editing' | 'colorWheel'
  | 'hologram' | 'speakers' | 'piano'
  | 'tablet' | 'pad' | 'swatch' | 'lamp' | 'crate' | 'hair' | 'pole' | 'boomS' | 'phones' | 'flame' | 'wire' | 'foley' | 'coffee';

export type V3 = [number, number, number];

export interface CraftSpec {
  name: string;
  phase: PhaseId;
  line: string;
  prop: PropId;
  body: 'm' | 'f';
  skin: number;
  hair: number;
  hairStyle: 'short' | 'long' | 'cap' | 'bun' | 'none' | 'wavy';
  beard?: 'stubble' | 'full';
  shirt: number;
  pants: number;
  /** a jacket or vest over the shirt */
  jacket?: number;
  /** short sleeves */
  short?: boolean;
  /** where each hand should be (character space, +z toward the viewer). Missing = relaxed at the side. */
  handL?: V3;
  handR?: V3;
  stance?: 'stand' | 'wide' | 'kick' | 'jump';
  /** forward lean of the upper body, radians */
  lean?: number;
  /** wears a crew badge on a lanyard (default true) */
  badge?: boolean;
}

const SKIN = [0xf1c9a5, 0xe0a47a, 0xc68863, 0x9b6a47, 0x6f4a31, 0xffd9bd];

export const CRAFTS: CraftSpec[] = [
  { name: 'Screenwriter', phase: 'Develop', line: 'writes the story and the dialogue', prop: 'laptop', body: 'm', skin: SKIN[0], hair: 0x3a2a20, hairStyle: 'wavy', shirt: 0xff6a4f, pants: 0x2f3a4a, handL: [-0.17, 1.06, 0.4], handR: [0.17, 1.06, 0.4], lean: 0.08 },
  { name: 'Producer', phase: 'Develop', line: 'funds the film and keeps it on track', prop: 'briefcase', body: 'm', skin: SKIN[2], hair: 0x1d1a18, hairStyle: 'short', beard: 'stubble', shirt: 0xe8e2d9, pants: 0x2a2f3a, jacket: 0x2f3a4a, handL: [-0.22, 1.6, 0.08], handR: [0.4, 0.6, 0.14] },
  { name: 'Director', phase: 'Develop', line: 'leads the creative vision', prop: 'megaphone', body: 'm', skin: SKIN[1], hair: 0x2a211b, hairStyle: 'cap', beard: 'stubble', shirt: 0xe8e2d9, pants: 0x3a3631, handL: [-0.4, 1.34, 0.55], handR: [0.14, 1.44, 0.34] },
  { name: 'Casting Director', phase: 'Develop', line: 'finds the right actors', prop: 'clipboard', body: 'f', skin: SKIN[5], hair: 0x8a4b2a, hairStyle: 'long', shirt: 0xb8486b, pants: 0x2a2630, handL: [-0.28, 1.04, 0.42], handR: [-0.02, 1.2, 0.46] },
  { name: 'Location Manager', phase: 'Develop', line: 'finds and secures the places to shoot', prop: 'mapPin', body: 'm', skin: SKIN[3], hair: 0x1d1a18, hairStyle: 'short', shirt: 0x4b7a5a, pants: 0x4a4036, jacket: 0x5a5148, handL: [-0.3, 1.0, 0.06], handR: [0.2, 1.06, 0.6] },

  { name: 'Storyboard Artist', phase: 'Prepare', line: 'draws every shot before it is filmed', prop: 'easel', body: 'f', skin: SKIN[0], hair: 0x5b3a22, hairStyle: 'bun', shirt: 0x7a5ac8, pants: 0x2a2630, handR: [0.46, 1.12, 0.46] },
  { name: 'Production Designer', phase: 'Prepare', line: 'builds the look of the world', prop: 'setModel', body: 'm', skin: SKIN[1], hair: 0x2a211b, hairStyle: 'short', beard: 'full', shirt: 0xd89a3a, pants: 0x3a3631, handL: [-0.2, 0.8, 0.58], handR: [0.1, 0.86, 0.6], lean: 0.12 },
  { name: 'Costume Designer', phase: 'Prepare', line: 'dresses every character', prop: 'mannequin', body: 'f', skin: SKIN[4], hair: 0x1d1a18, hairStyle: 'wavy', shirt: 0xff7f6b, pants: 0x2f3a4a, handL: [-0.62, 1.1, 0.3], handR: [0.28, 1.0, 0.1] },
  { name: 'Makeup Artist', phase: 'Prepare', line: 'creates every face on screen', prop: 'palette', body: 'f', skin: SKIN[5], hair: 0xc8a070, hairStyle: 'bun', shirt: 0xf3b6c4, pants: 0x2a2630, handL: [-0.3, 1.12, 0.38], handR: [0.32, 1.24, 0.42] },
  { name: '1st AD', phase: 'Prepare', line: 'runs the set and the schedule', prop: 'walkie', body: 'm', skin: SKIN[2], hair: 0x1d1a18, hairStyle: 'cap', shirt: 0x2f3a4a, pants: 0x1d1a18, jacket: 0x3a3631, handL: [-0.28, 1.08, 0.42], handR: [0.16, 1.54, 0.28] },

  { name: 'Cinematographer', phase: 'Shoot', line: 'frames and lights every shot', prop: 'camera', body: 'm', skin: SKIN[0], hair: 0x3a2a20, hairStyle: 'cap', beard: 'stubble', shirt: 0x3a3631, pants: 0x2a2630, jacket: 0x5a5148, handL: [0.24, 1.5, 0.5], handR: [0.3, 1.42, 0.22], lean: 0.05 },
  { name: '1st AC', phase: 'Shoot', line: 'keeps every shot in focus', prop: 'lens', body: 'm', skin: SKIN[3], hair: 0x1d1a18, hairStyle: 'short', shirt: 0x5a5148, pants: 0x2a2630, short: true, handL: [-0.12, 1.1, 0.44], handR: [0.12, 1.1, 0.44], lean: 0.1 },
  { name: 'Gaffer', phase: 'Shoot', line: 'lights the scene', prop: 'light', body: 'm', skin: SKIN[1], hair: 0x8a8278, hairStyle: 'cap', beard: 'full', shirt: 0xd89a3a, pants: 0x3a3631, jacket: 0x3a3631, handL: [-0.32, 0.96, 0.12], handR: [0.86, 1.5, 0.14] },
  { name: 'Grip', phase: 'Shoot', line: 'rigs and moves the camera and lights', prop: 'dolly', body: 'm', skin: SKIN[2], hair: 0x2a211b, hairStyle: 'short', beard: 'stubble', shirt: 0x4b6a8a, pants: 0x2f3a4a, short: true, stance: 'wide', handL: [-0.16, 0.94, 0.4], handR: [0.16, 0.94, 0.4], lean: 0.1 },
  { name: 'Sound Mixer', phase: 'Shoot', line: 'records the dialogue on set', prop: 'boom', body: 'f', skin: SKIN[4], hair: 0x1d1a18, hairStyle: 'wavy', shirt: 0x2f5a4a, pants: 0x2a2630, handL: [-0.02, 1.92, 0.28], handR: [0.06, 1.92, 0.62] },
  { name: 'Actor', phase: 'Shoot', line: 'brings the character to life', prop: 'mask', body: 'f', skin: SKIN[5], hair: 0x5b3a22, hairStyle: 'long', shirt: 0xb8486b, pants: 0x1d1a18, badge: false, handL: [-0.68, 1.62, 0.3], handR: [0.62, 1.3, 0.34] },
  { name: 'Choreographer', phase: 'Shoot', line: 'designs the movement and dance', prop: 'dancer', body: 'f', skin: SKIN[3], hair: 0x1d1a18, hairStyle: 'bun', shirt: 0x7a5ac8, pants: 0x1d1a18, short: true, badge: false, stance: 'kick', handL: [-0.62, 1.82, 0.05], handR: [0.62, 1.78, 0.1] },
  { name: 'Stunt Coordinator', phase: 'Shoot', line: 'plans and performs the action safely', prop: 'stunt', body: 'm', skin: SKIN[1], hair: 0x2a211b, hairStyle: 'none', shirt: 0xff4b33, pants: 0x2a2630, short: true, badge: false, stance: 'jump', handL: [-0.7, 1.3, 0.22], handR: [0.7, 1.3, 0.22] },
  { name: 'Script Supervisor', phase: 'Shoot', line: 'keeps continuity between every shot', prop: 'continuity', body: 'f', skin: SKIN[0], hair: 0x8a4b2a, hairStyle: 'long', shirt: 0x4b7a5a, pants: 0x2a2630, handL: [-0.28, 1.06, 0.42], handR: [0.2, 1.14, 0.4] },

  { name: 'Editor', phase: 'Finish', line: 'cuts the footage into a story', prop: 'editing', body: 'm', skin: SKIN[2], hair: 0x1d1a18, hairStyle: 'short', shirt: 0x3a3631, pants: 0x2f3a4a, handL: [-0.14, 0.8, 0.62], handR: [0.14, 0.8, 0.62], lean: 0.12 },
  { name: 'Colorist', phase: 'Finish', line: 'sets the colour and mood of the picture', prop: 'colorWheel', body: 'f', skin: SKIN[5], hair: 0xc8a070, hairStyle: 'long', shirt: 0xd89a3a, pants: 0x2a2630, handL: [-0.2, 0.92, 0.6], handR: [0.3, 1.38, 0.48] },
  { name: 'VFX Artist', phase: 'Finish', line: 'adds what a camera cannot capture', prop: 'hologram', body: 'm', skin: SKIN[3], hair: 0x1d1a18, hairStyle: 'wavy', shirt: 0x2f3a6a, pants: 0x1d1a18, handL: [-0.3, 1.0, 0.06], handR: [0.62, 1.5, 0.4] },
  { name: 'Sound Designer', phase: 'Finish', line: 'builds the world you hear', prop: 'speakers', body: 'f', skin: SKIN[4], hair: 0x2a211b, hairStyle: 'short', shirt: 0xff7f6b, pants: 0x2a2630, handL: [-0.2, 0.98, 0.5], handR: [0.2, 0.98, 0.5] },
  { name: 'Composer', phase: 'Finish', line: 'writes the music', prop: 'piano', body: 'm', skin: SKIN[0], hair: 0x6a6258, hairStyle: 'wavy', shirt: 0xe8e2d9, pants: 0x1d1a18, jacket: 0x3a3631, handL: [-0.2, 0.96, 0.5], handR: [0.2, 0.96, 0.5], lean: 0.08 },
];

/** The sub-craft people: roles inside a station, who stand beside its main craft on the same pedestal. */
export interface ExtraSpec extends CraftSpec { station: string }
const X = (station: string, name: string, prop: PropId, rest: Omit<CraftSpec, 'name' | 'phase' | 'line' | 'prop'>): ExtraSpec => ({ station, name, phase: 'Develop', line: '', prop, ...rest });
const R: V3 = [0.2, 1.05, 0.42];
const L: V3 = [-0.2, 1.05, 0.42];

export const EXTRAS: ExtraSpec[] = [
  X('Screenwriter', 'Writer', 'pad', { body: 'f', skin: SKIN[3], hair: 0x1d1a18, hairStyle: 'wavy', shirt: 0x7a5ac8, pants: 0x2a2630, handL: L, handR: R }),
  X('Producer', 'Executive Producer', 'tablet', { body: 'm', skin: SKIN[1], hair: 0x8a8278, hairStyle: 'short', beard: 'full', shirt: 0xe8e2d9, pants: 0x1d1a18, jacket: 0x1d1a18, handL: [-0.16, 1.02, 0.4], handR: [0.16, 1.02, 0.4] }),
  X('Producer', 'Production Manager', 'tablet', { body: 'f', skin: SKIN[0], hair: 0x5b3a22, hairStyle: 'bun', shirt: 0x4b7a5a, pants: 0x2f3a4a, handL: [-0.16, 1.02, 0.4], handR: [0.16, 1.02, 0.4] }),
  X('Producer', 'Production Assistant (PA)', 'coffee', { body: 'm', skin: SKIN[4], hair: 0x1d1a18, hairStyle: 'short', shirt: 0xff6a4f, pants: 0x3a3631, short: true, handL: [-0.24, 1.1, 0.4], handR: [0.22, 1.08, 0.4] }),
  X('Storyboard Artist', 'Concept Artist', 'pad', { body: 'm', skin: SKIN[2], hair: 0x2a211b, hairStyle: 'wavy', shirt: 0x2f5a4a, pants: 0x2a2630, handL: L, handR: R }),
  X('Production Designer', 'Art Director', 'swatch', { body: 'f', skin: SKIN[5], hair: 0xc8a070, hairStyle: 'long', shirt: 0xd89a3a, pants: 0x2a2630, handR: [0.2, 1.0, 0.42] }),
  X('Production Designer', 'Set Decorator', 'lamp', { body: 'f', skin: SKIN[4], hair: 0x1d1a18, hairStyle: 'bun', shirt: 0xb8486b, pants: 0x2f3a4a, handR: [0.2, 1.06, 0.42] }),
  X('Production Designer', 'Prop Master', 'crate', { body: 'm', skin: SKIN[1], hair: 0x6a6258, hairStyle: 'cap', beard: 'stubble', shirt: 0x4b6a8a, pants: 0x3a3631, jacket: 0x5a5148, handL: [-0.18, 0.96, 0.46], handR: [0.18, 0.96, 0.46] }),
  X('Makeup Artist', 'Hair Stylist', 'hair', { body: 'f', skin: SKIN[2], hair: 0x1d1a18, hairStyle: 'long', shirt: 0xf3b6c4, pants: 0x2a2630, handR: [0.3, 1.42, 0.34], handL: [-0.26, 1.06, 0.44] }),
  X('Grip', 'Key Grip', 'pole', { body: 'm', skin: SKIN[3], hair: 0x2a211b, hairStyle: 'cap', beard: 'full', shirt: 0x4b6a8a, pants: 0x2f3a4a, jacket: 0x3a3631, handR: [0.5, 1.3, 0.3] }),
  X('Sound Mixer', 'Boom Operator', 'boomS', { body: 'm', skin: SKIN[0], hair: 0x3a2a20, hairStyle: 'short', shirt: 0x2f5a4a, pants: 0x2a2630, handL: [-0.02, 1.9, 0.3], handR: [0.04, 1.9, 0.62] }),
  X('Stunt Coordinator', 'Special Effects (SFX) Supervisor', 'flame', { body: 'm', skin: SKIN[2], hair: 0x1d1a18, hairStyle: 'none', shirt: 0x3a3631, pants: 0x2a2630, jacket: 0xd89a3a, handR: [0.58, 1.3, 0.36] }),
  X('VFX Artist', 'VFX Supervisor', 'wire', { body: 'f', skin: SKIN[5], hair: 0x1d1a18, hairStyle: 'short', shirt: 0x2f3a6a, pants: 0x1d1a18, handR: [0.5, 1.5, 0.36], handL: [-0.2, 1.05, 0.44] }),
  X('Sound Designer', 'Sound Editor', 'phones', { body: 'm', skin: SKIN[4], hair: 0x1d1a18, hairStyle: 'short', shirt: 0xff7f6b, pants: 0x2a2630, handL: [-0.16, 0.98, 0.46], handR: [0.16, 0.98, 0.46] }),
  X('Sound Designer', 'Foley Artist', 'foley', { body: 'f', skin: SKIN[1], hair: 0x8a4b2a, hairStyle: 'wavy', shirt: 0x4b7a5a, pants: 0x2f3a4a, handL: [-0.16, 1.05, 0.42], handR: [0.16, 1.05, 0.42] }),
];
