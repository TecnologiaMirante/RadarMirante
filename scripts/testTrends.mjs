// Script para testar o fetchTrends localmente (sem deploy)
// Uso: node scripts/testTrends.mjs
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

initializeApp({ projectId: 'radarimirante' })
const db = getFirestore()

const GOOGLE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  'Accept': 'text/html,application/xhtml+xml,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Referer': 'https://trends.google.com/',
}

function formatVolume(v) {
  if (v >= 1_000_000) return `${Math.round(v / 1_000_000)}M+`
  if (v >= 1_000)     return `${Math.round(v / 1_000)}K+`
  if (v > 0)          return `${v}+`
  return undefined
}

const SKIP_PATTERN = /\b(ao vivo|minuto a minuto|onde assistir|hor[aá]rio|palpite|escala[çc][õo]es|transmiss[aã]o|assistir online|quando come[çc]a|placar ao|resultado ao|live blog|watch live)\b/i

async function fetchNewsContext(query) {
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

async function fetchGoogleTrends() {
  const url = 'https://trends.google.com/trending?geo=BR'
  const res = await fetch(url, { headers: GOOGLE_HEADERS, signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`Google Trends: HTTP ${res.status}`)
  const html = await res.text()

  const dataStart = html.indexOf("key: 'ds:0'")
  if (dataStart === -1) throw new Error('ds:0 não encontrado')
  const arrStart = html.indexOf('data:[', dataStart)
  if (arrStart === -1) throw new Error('data:[ não encontrado')
  const arrEnd = html.indexOf('], sideChannel:', arrStart)
  if (arrEnd === -1) throw new Error('fim do array não encontrado')

  const raw = JSON.parse(html.slice(arrStart + 5, arrEnd + 1))
  const items = raw?.[1] ?? []
  if (!items.length) throw new Error('array vazio')

  const base = items.slice(0, 25).map((item, idx) => {
    const title   = String(item[0] ?? '')
    const volume  = typeof item[6] === 'number' ? item[6] : 0
    const related = Array.isArray(item[9]) ? item[9].slice(0, 6) : []
    const score   = formatVolume(volume)
    const snippet = related.length ? related.join(' · ') : undefined

    return {
      rank: idx + 1,
      title,
      ...(score   ? { score }   : {}),
      ...(snippet ? {
        newsItems: [{ title: 'Buscas relacionadas', snippet, source: '', url: 'https://trends.google.com/trending?geo=BR' }],
      } : {}),
    }
  }).filter(t => t.title)

  // Enrich top 5 with real news article
  await Promise.allSettled(
    base.slice(0, 5).map(async (t, i) => {
      const news = await fetchNewsContext(t.title)
      if (news) base[i] = { ...base[i], newsItems: [news] }
    })
  )

  return base
}

async function fetchTwitterTrends() {
  const url = 'https://getdaytrends.com/pt/brazil/'
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'pt-BR,pt;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`getdaytrends: HTTP ${res.status}`)
  const html = await res.text()

  const topics = []
  const seen = new Set()
  const listSection = html.match(/Hora UTC[\s\S]*?Top Hashtags/)?.[0] ?? html
  const entryRegex = /\b(\d{1,2})\s*\n[\s\S]{0,200}?<a[^>]+href="[^"]*\/trend\/[^"]*"[^>]*>\s*([^<]+)\s*<\/a>/g
  let match
  while ((match = entryRegex.exec(listSection)) !== null) {
    const rank = parseInt(match[1])
    const title = match[2].trim()
    if (rank >= 1 && rank <= 50 && title && !seen.has(title)) {
      seen.add(title)
      topics.push({ rank, title })
    }
  }
  if (topics.length === 0) {
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

function makeDocId(platform, title) {
  const key = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80)
  return `${platform}_${key}`
}

async function upsertTrends(platform, topics) {
  if (!topics.length) return
  const col = db.collection('trends_history')
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  const refs = topics.map(t => col.doc(makeDocId(platform, t.title)))
  const snaps = await db.getAll(...refs)

  const batch = db.batch()
  topics.forEach((topic, i) => {
    const ref = refs[i]
    const exists = snaps[i].exists

    const fields = {
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
}

console.log('Buscando Google Trends BR...')
const gTopics = await fetchGoogleTrends()
console.log(`  → ${gTopics.length} topics`)
console.log(gTopics.slice(0, 5).map(t => {
  const vol = t.score ? ` [${t.score}]` : ''
  const n = t.newsItems?.[0]
  const ctx = n ? `\n     → ${n.title}${n.source ? ` (${n.source})` : ''}` : ''
  return `  ${t.rank}. ${t.title}${vol}${ctx}`
}).join('\n'))
await upsertTrends('google', gTopics)

console.log('\nBuscando Twitter trends (getdaytrends)...')
const tTopics = await fetchTwitterTrends()
console.log(`  → ${tTopics.length} topics`)
console.log(tTopics.slice(0, 5).map(t => {
  const n = t.newsItems?.[0]
  const ctx = n ? `\n     → ${n.title}${n.source ? ` (${n.source})` : ''}` : ''
  return `  ${t.rank}. ${t.title}${ctx}`
}).join('\n'))
await upsertTrends('twitter', tTopics)

console.log('\n✅ Salvo no Firestore (trends_history)! Abra o Radar em /tendencias para ver.')
process.exit(0)
