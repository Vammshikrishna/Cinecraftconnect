import React, { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { PremiumNotification, premiumNotificationManager } from '@/lib/notifications/premiumNotificationManager';
import { PremiumNotificationCard } from './PremiumNotificationCard';
import { Capacitor } from '@capacitor/core';

export const PremiumNotificationOverlay: React.FC = () => {
  const [notifications, setNotifications] = useState<PremiumNotification[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // 1. Subscribe to notification manager updates
    const unsubscribe = premiumNotificationManager.subscribe((updated) => {
      setNotifications(updated);
    });

    // 2. Detect mobile/tablet viewports
    const checkViewport = () => {
      // 1. Check if running as a native Capacitor app
      try {
        if (Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'web') {
          setIsMobile(true);
          return;
        }
      } catch (e) {
        console.error('Capacitor check failed:', e);
      }
      
      // 2. Check viewport or screen width (tablet/mobile sizes)
      const screenWidth = typeof screen !== 'undefined' ? screen.width : window.innerWidth;
      const isSmallScreen = screenWidth < 1366 || window.innerWidth < 1366;
      if (isSmallScreen) {
        setIsMobile(true);
        return;
      }
      
      // 3. Check touch capabilities
      const isTouch = ('ontouchstart' in window) || 
                      (navigator.maxTouchPoints !== undefined && navigator.maxTouchPoints > 0);
      if (isTouch) {
        setIsMobile(true);
        return;
      }
      
      // 4. Check user agent
      const ua = navigator.userAgent || '';
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Tablet|PlayBook|Silk|Mobile/i.test(ua);
      
      setIsMobile(isMobileUA);
    };

    checkViewport();
    window.addEventListener('resize', checkViewport);

    return () => {
      unsubscribe();
      window.removeEventListener('resize', checkViewport);
    };
  }, []);

  if (!isMobile || notifications.length === 0) return null;

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
