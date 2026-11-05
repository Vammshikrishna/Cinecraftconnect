/**
 * Robustly copies text to the clipboard.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error('Standard clipboard API failed, trying fallback:', err);
    }
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Fallback clipboard method failed:', err);
    return false;
  }
}

export function getAppOrigin(): string {
  return window.location.origin;
}

/**
 * Returns the link only when it is a web address (http/https), otherwise an empty string.
 * Control characters are removed first, so "java<TAB>script:" tricks do not slip through.
 */
export function sanitizeUrl(url: string): string {
  if (typeof url !== 'string') return '';
  const cleaned = url.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  if (!cleaned) return '';
  try {
    const u = new URL(cleaned);
    return u.protocol === 'https:' || u.protocol === 'http:' ? cleaned : '';
  } catch {
    return '';
  }
}
