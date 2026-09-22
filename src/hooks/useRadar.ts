import { useState, useEffect, useCallback } from 'react'
import type { RadarPost, RadarFilters } from '@/types/radar'
import { getPosts } from '@/services/radar'
import { useAccount } from '@/contexts/AccountContext'
import { TIME_FILTER_KEY } from '@/hooks/useTimeFilter'

function readSavedFilters(): RadarFilters {
  try {
    const raw = localStorage.getItem(TIME_FILTER_KEY)
    if (raw) {
      const p = JSON.parse(raw) as { time?: RadarFilters['time']; customFrom?: number; customTo?: number }
      if (p?.time) return { platform: 'all', time: p.time, sort: 'recent', customFrom: p.customFrom, customTo: p.customTo }
    }
  } catch {}
  return { platform: 'all', time: '24h', sort: 'recent' }
}

export function useRadar() {
  const [posts, setPosts] = useState<RadarPost[]>([])
  const [filters, setFiltersRaw] = useState<RadarFilters>(readSavedFilters)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { account } = useAccount()

  // Wrapper that persists time-related fields whenever they change
  const setFilters: React.Dispatch<React.SetStateAction<RadarFilters>> = useCallback((update) => {
    setFiltersRaw(prev => {
      const next = typeof update === 'function' ? update(prev) : update
      if (next.time !== prev.time || next.customFrom !== prev.customFrom || next.customTo !== prev.customTo) {
        try {
          localStorage.setItem(TIME_FILTER_KEY, JSON.stringify({
            time: next.time,
            customFrom: next.customFrom,
            customTo: next.customTo,
          }))
        } catch {}
      }
      return next
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getPosts(filters, account)
      setPosts(data)
    } catch (err) {
      setError('Erro ao carregar posts.')
      console.error('[useRadar]', err)
    } finally {
      setLoading(false)
    }
  }, [filters, account])

  useEffect(() => {
    void load()
  }, [load])

  return {
    posts,
    filters,
    setFilters,
    loading,
    error,
    refresh: load,
  }
}
