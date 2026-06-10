import React, { useState, useRef, useEffect } from 'react'
import { View, StyleSheet } from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing,
} from 'react-native-reanimated'
import * as Haptics from 'expo-haptics'
import { useThemeStore } from '../store/themeStore'
import { paperColors, eclipseColors } from '../theme/colors'

export function ThemeTransition({ children }: { children: React.ReactNode }) {
  const mode            = useThemeStore((s) => s.mode)
  const pendingMode     = useThemeStore((s) => s.pendingMode)
  const isTransitioning = useThemeStore((s) => s.isTransitioning)

  const opacity     = useSharedValue(0)
  const prevModeRef = useRef(mode)

  // The overlay color is locked to the destination bg at the moment
  // transition starts. It doesn't change while the overlay is visible,
  // which prevents any flicker when pendingMode clears.
  const [overlayBg, setOverlayBg] = useState(eclipseColors.bg)

  // Haptic fires exactly when mode actually switches in the store
  useEffect(() => {
    if (prevModeRef.current !== mode) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      prevModeRef.current = mode
    }
  }, [mode])

  // Drive the overlay: fade in when transition starts, fade out when it ends
  useEffect(() => {
    if (isTransitioning && pendingMode) {
      setOverlayBg(pendingMode === 'paper' ? paperColors.bg : eclipseColors.bg)
      opacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) })
    } else if (!isTransitioning) {
      opacity.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.ease) })
    }
  }, [isTransitioning, pendingMode])

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }))

  return (
    <View style={styles.root}>
      {children}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: overlayBg }, animStyle]}
        pointerEvents="none"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
