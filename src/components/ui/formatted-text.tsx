import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface FormattedTextProps {
  text: string;
  className?: string;
}

export function FormattedText({ text, className }: FormattedTextProps) {
  if (!text) return null;

  // Regex to match mentions like @username
  // We look for @ followed by alphanumeric characters, underscores, or dashes
  const mentionRegex = /(@[a-zA-Z0-9_-]+)/g;

  const parts = text.split(mentionRegex);

  return (
    <span className={cn("break-words whitespace-pre-wrap", className)}>
      {parts.map((part, index) => {
        if (part.match(mentionRegex)) {
          const username = part.substring(1);
          return (
            <Link
              key={index}
              to={`/profile/${username}`} // Using username as a fallback if we don't have ID, but ideally we'd look up ID
              className="text-primary font-medium hover:underline decoration-primary/30 underline-offset-2"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </Link>
          );
        }
        return part;
      })}
    </span>
  );
}
