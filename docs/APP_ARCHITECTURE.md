# CineCraft Connect: how the app works (technical overview)

For engineers and technical testers. It describes how the product is built and how data moves through it. For the people who use the app see [USER_GUIDE.md](USER_GUIDE.md); for what to test see [TEST_PLAN.md](TEST_PLAN.md).

Everything below comes from reading the repository. Where something was not read in detail it says so.

## 1. What the product is

A social and working network for the film and entertainment industry. People post work, build a network of connections, find jobs and crew, run project spaces with their team, pitch stories to producers, rent gear or hire vendors, and talk in discussion rooms and private chats. There is a web app and a mobile app on one shared backend.

### Who uses it (account types)

| Type | Stored as | What they get |
|---|---|---|
| **Fan** | `profiles.account_type = 'fan'` | Browse, follow creators, rate films, join discussions, read announcements and pages. No posting, no jobs, no marketplace, no pitch, no project spaces. |
| **Creator / Pro** | `'creator'` (also the default for older profiles) | Everything: posting, network connections, jobs, project spaces, marketplace, vendors, pitch (as writer; as call owner too), availability, company pages. |
| **Studio** | `'studio'` | Same as Pro, plus the studio badge. Can create pitch calls and company pages. |

Staff roles (separate from account type): **moderator**, **admin**, **super_admin**. They see the internal tools (Moderation, Admin Panel, Super Admin) in the navigation.

The web gate is the `useAccountType` hook (`isFan`, `isCreator`, `isStudio`). Several areas also sit behind **platform feature flags** that an admin can switch off: `talent_network_enabled`, `job_posting_enabled`, `marketplace_enabled`, `messaging_enabled`, `discussion_rooms_enabled`, `project_creation_enabled`.

## 2. How the code is organised

A single repository (npm workspaces):

| Folder | What it is |
|---|---|
| `apps/web` | The web app. React 18, TypeScript, Vite, Tailwind, shadcn/Radix components, React Router, React Query. |
| `apps/mobile` | The mobile app. React Native (TypeScript), FlashList/FlatList, a custom Icon component, React Navigation. |
| `packages/core` (`@cinecraft/core`) | Logic shared by web and mobile: search, posts, polls, schedule, collaborators, links, GIFs, pitch and story helpers, feed helpers, help and username rules, E2EE policy. One place for rules so both apps behave the same. |
| `packages/api` | The Supabase client used by mobile (`getSupabaseClient`). |
| `packages/auth`, `calling`, `e2ee`, `messaging`, `notifications`, `storage`, `types`, `ui`, `validation` | Shared building blocks (sign-in, calls, encryption, chat, push, uploads, types, UI parts, input rules). |
| `supabase/migrations` | Database migrations that were applied by tooling (the squashed base schema is here). |
| `supabase/manual` | **Numbered SQL "parts"** (A, B ... AZ, BA, BB, BD) that the owner runs by hand in the Supabase SQL editor. `DEPLOY_CHECKLIST.md` says what each part does and the order. |
| `supabase/functions` | Edge functions (see section 6). |
| `docs` | This documentation and per-feature notes (FEED, PITCH, PROFILE, POLLS, POST_EXTRAS, SEARCH_EXPLORE, CREATE_POST, E2EE design). |

**Web structure.** `src/pages` (one file per route), `src/components/<area>` (feed, profile, network, pitch, jobs, marketplace, discussions, projects, settings, navbar and so on), `src/hooks` (data hooks), `src/contexts` (Auth, Navigation, Call, Presence, Keyboard, PlatformFlags), `src/lib`, `src/services`, `src/tests`.

**Mobile structure.** `src/screens/<area>` (about 60 screens), `src/components/<area>`, `src/navigation` (stack + tab navigators), `src/hooks`, `src/services` (offline cache, TMDB).

## 3. The backend: Supabase

Postgres is the system of record. The apps talk to it directly with the Supabase client (REST, Realtime, Storage, Auth), not through a custom server. Because of that, **security lives in the database**.

### Security model

- **Row Level Security (RLS)** is on for application tables. Policies decide who can read and write each row.
- **Restrictive policies** (for example `posts_audience`, `posts_scheduled`) are ANDed with the general ones, so a post visible "to everyone" is still hidden if it is private or scheduled.
- **Triggers enforce rules the client cannot be trusted with**: who may change what on a pitch submission, that a story request starts pending, rate limits (for example 20 pitches a day, 5 direct pitches a day), no self-actions, blocked users.
- **SECURITY DEFINER functions (RPCs)** run with the owner's rights for jobs the client may not do directly: ranked feed, trending lists, withdrawing a pitch, logging views and impressions, reading a locked story synopsis, reading NDA records, closing expired calls.
- **System flag.** Trusted functions set `app.market_system` for the transaction; guard triggers check `market_is_system()` and let those writes through. Normal users never have it.
- **Private storage.** Pitch files and support screenshots live in private buckets read through short-lived signed URLs, and only by the people the rules allow.
- **Blocked users** are respected in the feed function, messaging, pitching, story requests and contact details.
- **Rate limiting** in the database for risky actions, and an edge function (`rate-limit-check`) where needed.

### Storage buckets

`avatars` (profile photos), `project-files`, `legal-documents`, `portfolio-media`, `post-media` (post uploads), `pitch_assets` (private: pitch decks and writer attachments), `support` (private), `resumes` (private CVs). Names are centralised in `apps/web/src/lib/storage.ts`.

### Realtime

Realtime channels push changes for chat messages, notifications, presence (online dots), posts (the "new posts" pill), likes, pitch submissions and story requests. A reconnect-replay manager in the web app drops out-of-order events (tested in `tests/realtime`).

## 4. Main data flows

### Sign-in and onboarding
Supabase Auth (email and password). After sign-up the person completes their profile (`/complete-profile`) and chooses an account type. Until onboarding is complete the app shows the landing navigation; after it, the full navigation. Several accounts can be saved on a device and switched (Account Switcher).

### Posting
Create Post is a multi-step editor (pick media, edit, details). Options: caption, location, tags, audience (public, connections, private), comment lock, hide like counts, poll (2 to 4 options with a close time), schedule for later, credit collaborators (accept flow), link preview, GIF, AI-generated label. Scheduled posts stay hidden (author only) until their time; a release step (`releaseDuePosts`) publishes and notifies when the time comes.

### The feed
`get_algorithmic_feed` ranks posts for the signed-in person (one function used by web and mobile):
- ranking score = base + follows/connections/page follows + same craft + authors and topics you liked + likes and comments, divided by an age factor;
- an author's 2nd, 3rd post count less (variety); posts you have already seen rank lower;
- removed: blocked people, hidden posts ("not interested"), muted authors, muted words, scheduled-in-future, other people's private posts;
- stable paging: every page is ranked "as of" the first page's time, with offset paging;
- tabs: For You and Network/Following (people you follow or are connected to, followed pages, your own posts), plus a craft filter;
- each post carries a short **reason** ("You follow...", "Because you liked posts about #...") shown from the post menu.
Widgets (announcements, people to connect with, trending projects, active discussions, popular marketplace and vendors, releases) are inserted after the 3rd post and then every 5th, ranked by recent activity through `get_trending_ids`. Impressions (a post seen 60% for a second) feed the "seen" demotion and post insights. If the ranked feed function is missing, both apps fall back to a newest-first query.

### Network (connections)
`user_connections` holds requests and accepted connections; `user_follows` holds follows (fans follow creators). Suggestions come from `suggest_people` (mutual connections, shared projects and pages, craft, location) and honour dismissals and blocks. Several actions require an accepted connection (see PROFILE.md): requesting dates, inviting to a project, recommending. Message follows the person's message privacy.

### Profile
Public columns on `profiles`; private details in `profile_private`; visibility-protected extras in `profile_extras` (social links, unions, day rate); highlights (showreel, languages, gear, hidden sections); availability (`profile_availability`, calendar blocks and project schedules win over "open"); awards, experience, skills, portfolio, credits (verified by project owners), recommendations (approved by the person). The profile header shows identity, numbers and actions; "At a glance" shows availability to whoever may see it.

### Pitch
Pitch **calls** (creator posts a brief), **submissions** (writers send a pitch, optionally with NDA signature and attachments), **review** (call owner: status, private note and rating, message to writer, compare, bulk actions, CSV), **withdraw / edit**, **direct pitch** (private brief created by `submit_direct_pitch_call`), **Story Exchange** (writers list concepts; producers request access; the writer approves; the full synopsis is only returned through `get_story_full_synopsis`). Rules are enforced in the database (see PITCH.md). Calls close by themselves after the deadline; savers are reminded the day before.

### Jobs
Companies and individuals post jobs; people browse, filter, save, set alerts, apply (with CV and answers); employers run a pipeline (stages, shortlist, bulk actions, interviews, CSV export, analytics). Applicants track applications and respond to interview invitations (confirm, decline, add to calendar).

### Projects and project spaces
A project has a public detail page and a **space** (`/projects/:id/space`) for the team: chat, files, tasks and schedule/budget/call-sheet tools, roles and invitations, and a space-level call.

### Discussions
Public or request-to-join rooms with categories and chat; creators can edit and delete rooms; members can start audio/video calls (LiveKit) and audio spaces.

### Messages
Direct messages and group chats with end-to-end encryption options (keys created on the device; backup and recovery; see `docs/E2EE_OPT_IN_DESIGN.md`), attachments, calls, read states, quiet hours and per-person privacy.

### Marketplace and vendors
Equipment and location listings, bookings (renting/hosting), wishlists (shareable), reviews, vendor profiles with services and quote requests, a Seller Hub (activity, verification, listings on/off). Vendor contact details are loaded with the vendor row (a known decision, see FEED.md "Not done").

### Search
One search over people, projects, discussions, posts, jobs, pitch calls, announcements, vendors, marketplace listings and companies, with categories, filters (craft, verified, listing type), saved and recent searches. Shared code is in `packages/core/src/search.ts`.

### Notifications and push
In-app notifications (table `notifications`, with a `trigger_user_id`) created by triggers and functions; push delivery and reply edge functions for mobile/web push; per-type settings and quiet hours.

### Ratings
Film and series data from TMDB; people rate titles, review, mark reviews helpful, hide spoilers, create lists; creators can reply to reviews of their own titles.

## 5. Navigation and layout (web)

- **Wide screens (1024 px and up), signed in:** a left navigation rail of icons that opens over the page (labels appear) when you hover or focus it; the page only reserves 72 px. The top bar is hidden. Items: Home, Search, ProjectSpace, Discussions, Jobs, Network, Marketplace, Pitch, Ratings, Announcements, Pages, Messages, Notifications, Create, Profile, and More (Settings, internal tools, Log out). Fans see a shorter list.
- **Below 1024 px:** the top bar and a bottom tab bar (Home, Discussions, Ratings, Announcements, Pages or Projects, Jobs, Network, More).
- **Signed out / onboarding:** the landing navigation.
- Page wrappers are widened to 1152 to 1560 px depending on the page; card lists use flexible auto-fill grids with a minimum card width.
- The shared page wrapper (`MobileNavInset`) adds the left space, reserves room for the bottom tabs on small screens and pulls pages up on wide screens.

Mobile uses a tab navigator (Feed, Discussions, Ratings, Announcements, Pages, Projects, Jobs, Network, More) over a stack navigator.

## 6. Edge functions (`supabase/functions`)

`delete-account`, `revoke-other-sessions`, `push-delivery`, `push-reply`, `process-background-jobs`, `transcode-video`, `livekit-token`, `space-control`, `geocode` (cached place search), `link-preview` (SSRF-hardened), `gif-search` (needs the GIPHY key secret), `profile-preview`, `user-profiles`, `rate-limit-check`, `health-check`, `realtime-chat`, `webrtc-signaling`, `discussion-room-create/get-messages/join-room/leave-room/list-rooms/update-room`, and shared helpers in `_shared`. Secrets used include `LIVEKIT_URL` and `GIPHY_API_KEY`.

## 7. Deploying and operating

1. Run any new SQL parts from `supabase/manual` in the order in `DEPLOY_CHECKLIST.md` (the list is long; each part names what must be deployed with it).
2. Deploy edge functions (`supabase functions deploy ...`).
3. Deploy the web build (Firebase Hosting serves `apps/web/dist`) and release the mobile build.
4. The apps are written to keep working when a new SQL part is not yet run (for example the feed falls back to the old query); some features simply hide.

Project rules agreed with the owner: SQL is run by the owner by hand; no git or CI changes are made unless asked; `.env` is never opened; no release build unless asked.

## 8. Quality tools

- **Unit tests:** Vitest in `apps/web/src/tests` (post, polls, search, feed, pitch, profile QR, realtime replay, e2ee, mutations). Run `npm test` or `npx vitest run` in `apps/web`.
- **Type checking:** `npx tsc --noEmit -p tsconfig.app.json` (web) and `npx tsc --noEmit` (mobile). Web currently shows 3 older errors in cinema, portfolio and monitoring files.
- **Lint:** ESLint 9 toolchain.
- **Manual and security testing:** see [TEST_PLAN.md](TEST_PLAN.md).

## 9. Known limits and decisions

- Reposts, quote posts and reactions beyond Like are not built.
- Mobile has no copy-link (no clipboard library) and no per-card dismiss on feed widgets.
- Real guild verification for pitch calls does not exist: "Guild (claimed)" is shown.
- Vendor and marketplace widgets on web still read every column.
- The profile cover image and the Crew sheet were removed from the app, along with their code.
- Part BC is not needed. Parts AV to BB and BD are recent and should be run in order.
