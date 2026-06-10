import { useState, useEffect, useCallback, useRef } from 'react'
import { useWalletStore } from '../store/walletStore'
import { getEthBalance } from '../services/blockchain'

const POLL_INTERVAL_MS = 30_000

export function useWalletBalance() {
  const address = useWalletStore((s) => s.identity?.address)
  const [balance, setBalance]     = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const refresh = useCallback(async () => {
    if (!address) return
    setIsLoading(true)
    try {
      const result = await getEthBalance(address as `0x${string}`)
      setBalance(result)
    } catch {
      // Silently keep previous value on network error
    } finally {
      setIsLoading(false)
    }
  }, [address])

  useEffect(() => {
    if (!address) {
      setBalance(null)
      return
    }

    refresh()

    timerRef.current = setInterval(refresh, POLL_INTERVAL_MS)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [address, refresh])

  return { balance, isLoading, refresh }
}
