/**
 * Who may manage a project space.
 *
 * Owner decision: ONLY the creator of the space, or the creator of its parent project, has the management powers
 * (decide join requests, space settings, purge chat, terminate, delete the project, remove members, change roles).
 * This mirrors the database function cj_can_manage_space(space, uid) in supabase/manual/part_cj_*.sql.
 * Team admins, leaders, members and staff observers never pass this check.
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
