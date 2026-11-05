import { useCallback, useEffect, useRef } from 'react';
import { getSupabaseClient } from '@cinecraft/api';

/** Records one view per announcement (ignores authors, scheduled and platform items). Errors are ignored. */
export const recordAnnouncementView = (seen: Set<string>, item: any, userId: string | null) => {
  if (!item?.id || !userId || item.is_system || item.scheduled || item.author_id === userId || seen.has(item.id)) return;
  seen.add(item.id);
  try {
    Promise.resolve((getSupabaseClient() as any).rpc('record_announcement_view', { p_announcement_id: item.id })).then(() => {}, () => {});
  } catch {}
};

/** Stable FlatList viewability props: an announcement counts once it is 60% on screen. */
export const useAnnouncementViews = (userId: string | null) => {
  const seen = useRef<Set<string>>(new Set());
  const uid = useRef<string | null>(userId);
  useEffect(() => {
    uid.current = userId;
  }, [userId]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: { item: any; isViewable: boolean }[] }) => {
    for (const v of viewableItems) {
      if (v.isViewable) recordAnnouncementView(seen.current, v.item, uid.current);
    }
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  return { onViewableItemsChanged, viewabilityConfig, seen, uid };
};

/** For lists rendered without a FlatList: counts the item once it has been on screen for a moment. */
export const useRecordOnShow = (items: any[], userId: string | null) => {
  const seen = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!userId || items.length === 0) return;
    const t = setTimeout(() => items.forEach((a) => recordAnnouncementView(seen.current, a, userId)), 1500);
    return () => clearTimeout(t);
  }, [items, userId]);
};
