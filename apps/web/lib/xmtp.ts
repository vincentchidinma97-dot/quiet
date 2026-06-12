'use client'

import {
  Client,
  Dm,
  DecodedMessage,
  IdentifierKind,
  GroupMessageKind,
  isText,
} from '@xmtp/browser-sdk'

export type { Client, Dm, DecodedMessage }

export async function getOrCreateConversation(
  client: Client,
  peerAddress: string,
): Promise<Dm> {
  console.log('[quiet/xmtp] getOrCreateConversation ->', peerAddress)
  const dm = await client.conversations.createDmWithIdentifier({
    identifier: peerAddress,
    identifierKind: IdentifierKind.Ethereum,
  })
  console.log('[quiet/xmtp] DM ready, id:', dm.id)
  return dm
}

export async function sendMessage(conversation: Dm, text: string): Promise<string> {
  console.log('[quiet/xmtp] sendMessage:', text.slice(0, 40))
  const id = await conversation.sendText(text)
  console.log('[quiet/xmtp] sent, msgId:', id)
  return id
}

export async function listMessages(conversation: Dm): Promise<DecodedMessage[]> {
  await conversation.sync()
  const msgs = await conversation.messages()
  const text = msgs.filter(
    (m) => m.kind === GroupMessageKind.Application && isText(m),
  )
  console.log('[quiet/xmtp] listMessages: loaded', text.length, 'text messages')
  return text as DecodedMessage[]
}

export async function streamMessages(
  conversation: Dm,
  onMessage: (msg: DecodedMessage) => void,
): Promise<() => void> {
  const stream = await conversation.stream()
  let active = true

  ;(async () => {
    for await (const msg of stream) {
      if (!active) break
      if (msg.kind === GroupMessageKind.Application && isText(msg)) {
        console.log('[quiet/xmtp] streamed message:', msg.id, 'from:', msg.senderInboxId)
        onMessage(msg as DecodedMessage)
      }
    }
  })()

  return () => {
    active = false
    stream.return()
  }
}

export async function listConversations(client: Client): Promise<Dm[]> {
  console.log('[quiet/xmtp] syncing conversations...')
  await client.conversations.sync()
  const dms = await client.conversations.listDms()
  console.log('[quiet/xmtp] listConversations:', dms.length, 'DMs')
  return dms
}

export async function resolvePeerAddress(client: Client, dm: Dm): Promise<string> {
  try {
    const peerInboxId = await dm.peerInboxId()
    const states = await client.preferences.getInboxStates([peerInboxId])
    const ethId = states[0]?.accountIdentifiers?.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (id: any) => id.identifierKind === IdentifierKind.Ethereum,
    )
    if (ethId?.identifier) return ethId.identifier
    return peerInboxId.slice(0, 20) + '...'
  } catch (err) {
    console.warn('[quiet/xmtp] resolvePeerAddress failed:', err)
    return 'unknown'
  }
}

export async function checkCanMessage(
  client: Client,
  address: string,
): Promise<boolean> {
  const result = await client.canMessage([
    { identifier: address, identifierKind: IdentifierKind.Ethereum },
  ])
  return result.get(address.toLowerCase()) ?? false
}
