import { useMemo } from 'react'
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
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
    case 'now':    return buildHourlySlots(posts, 24)
    case '3h':     return buildHourlySlots(posts, 3)
    case '6h':     return buildHourlySlots(posts, 6)
    case '24h':    return buildHourlySlots(posts, 24)
    case '2d':     return buildDailySlots(posts, 2)
    case '3d':     return buildDailySlots(posts, 3)
    case '7d':     return buildDailySlots(posts, 7)
    case '15d':    return buildDailySlots(posts, 15)
    case '30d':    return buildDailySlots(posts, 30)
    case 'all':
    case 'custom': return buildAllSlots(posts)
    default:       return buildHourlySlots(posts, 24)
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
  payload?: { payload?: ChartSlot }[]
  label?: string
}) => {
  if (!active || !payload?.length) return null
  const slot      = payload[0]?.payload
  if (!slot) return null
  const comments  = slot.comments
  const likes     = slot.likes
  const posts     = slot.posts
  const trending  = slot.trending
  const avgComt   = posts > 0 ? Math.round(comments / posts) : 0
  const trendPct  = posts > 0 ? Math.round((trending / posts) * 100) : 0

  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-xl text-xs space-y-1.5 min-w-44">
      <p className="font-bold text-foreground text-sm capitalize">{label}</p>
      <div className="space-y-1 pt-1 border-t border-border/50">
        {posts > 0 && (
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="w-2 h-2 rounded-sm bg-muted-foreground/40" />publicações
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
            <span className="font-semibold text-primary/70">~{avgComt}</span>
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
              <span className="w-2 h-2 rounded-full bg-red-500" />repercutindo
            </span>
            <span className="font-bold text-red-400">{trending} <span className="font-normal opacity-70">({trendPct}%)</span></span>
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

  const totalComments = data.reduce((sum, d) => sum + d.comments, 0)
  const maxComments   = Math.max(...data.map(d => d.comments), 1)
  const avgSlot       = data.length > 0 ? Math.round(totalComments / data.length) : 0

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex gap-4 px-1">
          {[40, 28, 36].map((w, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="h-2 bg-secondary/60 rounded animate-pulse" style={{ width: w }} />
              <div className="h-4 bg-secondary/80 rounded animate-pulse" style={{ width: w + 8 }} />
            </div>
          ))}
        </div>
        <div className="h-24 flex items-end gap-0.5 px-1">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 bg-secondary/50 rounded-t animate-pulse"
              style={{ height: `${20 + (Math.sin(i * 0.8) + 1) * 40}%`, animationDelay: `${i * 40}ms` }}
            />
          ))}
        </div>
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
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }} barCategoryGap="18%">
        <XAxis
          dataKey="label"
          tick={{ fontSize: 9, fill: 'hsl(215 15% 45%)' }}
          tickLine={false}
          axisLine={false}
          interval={xInterval(data.length)}
        />
        <YAxis hide domain={[0, maxComments * 1.2]} />

        {avgSlot > 0 && (
          <ReferenceLine
            y={avgSlot}
            stroke="hsl(215 15% 55%)"
            strokeOpacity={0.25}
            strokeDasharray="4 4"
          />
        )}

        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(215 15% 50% / 0.06)' }} />

        <Bar dataKey="comments" radius={[3, 3, 0, 0]} maxBarSize={28}>
          {data.map((slot) => {
            const isPeak = slot.comments === maxComments && slot.comments > 0
            return (
              <Cell
                key={slot.key}
                fill="hsl(210 80% 58%)"
                fillOpacity={isPeak ? 0.9 : 0.4}
              />
            )
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
