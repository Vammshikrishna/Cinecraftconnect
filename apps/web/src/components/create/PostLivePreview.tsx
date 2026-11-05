import type { ReactNode } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Clock, Globe } from 'lucide-react';
import { POLL_DURATIONS, type PollDraft } from '@cinecraft/core';

interface Props {
  authorName: string;
  authorAvatar?: string | null;
  caption: string;
  poll: PollDraft | null;
  category: string;
  audienceLabel: string;
  scheduleLabel?: string | null;
  /** A card shown under the caption (for example the job being shared). */
  attachment?: ReactNode;
}

/** Hashtags and @mentions in the caption are shown in the brand colour, like they will be in the feed. */
const renderCaption = (text: string) =>
  text.split(/([#@][\w.]+)/g).map((part, i) =>
    /^[#@][\w.]+$/.test(part) ? <span key={i} className="text-primary font-medium">{part}</span> : <span key={i}>{part}</span>,
  );

/**
 * What the post will look like in the feed, updating as you type. It is shown on the details step when the post has no
 * photo or video (a text or poll post), where the left side used to be an empty grey box.
 */
export const PostLivePreview = ({ authorName, authorAvatar, caption, poll, category, audienceLabel, scheduleLabel, attachment }: Props) => {
  const duration = poll ? POLL_DURATIONS.find((d) => d.id === poll.durationId)?.label : null;
  return (
    <div className="w-full max-w-md" aria-label="Post preview">
      <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Preview</p>
      <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={authorAvatar || undefined} />
            <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{authorName}</p>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              {scheduleLabel ? <><Clock className="h-3 w-3" /> {scheduleLabel}</> : <>Just now</>}
              <span aria-hidden>·</span>
              <Globe className="h-3 w-3" /> {audienceLabel}
            </p>
          </div>
        </div>

        <div className="mt-4 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-foreground">
          {caption.trim() ? renderCaption(caption) : <span className="text-muted-foreground/70">Your caption will appear here.</span>}
        </div>

        {attachment && <div className="pointer-events-none mt-4 select-none overflow-hidden rounded-2xl border border-border/60">{attachment}</div>}

        {poll && (
          <div className="mt-4 space-y-2">
            {poll.question.trim() && <p className="text-sm font-semibold text-foreground">{poll.question}</p>}
            {poll.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-3 rounded-xl border border-border/70 px-3.5 py-2.5">
                <span className="h-4 w-4 shrink-0 rounded-full border-2 border-muted-foreground/40" aria-hidden />
                <span className={`min-w-0 truncate text-sm ${opt.trim() ? 'text-foreground' : 'text-muted-foreground/60'}`}>{opt.trim() || `Option ${i + 1}`}</span>
              </div>
            ))}
            <p className="pt-1 text-xs text-muted-foreground">0 votes{duration ? ` · ${duration === 'No end' ? 'No end date' : `Open for ${duration}`}` : ''}</p>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2 border-t border-border/50 pt-3">
          <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">{category}</span>
        </div>
      </div>
    </div>
  );
};
