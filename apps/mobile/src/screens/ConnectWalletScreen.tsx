import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, SafeAreaView, ScrollView, Linking,
} from 'react-native'
import { ethers } from 'ethers'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../navigation/types'
import { Typography, Spacing, Radius, BorderWidth } from '../theme'
import type { ThemeColors } from '../theme'
import { useWalletStore } from '../store/walletStore'
import { deriveVaultKeypair, VAULT_SIGN_MESSAGE } from '@vault/shared'
import { useHaptic } from '../hooks/useHaptic'
import { useTheme } from '../hooks/useTheme'
import {
  WalletConnectModal,
  useWalletConnectModal,
  type IProvider,
} from '@walletconnect/modal-react-native'
import {
  WC_PROJECT_ID,
  WC_METADATA,
  WC_SESSION_PARAMS,
  METAMASK_WALLET_ID,
  COINBASE_WALLET_ID,
  PHANTOM_WALLET_ID,
} from '../services/walletConfig'

type Props = NativeStackScreenProps<RootStackParamList, 'ConnectWallet'>

type WalletOption = {
  id:     string
  name:   string
  desc:   string
  color:  string
  initial: string
}

const WALLET_TO_WC_ID: Record<string, string | undefined> = {
  metamask:      METAMASK_WALLET_ID,
  coinbase:      COINBASE_WALLET_ID,
  phantom:       PHANTOM_WALLET_ID,
  walletconnect: undefined,
}

const WALLET_OPTIONS: WalletOption[] = [
  { id: 'metamask',      name: 'MetaMask',        desc: 'browser extension · mobile',   color: '#f6851b', initial: 'M' },
  { id: 'walletconnect', name: 'WalletConnect',   desc: 'any wallet · QR code',         color: '#3b99fc', initial: 'W' },
  { id: 'phantom',       name: 'Phantom',         desc: 'Solana · browser · mobile',    color: '#9945ff', initial: 'P' },
  { id: 'coinbase',      name: 'Coinbase Wallet', desc: 'self-custody · easy backup',   color: '#0052ff', initial: 'C' },
]

export function ConnectWalletScreen({ navigation }: Props) {
  const haptic = useHaptic()
  const { colors } = useTheme()
  const styles = getStyles(colors)
  const [selectedWallet, setSelectedWallet] = useState<string>('metamask')
  const { setIdentity, setKeypair, setConnecting, setConnectionError, isConnecting } =
    useWalletStore()

  const { open, isOpen, isConnected, address, provider } = useWalletConnectModal()

  const flowActiveRef = useRef(false)
  const hasOpenedRef  = useRef(false)
  const timeoutRef    = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearConnectionTimeout() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  // Track when modal becomes visible
  useEffect(() => {
    if (isOpen) {
      console.log('[WC] WalletConnect modal opened')
      hasOpenedRef.current = true
    }
  }, [isOpen])

  // Deep-link return: when MetaMask approves it redirects back via quiet://
  // Linking fires an event — we just need to let WC's internal session handler
  // pick it up. But we log it so we can see if the return ever arrives.
  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      console.log('[WC] App reopened via deep link:', url)
    })
    return () => sub.remove()
  }, [])

  // Modal closed without connecting
  useEffect(() => {
    if (flowActiveRef.current && hasOpenedRef.current && !isOpen && !isConnected) {
      console.log('[WC] Modal dismissed without connecting')
      clearConnectionTimeout()
      flowActiveRef.current = false
      hasOpenedRef.current  = false
      setConnecting(false)
      Alert.alert('Cancelled', 'Wallet connection was cancelled.', [{ text: 'OK' }])
    }
  }, [isOpen, isConnected])

  // Successful connection
  useEffect(() => {
    if (flowActiveRef.current && isConnected && address && provider) {
      console.log('[WC] Wallet connected:', address)
      clearConnectionTimeout()
      flowActiveRef.current = false
      proceedWithSign(address, provider)
    }
  }, [isConnected, address, provider])

  function handleConnect() {
    if (isConnecting) return
    console.log('[WC] handleConnect called, selectedWallet:', selectedWallet)
    setConnecting(true)
    setConnectionError(null)
    flowActiveRef.current = true
    hasOpenedRef.current  = false

    // 30-second safety timeout
    timeoutRef.current = setTimeout(() => {
      if (flowActiveRef.current) {
        console.log('[WC] Connection timed out after 30s')
        flowActiveRef.current = false
        hasOpenedRef.current  = false
        setConnecting(false)
        Alert.alert(
          'Connection timed out',
          'MetaMask did not respond in time. Make sure MetaMask is installed and try again.',
          [{ text: 'OK' }],
        )
      }
    }, 30_000)

    open({ route: 'ConnectWallet' })
  }

  async function proceedWithSign(walletAddress: string, wcProvider: IProvider) {
    try {
      console.log('[WC] Requesting personal_sign for', walletAddress)
      const msgHex = ethers.hexlify(ethers.toUtf8Bytes(VAULT_SIGN_MESSAGE(walletAddress)))

      const sig = await wcProvider.request(
        { method: 'personal_sign', params: [msgHex, walletAddress] },
        'eip155:11155111',
      ) as string

      console.log('[WC] Signature received, deriving keypair')
      const keypair = await deriveVaultKeypair(walletAddress, async () => sig)

      setIdentity({
        address:       walletAddress,
        chainId:       11155111,
        ecdhPublicKey: keypair.publicKey,
        connectedAt:   Date.now(),
      })
      setKeypair(keypair)
      navigation.replace('Main')

    } catch (err: any) {
      const msg       = (err?.message ?? '') as string
      console.log('[WC] proceedWithSign error:', err?.code, msg)
      const isReject  = err?.code === 4001 || msg.toLowerCase().includes('reject')
      const isTimeout = msg.toLowerCase().includes('timeout')
      const noApp     = msg.toLowerCase().includes('no metamask') ||
                        msg.toLowerCase().includes('not installed')

      setConnectionError(msg || 'Unknown error')
      setConnecting(false)

      Alert.alert(
        isReject  ? 'Signature rejected'
        : isTimeout ? 'Connection timed out'
        : noApp     ? 'MetaMask not found'
        : 'Connection failed',

        isReject  ? 'You rejected the signature request in MetaMask. Tap the button to try again.'
        : isTimeout ? 'MetaMask did not respond in time. Make sure it is open and try again.'
        : noApp     ? 'MetaMask does not appear to be installed on this device.'
        : 'Could not connect to your wallet. Please try again.',

        [{ text: 'OK' }],
      )
    } finally {
      setConnecting(false)
    }
  }

  return (
    <>
      {/* WalletConnectModal initialises the WC client and renders the picker sheet.
          It uses global Valtio state so it does not need to wrap children. */}
      <WalletConnectModal
        projectId={WC_PROJECT_ID}
        providerMetadata={WC_METADATA}
        sessionParams={WC_SESSION_PARAMS}
        explorerRecommendedWalletIds={
          WALLET_TO_WC_ID[selectedWallet]
            ? [WALLET_TO_WC_ID[selectedWallet]!]
            : undefined
        }
      />
      <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        <TouchableOpacity style={styles.backBtn} onPress={() => { haptic.light(); navigation.goBack() }}>
          <Text style={styles.backText}>← back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>choose your wallet</Text>
        <Text style={styles.subtitle}>
          sign once to generate your encrypted identity.{'\n'}
          quiet never stores your keys.
        </Text>

        <View style={styles.walletList}>
          {WALLET_OPTIONS.map((wallet) => {
            const isSelected = selectedWallet === wallet.id
            return (
              <TouchableOpacity
                key={wallet.id}
                style={[styles.walletRow, isSelected && styles.walletRowSelected]}
                onPress={() => { haptic.light(); setSelectedWallet(wallet.id) }}
                activeOpacity={0.8}
              >
                <View style={[styles.walletIcon, { backgroundColor: wallet.color + '22' }]}>
                  <Text style={[styles.walletInitial, { color: wallet.color }]}>
                    {wallet.initial}
                  </Text>
                </View>

                <View style={styles.walletInfo}>
                  <Text style={styles.walletName}>{wallet.name}</Text>
                  <Text style={styles.walletDesc}>{wallet.desc}</Text>
                </View>

                {isSelected ? (
                  <Text style={styles.checkmark}>✓</Text>
                ) : (
                  <Text style={styles.chevron}>›</Text>
                )}
              </TouchableOpacity>
            )
          })}
        </View>

        <View style={styles.dotDivider}>
          {['·', '·', '·'].map((d, i) => (
            <Text key={i} style={styles.dot}>{d}</Text>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.signBtn, isConnecting && styles.signBtnDisabled]}
          onPress={() => { haptic.heavy(); handleConnect() }}
          disabled={isConnecting}
          activeOpacity={0.85}
        >
          {isConnecting ? (
            <ActivityIndicator color={colors.accent} size="small" />
          ) : (
            <Text style={styles.signBtnText}>sign message & enter quiet</Text>
          )}
        </TouchableOpacity>

        <View style={styles.encNote}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.encText}>
            ECDH keypair generated client-side · never transmitted
          </Text>
        </View>

        <View style={styles.explainer}>
          <Text style={styles.explainerTitle}>what happens when you sign</Text>
          {[
            'Your wallet signs a fixed message (no funds moved)',
            'We hash the signature to derive an encryption keypair',
            'Your keypair is stored on-device only — never on our servers',
            'You can recover it on any device by signing again',
          ].map((step, i) => (
            <View key={i} style={styles.explainerRow}>
              <View style={styles.explainerNum}>
                <Text style={styles.explainerNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.explainerStep}>{step}</Text>
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
    </>
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
    walletList: {
      gap:          Spacing['3'],
      marginBottom: Spacing['4'],
    },
    walletRow: {
      flexDirection:   'row',
      alignItems:      'center',
      gap:             Spacing['3'],
      backgroundColor: colors.surface,
      borderRadius:    Radius.lg,
      borderWidth:     BorderWidth.hairline,
      borderColor:     colors.border,
      padding:         Spacing['4'],
    },
    walletRowSelected: {
      borderColor:     colors.border,
      backgroundColor: colors.accentSoft,
    },
    walletIcon: {
      width:          36,
      height:         36,
      borderRadius:   Radius.md,
      alignItems:     'center',
      justifyContent: 'center',
    },
    walletInitial: {
      fontFamily: Typography.mono,
      fontSize:   Typography.size.md,
      fontWeight: Typography.weight.bold,
    },
    walletInfo: {
      flex: 1,
    },
    walletName: {
      fontFamily:   Typography.sans,
      fontSize:     Typography.size.base,
      fontWeight:   Typography.weight.medium,
      color:        colors.textPrimary,
      marginBottom: 2,
    },
    walletDesc: {
      fontFamily: Typography.mono,
      fontSize:   Typography.size.xs,
      color:      colors.textSecondary,
    },
    checkmark: {
      fontSize:   16,
      color:      colors.accent,
      fontWeight: Typography.weight.bold,
    },
    chevron: {
      fontSize: 20,
      color:    colors.textTertiary,
    },
    dotDivider: {
      flexDirection:  'row',
      justifyContent: 'center',
      gap:            Spacing['2'],
      marginVertical: Spacing['2'],
    },
    dot: {
      color:    colors.textTertiary,
      fontSize: Typography.size.base,
    },
    signBtn: {
      backgroundColor: colors.accentSoft,
      borderRadius:    Radius.lg,
      borderWidth:     BorderWidth.hairline,
      borderColor:     colors.border,
      paddingVertical: Spacing['4'] - 1,
      alignItems:      'center',
      marginBottom:    Spacing['3'],
    },
    signBtnDisabled: {
      opacity: 0.6,
    },
    signBtnText: {
      fontFamily:    Typography.sans,
      fontSize:      Typography.size.base,
      color:         colors.accent,
      letterSpacing: Typography.tracking.wide,
    },
    encNote: {
      flexDirection:  'row',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            Spacing['2'],
      marginBottom:   Spacing['8'],
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
    explainer: {
      backgroundColor: colors.surfaceAlt,
      borderRadius:    Radius.lg,
      borderWidth:     BorderWidth.hairline,
      borderColor:     colors.border,
      padding:         Spacing['4'],
      gap:             Spacing['3'],
    },
    explainerTitle: {
      fontFamily:    Typography.mono,
      fontSize:      Typography.size.xs,
      color:         colors.textTertiary,
      letterSpacing: Typography.tracking.widest,
      textTransform: 'uppercase',
      marginBottom:  Spacing['1'],
    },
    explainerRow: {
      flexDirection: 'row',
      alignItems:    'flex-start',
      gap:           Spacing['3'],
    },
    explainerNum: {
      width:           20,
      height:          20,
      borderRadius:    Radius.full,
      backgroundColor: colors.surface,
      borderWidth:     BorderWidth.hairline,
      borderColor:     colors.border,
      alignItems:      'center',
      justifyContent:  'center',
      flexShrink:      0,
      marginTop:       1,
    },
    explainerNumText: {
      fontFamily: Typography.mono,
      fontSize:   Typography.size.xs,
      color:      colors.textSecondary,
    },
    explainerStep: {
      flex:       1,
      fontFamily: Typography.sans,
      fontSize:   Typography.size.sm,
      color:      colors.textSecondary,
      lineHeight: Typography.size.sm * Typography.leading.normal,
    },
  })
}
