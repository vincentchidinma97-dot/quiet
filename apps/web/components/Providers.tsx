'use client'

import { PrivyProvider } from '@privy-io/react-auth'
import { PRIVY_APP_ID, PRIVY_CLIENT_ID, privyConfig } from '@/lib/privyConfig'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <PrivyProvider appId={PRIVY_APP_ID} clientId={PRIVY_CLIENT_ID} config={privyConfig}>
      {children as any}
    </PrivyProvider>
  )
}
