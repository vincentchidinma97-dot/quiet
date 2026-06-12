export interface Token {
  symbol: string
  name: string
  address: `0x${string}` | null
  decimals: number
  iconColor: string
  iconLetters: string
}

export const TOKENS: Token[] = [
  {
    symbol: 'ETH',
    name: 'Ethereum',
    address: null,
    decimals: 18,
    iconColor: '#627EEA',
    iconLetters: 'Ξ',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    decimals: 6,
    iconColor: '#2775CA',
    iconLetters: '$',
  },
  {
    symbol: 'USDT',
    name: 'Tether',
    address: '0x7169D38820dfd117C3FA1f22a697dBA58d90BA06',
    decimals: 6,
    iconColor: '#26A17B',
    iconLetters: '₮',
  },
]
