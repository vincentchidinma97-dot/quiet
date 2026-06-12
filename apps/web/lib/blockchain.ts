import { createPublicClient, http, formatEther } from 'viem'
import { sepolia } from 'viem/chains'

const client = createPublicClient({
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
})

export async function getEthBalance(address: `0x${string}`): Promise<string> {
  const raw = await client.getBalance({ address })
  return formatEther(raw)
}
