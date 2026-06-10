// ─── Vault Core Types ─────────────────────────────────────────────────────────

export interface WalletIdentity {
  address: string          // 0x... checksummed Ethereum address
  chainId: number          // 1 = mainnet, 11155111 = sepolia
  ensName?: string         // resolved ENS if available
  ecdhPublicKey: string    // hex-encoded ECDH public key for E2E encryption
  connectedAt: number      // unix timestamp
}

export interface VaultKeypair {
  publicKey: string        // hex-encoded x25519 public key
  privateKey: string       // hex-encoded x25519 private key — NEVER leaves device
}

export interface EncryptedMessage {
  id: string               // uuid
  ciphertext: string       // base64 encrypted payload
  nonce: string            // base64 AES-GCM nonce
  senderPublicKey: string  // sender's ECDH public key
  signature: string        // EIP-712 wallet signature of ciphertext hash
  timestamp: number        // unix ms
  contentTopic: string     // Waku content topic
}

export interface PlaintextMessage {
  id: string
  from: string             // wallet address
  to: string               // wallet address or room id
  content: string
  type: MessageType
  timestamp: number
  signature: string
  verified: boolean        // true if signature matches sender address
}

export type MessageType =
  | 'text'
  | 'token_card'
  | 'payment_confirmation'
  | 'trade_confirmation'
  | 'room_invite'
  | 'system'

export interface TokenCard {
  contractAddress: string
  name: string
  symbol: string
  price: number            // USD
  priceChange1h: number    // percentage
  priceChange24h: number   // percentage
  volume24h: number        // USD
  liquidity: number        // USD
  marketCap: number        // USD
  holders: number
  buyTax: number           // percentage (0–100)
  sellTax: number          // percentage (0–100)
  isHoneypot: boolean
  liquidityLocked: boolean
  liquidityLockExpiry?: number  // unix timestamp
  chartData: ChartPoint[]
  chain: 'ethereum' | 'solana'
  dexUrl: string
}

export interface ChartPoint {
  timestamp: number
  price: number
}

export interface TradeParams {
  tokenIn: string          // contract address (use ETH_ADDRESS for native ETH)
  tokenOut: string         // contract address
  amountIn: string         // wei string
  slippageBps: number      // basis points (e.g. 1500 = 15%)
  gasPrice?: string        // wei string — if undefined uses network estimate
  gasPriorityMultiplier: 1 | 1.5 | 2.5  // normal / fast / turbo
  autoSellMultiplier?: number  // e.g. 3 = sell at 3×
  stopLossPercent?: number     // e.g. 50 = sell if -50%
  recipientAddress: string
}

export interface TradeResult {
  txHash: string
  status: 'pending' | 'confirmed' | 'failed'
  amountIn: string
  amountOut: string
  fee: string              // vault protocol fee in wei
  gasUsed?: string
  blockNumber?: number
  timestamp: number
}

export interface PaymentParams {
  to: string               // recipient wallet address
  token: 'ETH' | 'USDC' | string  // contract address for ERC-20
  amount: string           // human-readable (e.g. "0.1")
  amountWei: string        // wei string
  memo?: string            // optional message
}

export interface Room {
  id: string               // on-chain room id
  name: string
  description?: string
  creatorAddress: string
  minEthRequired: string   // human-readable ETH
  requiredToken?: string   // optional ERC-20 contract address
  maxMembers: number
  memberCount: number
  members: RoomMember[]
  contentTopic: string     // Waku content topic
  createdAt: number
  isInviteOnly: boolean
}

export interface RoomMember {
  address: string
  joinedAt: number
  pnlUsd: number           // on-chain verifiable PnL from trades in this room
  badges: MemberBadge[]
  isAdmin: boolean
  isOnline: boolean
}

export type MemberBadge =
  | 'whale'          // holds > 10 ETH
  | 'alpha'          // top-performing caller in room
  | 'og'             // early Uniswap / protocol holder
  | 'diamond-hands'  // held token > 30 days
  | 'verified'       // project-verified wallet

export interface OnChainReputation {
  address: string
  ethBalance: string       // human-readable
  isWhale: boolean         // > 10 ETH
  isEarlyUniswapHolder: boolean
  totalTxCount: number
  defiProtocolsUsed: string[]
  nftCollections: string[]
  badges: MemberBadge[]
  lastUpdated: number
}

export interface SnipeSettings {
  amountEth: string        // default buy amount
  slippageBps: number      // default slippage
  gasPriority: 'normal' | 'fast' | 'turbo'
  maxGasGwei?: number
  autoSellMultiplier?: number
  stopLossPercent?: number
}

export interface Portfolio {
  totalUsd: number
  change24hUsd: number
  change24hPercent: number
  assets: PortfolioAsset[]
  lastUpdated: number
}

export interface PortfolioAsset {
  symbol: string
  name: string
  contractAddress?: string   // undefined for native ETH
  balance: string            // human-readable
  balanceUsd: number
  priceUsd: number
  change24hPercent: number
  chain: 'ethereum' | 'solana'
}

// ─── API Types ────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  timestamp: number
}

export interface WsEvent {
  type: WsEventType
  payload: unknown
  timestamp: number
}

export type WsEventType =
  | 'new_message'
  | 'new_liquidity'       // mempool listener detected new pair
  | 'trade_confirmed'
  | 'payment_confirmed'
  | 'member_joined'
  | 'price_alert'
  | 'room_update'

// ─── Constants ────────────────────────────────────────────────────────────────

export const ETH_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
export const USDC_ADDRESS_MAINNET = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
export const VAULT_SIGN_MESSAGE = (address: string) =>
  `Vault identity v1 — ${address.toLowerCase()}\n\nSigning this message creates your encrypted messaging identity.\n\nThis signature cannot move funds.`
export const VAULT_FEE_BPS = 50  // 0.5%
export const VAULT_CONTENT_TOPIC_PREFIX = '/vault/1/'
