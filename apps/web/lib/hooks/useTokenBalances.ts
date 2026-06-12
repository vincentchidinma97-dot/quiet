'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { getEthBalance, getTokenBalance } from '@/lib/blockchain'
import { TOKENS, type Token } from '@/lib/tokens'

export interface TokenBalance {
  token: Token
  balance: string | null
}

export function useTokenBalances(address: string | undefined): {
  balances: TokenBalance[]
  isLoading: boolean
  refresh: () => void
} {
  const [balances, setBalances] = useState<TokenBalance[]>(
    TOKENS.map((t) => ({ token: t, balance: null })),
  )
  const [isLoading, setIsLoading] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetch = useCallback(async () => {
    if (!address || !address.startsWith('0x')) return
    setIsLoading(true)
    try {
      const results = await Promise.all(
        TOKENS.map(async (token) => {
          if (token.address === null) {
            const raw = await getEthBalance(address as `0x${string}`)
            return { token, balance: parseFloat(raw).toFixed(4) }
          } else {
            const raw = await getTokenBalance(
              token.address,
              address as `0x${string}`,
              token.decimals,
            )
            return { token, balance: raw }
          }
        }),
      )
      setBalances(results)
    } catch {
      // keep last known values on error
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

  return { balances, isLoading, refresh: fetch }
}
