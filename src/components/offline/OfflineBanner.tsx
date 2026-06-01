import { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

/**
 * OfflineBanner
 *
 * A sticky top-of-viewport notification bar that appears when the browser
 * loses network connectivity. It gracefully fades in when offline and
 * disappears when the connection is restored.
 *
 * Data awareness: this component pairs with the IndexedDB persister so that
 * users understand they are viewing cached production data (tasks, budgets,
 * call sheets) rather than live data.
 */
export const OfflineBanner = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [visible, setVisible] = useState(!navigator.onLine);

  useEffect(() => {
    const goOffline = () => {
      setIsOffline(true);
      // Small delay to allow the CSS transition to play
      requestAnimationFrame(() => setVisible(true));
    };

    const goOnline = () => {
      setVisible(false);
      // Wait for fade-out before unmounting
      const t = setTimeout(() => setIsOffline(false), 400);
      return () => clearTimeout(t);
    };

    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);

    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        padding: '8px 16px',
        background: 'linear-gradient(90deg, #7c3aed 0%, #4f46e5 100%)',
        color: '#fff',
        fontSize: '13px',
        fontWeight: 700,
        letterSpacing: '0.05em',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-100%)',
        transition: 'opacity 0.35s ease, transform 0.35s ease',
        boxShadow: '0 2px 16px 0 rgba(124,58,237,0.35)',
      }}
    >
      <WifiOff size={15} strokeWidth={2.5} style={{ flexShrink: 0 }} />
      <span>Offline — viewing cached data</span>
    </div>
  );
};
