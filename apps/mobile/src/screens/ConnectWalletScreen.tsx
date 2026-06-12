import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, SafeAreaView, ScrollView,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/types'
import { Typography, Spacing, Radius, BorderWidth } from '../theme'
import type { ThemeColors } from '../theme'
import { useWalletStore } from '../store/walletStore'
import { useHaptic } from '../hooks/useHaptic'
import { useTheme } from '../hooks/useTheme'
import {
  usePrivy,
  useLoginWithOAuth,
  useLoginWithEmail,
} from '@privy-io/expo'

type Props = NativeStackScreenProps<RootStackParamList, 'ConnectWallet'>

type LoginTab = 'social' | 'email'

export function ConnectWalletScreen({ navigation }: Props) {
  const haptic = useHaptic()
  const { colors } = useTheme()
  const styles = getStyles(colors)

  const [activeTab, setActiveTab] = useState<LoginTab>('social')
  const [email, setEmail]         = useState('')
  const [otpCode, setOtpCode]     = useState('')
  const [otpSent, setOtpSent]     = useState(false)
  const [loading, setLoading]     = useState(false)

  const { user, isReady } = usePrivy()
  const { setIdentity }   = useWalletStore()

  // Navigate to Main once Privy has a user
  useEffect(() => {
    if (isReady && user) {
      const walletAccount = user.linked_accounts?.find((a: any) => a.type === 'wallet') as any
      const address = (walletAccount?.address as string) ?? ''
      setIdentity({
        address:       address || `privy:${user.id}`,
        chainId:       11155111,
        ecdhPublicKey: '',
        connectedAt:   Date.now(),
      })
      navigation.replace('Main')
    }
  }, [isReady, user])

  // OAuth: Apple / Google
  const { login: loginWithOAuth, state: oauthState } = useLoginWithOAuth({
    onSuccess: () => {
      console.log('[Privy] OAuth success')
    },
    onError: (err: any) => {
      console.error('[Privy] OAuth error:', err)
      setLoading(false)
      Alert.alert('Login failed', err?.message ?? 'OAuth login failed. Please try again.', [{ text: 'OK' }])
    },
  })

  // Email OTP
  const {
    sendCode,
    loginWithCode,
    state: emailState,
  } = useLoginWithEmail({
    onSendCodeSuccess: () => {
      console.log('[Privy] OTP sent')
      setOtpSent(true)
      setLoading(false)
    },
    onLoginSuccess: () => {
      console.log('[Privy] Email login success')
    },
    onError: (err: any) => {
      console.error('[Privy] Email error:', err)
      setLoading(false)
      Alert.alert('Login failed', err?.message ?? 'Email login failed. Please try again.', [{ text: 'OK' }])
    },
  })

  async function handleOAuth(provider: 'apple' | 'google') {
    try {
      haptic.heavy()
      setLoading(true)
      await loginWithOAuth({ provider })
    } catch (err: any) {
      console.error('[Privy] OAuth exception:', err)
      setLoading(false)
      Alert.alert('Login failed', err?.message ?? 'Could not start login. Please try again.', [{ text: 'OK' }])
    }
  }

  async function handleSendCode() {
    if (!email.trim()) {
      Alert.alert('Enter your email', 'Please enter an email address first.', [{ text: 'OK' }])
      return
    }
    try {
      haptic.medium()
      setLoading(true)
      await sendCode({ email: email.trim() })
    } catch (err: any) {
      console.error('[Privy] sendCode exception:', err)
      setLoading(false)
      Alert.alert('Failed to send code', err?.message ?? 'Could not send code. Please try again.', [{ text: 'OK' }])
    }
  }

  async function handleVerifyCode() {
    if (!otpCode.trim()) {
      Alert.alert('Enter the code', 'Please enter the 6-digit code from your email.', [{ text: 'OK' }])
      return
    }
    try {
      haptic.medium()
      setLoading(true)
      await loginWithCode({ code: otpCode.trim() })
    } catch (err: any) {
      console.error('[Privy] loginWithCode exception:', err)
      setLoading(false)
      Alert.alert('Invalid code', err?.message ?? 'The code was incorrect. Please try again.', [{ text: 'OK' }])
    }
  }

  const isBusy = loading || oauthState.status === 'loading' || emailState.status === 'sending-code' || emailState.status === 'submitting-code'

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          <TouchableOpacity style={styles.backBtn} onPress={() => { haptic.light(); navigation.goBack() }}>
            <Text style={styles.backText}>← back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>sign in to quiet</Text>
          <Text style={styles.subtitle}>
            your encrypted identity is derived from your account.{'\n'}
            quiet never stores your keys.
          </Text>

          {/* Tabs */}
          <View style={styles.tabs}>
            {(['social', 'email'] as LoginTab[]).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.tabActive]}
                onPress={() => { haptic.light(); setActiveTab(tab) }}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                  {tab === 'social' ? 'Apple / Google' : 'Email'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeTab === 'social' ? (
            <View style={styles.socialButtons}>
              {/* Apple */}
              <TouchableOpacity
                style={[styles.socialBtn, isBusy && styles.btnDisabled]}
                onPress={() => handleOAuth('apple')}
                disabled={isBusy}
                activeOpacity={0.85}
              >
                {isBusy ? (
                  <ActivityIndicator color={colors.textPrimary} size="small" />
                ) : (
                  <>
                    <Text style={styles.socialBtnIcon}></Text>
                    <Text style={styles.socialBtnText}>Continue with Apple</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Google */}
              <TouchableOpacity
                style={[styles.socialBtn, isBusy && styles.btnDisabled]}
                onPress={() => handleOAuth('google')}
                disabled={isBusy}
                activeOpacity={0.85}
              >
                {isBusy ? (
                  <ActivityIndicator color={colors.textPrimary} size="small" />
                ) : (
                  <>
                    <Text style={styles.socialBtnIcon}>G</Text>
                    <Text style={styles.socialBtnText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emailForm}>
              {!otpSent ? (
                <>
                  <TextInput
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="you@example.com"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isBusy}
                  />
                  <TouchableOpacity
                    style={[styles.primaryBtn, isBusy && styles.btnDisabled]}
                    onPress={handleSendCode}
                    disabled={isBusy}
                    activeOpacity={0.85}
                  >
                    {isBusy ? (
                      <ActivityIndicator color={colors.bg} size="small" />
                    ) : (
                      <Text style={styles.primaryBtnText}>send code</Text>
                    )}
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.otpHint}>
                    Enter the 6-digit code sent to {email}
                  </Text>
                  <TextInput
                    style={[styles.input, styles.otpInput]}
                    value={otpCode}
                    onChangeText={setOtpCode}
                    placeholder="000000"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!isBusy}
                  />
                  <TouchableOpacity
                    style={[styles.primaryBtn, isBusy && styles.btnDisabled]}
                    onPress={handleVerifyCode}
                    disabled={isBusy}
                    activeOpacity={0.85}
                  >
                    {isBusy ? (
                      <ActivityIndicator color={colors.bg} size="small" />
                    ) : (
                      <Text style={styles.primaryBtnText}>verify & enter quiet</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.resendBtn}
                    onPress={() => { setOtpSent(false); setOtpCode('') }}
                  >
                    <Text style={styles.resendText}>← use a different email</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={styles.walletBtn}
            onPress={() => Alert.alert('WalletConnect', 'WalletConnect requires a native build. Use Apple, Google, or Email to sign in with Expo Go.', [{ text: 'OK' }])}
            activeOpacity={0.7}
          >
            <Text style={styles.walletBtnText}>connect wallet (native build only)</Text>
          </TouchableOpacity>

          <View style={styles.encNote}>
            <Text style={styles.lockIcon}>🔒</Text>
            <Text style={styles.encText}>
              ECDH keypair generated client-side · never transmitted
            </Text>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
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
      paddingHorizontal: Spacing['5'],
      paddingTop:        Spacing['2'],
      paddingBottom:     Spacing['10'],
    },
    backBtn: {
      marginBottom: Spacing['5'],
    },
    backText: {
      fontFamily: Typography.mono,
      fontSize:   Typography.size.sm,
      color:      colors.textSecondary,
    },
    title: {
      fontFamily:   Typography.serif,
      fontSize:     Typography.size.xl,
      color:        colors.accent,
      fontWeight:   Typography.weight.regular,
      marginBottom: Spacing['2'],
    },
    subtitle: {
      fontFamily:   Typography.sans,
      fontSize:     Typography.size.sm,
      color:        colors.textTertiary,
      lineHeight:   Typography.size.sm * Typography.leading.loose,
      marginBottom: Spacing['6'],
    },
    tabs: {
      flexDirection:   'row',
      backgroundColor: colors.surface,
      borderRadius:    Radius.lg,
      borderWidth:     BorderWidth.hairline,
      borderColor:     colors.border,
      padding:         3,
      marginBottom:    Spacing['5'],
      gap:             3,
    },
    tab: {
      flex:            1,
      paddingVertical: Spacing['2'],
      alignItems:      'center',
      borderRadius:    Radius.md,
    },
    tabActive: {
      backgroundColor: colors.accentSoft,
    },
    tabText: {
      fontFamily: Typography.mono,
      fontSize:   Typography.size.xs,
      color:      colors.textTertiary,
    },
    tabTextActive: {
      color: colors.accent,
    },
    socialButtons: {
      gap: Spacing['3'],
    },
    socialBtn: {
      flexDirection:   'row',
      alignItems:      'center',
      justifyContent:  'center',
      gap:             Spacing['3'],
      backgroundColor: colors.surface,
      borderRadius:    Radius.lg,
      borderWidth:     BorderWidth.hairline,
      borderColor:     colors.border,
      paddingVertical: Spacing['4'],
    },
    socialBtnIcon: {
      fontFamily: Typography.sans,
      fontSize:   Typography.size.base,
      fontWeight: Typography.weight.bold,
      color:      colors.textPrimary,
      width:      20,
      textAlign:  'center',
    },
    socialBtnText: {
      fontFamily: Typography.sans,
      fontSize:   Typography.size.base,
      color:      colors.textPrimary,
    },
    emailForm: {
      gap: Spacing['3'],
    },
    input: {
      backgroundColor:   colors.surface,
      borderRadius:      Radius.lg,
      borderWidth:       BorderWidth.hairline,
      borderColor:       colors.border,
      paddingHorizontal: Spacing['4'],
      paddingVertical:   Spacing['3'],
      fontFamily:        Typography.mono,
      fontSize:          Typography.size.base,
      color:             colors.textPrimary,
    },
    otpInput: {
      textAlign:     'center',
      fontSize:      Typography.size.xl,
      letterSpacing: 8,
    },
    otpHint: {
      fontFamily: Typography.mono,
      fontSize:   Typography.size.xs,
      color:      colors.textTertiary,
      textAlign:  'center',
    },
    primaryBtn: {
      backgroundColor: colors.accent,
      borderRadius:    Radius.lg,
      paddingVertical: Spacing['4'] - 1,
      alignItems:      'center',
    },
    primaryBtnText: {
      fontFamily:    Typography.sans,
      fontSize:      Typography.size.base,
      fontWeight:    Typography.weight.medium,
      color:         colors.bg,
      letterSpacing: Typography.tracking.wide,
    },
    btnDisabled: {
      opacity: 0.6,
    },
    resendBtn: {
      alignItems: 'center',
      paddingVertical: Spacing['2'],
    },
    resendText: {
      fontFamily: Typography.mono,
      fontSize:   Typography.size.xs,
      color:      colors.textTertiary,
    },
    dividerRow: {
      flexDirection:  'row',
      alignItems:     'center',
      gap:            Spacing['3'],
      marginVertical: Spacing['5'],
    },
    dividerLine: {
      flex:            1,
      height:          BorderWidth.hairline,
      backgroundColor: colors.border,
    },
    dividerText: {
      fontFamily: Typography.mono,
      fontSize:   Typography.size.xs,
      color:      colors.textTertiary,
    },
    walletBtn: {
      alignItems:      'center',
      backgroundColor: colors.surface,
      borderRadius:    Radius.lg,
      borderWidth:     BorderWidth.hairline,
      borderColor:     colors.border,
      paddingVertical: Spacing['3'],
      marginBottom:    Spacing['5'],
    },
    walletBtnText: {
      fontFamily: Typography.mono,
      fontSize:   Typography.size.xs,
      color:      colors.textTertiary,
    },
    encNote: {
      flexDirection:  'row',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            Spacing['2'],
    },
    lockIcon: {
      fontSize: 12,
    },
    encText: {
      fontFamily:    Typography.mono,
      fontSize:      Typography.size.xs,
      color:         colors.textTertiary,
      letterSpacing: Typography.tracking.wide,
    },
  })
}
