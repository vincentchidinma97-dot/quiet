// Navigation param list — all screens and their params

export type RootStackParamList = {
  Splash:        undefined
  ConnectWallet: undefined
  Main:          undefined
}

export type MainTabParamList = {
  Inbox:     undefined
  Portfolio: undefined
  Trade:     undefined
  Settings:  undefined
}

export type InboxStackParamList = {
  InboxList:   undefined
  DM:          { peerAddress: string }
  Room:        { roomId: string }
  NewMessage:  undefined
  TokenDetail: { contractAddress: string; chain: 'ethereum' | 'solana' }
  SendPayment: { toAddress: string; amount?: string }
  RoomCreate:  undefined
  RoomInvite:  { roomId: string }
}
