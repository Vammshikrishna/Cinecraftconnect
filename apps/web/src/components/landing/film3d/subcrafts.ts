import type { CraftHow } from './craftFeatures';

/* The specific roles inside each of the 24 stations. The names are the roles a person can really pick on their profile (the profile role
   list), so "I'm a ..." on the landing page leads to something they can choose when they sign up. A station with one role shows no chips. */
export const STATION_ROLES: Record<string, string[]> = {
  'Screenwriter': ['Screenwriter', 'Writer'],
  'Producer': ['Producer', 'Executive Producer', 'Production Manager', 'Production Assistant (PA)'],
  'Director': ['Director'],
  'Casting Director': ['Casting Director'],
  'Location Manager': ['Location Manager'],
  'Storyboard Artist': ['Storyboard Artist', 'Concept Artist'],
  'Production Designer': ['Production Designer', 'Art Director', 'Set Decorator', 'Prop Master'],
  'Costume Designer': ['Costume Designer'],
  'Makeup Artist': ['Makeup Artist', 'Hair Stylist'],
  '1st AD': ['First Assistant Director (1st AD)'],
  'Cinematographer': ['Cinematographer'],
  '1st AC': ['First Assistant Camera (1st AC)'],
  'Gaffer': ['Gaffer'],
  'Grip': ['Grip', 'Key Grip'],
  'Sound Mixer': ['Production Sound Mixer', 'Boom Operator'],
  'Actor': ['Actor'],
  'Choreographer': ['Choreographer'],
  'Stunt Coordinator': ['Stunt Coordinator', 'Special Effects (SFX) Supervisor'],
  'Script Supervisor': ['Script Supervisor'],
  'Editor': ['Editor'],
  'Colorist': ['Colorist'],
  'VFX Artist': ['VFX Artist', 'VFX Supervisor'],
  'Sound Designer': ['Sound Designer', 'Sound Editor', 'Foley Artist'],
  'Composer': ['Composer'],
};

/** every role, with the station it belongs to, in story order (for the "I'm a ..." picker) */
export const ALL_ROLES: { role: string; station: string }[] = Object.entries(STATION_ROLES).flatMap(([station, roles]) => roles.map((role) => ({ role, station })));

export const stationOfRole = (role: string): string | undefined => ALL_ROLES.find((r) => r.role === role)?.station;

/** a role that has its own story; the others use their station's */
export const ROLE_HOW: Record<string, CraftHow> = {
  'Writer': { how: 'Share your writing on your profile, pitch treatments and stories to producers, and find a director to bring them to life.', features: ['pitch', 'profile', 'network'] },
  'Executive Producer': { how: 'Back the right projects: review pitches, follow production progress in the project space, and meet the producers you want to work with.', features: ['pitch', 'project', 'network'] },
  'Production Manager': { how: 'Run the budget, schedule and paperwork in the project space, and hire crew and vendors for the shoot.', features: ['project', 'jobs', 'vendors'] },
  'Production Assistant (PA)': { how: 'Get your first credits: apply to jobs of every size, and let confirmed credits and ratings build your name.', features: ['jobs', 'profile', 'ratings'] },
  'Concept Artist': { how: 'Show your concept work on your profile, get hired by designers and directors, and share art with the team in the project space.', features: ['profile', 'jobs', 'project'] },
  'Art Director': { how: 'Lead the art department: hire set and prop crew, find verified vendors for builds, and keep designs with the team.', features: ['jobs', 'vendors', 'project'] },
  'Set Decorator': { how: 'Source furniture and dressing from verified vendors, and keep set lists and photos with the department in the project space.', features: ['vendors', 'project', 'jobs'] },
  'Prop Master': { how: 'Find prop houses and rental vendors, track props in the project space, and get hired for your next film.', features: ['vendors', 'gear', 'jobs'] },
  'Hair Stylist': { how: 'Get booked through the job board, show your looks on your profile, and collect ratings after every project.', features: ['jobs', 'profile', 'ratings'] },
  'Key Grip': { how: 'Lead the grip team: build your crew from the network, rent rigging from verified vendors, and plan moves in the project space.', features: ['network', 'gear', 'project'] },
  'Boom Operator': { how: 'Get hired by sound teams, rent poles and mics, and keep the sound mixer and crew in one chat.', features: ['jobs', 'gear', 'project'] },
  'Special Effects (SFX) Supervisor': { how: 'Plan safe practical effects with the crew in the project space, and get found by productions that need them.', features: ['project', 'profile', 'jobs'] },
  'VFX Supervisor': { how: 'Lead VFX from set to final: hire artists, review shots with the director in the project space, and showcase your studio.', features: ['jobs', 'project', 'vendors'] },
  'Sound Editor': { how: 'Get hired for post-sound, receive files and notes in the project space, and keep confirmed credits on your profile.', features: ['jobs', 'project', 'profile'] },
  'Foley Artist': { how: 'Get booked for sound work, show your sound reel on your profile, and swap techniques in discussion rooms.', features: ['jobs', 'profile', 'rooms'] },
};
