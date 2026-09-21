import { useMemo } from 'react'
import {
  ComposedChart, Bar, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import type { RadarPost } from '@/types/radar'
import type { TimeFilter } from '@/types/radar'

interface ActivityChartProps {
  posts: RadarPost[]
  loading?: boolean
  timeFilter?: TimeFilter
}

interface ChartSlot {
  label: string
  key: string
  comments: number
  likes: number
  posts: number
  trending: number
}

// ─── Builders ─────────────────────────────────────────────────────────────────

function buildHourlySlots(posts: RadarPost[], hours: number): ChartSlot[] {
  const now = new Date()
  const slots: ChartSlot[] = []

  for (let i = hours - 1; i >= 0; i--) {
    const h = new Date(now)
    h.setHours(now.getHours() - i, 0, 0, 0)
    slots.push({
      label: `${String(h.getHours()).padStart(2, '0')}h`,
      key: `${h.getFullYear()}-${h.getMonth()}-${h.getDate()}-${h.getHours()}`,
      comments: 0, likes: 0, posts: 0, trending: 0,
    })
  }

  const cutoff = new Date(now.getTime() - hours * 3_600_000)
  for (const post of posts) {
    const d = post.publishedAt.toDate()
    if (d < cutoff) continue
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`
    const slot = slots.find(s => s.key === key)
    if (!slot) continue
    slot.posts++
    slot.comments += post.metrics.comments
    slot.likes += post.metrics.likes
    if (post.status === 'trending') slot.trending++
  }
  return slots
}

function buildDailySlots(posts: RadarPost[], days: number): ChartSlot[] {
  const now = new Date()
  const slots: ChartSlot[] = []

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    d.setHours(0, 0, 0, 0)
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const label = days <= 7
      ? d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
      : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
    slots.push({ label, key, comments: 0, likes: 0, posts: 0, trending: 0 })
  }

  const cutoff = new Date(now.getTime() - days * 86_400_000)
  for (const post of posts) {
    const d = post.publishedAt.toDate()
    if (d < cutoff) continue
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const slot = slots.find(s => s.key === key)
    if (!slot) continue
    slot.posts++
    slot.comments += post.metrics.comments
    slot.likes += post.metrics.likes
    if (post.status === 'trending') slot.trending++
  }
  return slots
}

function buildAllSlots(posts: RadarPost[]): ChartSlot[] {
  if (posts.length === 0) return []

  const oldest = Math.min(...posts.map(p => p.publishedAt.toDate().getTime()))
  const now = Date.now()
  const totalDays = Math.max(1, Math.ceil((now - oldest) / 86_400_000))

  const slotMap = new Map<string, ChartSlot>()

  for (const post of posts) {
    const d = post.publishedAt.toDate()
    let key: string
    let label: string

    if (totalDays > 60) {
      // Semanas
      const monday = new Date(d)
      monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
      monday.setHours(0, 0, 0, 0)
      key = monday.toISOString().slice(0, 10)
      label = monday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
    }

    if (!slotMap.has(key)) slotMap.set(key, { label, key, comments: 0, likes: 0, posts: 0, trending: 0 })
    const slot = slotMap.get(key)!
    slot.posts++
    slot.comments += post.metrics.comments
    slot.likes += post.metrics.likes
    if (post.status === 'trending') slot.trending++
  }

  return Array.from(slotMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, v]) => v)
}

function buildChartData(posts: RadarPost[], tf: TimeFilter): ChartSlot[] {
  switch (tf) {
    case 'now':  return buildHourlySlots(posts, 24)
    case '3h':   return buildHourlySlots(posts, 3)
    case '6h':   return buildHourlySlots(posts, 6)
    case '24h':  return buildHourlySlots(posts, 24)
    case '3d':   return buildDailySlots(posts, 3)
    case '7d':   return buildDailySlots(posts, 7)
    case '15d':  return buildDailySlots(posts, 15)
    case '30d':  return buildDailySlots(posts, 30)
    case 'all':  return buildAllSlots(posts)
    default:     return buildHourlySlots(posts, 24)
  }
}

function xInterval(slotCount: number): number {
  if (slotCount <= 8) return 0
  if (slotCount <= 16) return 1
  if (slotCount <= 24) return 3
  return Math.floor(slotCount / 8)
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: {
  active?: boolean
  payload?: { value: number; dataKey: string }[]
  label?: string
}) => {
  if (!active || !payload?.length) return null
  const comments = payload.find(p => p.dataKey === 'comments')?.value ?? 0
  const likes    = payload.find(p => p.dataKey === 'likes')?.value ?? 0
  const posts    = payload.find(p => p.dataKey === 'posts')?.value ?? 0
  const trending = payload.find(p => p.dataKey === 'trending')?.value ?? 0
  const total    = comments + likes
  const avgComt  = posts > 0 ? Math.round(comments / posts) : 0
  const trendPct = posts > 0 ? Math.round((trending / posts) * 100) : 0

  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-xs space-y-1.5 min-w-48">
      <p className="font-bold text-foreground text-sm capitalize">{label}</p>
      <div className="space-y-1 pt-1 border-t border-border/50">
        {posts > 0 && (
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="w-2 h-2 rounded-sm bg-primary/50" />publicações
            </span>
            <span className="font-bold text-foreground">{posts}</span>
          </div>
        )}
        {comments > 0 && (
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-primary" />comentários
            </span>
            <span className="font-bold text-primary">{comments.toLocaleString('pt-BR')}</span>
          </div>
        )}
        {avgComt > 0 && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground/70 pl-3.5">média/post</span>
            <span className="font-semibold text-primary/70">~{avgComt.toLocaleString('pt-BR')}</span>
          </div>
        )}
        {likes > 0 && (
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-pink-400/80" />reações
            </span>
            <span className="font-bold text-pink-400">{likes.toLocaleString('pt-BR')}</span>
          </div>
        )}
        {trending > 0 && (
          <div className="flex items-center justify-between gap-4 pt-1 border-t border-border/50">
            <span className="flex items-center gap-1.5 text-red-400">
              <span className="w-2 h-2 rounded-full bg-red-500 dot-blink" />repercutindo
            </span>
            <span className="font-bold text-red-400">{trending} <span className="font-normal opacity-70">({trendPct}%)</span></span>
          </div>
        )}
        {total > 0 && (
          <div className="flex items-center justify-between gap-4 pt-1 border-t border-border/50">
            <span className="text-muted-foreground/70">engajamento total</span>
            <span className="font-bold text-foreground">{total.toLocaleString('pt-BR')}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ActivityChart({ posts, loading, timeFilter = 'all' }: ActivityChartProps) {
  const data = useMemo(() => buildChartData(posts, timeFilter), [posts, timeFilter])
  const hasData = data.some(d => d.comments + d.posts > 0)
  const maxComments = Math.max(...data.map(d => d.comments), 1)
  const maxPosts    = Math.max(...data.map(d => d.posts), 1)

  const isHourly = ['now', '3h', '6h', '24h'].includes(timeFilter)
  const unitLabel = isHourly ? 'hora' : 'dia'

  if (loading) {
    return (
      <div className="h-36 flex items-end gap-0.5 px-2 pb-2">
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-secondary/70 rounded-t animate-pulse"
            style={{ height: `${15 + (Math.sin(i * 0.7) + 1) * 35}%`, animationDelay: `${i * 40}ms` }}
          />
        ))}
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className="h-36 flex flex-col items-center justify-center gap-1">
        <p className="text-xs text-muted-foreground/70 italic">Sem atividade no período selecionado</p>
        <p className="text-[10px] text-muted-foreground/40">Tente ampliar o período ou aguarde novos posts</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground/70">
        <span className="flex items-center gap-1">
          <span className="w-3 h-1.5 rounded bg-primary/70 inline-block" />comentários
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-1.5 rounded bg-pink-400/50 inline-block" />reações
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm border border-primary/40 bg-primary/10 inline-block" />posts
        </span>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="gradComments" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="hsl(210 100% 56%)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="hsl(210 100% 56%)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gradLikes" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#f472b6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#f472b6" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke="rgba(128,128,128,0.08)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: 'hsl(215 15% 50%)' }}
            tickLine={false}
            axisLine={false}
            interval={xInterval(data.length)}
          />
          <YAxis
            yAxisId="eng"
            orientation="left"
            tick={{ fontSize: 9, fill: 'hsl(215 15% 50%)' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={32}
            tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
          />
          <YAxis
            yAxisId="posts"
            orientation="right"
            tick={{ fontSize: 9, fill: 'hsl(215 15% 50%)' }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={20}
            domain={[0, Math.max(maxPosts * 2, 4)]}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar yAxisId="posts" dataKey="posts" fill="hsl(210 100% 56% / 0.18)"
            stroke="hsl(210 100% 56% / 0.4)" strokeWidth={1} radius={[2, 2, 0, 0]} maxBarSize={14} />
          <Area yAxisId="eng" type="monotone" dataKey="likes"
            stroke="#f472b6" strokeWidth={1} fill="url(#gradLikes)" strokeDasharray="4 2" />
          <Area yAxisId="eng" type="monotone" dataKey="comments"
            stroke="hsl(210 100% 56%)" strokeWidth={2} fill="url(#gradComments)" />
        </ComposedChart>
      </ResponsiveContainer>
      {maxComments > 0 && (
        <p className="text-[10px] text-muted-foreground/50 text-right">
          pico de {maxComments.toLocaleString('pt-BR')} comentários por {unitLabel}
        </p>
      )}
    </div>
  )
}
