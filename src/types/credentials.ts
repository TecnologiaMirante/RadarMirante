import type { Timestamp } from 'firebase/firestore'

export type CredentialPlatform =
  | 'instagram' | 'facebook' | 'youtube' | 'twitter' | 'tiktok'
  | 'linkedin' | 'google' | 'wordpress' | 'email' | 'other'

export const CREDENTIAL_PLATFORM_LABELS: Record<CredentialPlatform, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  youtube: 'YouTube',
  twitter: 'X (Twitter)',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  google: 'Google',
  wordpress: 'WordPress',
  email: 'E-mail',
  other: 'Outro',
}

export const CREDENTIAL_PLATFORM_EMOJI: Record<CredentialPlatform, string> = {
  instagram: '📸',
  facebook: '👥',
  youtube: '▶️',
  twitter: '🐦',
  tiktok: '🎵',
  linkedin: '💼',
  google: '🔍',
  wordpress: '📝',
  email: '📧',
  other: '🔐',
}

export type CredentialLoginType = 'email_password' | 'google' | 'other'

export const CREDENTIAL_LOGIN_LABELS: Record<CredentialLoginType, string> = {
  email_password: 'E-mail + Senha',
  google: 'Conta Google',
  other: 'Outro',
}

export interface Credential {
  id: string
  name: string
  platform: CredentialPlatform
  platformCustomName?: string  // preenchido quando platform === 'other'
  loginType: CredentialLoginType
  username?: string   // usuário da plataforma (ex: @imirante)
  email?: string
  password?: string
  notes?: string
  visibleTo: 'all' | string[]  // 'all' ou array de UIDs do Firebase Auth
  createdBy: string
  createdAt: Timestamp
  updatedAt: Timestamp
}
