import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SHORTCUTS } from './queueTools';

/** The cheat sheet opened with "?". */
const ShortcutsDialog = ({ open, onClose }: { open: boolean; onClose: () => void }) => (
  <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Keyboard shortcuts</DialogTitle>
        <DialogDescription>Work on the queue without the mouse. They are off while you type in a box, and with Ctrl, Cmd or Alt held.</DialogDescription>
      </DialogHeader>
      <dl className="space-y-2">
        {SHORTCUTS.map((s) => (
          <div key={s.keys} className="flex items-center justify-between gap-4 text-xs">
            <dt><kbd className="rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-[12px] font-bold">{s.keys}</kbd></dt>
            <dd className="text-muted-foreground text-right">{s.what}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[12px] text-muted-foreground">In Review mode: 1 to 9 run a quick action, N skips.</p>
    </DialogContent>
  </Dialog>
);

export default ShortcutsDialog;
