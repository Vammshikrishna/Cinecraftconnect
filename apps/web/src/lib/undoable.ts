import { createElement } from 'react';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

/**
 * Do something now on screen, but only make it final after a few seconds, with an Undo button in between.
 * `apply` changes what the person sees (hide the row), `revert` puts it back, `commit` does the real, permanent thing
 * (the database call). Leaving the page or closing the tab inside the window means it is not committed: nothing is lost.
 */
export function undoable(opts: {
  title: string;
  description?: string;
  apply: () => void;
  revert: () => void;
  commit: () => void | Promise<void>;
  delayMs?: number;
}): void {
  const { title, description, apply, revert, commit, delayMs = 6000 } = opts;
  let undone = false;
  apply();
  const timer = setTimeout(() => {
    if (!undone) void commit();
  }, delayMs);
  toast({
    title,
    description,
    duration: delayMs,
    action: createElement(
      ToastAction,
      {
        altText: 'Undo',
        onClick: () => {
          undone = true;
          clearTimeout(timer);
          revert();
        },
      },
      'Undo',
    ),
  });
}
