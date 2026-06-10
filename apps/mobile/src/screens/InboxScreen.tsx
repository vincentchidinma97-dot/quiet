import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, SafeAreaView, StatusBar, RefreshControl,
} from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { InboxStackParamList } from '../navigation/types'
import { Typography, Spacing, Radius, BorderWidth } from '../theme'
import type { ThemeColors } from '../theme'
import { useWalletStore } from '../store/walletStore'
import { useMessagesStore } from '../store/messagesStore'
import { shortenAddress, generateAvatarColor } from '@vault/shared'
import { useHaptic } from '../hooks/useHaptic'
import { useTheme } from '../hooks/useTheme'
import { useWalletBalance } from '../hooks/useWalletBalance'
import { ShimmerRow } from '../components/Shimmer'

type Props = NativeStackScreenProps<InboxStackParamList, 'InboxList'>

const MOCK_CONVERSATIONS = [
  { address: '0x9fa2c8d1a3f4b7e2c1d8f6a9b3e4c7d2e1f8a9b3', preview: 'ser you saw the move on AAVE?', time: 'now', unread: 2 },
  { address: '0xb71d4e8f3c2a9b1e7d4f6c8a3b2e1d9f7c4a8b6e', preview: 'still holding, conviction is real', time: '2h',  unread: 0 },
  { address: '0xc3ae7f2b1d4e8c9a3f6b7d2e1c8a4f9b3e7d1c6a', preview: 'the new protocol just dropped',     time: '1d',  unread: 0 },
  { address: '0xdd034f8b2c1a7e9d3f6b4c8a2e1d7f3b9c6a4e8d', preview: 'lfg. confirmed on-chain',           time: '3d',  unread: 0 },
  { address: '0xe1bb9c4a2d8f6e3b1c7a4d9f2b6e8c3a1d7f4b9e', preview: 'that alpha aged well fr',           time: '5d',  unread: 0 },
]

type ActiveTab = 'messages' | 'rooms' | 'requests'

export function InboxScreen({ navigation }: Props) {
  const haptic = useHaptic()
  const { colors, mode } = useTheme()
  const styles = getStyles(colors)

  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [activeTab, setActiveTab]     = useState<ActiveTab>('messages')
  const [searchQuery, setSearchQuery] = useState('')
  const identity = useWalletStore((s) => s.identity)
  const { balance: ethBalance } = useWalletBalance()

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 800)
    return () => clearTimeout(t)
  }, [])

  function onRefresh() {
    haptic.light()
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 800)
  }

  const filtered = MOCK_CONVERSATIONS.filter((c) =>
    c.address.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  function ConversationRow({ item }: { item: typeof MOCK_CONVERSATIONS[0] }) {
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
                <Text style={{ color: colors.success }}>●</Text>
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
