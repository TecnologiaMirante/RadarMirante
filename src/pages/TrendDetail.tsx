import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, deleteDoc, onSnapshot, collection, query, where, type Timestamp } from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import { db } from '@/services/firebase'
import {
  ArrowLeft, Copy, Check, ExternalLink, Clock, RefreshCw,
  AlertCircle, Pencil, X, Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { generateScript, type ScriptScenario, type ScriptResult } from '@/services/scriptGenerator'
import type { TrendTopic } from '@/services/trends'

// ─── Types ────────────────────────────────────────────────────────────────────

type TrendDoc = TrendTopic & { platform?: string }

interface SavedScript {
  id: string
  scenario: ScriptScenario
  whyTrending: string
  script: string
  createdAt: Timestamp
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SCRIPT_SCENARIO_LIST: { id: ScriptScenario; label: string; emoji: string; desc: string }[] = [
  { id: 'entretenimento', label: 'Entretenimento', emoji: '📺', desc: 'Conteúdo de entretenimento' },
  { id: 'jornalismo',     label: 'Jornalismo',     emoji: '📰', desc: 'Cobertura jornalística' },
  { id: 'esportes',       label: 'Esportes',        emoji: '⚽', desc: 'Editoria de esportes' },
]

function getSourceUrl(url: string, topicTitle: string): string {
  if (!url || url.includes('news.google.com/articles/') || url.includes('news.google.com/read/')) {
    const clean = topicTitle.startsWith('#') ? topicTitle.slice(1) : topicTitle
    return `https://news.google.com/search?q=${encodeURIComponent(clean)}&hl=pt-BR&gl=BR&ceid=BR:pt`
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    const clean = topicTitle.startsWith('#') ? topicTitle.slice(1) : topicTitle
    return `https://www.google.com/search?q=${encodeURIComponent(clean)}`
  }
  return url
}

function fmtFull(ts: Timestamp | null | undefined): string {
  if (!ts) return ''
  try {
    const d = ts.toDate()
    const now = new Date()
    const diffH = (now.getTime() - d.getTime()) / 3_600_000
    if (diffH < 1) return 'agora'
    if (diffH < 24) return `há ${Math.floor(diffH)}h`
    return format(d, "d 'de' MMM 'às' HH:mm", { locale: ptBR })
  } catch { return '' }
}

function fmtRelative(ts: Timestamp | null | undefined): string {
  if (!ts) return ''
  try {
    return formatDistanceToNow(ts.toDate(), { addSuffix: true, locale: ptBR })
  } catch { return '' }
}

// ─── Script card ──────────────────────────────────────────────────────────────

function ScriptCard({ s, onDelete }: { s: SavedScript; onDelete: (id: string) => void }) {
  const [editText, setEditText] = useState(s.script)
  const [editing, setEditing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const scenarioInfo = SCRIPT_SCENARIO_LIST.find(x => x.id === s.scenario)
  const hasChanges = editText !== s.script

  function copy() {
    navigator.clipboard.writeText(editText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function startEdit() {
    setConfirmDelete(false)
    setEditing(true)
  }

  function saveEdit() {
    setEditing(false)
  }

  function discardEdit() {
    setEditText(s.script)
    setEditing(false)
  }

  return (
    <div className={cn(
      'rounded-xl border bg-card overflow-hidden transition-colors',
      editing ? 'border-primary/40' : 'border-border/60',
    )}>
      {/* Header */}
      <div className={cn(
        'flex items-center justify-between px-4 py-2.5 border-b',
        editing ? 'border-primary/20 bg-primary/5' : 'border-border/40 bg-muted/15',
      )}>
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">{scenarioInfo?.emoji}</span>
          <span className="text-sm font-semibold text-foreground">{scenarioInfo?.label}</span>
          {s.createdAt && !editing && (
            <span className="text-[10px] text-muted-foreground/40 tabular-nums">
              · {fmtFull(s.createdAt)}
            </span>
          )}
          {editing && (
            <span className="text-[10px] font-medium text-primary/60 bg-primary/10 px-1.5 py-0.5 rounded">
              editando
            </span>
          )}
        </div>

        {/* Actions — different in edit vs read mode */}
        {editing ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={discardEdit}
              className="px-2.5 py-1 rounded-md text-[12px] font-medium text-muted-foreground/70 hover:text-foreground bg-muted/40 hover:bg-muted/70 border border-border/40 transition-colors"
            >
              Descartar
            </button>
            <button
              onClick={saveEdit}
              className={cn(
                'px-2.5 py-1 rounded-md text-[12px] font-semibold transition-colors',
                hasChanges
                  ? 'text-white bg-primary hover:bg-primary/90'
                  : 'text-muted-foreground bg-muted/40 border border-border/40 cursor-default',
              )}
            >
              Salvar
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-0.5">
            <button
              onClick={startEdit}
              title="Editar roteiro"
              className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={copy}
              title="Copiar roteiro"
              className="p-1.5 rounded-md text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            {confirmDelete ? (
              <>
                <button
                  onClick={() => onDelete(s.id)}
                  className="ml-1 px-2 py-1 rounded-md text-[11px] font-semibold text-destructive bg-destructive/10 hover:bg-destructive/15 border border-destructive/20 transition-colors"
                >
                  Apagar
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-2 py-1 rounded-md text-[11px] text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 transition-colors"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                title="Apagar roteiro"
                className="p-1.5 rounded-md text-muted-foreground/35 hover:text-destructive hover:bg-muted/60 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Why trending */}
        {s.whyTrending && (
          <div className="rounded-lg bg-muted/25 border border-border/40 px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40 mb-1.5">
              Por que está em alta
            </p>
            <p className="text-xs text-foreground/70 leading-relaxed">{s.whyTrending}</p>
          </div>
        )}

        {/* Script */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/40 mb-2">
            Roteiro
          </p>
          {editing ? (
            <div className="space-y-2">
              <textarea
                value={editText}
                onChange={e => setEditText(e.target.value)}
                className="w-full min-h-[240px] text-sm text-foreground leading-relaxed bg-background border border-primary/30 rounded-lg px-3.5 py-3 resize-y focus:outline-none focus:ring-2 focus:ring-primary/25"
                autoFocus
              />
              {hasChanges && (
                <p className="text-[11px] text-muted-foreground/45">
                  Alterações não salvas — clique em <strong className="text-foreground/60">Salvar</strong> para confirmar ou <strong className="text-foreground/60">Descartar</strong> para reverter.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">{editText}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Generating state card ────────────────────────────────────────────────────

function GeneratingCard({ scenario, error, onRetry, onCancel }: {
  scenario: ScriptScenario
  error: string | null
  onRetry: () => void
  onCancel: () => void
}) {
  const info = SCRIPT_SCENARIO_LIST.find(s => s.id === scenario)!
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-muted/15">
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">{info.emoji}</span>
          <span className="text-sm font-semibold text-foreground">{info.label}</span>
        </div>
        <button onClick={onCancel} className="p-1.5 rounded-md text-muted-foreground/40 hover:text-foreground hover:bg-muted/60 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="px-4 py-4">
        {error ? (
          <div className="space-y-2.5">
            <div className="flex items-start gap-2 text-sm text-destructive/80">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            <button onClick={onRetry} className="text-xs font-semibold text-primary hover:text-primary/80 underline underline-offset-2 transition-colors">
              Tentar novamente
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full border-2 border-border border-t-primary animate-spin flex-shrink-0" />
            <div>
              <p className="text-sm text-foreground/80">Gerando roteiro com IA…</p>
              <p className="text-xs text-muted-foreground/45 mt-0.5">Pode levar até 20 segundos</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TrendDetail() {
  const { docId } = useParams<{ docId: string }>()
  const navigate = useNavigate()

  const [trend, setTrend] = useState<TrendDoc | null>(null)
  const [trendLoading, setTrendLoading] = useState(true)
  const [savedScripts, setSavedScripts] = useState<SavedScript[]>([])
  const [generating, setGenerating] = useState<ScriptScenario | null>(null)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  // Fetch trend doc
  useEffect(() => {
    if (!docId) return
    const unsub = onSnapshot(doc(db, 'trends_history', docId), snap => {
      if (snap.exists()) {
        setTrend({ id: snap.id, ...(snap.data() as Omit<TrendDoc, 'id'>) })
      }
      setTrendLoading(false)
    }, () => setTrendLoading(false))
    return () => unsub()
  }, [docId])

  // Subscribe to saved scripts for this trend
  useEffect(() => {
    const uid = getAuth().currentUser?.uid
    if (!uid || !trend?.title) return
    const q = query(
      collection(db, 'scriptRequests'),
      where('trendTitle', '==', trend.title),
      where('requestedBy', '==', uid),
      where('status', '==', 'completed'),
    )
    const unsub = onSnapshot(q, snap => {
      setSavedScripts(
        snap.docs
          .map(d => ({ id: d.id, ...(d.data() as Omit<SavedScript, 'id'>) }))
          .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)),
      )
    })
    return () => unsub()
  }, [trend?.title])

  useEffect(() => () => { cleanupRef.current?.() }, [])

  async function deleteScript(id: string) {
    try {
      await deleteDoc(doc(db, 'scriptRequests', id))
    } catch {
      // silently ignore — rules not yet allowing delete
    }
  }

  function buildContext(): string | undefined {
    if (!trend?.newsItems?.length) return undefined
    const articles = trend.newsItems.filter(n => n.source)
    const related  = trend.newsItems.find(n => !n.source)
    let ctx = ''
    for (const item of articles) {
      const frag = `${item.title}${item.source ? ` (${item.source})` : ''}`
      const sep  = ctx ? '. ' : ''
      if (ctx.length + sep.length + frag.length > 400) break
      ctx += sep + frag
    }
    if (!ctx && related?.snippet) {
      ctx = related.snippet.replace(/ · /g, ', ').slice(0, 400)
    }
    return ctx || undefined
  }

  function startGenerate(scenario: ScriptScenario) {
    if (!trend) return
    setGenerating(scenario)
    setGenerateError(null)
    const ctx = buildContext()
    cleanupRef.current?.()
    cleanupRef.current = generateScript(
      trend.title, trend.platform ?? 'trends', scenario, ctx ?? undefined,
      (_result: ScriptResult) => setGenerating(null),
      (e: string) => { setGenerateError(e) },
    )
  }

  function cancelGenerate() {
    cleanupRef.current?.()
    cleanupRef.current = null
    setGenerating(null)
    setGenerateError(null)
  }

  if (trendLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground/40" />
      </div>
    )
  }

  if (!trend) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <AlertCircle className="w-8 h-8 text-destructive/50" />
        <p className="text-sm text-muted-foreground">Tendência não encontrada.</p>
        <button onClick={() => navigate('/tendencias')} className="text-xs text-primary hover:underline">
          Voltar para tendências
        </button>
      </div>
    )
  }

  const isGoogle = trend.platform === 'google'
  const isTwitter = trend.platform === 'twitter'
  const platformLabel = isGoogle ? 'Google Trends' : isTwitter ? 'X / Twitter' : ''
  const newsArticles = trend.newsItems?.filter(n => n.source) ?? []
  const relatedSearches = trend.newsItems?.find(n => !n.source)
  const generatedScenarios = new Set(savedScripts.map(s => s.scenario))
  const availableScenarios = SCRIPT_SCENARIO_LIST.filter(s => !generatedScenarios.has(s.id))

  return (
    <div className="pb-16">

      {/* Back nav */}
      <button
        onClick={() => navigate('/tendencias')}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-foreground transition-colors mb-5"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Tendências
      </button>

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground leading-tight tracking-tight mb-3">
          {trend.title}
        </h1>
        <div className="flex items-center gap-1.5 flex-wrap">
          {platformLabel && (
            <span className="text-[11px] font-medium text-muted-foreground/60 bg-muted/50 border border-border/40 px-2 py-0.5 rounded-md">
              {platformLabel}
            </span>
          )}
          {trend.rank && (
            <span className="text-[11px] font-medium text-muted-foreground/60 bg-muted/50 border border-border/40 px-2 py-0.5 rounded-md">
              #{trend.rank} em alta
            </span>
          )}
          {trend.score && (
            <span className="text-[11px] font-medium text-muted-foreground/50 bg-muted/40 border border-border/30 px-2 py-0.5 rounded-md tabular-nums">
              {trend.score} buscas
            </span>
          )}
          {trend.firstSeen && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/40">
              <Clock className="w-3 h-3" />
              {fmtFull(trend.firstSeen)}
            </span>
          )}
          {trend.lastSeen && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/35">
              <RefreshCw className="w-3 h-3" />
              {fmtRelative(trend.lastSeen)}
            </span>
          )}
        </div>
      </div>

      {/* ── Contexto ──────────────────────────────────────────────── */}
      {(newsArticles.length > 0 || relatedSearches) && (
        <section className="mb-6 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/35 mb-2">
            Contexto
          </p>

          {newsArticles.map((item, i) => (
            <a
              key={i}
              href={getSourceUrl(item.url, trend.title)}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl bg-card border border-border/60 px-4 py-3.5 hover:border-border hover:bg-muted/10 transition-colors group"
            >
              <p className="text-sm font-semibold text-foreground/90 leading-snug mb-1 group-hover:text-foreground transition-colors">
                {item.title}
              </p>
              {item.snippet && item.snippet !== item.title && (
                <p className="text-xs text-muted-foreground/55 leading-relaxed mb-2 line-clamp-2">{item.snippet}</p>
              )}
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground/50 group-hover:text-primary/70 transition-colors">
                <ExternalLink className="w-3 h-3" />
                {item.source}
              </span>
            </a>
          ))}

          {relatedSearches?.snippet && (
            <div className="rounded-xl bg-card border border-border/60 px-4 py-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/35 mb-2.5">
                Buscas relacionadas
              </p>
              <div className="flex flex-wrap gap-1.5">
                {relatedSearches.snippet.split(' · ').filter(Boolean).map((term, j) => (
                  <span key={j} className="inline-block px-2.5 py-1 rounded-md bg-muted/40 text-[11px] text-foreground/60 border border-border/40">
                    {term}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Roteiros ──────────────────────────────────────────────── */}
      <section className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/35 mb-2">
          Roteiros
        </p>

        {/* Scenario buttons — only for scenarios not yet generated */}
        {!generating && availableScenarios.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {availableScenarios.map(s => (
              <button
                key={s.id}
                onClick={() => startGenerate(s.id)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-card border border-border/60 hover:border-primary/30 hover:bg-muted/40 text-sm font-medium text-muted-foreground hover:text-foreground transition-all"
              >
                <span className="text-base leading-none">{s.emoji}</span>
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Generating */}
        {generating && (
          <GeneratingCard
            scenario={generating}
            error={generateError}
            onRetry={() => startGenerate(generating)}
            onCancel={cancelGenerate}
          />
        )}

        {/* Empty state */}
        {savedScripts.length === 0 && !generating && (
          <p className="text-xs text-muted-foreground/35 py-2">
            Nenhum roteiro gerado ainda.
          </p>
        )}

        {/* Script cards */}
        {savedScripts.map(s => (
          <ScriptCard key={s.id} s={s} onDelete={deleteScript} />
        ))}
      </section>
    </div>
  )
}
