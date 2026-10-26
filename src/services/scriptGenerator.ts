import { collection, addDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { db } from '@/services/firebase'

export type ScriptScenario = 'entretenimento' | 'jornalismo' | 'esportes'

export interface ScriptResult {
  whyTrending: string
  script: string
}

export function generateScript(
  trendTitle: string,
  platform: string,
  scenario: ScriptScenario,
  newsContext: string | undefined,
  onResult: (result: ScriptResult) => void,
  onError: (err: string) => void,
): () => void {
  const auth = getAuth()
  const user = auth.currentUser
  if (!user) {
    onError('Não autenticado')
    return () => {}
  }

  let unsub: (() => void) | null = null

  addDoc(collection(db, 'scriptRequests'), {
    trendTitle,
    platform,
    scenario,
    newsContext: newsContext ?? null,
    requestedBy: user.uid,
    status: 'pending',
    createdAt: serverTimestamp(),
  })
    .then(ref => {
      unsub = onSnapshot(ref, snap => {
        const data = snap.data()
        if (!data) return
        if (data.status === 'completed') {
          onResult({ whyTrending: data.whyTrending ?? '', script: data.script ?? '' })
          unsub?.()
          unsub = null
        } else if (data.status === 'failed') {
          onError(data.error ?? 'Erro desconhecido')
          unsub?.()
          unsub = null
        }
      })
    })
    .catch(err => onError((err as Error).message))

  return () => unsub?.()
}
