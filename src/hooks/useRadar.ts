import { useState, useEffect, useCallback } from 'react'
import type { RadarPost, RadarFilters } from '@/types/radar'
import { getPosts } from '@/services/radar'
import { useAccount } from '@/contexts/AccountContext'

const DEFAULT_FILTERS: RadarFilters = {
  platform: 'all',
  time: '2d',
  sort: 'recent',
}

export function useRadar() {
  const [posts, setPosts] = useState<RadarPost[]>([])
  const [filters, setFilters] = useState<RadarFilters>(DEFAULT_FILTERS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { account } = useAccount()

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
