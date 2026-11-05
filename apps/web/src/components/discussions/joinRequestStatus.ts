/** Pure helpers for private-room join requests (rows of `room_join_requests`). */

export type JoinRequestUiState = 'none' | 'pending';

interface JoinRequestRow {
  status?: string | null;
  created_at?: string | null;
}

/**
 * Only a request that is actually pending shows "Request Pending". A rejected / declined / old row
 * leaves the user free to ask again. With several rows the newest one decides.
 */
export function joinRequestUiState(rows: JoinRequestRow[] | JoinRequestRow | null | undefined): JoinRequestUiState {
  const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
  if (list.length === 0) return 'none';
  const sorted = [...list].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  return (sorted[0].status || 'pending').toLowerCase() === 'pending' ? 'pending' : 'none';
}
