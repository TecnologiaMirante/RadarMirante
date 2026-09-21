import { createContext, useContext, useState, type ReactNode } from 'react'

export type RadarAccount = 'imirante' | 'imiranteesporte'

export const ACCOUNT_LABELS: Record<RadarAccount, string> = {
  imirante: '@imirante',
  imiranteesporte: '@imiranteesporte',
}

export const ACCOUNT_SHORT_LABELS: Record<RadarAccount, string> = {
  imirante: 'Mirante',
  imiranteesporte: 'Esporte',
}

export const ACCOUNT_COLORS: Record<RadarAccount, string> = {
  imirante: '#38B6FF',
  imiranteesporte: '#91BD32',
}

export const ACCOUNT_PAGE_TITLES: Record<RadarAccount, string> = {
  imirante: 'Radar Mirante',
  imiranteesporte: 'Radar Mirante Esporte',
}

export const RADAR_ACCOUNTS: RadarAccount[] = ['imirante', 'imiranteesporte']

interface AccountContextValue {
  account: RadarAccount
  setAccount: (a: RadarAccount) => void
}

const AccountContext = createContext<AccountContextValue>({
  account: 'imirante',
  setAccount: () => {},
})

function getSavedAccount(): RadarAccount {
  try {
    const saved = localStorage.getItem('radar-account')
    if (saved === 'imiranteesporte') return 'imiranteesporte'
  } catch {}
  return 'imirante'
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [account, setAccountState] = useState<RadarAccount>(getSavedAccount)

  function setAccount(a: RadarAccount) {
    setAccountState(a)
    try { localStorage.setItem('radar-account', a) } catch {}
  }

  return (
    <AccountContext.Provider value={{ account, setAccount }}>
      {children}
    </AccountContext.Provider>
  )
}

export function useAccount() {
  return useContext(AccountContext)
}
