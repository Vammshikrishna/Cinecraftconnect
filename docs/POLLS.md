# Polls on posts

Status: built 2026-10-06 (web + mobile + database part AS).

## What people see

* When writing a post (web `CreatePost`, mobile `CreatePostScreen`): **Add poll** with an optional question, 2 to 4 options (up to 60 characters each) and how long it stays open
  (1 day, 3 days, 7 days or no end). A post can be only a poll: on the first screen choose "or write a text post or poll".
* On the post (all feeds, post page, saved posts, company page): the options are buttons. After you vote, every option shows its share of the votes.
  You can change your vote until the poll closes; tap your choice again to remove it. The author sees results at any time; everyone sees them once the poll has closed.
* A poll cannot be edited after posting (so votes always mean what they meant when they were cast). Remove the post to remove the poll.

## Rules (database: `supabase/manual/part_as_post_polls.sql`)

* Tables `post_polls`, `post_poll_options`, `post_poll_votes` have row-level security on and **no policies and no grants**: nothing can read or write them directly.
* `attach_post_poll(post, question, options[], closes_at)`: only the post's author, only within 10 minutes of creating the post, one poll per post, 2 to 4 different options, question up to 140 characters, closing time within 30 days.
* `get_polls(post_ids[])`: many posts in one request. A poll is returned only if the caller may see the post (it applies the audience rule from part AR itself, because it bypasses row-level security).
  Vote counts are `null` until the caller has voted, is the author, or the poll has closed.
* `vote_in_poll(option)`: one vote per person per poll (changing it replaces the old one); refused if the poll closed or the post is not visible to the caller.
* `remove_poll_vote(post)`.
* `posts.has_poll` tells the feeds which posts to ask about; `get_algorithmic_feed` returns it (recreated in part AS).

## Code

| | Where |
|---|---|
| Limits, validation, percentages, calls | `packages/core/src/poll.ts` (tests: `apps/web/src/tests/post/poll.test.ts`) |
| Web poll | `apps/web/src/components/feed/PostPoll.tsx` (shown by `PostCard` when `has_poll`) |
| Mobile poll | `apps/mobile/src/components/feed/PostPoll.tsx` (shown by `PostCard` when `hasPoll`) |
| Builder | the "Poll" block in both composers |

## Publishing

The post is created first, then the poll is attached. If the poll is refused, the post is deleted again and the author is told why, so a post is never published without the poll that was asked for.
A poll needs a connection (the web composer says so when offline instead of queuing the post).

## Not built

* Multiple-choice polls and polls with images; editing a poll; "who voted" lists (votes are anonymous to everyone but the database).
* The quick composer on the feed (`FeedTab`) has no poll button; use Create Post.
* Notifications when a poll closes.
