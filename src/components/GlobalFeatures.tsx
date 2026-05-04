import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { usePresence } from '@/hooks/usePresence';
import { BackToTop } from '@/components/ui/back-to-top';
import { GlobalCallOverlay } from '@/components/calls/GlobalCallOverlay';
import { useGlobalNotifications } from '@/hooks/useGlobalNotifications';

/**
 * This component handles global features that should be active
 * throughout the application, such as keyboard shortcuts and
 * floating utility buttons.
 * 
 * It must be rendered inside the Router context.
 */
const GlobalFeatures = () => {
    // Activate global keyboard shortcuts
    useKeyboardShortcuts();
    
    // Activate global presence tracking - this marks the user as online everywhere
    usePresence();

    // Activate global notification listening
    useGlobalNotifications();

    return (
        <>
            {/* Render the Global Call Overlay for PiP functionality */}
            <GlobalCallOverlay />
            
            {/* Render the Back to Top button */}
            <BackToTop />
        </>
    );
};

export default GlobalFeatures;
