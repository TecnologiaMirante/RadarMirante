import { doc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import type { UserRole } from '@/types/user'

export async function setUserAdmin(uid: string, isAdmin: boolean): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { isAdmin })
}

export async function setUserRole(uid: string, role: UserRole): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    role,
    isAdmin: role !== 'user',
    updatedAt: new Date(),
  })
}

export async function setUserAccounts(uid: string, accounts: string[]): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { accounts, updatedAt: new Date() })
}
