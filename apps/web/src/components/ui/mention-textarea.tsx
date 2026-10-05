import * as React from "react";
import { useState, useRef } from "react";
import { Textarea, TextareaProps } from "@/components/ui/textarea";
import { useMentionSuggestions } from "@/hooks/useMentions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";

interface MentionTextareaProps extends TextareaProps {
  onMentionSelected?: (user: { id: string; username: string; full_name: string }) => void;
}

export const MentionTextarea = React.forwardRef<HTMLTextAreaElement, MentionTextareaProps>(
  ({ value, onChange, className, onMentionSelected, ...props }, ref) => {
    const [mentionQuery, setMentionQuery] = useState("");
    const [isSuggesting, setIsSuggesting] = useState(false);
    const { data: suggestions = [], isLoading } = useMentionSuggestions(mentionQuery);
    
    // Internal ref to access the element
    const internalRef = useRef<HTMLTextAreaElement>(null);
    React.useImperativeHandle(ref, () => internalRef.current!);

    const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      const cursorPosition = e.target.selectionStart;
      
      if (onChange) onChange(e);

      // Check for @mention
      const textBeforeCursor = text.substring(0, cursorPosition);
      const lastAtSymbolIndex = textBeforeCursor.lastIndexOf("@");
      
      if (lastAtSymbolIndex !== -1) {
        const query = textBeforeCursor.substring(lastAtSymbolIndex + 1);
        // Only trigger if @ is at the start of a word or start of line
        const charBeforeAt = lastAtSymbolIndex > 0 ? textBeforeCursor[lastAtSymbolIndex - 1] : "";
        
        if (!query.includes(" ") && (charBeforeAt === " " || charBeforeAt === "\n" || charBeforeAt === "")) {
          setMentionQuery(query);
          setIsSuggesting(true);
          
          // Calculate popover position (simplified)
          const textarea = internalRef.current;
          if (textarea) {
            // Future positioning logic could go here
          }
        } else {
          setIsSuggesting(false);
        }
      } else {
        setIsSuggesting(false);
      }
    };

    const handleSelectMention = (user: any) => {
      const textarea = internalRef.current;
      if (!textarea) return;

      const text = textarea.value;
      const cursorPosition = textarea.selectionStart;
      const textBeforeCursor = text.substring(0, cursorPosition);
      const lastAtSymbolIndex = textBeforeCursor.lastIndexOf("@");
      
      const newText = 
        text.substring(0, lastAtSymbolIndex) + 
        `@${user.username || user.full_name} ` + 
        text.substring(cursorPosition);
      
      // Update value manually and trigger onChange
      const event = {
        target: { value: newText },
      } as React.ChangeEvent<HTMLTextAreaElement>;
      
      if (onChange) onChange(event);
      if (onMentionSelected) onMentionSelected(user);
      
      setIsSuggesting(false);
      
      // Keep focus
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = lastAtSymbolIndex + (user.username || user.full_name).length + 2;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    };

    return (
      <div className="relative w-full">
        <Textarea
          {...props}
          ref={internalRef}
          value={value}
          onChange={handleTextChange}
          className={cn("pr-10 transition-all", className)}
        />
        
        {isSuggesting && (suggestions.length > 0 || isLoading) && (
          <div className="absolute z-50 left-0 top-full mt-1 w-64 bg-popover border border-border rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <Command className="bg-transparent">
              <CommandList>
                <CommandGroup heading="Suggestions">
                  {isLoading ? (
                    <div className="p-4 text-center text-xs text-muted-foreground">Searching...</div>
                  ) : (
                    suggestions.map((user: any) => (
                      <CommandItem
                        key={user.id}
                        onSelect={() => handleSelectMention(user)}
                        className="flex items-center gap-3 p-2 cursor-pointer hover:bg-accent"
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={user.avatar_url} />
                          <AvatarFallback>{user.full_name?.[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{user.full_name}</span>
                          <span className="text-[10px] text-muted-foreground">@{user.username}</span>
                        </div>
                      </CommandItem>
                    ))
                  )}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        )}
      </div>
    );
  }
);

MentionTextarea.displayName = "MentionTextarea";
