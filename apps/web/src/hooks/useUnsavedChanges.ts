import { useCallback, useEffect, useRef } from 'react';
import { confirmDialog } from '@/lib/confirmDialog';

/**
 * Warns before typed-in work is thrown away.
 *
 * It does not need to know how a form keeps its data: it notices when the person types or changes a field inside a
 * dialog (or anywhere on the page, for a full-page form). A search box or a password field does not count.
 * A successful save closes the form through its own code path, so it never triggers the warning.
 */

const TRACKED = 'input:not([type=search]):not([type=password]):not([type=hidden]), textarea, select';

const useDirtyTracker = (active: boolean, dialogOnly: boolean) => {
  const dirty = useRef(false);

  useEffect(() => {
    dirty.current = false;
    if (!active) return;
    const mark = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (!t || !t.matches?.(TRACKED)) return;
      if (dialogOnly && !t.closest('[role="dialog"]')) return;
      dirty.current = true;
    };
    const leave = (e: BeforeUnloadEvent) => {
      if (!dirty.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    document.addEventListener('input', mark, true);
    document.addEventListener('change', mark, true);
    window.addEventListener('beforeunload', leave);
    return () => {
      document.removeEventListener('input', mark, true);
      document.removeEventListener('change', mark, true);
      window.removeEventListener('beforeunload', leave);
    };
  }, [active, dialogOnly]);

  return dirty;
};

/** For a full-page form: the browser warns on reload or closing the tab while there are unsaved changes. */
export const useUnsavedChangesWatcher = (enabled = true) => {
  useDirtyTracker(enabled, false);
};

/**
 * For a form in a dialog: use the returned function as the dialog's onOpenChange.
 * Closing with unsaved changes (Esc, clicking outside, the X) asks first; opening and saving are unaffected.
 */
export const useDiscardGuard = (open: boolean, onOpenChange: (open: boolean) => void) => {
  const dirty = useDirtyTracker(open, true);
  return useCallback(
    async (next: boolean) => {
      if (!next && dirty.current) {
        const leave = await confirmDialog('You have changes that are not saved. If you close this, they are lost.', {
          title: 'Discard your changes?',
          confirmLabel: 'Discard changes',
          cancelLabel: 'Keep editing',
          destructive: true,
        });
        if (!leave) return;
      }
      onOpenChange(next);
    },
    [dirty, onOpenChange],
  );
};
