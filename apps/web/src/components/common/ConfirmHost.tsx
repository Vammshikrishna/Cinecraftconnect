import { useEffect, useState } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { subscribeConfirm, type ConfirmRequest } from '@/lib/confirmDialog';

/** Renders the in-app confirmation dialog for confirmDialog(). Mounted once in App. */
export const ConfirmHost = () => {
  const [req, setReq] = useState<ConfirmRequest | null>(null);
  useEffect(() => subscribeConfirm(setReq), []);

  const finish = (value: boolean) => {
    req?.resolve(value);
    setReq(null);
  };

  return (
    <AlertDialog open={!!req} onOpenChange={(open) => { if (!open) finish(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{req?.title}</AlertDialogTitle>
          <AlertDialogDescription>{req?.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => finish(false)}>{req?.cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => finish(true)}
            className={req?.destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : undefined}
          >
            {req?.confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
