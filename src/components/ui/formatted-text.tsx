import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface FormattedTextProps {
  text: string;
  className?: string;
}

export function FormattedText({ text, className }: FormattedTextProps) {
  if (!text) return null;

  // Regex to match mentions like @username and hashtags like #hashtag
  const regex = /((?:@|#)[a-zA-Z0-9_-]+)/g;

  const parts = text.split(regex);

  return (
    <span className={cn("break-words whitespace-pre-wrap", className)}>
      {parts.map((part, index) => {
        if (part.startsWith('@')) {
          const username = part.substring(1);
          return (
            <Link
              key={index}
              to={`/profile/${username}`}
              className="text-primary font-medium hover:underline decoration-primary/30 underline-offset-2"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </Link>
          );
        }
        
        if (part.startsWith('#')) {
          const tag = part.substring(1);
          return (
            <Link
              key={index}
              to={`/search?q=${encodeURIComponent(tag)}`}
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
