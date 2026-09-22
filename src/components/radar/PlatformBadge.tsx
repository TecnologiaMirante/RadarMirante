import { Instagram, Facebook, Youtube, Twitter, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SocialPlatform } from '@/types/radar'

interface PlatformBadgeProps {
  platform: SocialPlatform
  className?: string
}

const PLATFORM_CONFIG: Record<
  SocialPlatform,
  { label: string; className: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  imirante: {
    label: 'Imirante',
    className: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    Icon: Globe,
  },
  instagram: {
    label: 'Instagram',
    className: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
    Icon: Instagram,
  },
  facebook: {
    label: 'Facebook',
    className: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    Icon: Facebook,
  },
  youtube: {
    label: 'YouTube',
    className: 'bg-red-500/10 text-red-400 border-red-500/20',
    Icon: Youtube,
  },
  x: {
    label: 'X',
    className: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
    Icon: Twitter,
  },
}

export function PlatformBadge({ platform, className }: PlatformBadgeProps) {
  const config = PLATFORM_CONFIG[platform]
  const { Icon } = config

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        config.className,
        className,
      )}
    >
      <Icon className="w-3 h-3 flex-shrink-0" />
      {config.label}
    </span>
  )
}
