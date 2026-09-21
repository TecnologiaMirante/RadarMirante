import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

export function InstagramIcon({ size = 24, ...p }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...p}>
      <defs>
        <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#f09433" />
          <stop offset="25%" stopColor="#e6683c" />
          <stop offset="50%" stopColor="#dc2743" />
          <stop offset="75%" stopColor="#cc2366" />
          <stop offset="100%" stopColor="#bc1888" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="5.5" fill="url(#ig-grad)" />
      <circle cx="12" cy="12" r="4.5" stroke="white" strokeWidth="1.8" fill="none" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="white" />
    </svg>
  )
}

export function FacebookIcon({ size = 24, ...p }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...p}>
      <rect width="24" height="24" rx="5" fill="#1877F2" />
      <path d="M15.5 8H13.5C13.2 8 13 8.2 13 8.5V10H15.5L15.2 12.5H13V19H10.5V12.5H9V10H10.5V8.3C10.5 6.5 11.6 5.5 13.3 5.5C14.1 5.5 14.9 5.6 15.5 5.7V8Z" fill="white" />
    </svg>
  )
}

export function YouTubeIcon({ size = 24, ...p }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...p}>
      <rect width="24" height="24" rx="5" fill="#FF0000" />
      <path d="M20.5 8.2C20.3 7.4 19.7 6.8 18.9 6.6C17.5 6.2 12 6.2 12 6.2C12 6.2 6.5 6.2 5.1 6.6C4.3 6.8 3.7 7.4 3.5 8.2C3.1 9.6 3.1 12 3.1 12C3.1 12 3.1 14.4 3.5 15.8C3.7 16.6 4.3 17.2 5.1 17.4C6.5 17.8 12 17.8 12 17.8C12 17.8 17.5 17.8 18.9 17.4C19.7 17.2 20.3 16.6 20.5 15.8C20.9 14.4 20.9 12 20.9 12C20.9 12 20.9 9.6 20.5 8.2Z" fill="#FF0000" />
      <polygon points="10,9.5 10,14.5 15,12" fill="white" />
    </svg>
  )
}

export function XTwitterIcon({ size = 24, ...p }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...p}>
      <rect width="24" height="24" rx="5" fill="#000" />
      <path d="M17.5 4.5H20L14.5 10.8L21 19.5H15.8L11.7 13.9L7 19.5H4.5L10.4 12.8L4.2 4.5H9.6L13.3 9.6L17.5 4.5ZM16.6 18L7.2 6H5.4L14.8 18H16.6Z" fill="white" />
    </svg>
  )
}

export function TikTokIcon({ size = 24, ...p }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...p}>
      <rect width="24" height="24" rx="5" fill="#000" />
      <path d="M16 5.5C16.5 6.3 17.5 6.8 18.5 6.8V9.1C17.6 9.1 16.7 8.8 16 8.3V13.5C16 15.9 14.1 17.8 11.7 17.8C9.3 17.8 7.4 15.9 7.4 13.5C7.4 11.1 9.3 9.2 11.7 9.2C12 9.2 12.3 9.2 12.6 9.3V11.6C12.3 11.5 12 11.5 11.7 11.5C10.5 11.5 9.7 12.3 9.7 13.5C9.7 14.7 10.5 15.5 11.7 15.5C12.9 15.5 13.8 14.7 13.8 13.5V5.5H16Z" fill="white" />
      <path d="M16 5.5C16.5 6.3 17.5 6.8 18.5 6.8V9.1C17.6 9.1 16.7 8.8 16 8.3" stroke="#69C9D0" strokeWidth="0.5" />
    </svg>
  )
}

export function LinkedInIcon({ size = 24, ...p }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...p}>
      <rect width="24" height="24" rx="5" fill="#0A66C2" />
      <path d="M7 9.5H9.5V17H7V9.5ZM8.25 8.5C7.5 8.5 7 8 7 7.25C7 6.5 7.5 6 8.25 6C9 6 9.5 6.5 9.5 7.25C9.5 8 9 8.5 8.25 8.5ZM17 17H14.5V13C14.5 12 14 11.5 13.25 11.5C12.5 11.5 12 12 12 13V17H9.5V9.5H12V10.5C12.5 9.75 13.25 9.25 14.25 9.25C15.75 9.25 17 10.25 17 12.5V17Z" fill="white" />
    </svg>
  )
}

export function GoogleIcon({ size = 24, ...p }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...p}>
      <rect width="24" height="24" rx="5" fill="#fff" stroke="#e5e7eb" />
      <path d="M21.5 12.2c0-.6-.1-1.2-.2-1.8H12v3.4h5.3c-.2 1.2-.9 2.2-2 2.9v2.4h3.2c1.9-1.7 3-4.3 3-6.9z" fill="#4285F4" />
      <path d="M12 22c2.7 0 4.9-.9 6.5-2.4l-3.2-2.4c-.9.6-2 .9-3.3.9-2.5 0-4.7-1.7-5.5-4H3.2v2.5C4.8 19.8 8.2 22 12 22z" fill="#34A853" />
      <path d="M6.5 14.1c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.6H3.2C2.4 9.1 2 10.5 2 12s.4 2.9 1.2 4.4l3.3-2.3z" fill="#FBBC05" />
      <path d="M12 5.9c1.4 0 2.7.5 3.7 1.4l2.7-2.7C16.9 3 14.7 2 12 2 8.2 2 4.8 4.2 3.2 7.5l3.3 2.5c.8-2.3 3-3.9 5.5-3.9-.1 0-.1-.2 0-.2z" fill="#EA4335" />
    </svg>
  )
}

export function WordPressIcon({ size = 24, ...p }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...p}>
      <rect width="24" height="24" rx="5" fill="#21759B" />
      <path d="M4.2 12C4.2 15.5 6.3 18.5 9.3 19.8L5 8.3C4.5 9.4 4.2 10.7 4.2 12ZM17.9 11.4c0-1.1-.4-1.9-.8-2.5-.5-.8-1-1.4-1-2.1 0-.8.6-1.6 1.5-1.6h.1C16.1 3.9 14.1 3.2 12 3.2c-2.8 0-5.3 1.4-6.8 3.6h.5c.9 0 2.2-.1 2.2-.1.5 0 .5.7 0 .7 0 0-.4 0-.9.1L9.5 14l2.3-6.9-.8-.1c-.5 0-.5-.7 0-.7 0 0 1.4.1 2.2.1.9 0 2.2-.1 2.2-.1.5 0 .5.7 0 .7 0 0-.4 0-.9.1l2.5 7.4.7-2.3c.3-.9.5-1.5.5-2.1ZM12.2 13l-2.1 6c.6.2 1.3.3 1.9.3.8 0 1.6-.1 2.3-.4L12.2 13Zm6 -5.4c0 .8-.1 1.7-.6 2.9L16 15.1c1.8-1 3-3 3-5.1 0-.9-.2-1.8-.6-2.6.4.7.8 1.5.8 2.2Z" fill="white" />
    </svg>
  )
}

export function EmailIcon({ size = 24, ...p }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...p}>
      <rect width="24" height="24" rx="5" fill="#6366f1" />
      <rect x="4" y="7" width="16" height="11" rx="2" stroke="white" strokeWidth="1.5" fill="none" />
      <path d="M4 9L12 14L20 9" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function OtherIcon({ size = 24, ...p }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" {...p}>
      <rect width="24" height="24" rx="5" fill="#6b7280" />
      <circle cx="8" cy="12" r="1.5" fill="white" />
      <circle cx="12" cy="12" r="1.5" fill="white" />
      <circle cx="16" cy="12" r="1.5" fill="white" />
    </svg>
  )
}

export type { IconProps }
