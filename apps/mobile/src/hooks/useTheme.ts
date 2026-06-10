import { useThemeStore } from '../store/themeStore'
import { paperColors, eclipseColors } from '../theme/colors'
import type { ThemeColors, ThemeMode } from '../theme'

export function useTheme(): {
  colors:     ThemeColors
  mode:       ThemeMode
  toggleMode: () => void
  setMode:    (mode: ThemeMode) => void
} {
  const mode       = useThemeStore((s) => s.mode)
  const toggleMode = useThemeStore((s) => s.toggleMode)
  const setMode    = useThemeStore((s) => s.setMode)
  const colors     = mode === 'paper' ? paperColors : eclipseColors
  return { colors, mode, toggleMode, setMode }
}
