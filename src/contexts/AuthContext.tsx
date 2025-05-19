
import { createContext, useContext } from 'react';

type AuthContextType = {
  user: null;
  profile: null;
  isLoading: boolean;
};

// Create a simplified auth context with no actual authentication
const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isLoading: false
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const value = {
    user: null,
    profile: null,
    isLoading: false
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
