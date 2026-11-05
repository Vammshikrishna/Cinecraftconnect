/**
 * ONE layout rule for the feed, used by web and mobile so both show the same thing.
 *
 * - After every `every` posts (3) exactly one widget slot is added. Never before the first post, and
 *   after the last post only when more posts will load (`hasMore`).
 * - Slot k (1, 2, 3 ...) sits after post number k * every. Its widget is decided only by k:
 *   enabled[(k - 1) mod enabled.length]. So adding more posts never moves or repeats earlier slots.
 * - `enabled` is the list of widgets the person switched on (and may see). It is kept in the fixed order of FEED_WIDGETS.
 * - If the chosen widget has no data, the next enabled type is tried for that slot; if none has data, no slot is shown.
 * - `pass` says how many times that type has come round before (floor((k - 1) / enabled.length)), so each
 *   appearance can show the next few items. It also depends only on k.
 */
import { FEED_WIDGETS, type FeedWidgetId } from './feed';

export const FEED_WIDGET_EVERY_POSTS = 3;

export type FeedLayoutItem<P> =
  | { kind: 'post'; key: string; post: P; index: number }
  | { kind: 'widget'; key: string; slot: number; widget: FeedWidgetId; pass: number };

export interface FeedLayoutOptions<P> {
  /** Widgets that are switched on (and allowed for this account). Any order; the fixed order is applied here. */
  enabled: readonly FeedWidgetId[];
  /** True when the widget has something to show. Default: everything has data. */
  hasData?: (widget: FeedWidgetId) => boolean;
  /** True when more posts will load after the last one in the list. */
  hasMore?: boolean;
  /** Posts between widgets. Default 3. */
  every?: number;
  /** Stable key of a post. Default: post.id. */
  postKey?: (post: P, index: number) => string;
}

/** The enabled widgets in the fixed order. */
export function orderedEnabledWidgets(enabled: readonly FeedWidgetId[]): FeedWidgetId[] {
  const on = new Set(enabled);
  return FEED_WIDGETS.map((w) => w.id).filter((id) => on.has(id));
}

/** Which widget (and which pass) slot k shows, or null when none of the enabled ones has data. */
export function widgetForSlot(
  slot: number,
  enabled: readonly FeedWidgetId[],
  hasData: (widget: FeedWidgetId) => boolean = () => true,
): { widget: FeedWidgetId; pass: number } | null {
  const list = orderedEnabledWidgets(enabled);
  const n = list.length;
  if (n === 0 || slot < 1) return null;
  const start = (slot - 1) % n;
  const pass = Math.floor((slot - 1) / n);
  for (let i = 0; i < n; i++) {
    const widget = list[(start + i) % n];
    if (hasData(widget)) return { widget, pass };
  }
  return null;
}

export function buildFeedLayout<P extends { id?: string | null }>(
  posts: readonly P[],
  options: FeedLayoutOptions<P>,
): FeedLayoutItem<P>[] {
  const every = Math.max(1, Math.floor(options.every ?? FEED_WIDGET_EVERY_POSTS));
  const enabled = orderedEnabledWidgets(options.enabled);
  const out: FeedLayoutItem<P>[] = [];
  posts.forEach((post, index) => {
    const key = options.postKey ? options.postKey(post, index) : `post-${post.id ?? index}`;
    out.push({ kind: 'post', key, post, index });
    const count = index + 1;
    if (enabled.length === 0 || count % every !== 0) return;
    if (count === posts.length && !options.hasMore) return; // nothing after the very last post
    const slot = count / every;
    const pick = widgetForSlot(slot, enabled, options.hasData);
    if (pick) out.push({ kind: 'widget', key: `widget-${slot}-${pick.widget}`, slot, widget: pick.widget, pass: pick.pass });
  });
  return out;
}
