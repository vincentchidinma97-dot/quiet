'use client'

import { PrivyProvider } from '@privy-io/react-auth'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PRIVY_APP_ID, PRIVY_CLIENT_ID, privyConfig } from '@/lib/privyConfig'
import { wagmiAdapter } from '@/lib/reownConfig'
// Side-effect: initialises AppKit on client
import '@/lib/reownConfig'

const queryClient = new QueryClient()

export function Providers({ children }: { children: React.ReactNode }) {
  console.log('[quiet] Privy init', { appId: PRIVY_APP_ID, clientId: PRIVY_CLIENT_ID, loginMethods: privyConfig.loginMethods })
  // WagmiProvider type conflicts with React 18 types in wagmi v2.19+ (React 19 signature)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const WP = WagmiProvider as any
  return (
    <WP config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <PrivyProvider appId={PRIVY_APP_ID} clientId={PRIVY_CLIENT_ID} config={privyConfig}>
          {children as any}
        </PrivyProvider>
      </QueryClientProvider>
    </WP>
  )
}
