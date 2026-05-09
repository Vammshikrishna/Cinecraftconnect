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
    
    // If it's a local origin (Capacitor or development), default to production for sharing
    if (origin.includes('localhost') || origin.startsWith('capacitor://')) {
        return 'https://cinecraftconnect.com';
    }
    
    return origin;
}

/**
 * Sanitizes a URL by replacing local origins with the production origin.
 */
export function sanitizeUrl(url: string): string {
    const origin = window.location.origin;
    if (origin.includes('localhost') || origin.startsWith('capacitor://')) {
        return url.replace(origin, 'https://cinecraftconnect.com');
    }
    return url;
}
