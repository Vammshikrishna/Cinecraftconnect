import { usePlatformFlags as usePlatformFlagsContext, type PlatformFlagKey } from '../contexts/PlatformFlagsContext';
export type { PlatformFlagKey } from '../contexts/PlatformFlagsContext';

export interface PlatformFlag {
  id: string;
  key: PlatformFlagKey;
  value: boolean;
  description: string;
}

export const usePlatformFlags = () => {
  const context = usePlatformFlagsContext();
  return {
    ...context,
    fetchFlags: context.refresh,
  };
};
