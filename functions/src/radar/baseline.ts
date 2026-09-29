import * as admin from 'firebase-admin'
import type { BaselineBucket, BaselineStats, SocialPlatform } from '../types/radar'
import { RADAR_CONFIG } from '../config/radar'

const COLLECTION = 'baseline'

// ─── Baseline Histórico ───────────────────────────────────────────────────────
// Compara cada post com o comportamento normal daquele canal/bucket.

export function getBucket(ageMinutes: number): BaselineBucket {
  if (ageMinutes <= 30) return '0-30m'
  if (ageMinutes <= 120) return '30-120m'
  if (ageMinutes <= 360) return '2-6h'
  if (ageMinutes <= 1440) return '6-24h'
  return '1-3d'
}

export function getPostAgeMinutes(publishedAt: admin.firestore.Timestamp): number {
  return (Date.now() - publishedAt.toMillis()) / (1000 * 60)
}

export async function getBaseline(
  db: admin.firestore.Firestore,
  platform: SocialPlatform,
  bucket: BaselineBucket,
  account?: string,
): Promise<BaselineStats | null> {
  // Tenta baseline específico da conta primeiro; cai para o global se não existir.
  const bucketKey = bucket.replace(/-/g, '_')
  const ids = account
    ? [`${platform}_${account}_${bucketKey}`, `${platform}_${bucketKey}`]
    : [`${platform}_${bucketKey}`]

  for (const id of ids) {
    const doc = await db.collection(COLLECTION).doc(id).get()
    if (!doc.exists) continue
    const data = doc.data() as BaselineStats
    if (data.sampleSize >= RADAR_CONFIG.baseline.minSamplesForBaseline) return data
  }

  return null
}

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (index - lower) * (sorted[upper] - sorted[lower])
}

export async function updateBaseline(
  db: admin.firestore.Firestore,
  platform: SocialPlatform,
  bucket: BaselineBucket,
  commentCounts: number[],
): Promise<void> {
  if (commentCounts.length < RADAR_CONFIG.baseline.minSamplesForBaseline) return

  const stats: Omit<BaselineStats, 'updatedAt'> = {
    bucket,
    platform,
    sampleSize: commentCounts.length,
    mean: commentCounts.reduce((a, b) => a + b, 0) / commentCounts.length,
    median: percentile(commentCounts, 50),
    p75: percentile(commentCounts, 75),
    p90: percentile(commentCounts, 90),
    p95: percentile(commentCounts, 95),
    p99: percentile(commentCounts, 99),
  }

  const id = `${platform}_${bucket.replace('-', '_')}`
  await db.collection(COLLECTION).doc(id).set({
    ...stats,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  })
}
