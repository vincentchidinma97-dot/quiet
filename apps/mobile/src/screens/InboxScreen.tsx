import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, SafeAreaView, StatusBar, RefreshControl,
} from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { InboxStackParamList } from '../navigation/types'
import { Typography, Spacing, Radius, BorderWidth } from '../theme'
import type { ThemeColors } from '../theme'
import { useWalletStore } from '../store/walletStore'
import { shortenAddress, generateAvatarColor } from '@vault/shared'
import { useHaptic } from '../hooks/useHaptic'
import { useTheme } from '../hooks/useTheme'
import { useWalletBalance } from '../hooks/useWalletBalance'
import { useXmtp } from '../hooks/useXmtp'
import { ShimmerRow } from '../components/Shimmer'

type Props = NativeStackScreenProps<InboxStackParamList, 'InboxList'>

interface ConvoItem {
  address: string
  preview: string
  time:    string
  unread:  number
}

type ActiveTab = 'messages' | 'rooms' | 'requests'

export function InboxScreen({ navigation }: Props) {
  const haptic = useHaptic()
  const { colors, mode } = useTheme()
  const styles = getStyles(colors)

  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [activeTab, setActiveTab]     = useState<ActiveTab>('messages')
  const [searchQuery, setSearchQuery] = useState('')
  const [convos, setConvos]           = useState<ConvoItem[]>([])

  const identity = useWalletStore((s) => s.identity)
  const { balance: ethBalance } = useWalletBalance()
  const { xmtpClient, isInitializing, error: xmtpError } = useXmtp()

  const loadConversations = useCallback(async () => {
    if (!xmtpClient) return
    try {
      const list = await xmtpClient.conversations.list()
      const items: ConvoItem[] = await Promise.all(
        list.map(async (convo) => {
          const peerAddress = (convo as any).peerAddress ?? ''
          let preview = ''
          let time    = ''
          try {
            const msgs = await convo.messages({ limit: 1 })
            if (msgs.length > 0) {
              const last = msgs[msgs.length - 1]
              preview = (typeof last.content === 'string' ? last.content : typeof last.content === 'function' ? '…' : JSON.stringify(last.content)) as string
              const ts = typeof last.sent === 'number' ? last.sent : new Date(last.sent).getTime()
              const diff = Date.now() - ts
              if (diff < 60000)       time = 'now'
              else if (diff < 3600000) time = `${Math.floor(diff / 60000)}m`
              else if (diff < 86400000) time = `${Math.floor(diff / 3600000)}h`
              else                    time = `${Math.floor(diff / 86400000)}d`
            }
          } catch { /* skip */ }
          return { address: peerAddress, preview, time, unread: 0 }
        })
      )
      setConvos(items.filter((c) => c.address))
    } catch (err) {
      console.error('[XMTP] list convos error:', err)
    } finally {
      setLoading(false)
    }
  }, [xmtpClient])

  useEffect(() => {
    if (xmtpClient) {
      loadConversations()
    } else if (!isInitializing) {
      const t = setTimeout(() => setLoading(false), 800)
      return () => clearTimeout(t)
    }
  }, [xmtpClient, isInitializing, loadConversations])

  function onRefresh() {
    haptic.light()
    setRefreshing(true)
    loadConversations().finally(() => setRefreshing(false))
  }

  const filtered = convos.filter((c) =>
    c.address.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  function ConversationRow({ item }: { item: ConvoItem }) {
    const avatar = generateAvatarColor(item.address)
    return (
      <TouchableOpacity
        style={[styles.convoRow, item.unread > 0 && styles.convoRowUnread]}
        onPress={() => { haptic.light(); navigation.navigate('DM', { peerAddress: item.address }) }}
        activeOpacity={0.7}
      >
        <View style={[styles.avatar, { backgroundColor: avatar.bg }]}>
          <Text style={[styles.avatarText, { color: avatar.fg }]}>{avatar.initials}</Text>
        </View>

        <View style={styles.convoContent}>
          <Text style={styles.convoAddress}>{shortenAddress(item.address)}</Text>
          <Text style={styles.convoPreview} numberOfLines={1}>{item.preview}</Text>
        </View>

        <View style={styles.convoMeta}>
          <Text style={styles.convoTime}>{item.time}</Text>
          {item.unread > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unread}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar
        barStyle={mode === 'paper' ? 'dark-content' : 'light-content'}
        backgroundColor={colors.bg}
      />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={styles.brandName}>quiet</Text>
              <Text style={[styles.brandName, { color: colors.accent }]}>.</Text>
            </View>
            {identity && (
              <Text style={styles.myAddress}>
                {shortenAddress(identity.address)}
                {ethBalance != null ? ` · ${ethBalance} ETH` : ''}{' '}
                <Text style={{ color: isInitializing ? colors.accent : colors.success }}>●</Text>
                {isInitializing && !xmtpError ? ' setting up e2e…' : ''}
              </Text>
            )}
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerBtn} onPress={() => haptic.light()}>
              <Text style={styles.headerBtnIcon}>◈</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn} onPress={() => haptic.light()}>
              <Text style={styles.headerBtnIcon}>⚙</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.tabs}>
          {(['messages', 'rooms', 'requests'] as ActiveTab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={styles.tab}
              onPress={() => { haptic.light(); setActiveTab(tab) }}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab}
              </Text>
              {activeTab === tab && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="search by 0x address…"
          placeholderTextColor={colors.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {loading ? (
        <View>
          {Array.from({ length: 5 }).map((_, i) => (
            <React.Fragment key={i}>
              <ShimmerRow variant="inbox" />
              {i < 4 && <View style={styles.separator} />}
            </React.Fragment>
          ))}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.address}
          renderItem={({ item }) => <ConversationRow item={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>no conversations yet</Text>
              <Text style={styles.emptySubtext}>search by wallet address to start one</Text>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={styles.fab}
        onPress={() => { haptic.medium(); navigation.navigate('NewMessage') }}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>✎</Text>
        <Text style={styles.fabText}>new message</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

function getStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      paddingHorizontal: Spacing['4'],
      paddingTop:        Spacing['3'],
      borderBottomWidth: BorderWidth.hairline,
      borderBottomColor: colors.border,
    },
    headerTop: {
      flexDirection:  'row',
      justifyContent: 'space-between',
      alignItems:     'flex-start',
      marginBottom:   Spacing['3'],
    },
    brandName: {
      fontFamily:    Typography.serif,
      fontSize:      Typography.size.lg,
      color:         colors.textPrimary,
      fontWeight:    Typography.weight.regular,
      letterSpacing: 0,
    },
    myAddress: {
      fontFamily: Typography.mono,
      fontSize:   Typography.size.xs,
      color:      colors.textTertiary,
      marginTop:  2,
    },
    headerActions: {
      flexDirection: 'row',
      gap:           Spacing['2'],
      marginTop:     2,
    },
    headerBtn: {
      width:          28,
      height:         28,
      borderRadius:   Radius.md,
      borderWidth:    BorderWidth.hairline,
      borderColor:    colors.border,
      alignItems:     'center',
      justifyContent: 'center',
    },
    headerBtnIcon: {
      fontSize: 14,
      color:    colors.textSecondary,
    },
    tabs: {
      flexDirection: 'row',
    },
    tab: {
      flex:            1,
      alignItems:      'center',
      paddingVertical: Spacing['2'],
      position:        'relative',
    },
    tabText: {
      fontFamily:    Typography.mono,
      fontSize:      Typography.size.xs,
      color:         colors.textTertiary,
      letterSpacing: Typography.tracking.wide,
    },
    tabTextActive: {
      color: colors.accent,
    },
    tabUnderline: {
      position:        'absolute',
      bottom:          0,
      left:            Spacing['4'],
      right:           Spacing['4'],
      height:          1.5,
      backgroundColor: colors.accent,
      borderRadius:    Radius.full,
    },
    searchWrap: {
      flexDirection:     'row',
      alignItems:        'center',
      gap:               Spacing['2'],
      margin:            Spacing['3'],
      backgroundColor:   colors.surface,
      borderRadius:      Radius.md,
      borderWidth:       BorderWidth.hairline,
      borderColor:       colors.border,
      paddingHorizontal: Spacing['3'],
      paddingVertical:   Spacing['2'],
    },
    searchIcon: {
      fontSize: 13,
    },
    searchInput: {
      flex:       1,
      fontFamily: Typography.mono,
      fontSize:   Typography.size.sm,
      color:      colors.textPrimary,
      padding:    0,
    },
    listContent: {
      paddingBottom: Spacing['20'],
    },
    convoRow: {
      flexDirection:     'row',
      alignItems:        'center',
      gap:               Spacing['3'],
      paddingHorizontal: Spacing['4'],
      paddingVertical:   Spacing['3'],
    },
    convoRowUnread: {
      backgroundColor: colors.surfaceAlt,
    },
    avatar: {
      width:          40,
      height:         40,
      borderRadius:   20,
      borderWidth:    BorderWidth.hairline,
      borderColor:    colors.border,
      alignItems:     'center',
      justifyContent: 'center',
      flexShrink:     0,
    },
    avatarText: {
      fontFamily: Typography.mono,
      fontSize:   Typography.size.sm,
      fontWeight: Typography.weight.medium,
    },
    convoContent: {
      flex:     1,
      minWidth: 0,
    },
    convoAddress: {
      fontFamily:   Typography.mono,
      fontSize:     Typography.size.sm,
      fontWeight:   Typography.weight.medium,
      color:        colors.textPrimary,
      marginBottom: 3,
    },
    convoPreview: {
      fontFamily: Typography.sans,
      fontSize:   Typography.size.sm,
      color:      colors.textSecondary,
    },
    convoMeta: {
      alignItems: 'flex-end',
      gap:        Spacing['1'],
      flexShrink: 0,
    },
    convoTime: {
      fontFamily: Typography.mono,
      fontSize:   Typography.size.xs,
      color:      colors.textTertiary,
    },
    unreadBadge: {
      width:           16,
      height:          16,
      borderRadius:    8,
      backgroundColor: colors.accent,
      alignItems:      'center',
      justifyContent:  'center',
    },
    unreadText: {
      fontFamily: Typography.mono,
      fontSize:   9,
      fontWeight: Typography.weight.bold,
      color:      colors.bg,
    },
    separator: {
      height:          BorderWidth.hairline,
      backgroundColor: colors.surface,
      marginLeft:      Spacing['4'] + 40 + Spacing['3'],
    },
    empty: {
      alignItems: 'center',
      paddingTop: Spacing['20'],
      gap:        Spacing['2'],
    },
    emptyText: {
      fontFamily: Typography.serif,
      fontSize:   Typography.size.md,
      color:      colors.textTertiary,
    },
    emptySubtext: {
      fontFamily: Typography.mono,
      fontSize:   Typography.size.xs,
      color:      colors.textTertiary,
    },
    fab: {
      position:        'absolute',
      bottom:          Spacing['6'],
      left:            Spacing['4'],
      right:           Spacing['4'],
      flexDirection:   'row',
      alignItems:      'center',
      justifyContent:  'center',
      gap:             Spacing['2'],
      backgroundColor: colors.accentSoft,
      borderRadius:    Radius.lg,
      borderWidth:     BorderWidth.hairline,
      borderColor:     colors.border,
      paddingVertical: Spacing['3'],
    },
    fabIcon: {
      fontSize: 14,
      color:    colors.accent,
    },
    fabText: {
      fontFamily: Typography.sans,
      fontSize:   Typography.size.base,
      color:      colors.accent,
    },
  })
}
