import { useMemo, useRef } from 'react'
import { Download } from 'lucide-react'
import { useAccount, ACCOUNT_COLORS } from '@/contexts/AccountContext'

// ─── Stop-words ───────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'a','ao','aos','as','até','com','como','da','das','de','dela','delas','dele','deles',
  'depois','do','dos','e','ela','elas','ele','eles','em','entre','era','eram','essa','essas',
  'esse','esses','esta','estas','este','estes','eu','foi','for','forma','há','isso','isto',
  'já','lhe','lhes','mais','mas','me','mesmo','na','nas','nem','no','nos','o','os','ou',
  'para','pela','pelas','pelo','pelos','por','porque','que','quando','quem','se','ser',
  'seu','seus','só','sua','suas','também','te','tem','ter','teu','teus','tua','tuas',
  'tudo','um','uma','uns','umas','vai','vem','você','vocês','vou','é','não','sim','muito',
  'bem','aqui','ali','lá','ainda','então','antes','pois','assim','onde','qual','quais',
  'todo','toda','todos','todas','outro','outra','outros','outras','aquilo','aquela',
  'aquele','aquelas','aqueles','nada','cada','qualquer',
  'any','the','and','or','is','are','was','were','be','been',
  'rs','kkk','kk','k','né','aí','pra','pro','pras','pros','ta','tá','tô','tava',
])

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface WordFreq { word: string; count: number }

interface PlacedWord extends WordFreq {
  x: number; y: number
  w: number; h: number   // bounding box for collision
  fontSize: number
  opacity: number
  weight: number
}

// ─── Processamento ────────────────────────────────────────────────────────────

function processTexts(texts: string[]): WordFreq[] {
  const freq: Record<string, number> = {}
  for (const text of texts) {
    const words = text
      .toLowerCase()
      .replace(/@[\w.]+/g, ' ')           // remove @mencoes antes de tudo
      .replace(/[^a-záàãâéêíóôõúüçñ\s]/g, ' ')
      .split(/\s+/)
    for (const w of words) {
      if (w.length < 3) continue
      if (w.length > 20) continue         // nomes concatenados (franciscodossantos)
      if (STOPWORDS.has(w)) continue
      if (/^\d+$/.test(w)) continue
      freq[w] = (freq[w] ?? 0) + 1
    }
  }
  return Object.entries(freq)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 55)
}

// ─── Layout por espiral de Arquimedes ─────────────────────────────────────────
// Cada palavra é tentada em posições crescentes em espiral a partir do centro.
// Usamos bounding boxes para detectar colisão (rápido, suficiente para o caso).

function buildLayout(words: WordFreq[]): PlacedWord[] {
  if (words.length === 0) return []

  const maxCount = words[0].count
  const minCount = words[words.length - 1].count
  const range = maxCount - minCount || 1

  const placed: PlacedWord[] = []
  const PAD = 4   // espaço entre palavras

  for (const { word, count } of words) {
    const t = (count - minCount) / range              // 0 → 1
    const fontSize = Math.round(11 + t * 22)          // 11 → 33 px
    const opacity = 0.28 + t * 0.72                   // 28% → 100%
    const weight = t > 0.65 ? 700 : t > 0.3 ? 600 : 400

    // Aproximação de largura do texto (monospace ratio ~0.6)
    const w = word.length * fontSize * 0.6 + PAD * 2
    const h = fontSize * 1.35 + PAD * 2

    let px = 0, py = 0, found = false

    // Espiral de Arquimedes: θ cresce linearmente, r = a·θ
    for (let step = 0; step < 800; step++) {
      const theta = step * 0.25
      const r     = step * 0.9
      const cx = r * Math.cos(theta)
      const cy = r * Math.sin(theta) * 0.85  // leve achatamento

      let overlap = false
      for (const p of placed) {
        if (
          Math.abs(cx - p.x) < (w + p.w) / 2 &&
          Math.abs(cy - p.y) < (h + p.h) / 2
        ) { overlap = true; break }
      }

      if (!overlap) {
        px = cx; py = cy; found = true; break
      }
    }

    if (!found) continue   // palavra descartada se não couber

    placed.push({ word, count, x: px, y: py, w, h, fontSize, opacity, weight })
  }

  return placed
}

// ─── Componente ───────────────────────────────────────────────────────────────

interface WordCloudProps {
  texts: string[]
  loading?: boolean
  height?: number
}

export function WordCloud({ texts, loading, height = 210 }: WordCloudProps) {
  const { account } = useAccount()
  const color = ACCOUNT_COLORS[account]
  const svgRef = useRef<SVGSVGElement>(null)

  const words   = useMemo(() => processTexts(texts), [texts])
  const layout  = useMemo(() => buildLayout(words), [words])

  function downloadPNG() {
    if (!svgRef.current) return
    const isDark = document.documentElement.classList.contains('dark')
      || document.documentElement.getAttribute('data-theme') === 'dark'
    const bgColor = isDark ? '#0f1117' : '#ffffff'
    const svgEl = svgRef.current
    const { width, height } = svgEl.getBoundingClientRect()
    const clone = svgEl.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('width', String(width))
    clone.setAttribute('height', String(height))
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
    bg.setAttribute('width', '100%'); bg.setAttribute('height', '100%'); bg.setAttribute('fill', bgColor)
    clone.insertBefore(bg, clone.firstChild)
    const svgBlob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = width * 2; canvas.height = height * 2
      const ctx = canvas.getContext('2d')!
      ctx.scale(2, 2)
      ctx.fillStyle = bgColor; ctx.fillRect(0, 0, width, height)
      ctx.drawImage(img, 0, 0, width, height)
      URL.revokeObjectURL(url)
      canvas.toBlob(png => {
        if (!png) return
        const pngUrl = URL.createObjectURL(png)
        const a = document.createElement('a')
        a.href = pngUrl; a.download = `nuvem-${account}.png`; a.click()
        URL.revokeObjectURL(pngUrl)
      }, 'image/png')
    }
    img.src = url
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex flex-wrap gap-2 py-6 px-4 justify-center">
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="rounded bg-muted animate-pulse inline-block"
            style={{ width: `${28 + (i % 8) * 17}px`, height: `${10 + (i % 4) * 4}px` }}
          />
        ))}
      </div>
    )
  }

  // ── Empty ──
  if (words.length === 0) {
    return (
      <p className="text-sm text-muted-foreground/50 italic text-center py-10">
        Nenhum comentário neste período.
      </p>
    )
  }

  if (layout.length === 0) return null

  // ── ViewBox ──
  const xs = layout.flatMap(p => [p.x - p.w / 2, p.x + p.w / 2])
  const ys = layout.flatMap(p => [p.y - p.h / 2, p.y + p.h / 2])
  const M  = 12
  const vx = Math.min(...xs) - M
  const vy = Math.min(...ys) - M
  const vw = Math.max(...xs) - Math.min(...xs) + M * 2
  const vh = Math.max(...ys) - Math.min(...ys) + M * 2

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`${vx} ${vy} ${vw} ${vh}`}
        style={{ width: '100%', height: `${height}px`, display: 'block' }}
        preserveAspectRatio="xMidYMid meet"
        aria-label="Nuvem de palavras"
      >
        {layout.map(({ word, count, x, y, fontSize, opacity, weight }) => (
          <text
            key={word}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={fontSize}
            fontWeight={weight}
            fill={color}
            fillOpacity={opacity}
            style={{ cursor: 'default', userSelect: 'none' }}
          >
            <title>{count} menção{count !== 1 ? 'ões' : ''}</title>
            {word}
          </text>
        ))}
      </svg>
      <div className="flex justify-end mt-2">
        <button
          onClick={downloadPNG}
          className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          title="Baixar nuvem como PNG"
        >
          <Download className="w-3 h-3" />
          baixar PNG
        </button>
      </div>
    </div>
  )
}
