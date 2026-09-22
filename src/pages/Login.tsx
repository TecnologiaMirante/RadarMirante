import { useState } from 'react'
import {
  AlertCircle, ShieldX,
  Instagram, Youtube, TrendingUp, Eye, Users,
  CheckCircle2, Wifi,
} from 'lucide-react'
import { signInWithGoogle, DomainNotAllowedError } from '@/services/auth'
import { useAuth } from '@/hooks/useAuth'
import { Logo } from '@/components/ui/Logo'

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z" />
    </svg>
  )
}

const PLATFORMS = [
  { icon: <Instagram className="w-4 h-4" />, color: 'text-pink-400', bg: 'bg-pink-500/15', name: 'Instagram', metric: '847,3k', label: 'seguidores', delta: '+2,4%' },
  { icon: <Youtube className="w-4 h-4" />, color: 'text-red-400', bg: 'bg-red-500/15', name: 'YouTube', metric: '1,2M', label: 'inscritos', delta: '+0,9%' },
  { icon: <TikTokIcon />, color: 'text-sky-300', bg: 'bg-sky-500/15', name: 'TikTok', metric: '312,1k', label: 'seguidores', delta: '+5,7%' },
]

const LIVE_ITEMS = [
  { icon: <Eye className="w-3 h-3" />, label: 'Alcance nas últimas 24h', value: '94.820' },
  { icon: <TrendingUp className="w-3 h-3" />, label: 'Impressões hoje', value: '231.440' },
  { icon: <Users className="w-3 h-3" />, label: 'Novos seguidores (7d)', value: '+1.382' },
]

function GoogleIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M17.64 9.2045c0-.638-.0573-1.252-.1636-1.8409H9v3.4814h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.874 2.6836-6.6149z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.8064.54-1.8368.859-3.0477.859-2.3441 0-4.3286-1.5836-5.036-3.7104H.9574v2.3318C2.4382 15.9832 5.4818 18 9 18z" fill="#34A853" />
      <path d="M3.964 10.71c-.18-.54-.2827-1.1168-.2827-1.71s.1027-1.17.2827-1.71V4.9582H.9574C.3477 6.1732 0 7.5482 0 9s.3477 2.8268.9574 4.0418L3.964 10.71z" fill="#FBBC05" />
      <path d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5813-2.5814C13.4632.8918 11.4259 0 9 0 5.4818 0 2.4382 2.0168.9574 4.9582L3.964 7.29C4.6714 5.1632 6.6559 3.5795 9 3.5795z" fill="#EA4335" />
    </svg>
  )
}

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

      {/* ── LEFT: product preview ── */}
      <div className="hidden lg:flex flex-col flex-1 relative p-12 overflow-hidden">

        {/* Dot-grid texture */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '28px 28px' }}
        />

        {/* Subtle border on the right */}
        <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

        {/* Wordmark */}
        <div className="relative mb-auto">
          <div className="mb-4">
            <Logo type="icon" variant="escuro" className="h-20 w-auto" />
          </div>

          <div className="flex items-baseline gap-2.5 flex-wrap mb-1">
            <span className="text-[28px] font-bold text-white tracking-tight leading-none">
              Mirante Radar
            </span>
            <span className="text-[8.5px] font-bold uppercase tracking-[0.22em] text-blue-400/40 bg-blue-400/8 border border-blue-400/12 px-1.5 py-0.5 rounded">
              Beta
            </span>
          </div>

          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10.5px] text-blue-300/45 font-semibold uppercase tracking-[0.16em]">um projeto da</span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/6 border border-white/10">
              <Logo type="mirante" variant="escuro" className="h-[22px] w-auto opacity-80" />
              <div className="h-4 w-px bg-white/15" />
              <span className="text-[13px] font-bold text-white/70 tracking-tight">Mirante IA</span>
            </div>
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
            Métricas de redes sociais centralizadas para a Mirante.
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
                <p className="text-sm font-bold text-white/90 leading-none">
                  {p.metric}{' '}
                  <span className="text-[11px] font-normal text-white/40">{p.label}</span>
                </p>
              </div>
              <span className="text-xs font-semibold text-green-400">{p.delta}</span>
            </div>
          ))}
        </div>

        {/* Live metrics */}
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

        {/* Footer */}
        <div className="relative mt-8 flex items-center justify-between">
          <p className="text-[11px] text-white/20">TV Mirante · Uso Interno</p>
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3 h-3 text-green-400/60" />
            <span className="text-[11px] text-green-400/60">Online</span>
          </div>
        </div>
      </div>

      {/* ── RIGHT: login ── */}
      <div
        className="relative flex flex-1 flex-col overflow-hidden lg:flex-none lg:w-[420px] xl:w-[460px]"
        style={{ background: 'radial-gradient(ellipse at 20% 30%, rgba(29,62,168,.22) 0%, transparent 60%), radial-gradient(ellipse at 80% 70%, rgba(109,40,217,.10) 0%, transparent 55%), #08111E' }}
      >
        {/* Mobile top accent */}
        <div className="lg:hidden h-[2px] bg-gradient-to-r from-transparent via-blue-500/30 to-transparent" />

        <div className="relative flex flex-col items-center justify-center h-full px-8 py-10">

          {/* Brand */}
          <div className="flex flex-col items-center text-center mb-10">

            {/* Icon with glow */}
            <div className="relative mb-5">
              <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-[50px] scale-[1.6]" />
              <Logo
                type="icon"
                variant="escuro"
                className="relative h-32 w-auto drop-shadow-[0_6px_20px_rgba(59,130,246,0.35)]"
              />
            </div>

            <h1 className="text-[30px] font-bold text-white tracking-tight leading-none mb-1">
              Mirante Radar
            </h1>

            {/* "um projeto da Mirante IA" */}
            <div className="flex flex-col items-center gap-2 mt-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">
                um projeto da
              </span>
              <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-white/6 border border-white/10 shadow-[0_4px_16px_rgba(0,0,0,0.3)]">
                <Logo type="mirante" variant="escuro" className="h-8 w-auto opacity-85" />
                <div className="h-5 w-px bg-white/15" />
                <span className="text-[17px] font-bold text-white/80 tracking-tight">Mirante IA</span>
              </div>
            </div>
          </div>

          {/* Login card */}
          <div className="w-full max-w-[360px]">
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', boxShadow: '0 24px 48px rgba(0,0,0,.4)' }}
            >
              {/* Top accent */}
              <div className="h-[2px] bg-gradient-to-r from-blue-500/0 via-blue-500/60 to-violet-500/0" />

              <div className="px-8 pt-7 pb-6">
                <h2 className="text-[20px] font-bold text-white tracking-tight mb-1">
                  Acesse o radar
                </h2>
                <p className="text-[13px] text-white/40 mb-7">
                  Use sua conta{' '}
                  <span className="text-white/65 font-medium">@mirante.com.br</span>
                </p>

                {/* Errors */}
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
                    background: loading ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.08)',
                    border: '1px solid rgba(255,255,255,.12)',
                    color: 'rgba(255,255,255,.88)',
                    boxShadow: loading ? 'none' : '0 1px 3px rgba(0,0,0,.4)',
                  }}
                  onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.13)' }}
                  onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.08)' }}
                >
                  {loading ? (
                    <span className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white/60 animate-spin flex-shrink-0" />
                  ) : (
                    <GoogleIcon />
                  )}
                  {loading ? 'Autenticando…' : 'Entrar com Google'}
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3 my-6">
                  <div className="h-px flex-1 bg-white/[0.07]" />
                  <span className="text-[10px] font-semibold text-white/20 uppercase tracking-[0.14em]">acesso restrito</span>
                  <div className="h-px flex-1 bg-white/[0.07]" />
                </div>

                {/* Security checklist */}
                <div className="space-y-2.5">
                  {[
                    'Apenas contas @mirante.com.br',
                    'Autenticação segura via Google',
                    'Sem senha armazenada localmente',
                  ].map(text => (
                    <div key={text} className="flex items-center gap-3">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 shrink-0">
                        <CheckCircle2 size={12} className="text-emerald-400" />
                      </div>
                      <span className="text-[12px] text-white/40">{text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card footer */}
              <div
                className="px-8 py-3.5 flex items-center justify-between"
                style={{ background: 'rgba(0,0,0,.15)', borderTop: '1px solid rgba(255,255,255,.06)' }}
              >
                <span className="text-[11px] text-white/20">TV Mirante · Uso interno</span>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70 animate-pulse" />
                  <span className="text-[11px] text-white/30 font-medium">Online</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  )
}
