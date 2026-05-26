import React, { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { PremiumNotification, premiumNotificationManager } from '@/lib/notifications/premiumNotificationManager';
import { PremiumNotificationCard } from './PremiumNotificationCard';

export const PremiumNotificationOverlay: React.FC = () => {
  const [notifications, setNotifications] = useState<PremiumNotification[]>([]);

  useEffect(() => {
    const unsubscribe = premiumNotificationManager.subscribe((updated) => {
      setNotifications(updated);
    });
    return () => unsubscribe();
  }, []);

  if (notifications.length === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex flex-col items-center gap-2 pt-[calc(env(safe-area-inset-top,24px)+8px)] px-4 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {notifications.map((notification) => (
          <PremiumNotificationCard key={notification.id} notification={notification} />
        ))}
      </AnimatePresence>
    </div>
  );
};
export default PremiumNotificationOverlay;
