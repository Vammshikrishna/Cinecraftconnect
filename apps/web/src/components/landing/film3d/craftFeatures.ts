/* How each of the 24 crafts uses CineCraft Connect: one sentence and the app features it leans on. Only things the app really has
   (profile with confirmed credits, crew network, job board with alerts, project spaces, gear rental and verified vendors, pitching,
   announcements, discussion rooms, ratings). Shown in the "How a film gets made" panel as the camera passes each craft. */
export type FeatureId = 'profile' | 'network' | 'jobs' | 'project' | 'gear' | 'vendors' | 'pitch' | 'announce' | 'rooms' | 'ratings';

export const FEATURE_LABEL: Record<FeatureId, string> = {
  profile: 'Profile & credits',
  network: 'Crew network',
  jobs: 'Job board',
  project: 'Project space',
  gear: 'Gear rental',
  vendors: 'Verified vendors',
  pitch: 'Pitching',
  announce: 'Announcements',
  rooms: 'Discussion rooms',
  ratings: 'Ratings',
};

/** what each feature does, in a line, shown under its name in the journey panel */
export const FEATURE_DETAIL: Record<FeatureId, string> = {
  profile: 'A profile of credits confirmed by the people you worked with.',
  network: 'Find and connect with crew by craft.',
  jobs: 'Roles with deadlines, screening questions and alerts.',
  project: 'Encrypted chat, tasks, files, call sheets and shot lists.',
  gear: 'Rent cameras, lenses and lighting from verified vendors.',
  vendors: 'Trusted partners, with ratings and reviews.',
  pitch: 'Send pitches and showreels to producers and studios.',
  announce: 'Casting calls and news, sent to your followers.',
  rooms: 'Craft communities to swap ideas and techniques.',
  ratings: 'Transparent ratings after every project.',
};

export interface CraftHow { how: string; features: FeatureId[] }

export const CRAFT_HOW: Record<string, CraftHow> = {
  'Screenwriter': { how: 'Pitch your script straight to producers and studios, then share drafts and take notes in a private project space.', features: ['pitch', 'project', 'profile'] },
  'Producer': { how: 'Post roles, review every applicant, then run the budget, tasks and legal documents of the whole production in one project space.', features: ['jobs', 'project', 'vendors'] },
  'Director': { how: 'Build your team from the crew network, then run the shoot with encrypted chat, tasks, call sheets and shot lists.', features: ['network', 'project', 'pitch'] },
  'Casting Director': { how: 'Post a casting call with a deadline and screening questions, announce it to your followers and shortlist the applicants.', features: ['jobs', 'announce', 'network'] },
  'Location Manager': { how: 'Get hired by productions, and keep permits, maps and location notes with the crew in the project space.', features: ['jobs', 'project', 'profile'] },
  'Storyboard Artist': { how: 'Show your boards on your profile, get hired by directors, and share frames with the whole crew in the project space.', features: ['profile', 'jobs', 'project'] },
  'Production Designer': { how: 'Find verified vendors for builds and props, and keep designs and budgets with the team in one place.', features: ['vendors', 'project', 'profile'] },
  'Costume Designer': { how: 'Source from verified vendors, share looks with the crew, and let your confirmed credits do the talking.', features: ['vendors', 'project', 'profile'] },
  'Makeup Artist': { how: 'Get booked through the job board, and build trust with confirmed credits and ratings after every project.', features: ['jobs', 'profile', 'ratings'] },
  '1st AD': { how: 'Run the day from the project space: call sheet, tasks and crew chat, and hire the extra hands you need.', features: ['project', 'jobs', 'network'] },
  'Cinematographer': { how: 'Rent cameras and lenses from verified vendors, plan the day with the shot list, and show your reel on your profile.', features: ['gear', 'project', 'profile'] },
  '1st AC': { how: 'Find rental houses for lenses and accessories, and get hired by camera teams across every format.', features: ['gear', 'jobs', 'profile'] },
  'Gaffer': { how: 'Rent lights and rigging from verified vendors, and join crews through the job board and alerts.', features: ['gear', 'vendors', 'jobs'] },
  'Grip': { how: 'Rent dollies, tracks and stands, and get found by crews who need an experienced grip.', features: ['gear', 'jobs', 'network'] },
  'Sound Mixer': { how: 'Rent recorders and microphones, get hired for shoots, and share sound notes with the crew in the project space.', features: ['gear', 'jobs', 'project'] },
  'Actor': { how: 'Apply to casting calls, keep your credits and showreel on your profile, and message casting teams directly.', features: ['jobs', 'profile', 'network'] },
  'Choreographer': { how: 'Show your work on your profile, get hired for film, ads and music videos, and meet other dancers in discussion rooms.', features: ['profile', 'jobs', 'rooms'] },
  'Stunt Coordinator': { how: 'Build a track record with confirmed credits and ratings, and get found by productions that need safe action.', features: ['profile', 'ratings', 'jobs'] },
  'Script Supervisor': { how: 'Keep continuity notes and the shot list in the project space, where the whole crew can see them.', features: ['project', 'jobs', 'profile'] },
  'Editor': { how: 'Get hired for post, receive files and feedback in the project space, and show your cuts on your profile.', features: ['jobs', 'project', 'profile'] },
  'Colorist': { how: 'Get hired for grading, keep your credits confirmed on your profile, and collect ratings after each project.', features: ['jobs', 'profile', 'ratings'] },
  'VFX Artist': { how: 'Studios and VFX houses list jobs and portfolios on company pages, so you can find work or hire a team.', features: ['jobs', 'vendors', 'profile'] },
  'Sound Designer': { how: 'Get hired for sound, swap techniques with other sound people in discussion rooms, and show your credits.', features: ['jobs', 'rooms', 'profile'] },
  'Composer': { how: 'Pitch your music to producers and directors, share news in announcements, and find your next collaborator.', features: ['pitch', 'announce', 'network'] },
};
