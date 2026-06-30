import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePresence } from '@/hooks/usePresence';
import { BackToTop } from '@/components/ui/back-to-top';
import { GlobalCallOverlay } from '@/components/calls/GlobalCallOverlay';

import { GlobalNotificationListener } from '@/components/notifications/GlobalNotificationListener';
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

/**
 * This component handles global features that should be active
 * throughout the application, such as keyboard shortcuts and
 * floating utility buttons.
 * 
 * It must be rendered inside the Router context.
 */
const GlobalFeatures = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Activate global keyboard shortcuts
    useKeyboardShortcuts();
    
    // Activate global presence tracking - this marks the user as online everywhere
    usePresence();

    // Clear notifications for the current screen when we navigate to it
    useEffect(() => {
        if (Capacitor.isNativePlatform()) {
            const clearScreenNotifications = async () => {
                try {
                    // Because we are using custom Android Notification styles (MessagingStyle) 
                    // built manually in FCMService.java with string-based IDs, Capacitor's 
                    // removeDeliveredNotifications often crashes trying to parse the IDs.
                    // Instead, we just clear all notifications, or let the user dismiss them.
                    // For now, we rely on the NotificationReplyReceiver's "Mark as Read" intent.
                } catch (e) {
                    console.error('Failed to clear tray notifications on navigation:', e);
                }
            };
            clearScreenNotifications();
        }
    }, [location.pathname]);

    // Custom Native Push Notification Router
    useEffect(() => {
        const checkPendingPush = async () => {
            try {
                const { value } = await Preferences.get({ key: 'pending_push_url' });
                if (value) {
                    await Preferences.remove({ key: 'pending_push_url' });
                    // Navigate immediately to prevent flashing intermediate pages
                    navigate(value, { replace: true });
                }
            } catch (e) {
                console.error("Error reading pending push url", e);
            }
        };

        // Check immediately on mount (when app is launched from cold start)
        checkPendingPush();

        // Check every time app resumes from background
        const sub = App.addListener('appStateChange', ({ isActive }) => {
            if (isActive) {
                checkPendingPush();
            }
        });

        // Listen for direct notification taps (Foreground and Background)
        let pushSub: { remove: () => void } | null = null;
        if (Capacitor.isNativePlatform()) {
            PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
                const data = action.notification.data;
                if (data && data.actionUrl) {
                    navigate(data.actionUrl);
                }
            }).then(s => pushSub = s);
        }

        return () => {
            sub.then(s => s.remove());
            if (pushSub) pushSub.remove();
        };
    }, [navigate]);

    return (
        <>
            {/* Listen to Realtime inserts for the InAppOverlayEngine */}
            <GlobalNotificationListener />

            {/* Render the Global Call Overlay for PiP functionality */}
            <GlobalCallOverlay />
            
            {/* Render the Back to Top button */}
            <BackToTop />


        </>
    );
};

export default GlobalFeatures;
