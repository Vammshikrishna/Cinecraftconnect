import { useState, useEffect } from 'react';
import { subscribeNetworkStatus } from '../services/offlineCache';

export const useIsOffline = () => {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeNetworkStatus((isConnected) => {
      setIsOffline(!isConnected);
    });
    return () => unsubscribe();
  }, []);

  return isOffline;
};
