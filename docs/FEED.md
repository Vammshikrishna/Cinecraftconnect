# Feed

## Part AY (part_ay_feed_fixes.sql): one ranked feed for web and mobile

`get_algorithmic_feed(current_user_id, limit_val, created_at_cursor, p_offset, p_as_of, p_tab, p_craft)`

| Problem | Fix |
|---|---|
| Web paged by `created_at` while sorting by score, so new high-scoring posts vanished from scrolling | Pages are `offset` based and every page is ranked "as of" the moment the first page was (`p_as_of`, returned as `as_of` on each row). Pages never skip or repeat |
| Mobile read the `posts` table newest first, 20 posts, no paging | Mobile uses the same function, 15 per page, with `onEndReached` |
| Following tab showed every post; craft tabs filtered 20 posts on the phone | `p_tab = 'following'` (people you follow or are connected to, followed company pages, your own posts) and `p_craft` are applied in the database |
| Blocked people's posts showed up | Blocks are removed both ways inside the function |
| The function scored the whole table | Only the last 120 days are ranked |
| Your own posts got the same big boost as people you follow | Own posts +40, followed / connected / followed pages +100 |
| One author could fill the feed | An author's 2nd, 3rd... post is worth 35% less each |
| Likes loaded for the whole account (web stopped at 1000, mobile at 100) | `get_my_post_flags(post ids)`: liked and saved flags for just the posts on screen |

If the database part has not been run yet, both apps fall back to the old newest-first query, so nothing breaks while you deploy.

## Client fixes

- **New posts pill** (web and mobile): only for someone else's public post that is already live. Mobile no longer pushes other people's posts into the list by itself; your own new post still goes to the top.
- **Connect with Creators** (web and mobile): uses the same `suggest_people` as the Network page: not blocked, not fans, not already connected, ordered by mutual connections / shared craft / location, with the real reason. "Not interested" is remembered on the account.
- **Dismissed widget cards** on web are remembered on the device for 14 days.
- **Widget titles** say what the lists are: Latest Projects, New Discussions, New in Marketplace, New Vendors, New Releases (web) and the matching mobile titles.

## Part AZ (part_az_feed_features.sql): feed features

| Feature | Web | Mobile | How it works |
|---|---|---|---|
| Following tab and craft chips | Feed header | Already there (now server-side) | `p_tab = 'following'`, `p_craft`. Widgets only show on For You |
| Not interested | Post menu | Post menu | `hidden_posts`; the post never comes back |
| Mute an author | Post menu; Settings -> Blocked accounts -> Muted accounts | same | `muted_authors`; their posts leave your feed, nothing is shown to them |
| Block from the post menu | Post menu | Post menu | Same block list as messages |
| Seen posts rank lower | automatic | automatic | `post_impressions` (written only by `log_post_impressions`): a post counts as seen after 60% of it was on screen for a second. Only posts seen *before* the current feed session started are demoted (x0.25), so the order never shifts between pages |
| Post insights | Post menu (your posts) | Post menu (your posts) | `get_post_insights`: people reached, views, likes, comments, shares, saves. Only the author can read it |
| Copy link | Post menu | use Share | `postLink()` |

## Part BA (part_ba_feed_personalization.sql): personalisation and complete widgets

| Feature | Web | Mobile | How it works |
|---|---|---|---|
| Interests in the ranking | automatic | automatic | Same craft as you +15; authors whose posts you liked in the last 30 days up to +30; topics (tags) of posts you liked up to +15. All added before the time decay |
| Why am I seeing this? | Post menu | Post menu | The database returns a `reason` with every post: you follow them, they are in your network, you follow the page, because you liked posts about #tag, you often like their posts, same craft, popular right now, suggested |
| Mute a topic | Post menu (the post's first 2 tags) | same | Adds the tag to **muted words** |
| Muted words | Settings -> Blocked accounts -> Muted words | same | A word, phrase or hashtag (2-40 characters, up to 50). Posts whose text contains it, or that carry it as a tag, never show. Your own posts are never muted |
| Hidden posts | Settings -> Blocked accounts -> Hidden posts | same | The posts you marked "not interested", with **Show again** |
| Caught-up marker | in the feed | in the feed | "You're all caught up" appears above the first post you had already seen before this session, once there were new posts above it. For You only |
| New posts count | pill | pill | "3 new posts" instead of "New posts available" |
| Scroll position | restored (per tab and craft, for the browser session) | the screen stays mounted in the tab bar | |
| Real widget data | Trending Projects, Active Discussions, Popular in Marketplace, Trending Vendors | same | `get_trending_ids`: projects by applications (14 days) and project chat (7 days); rooms by messages and new members (7 days); vendors by reviews (90 days, better rated first); listings by wishlists (14 days) and bookings (30 days). It returns ids only and runs with the caller's permissions, so what you may see does not change. When nothing has happened lately the newest items show |
| One layout on both apps | after the 3rd post, then every 5th | same | One order (announcements, people, projects, discussions, marketplace, vendors, ratings). On web the sections keep coming round with the next items |
| Hide a section | "Hide this section" under each widget | same | Remembered on the device |
| Customize | Customize button in the tab row | same | Switch sections on or off, any time |

## Not done yet

- **Repost / quote and reactions beyond like.** These change how posts are created, counted and notified, so they are a separate piece of work.
- Copy link on mobile (the app has no clipboard library; use Share).
- Dismissing single cards in the mobile widgets (whole sections can be hidden instead).
- Vendor / marketplace widgets on web still read every column (your earlier decision about vendor contact details).
- Pages (company pages) have no impressions or insights yet.
- Ads or sponsored slots.
