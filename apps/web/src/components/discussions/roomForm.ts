/** Pure validation for the "Create room" form. */
export const ROOM_TITLE_MAX = 80;
export const ROOM_DESCRIPTION_MAX = 500;

export function validateRoomForm(input: { title: string; description: string; categoryId?: string | null }):
  { ok: true; title: string; description: string } | { ok: false; message: string } {
  const title = (input.title || '').trim().replace(/\s+/g, ' ');
  const description = (input.description || '').trim();
  if (!title) return { ok: false, message: 'Please enter a room name.' };
  if (!input.categoryId) return { ok: false, message: 'Please choose a category.' };
  if (title.length > ROOM_TITLE_MAX) return { ok: false, message: `Room name can be at most ${ROOM_TITLE_MAX} characters.` };
  if (description.length > ROOM_DESCRIPTION_MAX) return { ok: false, message: `Description can be at most ${ROOM_DESCRIPTION_MAX} characters.` };
  return { ok: true, title, description };
}
