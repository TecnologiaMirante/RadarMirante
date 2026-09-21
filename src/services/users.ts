import { doc, updateDoc } from 'firebase/firestore'
import { db } from './firebase'

export async function setUserAdmin(uid: string, isAdmin: boolean): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { isAdmin })
}
