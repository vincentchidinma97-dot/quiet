'use client'

import { useState, useEffect, useRef } from 'react'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { fromHex } from 'viem'
import { Client, IdentifierKind } from '@xmtp/browser-sdk'

interface UseXmtpResult {
  xmtpClient: Client | null
  isInitializing: boolean
  error: string | null
}

export function useXmtp(): UseXmtpResult {
  const { ready, authenticated } = usePrivy()
  const { wallets } = useWallets()
  const [xmtpClient, setXmtpClient] = useState<Client | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const initRef = useRef(false)

  useEffect(() => {
    if (!ready || !authenticated) return
    const embeddedWallet = wallets.find((w) => w.walletClientType === 'privy')
    if (!embeddedWallet) return
    if (initRef.current || xmtpClient) return

    initRef.current = true
    setIsInitializing(true)
    setError(null)

    ;(async () => {
      try {
        console.log('[quiet/xmtp] wallet found:', embeddedWallet.address, 'type:', embeddedWallet.walletClientType)

        console.log('[quiet/xmtp] getting EIP-1193 provider...')
        const provider = await embeddedWallet.getEthereumProvider()
        console.log('[quiet/xmtp] provider ready:', typeof provider, Object.keys(provider))

        const address = embeddedWallet.address as `0x${string}`

        // Reuse the same XMTP installation across page loads.
        // Without this, every refresh creates a new MLS installation
        // that isn't a member of existing DM groups.
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
            console.log('[quiet/xmtp] signMessage called — Privy modal should appear...')
            console.log('[quiet/xmtp] message to sign (first 80 chars):', message.slice(0, 80))

            // Use personal_sign directly on the EIP-1193 provider.
            // Privy's provider handles the modal/recovery flow from here.
            const sig = await provider.request({
              method: 'personal_sign',
              params: [message, address],
            }) as string

            console.log('[quiet/xmtp] signature received, length:', sig.length)
            return fromHex(sig as `0x${string}`, 'bytes')
          },
        }

        console.log('[quiet/xmtp] calling Client.create...')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const client = await Client.create(signer, { env: 'dev', dbEncryptionKey } as any)
        console.log('[quiet/xmtp] ✓ client ready — inboxId:', client.inboxId)

        // Pull the latest conversation list + welcome messages from the network
        // before handing the client to the app. Without this, listConversations()
        // would read a stale local DB on the first call.
        console.log('[quiet/xmtp] syncing conversations from network...')
        await client.conversations.sync()
        console.log('[quiet/xmtp] ✓ initial sync complete')

        setXmtpClient(client)
      } catch (err: unknown) {
        // Log the full error object so we can see exactly what XMTP/Privy throws
        console.error('[quiet/xmtp] ✗ FULL error object:', err)
        console.error('[quiet/xmtp] error type:', Object.prototype.toString.call(err))
        if (err && typeof err === 'object') {
          console.error('[quiet/xmtp] error keys:', Object.keys(err))
          try {
            console.error('[quiet/xmtp] error JSON:', JSON.stringify(err, null, 2))
          } catch {
            console.error('[quiet/xmtp] (error not JSON-serializable)')
          }
        }
        if (err instanceof Error) {
          console.error('[quiet/xmtp] message:', err.message)
          console.error('[quiet/xmtp] stack:', err.stack)
          if ('cause' in err) console.error('[quiet/xmtp] cause:', err.cause)
        }
        setError(err instanceof Error ? err.message : 'failed to initialize messaging')
        initRef.current = false
      } finally {
        setIsInitializing(false)
      }
    })()
  }, [ready, authenticated, wallets, xmtpClient])

  return { xmtpClient, isInitializing, error }
}
