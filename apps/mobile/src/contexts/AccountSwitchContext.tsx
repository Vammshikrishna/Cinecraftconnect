/**
 * AccountSwitchContext
 *
 * A thin context that carries the onAccountSwitch callback from the App.tsx
 * root down to ProfileScreen without prop-drilling through every navigator layer.
 *
 * App.tsx provides the value; ProfileScreen consumes useAccountSwitch().
 */
import React, { createContext, useContext } from 'react';

interface AccountSwitchContextType {
  /** Called by ProfileScreen after a successful account switch via AccountManager. */
  onAccountSwitch: (newSession: any) => void;
}

const AccountSwitchContext = createContext<AccountSwitchContextType>({
  onAccountSwitch: () => {},
});

export const AccountSwitchProvider = AccountSwitchContext.Provider;

export const useAccountSwitch = (): AccountSwitchContextType => {
  return useContext(AccountSwitchContext);
};
