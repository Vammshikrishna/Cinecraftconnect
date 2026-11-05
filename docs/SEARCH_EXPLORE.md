# Search and Explore

Status: rebuilt 2026-10-06. Web `/search` and mobile `Search` screen share one search layer.

## How it works

* **One shared module:** `packages/core/src/search.ts`. Both apps call `runSearch({ client, query, category, isFan, meId, sort, verifiedOnly, limit, offset })`.
  It knows what is searched, cleans the query, ranks results, skips people the user blocked, and reports failed types.
* **Search vs Explore:** with fewer than 2 characters (`isSearchable`) the same function returns Explore (recent items of every type, mixed in turn by
  `interleaveSections`: a stable order, not a random shuffle).
* **Types searched:** projects, people (username, name, craft, skills), discussions, posts (text, or tags when the query starts with `#`), jobs (active, not drafts),
  pitch calls (published), announcements, vendors, marketplace listings, company pages. Fans only get people, discussions, posts and announcements.
* **Query cleaning (`parseQuery`):** `%`, `_` and `\` match literally; characters that break PostgREST `or(...)` filters are removed; `#tag` is a tag search;
  `@name` is a username search. Vendors and marketplace use the existing RPCs (`search_vendors`, `search_marketplace_listings`, which also hide inactive listings).
* **Ranking (`scoreItem`):** exact, then starts-with, then a word starts with it, then contains; accents and case ignored; verified accounts get a small lift.
  Ranking is applied per fetched page.
* **Paging:** "All" shows 6 per type with a "See all" link (web) or a mixed list (mobile); a single category loads 24 at a time (`Load more` / infinite scroll).
* **Errors:** a type that fails is listed in `failed`, and the screen shows "Some results could not be loaded" with **Try again**, instead of looking like "no results".

## Behaviour that was fixed

Dead `/explore` links (now `/search?category=projects`, and `/explore` redirects), vendors missing on mobile (queried a column that does not exist),
two searches per keystroke, a history entry per keystroke, skill searches that built huge URLs, hashtag taps (now tag-aware on web; mobile screens now
actually read the `query` param they were already sending), blocked users in results, wildcard characters, inactive marketplace listings on mobile,
the random reshuffle, the double load for fans, and 6–7px text on the cards.

## Features added

Recent searches (per user, local), typeahead suggestions (names that start with what was typed), saved searches (SQL part AP; hidden until it is run),
clear button, Escape to clear, `/` to focus (web), sort (relevant/newest), verified-only, craft filter on People, Gear/Locations on Marketplace,
Jobs and Pitch calls as searchable types with their own cards, grouped results with "See all", per-category paging, empty and error states with recovery,
accessible labels (`aria-pressed`, live result count).

## Where things are

| | Web | Mobile |
|---|---|---|
| Screen | `apps/web/src/pages/SearchPage.tsx` | `apps/mobile/src/screens/search/SearchScreen.tsx` |
| Cards | `components/search/ExploreCard.tsx`, `ExploreGrid.tsx` | `components/search/ExploreCard.tsx` |
| Shared | `packages/core/src/search.ts` | same |
| Tests | `apps/web/src/tests/search/search.test.ts` | (shared logic is tested on web) |

SQL: `supabase/manual/part_ao_search_indexes.sql` (optional trigram indexes), `part_ap_saved_searches.sql` (saved searches).

## Not built (ideas, in order of value)

1. Trending searches, and alerts for saved searches.
2. More filters: location and availability (people); genre and status (projects); price range (marketplace); job type and work mode (jobs).
3. A "hide me from search" privacy setting (a product decision: name, bio and craft are always searchable today).
4. Server-side ranking and typo tolerance with `pg_trgm` similarity in a single RPC.
5. Confirm whether vendor phone and email should be visible to every signed-in user (the vendor RPC returns them).

## Notes for maintainers

* The old unused web files (`pages/Explore.tsx`, `AdvancedSearch`, `SavedSearches`, `SearchResults`, `EnhancedSearch`, `GlobalSearch`, `navbar/SearchDialog`) were removed.
* Adding a searchable type: add it to `SearchItemType`, `fetchType`, `normalize`, the category list, and a card in both apps' `ExploreCard`.
