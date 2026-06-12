import {
  createPublicClient,
  createWalletClient,
  http,
  custom,
  formatEther,
  parseEther,
  encodeFunctionData,
} from 'viem'
import { sepolia } from 'viem/chains'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Provider = { request: (...args: any[]) => Promise<any> }

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
})

const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

function formatTokenAmount(raw: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals)
  const whole = raw / divisor
  const frac = raw % divisor
  const fracStr = frac.toString().padStart(decimals, '0').slice(0, 4)
  return `${whole}.${fracStr}`
}

function parseTokenAmount(amount: string, decimals: number): bigint {
  const [whole, frac = ''] = amount.split('.')
  const fracPadded = frac.padEnd(decimals, '0').slice(0, decimals)
  return BigInt(whole || '0') * BigInt(10 ** decimals) + BigInt(fracPadded || '0')
}

export async function getEthBalance(address: `0x${string}`): Promise<string> {
  const raw = await publicClient.getBalance({ address })
  return formatEther(raw)
}

export async function getTokenBalance(
  tokenAddress: `0x${string}`,
  walletAddress: `0x${string}`,
  decimals: number,
): Promise<string> {
  const raw = await publicClient.readContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [walletAddress],
  })
  return formatTokenAmount(raw as bigint, decimals)
}

export async function estimateTxFee(
  fromAddress: `0x${string}`,
  toAddress: `0x${string}`,
  tokenAddress: `0x${string}` | null,
  tokenDecimals: number,
  amount: string,
): Promise<string> {
  try {
    let gasUnits: bigint
    if (tokenAddress === null) {
      gasUnits = await publicClient.estimateGas({
        account: fromAddress,
        to: toAddress,
        value: parseEther(amount || '0'),
      })
    } else {
      const raw = parseTokenAmount(amount || '0', tokenDecimals)
      const data = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [toAddress, raw],
      })
      gasUnits = await publicClient.estimateGas({
        account: fromAddress,
        to: tokenAddress,
        data,
      })
    }
    const gasPrice = await publicClient.getGasPrice()
    const gasCostWei = gasUnits * gasPrice
    return `~${parseFloat(formatEther(gasCostWei)).toFixed(6)}`
  } catch {
    return 'unknown'
  }
}

export async function sendEth(
  provider: Provider,
  fromAddress: `0x${string}`,
  toAddress: `0x${string}`,
  amount: string,
): Promise<`0x${string}`> {
  const walletClient = createWalletClient({
    account: fromAddress,
    chain: sepolia,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transport: custom(provider as any),
  })
  return walletClient.sendTransaction({
    to: toAddress,
    value: parseEther(amount),
  })
}

export async function sendToken(
  provider: Provider,
  fromAddress: `0x${string}`,
  tokenAddress: `0x${string}`,
  toAddress: `0x${string}`,
  amount: string,
  decimals: number,
): Promise<`0x${string}`> {
  const walletClient = createWalletClient({
    account: fromAddress,
    chain: sepolia,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transport: custom(provider as any),
  })
  const raw = parseTokenAmount(amount, decimals)
  return walletClient.writeContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [toAddress, raw],
  })
}
