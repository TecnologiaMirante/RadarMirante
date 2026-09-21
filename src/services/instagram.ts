import {
  collection, doc, getDoc, getDocs,
  query, orderBy, limit, where,
} from 'firebase/firestore'
import { db } from '@/services/firebase'
import type {
  InstagramDailyInsight,
  InstagramAccountProfile,
  InstagramOnlineFollowers,
  InstagramAudience,
} from '@/types/instagram'

// ─── Perfil da conta ──────────────────────────────────────────────────────────

export async function getInstagramProfile(): Promise<InstagramAccountProfile | null> {
  const snap = await getDoc(doc(db, 'instagramAccount', 'profile'))
  if (!snap.exists()) return null
  return snap.data() as InstagramAccountProfile
}

// ─── Insights diários ─────────────────────────────────────────────────────────

export async function getInstagramInsights(days = 14): Promise<InstagramDailyInsight[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)
  since.setHours(0, 0, 0, 0)
  const sinceStr = since.toISOString().slice(0, 10)

  const snap = await getDocs(
    query(
      collection(db, 'instagramInsights'),
      where('date', '>=', sinceStr),
      orderBy('date', 'asc'),
      limit(days + 1),
    ),
  )
  return snap.docs.map(d => d.data() as InstagramDailyInsight)
}

// ─── Seguidores online por hora ───────────────────────────────────────────────

export async function getOnlineFollowers(): Promise<InstagramOnlineFollowers | null> {
  const snap = await getDocs(
    query(
      collection(db, 'instagramOnlineFollowers'),
      orderBy('date', 'desc'),
      limit(1),
    ),
  )
  if (snap.empty) return null
  return snap.docs[0].data() as InstagramOnlineFollowers
}

// ─── Audiência demográfica ─────────────────────────────────────────────────────

export async function getInstagramAudience(): Promise<InstagramAudience | null> {
  const [ga, co, ci] = await Promise.all([
    getDoc(doc(db, 'instagramAudience', 'audience_gender_age')),
    getDoc(doc(db, 'instagramAudience', 'audience_country')),
    getDoc(doc(db, 'instagramAudience', 'audience_city')),
  ])
  if (!ga.exists() && !co.exists() && !ci.exists()) return null
  return {
    genderAge:  (ga.data()?.data ?? {}) as Record<string, number>,
    countries:  (co.data()?.data ?? {}) as Record<string, number>,
    cities:     (ci.data()?.data ?? {}) as Record<string, number>,
  }
}
