/**
 * One type scale for every feed widget (People, Projects, Discussions, Marketplace, Vendors, Ratings, Announcements),
 * so they read the same and stay compact. Sizes are in px.
 */
export const WT = {
  /** widget heading, e.g. "Connect with Creators" */
  sectionTitle: 15,
  /** "Explore →" / "See all" */
  seeAll: 11,
  /** card titles: person, project, room, listing, vendor, title */
  cardTitle: 13,
  /** card body copy: descriptions, captions, overviews */
  body: 11,
  /** meta text: time, member counts */
  meta: 11,
  /** badges and pills: category, status, price, rating, tags */
  badge: 10,
  /** button labels */
  button: 12,
  /** card inner padding */
  cardPad: 12,
  /** smallest comfortable touch target */
  touch: 40,
} as const;
