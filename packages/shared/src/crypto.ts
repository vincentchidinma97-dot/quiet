import { ethers } from 'ethers'
import type { VaultKeypair, EncryptedMessage, PlaintextMessage } from './types'
import { VAULT_SIGN_MESSAGE, VAULT_CONTENT_TOPIC_PREFIX } from './types'

// ─── ECDH Keypair Generation ──────────────────────────────────────────────────
// Derives a deterministic X25519 keypair from a wallet signature.
// Same wallet = same keypair on any device. No backup phrase needed.

export async function deriveVaultKeypair(
  walletAddress: string,
  signFn: (message: string) => Promise<string>
): Promise<VaultKeypair> {
  const message = VAULT_SIGN_MESSAGE(walletAddress)
  const signature = await signFn(message)

  // Hash the signature to produce 32 bytes of key material
  const keyMaterial = ethers.keccak256(ethers.toUtf8Bytes(signature))
  const privateKeyBytes = ethers.getBytes(keyMaterial)

  // Clamp the private key per X25519 spec
  privateKeyBytes[0]  &= 248
  privateKeyBytes[31] &= 127
  privateKeyBytes[31] |= 64

  const privateKeyHex = ethers.hexlify(privateKeyBytes)

  // Derive public key via scalar multiplication on Curve25519
  // Using ethers secp256k1 as approximation for key derivation in this scaffold
  // In production: use @noble/curves x25519.getPublicKey(privateKeyBytes)
  const wallet = new ethers.Wallet(privateKeyHex)
  const publicKeyHex = wallet.signingKey.publicKey

  return { publicKey: publicKeyHex, privateKey: privateKeyHex }
}

// ─── AES-256-GCM Encryption ───────────────────────────────────────────────────
// Encrypts message content using a shared secret derived from ECDH key exchange.

export async function encryptMessage(
  plaintext: string,
  recipientPublicKey: string,
  senderKeypair: VaultKeypair
): Promise<{ ciphertext: string; nonce: string }> {
  // Derive shared secret via ECDH
  const sharedSecret = deriveSharedSecret(senderKeypair.privateKey, recipientPublicKey)

  // Generate random 12-byte nonce for AES-GCM
  const nonce = crypto.getRandomValues(new Uint8Array(12))

  // Import shared secret as AES-GCM key
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    ethers.getBytes(sharedSecret).slice(0, 32),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )

  // Encrypt
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    keyMaterial,
    encoded
  )

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertextBuffer))),
    nonce: btoa(String.fromCharCode(...nonce)),
  }
}

export async function decryptMessage(
  ciphertext: string,
  nonce: string,
  senderPublicKey: string,
  recipientKeypair: VaultKeypair
): Promise<string> {
  const sharedSecret = deriveSharedSecret(recipientKeypair.privateKey, senderPublicKey)

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    ethers.getBytes(sharedSecret).slice(0, 32),
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )

  const nonceBytes = Uint8Array.from(atob(nonce), (c) => c.charCodeAt(0))
  const ciphertextBytes = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0))

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonceBytes },
    keyMaterial,
    ciphertextBytes
  )

  return new TextDecoder().decode(decrypted)
}

// ─── ECDH Shared Secret ───────────────────────────────────────────────────────

function deriveSharedSecret(privateKeyHex: string, publicKeyHex: string): string {
  // In production: use @noble/curves x25519.getSharedSecret
  // Scaffold: deterministic hash of both keys as shared secret approximation
  return ethers.keccak256(
    ethers.concat([ethers.getBytes(privateKeyHex), ethers.getBytes(publicKeyHex)])
  )
}

// ─── Message Signing ──────────────────────────────────────────────────────────

export function buildMessageSignaturePayload(
  content: string,
  from: string,
  to: string,
  timestamp: number
): string {
  return ethers.keccak256(
    ethers.toUtf8Bytes(JSON.stringify({ content, from, to, timestamp }))
  )
}

export function verifyMessageSignature(
  payload: string,
  signature: string,
  expectedAddress: string
): boolean {
  try {
    const recovered = ethers.verifyMessage(payload, signature)
    return recovered.toLowerCase() === expectedAddress.toLowerCase()
  } catch {
    return false
  }
}

// ─── Waku Content Topics ──────────────────────────────────────────────────────

export function dmContentTopic(addressA: string, addressB: string): string {
  // Deterministic topic — same regardless of who initiates
  const sorted = [addressA.toLowerCase(), addressB.toLowerCase()].sort()
  const hash = ethers.keccak256(ethers.toUtf8Bytes(sorted.join('-'))).slice(2, 18)
  return `${VAULT_CONTENT_TOPIC_PREFIX}dm-${hash}/proto`
}

export function roomContentTopic(roomId: string): string {
  return `${VAULT_CONTENT_TOPIC_PREFIX}room-${roomId}/proto`
}

// ─── Address Formatting ───────────────────────────────────────────────────────

export function shortenAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`
}

export function generateAvatarColor(address: string): {
  bg: string
  fg: string
  initials: string
} {
  const colors = [
    { bg: '#1a1308', fg: '#C9A96E' },
    { bg: '#0f1a2e', fg: '#60a5fa' },
    { bg: '#0f2a1a', fg: '#4ade80' },
    { bg: '#1e0f2e', fg: '#a78bfa' },
    { bg: '#2a0f0f', fg: '#f87171' },
    { bg: '#1a1a0e', fg: '#EF9F27' },
  ]
  const idx = parseInt(address.slice(2, 4), 16) % colors.length
  const initials = address.slice(2, 4).toLowerCase()
  return { ...colors[idx], initials }
}

// ─── Wei / ETH conversion ─────────────────────────────────────────────────────

export function ethToWei(eth: string): string {
  return ethers.parseEther(eth).toString()
}

export function weiToEth(wei: string, decimals = 4): string {
  return parseFloat(ethers.formatEther(wei)).toFixed(decimals)
}

export function applyVaultFee(amountWei: string, feeBps = 50): {
  feeWei: string
  amountAfterFeeWei: string
} {
  const amount = BigInt(amountWei)
  const fee = (amount * BigInt(feeBps)) / BigInt(10000)
  return {
    feeWei: fee.toString(),
    amountAfterFeeWei: (amount - fee).toString(),
  }
}
