import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, SafeAreaView, useWindowDimensions, RefreshControl } from 'react-native'
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

const MOCK_ASSETS = [
  { symbol: 'ETH',  name: 'Ethereum',  balance: '2.40',  usd: 9216,  change: +5.2, bg: '#1a1308', fg: '#C9A96E' },
  { symbol: 'USDC', name: 'USD Coin',  balance: '1,200', usd: 1200,  change: 0,    bg: '#0f1a2e', fg: '#60a5fa' },
  { symbol: 'AAVE', name: 'Aave',      balance: '98.4',  usd: 11060, change: +8.4, bg: '#0f2a1a', fg: '#4ade80' },
  { symbol: 'UNI',  name: 'Uniswap',   balance: '180',   usd: 1224,  change: -1.8, bg: '#1e0f2e', fg: '#a78bfa' },
  { symbol: 'LINK', name: 'Chainlink', balance: '62',    usd: 1140,  change: +3.1, bg: '#1a1a0e', fg: '#EF9F27' },
]

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

// ── Counting header numbers ───────────────────────────────────────────────────
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

function DailyChangeCountUp() {
  const { colors } = useTheme()
  const styles = getStyles(colors)
  const [displayed, setDisplayed] = useState(0)

  useEffect(() => {
    let raf: ReturnType<typeof setTimeout>
    const start = Date.now()
    function tick() {
      const fraction = Math.min((Date.now() - start) / 1000, 1)
      const eased = 1 - Math.pow(1 - fraction, 3)
      setDisplayed(Math.round(eased * 1284))
      if (fraction < 1) raf = setTimeout(tick, 16)
    }
    raf = setTimeout(tick, 0)
    return () => clearTimeout(raf)
  }, [])

  return <Text style={styles.portChange}>+${displayed.toLocaleString()} today (+6.2%)</Text>
}

// ── Staggered asset row ───────────────────────────────────────────────────────
function AnimatedAssetRow({ item, index }: { item: typeof MOCK_ASSETS[0]; index: number }) {
  const { colors } = useTheme()
  const styles = getStyles(colors)
  const opacity    = useSharedValue(0)
  const translateY = useSharedValue(8)

  useEffect(() => {
    const delay = index * 60
    opacity.value    = withDelay(delay, withTiming(1, { duration: 280, easing: Easing.out(Easing.ease) }))
    translateY.value = withDelay(delay, withTiming(0, { duration: 280, easing: Easing.out(Easing.ease) }))
  }, [])

  const animStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ translateY: translateY.value }],
  }))

  return (
    <Animated.View style={animStyle}>
      <View style={styles.assetRow}>
        <View style={[styles.assetIcon, { backgroundColor: item.bg }]}>
          <Text style={[styles.assetIconText, { color: item.fg }]}>{item.symbol.slice(0, 3)}</Text>
        </View>
        <View style={styles.assetInfo}>
          <Text style={styles.assetName}>{item.name}</Text>
          <Text style={styles.assetBal}>{item.balance} {item.symbol}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.assetUsd}>${item.usd.toLocaleString()}</Text>
          <Text style={[styles.assetChange, {
            color: item.change > 0 ? colors.success
                 : item.change < 0 ? colors.danger
                 : colors.textTertiary,
          }]}>
            {item.change > 0 ? '+' : ''}{item.change !== 0 ? `${item.change}%` : 'stable'}
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

  const [loading, setLoading]       = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { balance: ethBalance, refresh: refreshBalance } = useWalletBalance()

  const assets = MOCK_ASSETS.map((a) =>
    a.symbol === 'ETH' && ethBalance != null
      ? { ...a, balance: ethBalance }
      : a,
  )
  const totalUsd = assets.reduce((s, a) => s + a.usd, 0)

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 800)
    return () => clearTimeout(t)
  }, [])

  function onRefresh() {
    haptic.light()
    setRefreshing(true)
    refreshBalance().finally(() => setRefreshing(false))
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.portHeader}>
        <Text style={styles.portLabel}>portfolio value</Text>
        <PortfolioValueCountUp target={totalUsd} />
        <DailyChangeCountUp />
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

      {loading ? (
        <View style={{ padding: Spacing['3'] }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <React.Fragment key={i}>
              <ShimmerRow variant="portfolio" />
              {i < 4 && <View style={styles.separator} />}
            </React.Fragment>
          ))}
        </View>
      ) : (
        <FlatList
          data={assets}
          keyExtractor={(a) => a.symbol}
          renderItem={({ item, index }) => <AnimatedAssetRow item={item} index={index} />}
          contentContainerStyle={{ padding: Spacing['3'] }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
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
  })
}
