export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive: boolean;
  resolve: (ok: boolean) => void;
}

type Listener = (req: ConfirmRequest | null) => void;
let listener: Listener | null = null;

export const subscribeConfirm = (fn: Listener) => {
  listener = fn;
  return () => { if (listener === fn) listener = null; };
};

/**
 * In-app replacement for window.confirm: same one-line call, but a proper dialog with clear buttons that
 * works in the mobile browser and the app shell. Resolves true when the person confirms.
 */
export const confirmDialog = (
  message: string,
  opts: { title?: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean } = {},
): Promise<boolean> => {
  const destructive = opts.destructive ?? /delete|remove|permanently|cannot be undone|revoke|withdraw|end this|block/i.test(message);
  if (!listener) return Promise.resolve(window.confirm(message)); // host not mounted yet: fall back to the native dialog
  return new Promise((resolve) => {
    listener!({
      title: opts.title ?? (destructive ? 'Are you sure?' : 'Please confirm'),
      message,
      confirmLabel: opts.confirmLabel ?? (destructive ? 'Yes, continue' : 'Confirm'),
      cancelLabel: opts.cancelLabel ?? 'Cancel',
      destructive,
      resolve,
    });
  });
};
