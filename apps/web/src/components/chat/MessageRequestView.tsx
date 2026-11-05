import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { format, isSameDay } from 'date-fns';
import { ArrowLeft, MoreVertical, EyeOff, Flag, Users, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAppNavigation } from '@/contexts/NavigationContext';
import { useToast } from '@/hooks/use-toast';
import { respondToMessageRequest, type RequestAction } from '@/hooks/useMessageRequests';
import { decryptDirectMessage } from '@/lib/e2ee';
import { generateDirectRoomId } from '@/lib/chat-utils';
import { confirmDialog } from '@/lib/confirmDialog';
import { bucketOf, mutualText, requestExplainer, type MessageRequestRow } from '@/lib/messageRequests';
import VerificationBadge from '@/components/common/VerificationBadge';
import { MediaAttachment } from './MediaAttachment';
import { ImageLightboxModal } from './ImageLightboxModal';
import { LinkifiedText } from './LinkifiedText';
import { MessageReportDialog } from './MessageReportDialog';
import { PostShareCard } from './PostShareCard';
import { ProfileShareCard } from './ProfileShareCard';
import { PitchShareCard } from './PitchShareCard';
import { CompanyShareCard } from './CompanyShareCard';
import { ContentShareCard } from './ContentShareCard';
import { MarketplaceShareCard } from './MarketplaceShareCard';
import { AnnouncementShareCard } from './AnnouncementShareCard';
import { VendorShareCard } from './VendorShareCard';
import { JobShareCard } from './JobShareCard';
import { ProjectShareCard } from './ProjectShareCard';
import { DiscussionShareCard } from './DiscussionShareCard';

interface Props {
  request: MessageRequestRow;
  privateKey: CryptoKey | null | undefined;
  onBack: () => void;
  /** called after the request was answered; accepted = the chat should now open normally */
  onAnswered: (accepted: boolean) => void;
}

interface RequestMessage {
  id: string;
  content: string | null;
  created_at: string;
  attachment_url?: string | null;
  attachment_type?: string | null;
  is_deleted?: boolean | null;
}

const SHARE_CARDS: Array<[string, ComponentType<any>]> = [
  ['POST_SHARE::', PostShareCard], ['PROFILE_SHARE::', ProfileShareCard], ['PITCH_SHARE::', PitchShareCard],
  ['COMPANY_SHARE::', CompanyShareCard], ['MARKETPLACE_SHARE::', MarketplaceShareCard], ['ANNOUNCEMENT_SHARE::', AnnouncementShareCard],
  ['VENDOR_SHARE::', VendorShareCard], ['PROJECT_SHARE::', ProjectShareCard], ['CONTENT_SHARE::', ContentShareCard],
  ['DISCUSSION_SHARE::', DiscussionShareCard], ['ROOM_SHARE::', DiscussionShareCard],
];

const isDefaultMediaContent = (s?: string | null) => !s || /^Shared (\d+ photos|\d+ files|an image|a video|a file)$/i.test(s.trim());

const timeOf = (iso: string) => { try { return format(new Date(iso), 'h:mm a').toLowerCase(); } catch { return ''; } };
const dayOf = (iso: string) => { try { return format(new Date(iso), 'EEE d MMM, h:mm a'); } catch { return ''; } };

/** One message from the sender, drawn like a normal incoming chat bubble (read-only). */
const RequestBubble = ({ m, privateKey, onOpenMedia }: { m: RequestMessage; privateKey: CryptoKey | null | undefined; onOpenMedia: (urls: string[], idx: number) => void }) => {
  const [text, setText] = useState<string>('');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const raw = m.content || '';
      let out = raw;
      if (raw && (raw.includes('__e2ee') || raw.startsWith('{'))) {
        if (privateKey) {
          try { out = await decryptDirectMessage(raw, privateKey as any); } catch { out = '🔒 Encrypted Message'; }
        } else {
          out = '🔒 Encrypted Message';
        }
      }
      if (!cancelled) setText(out);
    })();
    return () => { cancelled = true; };
  }, [m.content, privateKey]);

  const clean = text.replace('FORWARDED::', '');
  const share = SHARE_CARDS.find(([prefix]) => clean.startsWith(prefix));
  const isJob = clean.includes('JOB_SHARE::');
  const hasCard = !!share || isJob;
  const mediaOnly = !!m.attachment_url && isDefaultMediaContent(clean);

  const body = (() => {
    if (!clean || mediaOnly) return null;
    if (share) {
      try { const Card = share[1]; return <Card {...JSON.parse(clean.slice(share[0].length))} />; } catch { return <p className="text-sm break-words">{clean}</p>; }
    }
    if (isJob) {
      try {
        const parts = clean.split('JOB_SHARE::');
        const caption = parts[0].trim();
        return (<div className="space-y-2">{caption && <p className="text-sm px-3 pt-2">{caption}</p>}<JobShareCard {...JSON.parse(parts[parts.length - 1].trim())} /></div>);
      } catch { return <p className="text-sm break-words">{clean}</p>; }
    }
    return <span className="text-sm break-words whitespace-pre-wrap"><LinkifiedText text={clean} /></span>;
  })();

  return (
    <div className="flex justify-start" data-testid="request-bubble">
      <div className={hasCard ? 'max-w-[85%] overflow-hidden rounded-2xl border border-border/10'
        : mediaOnly ? 'max-w-[85%]'
        : 'max-w-[85%] bg-chat-incoming-bg border border-chat-incoming-border text-chat-incoming-text dark:bg-muted dark:border-transparent dark:text-foreground font-medium rounded-[22px] rounded-tl-[4px] px-4 py-2.5 shadow-sm'}>
        {m.attachment_url && (
          <div className="mb-1">
            <MediaAttachment url={m.attachment_url} type={m.attachment_type} onSelectMedia={(u, idx, all) => onOpenMedia(all && all.length ? all : [u], idx || 0)} />
          </div>
        )}
        {body}
        <p className={`text-[11px] mt-1 text-muted-foreground/80 text-right select-none ${hasCard ? 'px-3 pb-2' : ''}`}>{timeOf(m.created_at)}</p>
      </div>
    </div>
  );
};

/** What the receiver sees instead of the chat while a message request is waiting: the sender's messages (read-only) and Delete / Block / Accept. */
export const MessageRequestView = ({ request, privateKey, onBack, onAnswered }: Props) => {
  const { user } = useAuth();
  const { push } = useAppNavigation();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<RequestMessage[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [lightbox, setLightbox] = useState<{ open: boolean; images: string[]; index: number }>({ open: false, images: [], index: 0 });
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState('');

  const name = request.full_name || 'This person';
  const isDeleted = bucketOf(request) === 'deleted';

  // Reading the messages does NOT mark them read: no update is made here, so the sender sees no read receipt until the request is accepted.
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setMessages(null);
    setLoadError(false);
    (async () => {
      const { data, error } = await (supabase as any)
        .from('direct_messages')
        .select('id, content, created_at, attachment_url, attachment_type, is_deleted')
        .eq('sender_id', request.partner_id)
        .eq('receiver_id', user.id)
        .order('created_at', { ascending: true })
        .limit(50);
      if (cancelled) return;
      if (error) { setLoadError(true); setMessages([]); return; }
      setMessages(((data || []) as RequestMessage[]).filter((x) => !x.is_deleted));
    })();
    return () => { cancelled = true; };
  }, [request.partner_id, user?.id]);

  const firstMsg = messages && messages.length > 0 ? messages[0] : null;
  const dayLabel = useMemo(() => (firstMsg ? dayOf(firstMsg.created_at) : ''), [firstMsg]);
  const showSecondDay = (i: number) => !!messages && i > 0 && !isSameDay(new Date(messages[i - 1].created_at), new Date(messages[i].created_at));

  const answer = async (action: RequestAction) => {
    setBusy(true);
    const ok = await respondToMessageRequest(request.partner_id, action);
    setBusy(false);
    if (!ok) {
      toast({ title: 'Could not update the request', description: 'Please try again.', variant: 'destructive' });
      return;
    }
    if (action === 'accept') toast({ title: 'Request accepted', description: `${name} can now message you.` });
    if (action === 'delete') toast({ title: 'Request deleted', description: 'It stays in Recently deleted for 30 days.' });
    if (action === 'restore') toast({ title: 'Request restored' });
    onAnswered(action === 'accept');
  };

  const block = async () => {
    if (!user) return;
    const yes = await confirmDialog(`Block ${name}? They will not be able to message or call you.`, { title: 'Block this person?', confirmLabel: 'Block', destructive: true });
    if (!yes) return;
    setBusy(true);
    const { error } = await (supabase.from('blocked_users' as any) as any).insert({ user_id: user.id, blocked_user_id: request.partner_id });
    if (error && error.code !== '23505') {
      setBusy(false);
      toast({ title: 'Could not block this person', description: 'Please try again.', variant: 'destructive' });
      return;
    }
    await respondToMessageRequest(request.partner_id, 'ignore');
    setBusy(false);
    toast({ title: `${name} blocked` });
    onAnswered(false);
  };

  const openReport = async () => {
    // the report carries the first message in readable form (moderators review what the person reports)
    const raw = firstMsg?.content || '';
    let readable = raw;
    if (raw && (raw.includes('__e2ee') || raw.startsWith('{'))) {
      try { readable = privateKey ? await decryptDirectMessage(raw, privateKey as any) : ''; } catch { readable = ''; }
    }
    setReportText(readable || '(no readable text)');
    setReportOpen(true);
  };

  return (
    <div className="h-full flex flex-col" data-testid="message-request-view">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <Button variant="ghost" size="icon" className="h-11 w-11 lg:hidden shrink-0" onClick={onBack} aria-label="Back to messages"><ArrowLeft size={18} /></Button>
        <Avatar className="h-9 w-9 border border-border shrink-0">
          <AvatarImage src={request.avatar_url || undefined} />
          <AvatarFallback>{Array.from(name.trim())[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate leading-tight flex items-center gap-1">
            <span className="truncate">{name}</span>
            {request.is_verified && <VerificationBadge size="xs" />}
          </p>
          <p className="text-xs text-muted-foreground truncate leading-tight">{request.username ? `@${request.username}` : 'Message request'}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label="More options" disabled={busy}><MoreVertical size={18} /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!isDeleted && <DropdownMenuItem onClick={() => answer('ignore')}><EyeOff className="h-4 w-4 mr-2" /> Ignore</DropdownMenuItem>}
            <DropdownMenuItem onClick={openReport}><Flag className="h-4 w-4 mr-2" /> Report</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
        <div className="flex flex-col items-center text-center gap-1.5 pb-3">
          <Avatar className="h-20 w-20 border border-border">
            <AvatarImage src={request.avatar_url || undefined} />
            <AvatarFallback>{Array.from(name.trim())[0]}</AvatarFallback>
          </Avatar>
          <h2 className="text-lg font-black tracking-tight flex items-center gap-1.5">{name}{request.is_verified && <VerificationBadge size="sm" />}</h2>
          {request.username && <p className="text-xs text-muted-foreground">@{request.username}</p>}
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Users size={12} aria-hidden="true" />{mutualText(request.mutual_count)}{request.account_type ? ` · ${request.account_type}` : ''}
          </p>
          <Button variant="outline" size="sm" className="h-9 rounded-full mt-1" onClick={() => push(`/profile/${request.partner_id}`)}>View profile</Button>
        </div>

        {messages === null ? (
          <div role="status" aria-label="Loading messages" className="space-y-2">
            {[0, 1].map((i) => <div key={i} className="h-10 w-2/3 rounded-2xl bg-muted/50 animate-pulse" />)}
          </div>
        ) : loadError ? (
          <p role="alert" className="text-center text-sm text-muted-foreground py-6">Could not load the messages. Go back and try again.</p>
        ) : (
          <>
            {dayLabel && <p className="text-center text-[11px] uppercase tracking-widest text-muted-foreground">{dayLabel}</p>}
            {messages.map((m, i) => (
              <div key={m.id} className="space-y-3">
                {showSecondDay(i) && <p className="text-center text-[11px] uppercase tracking-widest text-muted-foreground">{dayOf(m.created_at)}</p>}
                <RequestBubble m={m} privateKey={privateKey} onOpenMedia={(images, index) => setLightbox({ open: true, images, index })} />
              </div>
            ))}
          </>
        )}
      </div>

      <div className="border-t border-border bg-card/60 px-4 pt-3 pb-4 space-y-3" data-testid="request-action-bar">
        <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
          <Lock size={12} aria-hidden="true" className="shrink-0" />
          <span>{requestExplainer(name)}</span>
        </p>
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" disabled={busy} onClick={() => answer(isDeleted ? 'restore' : 'delete')} className="h-12 rounded-2xl font-bold">{isDeleted ? 'Restore' : 'Delete'}</Button>
          <Button variant="outline" disabled={busy} onClick={block} className="h-12 rounded-2xl font-bold text-destructive hover:text-destructive">Block</Button>
          <Button disabled={busy} onClick={() => answer('accept')} className="h-12 rounded-2xl font-bold bg-primary text-primary-foreground">Accept</Button>
        </div>
      </div>

      <ImageLightboxModal open={lightbox.open} onOpenChange={(open) => setLightbox((p) => ({ ...p, open }))} images={lightbox.images} initialIndex={lightbox.index} senderName={name} />
      {reportOpen && user && firstMsg && (
        <MessageReportDialog
          isOpen={reportOpen}
          onOpenChange={setReportOpen}
          targetType="dm"
          messageId={firstMsg.id}
          channelId={generateDirectRoomId(user.id, request.partner_id)}
          decryptedContent={reportText}
        />
      )}
    </div>
  );
};

export default MessageRequestView;
