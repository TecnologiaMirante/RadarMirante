import * as admin from 'firebase-admin'

interface NewsItem {
  title: string
  snippet: string
  source: string
  url: string
}

interface TrendTopic {
  rank: number
  title: string
  score?: string
  duration?: string
  newsItems?: NewsItem[]
}

function makeDocId(platform: string, title: string): string {
  const key = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
  return `${platform}_${key}`
}


// ─── Google News context ─────────────────────────────────────────────────────

// Artigos de cobertura ao vivo / prévia — não explicam o porquê
const SKIP_PATTERN = /\b(ao vivo|minuto a minuto|onde assistir|hor[aá]rio|palpite|escala[çc][õo]es|transmiss[aã]o|assistir online|quando come[çc]a|placar ao|resultado ao|live blog|watch live)\b/i

async function fetchNewsContext(query: string): Promise<NewsItem | null> {
  try {
    const clean = query.startsWith('#') ? query.slice(1) : query
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(clean)}&hl=pt-BR&gl=BR&ceid=BR:pt`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9',
        'Accept': 'application/rss+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) return null
    const xml = await res.text()

    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    if (!items.length) return null

    for (const m of items.slice(0, 8)) {
      const item = m[1]
      const rawTitle = (
        item.match(/<title><!\[CDATA\[([^\]]*)\]\]><\/title>/)?.[1] ??
        item.match(/<title>([^<]*)<\/title>/)?.[1]
      )?.trim()
      if (!rawTitle || rawTitle.length < 5) continue
      if (SKIP_PATTERN.test(rawTitle)) continue

      const source = item.match(/<source[^>]*>([^<]+)<\/source>/)?.[1]?.trim() ?? ''

      // A URL real do artigo fica no href do primeiro <a> dentro do <description>
      const desc    = item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/)?.[1] ?? ''
      const link    = desc.match(/<a\s+href="([^"]+)"/)?.[1]?.trim()
                   ?? item.match(/<guid[^>]*>([^<]+)<\/guid>/)?.[1]?.trim()
                   ?? `https://news.google.com/search?q=${encodeURIComponent(clean)}&hl=pt-BR`

      const cleanTitle = rawTitle.replace(/\s*-\s*[^-]{2,40}$/, '').trim() || rawTitle

      return { title: cleanTitle, snippet: cleanTitle, source, url: link }
    }

    return null
  } catch {
    return null
  }
}

// ─── Google Trends ────────────────────────────────────────────────────────────

const GOOGLE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Referer': 'https://trends.google.com/',
}

function formatVolume(v: number): string | undefined {
  if (v >= 1_000_000) return `${Math.round(v / 1_000_000)}M+`
  if (v >= 1_000)     return `${Math.round(v / 1_000)}K+`
  if (v > 0)          return `${v}+`
  return undefined
}

async function fetchGoogleTrends(): Promise<TrendTopic[]> {
  const url = 'https://trends.google.com/trending?geo=BR'
  const res = await fetch(url, { headers: GOOGLE_HEADERS, signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`Google Trends page: HTTP ${res.status}`)
  const html = await res.text()

  // O ds:0 contém o array de trending searches embutido no HTML
  const dataStart = html.indexOf("key: 'ds:0'")
  if (dataStart === -1) throw new Error('ds:0 não encontrado na página')

  const arrStart = html.indexOf('data:[', dataStart)
  if (arrStart === -1) throw new Error('data:[ não encontrado')

  // Delimitador de fim confiável: ], sideChannel:
  const arrEnd = html.indexOf('], sideChannel:', arrStart)
  if (arrEnd === -1) throw new Error('fim do array não encontrado')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw: any[] = JSON.parse(html.slice(arrStart + 5, arrEnd + 1))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items: any[][] = raw?.[1] ?? []
  if (!items.length) throw new Error('array de trending vazio')

  const base = items.slice(0, 25).map((item, idx) => {
    const title   = String(item[0] ?? '')
    const volume  = typeof item[6] === 'number' ? item[6] : 0
    const related: string[] = Array.isArray(item[9]) ? item[9].slice(0, 6) : []

    const score   = formatVolume(volume)
    const snippet = related.length ? related.join(' · ') : undefined

    return {
      rank: idx + 1,
      title,
      ...(score   ? { score }   : {}),
      // Related queries like fallback; top 5 will be overwritten with real news below
      ...(snippet ? {
        newsItems: [{
          title:   'Buscas relacionadas',
          snippet,
          source:  '',
          url:     `https://trends.google.com/trending?geo=BR`,
        }],
      } : {}),
    }
  }).filter(t => t.title)

  // Enrich top 5 with a real news article (replaces related queries)
  await Promise.allSettled(
    base.slice(0, 5).map(async (t, i) => {
      const news = await fetchNewsContext(t.title)
      if (news) base[i] = { ...base[i], newsItems: [news] }
    })
  )

  return base
}

// ─── Twitter/X via getdaytrends.com ──────────────────────────────────────────

async function fetchTwitterTrends(): Promise<TrendTopic[]> {
  const url = 'https://getdaytrends.com/pt/brazil/'
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'pt-BR,pt;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`getdaytrends: HTTP ${res.status}`)
  const html = await res.text()

  const topics: TrendTopic[] = []

  // Extract the current trending list (numbered items in the main table)
  // Pattern: <td class="...rank...">N</td> ... <td>TITLE</td>
  // Simpler: extract from the main trend list section
  const listSection = html.match(/Hora UTC[\s\S]*?Top Hashtags/)?.[0] ?? html

  // Look for numbered entries: "1\n\n\n#Topic\n"
  const entryRegex = /\b(\d{1,2})\s*\n[\s\S]{0,200}?<a[^>]+href="[^"]*\/trend\/[^"]*"[^>]*>\s*([^<]+)\s*<\/a>/g
  let match: RegExpExecArray | null
  const seen = new Set<string>()

  while ((match = entryRegex.exec(listSection)) !== null) {
    const rank = parseInt(match[1])
    const title = match[2].trim()
    if (rank >= 1 && rank <= 50 && title && !seen.has(title)) {
      seen.add(title)
      topics.push({ rank, title })
    }
  }

  if (topics.length === 0) {
    // Fallback: extract any /trend/ links with text
    const linkRegex = /<a[^>]+href="[^"]*\/trend\/[^"]*"[^>]*>\s*([^<\n]{2,60})\s*<\/a>/g
    let rank = 1
    while ((match = linkRegex.exec(html)) !== null && rank <= 30) {
      const title = match[1].trim()
      if (title && !seen.has(title) && !title.includes('trend') && title.length > 1) {
        seen.add(title)
        topics.push({ rank: rank++, title })
      }
    }
  }

  const sorted = topics.sort((a, b) => a.rank - b.rank).slice(0, 25)

  // Enrich top 10 with news context
  await Promise.allSettled(
    sorted.slice(0, 10).map(async (t, i) => {
      const news = await fetchNewsContext(t.title)
      if (news) sorted[i] = { ...sorted[i], newsItems: [news] }
    })
  )

  return sorted
}

// ─── Upsert + cleanup ────────────────────────────────────────────────────────

async function upsertTrends(
  db: admin.firestore.Firestore,
  platform: 'google' | 'twitter',
  topics: TrendTopic[],
): Promise<void> {
  if (!topics.length) return

  const col  = db.collection('trends_history')
  const now  = admin.firestore.Timestamp.now()
  const sevenDays = 7 * 24 * 60 * 60
  const expiresAt = new admin.firestore.Timestamp(now.seconds + sevenDays, 0)

  const refs  = topics.map(t => col.doc(makeDocId(platform, t.title)))
  const snaps = await db.getAll(...refs)

  const batch = db.batch()
  topics.forEach((topic, i) => {
    const ref    = refs[i]
    const exists = snaps[i].exists

    const fields: Record<string, unknown> = {
      platform,
      title:    topic.title,
      rank:     topic.rank,
      lastSeen: now,
      expiresAt,
      ...(topic.score     ? { score:     topic.score }     : {}),
      ...(topic.newsItems ? { newsItems: topic.newsItems } : {}),
    }

    if (exists) {
      batch.update(ref, fields)
    } else {
      batch.set(ref, { ...fields, firstSeen: now })
    }
  })

  await batch.commit()

  // Cleanup expirados (fire-and-forget)
  col.where('platform', '==', platform)
    .where('expiresAt', '<', now)
    .get()
    .then(snap => {
      if (snap.empty) return
      const del = db.batch()
      snap.docs.forEach(d => del.delete(d.ref))
      return del.commit()
    })
    .catch(err => console.error(`[fetchTrends] cleanup ${platform}:`, err))
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function fetchAndStoreTrends(db: admin.firestore.Firestore): Promise<void> {
  try {
    const topics = await fetchGoogleTrends()
    console.log(`[fetchTrends] Google: ${topics.length} topics`)
    await upsertTrends(db, 'google', topics)
  } catch (err) {
    console.error('[fetchTrends] Google error:', err)
  }

  try {
    const topics = await fetchTwitterTrends()
    console.log(`[fetchTrends] Twitter: ${topics.length} topics`)
    await upsertTrends(db, 'twitter', topics)
  } catch (err) {
    console.error('[fetchTrends] Twitter error:', err)
  }

  console.log('[fetchTrends] Concluído')
}
