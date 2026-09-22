import radarLogoClaro  from '@/assets/mirante_radar_claro.png'
import radarLogoEscuro from '@/assets/mirante_radar_escuro.png'
import radarIconClaro  from '@/assets/icon_claro.png'
import radarIconEscuro from '@/assets/icon_escuro.png'
import miranteClaro    from '@/assets/logo_claro.png'
import miranteEscuro   from '@/assets/logo_escuro.png'

const LOGOS = {
  logo:    { claro: radarLogoClaro,  escuro: radarLogoEscuro,  alt: 'Mirante Radar' },
  icon:    { claro: radarIconClaro,  escuro: radarIconEscuro,  alt: 'Mirante Radar' },
  mirante: { claro: miranteClaro,    escuro: miranteEscuro,    alt: 'Mirante IA'    },
}

/**
 * @param {'logo'|'icon'} type
 *   'logo' → logotipo completo (ícone + MIRANTE RADAR + tagline)
 *   'icon' → apenas o ícone (pássaro + arcos de radar)
 * @param {'auto'|'claro'|'escuro'} variant
 *   'auto'   → troca com o tema (reage ao toggle light/dark)
 *   'claro'  → sempre versão azul (fundos claros)
 *   'escuro' → sempre versão branca (fundos escuros / tela de login)
 */
export function Logo({
  type = 'logo',
  variant = 'auto',
  className = 'h-8 w-auto',
}: {
  type?: 'logo' | 'icon' | 'mirante'
  variant?: 'auto' | 'claro' | 'escuro'
  className?: string
}) {
  const { claro, escuro, alt } = LOGOS[type]

  if (variant === 'claro') {
    return <img src={claro} alt={alt} className={className} draggable={false} />
  }

  if (variant === 'escuro') {
    return <img src={escuro} alt={alt} className={className} draggable={false} />
  }

  return (
    <>
      <img src={claro} alt={alt} className={`block dark:hidden ${className}`} draggable={false} />
      <img src={escuro} alt={alt} className={`hidden dark:block ${className}`} draggable={false} aria-hidden="true" />
    </>
  )
}
