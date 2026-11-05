# Profile and public profile (web)

## Layout

One shared header, `components/profile/ProfileHero.tsx`, used by your profile and by public profiles. Left: photo, name, handle, craft and location, role pill, bio, social links. Right column: Posts / Followers / Connections (click for the lists), availability details (only what the person allows you to see, drawn only when there is something to show), and the action buttons. There is no cover image any more.

## What needs a connection

| Action | Needs an accepted connection? | Why |
|---|---|---|
| Connect, Ask for introduction | no | they are how you get connected |
| Message | yes, unless the person's message privacy setting allows you | unchanged: enforced by the database already |
| Request dates | **yes** | a cold date request is easy to spam |
| Invite to project | **yes** | same |
| Recommend | yes | already the rule (`write_recommendation`) |
| Direct Pitch | no | cold pitches are the point; each producer can turn them off (accept direct pitches) |
| Shortlist | no | private to you, nobody is contacted |

For people you are not connected to, **Request dates** and **Invite to project** show with a lock; tapping one tells you to connect first (or that your request is waiting). The rule is enforced in the database by `supabase/manual/part_bd_work_requests_need_connection.sql` (triggers on `date_holds` and `project_person_invites`), not just hidden in the page.

To change a rule later: Direct Pitch is controlled by the person's accept-direct-pitches setting; the two locked buttons follow `are_connected()`.
