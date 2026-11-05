import { showToast } from '../contexts/ToastContext';

/**
 * Do something now on screen, but only make it final after a few seconds, with an Undo button in between
 * (same idea as web lib/undoable.ts). `apply` changes what the person sees (hide the row), `revert` puts it back,
 * `commit` does the real, permanent thing (the database call). Leaving the screen inside the window means it is
 * not committed: nothing is lost.
 */
export function undoable(opts: {
  title: string;
  message?: string;
  apply: () => void;
  revert: () => void;
  commit: () => void | Promise<void>;
  delayMs?: number;
}): void {
  const { title, message, apply, revert, commit, delayMs = 6000 } = opts;
  let undone = false;
  apply();
  const timer = setTimeout(() => {
    if (!undone) {
      try {
        void Promise.resolve(commit()).catch(() => {});
      } catch {}
    }
  }, delayMs);
  showToast({
    title,
    message,
    type: 'info',
    duration: delayMs,
    action: {
      label: 'Undo',
      onPress: () => {
        undone = true;
        clearTimeout(timer);
        revert();
      },
    },
  });
}
