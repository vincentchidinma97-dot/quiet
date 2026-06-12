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
  console.log('[quiet/xmtp] DM ready, id:', dm.id, '— syncing conversation...')
  await dm.sync()
  console.log('[quiet/xmtp] ✓ conversation synced')
  return dm
}

export async function sendMessage(conversation: Dm, text: string): Promise<string> {
  console.log('[quiet/xmtp] sendMessage:', text.slice(0, 40))
  const id = await conversation.sendText(text)
  console.log('[quiet/xmtp] sent, msgId:', id)
  return id
}

export async function listMessages(conversation: Dm): Promise<DecodedMessage[]> {
  console.log('[quiet/xmtp] loading messages for conversation', conversation.id, '...')
  console.log('[quiet/xmtp] syncing conversation...')
  await conversation.sync()
  console.log('[quiet/xmtp] ✓ conversation sync complete')
  const msgs = await conversation.messages()
  const text = msgs.filter(
    (m) => m.kind === GroupMessageKind.Application && isText(m),
  )
  console.log('[quiet/xmtp] ✓ found', text.length, 'messages')
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
  console.log('[quiet/xmtp] ✓ sync complete, found', dms.length, 'conversations')
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

export async function getConversationStatus(
  client: Client,
  dm: Dm,
): Promise<'accepted' | 'pending'> {
  // Sync this conversation so we have an up-to-date message list
  await dm.sync()
  const msgs = await dm.messages()
  const appMsgs = msgs.filter((m) => m.kind === GroupMessageKind.Application)
  const iSentOne = appMsgs.some((m) => m.senderInboxId === client.inboxId)
  if (iSentOne) return 'accepted'
  // If the peer sent messages but I haven't replied → request
  if (appMsgs.length > 0) return 'pending'
  // Empty conversation (I initiated it, nothing sent yet)
  return 'accepted'
}
