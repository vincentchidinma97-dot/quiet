import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, useWindowDimensions, RefreshControl, ScrollView,
} from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedProps,
  withTiming, withDelay, Easing,
} from 'react-native-reanimated'
import { Svg, Path } from 'react-native-svg'
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs'
import type { MainTabParamList } from '../navigation/types'
import { Typography, Spacing, Radius, BorderWidth } from '../theme'
import type { ThemeColors } from '../theme'
import { useHaptic } from '../hooks/useHaptic'
import { useTheme } from '../hooks/useTheme'
import { useWalletBalance } from '../hooks/useWalletBalance'
import { ShimmerRow } from '../components/Shimmer'

type PortfolioProps = BottomTabScreenProps<MainTabParamList, 'Portfolio'>

const ETH_MOCK_PRICE_USD = 3840
const ETH_MOCK_CHANGE_PCT = +5.2

// ── Sparkline ─────────────────────────────────────────────────────────────────
const AnimatedPath = Animated.createAnimatedComponent(Path)
const SPARKLINE_PATH = 'M 0,32 L 30,26 L 60,30 L 90,20 L 120,22 L 150,14 L 180,16 L 210,8 L 240,4'
const SPARKLINE_LEN  = 260

function PortfolioSparkline() {
  const { width: screenW } = useWindowDimensions()
  const { colors } = useTheme()
  const svgW = screenW - Spacing['4'] * 2
  const progress = useSharedValue(SPARKLINE_LEN)

  useEffect(() => {
    progress.value = withTiming(0, { duration: 1200, easing: Easing.out(Easing.cubic) })
  }, [])

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: progress.value }))

  return (
    <Svg width={svgW} height={44} viewBox="0 0 240 44" style={{ marginTop: Spacing['2'] }}>
      <AnimatedPath
        d={SPARKLINE_PATH}
        stroke={colors.success}
        strokeWidth={1.5}
        fill="none"
        strokeDasharray={SPARKLINE_LEN}
        animatedProps={animatedProps}
      />
    </Svg>
  )
}

function PortfolioValueCountUp({ target }: { target: number }) {
  const { colors } = useTheme()
  const styles = getStyles(colors)
  const [displayed, setDisplayed] = useState(0)

  useEffect(() => {
    let raf: ReturnType<typeof setTimeout>
    const start = Date.now()
    function tick() {
      const fraction = Math.min((Date.now() - start) / 1000, 1)
      const eased = 1 - Math.pow(1 - fraction, 3)
      setDisplayed(Math.round(eased * target))
      if (fraction < 1) raf = setTimeout(tick, 16)
    }
    raf = setTimeout(tick, 0)
    return () => clearTimeout(raf)
  }, [target])

  return <Text style={styles.portValue}>${displayed.toLocaleString()}</Text>
}

function AnimatedEthRow({
  balance,
  usd,
}: {
  balance: string
  usd: number
}) {
  const { colors } = useTheme()
  const styles = getStyles(colors)
  const opacity    = useSharedValue(0)
  const translateY = useSharedValue(8)

  useEffect(() => {
    opacity.value    = withDelay(0, withTiming(1, { duration: 280, easing: Easing.out(Easing.ease) }))
    translateY.value = withDelay(0, withTiming(0, { duration: 280, easing: Easing.out(Easing.ease) }))
  }, [])

  const animStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: translateY.value }],
  }))

  return (
    <Animated.View style={animStyle}>
      <View style={styles.assetRow}>
        <View style={[styles.assetIcon, { backgroundColor: '#1a1308' }]}>
          <Text style={[styles.assetIconText, { color: '#C9A96E' }]}>ETH</Text>
        </View>
        <View style={styles.assetInfo}>
          <Text style={styles.assetName}>Ethereum</Text>
          <Text style={styles.assetBal}>{balance} ETH</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.assetUsd}>${usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}</Text>
          <Text style={[styles.assetChange, { color: colors.success }]}>
            +{ETH_MOCK_CHANGE_PCT}%
          </Text>
        </View>
      </View>
    </Animated.View>
  )
}

export function PortfolioScreen({ navigation }: PortfolioProps) {
  const haptic = useHaptic()
  const { colors } = useTheme()
  const styles = getStyles(colors)

  const [shimmer, setShimmer]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { balance: ethBalance, isLoading, refresh: refreshBalance } = useWalletBalance()

  useEffect(() => {
    if (!isLoading && ethBalance !== null) {
      setShimmer(false)
    }
    const fallback = setTimeout(() => setShimmer(false), 1500)
    return () => clearTimeout(fallback)
  }, [isLoading, ethBalance])

  const ethNum  = parseFloat(ethBalance ?? '0') || 0
  const ethUsd  = ethNum * ETH_MOCK_PRICE_USD
  const totalUsd = ethUsd

  const dailyChangeUsd = totalUsd * (ETH_MOCK_CHANGE_PCT / 100)
  const dailyLabel = ethBalance != null
    ? `+$${dailyChangeUsd.toFixed(2)} today (+${ETH_MOCK_CHANGE_PCT}%)`
    : 'loading…'

  function onRefresh() {
    haptic.light()
    setRefreshing(true)
    refreshBalance().finally(() => setRefreshing(false))
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        <View style={styles.portHeader}>
          <Text style={styles.portLabel}>portfolio value</Text>
          <PortfolioValueCountUp target={Math.round(totalUsd)} />
          <Text style={styles.portChange}>{dailyLabel}</Text>
          <PortfolioSparkline />
        </View>

        <View style={styles.portActions}>
          {[['➤','send'],['⬇','receive'],['⇄','swap'],['🔔','alerts']].map(([icon, label]) => (
            <TouchableOpacity key={label} style={styles.portAction} onPress={() => haptic.medium()}>
              <Text style={{ fontSize: 14, color: colors.textSecondary }}>{icon}</Text>
              <Text style={styles.portActionLabel}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ padding: Spacing['3'] }}>
          {shimmer ? (
            <>
              <ShimmerRow variant="portfolio" />
              <View style={styles.separator} />
              <ShimmerRow variant="portfolio" />
            </>
          ) : ethBalance != null ? (
            <AnimatedEthRow balance={ethBalance} usd={ethUsd} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>no wallet connected</Text>
              <Text style={styles.emptySubtext}>sign in to see your balance</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe:            { flex: 1, backgroundColor: colors.bg },
    portHeader:      { padding: Spacing['4'], borderBottomWidth: BorderWidth.hairline, borderBottomColor: colors.border },
    portLabel:       { fontFamily: Typography.mono, fontSize: Typography.size.xs, color: colors.textTertiary, letterSpacing: Typography.tracking.widest, textTransform: 'uppercase' },
    portValue:       { fontFamily: Typography.mono, fontSize: Typography.size['2xl'], color: colors.textPrimary, fontWeight: Typography.weight.medium, marginTop: Spacing['1'] },
    portChange:      { fontFamily: Typography.mono, fontSize: Typography.size.sm, color: colors.success, marginTop: 2 },
    portActions:     { flexDirection: 'row', padding: Spacing['3'], gap: Spacing['2'] },
    portAction:      { flex: 1, backgroundColor: colors.surface, borderRadius: Radius.md, borderWidth: BorderWidth.hairline, borderColor: colors.border, alignItems: 'center', paddingVertical: Spacing['2'], gap: 3 },
    portActionLabel: { fontFamily: Typography.mono, fontSize: Typography.size.xs, color: colors.textSecondary },
    assetRow:        { flexDirection: 'row', alignItems: 'center', gap: Spacing['3'], paddingVertical: Spacing['3'] },
    assetIcon:       { width: 34, height: 34, borderRadius: 17, borderWidth: BorderWidth.hairline, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    assetIconText:   { fontFamily: Typography.mono, fontSize: 10, fontWeight: Typography.weight.medium },
    assetInfo:       { flex: 1 },
    assetName:       { fontFamily: Typography.sans, fontSize: Typography.size.base, fontWeight: Typography.weight.medium, color: colors.textPrimary },
    assetBal:        { fontFamily: Typography.mono, fontSize: Typography.size.sm, color: colors.textSecondary, marginTop: 2 },
    assetUsd:        { fontFamily: Typography.mono, fontSize: Typography.size.base, fontWeight: Typography.weight.medium, color: colors.textPrimary },
    assetChange:     { fontFamily: Typography.mono, fontSize: Typography.size.sm, marginTop: 2 },
    separator:       { height: BorderWidth.hairline, backgroundColor: colors.border },
    empty:           { alignItems: 'center', paddingTop: Spacing['10'], gap: Spacing['2'] },
    emptyText:       { fontFamily: Typography.serif, fontSize: Typography.size.md, color: colors.textTertiary },
    emptySubtext:    { fontFamily: Typography.mono, fontSize: Typography.size.xs, color: colors.textTertiary },
  })
}
