// Script para testar o fetchTrends localmente (sem deploy)
// Uso: node scripts/testTrends.mjs
import { initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

initializeApp({ projectId: 'radarimirante' })
const db = getFirestore()

async function fetchGoogleTrends() {
  const url = 'https://trends.google.com/trending/rss?geo=BR'
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RadarBot/1.0)' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Google Trends RSS: HTTP ${res.status}`)
  const xml = await res.text()

  const items = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match
  let rank = 1
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]
    const titleMatch = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                       block.match(/<title>(.*?)<\/title>/)
    const trafficMatch = block.match(/<ht:approx_traffic>(.*?)<\/ht:approx_traffic>/)
    if (titleMatch?.[1]) {
      items.push({ rank: rank++, title: titleMatch[1].trim(), score: trafficMatch?.[1]?.trim() })
    }
    if (rank > 25) break
  }
  return items
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
  return topics.sort((a, b) => a.rank - b.rank).slice(0, 25)
}

const batch = db.batch()
const col = db.collection('trends')

console.log('Buscando Google Trends BR...')
const gTopics = await fetchGoogleTrends()
console.log(`  → ${gTopics.length} topics`)
console.log(gTopics.slice(0, 5).map(t => `  ${t.rank}. ${t.title} (${t.score ?? ''})`).join('\n'))
batch.set(col.doc('google'), { updatedAt: new Date(), topics: gTopics })

console.log('\nBuscando Twitter trends (getdaytrends)...')
const tTopics = await fetchTwitterTrends()
console.log(`  → ${tTopics.length} topics`)
console.log(tTopics.slice(0, 5).map(t => `  ${t.rank}. ${t.title}`).join('\n'))
batch.set(col.doc('twitter'), { updatedAt: new Date(), topics: tTopics })

await batch.commit()
console.log('\n✅ Salvo no Firestore! Abra o Radar em /tendencias para ver.')
process.exit(0)
