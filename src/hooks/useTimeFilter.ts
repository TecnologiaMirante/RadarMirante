import { useState } from 'react'
import type { TimeFilter } from '@/types/radar'

export const TIME_FILTER_KEY = 'radar-time-filter'

export interface SavedTimeFilter {
  time: TimeFilter
  customFrom?: number
  customTo?: number
}

function readSaved(): SavedTimeFilter {
  try {
    const raw = localStorage.getItem(TIME_FILTER_KEY)
    if (raw) {
      const p = JSON.parse(raw) as SavedTimeFilter
      if (p?.time) return p
    }
  } catch {}
  return { time: '24h' }
}

export function saveTimeFilter(state: SavedTimeFilter): void {
  try { localStorage.setItem(TIME_FILTER_KEY, JSON.stringify(state)) } catch {}
}

export function useTimeFilter() {
  const [state, setState] = useState<SavedTimeFilter>(readSaved)

  function set(time: TimeFilter, customFrom?: number, customTo?: number) {
    const next: SavedTimeFilter = { time, customFrom, customTo }
    setState(next)
    saveTimeFilter(next)
  }

  return { ...state, set }
}
