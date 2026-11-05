/**
 * Pure decision helpers behind the route guards (kept free of React so they can be unit tested).
 */
import { safeRedirectPath } from '@/lib/auth/safeRedirect';

/** Paths that stay reachable while maintenance mode is on, so signed-out staff can still sign in. */
export function isMaintenanceExemptPath(pathname: string | undefined | null): boolean {
  if (!pathname) return false;
  const clean = pathname.toLowerCase().replace(/\/+$/, '');
  return clean === '/auth';
}

/** Rebuilds "/path?query#hash" from the location ProtectedRoute stored in `state.from`, as a safe in-app path. */
export function pathFromLocationState(from: unknown): string | null {
  if (!from || typeof from !== 'object') return null;
  const f = from as { pathname?: unknown; search?: unknown; hash?: unknown };
  if (typeof f.pathname !== 'string') return null;
  const search = typeof f.search === 'string' ? f.search : '';
  const hash = typeof f.hash === 'string' ? f.hash : '';
  return safeRedirectPath(`${f.pathname}${search}${hash}`);
}

/** Where to go after sign-in: explicit ?redirect= first, then the page the user was bounced from. */
export function resolvePostLoginTarget(search: string, state: unknown): string | null {
  const params = new URLSearchParams(search);
  return safeRedirectPath(params.get('redirect')) || pathFromLocationState((state as { from?: unknown } | null)?.from);
}

/** A fan is blocked from a route that needs a creator or studio account. */
export function isFanBlocked(accountType: string | null | undefined): boolean {
  return accountType === 'fan';
}

export type SubmitPitchAccess =
  | { allowed: true }
  | { allowed: false; reason: 'fan' | 'own_call' | 'closed' | 'not_found' };

/** Who may open the "submit to a casting call" page. */
export function decideSubmitPitchAccess(input: {
  accountType: string | null | undefined;
  userId: string | null | undefined;
  pitch: { creator_id?: string | null; status?: string | null } | null | undefined;
  /** Editing an existing submission is still allowed after the call closes. */
  editing?: boolean;
}): SubmitPitchAccess {
  if (isFanBlocked(input.accountType)) return { allowed: false, reason: 'fan' };
  if (!input.pitch) return { allowed: false, reason: 'not_found' };
  if (input.userId && input.pitch.creator_id && input.pitch.creator_id === input.userId) {
    return { allowed: false, reason: 'own_call' };
  }
  const status = (input.pitch.status || 'open').toLowerCase();
  if (!input.editing && status !== 'open' && status !== 'active') return { allowed: false, reason: 'closed' };
  return { allowed: true };
}

/** `/project-space/:projectId` is an old alias of `/projects/:projectId/space`. */
export function projectSpaceAliasTarget(projectId: string | undefined | null): string {
  const id = (projectId || '').trim();
  return id ? `/projects/${encodeURIComponent(id)}/space` : '/projects';
}
