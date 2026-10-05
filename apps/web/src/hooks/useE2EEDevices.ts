import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getDeviceId, registerDevice, revokeDevice, generateSecurityFingerprint, DeviceRegistry } from '@/lib/e2ee';

export const useE2EEDevices = () => {
  const { user, profile } = useAuth();
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [currentDevice, setCurrentDevice] = useState<DeviceRegistry | null>(null);
  const [fingerprint, setFingerprint] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initDevice = async () => {
      if (!user) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const id = await getDeviceId();
        if (mounted) setDeviceId(id);

        const pubKey = profile?.public_key || 'identity_key_placeholder';
        const signKey = (profile as any)?.signing_key || 'signing_key_placeholder';
        const fp = await generateSecurityFingerprint(user.id, pubKey);

        if (mounted) setFingerprint(fp);

        const registered = await registerDevice(user.id, pubKey, signKey, fp);
        if (mounted && registered) {
          setCurrentDevice(registered);
        }
      } catch (err) {
        console.error('[useE2EEDevices] Device initialization error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initDevice();

    return () => {
      mounted = false;
    };
  }, [user?.id, profile?.public_key]);

  return {
    deviceId,
    currentDevice,
    fingerprint,
    loading,
    revokeDevice,
  };
};
