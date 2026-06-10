import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { InboxStackParamList } from '../navigation/types'
import { Typography, Spacing, Radius, BorderWidth } from '../theme'
import type { ThemeColors } from '../theme'
import { shortenAddress } from '@vault/shared'
import { useHaptic } from '../hooks/useHaptic'
import { useTheme } from '../hooks/useTheme'

type PayProps = NativeStackScreenProps<InboxStackParamList, 'SendPayment'>

export function SendPaymentScreen({ route, navigation }: PayProps) {
  const haptic = useHaptic()
  const { colors } = useTheme()
  const styles = getStyles(colors)
  const { toAddress } = route.params
  const [amount, setAmount] = useState('0.00')
  const [token,  setToken]  = useState<'ETH' | 'USDC'>('ETH')
  const rate = token === 'ETH' ? 3840 : 1

  function handleNum(k: string) {
    setAmount((prev) => {
      if (k === 'del') return prev.length > 1 ? prev.slice(0, -1) : '0'
      if (k === '.' && prev.includes('.')) return prev
      if (prev === '0' && k !== '.') return k
      return prev + k
    })
  }

  const usd = (parseFloat(amount) || 0) * rate

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.payHeader}>
        <TouchableOpacity onPress={() => { haptic.light(); navigation.goBack() }} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.payTitle}>send payment</Text>
      </View>

      <View style={{ flex: 1, padding: Spacing['4'], gap: Spacing['3'] }}>
        <View style={styles.payToCard}>
          <Text style={styles.payToLabel}>to</Text>
          <Text style={styles.payToAddr}>{shortenAddress(toAddress, 8)}</Text>
        </View>

        <View style={styles.payAmountCard}>
          <Text style={styles.payAmount}>{amount}</Text>
          <Text style={styles.payFiat}>
            ≈ ${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: Spacing['3'] }}>
          {(['ETH', 'USDC'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tokenBtn, token === t && styles.tokenBtnActive]}
              onPress={() => { haptic.light(); setToken(t) }}
            >
              <Text style={[styles.tokenBtnText, token === t && { color: colors.accent }]}>{t}</Text>
              <Text style={styles.tokenBtnBal}>bal: {t === 'ETH' ? '2.40' : '1,200'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.numpad}>
          {['1','2','3','4','5','6','7','8','9','.','0','del'].map((k) => (
            <TouchableOpacity key={k} style={styles.numKey} onPress={() => { haptic.light(); handleNum(k) }}>
              <Text style={styles.numKeyText}>{k === 'del' ? '⌫' : k}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.paySendBtn}
          onPress={() => { haptic.heavy(); navigation.goBack() }}
          activeOpacity={0.85}
        >
          <Text style={styles.paySendText}>sign & send · 0.5% fee</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe:           { flex: 1, backgroundColor: colors.bg },
    backBtn:        { padding: Spacing['1'] },
    backIcon:       { fontSize: 28, color: colors.textSecondary, lineHeight: 28 },
    payHeader:      { flexDirection: 'row', alignItems: 'center', gap: Spacing['3'], padding: Spacing['4'], borderBottomWidth: BorderWidth.hairline, borderBottomColor: colors.border },
    payTitle:       { fontFamily: Typography.serif, fontSize: Typography.size.md, color: colors.accent, fontWeight: Typography.weight.regular },
    payToCard:      { backgroundColor: colors.surface, borderRadius: Radius.lg, borderWidth: BorderWidth.hairline, borderColor: colors.border, padding: Spacing['3'] },
    payToLabel:     { fontFamily: Typography.mono, fontSize: Typography.size.xs, color: colors.textTertiary, letterSpacing: Typography.tracking.widest, textTransform: 'uppercase', marginBottom: 4 },
    payToAddr:      { fontFamily: Typography.mono, fontSize: Typography.size.sm, color: colors.accent },
    payAmountCard:  { backgroundColor: colors.surface, borderRadius: Radius.lg, borderWidth: BorderWidth.hairline, borderColor: colors.border, padding: Spacing['4'], alignItems: 'center' },
    payAmount:      { fontFamily: Typography.mono, fontSize: Typography.size['2xl'], color: colors.textPrimary, fontWeight: Typography.weight.medium },
    payFiat:        { fontFamily: Typography.mono, fontSize: Typography.size.sm, color: colors.textTertiary, marginTop: 4 },
    tokenBtn:       { flex: 1, backgroundColor: colors.surface, borderRadius: Radius.md, borderWidth: BorderWidth.hairline, borderColor: colors.border, padding: Spacing['3'], alignItems: 'center' },
    tokenBtnActive: { borderColor: colors.border, backgroundColor: colors.accentSoft },
    tokenBtnText:   { fontFamily: Typography.mono, fontSize: Typography.size.base, fontWeight: Typography.weight.medium, color: colors.textPrimary },
    tokenBtnBal:    { fontFamily: Typography.mono, fontSize: Typography.size.xs, color: colors.textTertiary, marginTop: 3 },
    numpad:         { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing['2'] },
    numKey:         { width: '30%', paddingVertical: Spacing['3'], backgroundColor: colors.surface, borderRadius: Radius.md, borderWidth: BorderWidth.hairline, borderColor: colors.border, alignItems: 'center' },
    numKeyText:     { fontFamily: Typography.mono, fontSize: Typography.size.lg, color: colors.textPrimary },
    paySendBtn:     { backgroundColor: colors.accent, borderRadius: Radius.lg, paddingVertical: Spacing['4'] - 1, alignItems: 'center' },
    paySendText:    { fontFamily: Typography.sans, fontSize: Typography.size.md, fontWeight: Typography.weight.medium, color: colors.bg },
  })
}
