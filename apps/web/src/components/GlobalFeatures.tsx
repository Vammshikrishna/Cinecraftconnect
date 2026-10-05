import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePresence } from '@/hooks/usePresence';
import { BackToTop } from '@/components/ui/back-to-top';
import { GlobalCallOverlay } from '@/components/calls/GlobalCallOverlay';
import { GlobalNotificationListener } from '@/components/notifications/GlobalNotificationListener';

/**
 * This component handles global features that should be active
 * throughout the web application, such as keyboard shortcuts,
 * call overlays, notifications, and floating utility buttons.
 * 
 * It must be rendered inside the Router context.
 */
const GlobalFeatures = () => {
  // Activate global keyboard shortcuts
  useKeyboardShortcuts();
  
  // Activate global presence tracking - this marks the user as online everywhere
  usePresence();

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
