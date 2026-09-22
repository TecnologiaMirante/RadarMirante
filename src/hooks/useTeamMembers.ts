import { useState, useEffect, useCallback } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/services/firebase'
import type { UserRole } from '@/types/user'

export interface TeamMember {
  uid: string
  displayName: string
  email: string
  photoURL?: string
  isAdmin: boolean
  role: UserRole
  accounts: string[]
}

export function useTeamMembers() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'users'))
      const data = snap.docs.map((d) => {
        const raw = d.data()
        const isAdmin = raw.isAdmin === true
        let role: UserRole = 'user'
        if (raw.role === 'superadmin') role = 'superadmin'
        else if (raw.role === 'admin') role = 'admin'
        else if (isAdmin) role = 'admin'
        return {
          uid: d.id,
          displayName: raw.displayName || raw.email || d.id,
          email: raw.email || '',
          photoURL: raw.photoURL || undefined,
          isAdmin,
          role,
          accounts: Array.isArray(raw.accounts) ? (raw.accounts as string[]) : ['imirante'],
        }
      }) as TeamMember[]
      setMembers(data.sort((a, b) => a.displayName.localeCompare(b.displayName)))
    } catch (err) {
      console.error('[useTeamMembers]', err)
      setMembers([])
    } finally {
      setLoading(false)
    }
  }, [attempt]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void load() }, [load])

  function retry() { setAttempt(v => v + 1) }

  return { members, loading, retry }
}
