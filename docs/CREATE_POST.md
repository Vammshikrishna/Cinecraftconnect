# Create post

Status: reworked 2026-10-06 (web `apps/web/src/pages/CreatePost.tsx`, mobile `apps/mobile/src/screens/feed/CreatePostScreen.tsx`).

## Rules (one place for both apps)

`packages/core/src/post.ts`, enforced again by the database (`supabase/manual/part_aq_posts.sql`):

| Rule | Value |
|---|---|
| Caption | up to 2200 characters |
| Photos/videos | up to 10 per post; videos up to 3:59 |
| Alt text | up to 300 characters per item |
| Hashtags | any language, lower-cased, unique, max 30 (`extractHashtags`) |
| Category | separate field (`posts.category`): General (none), Direction, Cinematography, … Casting, Equipment, Behind the scenes |
| Posting rate | 20 an hour, 100 a day per author (database) |
| Audience | Everyone (default), Connections, Only me: enforced by the database (part AR) |

## What a post row contains

* `content`, `tags` (hashtags only), `category`, `page_id`
* `media_type`, `media_url`, `media_urls` (only from real media; a text post has none)
* `media_items` (jsonb): the photos/videos with their edit details and `alt`. The place, tagged people, comment/like switches live on the **first**
  item because every feed reads them there. A post with no media gets one details-only item (`type: "meta"`, empty `url`); readers skip items without a url
  (`buildMediaItems`, `PostCard`).

## Flow

1. Pick or drop media (web: drag and drop works). Files upload one at a time; a failing file is reported by name and never discards the others.
2. Edit (crop, filters, text). **Mobile:** every photo keeps its own edits; on Next each edited photo is brought on screen in turn, captured and uploaded.
3. Details: caption, category, alt text, tag people (never yourself or people you blocked), place, post as a company page, comment/like switches.
4. Share: web and mobile publish directly and show the real error if refused (limit, permission, rate limit). Web falls back to the offline queue only when
   the browser is offline, and says so ("Saved on this device… will be published when you are back online").
5. After a successful post the feed refreshes (web: query invalidation; mobile: `Feed.postCreated`).

## Drafts and leaving safely

Caption, media, tags and options are saved on the device while you work (web: localStorage; mobile: AsyncStorage) and offered again next time ("Continue your draft?").
Discarding a draft deletes its uploaded files. The tab cannot be closed in the middle of an upload or while posting (web); on mobile, Back asks to keep as a draft or discard.
Unsaved filter/crop edits are not part of the draft (they are applied when you press Next).

## Server side (part AQ)

* caption/media/tag limits and the rate limit (clear messages)
* `@username` in the caption and tagged people get a "mentioned you" notification (max 10 per post; not for people who blocked the author)
* "Turn off commenting" is enforced: only the author can comment on such a post
* old tags lower-cased and de-duplicated; GIN index on `posts.tags`; `posts.category`

## Audience and "Edited" (part AR)

* `posts.audience` is enforced for every read of posts by a restrictive row-level policy (`posts_audience`) that is ANDed with the existing policy, by the home-feed function (which applies the rule for `auth.uid()`, never the id passed in) and for comments (you cannot comment on a post you cannot see). Moderators/staff can still see everything.
* `posts.edited_at` is set when the caption or media changes; feeds show "Edited". Posts with a non-public audience show "Connections" or "Only me" next to the time.
* Not covered: profile post **counts** and "last active" still include private posts (numbers only).

## Polls

See docs/POLLS.md (database part AS).

## Scheduling, collaborators, link previews, GIFs

See docs/POST_EXTRAS.md (database parts AT and AU, edge functions link-preview and gif-search).

## Place search

The "Add location" box uses `packages/core/src/geocode.ts`: first the `geocode` edge function (cached, rate limited, identified to OpenStreetMap), and if that is not deployed or fails, OpenStreetMap directly. Deploy: `supabase functions deploy geocode`.

## Known gaps

* "Hide like counts" is applied by the apps and the home-feed function, but the number can still be read from the table directly (see docs/POST_EXTRAS.md).
* The quick composer on the feed (`FeedTab`) is a separate, simpler path (it now saves real hashtags too).
* The two apps write media columns slightly differently in old posts (`media_url` only on old web posts); readers handle both.

## Ideas not built

Showing a credited post on the collaborator's own profile, editing polls, multiple-choice polls.
