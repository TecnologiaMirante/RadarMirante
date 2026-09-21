import * as admin from 'firebase-admin'

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface IGInsightValue { value: number; end_time?: string }

// Formato legado (v18 e anteriores): .data[].values[]
interface IGInsightResult {
  name: string
  period: string
  values?: IGInsightValue[]
  title?: string
}

// Formato v21: .data[].total_value com breakdowns de tempo
interface IGTotalValueBreakdown {
  dimension_keys: string[]
  results: { dimension_values: string[]; value: number }[]
}

interface IGInsightResultV21 extends IGInsightResult {
  total_value?: {
    value?: number
    breakdowns?: IGTotalValueBreakdown[]
  }
}

interface IGInsightsResponse {
  data?: IGInsightResultV21[]
  error?: { code: number; message: string }
}

// Extrai pares {date, value} do resultado, suportando ambos os formatos da API
function extractDailyValues(result: IGInsightResultV21): { date: string; value: number }[] {
  // Formato legado: .values[{value, end_time}]
  if (result.values?.length) {
    return result.values.map(v => ({
      date: v.end_time ? toDateStr(new Date(v.end_time)) : toDateStr(new Date()),
      value: v.value,
    }))
  }
  // Formato v21 com breakdown de tempo
  const tb = result.total_value?.breakdowns?.find(b => b.dimension_keys.includes('time'))
  if (tb) {
    return tb.results.map(r => ({
      date: r.dimension_values[0] ?? toDateStr(new Date()),
      value: r.value,
    }))
  }
  // Formato v21 sem breakdown: valor único para o período inteiro — não é utilizável para tendências diárias
  return []
}

interface IGProfileResponse {
  id: string
  username: string
  name: string
  biography?: string
  followers_count: number
  follows_count: number
  media_count: number
  profile_picture_url?: string
  website?: string
  error?: { code: number; message: string }
}

interface IGOnlineFollowers {
  data: Record<string, number>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Insights requerem graph.facebook.com (não graph.instagram.com)
// A conta Instagram precisa ser Business/Creator conectada a uma Página do Facebook
// Token precisa de: instagram_basic, instagram_manage_insights, pages_show_list
const GRAPH_BASE = 'https://graph.facebook.com/v21.0'

async function igFetch<T>(path: string, token: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${GRAPH_BASE}${path}`)
  url.searchParams.set('access_token', token)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString())
  return res.json() as Promise<T>
}

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function unixFromDate(date: Date): number {
  return Math.floor(date.getTime() / 1000)
}

// ─── Sync Account Insights ───────────────────────────────────────────────────

export async function syncInstagramInsights(
  db: admin.firestore.Firestore,
  token: string,
  accountId: string,
): Promise<void> {
  console.log('[syncInstagramInsights] Iniciando')

  // ── 1. Perfil da conta ──────────────────────────────────────────────────────
  const profile = await igFetch<IGProfileResponse>(
    `/${accountId}`,
    token,
    {
      fields: 'id,username,name,biography,followers_count,follows_count,media_count,profile_picture_url,website',
    },
  )

  if (profile.error) {
    throw new Error(`Instagram API error: ${profile.error.message}`)
  }

  await db.collection('instagramAccount').doc('profile').set({
    username: profile.username,
    name: profile.name,
    biography: profile.biography ?? '',
    followersCount: profile.followers_count,
    followsCount: profile.follows_count,
    mediaCount: profile.media_count,
    profilePictureUrl: profile.profile_picture_url ?? '',
    website: profile.website ?? '',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true })

  console.log(`[syncInstagramInsights] Perfil atualizado: @${profile.username} (${profile.followers_count} seguidores)`)

  // ── 2. Insights diários dos últimos 30 dias ─────────────────────────────────
  // API v21 testada: apenas follower_count funciona com period=day sem metric_type.
  // views/reach/profile_views/website_clicks retornam (#10) permission denied com
  // metric_type=total_value — o app precisa de aprovação adicional da Meta para essas métricas.
  const until = new Date()
  const since = new Date(until)
  since.setDate(since.getDate() - 30)

  // follower_count funciona sem metric_type (formato legado .values[])
  const followerResponse = await igFetch<IGInsightsResponse>(
    `/${accountId}/insights`,
    token,
    {
      metric: 'follower_count',
      period: 'day',
      since: String(unixFromDate(since)),
      until: String(unixFromDate(until)),
    },
  ).catch(() => null)

  const followerCountByDate: Record<string, number> = {}
  if (followerResponse?.data?.[0]) {
    for (const { date, value } of extractDailyValues(followerResponse.data[0])) {
      followerCountByDate[date] = value
    }
  }

  const followerDates = Object.keys(followerCountByDate).sort()
  if (followerDates.length > 0) {
    const batch = db.batch()
    for (let i = 0; i < followerDates.length; i++) {
      const date = followerDates[i]
      const followerCount = followerCountByDate[date]
      const prevFollowers = i > 0 ? followerCountByDate[followerDates[i - 1]] : followerCount
      const followerGain  = followerCount - prevFollowers

      const ref = db.collection('instagramInsights').doc(date)
      batch.set(ref, {
        date,
        followerCount,
        followerGain,
        // reach/impressions/profileViews/websiteClicks não disponíveis com o nível atual
        // de permissão do app Meta (metric_type=total_value requer aprovação adicional)
        impressions: 0,
        reach: 0,
        profileViews: 0,
        websiteClicks: 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })
    }
    await batch.commit()
    console.log(`[syncInstagramInsights] ${followerDates.length} dias de follower_count salvos`)
  } else {
    console.warn('[syncInstagramInsights] follower_count: sem dados')
  }

  // ── 3. Online followers por hora ─────────────────────────────────────────────
  const onlineRes = await igFetch<IGOnlineFollowers>(
    `/${accountId}/insights`,
    token,
    {
      metric: 'online_followers',
      period: 'lifetime',
    },
  ).catch(() => null)

  if (onlineRes?.data) {
    const hourMap = onlineRes.data
    const byHour: number[] = Array(24).fill(0)
    const total = Object.values(hourMap).reduce((s, v) => s + v, 0)

    for (const [hourStr, count] of Object.entries(hourMap)) {
      const h = parseInt(hourStr, 10)
      if (h >= 0 && h <= 23 && total > 0) {
        byHour[h] = Math.round((count / total) * 100 * 10) / 10
      }
    }

    await db.collection('instagramOnlineFollowers').doc(toDateStr(new Date())).set({
      date: toDateStr(new Date()),
      byHour,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    console.log('[syncInstagramInsights] Online followers salvos')
  }

  // ── 4. Audience demographics ─────────────────────────────────────────────────
  const audienceMetrics = ['audience_gender_age', 'audience_country', 'audience_city'] as const
  for (const metric of audienceMetrics) {
    const res = await igFetch<{ data: { name: string; values: { value: Record<string, number> }[] }[]; error?: { message: string } }>(
      `/${accountId}/insights`,
      token,
      { metric, period: 'lifetime' },
    ).catch(() => null)

    if (!res || res.error || !res.data?.[0]?.values?.[0]) continue
    const data = res.data[0].values[0].value
    await db.collection('instagramAudience').doc(metric).set({
      metric,
      data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
  }
  console.log('[syncInstagramInsights] Audience demographics salvos')

  // ── 5. Post-level insights para posts Instagram recentes ─────────────────────
  const postsSnap = await db
    .collection('posts')
    .where('platform', '==', 'instagram')
    .orderBy('publishedAt', 'desc')
    .limit(20)
    .get()

  let postInsightsUpdated = 0
  const postBatch = db.batch()

  for (const postDoc of postsSnap.docs) {
    const externalId: string = postDoc.data().externalId
    if (!externalId) continue

    const insights = await igFetch<{ data: { name: string; values: { value: number }[] }[]; error?: { message: string } }>(
      `/${externalId}/insights`,
      token,
      { metric: 'impressions,reach,saved,video_views' },
    ).catch(() => null)

    if (!insights || insights.error) continue

    const getMetric = (name: string): number =>
      insights.data?.find(m => m.name === name)?.values[0]?.value ?? 0

    postBatch.update(postDoc.ref, {
      'insights.reach': getMetric('reach'),
      'insights.impressions': getMetric('impressions'),
      'insights.saved': getMetric('saved'),
      'insights.videoViews': getMetric('video_views'),
      'insights.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    })
    postInsightsUpdated++
  }

  if (postInsightsUpdated > 0) {
    await postBatch.commit()
    console.log(`[syncInstagramInsights] ${postInsightsUpdated} posts com insights atualizados`)
  }

  console.log('[syncInstagramInsights] Concluído')
}
