import { useEffect, useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { REJECTION_REASONS } from '@cinecraft/core';

interface Props {
  open: boolean;
  /** Who is being rejected (shown in the title). */
  name: string;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

/** Asks for a short, candidate-facing reason before rejecting. Shared by the board, the list and the drawer. */
export const RejectDialog = ({ open, name, onCancel, onConfirm }: Props) => {
  const [reason, setReason] = useState<string>(REJECTION_REASONS[0]);
  const [other, setOther] = useState('');

  useEffect(() => {
    if (open) {
      setReason(REJECTION_REASONS[0]);
      setOther('');
    }
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reject {name}?</AlertDialogTitle>
          <AlertDialogDescription>They will be notified. A short reason helps candidates and is shown to them.</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3">
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{REJECTION_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
          {reason === 'Other' && <Input placeholder="Reason (optional)" value={other} onChange={(e) => setOther(e.target.value)} maxLength={200} />}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(reason === 'Other' ? other : reason)} className="bg-red-600 hover:bg-red-700">
            Reject candidate
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
