# Deploy

How to put a new version live. Do the steps in this order: SQL, then edge functions, then the web build.

Why this order: the web build is built to keep working when a new SQL part is missing, but the reverse is not true. New SQL with an old web build is harmless. A new web build with missing SQL shows short "not available yet" notes.

Never put keys, passwords or tokens in a file in this repository. Use the Supabase function settings, the Supabase SQL editor, or your own password manager.

## 1. SQL

1. Open [SQL_RUN_ORDER.md](SQL_RUN_ORDER.md). Find the last part you ran.
2. Run each later part in the listed order in the Supabase Dashboard under SQL Editor.
3. For each part, run its PREFLIGHT line before and its POST-CHECK line after. Both are read only and are written in the file header.
4. `part_gc_finance_role` needs its `ALTER TYPE` line run alone first. `part_gi_6_schedule` needs extensions, a function and secrets first (see section 2).
5. Do not run `part_fl_remove_test_accounts` until all testing is finished.

## 2. Supabase edge functions

Deploy from the repo root with the Supabase CLI. Log in and link the project first (`supabase login`, `supabase link --project-ref <project-ref>`).

| Function | When | Command |
|---|---|---|
| `push-delivery` | Deploy this round. It changed (push for the new chat features). TO CONFIRM the exact change before relying on it | `supabase functions deploy push-delivery` |
| `staff-digest` | New. Deploy before running `part_gi_6_schedule` | `supabase functions deploy staff-digest` |
| `billing-webhook` | Only before payments are switched on. Payment providers call it without a user sign-in, so it needs `--no-verify-jwt`. Leave it undeployed while billing is off | `supabase functions deploy billing-webhook --no-verify-jwt` |
| `health-check` | If not deployed yet (uptime monitor calls it without sign-in) | `supabase functions deploy health-check --no-verify-jwt` |
| Others (`livekit-token`, `space-control`, `key-vault`, ...) | Only if their code changed. TO CONFIRM against your last deploy | `supabase functions deploy <name>` |

### staff-digest setup (daily and weekly staff emails)

Nothing is sent until every step is done.

1. Switch on the extensions `pg_cron` and `pg_net` (Dashboard > Database > Extensions).
2. Apply `part_gi_1_team_dashboards` and `part_gi_5_staff_digest`.
3. Deploy the function (command above).
4. Set the function secrets. Use your own values:
   `supabase secrets set STAFF_DIGEST_SECRET=<long random text> RESEND_API_KEY=<your Resend key> DIGEST_FROM="CineCraft <digest@yourdomain>"`
   The sender domain must be verified at the email provider (Resend).
5. Store the same random text for the database. Run it once in the SQL editor, with the real value in place of the placeholder:
   `insert into public.app_settings (key, value) values ('staff_digest_secret', '<the same long random text>') on conflict (key) do update set value = excluded.value;`
6. Run `part_gi_6_schedule`. It prints a NOTICE for anything still missing.
7. Run `part_gi_7_digest_recipients_fix` if it is not applied yet.
8. Each staff member opts in for themselves in the Digests setting. A super admin can switch someone off, never on.

Digest emails have not been tested end to end. See [testing/INDEX.md](testing/INDEX.md).

## 3. Web build

Firebase Hosting serves `apps/web/dist` (set in `firebase.json`).

1. From the repo root: `npm ci`.
2. Make sure `apps/web/.env` has the web settings (Supabase URL and public key). See the README.
3. Run the checks: lint, typecheck and unit tests (the CI workflow runs the same).
4. Build: `npm run build --workspace apps/web` (TO CONFIRM the exact script name in `apps/web/package.json`).
5. Deploy: `firebase deploy --only hosting`.
6. The page `index.html` is not cached. Scripts and images are cached for a year, so a new version appears on the next load.

## 4. Mobile

Only build the Android release when you decide to. Nothing here is automatic. The iOS app has never been compiled. See `IOS_SETUP.md`.

## Rollback

- **Web:** in the Firebase console open Hosting > Release history and roll back to the previous version. This takes a minute and does not touch the database.
- **Edge function:** redeploy the previous version of the file from your own copy of the code, then run `supabase functions deploy <name>`.
- **SQL:** parts are not undone automatically. Almost all of them only add things, so leaving them in place is safe. Exceptions: `part_cl` has a `part_cl_rollback.sql`. Parts that drop or remove things (`part_g`, `part_di`, `part_fl`, `part_z`) cannot be undone: take a database backup first.
- **Staff digest:** to stop the emails, switch the schedule off in the Supabase cron jobs list, or ask everyone to set their digest to Off.
- **Two-step sign-in for staff:** it ships OFF. Do not switch it on until every staff member has enrolled.

## Smoke test after a deploy

Use a test account, not a real person's.

1. Open the site. The home page loads and a hard refresh shows the new version.
2. Sign in and out. A wrong password gives a clear message.
3. Feed loads. Open one post.
4. Send a direct message between two test accounts. Edit it within 15 minutes. Mute and pin a chat.
5. Message a person you are not connected to. They see it under Requests. The sender can send 3 messages.
6. Start a call between two creator test accounts. A fan test account does not see the call buttons.
7. Open `/status` while signed out. It shows "All systems operational" or the current incident.
8. As a moderator test account, open `/moderation`. As an admin, open `/admin`. As a super admin, open `/super-admin`. As the finance account, open `/finance`.
9. A normal user opening `/admin` is sent back to the feed.
10. As admin, the "Paying and free users" card shows numbers (not "n/a").
11. Check the Supabase function logs for errors from `push-delivery` after sending a test message.
12. If you set up digests: set one admin account to Daily, wait for the next scheduled run, check the inbox (TO CONFIRM, not tested yet).
