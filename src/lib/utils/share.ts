/**
 * Robustly copies text to the clipboard, with fallback for environments where 
 * navigator.clipboard might not be available or fails (like some mobile WebViews).
 */
export async function copyToClipboard(text: string): Promise<boolean> {
    // 1. Try standard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error("Standard clipboard API failed, trying fallback:", err);
        }
    }

    // 2. Fallback: Create a temporary textarea
    try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        
        // Ensure it's not visible but part of the DOM
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        return successful;
    } catch (err) {
        console.error("Fallback clipboard method failed:", err);
        return false;
    }
}

/**
 * Robustly get the site origin, handling Capacitor local origins by defaulting to production.
 */
export function getAppOrigin(): string {
    const origin = window.location.origin;
    
    // Only rewrite to a web domain if we are running in a native mobile container (Capacitor)
    if (origin.startsWith('capacitor://')) {
        return import.meta.env.VITE_APP_URL || 'https://cinecraftconnect.com';
    }
    
    return origin;
}

/**
 * Sanitizes a URL by replacing local origins with the production origin.
 */
export function sanitizeUrl(url: string): string {
    const origin = window.location.origin;
    if (origin.startsWith('capacitor://')) {
        const targetOrigin = import.meta.env.VITE_APP_URL || 'https://cinecraftconnect.com';
        return url.replace(origin, targetOrigin);
    }
    return url;
}
