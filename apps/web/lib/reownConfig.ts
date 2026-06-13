import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { sepolia } from '@reown/appkit/networks'
import { createAppKit } from '@reown/appkit/react'

export const REOWN_PROJECT_ID = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ?? ''

// Use a mutable array — WagmiAdapter/createAppKit do not accept readonly tuples
export const networks = [sepolia]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const wagmiAdapter = new WagmiAdapter({
  networks: networks as any,
  projectId: REOWN_PROJECT_ID,
})

// Initialize AppKit once at module load — safe to call on server, no-ops until client hydrates.
if (typeof window !== 'undefined' && REOWN_PROJECT_ID) {
  createAppKit({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    adapters: [wagmiAdapter as any],
    networks: networks as any,
    projectId: REOWN_PROJECT_ID,
    metadata: {
      name: 'quiet.',
      description: 'encrypted correspondence between wallets',
      url: window.location.origin,
      icons: [],
    },
    features: {
      analytics: false,
      socials: false,
      email: false,
    },
    themeMode: 'dark',
  })
}
