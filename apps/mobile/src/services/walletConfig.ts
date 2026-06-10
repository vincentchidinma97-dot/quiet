import type { IProviderMetadata } from '@walletconnect/modal-react-native'

// Get a free project ID at https://cloud.walletconnect.com
export const WC_PROJECT_ID = 'd333cf539719070597cd84cdb908af7b'

export const WC_METADATA: IProviderMetadata = {
  name:        'quiet',
  description: 'quiet · encrypted wallet messaging',
  url:         'https://getquiet.app',
  icons:       ['https://getquiet.app/icon.png'],
  redirect: {
    native:    'quiet://',
    universal: 'https://getquiet.app',
  },
}

// Sepolia only — all on-chain interactions are on testnet
export const WC_SESSION_PARAMS = {
  namespaces: {
    eip155: {
      methods: ['personal_sign', 'eth_sendTransaction'],
      chains:  ['eip155:11155111'],
      events:  ['chainChanged', 'accountsChanged'],
      rpcMap:  {},
    },
  },
}

// WalletConnect Explorer wallet IDs — controls which wallet is shown prominently
export const METAMASK_WALLET_ID =
  'c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96'

export const COINBASE_WALLET_ID =
  'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa'

export const PHANTOM_WALLET_ID =
  'a797aa35c0fadbfc1a53e7f675162ed5226968b44a19ee3d24385c64d1d3c393'
