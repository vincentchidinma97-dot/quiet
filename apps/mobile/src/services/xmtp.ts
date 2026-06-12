// XMTP uses native modules unavailable in Expo Go.
// All imports are lazy (inside functions) so the module can be loaded
// without crashing the runtime when the native module is absent.

export type XmtpConversation = any
export type XmtpMessage      = any

function loadXmtp() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const xmtp = require('@xmtp/react-native-sdk')
  if (!xmtp?.Client) throw new Error('Cannot find native module XMTP')
  return xmtp as { Client: any }
}

export async function initXmtpClient(
  address: string,
  signMessage: (msg: string) => Promise<string>,
): Promise<any> {
  const { Client } = loadXmtp()

  const signer = {
    getAddress:     async () => address,
    getChainId:     () => 1 as number | undefined,
    getBlockNumber: () => undefined as number | undefined,
    walletType:     () => 'EOA' as 'EOA' | 'SCW' | undefined,
    signMessage,
  }

  const client = await Client.create(signer, { env: 'dev' })
  console.log('[XMTP] client created for', address)
  return client
}

export async function getOrCreateConversation(
  client: any,
  peerAddress: string,
): Promise<XmtpConversation> {
  const convo = await client.conversations.newConversation(peerAddress)
  console.log('[XMTP] conversation opened with', peerAddress)
  return convo
}

export async function sendMessage(
  conversation: XmtpConversation,
  text: string,
): Promise<void> {
  await conversation.send(text)
}

export async function listMessages(
  conversation: XmtpConversation,
  limit = 50,
): Promise<XmtpMessage[]> {
  return conversation.messages({ limit })
}

export function streamMessages(
  conversation: XmtpConversation,
  onMessage: (msg: XmtpMessage) => void,
): Promise<() => void> {
  return conversation.streamMessages(async (msg: XmtpMessage) => {
    onMessage(msg)
  })
}
