import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  SafeAreaView, ScrollView, Clipboard,
} from 'react-native'
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs'
import type { MainTabParamList } from '../navigation/types'
import { Typography, Spacing, Radius, BorderWidth } from '../theme'
import type { ThemeColors, ThemeMode } from '../theme'
import { paperColors, eclipseColors } from '../theme/colors'
import { useTheme } from '../hooks/useTheme'
import { useWalletStore } from '../store/walletStore'

type Props = BottomTabScreenProps<MainTabParamList, 'Settings'>

// ── Tiny UI mockup shown inside each theme card ───────────────────────────────
function ThemePreview({ previewMode }: { previewMode: ThemeMode }) {
  const c = previewMode === 'paper' ? paperColors : eclipseColors
  return (
    <View style={[preview.root, { backgroundColor: c.bg }]}>
      {/* Simulated nav bar */}
      <View style={[preview.bar, { backgroundColor: c.surfaceAlt, borderBottomColor: c.border }]}>
        <View style={[preview.dot, { backgroundColor: c.accent }]} />
        <View style={[preview.lineShort, { backgroundColor: c.textTertiary }]} />
      </View>
      {/* Simulated content rows */}
      <View style={preview.body}>
        {[0.72, 0.50, 0.62, 0.40].map((w, i) => (
          <View
            key={i}
            style={[
              preview.textBar,
              {
                width:           `${w * 100}%`,
                backgroundColor: i === 0 ? c.textPrimary : c.textTertiary,
                opacity:         i === 0 ? 0.8 : 0.35,
              },
            ]}
          />
        ))}
        {/* Simulated accent button */}
        <View style={[preview.btn, { backgroundColor: c.accent }]} />
      </View>
    </View>
  )
}

const preview = StyleSheet.create({
  root:      { flex: 1, borderRadius: Radius.md, overflow: 'hidden' },
  bar:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 5, borderBottomWidth: 0.5 },
  dot:       { width: 5, height: 5, borderRadius: 3 },
  lineShort: { height: 3, width: '35%', borderRadius: 2 },
  body:      { flex: 1, padding: 6, gap: 4, justifyContent: 'center' },
  textBar:   { height: 3, borderRadius: 2 },
  btn:       { height: 10, borderRadius: 3, marginTop: 4, width: '55%', alignSelf: 'center' },
})

// ── Selectable theme card ─────────────────────────────────────────────────────
function ThemeCard({
  themeMode,
  label,
  sublabel,
  isActive,
  onPress,
  colors,
}: {
  themeMode: ThemeMode
  label:     string
  sublabel:  string
  isActive:  boolean
  onPress:   () => void
  colors:    ThemeColors
}) {
  return (
    <TouchableOpacity
      style={[
        card.root,
        { backgroundColor: colors.surface, borderColor: colors.border },
        isActive && { borderWidth: 1.5, borderColor: colors.accent },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={card.previewWrap}>
        <ThemePreview previewMode={themeMode} />
      </View>
      <View style={card.footer}>
        <View style={{ flex: 1 }}>
          <Text style={[card.label, { color: isActive ? colors.accent : colors.textPrimary }]}>
            {label}
          </Text>
          <Text style={[card.sublabel, { color: colors.textTertiary }]}>{sublabel}</Text>
        </View>
        {isActive && (
          <View style={[card.activePip, { backgroundColor: colors.accent }]} />
        )}
      </View>
    </TouchableOpacity>
  )
}

const card = StyleSheet.create({
  root:        { flex: 1, borderRadius: Radius.lg, borderWidth: BorderWidth.hairline, overflow: 'hidden' },
  previewWrap: { height: 110, padding: Spacing['2'] },
  footer:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing['3'], paddingVertical: Spacing['2'] },
  label:       { fontFamily: Typography.sans, fontSize: Typography.size.sm, fontWeight: Typography.weight.medium },
  sublabel:    { fontFamily: Typography.mono, fontSize: Typography.size.xs, marginTop: 1 },
  activePip:   { width: 6, height: 6, borderRadius: 3 },
})

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, children, colors }: { title: string; children: React.ReactNode; colors: ThemeColors }) {
  return (
    <View style={{ marginBottom: Spacing['6'] }}>
      <Text style={[section.title, { color: colors.textTertiary }]}>{title}</Text>
      {children}
    </View>
  )
}

const section = StyleSheet.create({
  title: {
    fontFamily:    Typography.mono,
    fontSize:      Typography.size.xs,
    letterSpacing: Typography.tracking.widest,
    textTransform: 'uppercase',
    marginBottom:  Spacing['3'],
  },
})

// ── Simple info row ───────────────────────────────────────────────────────────
function InfoRow({ label, value, colors }: { label: string; value: string; colors: ThemeColors }) {
  return (
    <View style={[row.root, { borderBottomColor: colors.border }]}>
      <Text style={[row.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[row.value, { color: colors.textTertiary }]}>{value}</Text>
    </View>
  )
}

// ── Copyable wallet address row ───────────────────────────────────────────────
function WalletAddressRow({ address, colors }: { address: string; colors: ThemeColors }) {
  const [copied, setCopied] = useState(false)
  const [pressed, setPressed] = useState(false)

  function handleCopy() {
    Clipboard.setString(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  const shortAddr = address.startsWith('privy:')
    ? address
    : `${address.slice(0, 6)}…${address.slice(-4)}`

  return (
    <View style={[row.root, { borderBottomColor: colors.border }]}>
      <Text style={[row.label, { color: colors.textSecondary }]}>wallet</Text>
      <TouchableOpacity
        onPress={handleCopy}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        activeOpacity={1}
        style={row.copyBtn}
        hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
      >
        <Text style={[
          row.value,
          { color: copied ? colors.accent : pressed ? colors.accent : colors.textTertiary },
        ]}>
          {copied ? 'copied!' : shortAddr}
        </Text>
        <Text style={[row.copyIcon, { color: copied ? colors.accent : colors.textTertiary }]}>
          {copied ? '✓' : '⎘'}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const row = StyleSheet.create({
  root:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing['3'], borderBottomWidth: BorderWidth.hairline },
  label:    { fontFamily: Typography.sans, fontSize: Typography.size.sm },
  value:    { fontFamily: Typography.mono, fontSize: Typography.size.xs },
  copyBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  copyIcon: { fontFamily: Typography.mono, fontSize: 13 },
})

// ── Main screen ───────────────────────────────────────────────────────────────
export function SettingsScreen(_props: Props) {
  const { colors, mode, setMode } = useTheme()
  const styles = getStyles(colors)
  const identity = useWalletStore((s) => s.identity)
  const walletAddress = identity?.address ?? ''

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>settings</Text>
        </View>

        {/* ── Appearance ───────────────────────────────────────────────────── */}
        <Section title="appearance" colors={colors}>
          <View style={styles.themeRow}>
            <ThemeCard
              themeMode="paper"
              label="paper"
              sublabel="day mode"
              isActive={mode === 'paper'}
              onPress={() => setMode('paper')}
              colors={colors}
            />
            <View style={{ width: Spacing['3'] }} />
            <ThemeCard
              themeMode="eclipse"
              label="eclipse"
              sublabel="night mode"
              isActive={mode === 'eclipse'}
              onPress={() => setMode('eclipse')}
              colors={colors}
            />
          </View>
        </Section>

        {/* ── Account ──────────────────────────────────────────────────────── */}
        <Section title="account" colors={colors}>
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <WalletAddressRow address={walletAddress} colors={colors} />
            <InfoRow label="network"    value="Ethereum Sepolia"  colors={colors} />
            <InfoRow label="encryption" value="ECDH · on-device"  colors={colors} />
          </View>
        </Section>

        {/* ── About ────────────────────────────────────────────────────────── */}
        <Section title="about" colors={colors}>
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <InfoRow label="version"    value="0.1.0-alpha"        colors={colors} />
            <InfoRow label="protocol"   value="XMTP v2"            colors={colors} />
            <View style={[row.root, { borderBottomColor: colors.border, borderBottomWidth: 0 }]}>
              <Text style={[row.label, { color: colors.textSecondary }]}>licence</Text>
              <Text style={[row.value, { color: colors.textTertiary }]}>MIT</Text>
            </View>
          </View>
        </Section>

        {/* ── Wordmark ─────────────────────────────────────────────────────── */}
        <View style={styles.wordmarkRow}>
          <Text style={[styles.wordmark, { color: colors.textTertiary }]}>quiet</Text>
          <Text style={[styles.wordmark, { color: colors.accent }]}>.</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  )
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    container: {
      paddingHorizontal: Spacing['4'],
      paddingBottom:     Spacing['10'],
    },
    header: {
      paddingTop:    Spacing['4'],
      paddingBottom: Spacing['5'],
    },
    title: {
      fontFamily: Typography.serif,
      fontSize:   Typography.size.xl,
      color:      colors.textPrimary,
      fontWeight: Typography.weight.regular,
    },
    themeRow: {
      flexDirection: 'row',
    },
    sectionCard: {
      borderRadius: Radius.lg,
      borderWidth:  BorderWidth.hairline,
      paddingHorizontal: Spacing['4'],
    },
    wordmarkRow: {
      flexDirection:  'row',
      justifyContent: 'center',
      alignItems:     'baseline',
      marginTop:      Spacing['4'],
      paddingBottom:  Spacing['4'],
    },
    wordmark: {
      fontFamily:   Typography.serif,
      fontSize:     Typography.size.sm,
      letterSpacing: 0,
    },
  })
}
