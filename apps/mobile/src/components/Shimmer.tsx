import React, { useEffect } from 'react'
import { View, StyleSheet, useWindowDimensions, DimensionValue } from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, Easing,
  type SharedValue,
} from 'react-native-reanimated'
import { Colors, Spacing, Radius } from '../theme'

// Width of the highlight strip that sweeps across each bone
const HIGHLIGHT_W = 90

// ── Single rectangular bone ───────────────────────────────────────────────────
// The highlight strip is positioned absolutely and clips inside overflow:hidden.
function ShimmerBlock({
  width,
  height,
  borderRadius = Radius.sm,
  translateX,
}: {
  width: DimensionValue
  height: number
  borderRadius?: number
  translateX: SharedValue<number>
}) {
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }))

  return (
    <View style={{ width, height, borderRadius, backgroundColor: Colors.ink3, overflow: 'hidden' }}>
      <Animated.View style={[styles.highlight, animStyle]} />
    </View>
  )
}

// ── Composited shimmer rows ───────────────────────────────────────────────────
export function ShimmerRow({ variant = 'inbox' }: { variant?: 'inbox' | 'portfolio' }) {
  const { width: screenW } = useWindowDimensions()
  const translateX = useSharedValue(-HIGHLIGHT_W)

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(screenW, { duration: 1200, easing: Easing.linear }),
      -1,
      false,
    )
  }, [screenW])

  // Shorthand so layout code stays readable
  const bone = (w: DimensionValue, h: number, r?: number) => (
    <ShimmerBlock width={w} height={h} borderRadius={r} translateX={translateX} />
  )

  if (variant === 'portfolio') {
    return (
      <View style={styles.portfolioRow}>
        {bone(34, 34, 17)}
        <View style={styles.mid}>
          {bone('58%', 11)}
          <View style={styles.gap4} />
          {bone('38%', 8)}
        </View>
        <View style={styles.right}>
          {bone(58, 11)}
          <View style={styles.gap4} />
          {bone(40, 8)}
        </View>
      </View>
    )
  }

  // default: inbox
  return (
    <View style={styles.inboxRow}>
      {bone(40, 40, 20)}
      <View style={styles.mid}>
        {bone('52%', 11)}
        <View style={styles.gap5} />
        {bone('72%', 8)}
      </View>
      <View style={styles.right}>
        {bone(28, 8)}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  highlight: {
    position:        'absolute',
    top:             0,
    bottom:          0,
    width:           HIGHLIGHT_W,
    backgroundColor: Colors.ink5,
    opacity:         0.85,
  },
  inboxRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               Spacing['3'],
    paddingHorizontal: Spacing['4'],
    paddingVertical:   Spacing['3'],
  },
  portfolioRow: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            Spacing['3'],
    paddingVertical: Spacing['3'],
  },
  mid:   { flex: 1 },
  right: { alignItems: 'flex-end' },
  gap4:  { height: 4 },
  gap5:  { height: 5 },
})
