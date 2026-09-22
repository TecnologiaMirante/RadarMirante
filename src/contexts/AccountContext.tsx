import { createContext, useContext, useMemo, useState, useEffect, type ReactNode } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '@/services/firebase'
import { useAuth } from '@/hooks/useAuth'

export interface RadarAccountConfig {
  id: string
  displayName: string
  shortName: string
  color: string
  active: boolean
  emProducao: boolean
  order: number
}

export type RadarAccount = string

// Static fallback data for known accounts — used while Firestore loads
// and as backward-compat exports for existing consumers
const STATIC_ACCOUNTS: RadarAccountConfig[] = [
  { id: 'imirante', displayName: '@imirante', shortName: 'Imirante', color: '#38B6FF', active: true, emProducao: false, order: 0 },
  { id: 'imiranteesporte', displayName: '@imiranteesporte', shortName: 'Esporte', color: '#91BD32', active: true, emProducao: true, order: 1 },
]

// Legacy static exports kept for existing consumers (Radar, WordCloud, Sidebar, etc.)
export const ACCOUNT_LABELS: Record<string, string> = { imirante: '@imirante', imiranteesporte: '@imiranteesporte' }
export const ACCOUNT_SHORT_LABELS: Record<string, string> = { imirante: 'Imirante', imiranteesporte: 'Esporte' }
export const ACCOUNT_COLORS: Record<string, string> = { imirante: '#38B6FF', imiranteesporte: '#91BD32' }
export const ACCOUNT_PAGE_TITLES: Record<string, string> = { imirante: 'Radar Imirante', imiranteesporte: 'Radar Imirante Esporte' }
export const RADAR_ACCOUNTS: string[] = ['imirante', 'imiranteesporte']

interface AccountContextValue {
  account: string
  setAccount: (a: string) => void
  accounts: RadarAccountConfig[]     // only accounts this user can access
  accountsLoading: boolean
  getAccount: (id: string) => RadarAccountConfig | undefined
}

const AccountContext = createContext<AccountContextValue>({
  account: 'imirante',
  setAccount: () => {},
  accounts: STATIC_ACCOUNTS,
  accountsLoading: false,
  getAccount: (id) => STATIC_ACCOUNTS.find(a => a.id === id),
})

function getSavedAccount(): string {
  try { return localStorage.getItem('radar-account') ?? 'imirante' } catch {}
  return 'imirante'
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const { role, userAccounts, loading: authLoading } = useAuth()
  const [allAccounts, setAllAccounts] = useState<RadarAccountConfig[]>(STATIC_ACCOUNTS)
  const [firestoreReady, setFirestoreReady] = useState(false)
  const [account, setAccountState] = useState<string>(getSavedAccount)

  // Load all radar accounts from Firestore (falls back to static if collection is empty)
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'radarAccounts'),
      (snap) => {
        if (!snap.empty) {
          const loaded = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as RadarAccountConfig))
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
          setAllAccounts(loaded)
        }
        setFirestoreReady(true)
      },
      () => { setFirestoreReady(true) },
    )
    return unsub
  }, [])

  // Compute visible accounts based on role
  const accounts = useMemo<RadarAccountConfig[]>(() => {
    const active = allAccounts.filter(a => a.active)
    if (authLoading || !firestoreReady) return active
    if (role === 'superadmin' || role === 'admin') return active
    return active.filter(a => userAccounts.includes(a.id))
  }, [allAccounts, firestoreReady, authLoading, role, userAccounts])

  // If saved account is no longer accessible, reset to first available
  useEffect(() => {
    if (authLoading || !firestoreReady || accounts.length === 0) return
    if (!accounts.find(a => a.id === account)) {
      setAccountState(accounts[0].id)
    }
  }, [accounts, account, authLoading, firestoreReady])

  function setAccount(a: string) {
    setAccountState(a)
    try { localStorage.setItem('radar-account', a) } catch {}
  }

  function getAccount(id: string): RadarAccountConfig | undefined {
    return allAccounts.find(a => a.id === id)
  }

  return (
    <AccountContext.Provider value={{
      account,
      setAccount,
      accounts,
      accountsLoading: !firestoreReady || authLoading,
      getAccount,
    }}>
      {children}
    </AccountContext.Provider>
  )
}

export function useAccount() {
  return useContext(AccountContext)
}
