import { createContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { onAuthChanged, processRedirectResult } from '@/services/auth'
import { db } from '@/services/firebase'
import type { UserRole } from '@/types/user'

interface AuthContextValue {
  user: User | null
  loading: boolean
  domainBlocked: boolean
  isAdmin: boolean
  role: UserRole
  userAccounts: string[]
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  domainBlocked: false,
  isAdmin: false,
  role: 'user',
  userAccounts: [],
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [domainBlocked, setDomainBlocked] = useState(false)
  const [role, setRole] = useState<UserRole>('user')
  const [userAccounts, setUserAccounts] = useState<string[]>([])

  useEffect(() => {
    processRedirectResult()
      .then((blocked) => { if (blocked) setDomainBlocked(true) })
      .catch((err) => console.error('[AuthContext] processRedirectResult:', err))

    const unsubscribe = onAuthChanged((u) => {
      setUser(u)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (!user) { setRole('user'); setUserAccounts([]); return }
    const ref = doc(db, 'users', user.uid)
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.data()
      if (!data) return
      let r: UserRole = 'user'
      if (data.role === 'superadmin') r = 'superadmin'
      else if (data.role === 'admin') r = 'admin'
      else if (data.isAdmin === true) r = 'admin'
      setRole(r)
      setUserAccounts(Array.isArray(data.accounts) ? (data.accounts as string[]) : ['imirante'])
    })
    return unsub
  }, [user])

  const isAdmin = role !== 'user'

  return (
    <AuthContext.Provider value={{ user, loading, domainBlocked, isAdmin, role, userAccounts }}>
      {children}
    </AuthContext.Provider>
  )
}
