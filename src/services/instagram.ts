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

export async function getInstagramProfile(account: string): Promise<InstagramAccountProfile | null> {
  const snap = await getDoc(doc(db, 'instagramAccount', account))
  if (!snap.exists()) return null
  return snap.data() as InstagramAccountProfile
}

// ─── Insights diários ─────────────────────────────────────────────────────────

export async function getInstagramInsights(days = 14, account: string): Promise<InstagramDailyInsight[]> {
  const since = new Date()
  since.setDate(since.getDate() - days)
  since.setHours(0, 0, 0, 0)
  const sinceStr = since.toISOString().slice(0, 10)

  const snap = await getDocs(
    query(
      collection(db, 'instagramAccount', account, 'insights'),
      where('date', '>=', sinceStr),
      orderBy('date', 'asc'),
      limit(days + 1),
    ),
  )
  return snap.docs.map(d => d.data() as InstagramDailyInsight)
}

// ─── Seguidores online por hora ───────────────────────────────────────────────

export async function getOnlineFollowers(account: string): Promise<InstagramOnlineFollowers | null> {
  const snap = await getDocs(
    query(
      collection(db, 'instagramAccount', account, 'onlineFollowers'),
      orderBy('date', 'desc'),
      limit(1),
    ),
  )
  if (snap.empty) return null
  return snap.docs[0].data() as InstagramOnlineFollowers
}

// ─── Audiência demográfica ─────────────────────────────────────────────────────

export async function getInstagramAudience(account: string): Promise<InstagramAudience | null> {
  const [ga, co, ci] = await Promise.all([
    getDoc(doc(db, 'instagramAccount', account, 'audience', 'audience_gender_age')),
    getDoc(doc(db, 'instagramAccount', account, 'audience', 'audience_country')),
    getDoc(doc(db, 'instagramAccount', account, 'audience', 'audience_city')),
  ])
  if (!ga.exists() && !co.exists() && !ci.exists()) return null
  return {
    genderAge:  (ga.data()?.data ?? {}) as Record<string, number>,
    countries:  (co.data()?.data ?? {}) as Record<string, number>,
    cities:     (ci.data()?.data ?? {}) as Record<string, number>,
  }
}
