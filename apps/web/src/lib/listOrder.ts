/** Moving one title inside a film list. Pure, so the screen and the tests share it. */

/** Returns a new array with the item at `from` moved to `to` (both clamped); the input is never changed. */
export const moveItem = <T,>(items: readonly T[], from: number, to: number): T[] => {
  const next = [...items];
  if (from < 0 || from >= next.length) return next;
  const target = Math.min(Math.max(to, 0), next.length - 1);
  if (target === from) return next;
  const [picked] = next.splice(from, 1);
  next.splice(target, 0, picked);
  return next;
};

/** The ids in their new order, for the reorder call. */
export const orderedIds = (items: readonly { id: string }[]): string[] => items.map((i) => i.id);
