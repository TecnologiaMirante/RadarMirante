import { useState } from 'react'
import {
  Radio, AlertCircle, ShieldX,
  Instagram, Youtube, TrendingUp, Eye, Users,
  Wifi,
} from 'lucide-react'
import { signInWithGoogle, DomainNotAllowedError } from '@/services/auth'
import { useAuth } from '@/hooks/useAuth'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z" />
    </svg>
  )
}

// ─── Mock preview data ─────────────────────────────────────────────────────────

const PLATFORMS = [
  {
    icon: <Instagram className="w-4 h-4" />,
    color: 'text-pink-400',
    bg: 'bg-pink-500/15',
    name: 'Instagram',
    metric: '847,3k',
    label: 'seguidores',
    delta: '+2,4%',
    positive: true,
  },
  {
    icon: <Youtube className="w-4 h-4" />,
    color: 'text-red-400',
    bg: 'bg-red-500/15',
    name: 'YouTube',
    metric: '1,2M',
    label: 'inscritos',
    delta: '+0,9%',
    positive: true,
  },
  {
    icon: <TikTokIcon />,
    color: 'text-sky-300',
    bg: 'bg-sky-500/15',
    name: 'TikTok',
    metric: '312,1k',
    label: 'seguidores',
    delta: '+5,7%',
    positive: true,
  },
]

const LIVE_ITEMS = [
  { icon: <Eye className="w-3 h-3" />, label: 'Alcance nas últimas 24h', value: '94.820' },
  { icon: <TrendingUp className="w-3 h-3" />, label: 'Impressões hoje', value: '231.440' },
  { icon: <Users className="w-3 h-3" />, label: 'Novos seguidores (7d)', value: '+1.382' },
]

// ─── Main ──────────────────────────────────────────────────────────────────────

type ErrorType = 'domain' | 'generic' | null

export default function Login() {
  const { domainBlocked } = useAuth()
  const [loading, setLoading] = useState(false)
  const [errorType, setErrorType] = useState<ErrorType>(null)

  async function handleGoogleSignIn() {
    setLoading(true)
    setErrorType(null)
    try {
      await signInWithGoogle()
    } catch (err) {
      if (err instanceof DomainNotAllowedError) {
        setErrorType('domain')
      } else {
        console.error('[Login]', err)
        setErrorType('generic')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 15% 60%, rgba(29,78,216,.18) 0%, transparent 55%), radial-gradient(ellipse at 85% 20%, rgba(109,40,217,.12) 0%, transparent 50%), #07090f' }}
    >
      {/* ── Left panel: product preview ──────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col flex-1 relative p-12 overflow-hidden">

        {/* Dot-grid texture */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '28px 28px' }}
        />

        {/* Subtle border on the right */}
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

        {/* Wordmark */}
        <div className="relative flex items-center gap-3 mb-auto">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(59,130,246,.2)', border: '1px solid rgba(59,130,246,.3)' }}>
            <Radio className="w-4.5 h-4.5 text-blue-400" style={{ width: 18, height: 18 }} />
          </div>
          <div>
            <p className="text-[15px] font-bold text-white/90 leading-none tracking-tight">Radar Mirante</p>
            <p className="text-[10px] text-white/30 mt-0.5 tracking-widest uppercase">Inteligência de audiência</p>
          </div>
        </div>

        {/* Hero text */}
        <div className="relative mb-10">
          <h2 className="text-4xl font-black text-white leading-[1.1] tracking-tight max-w-xs">
            O radar da audiência<br />
            <span style={{ background: 'linear-gradient(90deg, #60a5fa, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              em tempo real.
            </span>
          </h2>
          <p className="text-sm text-white/40 mt-3 max-w-xs leading-relaxed">
            Métricas de Instagram, YouTube e TikTok centralizadas para a redação do Mirante.
          </p>
        </div>

        {/* Platform cards */}
        <div className="relative space-y-2.5 mb-8">
          {PLATFORMS.map(p => (
            <div
              key={p.name}
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)' }}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${p.bg} ${p.color}`}>
                {p.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-white/40">{p.name}</p>
                <p className="text-sm font-bold text-white/90 leading-none">{p.metric} <span className="text-[11px] font-normal text-white/40">{p.label}</span></p>
              </div>
              <span className="text-xs font-semibold text-green-400">{p.delta}</span>
            </div>
          ))}
        </div>

        {/* Live metrics row */}
        <div
          className="relative rounded-xl px-4 py-4"
          style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}
        >
          <div className="flex items-center gap-1.5 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-semibold text-white/30 tracking-widest uppercase">Ao vivo</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {LIVE_ITEMS.map(item => (
              <div key={item.label}>
                <div className="flex items-center gap-1 text-white/30 mb-1">
                  {item.icon}
                  <span className="text-[9px] uppercase tracking-wider">{item.label}</span>
                </div>
                <p className="text-base font-bold text-white/80">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom footer */}
        <div className="relative mt-8 flex items-center justify-between">
          <p className="text-[11px] text-white/20">TV Mirante · Uso Interno</p>
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3 h-3 text-green-400/60" />
            <span className="text-[11px] text-green-400/60">Online</span>
          </div>
        </div>
      </div>

      {/* ── Right panel: login form ───────────────────────────────────────────── */}
      <div
        className="flex flex-col w-full lg:w-[420px] xl:w-[460px] flex-shrink-0 items-center justify-center px-8 py-12 relative"
        style={{ background: 'rgba(255,255,255,.02)' }}
      >

        {/* Mobile wordmark */}
        <div className="lg:hidden flex items-center gap-2 mb-10">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(59,130,246,.2)', border: '1px solid rgba(59,130,246,.3)' }}>
            <Radio className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-sm font-bold text-white/80">Radar Mirante</p>
        </div>

        <div className="w-full max-w-[320px]">

          {/* Logo */}
          <div className="flex flex-col items-center mb-10">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: 'linear-gradient(135deg, rgba(59,130,246,.25), rgba(99,102,241,.15))', border: '1px solid rgba(99,102,241,.25)', boxShadow: '0 0 40px rgba(59,130,246,.12)' }}
            >
              <Radio className="w-7 h-7 text-blue-400" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">Radar Mirante</h1>
            <div className="flex items-center gap-2 mt-2">
              <span
                className="text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(59,130,246,.15)', color: 'rgba(147,197,253,0.8)', border: '1px solid rgba(59,130,246,.2)' }}
              >
                BETA
              </span>
              <span className="text-[11px] text-white/25">·</span>
              <span className="text-[11px] text-white/30">TV Mirante</span>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-7">
            <h2 className="text-[22px] font-bold text-white leading-tight">Acesse o radar</h2>
            <p className="text-sm text-white/40 mt-1">
              Use sua conta <span className="text-white/60 font-medium">@mirante.com.br</span>
            </p>
          </div>

          {/* Error messages */}
          {(errorType === 'domain' || domainBlocked) && (
            <div
              className="flex items-start gap-2.5 rounded-xl p-3.5 mb-5"
              style={{ background: 'rgba(251,146,60,.08)', border: '1px solid rgba(251,146,60,.2)' }}
            >
              <ShieldX className="w-4 h-4 text-orange-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-orange-400">Acesso não autorizado</p>
                <p className="text-xs text-orange-400/70 mt-0.5">Restrito a contas @mirante.com.br.</p>
              </div>
            </div>
          )}

          {errorType === 'generic' && (
            <div
              className="flex items-start gap-2.5 rounded-xl p-3.5 mb-5"
              style={{ background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.2)' }}
            >
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-400">Não foi possível autenticar. Tente novamente.</p>
            </div>
          )}

          {/* Google button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 rounded-xl py-3.5 text-sm font-semibold transition-all duration-150 active:scale-[.98] disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: loading ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.09)',
              border: '1px solid rgba(255,255,255,.12)',
              color: 'rgba(255,255,255,.85)',
              boxShadow: loading ? 'none' : '0 1px 2px rgba(0,0,0,.3)',
            }}
            onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.13)' }}
            onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.09)' }}
          >
            {loading ? (
              <span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white/60 animate-spin flex-shrink-0" />
            ) : (
              <GoogleIcon />
            )}
            {loading ? 'Autenticando…' : 'Entrar com Google'}
          </button>

          {/* Restricted access bullets */}
          <div className="mt-8">
            <p className="text-[10px] font-semibold tracking-widest uppercase text-white/20 mb-3">Acesso restrito</p>
            <ul className="space-y-2.5">
              {[
                'Apenas contas @mirante.com.br',
                'Autenticação segura via Google',
                'Sem senha armazenada localmente',
              ].map(item => (
                <li key={item} className="flex items-center gap-2.5 text-xs text-white/35">
                  <svg viewBox="0 0 16 16" className="w-3.5 h-3.5 flex-shrink-0 text-green-500/70" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="8" cy="8" r="6" />
                    <path d="M5.5 8l2 2 3-3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom footer */}
        <div className="absolute bottom-6 left-0 right-0 flex items-center justify-between px-8">
          <p className="text-[10px] text-white/15">TV Mirante · Uso Interno</p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400/50 animate-pulse" />
            <span className="text-[10px] text-white/20">Online</span>
          </div>
        </div>
      </div>
    </div>
  )
}
