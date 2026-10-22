import * as admin from 'firebase-admin'

interface TrendTopic {
  rank: number
  title: string
  score?: string
  duration?: string
}

interface TrendsSnapshot {
  updatedAt: admin.firestore.FieldValue
  topics: TrendTopic[]
  error?: string
}

// ─── Google Trends RSS ────────────────────────────────────────────────────────

async function fetchGoogleTrends(): Promise<TrendTopic[]> {
  const url = 'https://trends.google.com/trending/rss?geo=BR'
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RadarBot/1.0)' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Google Trends RSS: HTTP ${res.status}`)
  const xml = await res.text()

  const items: TrendTopic[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match: RegExpExecArray | null
  let rank = 1

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1]
    const titleMatch = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                       block.match(/<title>(.*?)<\/title>/)
    const trafficMatch = block.match(/<ht:approx_traffic>(.*?)<\/ht:approx_traffic>/)

    if (titleMatch?.[1]) {
      items.push({
        rank: rank++,
        title: titleMatch[1].trim(),
        score: trafficMatch?.[1]?.trim(),
      })
    }
    if (rank > 25) break
  }

  return items
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

  return topics.sort((a, b) => a.rank - b.rank).slice(0, 25)
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function fetchAndStoreTrends(db: admin.firestore.Firestore): Promise<void> {
  const batch = db.batch()
  const col = db.collection('trends')

  // Google Trends
  try {
    const topics = await fetchGoogleTrends()
    console.log(`[fetchTrends] Google: ${topics.length} topics`)
    const snap: TrendsSnapshot = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      topics,
    }
    batch.set(col.doc('google'), snap)
  } catch (err) {
    console.error('[fetchTrends] Google error:', err)
    batch.set(col.doc('google'), {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      topics: [],
      error: err instanceof Error ? err.message : String(err),
    } satisfies TrendsSnapshot)
  }

  // Twitter via getdaytrends
  try {
    const topics = await fetchTwitterTrends()
    console.log(`[fetchTrends] Twitter: ${topics.length} topics`)
    const snap: TrendsSnapshot = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      topics,
    }
    batch.set(col.doc('twitter'), snap)
  } catch (err) {
    console.error('[fetchTrends] Twitter error:', err)
    batch.set(col.doc('twitter'), {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      topics: [],
      error: err instanceof Error ? err.message : String(err),
    } satisfies TrendsSnapshot)
  }

  await batch.commit()
  console.log('[fetchTrends] Salvo no Firestore')
}
