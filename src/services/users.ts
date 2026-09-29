import { doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from './firebase'
import type { UserRole } from '@/types/user'

export async function setUserAdmin(uid: string, isAdmin: boolean): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { isAdmin })
}

export async function setUserRole(uid: string, role: UserRole): Promise<void> {
  const user = auth.currentUser
  await updateDoc(doc(db, 'users', uid), {
    role,
    isAdmin: role !== 'user',
    updatedBy: user?.uid ?? 'client',
    updatedByEmail: user?.email ?? '',
    updatedAt: serverTimestamp(),
  })
}

export async function setUserAccounts(uid: string, accounts: string[]): Promise<void> {
  const user = auth.currentUser
  await updateDoc(doc(db, 'users', uid), {
    accounts,
    updatedBy: user?.uid ?? 'client',
    updatedByEmail: user?.email ?? '',
    updatedAt: serverTimestamp(),
  })
}
