<div align="center">

<img src="https://storage.googleapis.com/gpt-engineer-file-uploads/zdztktSz7DguBhd7OcwRyev7unL2/uploads/1762323700588-Playful Collage Logo - CineCraft Network (1).png" width="96" alt="CineCraft Connect logo">

# CineCraft Connect

**The professional network and workspace for film, TV and creator teams.**
Find talent, run productions, talk in private, and trade equipment, in one place on the web, Android and iOS.

[![License: MIT](https://img.shields.io/badge/license-MIT-FF4B33.svg)](LICENSE)
![Node](https://img.shields.io/badge/node-%E2%89%A5%2022-FF4B33)
![Web](https://img.shields.io/badge/web-React%2018%20%2B%20Vite-1f1f1f)
![Mobile](https://img.shields.io/badge/mobile-React%20Native%200.76%20%2B%20Expo%2052-1f1f1f)
![Backend](https://img.shields.io/badge/backend-Supabase-1f1f1f)

[Website](https://cinecraftconnect.com) · [Architecture](docs/APP_ARCHITECTURE.md) · [User guide](docs/USER_GUIDE.md) · [iOS build guide](apps/mobile/IOS_SETUP.md)

</div>

---

## What it is

CineCraft Connect brings the people and the paperwork of a production together. Directors, cinematographers, editors, sound designers, YouTube creators and production houses get a profile for their craft, a feed, a place to work with their team, and a marketplace for jobs, gear and services.

| | |
|---|---|
| **Network** | Craft-specific profiles, a feed with polls and media, connections, company pages, shortlists, ratings and reviews. |
| **Production workspace** | Projects with spaces for each team, discussion rooms, files, announcements and a pitch area for stories and scripts. |
| **Talk** | Direct messages and group chats with reactions and replies, voice and video calls, screen sharing, and audio spaces. Private chats can be end-to-end encrypted. |
| **Marketplace** | Job board and applications, equipment rentals with bookings and availability, vendor discovery, quotes and disputes. |
| **Account** | Plans and billing, gifts, staff and admin tools, data export, and account deletion. |

## What is in the repository

This is an npm workspaces monorepo. The web app and the mobile app share their logic through the packages.

```
apps/
  web/        React 18 + Vite + TypeScript + Tailwind + shadcn/ui
  mobile/     React Native 0.76 + Expo 52 (Android and iOS, phones and tablets)
packages/
  api/        Supabase client and data access
  auth/       Sign-in, sessions, accounts
  calling/    LiveKit call logic shared by web and mobile
  core/       Rules and helpers with no UI (photo edit recipes, encryption policy, ...)
  e2ee/       End-to-end encryption for direct messages and rooms
  messaging/  Chat building blocks
  notifications/  storage/  types/  ui/  validation/
supabase/
  migrations/ Database schema and row level security
  functions/  Edge functions (push delivery, billing, LiveKit tokens, link previews, ...)
docs/         Architecture, feature notes, test plan, audits
```

## Tech stack

| Layer | Used |
|---|---|
| Web | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, TanStack Query |
| Mobile | React Native 0.76 (new architecture off), Expo 52 modules, Firebase Cloud Messaging, native Kotlin/Java and Objective-C modules |
| Backend | Supabase: Postgres with row level security, Auth, Realtime, Storage, Edge Functions |
| Calls | LiveKit (web and React Native) |
| Hosting | Firebase Hosting for the web build, GitHub Actions for lint, typecheck and tests |

## Getting started

You need **Node 22 or newer**, npm, and a Supabase project (or the [Supabase CLI](https://supabase.com/docs/guides/cli) for a local one).

```bash
git clone https://github.com/Vammshikrishna/Cinecraftconnect.git
cd Cinecraftconnect
npm install            # installs every workspace
```

### Web

```bash
# apps/web/.env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key

npm run dev            # http://localhost:8080
npm run build          # production build in apps/web/dist
```

### Mobile

```bash
# once: copy apps/mobile/src/config/env.secrets.example.ts to env.secrets.ts and fill it in
npm run start:mobile   # Metro
npm run android        # run on an Android device or emulator
npm run ios            # macOS only, see the iOS guide first
```

Android also needs `google-services.json`; iOS needs `GoogleService-Info.plist` and a Mac with Xcode. The step by step iOS setup, with the known limits, is in [apps/mobile/IOS_SETUP.md](apps/mobile/IOS_SETUP.md).

### Checks

```bash
npm run lint
npm run typecheck
npm run test --workspace=@cinecraft/web
```

## Mobile at a glance

| | Android | iOS |
|---|---|---|
| Push notifications with Reply / Mark as read | yes | yes (needs the latest `push-delivery`) |
| Voice and video calls, screen sharing, picture-in-picture | yes | yes (written, not yet tested on a device) |
| Incoming call screen when the app is closed | full screen | banner for now (CallKit is planned) |
| Photo and video editor, image compression | yes | yes |
| Tablet layouts | yes | yes (iPad) |

The iOS project was written without a Mac, so expect small fixes on its first build.

## Security and privacy

- Every table is protected with Postgres row level security; security-sensitive functions live outside the public schema.
- Direct messages, private rooms and project spaces can be end-to-end encrypted; keys are held on the device. See [docs/E2EE_OPT_IN_DESIGN.md](docs/E2EE_OPT_IN_DESIGN.md).
- Secrets (Supabase service key, Firebase, LiveKit, payment keys) belong in the Supabase function settings or the git-ignored `env.secrets.ts`, never in the repository.
- Found a vulnerability? Please email the maintainers instead of opening a public issue.

## Documentation

| | |
|---|---|
| [Architecture](docs/APP_ARCHITECTURE.md) | How the apps, packages and database fit together |
| [User guide](docs/USER_GUIDE.md) | Features from the user's side |
| [Test plan](docs/TEST_PLAN.md) and [testing/](docs/testing) | What is covered and how to run it |
| [Product roadmap](docs/PRODUCT_ROADMAP.md) | Where it is going |
| [Platform parity](docs/PLATFORM_PARITY.md) | Web, Android and iOS differences |
| [SQL run order](docs/SQL_RUN_ORDER.md) | Every manual SQL part, in the order to run it |
| [Deploy](docs/DEPLOY.md) | SQL, edge functions and web build, rollback, smoke test |
| [Features this round](docs/FEATURES_THIS_ROUND.md) | What was built, who can use it, which SQL it needs |
| [Mobile parity](docs/MOBILE_PARITY.md) | What reached the mobile app, what did not, what needs a device test |
| [Testing index](docs/testing/INDEX.md) | One line per test result file, and the open items |
| [Staff guide](docs/STAFF_GUIDE.md) | Roles, two-person approval, rota, status page, compliance |

## License

[MIT](LICENSE) © CineCraft Connect.

<div align="center">

Built for the people who make what we watch.

</div>
