import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { usePrivy, useEmbeddedEthereumWallet } from '@privy-io/expo'
import type { Client } from '@xmtp/react-native-sdk'
import { initXmtpClient } from '../services/xmtp'

interface XmtpContextValue {
  xmtpClient:    Client<any> | null
  isInitializing: boolean
  error:          string | null
}

const XmtpContext = createContext<XmtpContextValue>({
  xmtpClient:     null,
  isInitializing: false,
  error:          null,
})

export function XmtpProvider({ children }: { children: React.ReactNode }) {
  const { user, isReady } = usePrivy()
  const { wallets }       = useEmbeddedEthereumWallet()

  const [xmtpClient, setXmtpClient]       = useState<Client<any> | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const [error, setError]                   = useState<string | null>(null)
  const initRef = useRef(false)

  useEffect(() => {
    if (!isReady || !user || wallets.length === 0) return
    if (initRef.current) return
    initRef.current = true

    const wallet = wallets[0]

    async function init() {
      setIsInitializing(true)
      setError(null)
      try {
        console.log('[XMTP] initializing for', wallet.address)
        const provider = await wallet.getProvider()

        const signMessage = async (message: string): Promise<string> => {
          const sig = await provider.request({
            method: 'personal_sign',
            params: [message, wallet.address],
          })
          return sig as string
        }

        const client = await initXmtpClient(wallet.address, signMessage)
        setXmtpClient(client)
        console.log('[XMTP] ready')
      } catch (err: any) {
        const isNativeModuleMissing =
          err?.message?.includes('Cannot find native module') ||
          err?.message?.includes('Native module XMTP') ||
          err?.message?.includes('XMTP')
        if (isNativeModuleMissing) {
          console.warn('[XMTP] native module not available — requires a native build (not Expo Go)')
          setError('native_build_required')
        } else {
          console.error('[XMTP] init error:', err)
          setError(err?.message ?? 'Failed to initialize encrypted messaging')
          initRef.current = false
        }
      } finally {
        setIsInitializing(false)
      }
    }

    init()
  }, [isReady, user, wallets])

  // Reset when user logs out
  useEffect(() => {
    if (isReady && !user) {
      setXmtpClient(null)
      setError(null)
      initRef.current = false
    }
  }, [isReady, user])

  return (
    <XmtpContext.Provider value={{ xmtpClient, isInitializing, error }}>
      {children}
    </XmtpContext.Provider>
  )
}

export function useXmtp(): XmtpContextValue {
  return useContext(XmtpContext)
}
