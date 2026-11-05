# Staff (internal) accounts: what they can and cannot do

Staff accounts (moderator, admin, super admin) exist to run the platform. They are not members of the community.
The rules below are enforced in the database, so they hold on web, mobile and anything built later. The screens
hide what staff cannot do, but the database is what guarantees it.

| Rule | SQL part |
| --- | --- |
| Staff can never be a member of a room or project space, or ask to join one | part_bq |
| Staff enter a private room or project space only through audited access (reason, second approval, 2 hours, logged) | existing, tightened in part_bp |
| An audited visit is read only: no posting, no read receipts, no calls, not shown as a member | part_bp |
| The encryption key copy and the access end together; "End access" really ends it | part_bp, part_br |
| Without an active grant staff see no messages, member lists, read receipts or member counts | part_br |
| Staff do not take part in the social side: no posts, comments, likes, follows, direct messages, reviews, applications, pitches, listings (and nobody does these to them) | part_bt |
| Staff notifications are limited to governance, support, system and security | part_bt (replaces the notification part of part_bs) |

Still allowed for staff, because it is their job: support tickets and replies, content reports, moderation notes and
evidence, platform announcements, verification decisions, editing their own profile and settings.

To let staff receive one more kind of notification, add its type to `staff_notification_allowed()` in part_bt.

## What the screens do for staff

Staff can still READ content, because moderation needs it: posts, comments, profiles, jobs, listings. They cannot act on it.

- Web: pages that only make sense for taking part (create a post or project, messages and direct messages, my applications, manage jobs, bookings, quotes, seller hub, wishlist, my ratings, submit a pitch, review a submission, shortlists) show "Not available for staff accounts" (`StaffBlock`). Endorse buttons, follow and connect buttons, like, comment and rating controls are hidden or disabled.
- Mobile: the same screens are wrapped in `withStaffBlock`. Post cards hide follow and save and disable like and share, the comments sheet is read only, and profile and network cards hide connect, follow and message.
- If a button is missed, the database still refuses the action and the person sees "Staff accounts do not take part in social features."
