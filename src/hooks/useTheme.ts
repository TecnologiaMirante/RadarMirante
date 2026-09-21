import { useState, useEffect } from 'react'

type Theme = 'dark' | 'light'

function applyTheme(t: Theme) {
  const html = document.documentElement
  if (t === 'light') {
    html.classList.add('light')
    html.classList.remove('dark')
  } else {
    html.classList.remove('light')
    html.classList.add('dark')
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('radar-theme') as Theme | null
    return saved ?? 'dark'
  })

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem('radar-theme', theme)
  }, [theme])

  // Apply on mount (SSR-safe)
  useEffect(() => { applyTheme(theme) }, [])

  function toggle() {
    setThemeState(t => (t === 'dark' ? 'light' : 'dark'))
  }

  return { theme, toggle }
}
