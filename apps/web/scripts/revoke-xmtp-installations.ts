#!/usr/bin/env npx tsx
/**
 * ONE-TIME RECOVERY TOOL — revoke excess XMTP installations.
 *
 * Use this when you hit the 10/10 installation limit during development.
 * It reads your wallet key from a temporary file (.xmtp-key.tmp), deletes
 * that file immediately, connects to XMTP, lists all registered installations
 * under your InboxID, and revokes every one except the current session.
 *
 * LONG-TERM SOLUTION (Phase B): the "Manage Devices" section in
 * Settings → Security will let users do this from the UI without ever
 * touching a private key in a terminal. This script is the stopgap.
 *
 * Usage (run from apps/web/):
 *   echo -n '0xYOUR_KEY_HERE' > .xmtp-key.tmp
 *   npx tsx scripts/revoke-xmtp-installations.ts
 *
 * The file is gitignored and deleted the moment the script reads it.
 *
 * Note: uses @xmtp/browser-sdk in Node.js via tsx. If you see a
 * storage/OPFS error, install @xmtp/node-sdk and swap the import —
 * the API (inboxState, revokeInstallations) is identical.
 */

import { readFileSync, unlinkSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { privateKeyToAccount } from 'viem/accounts'
import { fromHex } from 'viem'
import { Client, IdentifierKind } from '@xmtp/browser-sdk'

// ---------------------------------------------------------------------------
// Overwrite a string variable's underlying memory as best JS allows.
// JS strings are immutable so true zeroing isn't possible, but this
// removes our reference and allows GC to collect it sooner.
// ---------------------------------------------------------------------------
function clearSensitive(ref: { value: string }) {
  ref.value = '\x00'.repeat(ref.value.length)
  ref.value = ''
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log()
  console.log('⚠️  This script will use your wallet\'s private key in memory only.')
  console.log('    After running, you should treat this key as compromised —')
  console.log('    rotate to a fresh wallet for ongoing testing.')
  console.log()

  const keyFilePath = resolve(process.cwd(), '.xmtp-key.tmp')

  if (!existsSync(keyFilePath)) {
    console.log('No key file found. Create one with your private key, then re-run:')
    console.log()
    console.log("    echo -n '0xYOUR_KEY_HERE' > .xmtp-key.tmp")
    console.log('    npx tsx scripts/revoke-xmtp-installations.ts')
    console.log()
    console.log('The file is gitignored and will be deleted immediately on next run.')
    process.exit(1)
  }

  const keyRef = { value: '' }
  try {
    keyRef.value = readFileSync(keyFilePath, 'utf8')
    unlinkSync(keyFilePath)
    console.log('Temp key file deleted.')
  } finally {
    // If readFileSync threw, the file may still exist — best-effort second delete
    if (existsSync(keyFilePath)) {
      try { unlinkSync(keyFilePath) } catch { /* ignore */ }
    }
  }

  const trimmed = keyRef.value.trim()
  clearSensitive(keyRef)

  if (!trimmed) {
    console.error('Key file was empty — exiting.')
    process.exit(1)
  }

  const normalized = (trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`) as `0x${string}`

  let account: ReturnType<typeof privateKeyToAccount>
  try {
    account = privateKeyToAccount(normalized)
  } catch {
    console.error('Invalid private key format.')
    process.exit(1)
  }

  console.log(`Wallet:       ${account.address}`)

  const signer = {
    type: 'EOA' as const,
    getIdentifier: () => ({
      identifier: account.address,
      identifierKind: IdentifierKind.Ethereum,
    }),
    signMessage: async (message: string): Promise<Uint8Array> => {
      const sig = await account.signMessage({ message })
      return fromHex(sig, 'bytes')
    },
  }

  const dbEncryptionKey = globalThis.crypto.getRandomValues(new Uint8Array(32))

  console.log('Connecting to XMTP (dev)...')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = await Client.create(signer, { env: 'dev', dbEncryptionKey } as any)

  console.log(`InboxID:      ${client.inboxId}`)
  console.log(`This install: ${client.installationId}`)

  // refresh:true forces a network fetch, not a local cache read
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const state = await (client as any).inboxState(true)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const installations: any[] = state.installations

  if (!installations.length) {
    console.log('\nNo installations found — nothing to do.')
    return
  }

  console.log(`\nInstallations (${installations.length}/10):`)
  installations.forEach((inst, i) => {
    const isCurrent = inst.id === client.installationId
    console.log(`  ${i + 1}. ${inst.id}${isCurrent ? '  ← current (keeping)' : ''}`)
  })

  const toRevoke = installations
    .filter((inst) => inst.id !== client.installationId)
    .map((inst) => inst.id)

  if (!toRevoke.length) {
    console.log('\nOnly 1 installation registered — nothing to revoke.')
    return
  }

  console.log(`\nRevoking ${toRevoke.length} installation(s)...`)
  await client.revokeInstallations(toRevoke)
  console.log(`✓ Revoked ${toRevoke.length}. You are now at 1/10 installations.`)
}

main()
  .catch((err) => {
    console.error('\nFATAL:', err?.message ?? err)
    process.exitCode = 1
  })
  .finally(() => {
    // Ensure the process exits cleanly even if XMTP left async work pending
    process.exit(process.exitCode ?? 0)
  })
