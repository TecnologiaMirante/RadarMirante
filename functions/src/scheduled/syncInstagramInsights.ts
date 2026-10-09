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
    return tb.results.map(r => {
      const raw = r.dimension_values[0] ?? ''
      // dimension_values pode ser Unix timestamp (string de 10 dígitos) ou YYYY-MM-DD
      let date: string
      if (/^\d{10}$/.test(raw)) {
        date = toDateStr(new Date(parseInt(raw, 10) * 1000))
      } else if (raw.length >= 10) {
        date = raw.slice(0, 10)
      } else {
        date = toDateStr(new Date())
      }
      return { date, value: r.value }
    })
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
  data?: { values?: { value: Record<string, number>; end_time?: string }[] }[]
  error?: { code: number; message: string }
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
  radarId: string,
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

  await db.collection('instagramAccount').doc(radarId).set({
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

  // follower_count retorna delta diário (ganho/perda), não total acumulado.
  // Se a chamada com since/until falhar (ex: tvmirante), tenta sem o range de datas.
  const followerGainByDate: Record<string, number> = {}
  if (followerResponse?.data?.[0] && !followerResponse.error) {
    for (const { date, value } of extractDailyValues(followerResponse.data[0])) {
      followerGainByDate[date] = value
    }
  }

  if (Object.keys(followerGainByDate).length === 0) {
    const fallbackResponse = await igFetch<IGInsightsResponse>(
      `/${accountId}/insights`,
      token,
      { metric: 'follower_count', period: 'day' },
    ).catch(() => null)
    if (fallbackResponse?.data?.[0] && !fallbackResponse.error) {
      for (const { date, value } of extractDailyValues(fallbackResponse.data[0])) {
        followerGainByDate[date] = value
      }
    }
  }

  // Calcula total acumulado retroativamente a partir do total atual do perfil.
  // Exemplo: hoje=100k, ontem ganhou +50 → ontem=99.950k
  const currentTotal = profile.followers_count
  const followerDates = Object.keys(followerGainByDate).sort()
  const followerCountByDate: Record<string, number> = {}
  if (followerDates.length > 0) {
    let accumulated = currentTotal
    for (let i = followerDates.length - 1; i >= 0; i--) {
      followerCountByDate[followerDates[i]] = accumulated
      accumulated -= (followerGainByDate[followerDates[i]] ?? 0)
    }
  }

  if (followerDates.length > 0) {
    const batch = db.batch()
    for (let i = 0; i < followerDates.length; i++) {
      const date = followerDates[i]
      const followerGain = followerGainByDate[date]
      const followerCount = followerCountByDate[date] ?? currentTotal

      const ref = db.collection('instagramAccount').doc(radarId).collection('insights').doc(date)
      batch.set(ref, {
        date,
        followerCount,
        followerGain,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })
    }
    await batch.commit()
    console.log(`[syncInstagramInsights] ${followerDates.length} dias de follower_count salvos`)
  } else {
    console.warn('[syncInstagramInsights] follower_count: sem dados')
  }

  // ── 2b. Métricas de engajamento (formato legado, period=day) ────────────────
  // reach, impressions, profile_views, website_clicks funcionam com o formato
  // legado (.values[]) sem metric_type — desde que o token tenha instagram_manage_insights.

  async function syncDailyMetric(
    metric: string,
    firestoreField: string,
    label: string,
    extraParams: Record<string, string> = {},
  ): Promise<void> {
    const resp = await igFetch<IGInsightsResponse>(
      `/${accountId}/insights`,
      token,
      {
        metric,
        period: 'day',
        since: String(unixFromDate(since)),
        until: String(unixFromDate(until)),
        ...extraParams,
      },
    ).catch(() => null)

    if (!resp || resp.error || !resp.data?.[0] || followerDates.length === 0) {
      if (resp?.error) {
        console.warn(`[syncInstagramInsights] ${label} indisponível: ${resp.error.message}`)
      }
      return
    }

    const byDate: Record<string, number> = {}
    for (const { date, value } of extractDailyValues(resp.data[0])) {
      byDate[date] = value
    }

    const batch = db.batch()
    let updated = 0
    for (const date of followerDates) {
      if (byDate[date] !== undefined && byDate[date] > 0) {
        batch.set(
          db.collection('instagramAccount').doc(radarId).collection('insights').doc(date),
          { [firestoreField]: byDate[date], updatedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true },
        )
        updated++
      }
    }
    if (updated > 0) {
      await batch.commit()
      console.log(`[syncInstagramInsights] ${label} salvo: ${updated} dias`)
    }
  }

  // reach: formato legado, retorna série de 30 dias com since/until
  await syncDailyMetric('reach', 'reach', 'reach')

  // Métricas v21: requerem metric_type=total_value. Usa period=lifetime + breakdown=time
  // + since/until para obter série histórica de 30 dias. Se a API não retornar série,
  // cai em fallback que salva apenas o valor de hoje.
  async function syncDailyMetricV21(metric: string, firestoreField: string, label: string): Promise<void> {
    // Tentativa 1: série histórica com breakdown temporal (period=lifetime)
    const histResp = await igFetch<IGInsightsResponse>(
      `/${accountId}/insights`,
      token,
      {
        metric,
        metric_type: 'total_value',
        period: 'lifetime',
        breakdown: 'time',
        since: String(unixFromDate(since)),
        until: String(unixFromDate(until)),
      },
    ).catch(() => null)

    if (histResp && !histResp.error && histResp.data?.[0]) {
      const dailyValues = extractDailyValues(histResp.data[0])
      if (dailyValues.length > 0) {
        const batch = db.batch()
        let updated = 0
        for (const { date, value } of dailyValues) {
          if (value > 0) {
            batch.set(
              db.collection('instagramAccount').doc(radarId).collection('insights').doc(date),
              { [firestoreField]: value, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
              { merge: true },
            )
            updated++
          }
        }
        if (updated > 0) {
          await batch.commit()
          console.log(`[syncInstagramInsights] ${label} histórico: ${updated} dias`)
        }
        return
      }
    }

    if (histResp?.error) {
      console.warn(`[syncInstagramInsights] ${label} histórico indisponível: ${histResp.error.message}`)
    }

    // Fallback: apenas valor de hoje
    const resp = await igFetch<IGInsightsResponse>(
      `/${accountId}/insights`,
      token,
      { metric, metric_type: 'total_value', period: 'day' },
    ).catch(() => null)

    if (!resp || resp.error || !resp.data?.[0]) {
      if (resp?.error) console.warn(`[syncInstagramInsights] ${label} indisponível: ${resp.error.message}`)
      return
    }

    const value = resp.data[0].total_value?.value ?? 0
    if (value > 0) {
      const today = toDateStr(new Date())
      await db.collection('instagramAccount').doc(radarId).collection('insights').doc(today).set(
        { [firestoreField]: value, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true },
      )
      console.log(`[syncInstagramInsights] ${label} hoje: ${value}`)
    }
  }

  // 'views' é o nome v21 de impressions; os demais mantêm o mesmo nome
  await syncDailyMetricV21('views',             'impressions',       'impressões')
  await syncDailyMetricV21('profile_views',     'profileViews',      'visitas ao perfil')
  await syncDailyMetricV21('website_clicks',    'websiteClicks',     'cliques no link')
  // accounts_engaged: contas únicas que interagiram (curtiu/comentou/salvou/compartilhou)
  await syncDailyMetricV21('accounts_engaged',  'accountsEngaged',   'contas engajadas')
  // total_interactions: soma de curtidas + comentários + salvos + compartilhamentos
  await syncDailyMetricV21('total_interactions','totalInteractions',  'interações totais')

  // ── 3. Online followers — matriz 7×24 (dia da semana × hora) ────────────────
  const onlineRes = await igFetch<IGOnlineFollowers>(
    `/${accountId}/insights`,
    token,
    { metric: 'online_followers', period: 'lifetime' },
  ).catch(() => null)

  if (onlineRes?.error) {
    console.warn(`[syncInstagramInsights] online_followers erro: ${onlineRes.error.message}`)
  } else {
    console.log(`[syncInstagramInsights] online_followers raw: ${JSON.stringify(onlineRes).slice(0, 500)}`)
    const valuesArr = onlineRes?.data?.[0]?.values ?? []
    // Monta matriz 7×24: matrix[dayOfWeek (0=Dom)][hour (0-23)]
    const matrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
    let populated = 0

    for (const entry of valuesArr) {
      const v = entry?.value
      if (!v || typeof v !== 'object' || Object.keys(v).length === 0) continue
      // end_time é o fim do período de 24h; o dia real é o próprio end_time (UTC)
      const endDate = entry.end_time ? new Date(entry.end_time) : null
      if (!endDate) continue
      const dow = endDate.getDay() // 0=Dom, 1=Seg, ..., 6=Sáb
      for (const [hourStr, count] of Object.entries(v)) {
        const h = parseInt(hourStr, 10)
        if (h >= 0 && h <= 23) {
          matrix[dow][h] = count as number
          populated++
        }
      }
    }

    if (populated > 0) {
      await db.collection('instagramAccount').doc(radarId)
        .collection('onlineFollowers').doc('weekly').set({
          matrix,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
      console.log(`[syncInstagramInsights] Online followers matriz salva (${populated} células)`)
    } else {
      console.warn('[syncInstagramInsights] online_followers: sem dados')
    }
  }

  // ── 3b. Aggregate insights com breakdowns (30 dias) ──────────────────────────
  interface IGAggResp {
    data?: { name: string; total_value?: { value?: number; breakdowns?: IGTotalValueBreakdown[] } }[]
    error?: { code: number; message: string }
  }

  // Busca breakdown para um período com since/until. Soma todos os itens da série retornada.
  // Fallback para "apenas hoje" se a API não retornar dados com range.
  async function fetchBreakdown(
    metric: string,
    breakdown: string,
    sinceDate: Date,
    untilDate: Date,
    label: string,
  ): Promise<Record<string, number>> {
    const resp = await igFetch<IGAggResp>(`/${accountId}/insights`, token, {
      metric,
      metric_type: 'total_value',
      period: 'day',
      breakdown,
      since: String(unixFromDate(sinceDate)),
      until: String(unixFromDate(untilDate)),
    }).catch(() => null)

    if (resp && !resp.error && resp.data && resp.data.length > 0) {
      const byKey: Record<string, number> = {}
      for (const item of resp.data) {
        for (const r of item.total_value?.breakdowns?.[0]?.results ?? []) {
          const k = r.dimension_values[0]
          byKey[k] = (byKey[k] ?? 0) + r.value
        }
      }
      if (Object.keys(byKey).length > 0) {
        console.log(`[agg${label}] ${metric}/${breakdown}: ${JSON.stringify(byKey)}`)
        return byKey
      }
    }
    if (resp?.error) console.warn(`[agg${label}] ${metric}/${breakdown}: ${resp.error.message}`)
    return {}
  }

  // Salva aggregateInsights para um período específico
  async function syncAggregateInsights(days: 7 | 14 | 30): Promise<void> {
    const periodUntil = new Date()
    const periodSince = new Date(periodUntil)
    periodSince.setDate(periodSince.getDate() - days)
    const label = String(days)

    const [
      viewsByFollow, viewsByMedia,
      reachByFollow, reachByMedia,
      interByFollow, interByMedia,
    ] = await Promise.all([
      fetchBreakdown('views', 'follow_type', periodSince, periodUntil, label),
      fetchBreakdown('views', 'media_product_type', periodSince, periodUntil, label),
      fetchBreakdown('reach', 'follow_type', periodSince, periodUntil, label),
      fetchBreakdown('reach', 'media_product_type', periodSince, periodUntil, label),
      fetchBreakdown('total_interactions', 'follow_type', periodSince, periodUntil, label),
      fetchBreakdown('total_interactions', 'media_product_type', periodSince, periodUntil, label),
    ])

    const aggDoc: Record<string, unknown> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }
    if (Object.keys(viewsByFollow).length > 0) aggDoc.viewsByFollowType = viewsByFollow
    if (Object.keys(viewsByMedia).length > 0) aggDoc.viewsByMediaType = viewsByMedia
    if (Object.keys(reachByFollow).length > 0) aggDoc.reachByFollowType = reachByFollow
    if (Object.keys(reachByMedia).length > 0) aggDoc.reachByMediaType = reachByMedia
    if (Object.keys(interByFollow).length > 0) aggDoc.interactionsByFollowType = interByFollow
    if (Object.keys(interByMedia).length > 0) aggDoc.interactionsByMediaType = interByMedia

    if (Object.keys(aggDoc).length > 1) {
      await db.collection('instagramAccount').doc(radarId)
        .collection('aggregateInsights').doc(`last${days}d`).set(aggDoc, { merge: true })
      console.log(`[syncInstagramInsights] Aggregate insights ${days}d salvos`)
    }
  }

  await syncAggregateInsights(7)
  await syncAggregateInsights(14)
  await syncAggregateInsights(30)

  // ── 4. Audience demographics (v21: follower_demographics com breakdown) ────────
  // API v21 descontinuou audience_country/city/gender_age — usa follower_demographics
  // com breakdown=country|city|age,gender. Resposta: total_value.breakdowns[0].results
  interface IGDemographicsResponse {
    data?: { total_value?: { breakdowns?: IGTotalValueBreakdown[] } }[]
    error?: { code: number; message: string }
  }

  type AudienceDef = { breakdown: string; docId: string; toKey: (dims: string[]) => string }
  const audienceDefs: AudienceDef[] = [
    // gender/age: dimension_values = [age, gender] → chave 'M.18-24'
    { breakdown: 'age,gender', docId: 'audience_gender_age', toKey: ([age, gender]) => `${gender}.${age}` },
    { breakdown: 'country',    docId: 'audience_country',    toKey: ([country]) => country },
    { breakdown: 'city',       docId: 'audience_city',       toKey: ([city]) => city },
  ]

  for (const { breakdown, docId, toKey } of audienceDefs) {
    const res = await igFetch<IGDemographicsResponse>(
      `/${accountId}/insights`,
      token,
      { metric: 'follower_demographics', period: 'lifetime', breakdown, metric_type: 'total_value' },
    ).catch(() => null)

    if (!res) { console.warn(`[syncInstagramInsights] audience ${docId}: sem resposta`); continue }
    if (res.error) { console.warn(`[syncInstagramInsights] audience ${docId}: ${res.error.message}`); continue }

    const results = res.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? []
    if (results.length === 0) { console.warn(`[syncInstagramInsights] audience ${docId}: sem dados`); continue }

    const data: Record<string, number> = {}
    for (const r of results) {
      const key = toKey(r.dimension_values)
      data[key] = (data[key] ?? 0) + r.value
    }

    await db.collection('instagramAccount').doc(radarId).collection('audience').doc(docId).set({
      metric: docId,
      data,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
    console.log(`[syncInstagramInsights] audience ${docId}: ${Object.keys(data).length} entradas`)
  }

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
    const postData = postDoc.data()
    const externalId: string = postData.externalId
    if (!externalId) continue

    const postUrl: string = postData.url ?? ''
    const isReel = postUrl.includes('/reel/') || (postData.insights?.plays ?? 0) > 0

    // Para Reels: inclui ig_reels_avg_watch_time na mesma chamada (evita segundo round-trip)
    const metricList = isReel
      ? 'impressions,reach,saved,video_views,shares,plays,ig_reels_avg_watch_time'
      : 'impressions,reach,saved,video_views,shares,plays'

    const insights = await igFetch<{ data: { name: string; values: { value: number }[] }[]; error?: { message: string } }>(
      `/${externalId}/insights`,
      token,
      { metric: metricList },
    ).catch(() => null)

    // Se Reel mas a chamada combinada falhou (API rejeita mix de métricas em alguns casos),
    // faz fallback sem ig_reels_avg_watch_time
    const insightsFinal = (!insights || insights.error) && isReel
      ? await igFetch<{ data: { name: string; values: { value: number }[] }[]; error?: { message: string } }>(
          `/${externalId}/insights`,
          token,
          { metric: 'impressions,reach,saved,video_views,shares,plays' },
        ).catch(() => null)
      : insights

    if (!insightsFinal || insightsFinal.error) continue

    const getMetric = (name: string): number =>
      insightsFinal.data?.find(m => m.name === name)?.values[0]?.value ?? 0

    const postUpdate: Record<string, unknown> = {
      'insights.reach': getMetric('reach'),
      'insights.impressions': getMetric('impressions'),
      'insights.saved': getMetric('saved'),
      'insights.videoViews': getMetric('video_views'),
      'insights.shares': getMetric('shares'),
      'insights.plays': getMetric('plays'),
      'insights.updatedAt': admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }

    const avgWatchTime = getMetric('ig_reels_avg_watch_time')
    if (avgWatchTime > 0) {
      postUpdate['insights.avgWatchTime'] = avgWatchTime
    }

    postBatch.update(postDoc.ref, postUpdate)
    postInsightsUpdated++
  }

  if (postInsightsUpdated > 0) {
    await postBatch.commit()
    console.log(`[syncInstagramInsights] ${postInsightsUpdated} posts com insights atualizados`)
  }

  console.log('[syncInstagramInsights] Concluído')
}
