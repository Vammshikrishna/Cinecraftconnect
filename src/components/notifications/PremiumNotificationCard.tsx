import React from 'react';
import { motion } from 'framer-motion';
import { PremiumNotification, premiumNotificationManager } from '@/lib/notifications/premiumNotificationManager';
import { useNavigate } from 'react-router-dom';
import { getNotificationIcon } from '@/lib/chat-utils';
import { User } from 'lucide-react';

interface PremiumNotificationCardProps {
  notification: PremiumNotification;
}

export const PremiumNotificationCard = React.forwardRef<HTMLDivElement, PremiumNotificationCardProps>(({ notification }, ref) => {
  const navigate = useNavigate();

  const handleTap = () => {
    // Only navigate if they didn't drag it
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
    premiumNotificationManager.removeNotification(notification.id);
  };

  const iconEmoji = getNotificationIcon(notification.type);

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: -50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -30, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 350, damping: 26 }}
      drag="y"
      dragConstraints={{ top: -100, bottom: 0 }}
      dragElastic={{ top: 0.1, bottom: 0.1 }}
      onDragEnd={(_, info) => {
        if (info.offset.y < -25) {
          // Swipe up to dismiss
          premiumNotificationManager.removeNotification(notification.id);
        }
      }}
      onTap={handleTap}
      className="w-[92vw] max-w-[420px] bg-background/90 backdrop-blur-xl border border-border/40 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.25)] p-3.5 flex items-center gap-3.5 cursor-pointer select-none active:scale-[0.98] transition-transform duration-100 relative overflow-hidden pointer-events-auto"
      style={{
        touchAction: 'none',
      }}
    >
      {/* Dynamic left side border accent */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary" />

      {/* Avatar Container with Mini Badge */}
      <div className="relative flex-shrink-0">
        {notification.avatarUrl ? (
          <img
            src={notification.avatarUrl}
            alt=""
            className="w-11 h-11 rounded-full object-cover border border-primary/20"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const fallback = e.currentTarget.parentElement?.querySelector('.avatar-fallback');
              if (fallback) fallback.classList.remove('hidden');
            }}
          />
        ) : null}
        
        {/* Fallback silhouette if no avatarUrl or image fails to load */}
        <div className={`avatar-fallback w-11 h-11 rounded-full bg-zinc-100 dark:bg-zinc-800 border border-border flex items-center justify-center text-muted-foreground ${notification.avatarUrl ? 'hidden' : ''}`}>
          <User className="w-5 h-5 text-zinc-400 dark:text-zinc-500" />
        </div>
        
        {/* Badge in corner of avatar */}
        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-background border border-border/40 rounded-full flex items-center justify-center text-[10px] shadow-sm">
          {iconEmoji}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-2">
        <div className="flex items-center justify-between gap-1">
          <span className="font-bold text-sm text-foreground truncate">
            {notification.title}
          </span>
          <span className="text-[10px] text-muted-foreground flex-shrink-0">
            Just now
          </span>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
          {notification.description}
        </p>
      </div>

      {/* Drag handle pill */}
      <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-muted-foreground/20 rounded-full" />
    </motion.div>
  );
});
