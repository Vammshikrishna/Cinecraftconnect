/**
 * Help Center: the one place both apps get their articles, topics and search from, so web and mobile give the same
 * answers. Articles are plain data (no layout) so each app can render them in its own style.
 */

export interface HelpCategory {
  id: string;
  title: string;
  description: string;
  /** a generic icon name each app maps to its own icon set */
  icon: 'rocket' | 'user' | 'shield' | 'users' | 'film' | 'briefcase' | 'store' | 'star' | 'phone' | 'wrench';
}

export interface HelpArticle {
  id: string;
  category: string;
  title: string;
  summary: string;
  /** numbered steps, shown first when present */
  steps?: string[];
  /** paragraphs */
  body: string[];
  keywords: string[];
  popular?: boolean;
  related?: string[];
}

export const HELP_CATEGORIES: HelpCategory[] = [
  { id: 'getting-started', title: 'Getting started', description: 'Set up your profile and find your way around', icon: 'rocket' },
  { id: 'account', title: 'Account and login', description: 'Verification, password, deleting your account', icon: 'user' },
  { id: 'privacy-safety', title: 'Privacy and safety', description: 'Who sees what, blocking and reporting', icon: 'shield' },
  { id: 'network', title: 'Network and messages', description: 'Connections, introductions, messages', icon: 'users' },
  { id: 'projects', title: 'Projects and crew', description: 'Project spaces, credits, availability', icon: 'film' },
  { id: 'jobs', title: 'Jobs and hiring', description: 'Apply, post jobs, manage applicants', icon: 'briefcase' },
  { id: 'marketplace', title: 'Marketplace and vendors', description: 'Rent gear, book locations, vendor services', icon: 'store' },
  { id: 'ratings', title: 'Ratings and reviews', description: 'Rate titles, write reviews, submit your work', icon: 'star' },
  { id: 'calls', title: 'Calls and notifications', description: 'Calls, alerts, quiet hours', icon: 'phone' },
  { id: 'troubleshooting', title: 'Troubleshooting', description: 'When something does not work', icon: 'wrench' },
];

export const HELP_ARTICLES: HelpArticle[] = [
  // ── Getting started ──
  {
    id: 'complete-your-profile', category: 'getting-started', popular: true,
    title: 'Complete your profile', summary: 'A complete profile gets noticed more by producers and crew.',
    steps: ['Open your profile and tap Edit.', 'Add a photo, your craft, location and a short bio.', 'Add skills, experience and a portfolio piece.', 'Pin a showreel and list your gear and languages under Highlights.', 'Follow the completeness card on your profile for the next best step.'],
    body: ['Your name, photo, craft and bio are always visible. Skills, work and credits follow your profile visibility setting.'],
    keywords: ['profile', 'bio', 'photo', 'showreel', 'portfolio', 'complete'], related: ['profile-visibility', 'availability-status'],
  },
  {
    id: 'find-people-and-work', category: 'getting-started',
    title: 'Find people, jobs and projects', summary: 'The main places to look.',
    body: ['Network helps you find people, with filters for craft, skill, gear, language and city. Jobs lists hiring posts, Marketplace has gear, locations and vendor services, and Project Space is where teams work together.'],
    keywords: ['discover', 'search', 'network', 'jobs', 'projects'], related: ['send-connection-request'],
  },
  // ── Account ──
  {
    id: 'verify-your-account', category: 'account', popular: true,
    title: 'Get a verified badge', summary: 'Verification shows people you are who you say you are.',
    steps: ['Open Settings, then Accounts Center.', 'Choose Verification and submit your request with the details asked for.', 'We review it and notify you of the result.'],
    body: ['Verified badges are for real people and organisations. Requests with missing or unclear details are sent back for more information.'],
    keywords: ['verification', 'verified', 'badge', 'checkmark', 'blue tick'], related: ['complete-your-profile'],
  },
  {
    id: 'change-password', category: 'account',
    title: 'Change your password', summary: 'Keep your account secure.',
    steps: ['Open Settings, then Password and security.', 'Enter your current password and a new one.', 'Save. Other devices can be signed out from Where you are logged in.'],
    body: ['If you forgot your password, use "Forgot password" on the sign-in screen and follow the email.'],
    keywords: ['password', 'reset', 'forgot', 'security', 'login'], related: ['cant-sign-in'],
  },
  {
    id: 'cant-sign-in', category: 'account', popular: true,
    title: "I can't sign in", summary: 'Things to try before contacting us.',
    steps: ['Check you are using the email you registered with.', 'Use "Forgot password" to reset it.', 'Check the spam folder for the reset email.', 'Make sure the date and time on your device are correct.'],
    body: ['If your account was restricted you will see a message when you sign in. You can appeal from Help, under Appeal a decision.'],
    keywords: ['sign in', 'login', 'cannot login', 'locked', 'suspended'], related: ['appeal-a-decision', 'change-password'],
  },
  {
    id: 'delete-account', category: 'account',
    title: 'Delete your account', summary: 'What happens to your data.',
    steps: ['Open Settings, then Accounts Center.', 'Choose Delete account and confirm.'],
    body: ['Deleting your account removes your profile and the content you posted. This cannot be undone. You can download a copy first from Download your information.'],
    keywords: ['delete', 'remove account', 'close account', 'dpdp'], related: ['download-your-data'],
  },
  {
    id: 'download-your-data', category: 'account',
    title: 'Download your information', summary: 'Get a copy of your data.',
    steps: ['Open Settings, then Download your information.', 'Tap Download. A file with your profile, posts, projects and activity is saved.'],
    body: ['Messages are end-to-end encrypted, so they appear as ciphertext in the file.'],
    keywords: ['export', 'download', 'data', 'dpdp', 'copy'], related: ['delete-account'],
  },
  // ── Privacy and safety ──
  {
    id: 'profile-visibility', category: 'privacy-safety', popular: true,
    title: 'Control who sees your profile', summary: 'Public, connections only, or private.',
    steps: ['Open Settings, then Account privacy.', 'Choose Public, Connections or Private.'],
    body: ['Your name, photo, craft and bio stay visible so people can find you. The setting controls your work, skills, credits, highlights and contact links.'],
    keywords: ['privacy', 'visibility', 'private', 'public', 'connections only'], related: ['block-someone', 'who-can-message-me'],
  },
  {
    id: 'block-someone', category: 'privacy-safety',
    title: 'Block someone', summary: 'They cannot reach you or see your details.',
    steps: ['Open their profile and choose Block, or use the menu on their card in Network.', 'Confirm. Any connection between you is removed.', 'To undo it, open Settings, then Blocked.'],
    body: ['They are not told. They cannot message you, call you, send requests or see your profile details.'],
    keywords: ['block', 'unblock', 'harass', 'stop'], related: ['report-something'],
  },
  {
    id: 'report-something', category: 'privacy-safety', popular: true,
    title: 'Report a profile, post or message', summary: 'Tell us about spam, harassment or anything that breaks the rules.',
    steps: ['Open the item and tap the flag or Report option.', 'Choose a reason and add details.', 'Our team reviews it. You can follow up from Help if needed.'],
    body: ['Reports are reviewed by people. For anything urgent or threatening, also contact local authorities.'],
    keywords: ['report', 'abuse', 'harassment', 'spam', 'scam', 'fake'], related: ['block-someone', 'appeal-a-decision'],
  },
  {
    id: 'who-can-message-me', category: 'privacy-safety',
    title: 'Choose who can message or call you', summary: 'Everyone, connections only, or nobody.',
    steps: ['Open Settings.', 'Choose Messages, Connection requests or Calls.', 'Pick the option you want.'],
    body: ['People you already talk to can still reply when you choose Nobody for messages.'],
    keywords: ['message', 'dm', 'calls', 'requests', 'privacy'], related: ['profile-visibility'],
  },
  {
    id: 'appeal-a-decision', category: 'privacy-safety',
    title: 'Appeal a decision', summary: 'Ask us to review a restriction or removal.',
    steps: ['Open Help, then Contact support.', 'Choose Appeal a decision.', 'Explain what happened and why you think it should be reviewed.'],
    body: ['Appeals are reviewed by a different person than the one who made the first decision. Add anything that helps, such as screenshots.'],
    keywords: ['appeal', 'banned', 'suspended', 'restricted', 'removed'], related: ['cant-sign-in', 'report-something'],
  },
  // ── Network ──
  {
    id: 'send-connection-request', category: 'network', popular: true,
    title: 'Connect with people', summary: 'Send a request, with a note.',
    steps: ['Open a profile or a card in Network and tap Connect.', 'Add a short note if you like.', 'They accept, ignore or decline. You are connected when they accept.'],
    body: ['If they already asked you, tapping Connect accepts their request. Some people only accept requests from mutual connections.'],
    keywords: ['connect', 'request', 'network', 'connection'], related: ['introductions', 'who-can-message-me'],
  },
  {
    id: 'introductions', category: 'network',
    title: 'Ask for an introduction', summary: 'Get introduced through someone you both know.',
    steps: ['Open the profile of the person you want to meet.', 'Tap Ask for introduction and pick a mutual connection.', 'If they agree, the other person gets a request mentioning the introduction.'],
    body: ['The introduced person still decides whether to accept.'],
    keywords: ['introduction', 'introduce', 'mutual', 'warm intro'], related: ['send-connection-request'],
  },
  {
    id: 'notes-and-tags', category: 'network',
    title: 'Notes and tags on connections', summary: 'Remember where you met and what they are great at.',
    steps: ['Open Network, then Connections.', 'Open the menu on a connection and choose Notes and tags.', 'Add a private note and tags, then filter by tag later.'],
    body: ['Only you can see your notes and tags.'],
    keywords: ['note', 'tag', 'crew', 'remember'],
  },
  // ── Projects ──
  {
    id: 'availability-status', category: 'projects', popular: true,
    title: 'Show when you are available', summary: 'Open to work, booked, or not looking.',
    steps: ['Open your profile and choose Availability.', 'Set your status, rate range and cities.', 'Use the availability calendar to mark days as free, tentative or booked.'],
    body: ['Days booked in your calendar (or on a project schedule) show you as Booked automatically, even if your status says Open to work.'],
    keywords: ['availability', 'open to work', 'booked', 'calendar', 'schedule'], related: ['date-requests'],
  },
  {
    id: 'date-requests', category: 'projects',
    title: 'Request someone\'s dates', summary: 'Ask a crew member to hold dates for a role.',
    steps: ['Open their profile and tap Request dates.', 'Enter the dates, role and an optional rate.', 'They accept, decline or send a counter offer.'],
    body: ['When they accept, the dates are marked Tentative in their calendar. You can withdraw a request at any time.'],
    keywords: ['hold', 'dates', 'booking', 'crew', 'rate'], related: ['availability-status', 'invite-to-project'],
  },
  {
    id: 'invite-to-project', category: 'projects',
    title: 'Invite someone to a project', summary: 'A personal invitation they can accept.',
    steps: ['Open their profile and tap Invite to project.', 'Pick one of your project spaces, add a role and message.', 'They join when they accept.'],
    body: ['You can invite people to project spaces you created or administer.'],
    keywords: ['invite', 'project', 'team', 'join'], related: ['date-requests'],
  },
  {
    id: 'credits-confirmation', category: 'projects',
    title: 'Confirm a credit', summary: 'Credits added by project creators need your yes.',
    steps: ['Open your profile and go to Credits.', 'Find "Credits waiting for your answer".', 'Confirm the ones that are right, decline the rest.'],
    body: ['Only confirmed credits show on your profile.'],
    keywords: ['credit', 'filmography', 'verified credit', 'confirm'], related: ['complete-your-profile'],
  },
  {
    id: 'recommendations', category: 'projects',
    title: 'Recommendations', summary: 'Connections can write a few lines about working with you.',
    steps: ['Connections you worked with tap Recommend on your profile.', 'You see it under Recommendations with an Approve button.', 'Approved recommendations show on your profile.'],
    body: ['You can decline or remove any recommendation.'],
    keywords: ['recommendation', 'testimonial', 'review person'],
  },
  // ── Jobs ──
  {
    id: 'apply-for-a-job', category: 'jobs',
    title: 'Apply for a job', summary: 'Send your application and track it.',
    steps: ['Open a job and tap Apply.', 'Add a short message and your resume if asked.', 'Track the stage of your application under My applications.'],
    body: ['Resumes are stored privately. Only the hiring team of that job can open them.'],
    keywords: ['job', 'apply', 'application', 'resume', 'cv'],
  },
  {
    id: 'post-a-job', category: 'jobs',
    title: 'Post a job', summary: 'Reach crew and manage applicants.',
    steps: ['Open Jobs and choose Post a job.', 'Fill in the role, location, dates and pay.', 'Manage applicants from the pipeline board.'],
    body: ['You can post as yourself or as a company page you manage. Applicants are notified as their stage changes.'],
    keywords: ['post job', 'hire', 'hiring', 'recruit', 'applicants'],
  },
  // ── Marketplace ──
  {
    id: 'book-gear-or-location', category: 'marketplace',
    title: 'Book gear or a location', summary: 'Send a booking request to the owner.',
    steps: ['Open a listing and choose your dates.', 'Send the request with an optional message.', 'The owner accepts or declines. Track it under My bookings.'],
    body: ['Dates already booked are blocked so you cannot request them. After a completed booking you can leave a review.'],
    keywords: ['marketplace', 'rent', 'booking', 'equipment', 'location'],
  },
  {
    id: 'become-a-vendor', category: 'marketplace',
    title: 'Offer vendor services', summary: 'Register your business and receive quote requests.',
    steps: ['Open Marketplace and choose Register business.', 'Add your services and details, then request verification.', 'Respond to quote requests from your Seller Hub.'],
    body: ['Verified vendors show a badge. Verification documents are kept private.'],
    keywords: ['vendor', 'services', 'business', 'quote', 'seller'],
  },
  // ── Ratings ──
  {
    id: 'rate-and-review', category: 'ratings',
    title: 'Rate and review a title', summary: 'Your rating, your review, your choice of name.',
    steps: ['Open a movie, show or short and tap a star rating.', 'Optionally write a review and mark spoilers.', 'You can post anonymously, and edit or delete your review later.'],
    body: ['You cannot rate or review your own work. Other members can mark reviews helpful or report them.'],
    keywords: ['rating', 'review', 'stars', 'spoiler', 'anonymous'],
  },
  {
    id: 'submit-your-work', category: 'ratings',
    title: 'Submit your own work', summary: 'Add your film so the community can rate it.',
    steps: ['Open Ratings and choose Submit your work (creators and studios).', 'Add the title, poster and details.', 'It appears in Native Cinema and you are notified of new reviews.'],
    body: ['As the creator you can reply once to each review.'],
    keywords: ['submit', 'film', 'cinema', 'short film', 'publish'],
  },
  // ── Calls ──
  {
    id: 'call-permissions', category: 'calls', popular: true,
    title: 'Calls: camera, microphone and who can call you', summary: 'Set your calling preferences.',
    steps: ['Open Settings, then Calls.', 'Choose who can call you.', 'Join calls with the microphone or camera off if you prefer.'],
    body: ['On your phone, allow Microphone and Camera for CineCraft in your device settings.'],
    keywords: ['call', 'camera', 'microphone', 'permission', 'ring'], related: ['who-can-message-me'],
  },
  {
    id: 'notifications-and-quiet-hours', category: 'calls',
    title: 'Notifications and quiet hours', summary: 'Choose what you hear about, and when.',
    steps: ['Open Settings, then Notifications to pick channels and types.', 'Open Quiet hours to pause alerts overnight.'],
    body: ['If you stopped getting alerts, check that notifications are allowed for CineCraft in your device or browser settings.'],
    keywords: ['notification', 'push', 'quiet', 'dnd', 'alerts', 'email'], related: ['not-getting-notifications'],
  },
  // ── Troubleshooting ──
  {
    id: 'not-getting-notifications', category: 'troubleshooting',
    title: "I'm not getting notifications", summary: 'Checklist.',
    steps: ['Settings, Notifications: make sure push notifications are on.', 'Settings, Quiet hours: make sure it is not on.', 'Allow notifications for CineCraft in your device or browser settings.', 'Sign out and in again to refresh your device.'],
    body: ['If it still does not work, send us a request with diagnostics included.'],
    keywords: ['notifications', 'not working', 'push', 'alerts'],
  },
  {
    id: 'upload-problems', category: 'troubleshooting',
    title: 'Uploads fail or are slow', summary: 'Photos, videos and files.',
    steps: ['Check your connection and try Wi-Fi.', 'Photos work best under 10 MB, files under 10 MB.', 'Try again later if the problem continues.'],
    body: ['Large videos are processed after upload and may take a few minutes to appear.'],
    keywords: ['upload', 'photo', 'video', 'file', 'slow', 'failed'],
  },
  {
    id: 'app-is-slow-or-crashes', category: 'troubleshooting',
    title: 'The app is slow or crashes', summary: 'Quick fixes.',
    steps: ['Update to the latest version.', 'On mobile, open Settings, Media quality and storage, and clear the cache.', 'Restart the app or reload the page.'],
    body: ['If it keeps happening, report a problem and include diagnostics so we can see your version and device.'],
    keywords: ['slow', 'crash', 'freeze', 'bug', 'lag', 'not loading'],
  },
];

/** Topics for a new support request. `category` is what the request is filed under. */
export interface TicketTopic {
  id: string;
  label: string;
  description: string;
  category: 'general' | 'technical' | 'billing' | 'report_abuse' | 'feature_request' | 'account' | 'appeal';
  /** a short tip shown once the topic is chosen */
  tip: string;
  placeholder: string;
}

export const TICKET_TOPICS: TicketTopic[] = [
  { id: 'account', label: 'Account and login', description: 'Sign-in, verification, password, deleting your account', category: 'account', tip: 'Never share your password with us. We will never ask for it.', placeholder: 'What happened when you tried to sign in or change your account?' },
  { id: 'bug', label: 'Something is not working', description: 'A bug, an error message or a feature that fails', category: 'technical', tip: 'Tell us the steps that lead to the problem and what you expected to happen.', placeholder: '1. I opened… 2. I tapped… 3. I expected… but…' },
  { id: 'safety', label: 'Report abuse or a safety concern', description: 'Harassment, scams, impersonation, unsafe behaviour', category: 'report_abuse', tip: 'Include the profile name or link and screenshots if you can. We treat these as high priority.', placeholder: 'Who or what are you reporting, and what happened?' },
  { id: 'appeal', label: 'Appeal a decision', description: 'A restriction, removal or ban you think is a mistake', category: 'appeal', tip: 'Explain what you think was misunderstood. A different team member reviews appeals.', placeholder: 'What was restricted or removed, and why should we review it?' },
  { id: 'billing', label: 'Payments and bookings', description: 'Marketplace bookings, vendor quotes, payment questions', category: 'billing', tip: 'Include the booking or listing name and the dates.', placeholder: 'Which booking or order is this about?' },
  { id: 'feature', label: 'Suggest a feature', description: 'Tell us what would make CineCraft better for you', category: 'feature_request', tip: 'Describe the problem you want solved, not only the solution.', placeholder: 'What would you like to do that you cannot do today?' },
  { id: 'other', label: 'Something else', description: 'Any other question', category: 'general', tip: 'The more detail you give, the faster we can help.', placeholder: 'How can we help?' },
];

export const TICKET_STATUS_LABEL: Record<string, string> = {
  open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed',
};

export const TICKET_CATEGORY_LABEL: Record<string, string> = {
  general: 'General', technical: 'Bug or problem', billing: 'Payments and bookings', report_abuse: 'Safety report',
  feature_request: 'Feature request', account: 'Account', appeal: 'Appeal',
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

/** Ranks articles for a search text: title and keyword hits count more than summary or body hits. */
export const searchHelp = (query: string, limit = 8): HelpArticle[] => {
  const q = norm(query);
  if (q.length < 2) return [];
  const words = q.split(' ').filter((w) => w.length > 1);
  const scored = HELP_ARTICLES.map((a) => {
    const title = norm(a.title);
    const sum = norm(a.summary);
    const kw = a.keywords.map(norm).join(' ');
    const body = norm((a.steps || []).concat(a.body).join(' '));
    let score = 0;
    if (title.includes(q)) score += 10;
    if (kw.includes(q)) score += 6;
    for (const w of words) {
      if (title.includes(w)) score += 4;
      if (kw.includes(w)) score += 3;
      if (sum.includes(w)) score += 2;
      if (body.includes(w)) score += 1;
    }
    return { a, score };
  });
  return scored.filter((s) => s.score > 0).sort((x, y) => y.score - x.score).slice(0, limit).map((s) => s.a);
};

export const getHelpArticle = (id: string): HelpArticle | undefined => HELP_ARTICLES.find((a) => a.id === id);
export const getHelpCategory = (id: string): HelpCategory | undefined => HELP_CATEGORIES.find((c) => c.id === id);
export const popularHelpArticles = (): HelpArticle[] => HELP_ARTICLES.filter((a) => a.popular);
export const articlesInCategory = (categoryId: string): HelpArticle[] => HELP_ARTICLES.filter((a) => a.category === categoryId);
