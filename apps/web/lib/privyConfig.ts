import { sepolia } from 'viem/chains'

export const PRIVY_APP_ID = 'cmq7nlnjv00jb0ckvis0f0x77'
export const PRIVY_CLIENT_ID = 'client-WY6aG6x1Yp8MtKEPJr4tGmRGFQrmn2UE9pw4cfzkkw6Bz'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const privyConfig: any = {
  loginMethods: ['apple', 'google', 'email'],
  embeddedWallets: {
    createOnLogin: 'users-without-wallets',
    noPromptOnSignature: true,
  },
  defaultChain: sepolia,
  supportedChains: [sepolia],
  appearance: {
    theme: 'light',
    accentColor: '#2D5A45',
    logo: undefined,
  },
}
