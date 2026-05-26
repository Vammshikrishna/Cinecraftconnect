import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePresence } from '@/hooks/usePresence';
import { BackToTop } from '@/components/ui/back-to-top';
import { GlobalCallOverlay } from '@/components/calls/GlobalCallOverlay';
import { ConsistencyDebugPanel } from '@/devtools/ConsistencyDebugPanel';
import { OrchestrationDebugPanel } from '@/devtools/OrchestrationDebugPanel';
import { HydrationDebugPanel } from '@/devtools/HydrationDebugPanel';
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
                    const delivered = await PushNotifications.getDeliveredNotifications();
                    const matchingNotifications = delivered.notifications.filter(
                        n => n.data && n.data.actionUrl === location.pathname
                    );
                    
                    if (matchingNotifications.length > 0) {
                        console.log(`🧹 [Native Push] Clearing ${matchingNotifications.length} tray notifications for ${location.pathname}`);
                        await PushNotifications.removeDeliveredNotifications({ notifications: matchingNotifications });
                    }
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
                    // Give the app a moment to settle before navigating
                    setTimeout(() => navigate(value), 100);
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
        let pushSub: any = null;
        let receiveSub: any = null;
        if (Capacitor.isNativePlatform()) {
            PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
                const data = action.notification.data;
                if (data && data.actionUrl) {
                    navigate(data.actionUrl);
                }
            }).then(s => pushSub = s);

            // Instantly clear incoming push notifications if the user is already on that exact screen
            PushNotifications.addListener('pushNotificationReceived', async (notification) => {
                const data = notification.data;
                if (data && data.actionUrl && window.location.pathname === data.actionUrl) {
                    try {
                        console.log('🔕 [Native Push] Clearing notification because user is already on screen:', data.actionUrl);
                        await PushNotifications.removeDeliveredNotifications({ notifications: [notification] });
                    } catch (e) {
                        console.error('Failed to clear foreground native notification:', e);
                    }
                }
            }).then(s => receiveSub = s);
        }

        return () => {
            sub.then(s => s.remove());
            if (pushSub) pushSub.remove();
            if (receiveSub) receiveSub.remove();
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

            {/* Development-only Consistency and Orchestration Debug Panels */}
            {import.meta.env.DEV && (
              <>
                <ConsistencyDebugPanel />
                <OrchestrationDebugPanel />
                <HydrationDebugPanel />
              </>
            )}
        </>
    );
};

export default GlobalFeatures;
