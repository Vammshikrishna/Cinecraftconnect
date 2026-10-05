import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onSend: (note: string | undefined) => void | Promise<void>;
  defaultNote?: string;
}

/** "Add a note" before a connection request: a short, personal line makes the request far more likely to be accepted. */
export const ConnectNoteDialog = ({ open, onOpenChange, name, onSend, defaultNote }: Props) => {
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) setNote(defaultNote || '');
  }, [open, defaultNote]);

  const send = async (withNote: boolean) => {
    setSending(true);
    try {
      await onSend(withNote && note.trim() ? note.trim() : undefined);
      onOpenChange(false);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Connect with {name}</DialogTitle>
          <DialogDescription>Add a short note so they know why you are reaching out (optional).</DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            rows={4}
            placeholder="Hi, I loved your showreel and would like to stay in touch..."
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground text-right">{note.length}/200</p>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => send(false)} disabled={sending}>Send without a note</Button>
          <Button onClick={() => send(true)} disabled={sending || !note.trim()}>Send with note</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
