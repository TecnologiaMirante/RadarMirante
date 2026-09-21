import { useState, useEffect, useCallback } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/services/firebase'

export interface TeamMember {
  uid: string
  displayName: string
  email: string
  photoURL?: string
  isAdmin?: boolean
}

export function useTeamMembers() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const snap = await getDocs(collection(db, 'users'))
      const data = snap.docs.map((d) => ({
        uid: d.id,
        displayName: d.data().displayName || d.data().email || d.id,
        email: d.data().email || '',
        photoURL: d.data().photoURL || undefined,
        isAdmin: d.data().isAdmin === true,
      })) as TeamMember[]
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
