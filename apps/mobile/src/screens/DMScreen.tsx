// ─── DM Screen ───────────────────────────────────────────────────────────────
import React, { useState, useRef, useEffect } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, KeyboardAvoidingView, Platform, SafeAreaView,
  ActivityIndicator,
} from 'react-native'
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedProps,
  withTiming, withDelay, withRepeat, withSequence,
  Easing,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { InboxStackParamList } from '../navigation/types'
import { Typography, Spacing, Radius, BorderWidth } from '../theme'
import type { ThemeColors } from '../theme'
import { shortenAddress, generateAvatarColor } from '@vault/shared'
import { useHaptic } from '../hooks/useHaptic'
import { useTheme } from '../hooks/useTheme'
import { useXmtp } from '../hooks/useXmtp'
import {
  getOrCreateConversation,
  sendMessage as xmtpSend,
  listMessages,
  streamMessages,
} from '../services/xmtp'
import type { XmtpConversation, XmtpMessage } from '../services/xmtp'

type DMProps = NativeStackScreenProps<InboxStackParamList, 'DM'>

const CONTRACT_REGEX = /0x[a-fA-F0-9]{40}/g

function getPeerRep(_address: string) {
  return { ethBalance: '—', badge: 'xmtp user', isOnline: true }
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
const RAW = [0.45, 0.38, 0.52, 0.48, 0.61, 0.55, 0.72, 0.84]
const W   = 120
const H   = 36
const pts = RAW.map((y, i) => ({ x: (i / (RAW.length - 1)) * W, y: H - y * H }))

function buildPath(points: { x: number; y: number }[]) {
  return points.reduce((d, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`
    const prev = points[i - 1]
    const cx   = (prev.x + p.x) / 2
    return `${d} C ${cx} ${prev.y} ${cx} ${p.y} ${p.x} ${p.y}`
  }, '')
}

const SPARKLINE_PATH = buildPath(pts)
const SPARKLINE_LEN  = 160
const AnimatedPath   = Animated.createAnimatedComponent(Path)

function TokenSparkline() {
  const { colors } = useTheme()
  const progress = useSharedValue(SPARKLINE_LEN)

  useEffect(() => {
    progress.value = withDelay(200, withTiming(0, { duration: 800, easing: Easing.out(Easing.cubic) }))
  }, [])

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: progress.value }))

  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <AnimatedPath
        d={SPARKLINE_PATH}
        stroke={colors.accent}
        strokeWidth={1.5}
        fill="none"
        strokeDasharray={SPARKLINE_LEN}
        animatedProps={animatedProps}
      />
    </Svg>
  )
}

function CountUp({ target, duration = 600, suffix = '' }: { target: number; duration?: number; suffix?: string }) {
  const { colors } = useTheme()
  const styles = getStyles(colors)
  const [displayed, setDisplayed] = useState(0)

  useEffect(() => {
    let start: number | null = null
    let raf: ReturnType<typeof setTimeout>
    function tick(now: number) {
      if (!start) start = now
      const elapsed  = now - start
      const delayed  = Math.max(0, elapsed - 300)
      const fraction = Math.min(delayed / duration, 1)
      const eased    = 1 - Math.pow(1 - fraction, 3)
      setDisplayed(parseFloat((eased * target).toFixed(1)))
      if (fraction < 1) raf = setTimeout(() => tick(Date.now()), 16)
    }
    raf = setTimeout(() => tick(Date.now()), 0)
    return () => clearTimeout(raf)
  }, [target, duration])

  return <Text style={styles.tcChange}>+{displayed.toFixed(1)}{suffix}</Text>
}

function PulsingPrice({ price }: { price: string }) {
  const { colors } = useTheme()
  const styles = getStyles(colors)
  const scale = useSharedValue(1)

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withDelay(4000, withSequence(
          withTiming(1.02, { duration: 300, easing: Easing.out(Easing.ease) }),
          withTiming(1.0,  { duration: 300, easing: Easing.in(Easing.ease)  }),
        )),
      ),
      -1,
      false,
    )
  }, [])

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  return <Animated.Text style={[styles.tcStatVal, animStyle]}>{price}</Animated.Text>
}

function SnipeButton({ onPress }: { onPress: () => void }) {
  const haptic = useHaptic()
  const { colors } = useTheme()
  const styles = getStyles(colors)
  const scale  = useSharedValue(1)
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity
        style={styles.snipeBtn}
        onPressIn={() => { haptic.light(); scale.value = withTiming(0.96, { duration: 80 }) }}
        onPressOut={() => { scale.value = withTiming(1.0, { duration: 150 }) }}
        onPress={onPress}
        activeOpacity={1}
      >
        <Text style={styles.snipeBtnText}>snipe — buy now</Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

function SendButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme()
  const styles = getStyles(colors)
  const scale = useSharedValue(1)
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return (
    <Animated.View style={animStyle}>
      <TouchableOpacity
        style={[styles.sendBtn, disabled && { opacity: 0.5 }]}
        onPressIn={() => { scale.value = withTiming(0.92, { duration: 100 }) }}
        onPressOut={() => { scale.value = withTiming(1.0,  { duration: 150 }) }}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={1}
      >
        <Text style={{ fontSize: 14, color: colors.bg }}>➤</Text>
      </TouchableOpacity>
    </Animated.View>
  )
}

function AnimatedMessageBubble({ children }: { children: React.ReactNode }) {
  const opacity    = useSharedValue(0)
  const translateY = useSharedValue(20)
  const scale      = useSharedValue(0.9)

  useEffect(() => {
    const bounce = { duration: 250, easing: Easing.out(Easing.back(1.5)) }
    opacity.value    = withTiming(1,   { duration: 250, easing: Easing.out(Easing.ease) })
    translateY.value = withTiming(0,   bounce)
    scale.value      = withTiming(1.0, bounce)
  }, [])

  const animStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [
      { translateY: translateY.value } as { translateY: number },
      { scale: scale.value }           as { scale: number },
    ],
  }))

  return <Animated.View style={animStyle}>{children}</Animated.View>
}

function TokenCard({ onSnipe }: { onSnipe: () => void }) {
  const { colors } = useTheme()
  const styles = getStyles(colors)

  return (
    <View style={styles.tokenCard}>
      <View style={styles.tcHead}>
        <Text style={styles.tcName}>AAVE / ETH</Text>
        <CountUp target={8.4} duration={600} suffix="%" />
      </View>
      <View style={styles.tcChartRow}><TokenSparkline /></View>
      <View style={styles.tcStats}>
        <View style={styles.tcStat}>
          <PulsingPrice price="$112.40" />
          <Text style={styles.tcStatLbl}>price</Text>
        </View>
        {[['$842M','24h vol'],['84.2k','holders']].map(([v, l]) => (
          <View key={l} style={styles.tcStat}>
            <Text style={styles.tcStatVal}>{v}</Text>
            <Text style={styles.tcStatLbl}>{l}</Text>
          </View>
        ))}
      </View>
      <SnipeButton onPress={onSnipe} />
    </View>
  )
}

// ── Unified message shape ─────────────────────────────────────────────────────
interface UIMessage {
  id:        string
  from:      string   // wallet address or 'me'
  content:   string
  timestamp: number
  isNew?:    boolean
}

function xmtpToUI(msg: XmtpMessage, myAddress: string): UIMessage {
  const senderAddr = (msg as any).senderAddress ?? (msg as any).senderInboxId ?? ''
  const isMe = senderAddr.toLowerCase() === myAddress.toLowerCase()
  return {
    id:        msg.id,
    from:      isMe ? 'me' : senderAddr,
    content:   (typeof msg.content === 'string' ? msg.content : typeof msg.content === 'function' ? '' : JSON.stringify(msg.content)) as string,
    timestamp: typeof msg.sent === 'number' ? msg.sent : new Date(msg.sent).getTime(),
  }
}

// ── Main screen ───────────────────────────────────────────────────────────────
export function DMScreen({ route, navigation }: DMProps) {
  const haptic = useHaptic()
  const { colors } = useTheme()
  const styles = getStyles(colors)

  const { peerAddress } = route.params
  const { xmtpClient, error: xmtpError } = useXmtp()

  const [messages, setMessages]     = useState<UIMessage[]>([])
  const [input, setInput]           = useState('')
  const [loadingMsgs, setLoadingMsgs] = useState(true)
  const [sending, setSending]       = useState(false)

  const flatRef    = useRef<FlatList>(null)
  const convoRef   = useRef<XmtpConversation | null>(null)
  const newMsgIds  = useRef<Set<string>>(new Set())
  const myAddress  = useRef('')
  const avatar     = generateAvatarColor(peerAddress)
  const rep        = getPeerRep(peerAddress)

  // Load history and start stream
  useEffect(() => {
    if (!xmtpClient) return
    myAddress.current = xmtpClient.address

    let unsub: (() => void) | null = null

    async function load() {
      try {
        const convo = await getOrCreateConversation(xmtpClient!, peerAddress)
        convoRef.current = convo

        const msgs = await listMessages(convo, 50)
        setMessages(msgs.map((m) => xmtpToUI(m, xmtpClient!.address)))
        setLoadingMsgs(false)

        setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 100)

        unsub = await streamMessages(convo, (msg) => {
          const ui = xmtpToUI(msg, xmtpClient!.address)
          newMsgIds.current.add(ui.id)
          setMessages((prev) => {
            if (prev.find((m) => m.id === ui.id)) return prev
            return [...prev, ui]
          })
          setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100)
        })
      } catch (err) {
        console.error('[XMTP] load error:', err)
        setLoadingMsgs(false)
      }
    }

    load()
    return () => { unsub?.() }
  }, [xmtpClient, peerAddress])

  async function handleSend() {
    if (!input.trim() || !convoRef.current || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)
    try {
      await xmtpSend(convoRef.current, text)
    } catch (err) {
      console.error('[XMTP] send error:', err)
      setInput(text) // restore on failure
    } finally {
      setSending(false)
    }
  }

  function renderMessage({ item }: { item: UIMessage }) {
    const isOut       = item.from === 'me'
    const hasAddr     = CONTRACT_REGEX.test(item.content)
    const shouldAnimate = newMsgIds.current.has(item.id)
    CONTRACT_REGEX.lastIndex = 0

    const row = (
      <View style={[styles.msgWrap, isOut && styles.msgWrapOut]}>
        {!isOut && (
          <View style={[styles.msgAvatar, { backgroundColor: avatar.bg }]}>
            <Text style={[styles.msgAvatarText, { color: avatar.fg }]}>{avatar.initials}</Text>
          </View>
        )}
        <View style={{ maxWidth: '75%' }}>
          <View style={[styles.bubble, isOut && styles.bubbleOut]}>
            <Text style={[styles.bubbleText, isOut && styles.bubbleTextOut]}>{item.content}</Text>
          </View>
          <View style={[styles.bubbleMeta, isOut && { alignSelf: 'flex-end' }]}>
            <Text style={styles.bubbleTime}>
              {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <View style={styles.sigBadge}>
              <Text style={styles.sigText}>e2e</Text>
            </View>
          </View>
          {hasAddr && !isOut && (
            <TokenCard
              onSnipe={() => { haptic.heavy(); navigation.navigate('SendPayment', { toAddress: peerAddress }) }}
            />
          )}
        </View>
      </View>
    )

    return shouldAnimate ? <AnimatedMessageBubble>{row}</AnimatedMessageBubble> : row
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { haptic.light(); navigation.goBack() }} style={styles.backBtn}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={[styles.hAvatar, { backgroundColor: avatar.bg }]}>
          <Text style={[styles.hAvatarText, { color: avatar.fg }]}>{avatar.initials}</Text>
        </View>
        <View style={styles.hInfo}>
          <Text style={styles.hAddress}>{shortenAddress(peerAddress, 6)}</Text>
          <View style={styles.hRep}>
            <View style={styles.onlineDot} />
            <Text style={styles.hRepText}>{rep.badge}</Text>
          </View>
        </View>
        <View style={styles.hActions}>
          <TouchableOpacity
            style={styles.hBtn}
            onPress={() => { haptic.light(); navigation.navigate('SendPayment', { toAddress: peerAddress }) }}
          >
            <Text style={styles.hBtnIcon}>⊕</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.hBtn} onPress={() => haptic.light()}>
            <Text style={styles.hBtnIcon}>◈</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.encBar}>
        <Text style={{ fontSize: 11, color: colors.accent }}>🛡</Text>
        <Text style={styles.encText}>end-to-end encrypted · XMTP · zero metadata</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {xmtpError === 'native_build_required' ? (
          <View style={styles.loadingWrap}>
            <Text style={{ fontSize: 24 }}>🔒</Text>
            <Text style={[styles.loadingText, { color: colors.accent, fontSize: 13 }]}>
              encrypted messaging requires a native build
            </Text>
            <Text style={styles.loadingText}>
              expo go doesn't support xmtp's native crypto module.{'\n'}
              a dev build via xcode or eas will enable this.
            </Text>
          </View>
        ) : loadingMsgs ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.loadingText}>loading encrypted messages…</Text>
          </View>
        ) : (
          <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.msgList}
            onLayout={() => flatRef.current?.scrollToEnd({ animated: false })}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>no messages yet</Text>
                <Text style={styles.emptySubtext}>say something — it's encrypted</Text>
              </View>
            }
          />
        )}

        <View style={styles.inputRow}>
          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => { haptic.light(); navigation.navigate('SendPayment', { toAddress: peerAddress }) }}
          >
            <Text style={{ fontSize: 16, color: colors.textSecondary }}>⊕</Text>
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder={`message ${shortenAddress(peerAddress)}…`}
            placeholderTextColor={colors.textTertiary}
            multiline
            editable={!sending && !!xmtpClient}
            onSubmitEditing={handleSend}
          />
          <SendButton onPress={() => { haptic.medium(); handleSend() }} disabled={sending || !xmtpClient} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────
function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe:          { flex: 1, backgroundColor: colors.bg },
    header:        { flexDirection: 'row', alignItems: 'center', padding: Spacing['3'], borderBottomWidth: BorderWidth.hairline, borderBottomColor: colors.border, gap: Spacing['2'] },
    backBtn:       { padding: Spacing['1'] },
    backIcon:      { fontSize: 28, color: colors.textSecondary, lineHeight: 28 },
    hAvatar:       { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: BorderWidth.hairline, borderColor: colors.border },
    hAvatarText:   { fontFamily: Typography.mono, fontSize: Typography.size.xs, fontWeight: Typography.weight.medium },
    hInfo:         { flex: 1 },
    hAddress:      { fontFamily: Typography.mono, fontSize: Typography.size.sm, color: colors.textPrimary, fontWeight: Typography.weight.medium },
    hRep:          { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    onlineDot:     { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.success },
    hRepText:      { fontFamily: Typography.mono, fontSize: Typography.size.xs, color: colors.textSecondary },
    hActions:      { flexDirection: 'row', gap: Spacing['2'] },
    hBtn:          { width: 30, height: 30, borderRadius: Radius.md, borderWidth: BorderWidth.hairline, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    hBtnIcon:      { fontSize: 14, color: colors.textSecondary },
    encBar:        { flexDirection: 'row', alignItems: 'center', gap: Spacing['2'], paddingHorizontal: Spacing['4'], paddingVertical: Spacing['1'], backgroundColor: colors.surfaceAlt, borderBottomWidth: BorderWidth.hairline, borderBottomColor: colors.border },
    encText:       { fontFamily: Typography.mono, fontSize: Typography.size.xs, color: colors.textTertiary },
    loadingWrap:   { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing['3'] },
    loadingText:   { fontFamily: Typography.mono, fontSize: Typography.size.xs, color: colors.textTertiary },
    emptyWrap:     { flex: 1, alignItems: 'center', paddingTop: Spacing['20'], gap: Spacing['2'] },
    emptyText:     { fontFamily: Typography.serif, fontSize: Typography.size.md, color: colors.textTertiary },
    emptySubtext:  { fontFamily: Typography.mono, fontSize: Typography.size.xs, color: colors.textTertiary },
    msgList:       { padding: Spacing['3'], gap: Spacing['1'], flexGrow: 1 },
    msgWrap:       { flexDirection: 'row', gap: Spacing['2'], marginVertical: 2, alignItems: 'flex-end' },
    msgWrapOut:    { flexDirection: 'row-reverse' },
    msgAvatar:     { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: BorderWidth.hairline, borderColor: colors.border, flexShrink: 0 },
    msgAvatarText: { fontFamily: Typography.mono, fontSize: 9 },
    bubble:        { backgroundColor: colors.surface, borderRadius: Radius.lg, borderWidth: BorderWidth.hairline, borderColor: colors.border, paddingHorizontal: Spacing['3'], paddingVertical: Spacing['2'] },
    bubbleOut:     { backgroundColor: colors.accentSoft, borderColor: colors.border },
    bubbleText:    { fontFamily: Typography.sans, fontSize: Typography.size.sm, color: colors.textPrimary, lineHeight: Typography.size.sm * Typography.leading.normal },
    bubbleTextOut: { color: colors.textPrimary },
    bubbleMeta:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    bubbleTime:    { fontFamily: Typography.mono, fontSize: 9, color: colors.textTertiary },
    sigBadge:      { borderWidth: BorderWidth.hairline, borderColor: colors.border, borderRadius: 2, paddingHorizontal: 3, paddingVertical: 1 },
    sigText:       { fontFamily: Typography.mono, fontSize: 8, color: colors.accentDim },
    tokenCard:     { backgroundColor: colors.surfaceAlt, borderRadius: Radius.lg, borderWidth: BorderWidth.hairline, borderColor: colors.border, padding: Spacing['3'], marginTop: Spacing['2'] },
    tcHead:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing['2'] },
    tcName:        { fontFamily: Typography.sans, fontSize: Typography.size.sm, fontWeight: Typography.weight.medium, color: colors.textPrimary },
    tcChange:      { fontFamily: Typography.mono, fontSize: Typography.size.sm, color: colors.success },
    tcChartRow:    { marginBottom: Spacing['2'], alignItems: 'flex-start' },
    tcStats:       { flexDirection: 'row', gap: Spacing['2'], marginBottom: Spacing['2'] },
    tcStat:        { flex: 1, alignItems: 'center' },
    tcStatVal:     { fontFamily: Typography.mono, fontSize: Typography.size.sm, fontWeight: Typography.weight.medium, color: colors.textPrimary },
    tcStatLbl:     { fontFamily: Typography.mono, fontSize: 9, color: colors.textTertiary, marginTop: 2 },
    snipeBtn:      { backgroundColor: colors.accent, borderRadius: Radius.md, paddingVertical: Spacing['2'], alignItems: 'center' },
    snipeBtnText:  { fontFamily: Typography.sans, fontSize: Typography.size.sm, fontWeight: Typography.weight.medium, color: colors.bg },
    inputRow:      { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing['2'], padding: Spacing['3'], borderTopWidth: BorderWidth.hairline, borderTopColor: colors.border },
    toolBtn:       { width: 32, height: 32, borderRadius: Radius.md, borderWidth: BorderWidth.hairline, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
    textInput:     { flex: 1, backgroundColor: colors.surface, borderRadius: Radius.md, borderWidth: BorderWidth.hairline, borderColor: colors.border, paddingHorizontal: Spacing['3'], paddingVertical: Spacing['2'], fontFamily: Typography.sans, fontSize: Typography.size.sm, color: colors.textPrimary, maxHeight: 80 },
    sendBtn:       { width: 32, height: 32, borderRadius: Radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  })
}
