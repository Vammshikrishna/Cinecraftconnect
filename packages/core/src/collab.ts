/**
 * Collaborators on posts (credit other people). The database does the real checking
 * (supabase/manual/part_au_post_collaborators.sql). See docs/POST_EXTRAS.md.
 */

export const COLLAB_MAX = 5;

export interface CollabPerson {
  id: string;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
}

export interface PostCollabs {
  post_id: string;
  is_author: boolean;
  /** my own invitation on this post, if any */
  my_status: 'pending' | 'accepted' | 'declined' | null;
  accepted: CollabPerson[];
  /** only filled for the author */
  pending: CollabPerson[];
}

const fail = (error: any, fallback: string): never => {
  throw new Error(String(error?.message || fallback));
};

/** "with Sam and Ria", "with Sam, Ria and 2 others" */
export const collabLine = (people: CollabPerson[]): string => {
  const names = people.map((p) => p.full_name || (p.username ? `@${p.username}` : 'Someone'));
  if (names.length === 0) return '';
  if (names.length === 1) return `with ${names[0]}`;
  if (names.length === 2) return `with ${names[0]} and ${names[1]}`;
  return `with ${names[0]}, ${names[1]} and ${names.length - 2} other${names.length - 2 === 1 ? '' : 's'}`;
};

export const inviteCollaborators = async (client: any, postId: string, userIds: string[]): Promise<number> => {
  const ids = Array.from(new Set(userIds)).slice(0, COLLAB_MAX);
  if (ids.length === 0) return 0;
  const { data, error } = await client.rpc('invite_post_collaborators', { p_post: postId, p_users: ids });
  if (error) fail(error, 'Could not send the invitations.');
  return Number(data?.invited ?? 0);
};

export const fetchCollaborators = async (client: any, postIds: string[]): Promise<Record<string, PostCollabs>> => {
  const ids = Array.from(new Set(postIds)).slice(0, 50);
  if (ids.length === 0) return {};
  const { data, error } = await client.rpc('get_post_collaborators', { p_posts: ids });
  if (error) return {};
  const out: Record<string, PostCollabs> = {};
  for (const c of (Array.isArray(data) ? data : []) as PostCollabs[]) out[c.post_id] = c;
  return out;
};

export const respondToCollaboration = async (client: any, postId: string, accept: boolean): Promise<void> => {
  const { error } = await client.rpc('respond_post_collaboration', { p_post: postId, p_accept: accept });
  if (error) fail(error, 'Could not answer the invitation.');
};

export const removeCollaborator = async (client: any, postId: string, userId: string): Promise<void> => {
  const { error } = await client.rpc('remove_post_collaborator', { p_post: postId, p_user: userId });
  if (error) fail(error, 'Could not remove this collaborator.');
};
