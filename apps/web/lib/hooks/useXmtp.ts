'use client'

import { useState, useEffect, useRef } from 'react'
import { fromHex } from 'viem'
import { Client, IdentifierKind } from '@xmtp/browser-sdk'
import { useConnectedWallet } from './useConnectedWallet'

interface UseXmtpResult {
  xmtpClient: Client | null
  isInitializing: boolean
  error: string | null
  xmtpLimitReached: boolean
}

export function useXmtp(): UseXmtpResult {
  const wallet = useConnectedWallet()
  const [xmtpClient, setXmtpClient] = useState<Client | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [xmtpLimitReached, setXmtpLimitReached] = useState(false)
  const initRef = useRef(false)
  const prevAddressRef = useRef<string | undefined>(undefined)

  // Reset when wallet address changes (e.g. user switches accounts)
  useEffect(() => {
    if (prevAddressRef.current !== wallet.address) {
      prevAddressRef.current = wallet.address
      if (prevAddressRef.current !== undefined) {
        initRef.current = false
        setXmtpClient(null)
        setError(null)
        setXmtpLimitReached(false)
      }
    }
  }, [wallet.address])

  useEffect(() => {
    if (!wallet.isConnected || !wallet.address) return
    if (initRef.current || xmtpClient) return

    initRef.current = true
    setIsInitializing(true)
    setError(null)

    const address = wallet.address

    ;(async () => {
      try {
        console.log('[quiet/xmtp] wallet:', address, 'source:', wallet.source)

        const provider = await wallet.getProvider()
        if (!provider) throw new Error('no provider available')
        console.log('[quiet/xmtp] provider ready')

        const storageKey = `xmtp-key-${address.toLowerCase()}`
        let dbEncryptionKey: Uint8Array
        const stored = localStorage.getItem(storageKey)
        if (stored) {
          dbEncryptionKey = Uint8Array.from(atob(stored).split('').map((c) => c.charCodeAt(0)))
        } else {
          dbEncryptionKey = crypto.getRandomValues(new Uint8Array(32))
          localStorage.setItem(storageKey, btoa(String.fromCharCode(...dbEncryptionKey)))
        }

        const signer = {
          type: 'EOA' as const,
          getIdentifier: () => ({
            identifier: address,
            identifierKind: IdentifierKind.Ethereum,
          }),
          signMessage: async (message: string): Promise<Uint8Array> => {
            console.log('[quiet/xmtp] signMessage — wallet will prompt')
            const sig = await provider.request({
              method: 'personal_sign',
              params: [message, address],
            }) as string
            return fromHex(sig as `0x${string}`, 'bytes')
          },
        }

        console.log('[quiet/xmtp] calling Client.create...')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = await Client.create(signer, { env: 'dev', dbEncryptionKey } as any)
        console.log('[quiet/xmtp] ✓ ready, inboxId:', client.inboxId)

        await client.conversations.sync()
        console.log('[quiet/xmtp] ✓ initial sync complete')

        setXmtpClient(client)
      } catch (err: unknown) {
        console.error('[quiet/xmtp] ✗ error:', err)
        if (err instanceof Error) {
          console.error('[quiet/xmtp] message:', err.message)
          if ('cause' in err) console.error('[quiet/xmtp] cause:', err.cause)
        }
        const msg = err instanceof Error ? err.message : 'failed to initialize messaging'
        const isLimit = msg.includes('10/10') || msg.includes('installation limit') || msg.includes('already registered')
        setXmtpLimitReached(isLimit)
        setError(msg)
        initRef.current = false
      } finally {
        setIsInitializing(false)
      }
    })()
  // wallet.address and wallet.isConnected are primitives — safe as deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet.isConnected, wallet.address, xmtpClient])

  return { xmtpClient, isInitializing, error, xmtpLimitReached }
}
