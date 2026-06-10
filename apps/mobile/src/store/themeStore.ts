import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ThemeMode } from '../theme'

interface ThemeState {
  mode:             ThemeMode
  pendingMode:      ThemeMode | null
  isTransitioning:  boolean
  setMode:          (mode: ThemeMode) => void
  toggleMode:       () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode:            'eclipse',
      pendingMode:     null,
      isTransitioning: false,

      setMode: (newMode) => {
        if (get().isTransitioning || get().mode === newMode) return
        set({ isTransitioning: true, pendingMode: newMode })
        setTimeout(() => {
          set({ mode: newMode })
          setTimeout(() => {
            set({ isTransitioning: false, pendingMode: null })
          }, 200)
        }, 200)
      },

      toggleMode: () => {
        get().setMode(get().mode === 'eclipse' ? 'paper' : 'eclipse')
      },
    }),
    {
      name:    'quiet-theme',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ mode: s.mode }),
    },
  ),
)
