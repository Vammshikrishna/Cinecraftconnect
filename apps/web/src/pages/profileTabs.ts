/** Tabs of the own-profile page, by account kind. */
export const CREATOR_PROFILE_TABS = ['posts', 'portfolio', 'projects', 'announcements', 'analytics', 'saved', 'credits', 'skills', 'experience', 'awards', 'recommendations'];
export const FAN_PROFILE_TABS = ['saved'];

/** An unknown ?tab= value, or a tab the account kind does not have, falls back to the default tab. */
export function resolveProfileTab(requested: string | null | undefined, isFan: boolean): string {
  const allowed = isFan ? FAN_PROFILE_TABS : CREATOR_PROFILE_TABS;
  if (requested && allowed.includes(requested)) return requested;
  return isFan ? 'saved' : 'posts';
}
