import { useEffect } from 'react';
import { onNetworkReconnected } from '../services/offlineCache';

/**
 * Custom hook to automatically trigger a data refresh when network connection is restored.
 */
export function useAutoRefreshOnReconnect(refreshFn: () => void) {
  useEffect(() => {
    const unsubscribe = onNetworkReconnected(() => {
      console.log('[useAutoRefreshOnReconnect] Network restored, automatically fetching latest screen data');
      refreshFn();
    });
    return () => unsubscribe();
  }, [refreshFn]);
}

export default useAutoRefreshOnReconnect;
