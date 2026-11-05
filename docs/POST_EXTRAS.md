# Post extras: scheduling, collaborators, link previews, GIFs, hidden like counts

Status: built 2026-10-06 (database parts AT and AU, two edge functions, web + mobile).

## Scheduling (part AT)

* In the composer: **Schedule** with quick choices (in 1 hour, tonight/tomorrow 8 PM, tomorrow 9 AM, in 3 days) and a date/time box (web) or day/time steppers (mobile). 5 minutes to 90 days ahead.
* Until its time only the author (and staff) can see the post: a restrictive row-level policy (`posts_scheduled`), the home-feed function and the collaborator/poll functions all apply the same rule.
  The post sorts by the time it goes live (`created_at` is set to `scheduled_at`).
* Notifications (connections' "new post", @mentions/tagged people, company-page followers) are **not** sent when the post is written. They are sent when it goes live: `release_due_posts()` is
  called whenever the feed loads (throttled to once a minute per device) and can also be run by a schedule (pg_cron / a cron-triggered edge function) so notifications go out even if nobody opens the feed.
* The author sees a "Scheduled for ..." banner on the post with **Publish now** (and **Change time** on web). `reschedule_post(post, when)`; `when = null` publishes immediately and sends the notifications.
* Private posts no longer send "New Post" notifications to connections (a bug found on the way).
* Scheduling needs a connection (the web composer says so when offline).

## Collaborators (part AU)

* The author can credit up to 5 people after posting. Each gets a notification ("wants to credit you on a post") and **Accept / Decline** buttons on the post. Only accepted people are shown ("with Sam and Ria").
* People who blocked the author (or were blocked by them) cannot be invited. A collaborator can remove themselves; the author can remove anyone (`remove_post_collaborator`).
* The table is only reachable through the functions; credits are only shown to people who can see the post.
* Not built: showing the post on the collaborator's own profile.

## Link previews (edge function `link-preview`, column check in part AT)

* The composer shows a card for the first link in the caption (title, description, picture) and you can remove it. It is stored on the post (`posts.link_preview`) and shown under the caption (for posts without photos or videos).
* The page is fetched by the **server**, never by the phone or browser. Safeguards: http/https only, no credentials or odd ports, no local/private addresses (the host name is resolved and every address must be public), redirects followed by hand (max 3) and re-checked,
  4 second timeout, 512 KB read limit, HTML only, 30 minute cache, 20 requests a minute per person.
* The database keeps a sanitised preview only if its link actually appears in the caption (so a preview cannot lie about where it goes), with short plain fields and an https picture.
* Deploy: `supabase functions deploy link-preview`. Without it nothing breaks: no card appears.

## GIFs (edge function `gif-search`)

* A **GIF** button in the composer opens a picker (search, or trending when the box is empty) with the "Powered by GIPHY" credit. A chosen GIF is added as an image (it counts towards the 10-item limit) with its title as alt text.
* The key stays on the server: `supabase secrets set GIPHY_API_KEY=...` then `supabase functions deploy gif-search`. Without the key the picker says "GIFs are not set up yet".
* A GIF stays animated unless you apply filters or text to it (editing bakes a still picture).

## Hidden like counts

"Hide like counts" is now also applied by the home-feed function: everyone except the author receives 0 (the apps hide the number as well). **Limit:** the number is still stored on the post row and can be read by anyone who queries the table directly;
hiding a column per viewer is not possible with row-level security. Treat it as "hidden in the app", not as a privacy guarantee.

## Code

| | Where |
|---|---|
| Rules and calls | `packages/core/src/{schedule,collab,link,gif}.ts` (tests: `apps/web/src/tests/post/extras.test.ts`) |
| Web | `components/feed/PostExtras.tsx` (banner, credits, link card), composer blocks in `pages/CreatePost.tsx` |
| Mobile | `components/feed/PostExtras.tsx`, composer blocks and GIF picker in `screens/feed/CreatePostScreen.tsx` |
| Database | `supabase/manual/part_at_post_extras.sql`, `part_au_post_collaborators.sql` |
| Edge functions | `supabase/functions/link-preview`, `supabase/functions/gif-search` |

## Run order

AQ, AR, AS, **AT**, **AU** (each after the previous), then deploy the web and mobile builds; deploy the two edge functions when you want link cards and GIFs.
`get_algorithmic_feed` is recreated in AR, AS and AT; the last one (AT) is the final version, so running them in order is safe.
