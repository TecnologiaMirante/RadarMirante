// Debug: procura dados de trending no HTML da página do Google
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

console.log('=== trends.google.com/trending?geo=BR — procurando AF_initDataCallback({...) ===')
try {
  const res = await fetch('https://trends.google.com/trending?geo=BR', {
    headers: HEADERS, signal: AbortSignal.timeout(15_000),
  })
  const html = await res.text()
  console.log('Total chars:', html.length)

  // Mostra tudo em torno de cada ds: key
  const dsMatches = [...html.matchAll(/key:\s*'(ds:\d+)'/g)]
  console.log('Keys ds: encontradas:', dsMatches.map(x => x[1]).join(', '))
  for (const m of dsMatches) {
    const pos = m.index
    console.log(`\n=== ${m[1]} (posição ${pos}) — contexto ===`)
    console.log(html.slice(Math.max(0, pos - 30), pos + 800))
    console.log('...')
  }

  // Tenta padrão alternativo do AF_initDataCallback
  const alt = html.indexOf('AF_initDataCallback(')
  if (alt !== -1) {
    console.log('\n=== Primeiro AF_initDataCallback( ===')
    console.log(html.slice(alt, alt + 600))
  }

} catch (e) { console.error('Erro:', e.message) }
