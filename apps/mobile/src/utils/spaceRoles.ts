/**
 * Who may manage a project space.
 *
 * Owner decision: ONLY the creator of the space, or the creator of its parent project, has the management powers
 * (decide join requests, space settings, purge chat, terminate, delete the project).
 * This mirrors the database function cj_can_manage_space(space, uid) in supabase/manual/part_cj_*.sql.
 * Team admins, leaders, members and staff observers never pass this check.
 *
 * Exception (SQL part FT): changing crew roles and removing normal members is also allowed for team members whose
 * role is Admin (an admin cannot touch another admin or the owner). That rule lives in ProjectSpaceScreen, not here.
 */
export type CreatorRef = { creator_id?: string | null } | null | undefined;

export function isSpaceCreator(
  userId: string | null | undefined,
  space?: CreatorRef,
  project?: CreatorRef,
): boolean {
  if (!userId) return false;
  return space?.creator_id === userId || project?.creator_id === userId;
}
