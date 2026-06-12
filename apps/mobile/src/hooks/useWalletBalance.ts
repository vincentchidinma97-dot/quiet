import { useState, useEffect, useRef } from 'react'
import { useWalletStore } from '../store/walletStore'
import { getEthBalance } from '../services/blockchain'

const POLL_INTERVAL_MS = 30_000

export function useWalletBalance() {
  const address = useWalletStore((s) => s.identity?.address)
  const [balance, setBalance]     = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const addressRef = useRef(address)
  addressRef.current = address

  async function fetchBalance() {
    const addr = addressRef.current
    if (!addr) return
    setIsLoading(true)
    try {
      const result = await getEthBalance(addr as `0x${string}`)
      console.log(`[Balance] refreshed: ${result} ETH`)
      setBalance(result)
    } catch (e) {
      console.log('[Balance] fetch error:', e)
    } finally {
      setIsLoading(false)
    }
  }

  // Manual refresh exposed to consumers
  async function refresh() {
    await fetchBalance()
  }

  useEffect(() => {
    if (!address) {
      setBalance(null)
      return
    }

    fetchBalance()

    const intervalId = setInterval(() => {
      console.log('[Balance] 30s tick — fetching…')
      fetchBalance()
    }, POLL_INTERVAL_MS)

    return () => clearInterval(intervalId)
  }, [address])

  return { balance, isLoading, refresh }
}
