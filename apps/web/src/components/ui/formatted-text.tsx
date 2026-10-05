import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ExternalLink, Film, PlaySquare, Music, MessageCircle } from "lucide-react";
import { SiNetflix, SiInstagram, SiFacebook, SiX, SiSpotify, SiWhatsapp, SiYoutube } from "react-icons/si";
import { FaLinkedin, FaAmazon } from "react-icons/fa";

interface FormattedTextProps {
  text: string;
  className?: string;
}

const getPlatformInfo = (url: string) => {
  const lowerUrl = url.toLowerCase();
  
  // Video & OTT
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) return { name: 'YouTube', icon: SiYoutube, color: 'text-[#FF0000] hover:text-[#FF0000]/80', fill: '' };
  if (lowerUrl.includes('netflix.com')) return { name: 'Netflix', icon: SiNetflix, color: 'text-[#E50914] hover:text-[#E50914]/80', fill: '' };
  if (lowerUrl.includes('primevideo.com') || lowerUrl.includes('amazon.com/video') || lowerUrl.includes('prime.com')) return { name: 'Prime Video', icon: FaAmazon, color: 'text-[#00A8E1] hover:text-[#00A8E1]/80', fill: '' };
  if (lowerUrl.includes('aha.video')) return { name: 'Aha', icon: PlaySquare, color: 'text-[#FF5C28] hover:text-[#FF5C28]/80', fill: 'fill-[#FF5C28]/10' };
  if (lowerUrl.includes('hotstar.com')) return { name: 'Hotstar', icon: PlaySquare, color: 'text-[#1F3E97] hover:text-[#1F3E97]/80', fill: 'fill-[#1F3E97]/10' };
  if (lowerUrl.includes('zee5.com')) return { name: 'ZEE5', icon: PlaySquare, color: 'text-[#8230C6] hover:text-[#8230C6]/80', fill: 'fill-[#8230C6]/10' };
  if (lowerUrl.includes('sonyliv.com')) return { name: 'SonyLIV', icon: PlaySquare, color: 'text-[#FFB500] hover:text-[#FFB500]/80', fill: 'fill-[#FFB500]/10' };
  
  // Social Media
  if (lowerUrl.includes('instagram.com')) return { name: 'Instagram', icon: SiInstagram, color: 'text-[#E1306C] hover:text-[#E1306C]/80', fill: '' };
  if (lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.watch')) return { name: 'Facebook', icon: SiFacebook, color: 'text-[#1877F2] hover:text-[#1877F2]/80', fill: '' };
  if (lowerUrl.includes('twitter.com') || lowerUrl.includes('x.com')) return { name: 'X (Twitter)', icon: SiX, color: 'text-[#1DA1F2] dark:text-white hover:opacity-80', fill: '' };
  if (lowerUrl.includes('linkedin.com')) return { name: 'LinkedIn', icon: FaLinkedin, color: 'text-[#0A66C2] hover:text-[#0A66C2]/80', fill: '' };
  
  // Music & Messaging
  if (lowerUrl.includes('spotify.com')) return { name: 'Spotify', icon: SiSpotify, color: 'text-[#1DB954] hover:text-[#1DB954]/80', fill: '' };
  if (lowerUrl.includes('whatsapp.com') || lowerUrl.includes('wa.me')) return { name: 'WhatsApp', icon: SiWhatsapp, color: 'text-[#25D366] hover:text-[#25D366]/80', fill: '' };

  return { name: 'Link', icon: ExternalLink, color: 'text-primary hover:text-primary/80', fill: '' };
};

export function FormattedText({ text, className }: FormattedTextProps) {
  if (!text) return null;

  // Match URLs, mentions (@username), and hashtags (#tag)
  const regex = /(https?:\/\/[^\s]+|@[a-zA-Z0-9_-]+|#[a-zA-Z0-9_-]+)/g;

  const parts = text.split(regex);

  return (
    <span className={cn("break-words whitespace-pre-wrap", className)}>
      {parts.map((part, index) => {
        if (part.startsWith('http://') || part.startsWith('https://')) {
          const platform = getPlatformInfo(part);
          const Icon = platform.icon;
          
          return (
            <a
              key={index}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "inline-flex items-center gap-1 font-bold transition-all hover:underline underline-offset-2 mx-0.5",
                platform.color
              )}
              onClick={(e) => e.stopPropagation()}
            >
              <Icon size={12} className={cn("shrink-0", platform.fill)} />
              {platform.name}
            </a>
          );
        }

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
