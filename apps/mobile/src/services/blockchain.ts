import { useMemo } from 'react'
import { createPublicClient, http, formatEther } from 'viem'
import { sepolia, mainnet } from 'viem/chains'

const SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com'

export function usePublicClient() {
  return useMemo(
    () =>
      createPublicClient({
        chain: sepolia,
        transport: http(SEPOLIA_RPC),
      }),
    [],
  )
}

export async function getEthBalance(address: `0x${string}`): Promise<string> {
  const client = createPublicClient({
    chain: sepolia,
    transport: http(SEPOLIA_RPC),
  })
  const raw = await client.getBalance({ address })
  const formatted = formatEther(raw)
  // Trim to 4 decimal places
  const num = parseFloat(formatted)
  return num.toFixed(4).replace(/\.?0+$/, '') || '0'
}

export async function getEnsName(address: `0x${string}`): Promise<string | null> {
  try {
    const client = createPublicClient({
      chain: mainnet,
      transport: http('https://ethereum-rpc.publicnode.com'),
    })
    const name = await client.getEnsName({ address })
    return name ?? null
  } catch {
    return null
  }
}
