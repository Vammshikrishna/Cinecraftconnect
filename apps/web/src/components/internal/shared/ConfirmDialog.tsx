import type { ReactNode } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

/** A plain "are you sure" step for staff actions that cannot be undone. */
const ConfirmDialog = ({ open, title, description, confirmLabel, destructive, onCancel, onConfirm }: ConfirmDialogProps) => (
  <AlertDialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        {description && <AlertDialogDescription asChild><div>{description}</div></AlertDialogDescription>}
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
        <AlertDialogAction
          className={destructive ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : undefined}
          onClick={() => { void onConfirm(); }}
        >
          {confirmLabel}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export default ConfirmDialog;
