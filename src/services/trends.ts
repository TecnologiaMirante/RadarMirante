import { collection, query, where, onSnapshot, type Timestamp } from 'firebase/firestore'
import { db } from '@/services/firebase'

export interface TrendNewsItem {
  title: string
  snippet: string
  source: string
  url: string
}

export interface TrendTopic {
  id: string
  rank: number
  title: string
  score?: string
  duration?: string
  newsItems?: TrendNewsItem[]
  firstSeen: Timestamp
  lastSeen: Timestamp
}

export interface PlatformTrends {
  topics: TrendTopic[]
  loading: boolean
  error?: string
}

export type TrendPlatform = 'google' | 'twitter'

export function subscribeTrends(
  platform: TrendPlatform,
  onData: (data: PlatformTrends) => void,
): () => void {
  const q = query(
    collection(db, 'trends_history'),
    where('platform', '==', platform),
  )

  return onSnapshot(
    q,
    snap => {
      const topics = snap.docs
        .map(d => ({ id: d.id, ...(d.data() as Omit<TrendTopic, 'id'>) }))
        .sort((a, b) => (b.lastSeen?.toMillis() ?? 0) - (a.lastSeen?.toMillis() ?? 0))
      onData({ topics, loading: false })
    },
    (err) => {
      console.error('[subscribeTrends]', err)
      onData({ topics: [], loading: false, error: (err as Error).message })
    },
  )
}
