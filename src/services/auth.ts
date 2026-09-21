import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { auth } from './firebase'

const ALLOWED_DOMAIN = 'mirante.com.br'

const googleProvider = new GoogleAuthProvider()
googleProvider.addScope('email')
googleProvider.addScope('profile')
googleProvider.setCustomParameters({ prompt: 'select_account' })

export class DomainNotAllowedError extends Error {
  constructor() {
    super(`Acesso restrito a contas @${ALLOWED_DOMAIN}`)
    this.name = 'DomainNotAllowedError'
  }
}

function isAllowedDomain(email: string | null | undefined): boolean {
  return !!email?.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`)
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider)
  if (!isAllowedDomain(result.user.email)) {
    await firebaseSignOut(auth)
    throw new DomainNotAllowedError()
  }
  return result.user
}

// Não há redirect para processar — retorna sempre false.
export async function processRedirectResult(): Promise<boolean> {
  return false
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth)
}

export function onAuthChanged(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback)
}
