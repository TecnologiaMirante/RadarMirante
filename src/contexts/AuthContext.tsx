import { createContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { onAuthChanged, processRedirectResult } from '@/services/auth'
import { db } from '@/services/firebase'

interface AuthContextValue {
  user: User | null
  loading: boolean
  domainBlocked: boolean
  isAdmin: boolean
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  domainBlocked: false,
  isAdmin: false,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [domainBlocked, setDomainBlocked] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

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
    if (!user) { setIsAdmin(false); return }
    const ref = doc(db, 'users', user.uid)
    const unsub = onSnapshot(ref, (snap) => {
      setIsAdmin(snap.data()?.isAdmin === true)
    })
    return unsub
  }, [user])

  return (
    <AuthContext.Provider value={{ user, loading, domainBlocked, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}
