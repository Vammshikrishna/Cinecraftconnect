# Feed roadmap: new feature ideas

Reference for planning. Written after the feed fixes and features in [FEED.md](FEED.md) (parts AY, AZ, BA) were built. Effort and value are judgement calls, not measured: nothing here is based on usage numbers.

Effort: **Small** = a few days or less, **Medium** = about a week or two, **Large** = several weeks or touches many screens.

## Recommended order

1. **Opportunity cards (#3)** and **Collaborator call (#4)**: they use data the app already has and are the most on-mission (people come here to find work and teammates).
2. **Reactions (#2)** and **Repost / quote (#1)**: they feed the ranking and spread good work.
3. **Saved collections (#6)**, **Content labels (#10)**, **Trending in your craft (#14)**: cheap wins that make the feed feel finished.
4. **Reel mode (#7)** and **Stories (#17)**: only once you know video is where people spend time.

## High value, fits what the app already has

| # | Feature | What it is | Why it fits | Effort |
|---|---|---|---|---|
| 1 | Repost and quote | Share someone's post to your followers, with an optional comment | The feed cannot amplify other people's work today | Large (post creation, counts, notifications, delete rules) |
| 2 | Reactions beyond like | A small set made for film: Great shot, Fire, Bravo, Idea | Likes are the only signal and the ranking leans on them | Medium |
| 3 | Opportunity cards | Jobs, pitch calls, casting and open project roles as feed cards matched to your craft, with Apply / Pitch in one tap | Jobs, pitch calls and projects exist, but the feed only shows announcements and projects | Medium |
| 4 | Collaborator call post | A post type such as "Looking for a DOP in Hyderabad, 3-day shoot" with craft, location, dates, budget and a Respond button | Turns the feed into a hiring and teaming surface | Medium |
| 5 | Work-in-progress posts | Attach a project, role and stage (pre-production, shooting, post, released) to a post and show it on the project page | Ties posts to credits and portfolios | Medium |
| 6 | Saved collections | Group bookmarks into named folders ("Lighting references", "Locations") | Bookmarks exist; a flat list does not scale | Small to medium |
| 7 | Reel / video-first feed | Vertical short-video mode with swipe, autoplay and sound control | Filmmakers share video; today it is just another post | Large |

## Quality and trust

| # | Feature | What it is | Effort |
|---|---|---|---|
| 8 | Credit tags with consent | Tag people with their role ("DOP: Ravi"); they accept before it shows. Builds on the collaborator accept flow | Medium |
| 9 | Verified work and credits | A "credited on X" badge once a project owner confirms it | Medium (depends on project credits) |
| 10 | Content labels | Spoiler, behind-the-scenes, work in progress, NSFW; readers can filter by label | Small to medium |
| 11 | Translate post | One-tap translation for a multilingual audience (Hindi, Telugu, Tamil, English) | Small if a translation service is used |
| 12 | Feed quality controls | "Show me fewer posts like this" per craft or topic, and "Less from this author" that is not a full mute | Small |

## Engagement and discovery

| # | Feature | What it is | Effort |
|---|---|---|---|
| 13 | Topics and hashtag pages | Follow a hashtag or craft topic and see it in a tab | Medium |
| 14 | Trending in your craft | A weekly strip of the most-liked work from people in your craft | Small (builds on the ranking) |
| 15 | Challenges | A daily or weekly prompt ("one-minute short on loneliness") with a themed feed | Medium |
| 16 | Events and screenings | Event cards with RSVP: festivals, workshops, meetups | Medium to large |
| 17 | Stories (24-hour) | Short-lived updates at the top of the feed | Large |
| 18 | Live and audio rooms in the feed | Show live audio spaces as cards (spaces already exist) | Small to medium |
| 19 | Polls and Q&A in the feed header | Ask the network a quick question (polls already exist) | Small |

## For creators and studios

| # | Feature | What it is | Effort |
|---|---|---|---|
| 20 | Page insights | Reach, followers and best posting times for company pages | Medium |
| 21 | Scheduling queue | See and reorder scheduled posts, with a best-time suggestion | Small |
| 22 | Pinned and featured posts | Pin a post to a profile or page, and let pages feature a post in followers' feeds | Small to medium |
| 23 | Sponsored or promoted slots | Studios pay to reach a craft, clearly labelled | Large, and a business decision |
| 24 | Cross-post | Publish to a page and a profile at once | Small |

## What is already built (do not rebuild)

Ranked feed with stable paging, For You / Network (Following) tabs and craft chips, not interested, mute author, muted words and topics, hidden posts list, "why am I seeing this", seen-post demotion and the caught-up marker, post insights, activity-ranked widgets with hide and customize, new-posts count, scroll restore (web). Details and the SQL parts are in [FEED.md](FEED.md).

Known gaps from that work that are separate from the ideas above: copy link on mobile (no clipboard library), dismissing single cards in the mobile widgets, vendor and marketplace widgets on web still reading every column, company page impressions.

## Open questions before starting

- How many people post video compared with text and images? This decides whether #7 and #17 are worth it.
- How are project credits and company pages stored? #9 and #20 depend on it.
- Is paid promotion (#23) something the business wants? It is a product and legal decision before it is an engineering one.
- For #3 and #4: should a response open a chat, an application form, or a pitch? Each reuses a different existing flow.

## How a feature is usually delivered here

Analysis, then a numbered SQL part in `supabase/manual/` with an entry in `DEPLOY_CHECKLIST.md`, a shared helper in `packages/core`, web and mobile built to match, tests for the helpers, and a doc in `/docs`.
