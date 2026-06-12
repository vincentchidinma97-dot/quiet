'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getEthBalance } from '@/lib/blockchain'

interface WalletBalance {
  balance: string | null
  isLoading: boolean
  refresh: () => void
}

export function useWalletBalance(address: string | undefined): WalletBalance {
  const [balance, setBalance] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetch = useCallback(async () => {
    if (!address || !address.startsWith('0x')) return
    setIsLoading(true)
    try {
      const result = await getEthBalance(address as `0x${string}`)
      // Trim to 4 decimal places
      const trimmed = parseFloat(result).toFixed(4)
      setBalance(trimmed)
    } catch {
      // Keep last known value on network error
    } finally {
      setIsLoading(false)
    }
  }, [address])

  useEffect(() => {
    fetch()
    intervalRef.current = setInterval(fetch, 30_000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetch])

  return { balance, isLoading, refresh: fetch }
}
