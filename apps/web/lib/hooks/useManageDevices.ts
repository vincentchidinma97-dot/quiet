'use client'

import { useState, useCallback, useRef } from 'react'
import { fromHex } from 'viem'
import { Client, IdentifierKind } from '@xmtp/browser-sdk'
import type { Installation } from '@xmtp/browser-sdk'
import { useConnectedWallet } from './useConnectedWallet'

export interface DeviceInstallation {
  id: string
  bytes: Uint8Array
  isCurrent: boolean
}

export interface UseManageDevicesResult {
  installations: DeviceInstallation[]
  inboxId: string | null
  loading: boolean
  error: string | null
  fetchInstallations: () => Promise<void>
  revokeInstallation: (inst: DeviceInstallation) => Promise<void>
}

export function useManageDevices(xmtpClient: Client | null): UseManageDevicesResult {
  const wallet = useConnectedWallet()
  const [installations, setInstallations] = useState<DeviceInstallation[]>([])
  const [inboxId, setInboxId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Cache across fetchInstallations calls — only create once per session
  const mgmtClientRef = useRef<{ client: Client; hasSigner: boolean } | null>(null)

  const buildSigner = useCallback(async (address: string) => {
    const provider = await wallet.getProvider()
    if (!provider) throw new Error('no wallet provider')
    return {
      type: 'EOA' as const,
      getIdentifier: () => ({ identifier: address, identifierKind: IdentifierKind.Ethereum }),
      signMessage: async (message: string): Promise<Uint8Array> => {
        const sig = await provider.request({
          method: 'personal_sign',
          params: [message, address],
        }) as string
        return fromHex(sig as `0x${string}`, 'bytes')
      },
    }
  }, [wallet])

  const getDbKey = useCallback((address: string): Uint8Array => {
    const storageKey = `xmtp-key-${address.toLowerCase()}`
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      return Uint8Array.from(atob(stored).split('').map((c) => c.charCodeAt(0)))
    }
    const key = crypto.getRandomValues(new Uint8Array(32))
    localStorage.setItem(storageKey, btoa(String.fromCharCode(...key)))
    return key
  }, [])

  // Returns a management client. Tries three strategies in order:
  //   1. Re-use the main XMTP client (already connected, has signer)
  //   2. Client.build() — loads existing local identity, no new installation slot
  //   3. Client.create({ disableAutoRegister: true }) — fresh browser, no slot consumed
  const getMgmtClient = useCallback(async (): Promise<{ client: Client; hasSigner: boolean }> => {
    if (xmtpClient) return { client: xmtpClient, hasSigner: true }
    if (mgmtClientRef.current) return mgmtClientRef.current

    if (!wallet.address) throw new Error('wallet not connected')
    const address = wallet.address
    const identifier = { identifier: address, identifierKind: IdentifierKind.Ethereum }
    const dbEncryptionKey = getDbKey(address)

    // Strategy 2: load existing local identity without touching the installation limit
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = await Client.build(identifier, { env: 'dev', dbEncryptionKey } as any)
      mgmtClientRef.current = { client, hasSigner: false }
      return mgmtClientRef.current
    } catch {
      // No existing local identity in OPFS — fall through
    }

    // Strategy 3: create with disableAutoRegister so no new slot is consumed
    const signer = await buildSigner(address)
    const client = await Client.create(signer, {
      env: 'dev',
      dbEncryptionKey,
      disableAutoRegister: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    mgmtClientRef.current = { client, hasSigner: true }
    return mgmtClientRef.current
  }, [xmtpClient, wallet.address, getDbKey, buildSigner])

  const fetchInstallations = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { client } = await getMgmtClient()
      const state = await client.preferences.fetchInboxState()
      const currentId = client.installationId
      const list: DeviceInstallation[] = (state.installations as Installation[]).map((inst) => ({
        id: inst.id,
        bytes: inst.bytes,
        isCurrent: currentId !== undefined && inst.id === currentId,
      }))
      setInboxId(client.inboxId ?? null)
      setInstallations(list)
    } catch (err) {
      console.error('[quiet/manage-devices] fetch error:', err)
      setError(err instanceof Error ? err.message : 'failed to load devices')
    } finally {
      setLoading(false)
    }
  }, [getMgmtClient])

  const revokeInstallation = useCallback(async (inst: DeviceInstallation) => {
    const { client, hasSigner } = await getMgmtClient()
    if (hasSigner) {
      // Instance method available — uses the wallet signer already held by the client
      await client.revokeInstallations([inst.bytes])
    } else {
      // Client.build() case: no signer on the instance, use static method with fresh signer
      const targetInboxId = client.inboxId
      if (!targetInboxId || !wallet.address) throw new Error('inboxId or wallet unavailable')
      const signer = await buildSigner(wallet.address)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (Client.revokeInstallations as any)(signer, targetInboxId, [inst.bytes], 'dev')
    }
    await fetchInstallations()
  }, [getMgmtClient, buildSigner, wallet.address, fetchInstallations])

  return { installations, inboxId, loading, error, fetchInstallations, revokeInstallation }
}
