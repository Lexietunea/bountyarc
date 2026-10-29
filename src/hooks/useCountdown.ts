import { useState, useEffect } from 'react'

export interface Countdown {
  days: number
  hours: number
  minutes: number
  seconds: number
  expired: boolean
  label: string          // e.g. "6d 4h 12m 33s" or "Expired"
  urgent: boolean        // true when < 24h remain
}

export function useCountdown(deadlineUnixSeconds: bigint): Countdown {
  function calc(): Countdown {
    const diff = Number(deadlineUnixSeconds) - Date.now() / 1000
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true, label: 'Expired', urgent: false }
    const d = Math.floor(diff / 86400)
    const h = Math.floor((diff % 86400) / 3600)
    const m = Math.floor((diff % 3600) / 60)
    const s = Math.floor(diff % 60)
    const urgent = diff < 86400
    const parts: string[] = []
    if (d > 0) parts.push(`${d}d`)
    if (h > 0 || d > 0) parts.push(`${h}h`)
    if (m > 0 || h > 0 || d > 0) parts.push(`${m}m`)
    parts.push(`${s}s`)
    return { days: d, hours: h, minutes: m, seconds: s, expired: false, label: parts.join(' '), urgent }
  }

  const [state, setState] = useState<Countdown>(calc)

  useEffect(() => {
    if (deadlineUnixSeconds === 0n) return
    setState(calc())
    const id = setInterval(() => setState(calc()), 1000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadlineUnixSeconds])

  return state
}
