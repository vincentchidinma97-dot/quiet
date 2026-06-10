import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { WalletIdentity, VaultKeypair, SnipeSettings, Portfolio } from '@vault/shared'

interface WalletState {
  // ── Connection ──────────────────────────────────────────────────────────────
  identity:        WalletIdentity | null
  keypair:         VaultKeypair | null        // ECDH keypair — never logged
  isConnecting:    boolean
  isConnected:     boolean
  connectionError: string | null

  // ── Portfolio ───────────────────────────────────────────────────────────────
  portfolio:       Portfolio | null
  portfolioLoading: boolean

  // ── Settings ────────────────────────────────────────────────────────────────
  snipeSettings:   SnipeSettings

  // ── Actions ─────────────────────────────────────────────────────────────────
  setIdentity:       (identity: WalletIdentity) => void
  setKeypair:        (keypair: VaultKeypair) => void
  setConnecting:     (connecting: boolean) => void
  setConnectionError:(error: string | null) => void
  setPortfolio:      (portfolio: Portfolio) => void
  setPortfolioLoading:(loading: boolean) => void
  updateSnipeSettings:(settings: Partial<SnipeSettings>) => void
  disconnect:        () => void
}

const defaultSnipeSettings: SnipeSettings = {
  amountEth:           '0.1',
  slippageBps:         1500,   // 15%
  gasPriority:         'fast',
  maxGasGwei:          50,
  autoSellMultiplier:  3,
  stopLossPercent:     50,
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set) => ({
      identity:          null,
      keypair:           null,
      isConnecting:      false,
      isConnected:       false,
      connectionError:   null,
      portfolio:         null,
      portfolioLoading:  false,
      snipeSettings:     defaultSnipeSettings,

      setIdentity: (identity) =>
        set({ identity, isConnected: true, connectionError: null }),

      setKeypair: (keypair) => set({ keypair }),

      setConnecting: (isConnecting) => set({ isConnecting }),

      setConnectionError: (error) =>
        set({ connectionError: error, isConnecting: false }),

      setPortfolio: (portfolio) =>
        set({ portfolio, portfolioLoading: false }),

      setPortfolioLoading: (portfolioLoading) => set({ portfolioLoading }),

      updateSnipeSettings: (settings) =>
        set((state) => ({
          snipeSettings: { ...state.snipeSettings, ...settings },
        })),

      disconnect: () =>
        set({
          identity:        null,
          keypair:         null,
          isConnected:     false,
          isConnecting:    false,
          connectionError: null,
          portfolio:       null,
        }),
    }),
    {
      name:    'vault-wallet-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Never persist the keypair's private key — always re-derive on connect
      partialize: (state) => ({
        identity:      state.identity,
        snipeSettings: state.snipeSettings,
        // keypair intentionally excluded
      }),
    }
  )
)
