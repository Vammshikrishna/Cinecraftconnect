import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Paperclip, Send, Smile } from 'lucide-react';
import { z } from 'zod';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';

const messageSchema = z.object({
  content: z.string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message must be less than 2000 characters')
    .refine((val) => val.replace(/\s/g, '').length > 0, 'Message cannot be only whitespace'),
});

interface MessageComposerProps {
  onSend: (content: string) => Promise<void>;
  disabled?: boolean;
  onTyping?: () => void;
  onStopTyping?: () => void;
  onAttach?: (file: File) => void;
  userRole?: string;
}

export const MessageComposer = ({ onSend, disabled, onTyping, onStopTyping, onAttach }: MessageComposerProps) => {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = async () => {
    setError(null);

    try {
      messageSchema.parse({ content });
      setSending(true);
      onStopTyping?.();
      await onSend(content);
      setContent('');
      setShowEmojiPicker(false);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.issues[0].message);
      } else {
        setError('Failed to send message');
      }
    } finally {
      setSending(false);
    }
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    onTyping?.();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setContent(prevContent => prevContent + emojiData.emoji);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onAttach) {
      onAttach(file);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const charCount = content.length;
  const isNearLimit = charCount > 1800;
  const isOverLimit = charCount > 2000;

  return (
    <div className="border-t border-border bg-background/50 backdrop-blur-sm p-2 sm:p-4">
      {error && (
        <div className="mb-2 px-2 text-xs text-destructive flex items-center gap-1">
          <span>{error}</span>
        </div>
      )}

      <div className="relative">
        {showEmojiPicker && (
          <div ref={emojiPickerRef} className="absolute bottom-12 left-0 z-50 shadow-xl rounded-lg overflow-hidden">
            <EmojiPicker onEmojiClick={handleEmojiClick} width={300} height={400} />
          </div>
        )}
      </div>

      <div className="flex items-end gap-2">
        <div className="flex gap-0.5 pb-0.5 shrink-0">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || !onAttach}
          >
            <Paperclip className="h-5 w-5" />
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileSelect}
            />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            <Smile className="h-5 w-5" />
          </Button>
        </div>

        <div className="flex-1 relative bg-muted/50 rounded-2xl border border-transparent focus-within:border-primary/20 focus-within:bg-background transition-all">
          <Textarea
            value={content}
            onChange={handleContentChange}
            onKeyPress={handleKeyPress}
            onBlur={() => onStopTyping?.()}
            placeholder="Message..."
            className="min-h-[40px] max-h-[120px] py-2.5 px-4 bg-transparent border-none shadow-none focus-visible:ring-0 resize-none text-sm sm:text-base w-full"
            disabled={disabled || sending}
            rows={1}
          />
        </div>

        <Button
          onClick={handleSend}
          disabled={disabled || sending || content.trim().length === 0 || isOverLimit}
          size="icon"
          className="h-10 w-10 rounded-full shrink-0 shadow-sm mb-0.5"
        >
          <Send className="h-5 w-5 ml-0.5" />
        </Button>
      </div>

      {(isNearLimit || isOverLimit) && (
        <div className="text-[10px] text-right mt-1 px-2 text-muted-foreground">
          {charCount}/2000
          {isOverLimit && <span className="text-destructive ml-1">Limit exceeded</span>}
        </div>
      )}
    </div>
  );
};
