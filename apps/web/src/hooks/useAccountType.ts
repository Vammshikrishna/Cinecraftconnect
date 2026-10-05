import { useAuth } from '@/contexts/AuthContext';
import { AccountType } from '@/types/pricing';

/**
 * Hook to determine the current user's account type.
 *
 * - `isFan`      → true when account_type === 'fan'
 * - `isCreator`  → true when account_type === 'creator'
 * - `isStudio`   → true when account_type === 'studio'
 * - `isPro`      → true for 'creator' or 'studio'
 * - `accountType`→ raw value ('fan' | 'creator' | 'studio')
 *
 * Legacy profiles without account_type default to 'creator'.
 */
export const useAccountType = () => {
    const { profile } = useAuth();

    // Cast — account_type is now in the DB type but older profiles may be null
    const raw = profile?.account_type as AccountType | null | undefined;

    // Default null/undefined → 'creator' so existing users are unaffected
    const accountType: AccountType = raw === 'fan' ? 'fan' : (raw === 'studio' ? 'studio' : 'creator');

    return {
        accountType,
        isFan: accountType === 'fan',
        isCreator: accountType === 'creator',
        isStudio: accountType === 'studio',
        isPro: accountType === 'creator' || accountType === 'studio',
    };
};

