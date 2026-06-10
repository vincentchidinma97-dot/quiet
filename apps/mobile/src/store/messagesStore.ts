import { create } from 'zustand'
import type { PlaintextMessage, Room } from '@vault/shared'

interface Conversation {
  peerAddress:   string
  messages:      PlaintextMessage[]
  lastMessage:   PlaintextMessage | null
  unreadCount:   number
  isLoading:     boolean
}

interface MessagesState {
  // ── Conversations ───────────────────────────────────────────────────────────
  conversations:     Record<string, Conversation>  // keyed by peer address
  activeConversation: string | null

  // ── Rooms ───────────────────────────────────────────────────────────────────
  rooms:             Record<string, Room>           // keyed by room id
  roomMessages:      Record<string, PlaintextMessage[]>
  activeRoom:        string | null

  // ── Actions ─────────────────────────────────────────────────────────────────
  addMessage:        (peerAddress: string, message: PlaintextMessage) => void
  addRoomMessage:    (roomId: string, message: PlaintextMessage) => void
  setActiveConversation: (address: string | null) => void
  setActiveRoom:     (roomId: string | null) => void
  markRead:          (peerAddress: string) => void
  setRoom:           (room: Room) => void
  upsertConversation:(address: string, update: Partial<Conversation>) => void
}

export const useMessagesStore = create<MessagesState>()((set, get) => ({
  conversations:      {},
  activeConversation: null,
  rooms:              {},
  roomMessages:       {},
  activeRoom:         null,

  addMessage: (peerAddress, message) =>
    set((state) => {
      const existing = state.conversations[peerAddress] ?? {
        peerAddress,
        messages:    [],
        lastMessage: null,
        unreadCount: 0,
        isLoading:   false,
      }
      const isActive = state.activeConversation === peerAddress
      return {
        conversations: {
          ...state.conversations,
          [peerAddress]: {
            ...existing,
            messages:    [...existing.messages, message],
            lastMessage: message,
            unreadCount: isActive ? 0 : existing.unreadCount + 1,
          },
        },
      }
    }),

  addRoomMessage: (roomId, message) =>
    set((state) => ({
      roomMessages: {
        ...state.roomMessages,
        [roomId]: [...(state.roomMessages[roomId] ?? []), message],
      },
    })),

  setActiveConversation: (address) =>
    set((state) => {
      if (address && state.conversations[address]) {
        return {
          activeConversation: address,
          conversations: {
            ...state.conversations,
            [address]: { ...state.conversations[address], unreadCount: 0 },
          },
        }
      }
      return { activeConversation: address }
    }),

  setActiveRoom: (roomId) => set({ activeRoom: roomId }),

  markRead: (peerAddress) =>
    set((state) => ({
      conversations: {
        ...state.conversations,
        [peerAddress]: {
          ...state.conversations[peerAddress],
          unreadCount: 0,
        },
      },
    })),

  setRoom: (room) =>
    set((state) => ({
      rooms: { ...state.rooms, [room.id]: room },
    })),

  upsertConversation: (address, update) =>
    set((state) => ({
      conversations: {
        ...state.conversations,
        [address]: {
          peerAddress: address,
          messages:    [],
          lastMessage: null,
          unreadCount: 0,
          isLoading:   false,
          ...state.conversations[address],
          ...update,
        },
      },
    })),
}))
