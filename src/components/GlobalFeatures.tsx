import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { BackToTop } from '@/components/ui/back-to-top';

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

    return (
        <>
            {/* Render the Back to Top button */}
            <BackToTop />
        </>
    );
};

export default GlobalFeatures;
