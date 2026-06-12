import { sepolia } from 'viem/chains'

export const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID!
export const PRIVY_CLIENT_ID = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID!

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const privyConfig: any = {
  loginMethods: ['apple', 'google', 'email'],
  embeddedWallets: {
    createOnLogin: 'users-without-wallets',
    showWalletUIs: false,
  },
  defaultChain: sepolia,
  supportedChains: [sepolia],
  appearance: {
    theme: 'light',
    accentColor: '#2D5A45',
    logo: undefined,
  },
}
