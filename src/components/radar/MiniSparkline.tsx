// Mini sparkline SVG — gerado a partir do score para dar sensação de tendência
// sem dados históricos por post, o shape é derivado do score atual

interface MiniSparklineProps {
  score: number
  color?: string
  width?: number
  height?: number
}

export function MiniSparkline({ score, color = '#3b82f6', width = 56, height = 24 }: MiniSparklineProps) {
  // Gera 7 pontos suavizados que "chegam" ao score atual
  const normalized = Math.min(Math.max(score, 0), 100) / 100
  const seed = score * 137.508 // número áureo para pseudo-random determinístico

  function pseudoRand(i: number) {
    return ((Math.sin(seed + i * 9.301) + 1) / 2)
  }

  const points: [number, number][] = []
  for (let i = 0; i < 7; i++) {
    const t = i / 6
    // Valor: começa baixo, sobe em direção ao score atual com ruído
    const base = t * normalized
    const noise = pseudoRand(i) * 0.2 - 0.1
    const v = Math.min(Math.max(base + noise, 0), 1)
    const x = (i / 6) * width
    const y = height - v * (height - 2) - 1
    points.push([x, y])
  }

  const pathD = points
    .map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`))
    .join(' ')

  const areaD = `${pathD} L${width},${height} L0,${height} Z`

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none">
      <path d={areaD} fill={color} fillOpacity={0.08} />
      <path d={pathD} stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {/* Dot at the end */}
      <circle
        cx={points[points.length - 1][0]}
        cy={points[points.length - 1][1]}
        r={2}
        fill={color}
      />
    </svg>
  )
}
