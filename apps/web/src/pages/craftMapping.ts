/**
 * Maps the craft pages (/craft/<slug>) to the values people actually store in `profiles.craft`
 * (role names such as "Director", "Editor", "Actor"; a profile can hold several, comma separated).
 */

export interface CraftDefinition {
  slug: string;
  label: string;
  /** stored craft values that belong to this page (compared case-insensitively, whole value) */
  roles: string[];
}

export const CRAFT_DEFINITIONS: CraftDefinition[] = [
  { slug: 'direction', label: 'Direction', roles: ['Director', 'First Assistant Director (1st AD)', 'Choreographer'] },
  { slug: 'cinematography', label: 'Cinematography', roles: ['Cinematographer', 'First Assistant Camera (1st AC)', 'Gaffer', 'Grip', 'Key Grip', 'Colorist'] },
  { slug: 'production-design', label: 'Production Design', roles: ['Production Designer', 'Art Director', 'Set Decorator', 'Prop Master', 'Concept Artist', 'Storyboard Artist'] },
  { slug: 'editing', label: 'Editing', roles: ['Editor', 'Colorist'] },
  { slug: 'sound-design', label: 'Sound Design', roles: ['Sound Designer', 'Sound Editor', 'Production Sound Mixer', 'Boom Operator', 'Foley Artist'] },
  { slug: 'screenwriting', label: 'Screenwriting', roles: ['Screenwriter', 'Writer'] },
  { slug: 'acting', label: 'Acting', roles: ['Actor', 'Actress'] },
  { slug: 'music-composition', label: 'Music Composition', roles: ['Composer'] },
];

export const craftSlug = (name: string): string =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const findCraft = (slug: string | undefined | null): CraftDefinition | undefined =>
  slug ? CRAFT_DEFINITIONS.find((c) => c.slug === craftSlug(slug)) : undefined;

/** Title for a slug that is not in the list ("lighting-design" -> "Lighting Design"). */
export const titleFromSlug = (slug: string | undefined | null): string =>
  (slug || 'Craft').replace(/-/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

/** Search terms for the database prefilter: PostgREST-safe (no commas, parentheses, quotes) and LIKE-escaped. */
export function craftSearchTerms(slug: string | undefined | null): string[] {
  const def = findCraft(slug);
  const raw = def ? [def.label, ...def.roles] : [titleFromSlug(slug)];
  const terms = raw
    .map((t) => t.replace(/\(.*?\)/g, ' ').replace(/[,()"'\\]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((t) => t.replace(/[%_]/g, (c) => '\\' + c));
  return Array.from(new Set(terms));
}

const norm = (v: string) => v.replace(/\s+/g, ' ').trim().toLowerCase();

/** Final check on the loaded profile: does one of its stored crafts belong to this page? */
export function profileMatchesCraft(storedCraft: string | null | undefined, slug: string | undefined | null): boolean {
  if (!storedCraft) return false;
  const values = storedCraft.split(/[,;|]/).map(norm).filter(Boolean);
  const def = findCraft(slug);
  if (!def) {
    const wanted = norm(titleFromSlug(slug));
    return values.some((v) => v.includes(wanted));
  }
  const accepted = new Set([...def.roles.map(norm), norm(def.label)]);
  return values.some((v) => accepted.has(v));
}
