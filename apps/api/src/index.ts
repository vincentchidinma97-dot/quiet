import Fastify from 'fastify'
import cors from '@fastify/cors'
import websocket from '@fastify/websocket'
import rateLimit from '@fastify/rate-limit'
import { z } from 'zod'
import type { WsEvent, ApiResponse, TokenCard } from '@vault/shared'

// ── Bootstrap ─────────────────────────────────────────────────────────────────
const app = Fastify({ logger: process.env.NODE_ENV !== 'production' })

await app.register(cors, { origin: '*' })
await app.register(websocket)
await app.register(rateLimit, { max: 100, timeWindow: '1 minute' })

// Connected WebSocket clients keyed by wallet address
const clients = new Map<string, Set<import('ws').WebSocket>>()

function broadcast(address: string, event: WsEvent) {
  const sockets = clients.get(address.toLowerCase())
  if (!sockets) return
  const payload = JSON.stringify(event)
  sockets.forEach((ws) => {
    if (ws.readyState === 1) ws.send(payload)
  })
}

// ── WebSocket endpoint ────────────────────────────────────────────────────────
app.register(async (instance) => {
  instance.get('/ws/:address', { websocket: true }, (socket, req) => {
    const address = (req.params as { address: string }).address.toLowerCase()

    if (!clients.has(address)) clients.set(address, new Set())
    clients.get(address)!.add(socket)

    console.log(`[ws] connected: ${address} (${clients.get(address)!.size} sockets)`)

    socket.on('message', (raw) => {
      try {
        const event = JSON.parse(raw.toString()) as WsEvent
        console.log(`[ws] message from ${address}:`, event.type)
        // Route events — messages, trades, etc.
      } catch { /* ignore malformed */ }
    })

    socket.on('close', () => {
      clients.get(address)?.delete(socket)
      console.log(`[ws] disconnected: ${address}`)
    })
  })
})

// ── Token resolution endpoint ─────────────────────────────────────────────────
// Detects a contract address in a message and returns a TokenCard
app.get('/token/:address', async (req, reply): Promise<ApiResponse<TokenCard>> => {
  const { address } = req.params as { address: string }

  try {
    // In production: call Dexscreener + GoPlus APIs in parallel
    // Dexscreener: GET https://api.dexscreener.com/latest/dex/tokens/{address}
    // GoPlus:      GET https://api.gopluslabs.io/api/v1/token_security/1?contract_addresses={address}

    // Scaffold: return mock data
    const mockToken: TokenCard = {
      contractAddress:  address,
      name:             'Vault Token',
      symbol:           'VAULT',
      price:            0.00142,
      priceChange1h:    142.4,
      priceChange24h:   890.2,
      volume24h:        2_400_000,
      liquidity:        180_000,
      marketCap:        2_400_000,
      holders:          342,
      buyTax:           0,
      sellTax:          0,
      isHoneypot:       false,
      liquidityLocked:  true,
      liquidityLockExpiry: Date.now() + 6 * 30 * 24 * 60 * 60 * 1000,
      chartData:        Array.from({ length: 60 }, (_, i) => ({
        timestamp: Date.now() - (60 - i) * 60_000,
        price:     0.00001 * Math.pow(1.05, i) * (0.9 + Math.random() * 0.2),
      })),
      chain:  'ethereum',
      dexUrl: `https://dexscreener.com/ethereum/${address}`,
    }

    return reply.send({ success: true, data: mockToken, timestamp: Date.now() })
  } catch (err: any) {
    return reply.status(500).send({ success: false, error: err.message, timestamp: Date.now() })
  }
})

// ── On-chain reputation endpoint ──────────────────────────────────────────────
app.get('/reputation/:address', async (req, reply) => {
  const { address } = req.params as { address: string }

  // In production: query The Graph for wallet activity
  // GET https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3
  // Query: { user(id: "{address}") { swaps { amountUSD } } }

  const mockRep = {
    address,
    ethBalance:             '3.1',
    isWhale:                false,
    isEarlyUniswapHolder:   true,
    totalTxCount:           1240,
    defiProtocolsUsed:      ['uniswap', 'aave', 'compound'],
    nftCollections:         ['boredapeyachtclub'],
    badges:                 ['og', 'alpha'],
    lastUpdated:            Date.now(),
  }

  return reply.send({ success: true, data: mockRep, timestamp: Date.now() })
})

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', async () => ({ status: 'ok', ts: Date.now() }))

// ── Price feed ────────────────────────────────────────────────────────────────
app.get('/price/:symbol', async (req, reply) => {
  const { symbol } = req.params as { symbol: string }
  // In production: CoinGecko API
  const prices: Record<string, number> = { ETH: 3840, BTC: 68000, USDC: 1 }
  const price = prices[symbol.toUpperCase()]
  if (!price) return reply.status(404).send({ success: false, error: 'symbol not found', timestamp: Date.now() })
  return reply.send({ success: true, data: { symbol: symbol.toUpperCase(), price, ts: Date.now() }, timestamp: Date.now() })
})

// ── Snipe preparation endpoint ────────────────────────────────────────────────
// Validates a trade before the wallet signs it
const SnipeSchema = z.object({
  tokenIn:       z.string(),
  tokenOut:      z.string(),
  amountIn:      z.string(),
  slippageBps:   z.number().min(0).max(5000),
  walletAddress: z.string(),
})

app.post('/snipe/prepare', async (req, reply) => {
  const body = SnipeSchema.safeParse(req.body)
  if (!body.success) {
    return reply.status(400).send({ success: false, error: 'invalid params', timestamp: Date.now() })
  }

  // In production: build Uniswap v3 exactInputSingle calldata
  // const router = new ethers.Contract(UNISWAP_V3_ROUTER, routerABI, provider)
  // const quote = await quoter.quoteExactInputSingle(...)

  return reply.send({
    success: true,
    data: {
      estimatedOut:   '420690000000000000',  // mock output in wei
      priceImpact:    1.2,                    // percent
      fee:            '500000000000000',      // vault 0.5% fee in wei
      routerAddress:  '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      calldata:       '0x414bf389...',        // mock calldata
    },
    timestamp: Date.now(),
  })
})

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '3000', 10)
try {
  await app.listen({ port: PORT, host: '0.0.0.0' })
  console.log(`\n🔐 Vault API running on port ${PORT}`)
  console.log(`   WebSocket: ws://localhost:${PORT}/ws/:address`)
  console.log(`   Token:     GET /token/:address`)
  console.log(`   Repute:    GET /reputation/:address`)
  console.log(`   Health:    GET /health\n`)
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
