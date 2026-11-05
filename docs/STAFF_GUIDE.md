# Staff guide

For the people who run CineCraft Connect: moderators, admins, super admins and the finance role. Written in plain words. It has no accounts and no passwords. Ask the owner team for access.

Staff accounts are not community members. They cannot post, comment, follow, send direct messages, join rooms or apply for jobs. They can read content because moderation needs it. See [STAFF_ACCOUNT_RULES.md](STAFF_ACCOUNT_RULES.md) for the full rules.

Staff tools work on a tablet or a computer. On a phone they show "Tablet or Desktop Required".

## The four roles

| Role | Console | What this role can see and do |
|---|---|---|
| Moderator | `/moderation` | Works the report queue. Claims cases, adds notes, warns, dismisses, removes content (some actions go for a second person's approval). Escalates with a reason. Marks duplicates. Writes handover notes. Exports the queue as CSV. Sees the on-call rota and the status page |
| Admin | `/admin` (can also open `/moderation`) | Everything a moderator can, plus: users, verification queue, support desk (assign tickets, replies, notes), account records, CSV exports, saved views, team workload, on-call rota editing, incident desk, team numbers |
| Super admin | `/super-admin` (can also open the other three) | Everything above, plus: staff matrix and role changes, approvals queue, policy and rules, audit log, payments overview, staff security settings, compliance requests, digest recipients |
| Finance | `/finance` | Reads and decides refunds only. No moderation, admin or user-management power. One role per person |

The test setup has seven staff accounts: two moderators, two admins, two super admins and one finance account. They are called "moderator account 1/2", "admin account 1/2", "super admin account 1/2" and "finance account 1" in the docs.

## The two-person approval rule

Some actions are risky. One person asks, and a different person must approve. The person who asked can never approve their own request. Both steps are written to the audit log.

| Action | Asked by | Approved by |
|---|---|---|
| Remove content, shadowban or ban from a report | Moderator or admin | A different admin or super admin |
| Suspend an account | Admin | A different admin or super admin (TO CONFIRM exact level) |
| Refund | Finance, admin or super admin | A second, different person. Two approvals are needed |
| Give or take away a staff role (including finance) | Super admin | A different super admin |
| Remove a super admin | Super admin | A different super admin |
| Switch two-step sign-in on or off for staff | Super admin | A different super admin. And everyone must be enrolled first |
| Export a person's data (compliance) | Super admin | A different super admin |
| Open a private room or project space | Staff, with a reason | A second person. It lasts 2 hours, is read only and is logged |

If the approvals queue is empty, nothing is waiting. The two-person flow was not tested end to end yet (see [testing/INDEX.md](testing/INDEX.md)).

## How new staff are created

1. A super admin starts the request in Staff Matrix. A different super admin approves it.
2. The new person gets a staff account with a first password set by the super admin.
3. At first sign-in the screen "Choose your own password" appears before anything else opens. The same happens after a super admin resets a staff password.
4. The person chooses a password only they know. Staff must never share logins.
5. The first super admin is created on a hidden setup page. That page is gone once a super admin exists.

## Two-step sign-in

- Staff can protect sign-in with a second step (an authenticator app).
- It ships OFF.
- Do this order: every staff member enrolls first. Then a super admin asks to switch it on. A different super admin approves. If someone has not enrolled, the switch refuses.
- Switching it on before everyone is enrolled would lock that person out.
- When it is on, CSV exports and other sensitive actions need the second step.

## On-call rota

- Each day has one primary and one backup. Days are in UTC.
- Admins and super admins set the rota. Only staff accounts can be on it.
- Everyone on staff sees "On call now" in the header.
- The rota holds names and roles only, no phone numbers.
- Check the rota every Monday.

## Handover notes

- At the end of a shift a moderator writes a short note. Maximum 1000 characters, up to 10 linked cases.
- Do not write names, emails or phone numbers in a note.
- The next moderator reads it and marks it read. You can edit or delete your own note for 15 minutes.
- You can write up to 10 notes per hour.

## Status page and incident desk

- `/status` is public. Anyone can open it without signing in. It shows "All systems operational", "Degraded" or "Outage" and the last 30 days of incidents.
- Admins and super admins open an incident, set the severity and write the public wording. Then they post updates and close it.
- Write public wording that is short and true. Never put internal details, names or customer data there. The internal note is never shown publicly.

## Compliance requests

Used when a person asks what data we hold, or asks to be deleted.

- **Data export:** one super admin records the request. A different super admin approves it, with a note. Then the bundle downloads: account, profile, posts, jobs, applications, reports the person filed, support tickets.
- The bundle never holds message content (encrypted chats are not readable by the platform), passwords, encryption keys, push tokens or sessions.
- **Erasure tracker:** records each request with a due date 30 days after it arrived. A person decides each one by hand. Nothing is ever deleted automatically.
- Every step is in the audit log.

## Digest emails

- Daily or weekly numbers by email. You opt in for yourself. A super admin can switch someone off but never on.
- Counts only. No names, report text or messages.
- Not live until the function, secrets and schedule are set up (see [DEPLOY.md](DEPLOY.md)). Email delivery has not been tested yet.

## First-day checklist

### Moderator
1. Sign in, then choose your own password on the first screen.
2. Enroll in two-step sign-in if it is switched on.
3. Open `/moderation` and look at My day and the SLA badges.
4. Read the latest handover notes and mark them read.
5. Practise on a test case: claim, add a note, escalate with a reason, dismiss with a reason.
6. Check who is on call.

### Admin
1. Choose your own password. Enroll in two-step sign-in if on.
2. Open `/admin` and look at Operations, the "Paying and free users" card and team numbers.
3. Open the support desk and take one ticket. Reply with a ready-made reply.
4. Open an account record and read it (it has no passwords or emails).
5. Set up one saved view.
6. Check the on-call rota for the week. Fill gaps.
7. Choose your digest (Off, Daily or Weekly).

### Super admin
1. Choose your own password. Enroll in two-step sign-in.
2. Open `/super-admin` and read Overview and Approvals.
3. Check the Staff Matrix. Make sure every staff member has a role and has enrolled.
4. Check that two super admins exist, so approvals can work.
5. Open Compliance. Check for waiting requests and due dates.
6. Read the audit log and try the filters.
7. Do not switch two-step sign-in on until everyone has enrolled.

### Finance
1. Choose your own password on the first screen. This must happen before any test of `/finance`.
2. Open `/finance` and look at Needs action, All, Sent and Refused.
3. Read a refund request. Vote on it. Remember a different person must give the second approval.
4. You cannot send a refund alone.
5. Billing is still in beta and payments are off. Tax rate starts at 0.

## When something is wrong

1. Tell the person on call (see the header).
2. If users are affected, an admin opens an incident so `/status` says so.
3. Write what happened in a handover note.
