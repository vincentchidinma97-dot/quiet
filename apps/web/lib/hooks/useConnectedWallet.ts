'use client'

import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useAccount, useDisconnect } from 'wagmi'

export type WalletSource = 'privy' | 'walletconnect'

export interface ConnectedWallet {
  address: `0x${string}` | undefined
  isConnected: boolean
  source: WalletSource | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getProvider: () => Promise<{ request: (...args: any[]) => Promise<any> } | null>
  disconnect: () => Promise<void>
}

export function useConnectedWallet(): ConnectedWallet {
  const { ready, authenticated, logout } = usePrivy()
  const { wallets } = useWallets()
  const { address: wcAddress, isConnected: wcConnected, connector } = useAccount()
  const { disconnect: wcDisconnect } = useDisconnect()

  const privyWallet = wallets.find((w) => w.walletClientType === 'privy')

  // Privy takes priority — if they're authenticated with an embedded wallet, use that
  if (ready && authenticated && privyWallet) {
    return {
      address: privyWallet.address as `0x${string}`,
      isConnected: true,
      source: 'privy',
      getProvider: () => privyWallet.getEthereumProvider(),
      disconnect: logout,
    }
  }

  // Fallback: external wallet via WalletConnect / Reown AppKit
  if (wcConnected && wcAddress) {
    return {
      address: wcAddress,
      isConnected: true,
      source: 'walletconnect',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getProvider: async () => (connector ? (connector.getProvider() as Promise<any>) : null),
      disconnect: async () => { wcDisconnect() },
    }
  }

  return {
    address: undefined,
    isConnected: false,
    source: null,
    getProvider: async () => null,
    disconnect: async () => {},
  }
}
