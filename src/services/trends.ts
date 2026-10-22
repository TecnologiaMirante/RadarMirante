import { doc, onSnapshot, type Timestamp } from 'firebase/firestore'
import { db } from '@/services/firebase'

export interface TrendTopic {
  rank: number
  title: string
  score?: string
  duration?: string
}

export interface PlatformTrends {
  topics: TrendTopic[]
  updatedAt: Timestamp | null
  error?: string
  loading: boolean
}

export type TrendPlatform = 'google' | 'twitter'

export function subscribeTrends(
  platform: TrendPlatform,
  onData: (data: PlatformTrends) => void,
): () => void {
  return onSnapshot(
    doc(db, 'trends', platform),
    (snap) => {
      if (!snap.exists()) {
        onData({ topics: [], updatedAt: null, loading: false })
        return
      }
      const data = snap.data()
      onData({
        topics: (data.topics ?? []) as TrendTopic[],
        updatedAt: data.updatedAt ?? null,
        error: data.error,
        loading: false,
      })
    },
    () => onData({ topics: [], updatedAt: null, loading: false }),
  )
}
