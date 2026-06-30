import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const ScrollToTop = () => {
    const { pathname, state } = useLocation();
    const navType = useNavigationType();

    useEffect(() => {
        // Only scroll to top if:
        // 1. It's a new navigation (PUSH or REPLACE)
        // 2. AND we haven't explicitly disabled scrolling via state
        // 3. AND it's not a POP (back/forward button)
        const shouldScroll = navType !== 'POP' && !(state && (state as Record<string, unknown>).noScroll);

        if (shouldScroll) {
            window.scrollTo(0, 0);
        }
    }, [pathname, navType, state]);

    return null;
};

export default ScrollToTop;
