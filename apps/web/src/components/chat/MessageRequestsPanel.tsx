import { useEffect, useState } from 'react';
import { ArrowLeft, ChevronRight, MoreVertical, Trash2, Clock3, EyeOff } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { respondToMessageRequest, type RequestAction } from '@/hooks/useMessageRequests';
import { decryptDirectMessage } from '@/lib/e2ee';
import { getDisplayMessage } from '@/lib/chat-utils';
import {
  requestsEntrySummary, mutualText, daysLeftInDeletedWindow, HIDDEN_REQUESTS_EXPLAINER, REQUEST_DELETED_WINDOW_DAYS,
  type MessageRequestRow,
} from '@/lib/messageRequests';

const initial = (name: string | null | undefined) => Array.from((name || '').trim())[0] || '?';

const shortAgo = (iso: string | null | undefined): string => {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return '';
  const m = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  if (m < 60 * 24) return `${Math.floor(m / 60)}h`;
  if (m < 60 * 24 * 7) return `${Math.floor(m / (60 * 24))}d`;
  return `${Math.floor(m / (60 * 24 * 7))}w`;
};

/** The "Message requests" row at the top of the inbox (Instagram style): overlapping avatars, count, chevron, unread dot. */
export const MessageRequestsEntry = ({ main, hiddenCount, onOpen }: { main: MessageRequestRow[]; hiddenCount: number; onOpen: () => void }) => {
  const s = requestsEntrySummary(main);
  if (s.count === 0 && hiddenCount === 0) return null;
  return (
    <button
      onClick={onOpen}
      data-testid="message-requests-entry"
      className="w-full flex items-center gap-4 p-4 rounded-[2rem] mb-1 text-left hover:bg-chat-hover-conv-bg dark:hover:bg-muted/40 transition-colors"
    >
      <div className="relative h-12 w-14 shrink-0" aria-hidden="true">
        {s.avatars.length === 0 ? (
          <div className="h-12 w-12 rounded-full bg-primary/10 text-primary grid place-items-center"><EyeOff size={20} /></div>
        ) : s.avatars.map((a, i) => (
          <Avatar key={a.id} className="absolute top-1/2 -translate-y-1/2 h-9 w-9 border-2 border-background" style={{ left: i * 14, zIndex: 3 - i }}>
            <AvatarImage src={a.url || undefined} />
            <AvatarFallback className="text-xs">{initial(a.name)}</AvatarFallback>
          </Avatar>
        ))}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold">Message requests</p>
        <p className="text-xs text-muted-foreground">
          {s.count > 0 ? s.label : `Hidden requests (${hiddenCount})`}
        </p>
      </div>
      {s.unread && <span role="img" aria-label="Unread requests" className="h-2.5 w-2.5 rounded-full bg-chat-brand-action shrink-0" data-testid="requests-unread-dot" />}
      <ChevronRight size={18} className="text-muted-foreground shrink-0" aria-hidden="true" />
    </button>
  );
};

/** One request in a list: avatar, name, first-message preview, time, mutual hint, and the quick buttons. */
const RequestRow = ({ r, privateKey, active, mode, busy, onOpen, onAct }: {
  r: MessageRequestRow; privateKey: CryptoKey | null | undefined; active: boolean; mode: 'main' | 'hidden' | 'deleted'; busy: boolean;
  onOpen: () => void; onAct: (a: RequestAction) => void;
}) => {
  const [preview, setPreview] = useState('');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const raw = r.first_message || '';
      let text = raw;
      if (raw && (raw.includes('__e2ee') || raw.startsWith('{'))) {
        if (privateKey) { try { text = await decryptDirectMessage(raw, privateKey as any); } catch { text = '🔒 Encrypted Message'; } }
        else text = '🔒 Encrypted Message';
      }
      if (!cancelled) setPreview(getDisplayMessage(text));
    })();
    return () => { cancelled = true; };
  }, [r.first_message, privateKey]);

  const unread = (r.unread_count || 0) > 0;
  const secondary = mode === 'deleted'
    ? `Deleted · ${daysLeftInDeletedWindow(r.deleted_at)} day${daysLeftInDeletedWindow(r.deleted_at) === 1 ? '' : 's'} left`
    : mutualText(r.mutual_count);
  return (
    <div className={cn('rounded-[2rem] mb-1 transition-colors', active ? 'bg-chat-active-conv-bg dark:bg-muted' : 'hover:bg-chat-hover-conv-bg dark:hover:bg-muted/40')} data-testid="request-row">
      <button onClick={onOpen} className="w-full flex items-center gap-3 p-4 pb-2 text-left">
        <Avatar className="h-12 w-12 border border-chat-border shrink-0">
          <AvatarImage src={r.avatar_url || undefined} />
          <AvatarFallback>{initial(r.full_name)}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={cn('truncate', unread ? 'font-black' : 'font-bold')}>{r.full_name || 'User'}</p>
            <span className="text-[11px] text-muted-foreground shrink-0">{shortAgo(mode === 'deleted' ? r.deleted_at : (r.last_message_at || r.first_message_at))}</span>
          </div>
          <p className={cn('text-xs line-clamp-1', unread ? 'text-foreground font-semibold' : 'text-muted-foreground')}>{preview || '...'}</p>
          <p className="text-[11px] text-muted-foreground/80 line-clamp-1">{secondary}</p>
        </div>
        {unread && <span aria-label="Unread" className="h-2.5 w-2.5 rounded-full bg-chat-brand-action shrink-0" />}
      </button>
      <div className="flex gap-2 px-4 pb-3 pl-[76px]">
        {mode === 'deleted' ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onAct('restore')} className="h-9 rounded-full px-4">Restore</Button>
        ) : (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onAct('delete')} className="h-9 rounded-full px-4" aria-label={`Delete request from ${r.full_name || 'this person'}`}>
            <Trash2 size={14} className="mr-1.5" aria-hidden="true" />Delete
          </Button>
        )}
        <Button size="sm" disabled={busy} onClick={() => onAct('accept')} className="h-9 rounded-full px-4 bg-primary text-primary-foreground font-bold" aria-label={`Accept request from ${r.full_name || 'this person'}`}>Accept</Button>
      </div>
    </div>
  );
};

type View = 'main' | 'hidden' | 'deleted';

interface PanelProps {
  main: MessageRequestRow[];
  hidden: MessageRequestRow[];
  deleted: MessageRequestRow[];
  /** part GM installed: Hidden requests and Recently deleted exist */
  hasV2: boolean;
  privateKey: CryptoKey | null | undefined;
  activePartnerId?: string;
  onOpen: (id: string) => void;
  onBack: () => void;
}

/** The Requests screen inside the inbox: main list, a Hidden requests folder, and Recently deleted (overflow menu). */
export const MessageRequestsPanel = ({ main, hidden, deleted, hasV2, privateKey, activePartnerId, onOpen, onBack }: PanelProps) => {
  const { toast } = useToast();
  const [view, setView] = useState<View>('main');
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (view === 'hidden' && hidden.length === 0) setView('main');
    if (view === 'deleted' && deleted.length === 0) setView('main');
  }, [view, hidden.length, deleted.length]);

  const act = async (r: MessageRequestRow, action: RequestAction) => {
    setBusyId(r.partner_id);
    const ok = await respondToMessageRequest(r.partner_id, action);
    setBusyId(null);
    if (!ok) { toast({ title: 'Could not update the request', description: 'Please try again.', variant: 'destructive' }); return; }
    const name = r.full_name || 'This person';
    if (action === 'accept') toast({ title: 'Request accepted', description: `${name} can now message you.` });
    else if (action === 'delete') toast({ title: 'Request deleted', description: hasV2 ? 'It stays in Recently deleted for 30 days.' : undefined });
    else if (action === 'restore') toast({ title: 'Request restored' });
  };

  const list = view === 'main' ? main : view === 'hidden' ? hidden : deleted;
  const title = view === 'main' ? 'Message requests' : view === 'hidden' ? 'Hidden requests' : 'Recently deleted';

  return (
    <div data-testid="message-requests-panel">
      <div className="flex items-center gap-1 pr-1">
        <button
          onClick={() => (view === 'main' ? onBack() : setView('main'))}
          className="flex items-center gap-2 px-4 py-3 text-sm font-bold text-muted-foreground hover:text-foreground min-h-11"
          aria-label={view === 'main' ? 'Back to messages' : 'Back to message requests'}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          <span className="text-foreground">{title}</span>
        </button>
        <div className="flex-1" />
        {view === 'main' && hasV2 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Request options"><MoreVertical size={18} /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setView('deleted')}><Clock3 className="h-4 w-4 mr-2" /> Recently deleted{deleted.length > 0 ? ` (${deleted.length})` : ''}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {view === 'main' && (
        <p className="px-4 pb-2 text-xs text-muted-foreground">People who are not your connections. They can only send a few messages until you accept.</p>
      )}
      {view === 'hidden' && <p className="px-4 pb-2 text-xs text-muted-foreground">{HIDDEN_REQUESTS_EXPLAINER}</p>}
      {view === 'deleted' && <p className="px-4 pb-2 text-xs text-muted-foreground">Deleted requests are kept for {REQUEST_DELETED_WINDOW_DAYS} days, then they disappear. Restore one to bring it back to your requests.</p>}

      {list.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-muted-foreground">
          {view === 'main' ? 'No new message requests.' : view === 'hidden' ? 'No hidden requests.' : 'Nothing deleted recently.'}
        </p>
      )}
      {list.map((r) => (
        <RequestRow
          key={r.partner_id}
          r={r}
          privateKey={privateKey}
          mode={view}
          active={activePartnerId === r.partner_id}
          busy={busyId === r.partner_id}
          onOpen={() => onOpen(r.partner_id)}
          onAct={(a) => act(r, a)}
        />
      ))}

      {view === 'main' && hasV2 && (hidden.length > 0) && (
        <button
          onClick={() => setView('hidden')}
          data-testid="hidden-requests-row"
          className="w-full flex items-center gap-3 p-4 mt-2 rounded-[2rem] text-left hover:bg-chat-hover-conv-bg dark:hover:bg-muted/40 transition-colors"
        >
          <div className="flex-1 min-w-0">
            <p className="font-bold">Hidden requests <span className="text-muted-foreground font-medium">({hidden.length})</span></p>
            <p className="text-xs text-muted-foreground">{HIDDEN_REQUESTS_EXPLAINER}</p>
          </div>
          <ChevronRight size={18} className="text-muted-foreground shrink-0" aria-hidden="true" />
        </button>
      )}
    </div>
  );
};

export default MessageRequestsPanel;
