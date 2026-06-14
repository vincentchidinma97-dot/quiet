'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { usePrivy, useLinkWithPasskey, useUnlinkPasskey } from '@privy-io/react-auth'
import { useAccount } from 'wagmi'
import { QRCodeSVG as QRCodeSVGBase } from 'qrcode.react'
import { useConnectedWallet } from '@/lib/hooks/useConnectedWallet'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { SendModal } from '@/components/SendModal'
import { sendEth, sendToken, estimateTxFee } from '@/lib/blockchain'
import type { Token } from '@/lib/tokens'
import { TOKENS } from '@/lib/tokens'
import { useTokenBalances } from '@/lib/hooks/useTokenBalances'
import { useXmtp } from '@/lib/hooks/useXmtp'
import {
  listConversations,
  getOrCreateConversation,
  getConversationStatus,
  listMessages,
  streamMessages,
  sendMessage,
  resolvePeerAddress,
  checkCanMessage,
  type Dm,
  type DecodedMessage,
} from '@/lib/xmtp'
import styles from './page.module.css'
import { getAllTags } from '@/lib/tags'
import { TagPill } from '@/components/TagPill'
import { TagEditorModal } from '@/components/TagEditorModal'
import { PasskeySetupModal } from '@/components/PasskeySetupModal'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const QRCodeSVG = QRCodeSVGBase as any

type Destination = 'inbox' | 'portfolio' | 'trade' | 'settings'
type SettingsSection = 'appearance' | 'identity' | 'security' | 'about'

const RAIL_ITEMS: { id: Destination; icon: string; label: string }[] = [
  { id: 'inbox',     icon: '✉',  label: 'inbox' },
  { id: 'portfolio', icon: '◈',  label: 'portfolio' },
  { id: 'trade',     icon: '⚡', label: 'trade' },
  { id: 'settings',  icon: '○',  label: 'settings' },
]

const SETTINGS_SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: 'appearance', label: 'appearance' },
  { id: 'identity',   label: 'identity' },
  { id: 'security',   label: 'security' },
  { id: 'about',      label: 'about' },
]

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-6)}`
}

function formatRelativeTime(date: Date): string {
  const diff = Date.now() - date.getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

interface ConvEntry {
  id: string
  peerAddress: string
  dm: Dm
  lastMsgText: string | null
  lastMsgTime: Date | null
  status: 'accepted' | 'pending'
}

function XmtpInitScreen({ message }: { message: string }) {
  return (
    <div className={styles.xmtpInit}>
      <span className={styles.xmtpInitMark}>
        quiet<span className={styles.xmtpInitDot}>.</span>
      </span>
      <p className={styles.xmtpInitMsg}>{message}</p>
      <div className={styles.xmtpInitPulse} />
    </div>
  )
}

export default function AppPage() {
  const router = useRouter()
  const { ready, authenticated, user } = usePrivy()
  const { isConnected: wcConnected } = useAccount()
  const wallet = useConnectedWallet()
  const { xmtpClient, isInitializing, error: xmtpError } = useXmtp()

  // Passkey management
  const { linkWithPasskey } = useLinkWithPasskey()
  const { unlink: unlinkPasskey } = useUnlinkPasskey()
  const [passkeyLinking, setPasskeyLinking] = useState(false)
  const [passkeyUnlinking, setPasskeyUnlinking] = useState(false)
  const [passkeyRowError, setPasskeyRowError] = useState<string | null>(null)

  const address = wallet.address
  const { balances: tokenBalances } = useTokenBalances(address)

  // ── Destination + section state
  const [destination, setDestination] = useState<Destination>('inbox')
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('appearance')
  const [portfolioTab, setPortfolioTab] = useState<'assets' | 'activity'>('assets')
  const [mobileSettingsSection, setMobileSettingsSection] = useState<SettingsSection | null>(null)

  // ── Portfolio
  const [showReceive, setShowReceive] = useState(false)
  const [showSend, setShowSend] = useState(false)

  // ── Address copy
  const [copied, setCopied] = useState(false)

  // ── Conversation list
  const [convEntries, setConvEntries] = useState<ConvEntry[]>([])
  const [convLoading, setConvLoading] = useState(false)
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)

  // ── New message flow
  const [showNewMsg, setShowNewMsg] = useState(false)
  const [newMsgAddr, setNewMsgAddr] = useState('')
  const [newMsgError, setNewMsgError] = useState<string | null>(null)
  const [newMsgLoading, setNewMsgLoading] = useState(false)

  // ── Message pane
  const [messages, setMessages] = useState<DecodedMessage[]>([])
  const [msgLoading, setMsgLoading] = useState(false)
  const streamCleanupRef = useRef<(() => void) | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const mobileMessagesEndRef = useRef<HTMLDivElement>(null)

  // ── Composer
  const [composerText, setComposerText] = useState('')
  const [isSending, setIsSending] = useState(false)

  // ── Search
  const [search, setSearch] = useState('')

  // ── Inbox tab
  const [tab, setTab] = useState<'messages' | 'requests' | 'rooms'>('messages')

  // ── Tag map
  const [tagMap, setTagMap] = useState<Record<string, string[]>>({})
  const [tagEditorAddress, setTagEditorAddress] = useState<string | null>(null)
  useEffect(() => { setTagMap(getAllTags()) }, [])

  // ── Passkey prompt
  const [showPasskeyPrompt, setShowPasskeyPrompt] = useState(false)

  // ── Declined request IDs
  const [declinedIds, setDeclinedIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = localStorage.getItem('quiet-declined')
      return stored ? new Set<string>(JSON.parse(stored)) : new Set()
    } catch { return new Set() }
  })

  // ── Persist destination to localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('quiet-destination') as Destination | null
      if (saved && RAIL_ITEMS.some((r) => r.id === saved)) setDestination(saved)
    } catch { /* ignore */ }
  }, [])
  useEffect(() => {
    try { localStorage.setItem('quiet-destination', destination) } catch { /* ignore */ }
  }, [destination])

  // ── Auth guard
  useEffect(() => {
    if (ready && !authenticated && !wcConnected) router.replace('/')
  }, [ready, authenticated, wcConnected, router])

  // ── Passkey prompt trigger
  useEffect(() => {
    if (!ready || !authenticated || !user) return
    if (wallet.source !== 'privy') return
    try { if (localStorage.getItem('quiet-passkey-prompted')) return } catch { return }
    const hasPasskey = (user.linkedAccounts as any[]).some((a: any) => a.type === 'passkey')
    if (!hasPasskey) setShowPasskeyPrompt(true)
  }, [ready, authenticated, user, wallet.source])

  function handlePasskeyPromptClose() {
    try { localStorage.setItem('quiet-passkey-prompted', 'true') } catch { /* ignore */ }
    setShowPasskeyPrompt(false)
  }

  // ── Load conversations
  const loadConversations = useCallback(async () => {
    if (!xmtpClient) return
    setConvLoading(true)
    try {
      const dms = await listConversations(xmtpClient)
      const entries = await Promise.all(
        dms.map(async (dm) => {
          const [peerAddress, lastMsg, status] = await Promise.all([
            resolvePeerAddress(xmtpClient, dm),
            dm.lastMessage(),
            getConversationStatus(xmtpClient, dm),
          ])
          const lastMsgText =
            lastMsg && typeof lastMsg.content === 'string' ? (lastMsg.content as string) : null
          return {
            id: dm.id,
            peerAddress,
            dm,
            lastMsgText,
            lastMsgTime: lastMsg?.sentAt ?? null,
            status,
          } satisfies ConvEntry
        }),
      )
      setConvEntries(entries)
    } catch (err) {
      console.error('[quiet] loadConversations error:', err)
    } finally {
      setConvLoading(false)
    }
  }, [xmtpClient])

  useEffect(() => { loadConversations() }, [loadConversations])
  useEffect(() => {
    window.addEventListener('focus', loadConversations)
    return () => window.removeEventListener('focus', loadConversations)
  }, [loadConversations])

  // ── Auto-scroll messages (desktop + mobile refs)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    mobileMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Cleanup stream on unmount
  useEffect(() => { return () => { streamCleanupRef.current?.() } }, [])

  // ── Select conversation
  const selectConversation = useCallback(async (entry: ConvEntry) => {
    if (selectedConvId === entry.id) return
    setSelectedConvId(entry.id)
    setMessages([])
    setMsgLoading(true)
    streamCleanupRef.current?.()
    streamCleanupRef.current = null
    try {
      const history = await listMessages(entry.dm)
      setMessages(history)
      setMsgLoading(false)
      const cleanup = await streamMessages(entry.dm, (msg) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev
          return [...prev, msg]
        })
        setConvEntries((prev) =>
          prev.map((c) =>
            c.id === entry.id
              ? {
                  ...c,
                  lastMsgText: typeof msg.content === 'string' ? (msg.content as string) : c.lastMsgText,
                  lastMsgTime: msg.sentAt,
                }
              : c,
          ),
        )
      })
      streamCleanupRef.current = cleanup
    } catch (err) {
      console.error('[quiet] selectConversation error:', err)
      setMsgLoading(false)
    }
  }, [selectedConvId])

  // ── New conversation
  async function handleNewConversation(e: React.FormEvent) {
    e.preventDefault()
    if (!xmtpClient || !newMsgAddr.trim() || newMsgLoading) return
    const addr = newMsgAddr.trim()
    if (!addr.startsWith('0x') || addr.length !== 42) {
      setNewMsgError('enter a valid wallet address (0x…)')
      return
    }
    setNewMsgError(null)
    setNewMsgLoading(true)
    try {
      const canMsg = await checkCanMessage(xmtpClient, addr)
      if (!canMsg) {
        setNewMsgError("this wallet isn't registered on XMTP yet")
        setNewMsgLoading(false)
        return
      }
      const dm = await getOrCreateConversation(xmtpClient, addr)
      const existing = convEntries.find((c) => c.id === dm.id)
      if (existing) {
        selectConversation(existing)
      } else {
        const newEntry: ConvEntry = {
          id: dm.id, peerAddress: addr, dm,
          lastMsgText: null, lastMsgTime: null, status: 'accepted',
        }
        setConvEntries((prev) => [newEntry, ...prev])
        selectConversation(newEntry)
      }
      setShowNewMsg(false)
      setNewMsgAddr('')
    } catch (err) {
      console.error('[quiet] handleNewConversation error:', err)
      setNewMsgError('could not open conversation')
    } finally {
      setNewMsgLoading(false)
    }
  }

  function handleDecline(id: string) {
    setDeclinedIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      localStorage.setItem('quiet-declined', JSON.stringify([...next]))
      return next
    })
    if (selectedConvId === id) setSelectedConvId(null)
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const text = composerText.trim()
    if (!text || isSending || !selectedConvId) return
    const entry = convEntries.find((c) => c.id === selectedConvId)
    if (!entry) return
    setIsSending(true)
    setComposerText('')
    try {
      await sendMessage(entry.dm, text)
      setConvEntries((prev) =>
        prev.map((c) => (c.id === entry.id ? { ...c, status: 'accepted' as const } : c)),
      )
    } catch (err) {
      console.error('[quiet] send error:', err)
      setComposerText(text)
    } finally {
      setIsSending(false)
    }
  }

  async function handleEstimateGas(token: Token, toAddr: string, amount: string): Promise<string> {
    if (!address) return 'unknown'
    return estimateTxFee(
      address as `0x${string}`, toAddr as `0x${string}`,
      token.address, token.decimals, amount,
    )
  }

  async function handleSendToken(token: Token, toAddr: string, amount: string): Promise<string> {
    if (!address) throw new Error('wallet not connected')
    const provider = await wallet.getProvider()
    if (!provider) throw new Error('provider not available')
    if (token.address === null) {
      return sendEth(provider, address as `0x${string}`, toAddr as `0x${string}`, amount)
    }
    return sendToken(
      provider, address as `0x${string}`, token.address,
      toAddr as `0x${string}`, amount, token.decimals,
    )
  }

  async function handleLogout() {
    streamCleanupRef.current?.()
    await wallet.disconnect()
    router.push('/')
  }

  function refreshTags() { setTagMap(getAllTags()) }

  function copyAddress() {
    if (!address) return
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    })
  }

  async function handleLinkPasskey() {
    setPasskeyRowError(null)
    setPasskeyLinking(true)
    try { await linkWithPasskey() }
    catch (err) { setPasskeyRowError(err instanceof Error ? err.message : 'passkey setup failed') }
    finally { setPasskeyLinking(false) }
  }

  async function handleUnlinkPasskey() {
    const linkedAccounts = (user?.linkedAccounts as any[]) ?? []
    const passkeyAccount = linkedAccounts.find((a: any) => a.type === 'passkey')
    if (!passkeyAccount) return
    const credentialId: string = passkeyAccount.credentialId ?? passkeyAccount.credential_id
    setPasskeyRowError(null)
    setPasskeyUnlinking(true)
    try { await unlinkPasskey({ credentialId }) }
    catch (err) { setPasskeyRowError(err instanceof Error ? err.message : 'could not remove passkey') }
    finally { setPasskeyUnlinking(false) }
  }

  // ── Auth loading screens
  if ((!ready && !wcConnected) || (!authenticated && !wcConnected)) {
    return (
      <div className={styles.loading}>
        <span className={styles.loadingMark}>
          quiet<span className={styles.loadingDot}>.</span>
        </span>
      </div>
    )
  }
  if (isInitializing) return <XmtpInitScreen message="setting up your encrypted identity…" />
  if (xmtpError) return <XmtpInitScreen message={`messaging unavailable: ${xmtpError}`} />

  // ── Derived values
  const selectedEntry = convEntries.find((c) => c.id === selectedConvId)
  const visibleConvs = convEntries.filter((c) => !declinedIds.has(c.id))
  const acceptedConvs = visibleConvs.filter((c) => c.status === 'accepted')
  const pendingConvs = visibleConvs.filter((c) => c.status === 'pending')
  const requestCount = pendingConvs.length
  const baseList = tab === 'messages' ? acceptedConvs : pendingConvs
  const filteredConvs = search.trim()
    ? baseList.filter((c) => c.peerAddress.toLowerCase().includes(search.toLowerCase()))
    : baseList

  const linkedAccounts = (user?.linkedAccounts as any[]) ?? []
  const passkeyAccount = linkedAccounts.find((a: any) => a.type === 'passkey')

  function getLoginMethod(): string {
    if (wallet.source === 'walletconnect') return 'external wallet'
    if (linkedAccounts.some((a: any) => a.type === 'apple_oauth')) return 'apple'
    if (linkedAccounts.some((a: any) => a.type === 'google_oauth')) return 'google'
    if (linkedAccounts.some((a: any) => a.type === 'passkey')) return 'passkey'
    const email = linkedAccounts.find((a: any) => a.type === 'email')
    if (email?.address) return email.address
    return 'email'
  }

  // ── Render helpers ────────────────────────────────────────────────────────

  function renderConvList() {
    return (
      <>
        <div className={styles.searchWrap}>
          <input
            className={styles.searchInput}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="search 0x… or name"
            spellCheck={false}
            autoComplete="off"
          />
        </div>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === 'messages' ? styles.tabActive : ''}`}
            onClick={() => setTab('messages')}
          >
            messages
          </button>
          <button
            className={`${styles.tab} ${tab === 'requests' ? styles.tabActive : ''}`}
            onClick={() => setTab('requests')}
          >
            requests
            {requestCount > 0 && <span className={styles.tabBadge}>{requestCount}</span>}
          </button>
          <button
            className={`${styles.tab} ${tab === 'rooms' ? styles.tabActive : ''}`}
            onClick={() => setTab('rooms')}
          >
            rooms
          </button>
        </div>
        <div className={styles.convList}>
          {tab === 'rooms' ? (
            <span className={styles.emptyList}>rooms coming soon</span>
          ) : convLoading ? (
            <span className={styles.emptyList}>syncing…</span>
          ) : filteredConvs.length === 0 ? (
            <span className={styles.emptyList}>
              {tab === 'messages' ? 'no correspondence yet' : 'no requests'}
            </span>
          ) : tab === 'messages' ? (
            filteredConvs.map((entry) => (
              <button
                key={entry.id}
                className={`${styles.convRow} ${selectedConvId === entry.id ? styles.convRowActive : ''}`}
                onClick={() => selectConversation(entry)}
              >
                <div className={styles.convRowTop}>
                  <div className={styles.convRowLeft}>
                    <span className={styles.convPeer}>{truncateAddress(entry.peerAddress)}</span>
                    {(tagMap[entry.peerAddress.toLowerCase()] ?? []).slice(0, 2).map((tag) => (
                      <TagPill key={tag} tag={tag} />
                    ))}
                    {(tagMap[entry.peerAddress.toLowerCase()] ?? []).length > 2 && (
                      <TagPill tag={`+${(tagMap[entry.peerAddress.toLowerCase()] ?? []).length - 2}`} />
                    )}
                  </div>
                  {entry.lastMsgTime && (
                    <span className={styles.convTime}>{formatRelativeTime(entry.lastMsgTime)}</span>
                  )}
                </div>
                {entry.lastMsgText && (
                  <span className={styles.convPreview}>
                    {entry.lastMsgText.slice(0, 30)}{entry.lastMsgText.length > 30 ? '…' : ''}
                  </span>
                )}
              </button>
            ))
          ) : (
            filteredConvs.map((entry) => (
              <div key={entry.id} className={styles.requestCard}>
                <div className={styles.reqCardTop}>
                  <div className={styles.reqCardLeft}>
                    <span className={styles.reqCardPeer}>{truncateAddress(entry.peerAddress)}</span>
                    {(tagMap[entry.peerAddress.toLowerCase()] ?? []).map((tag) => (
                      <TagPill key={tag} tag={tag} />
                    ))}
                  </div>
                  {entry.lastMsgTime && (
                    <span className={styles.convTime}>{formatRelativeTime(entry.lastMsgTime)}</span>
                  )}
                </div>
                {entry.lastMsgText && (
                  <p className={styles.reqCardQuote}>
                    &ldquo;{entry.lastMsgText.slice(0, 80)}{entry.lastMsgText.length > 80 ? '…' : ''}&rdquo;
                  </p>
                )}
                <div className={styles.reqCardActions}>
                  <button className={styles.reqAcceptBtn} onClick={() => selectConversation(entry)}>accept</button>
                  <button className={styles.reqDeclineBtn} onClick={() => handleDecline(entry.id)}>decline</button>
                </div>
              </div>
            ))
          )}
        </div>
        <div className={styles.newMsgWrap}>
          {showNewMsg ? (
            <form className={styles.newMsgForm} onSubmit={handleNewConversation}>
              <input
                className={styles.newMsgInput}
                type="text"
                value={newMsgAddr}
                onChange={(e) => { setNewMsgAddr(e.target.value); setNewMsgError(null) }}
                placeholder="0x wallet address"
                spellCheck={false}
                autoComplete="off"
                autoFocus
              />
              {newMsgError && <span className={styles.newMsgError}>{newMsgError}</span>}
              <div className={styles.newMsgActions}>
                <button type="submit" className={styles.newMsgSubmit} disabled={newMsgLoading}>
                  {newMsgLoading ? '…' : 'open'}
                </button>
                <button
                  type="button"
                  className={styles.newMsgCancel}
                  onClick={() => { setShowNewMsg(false); setNewMsgAddr(''); setNewMsgError(null) }}
                >
                  cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              className={styles.newMsgBtn}
              onClick={() => setShowNewMsg(true)}
              disabled={!xmtpClient}
            >
              + new message
            </button>
          )}
        </div>
      </>
    )
  }

  function renderChatView(endRef: React.RefObject<HTMLDivElement | null>) {
    return (
      <>
        <div className={styles.messageList}>
          {msgLoading ? (
            <div className={styles.msgLoading}>
              <span className={styles.msgLoadingText}>loading…</span>
            </div>
          ) : messages.length === 0 ? (
            <div className={styles.msgEmpty}>
              <span className={styles.msgEmptyText}>no messages yet — say something</span>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderInboxId === xmtpClient?.inboxId
              return (
                <div key={msg.id} className={`${styles.msgRow} ${isMe ? styles.msgRowMe : styles.msgRowThem}`}>
                  <div className={`${styles.msgBubble} ${isMe ? styles.msgBubbleMe : styles.msgBubbleThem}`}>
                    <span className={styles.msgText}>
                      {typeof msg.content === 'string' ? msg.content : ''}
                    </span>
                    <span className={styles.msgTime}>
                      {msg.sentAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              )
            })
          )}
          <div ref={endRef} />
        </div>
        <form className={styles.composer} onSubmit={handleSend}>
          <input
            className={styles.composerInput}
            type="text"
            value={composerText}
            onChange={(e) => setComposerText(e.target.value)}
            placeholder="write a message…"
            disabled={isSending}
            autoComplete="off"
            spellCheck
          />
          <button
            className={styles.composerSend}
            type="submit"
            disabled={isSending || !composerText.trim()}
          >
            {isSending ? '…' : 'send'}
          </button>
        </form>
      </>
    )
  }

  function renderPortfolioMain() {
    return (
      <div className={styles.portfolioMain}>
        <div className={styles.portfolioHeader}>
          <p className={styles.portfolioTotalLabel}>total value</p>
          <p className={styles.portfolioTotalValue}>—</p>
          <p className={styles.portfolioDelta}>price feed coming soon</p>
        </div>
        <div className={styles.portfolioDivider} />
        <div className={styles.portfolioAssets}>
          {tokenBalances.map((b) => (
            <div key={b.token.symbol} className={styles.assetRow}>
              <div
                className={styles.assetIcon}
                style={{ background: b.token.iconColor + '22', color: b.token.iconColor }}
              >
                {b.token.iconLetters}
              </div>
              <div className={styles.assetMeta}>
                <span className={styles.assetSymbol}>{b.token.symbol}</span>
                <span className={styles.assetName}>{b.token.name}</span>
              </div>
              <span className={styles.assetBalance}>{b.balance ?? '—'}</span>
            </div>
          ))}
        </div>
        <div className={styles.portfolioActions}>
          <button className={styles.portfolioSendBtn} onClick={() => setShowSend(true)}>
            send
          </button>
          <button
            className={`${styles.portfolioReceiveBtn} ${showReceive ? styles.portfolioReceiveBtnActive : ''}`}
            onClick={() => setShowReceive((v) => !v)}
          >
            {showReceive ? 'hide qr' : 'receive'}
          </button>
        </div>
        {showReceive && address && (
          <div className={styles.receiveCard}>
            <p className={styles.receiveCardLabel}>this address accepts</p>
            <div className={styles.receiveTokenBadges}>
              {TOKENS.map((token) => (
                <div
                  key={token.symbol}
                  className={styles.receiveTokenBadge}
                  style={{ background: token.iconColor + '22', color: token.iconColor }}
                >
                  <span>{token.iconLetters}</span>
                  <span className={styles.receiveBadgeSymbol}>{token.symbol}</span>
                </div>
              ))}
            </div>
            <QRCodeSVG value={address} size={150} bgColor="transparent" fgColor="var(--text)" level="M" />
            <p className={styles.receiveAddress}>{address}</p>
            <p className={styles.receiveNote}>
              all on ethereum sepolia — sending other networks here will result in loss of funds
            </p>
          </div>
        )}
      </div>
    )
  }

  function renderSettingsSection(section: SettingsSection) {
    switch (section) {
      case 'appearance':
        return (
          <div className={styles.settingsSection}>
            <p className={styles.settingsSectionTitle}>appearance</p>
            <div className={styles.settingsCard}>
              <div className={styles.settingsCardPad}>
                <ThemeSwitcher />
              </div>
            </div>
          </div>
        )
      case 'identity':
        return (
          <div className={styles.settingsSection}>
            <p className={styles.settingsSectionTitle}>identity</p>
            <div className={styles.settingsCard}>
              {address && (
                <>
                  <div className={styles.settingsRow}>
                    <span className={styles.settingsRowLabel}>address</span>
                    <div className={styles.settingsRowRight}>
                      <span className={styles.settingsRowMono}>
                        {address.slice(0, 6)}…{address.slice(-4)}
                      </span>
                      <button
                        className={`${styles.copyBtn} ${copied ? styles.copyBtnDone : ''}`}
                        onClick={copyAddress}
                      >
                        {copied ? '✓' : '⎘'}
                      </button>
                    </div>
                  </div>
                  <div className={styles.settingsDivider} />
                </>
              )}
              <div className={styles.settingsRow}>
                <span className={styles.settingsRowLabel}>login</span>
                <span className={styles.settingsRowMono}>{getLoginMethod()}</span>
              </div>
              {wallet.source === 'privy' && (
                <>
                  <div className={styles.settingsDivider} />
                  <div className={styles.settingsRow}>
                    <span className={styles.settingsRowLabel}>passkey</span>
                    <div className={styles.settingsRowRight}>
                      {passkeyAccount ? (
                        <>
                          <span className={`${styles.settingsRowMono} ${styles.passkeyEnabled}`}>
                            ✓ enabled
                          </span>
                          <button
                            className={styles.passkeyActionBtn}
                            onClick={handleUnlinkPasskey}
                            disabled={passkeyUnlinking}
                          >
                            {passkeyUnlinking ? '…' : 'remove'}
                          </button>
                        </>
                      ) : (
                        <>
                          <span className={`${styles.settingsRowMono} ${styles.passkeyMuted}`}>
                            not set up
                          </span>
                          <button
                            className={styles.passkeyActionBtn}
                            onClick={handleLinkPasskey}
                            disabled={passkeyLinking}
                          >
                            {passkeyLinking ? '…' : 'add'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {passkeyRowError && <p className={styles.passkeyError}>{passkeyRowError}</p>}
                </>
              )}
              <div className={styles.settingsDivider} />
              <div className={styles.settingsRow}>
                <span className={styles.settingsRowLabel}>encryption</span>
                <span className={styles.settingsRowMono}>ECDH · on-device</span>
              </div>
            </div>
          </div>
        )
      case 'security':
        return (
          <div className={styles.settingsSection}>
            <p className={styles.settingsSectionTitle}>security</p>
            <div className={styles.settingsCard}>
              <p className={styles.securityText}>
                your keys are sharded across your device, Privy servers, and your login method
                — no single point of failure
              </p>
            </div>
            <button
              className={styles.logoutBtn}
              onClick={async () => {
                if (!window.confirm('are you sure you want to log out?')) return
                await handleLogout()
              }}
            >
              log out
            </button>
          </div>
        )
      case 'about':
        return (
          <div className={styles.settingsSection}>
            <p className={styles.settingsSectionTitle}>about</p>
            <div className={styles.settingsCard}>
              <div className={styles.settingsRow}>
                <span className={styles.settingsRowLabel}>version</span>
                <span className={styles.settingsRowMono}>0.1.0-alpha</span>
              </div>
              <div className={styles.settingsDivider} />
              <div className={styles.settingsRow}>
                <span className={styles.settingsRowLabel}>protocol</span>
                <span className={styles.settingsRowMono}>XMTP v2</span>
              </div>
              <div className={styles.settingsDivider} />
              <div className={styles.settingsRow}>
                <span className={styles.settingsRowLabel}>license</span>
                <span className={styles.settingsRowMono}>MIT</span>
              </div>
            </div>
          </div>
        )
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ══════════════════════════════════════════════════════════
          DESKTOP SHELL  ≥768px
          rail 64px | sidebar 240px | main flex
          ══════════════════════════════════════════════════════════ */}
      <div className={styles.desktopShell}>

        {/* ── Left rail ── */}
        <nav className={styles.rail}>
          <span className={styles.railLogo}>
            q<span className={styles.railLogoDot}>.</span>
          </span>
          <div className={styles.railNav}>
            {RAIL_ITEMS.map((item) => (
              <button
                key={item.id}
                className={`${styles.railBtn} ${destination === item.id ? styles.railBtnActive : ''}`}
                onClick={() => setDestination(item.id)}
                type="button"
                title={item.label}
              >
                <span className={styles.railIcon}>{item.icon}</span>
                <span className={styles.railLabel}>{item.label}</span>
              </button>
            ))}
          </div>
          {address && (
            <div className={styles.railAvatar} title={address}>
              {address.slice(2, 4).toUpperCase()}
            </div>
          )}
        </nav>

        {/* ── Sidebar ── */}
        <aside className={styles.sidebar}>
          {destination === 'inbox' && (
            <>
              <div className={styles.sidebarHeader}>
                <span className={styles.sidebarTitle}>inbox</span>
              </div>
              {renderConvList()}
            </>
          )}

          {destination === 'portfolio' && (
            <div className={styles.sidebarInner}>
              <div className={styles.sidebarHeader}>
                <span className={styles.sidebarTitle}>portfolio</span>
              </div>
              <div className={styles.tabs}>
                <button
                  className={`${styles.tab} ${portfolioTab === 'assets' ? styles.tabActive : ''}`}
                  onClick={() => setPortfolioTab('assets')}
                >
                  assets
                </button>
                <button
                  className={`${styles.tab} ${portfolioTab === 'activity' ? styles.tabActive : ''}`}
                  onClick={() => setPortfolioTab('activity')}
                >
                  activity
                </button>
              </div>
            </div>
          )}

          {destination === 'trade' && (
            <div className={styles.sidebarInner}>
              <div className={styles.sidebarHeader}>
                <span className={styles.sidebarTitle}>trade</span>
              </div>
            </div>
          )}

          {destination === 'settings' && (
            <div className={styles.sidebarInner}>
              <div className={styles.sidebarHeader}>
                <span className={styles.sidebarTitle}>settings</span>
              </div>
              <div className={styles.settingsSectionList}>
                {SETTINGS_SECTIONS.map((s) => (
                  <button
                    key={s.id}
                    className={`${styles.settingsSectionItem} ${settingsSection === s.id ? styles.settingsSectionItemActive : ''}`}
                    onClick={() => setSettingsSection(s.id)}
                    type="button"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* ── Main content ── */}
        <main className={styles.mainContent}>

          {destination === 'inbox' && (
            !selectedEntry ? (
              <div className={styles.mainEmpty}>
                <p className={styles.mainEmptyHint}>
                  select a conversation or paste a wallet to begin
                </p>
              </div>
            ) : (
              <div className={styles.conversation}>
                <div className={styles.convHeader}>
                  <div className={styles.convHeaderLeft}>
                    <span className={styles.convHeaderPeer}>
                      {truncateAddress(selectedEntry.peerAddress)}
                    </span>
                    {(tagMap[selectedEntry.peerAddress.toLowerCase()] ?? []).map((tag) => (
                      <TagPill key={tag} tag={tag} />
                    ))}
                    <button
                      className={styles.addTagBtn}
                      onClick={() => setTagEditorAddress(selectedEntry.peerAddress)}
                      type="button"
                    >
                      + tag
                    </button>
                  </div>
                  <span className={styles.convHeaderEncLabel}>⬡ end-to-end encrypted</span>
                </div>
                {renderChatView(messagesEndRef)}
              </div>
            )
          )}

          {destination === 'portfolio' && renderPortfolioMain()}

          {destination === 'trade' && (
            <div className={styles.tradePlaceholder}>
              <p className={styles.tradeName}>
                trade<span className={styles.tradeDot}>·</span>coming soon
              </p>
              <p className={styles.tradeDesc}>
                paste a 0x contract to view live token data, then snipe with one tap. shipping next.
              </p>
            </div>
          )}

          {destination === 'settings' && (
            <div className={styles.settingsMain}>
              {renderSettingsSection(settingsSection)}
            </div>
          )}

        </main>
      </div>

      {/* ══════════════════════════════════════════════════════════
          MOBILE SHELL  ≤767px
          full-width content + bottom tab bar
          ══════════════════════════════════════════════════════════ */}
      <div className={styles.mobileShell}>
        <div className={styles.mobileContent}>

          {/* ── Inbox ── */}
          {destination === 'inbox' && (
            selectedConvId && selectedEntry ? (
              <div className={styles.mobileChatView}>
                <div className={styles.mobileChatHeader}>
                  <button
                    className={styles.mobileBack}
                    onClick={() => setSelectedConvId(null)}
                    type="button"
                    aria-label="back to inbox"
                  >
                    ←
                  </button>
                  <div className={styles.convHeaderLeft}>
                    <span className={styles.convHeaderPeer}>
                      {truncateAddress(selectedEntry.peerAddress)}
                    </span>
                    {(tagMap[selectedEntry.peerAddress.toLowerCase()] ?? []).map((tag) => (
                      <TagPill key={tag} tag={tag} />
                    ))}
                    <button
                      className={styles.addTagBtn}
                      onClick={() => setTagEditorAddress(selectedEntry.peerAddress)}
                      type="button"
                    >
                      + tag
                    </button>
                  </div>
                </div>
                {renderChatView(mobileMessagesEndRef)}
              </div>
            ) : (
              <div className={styles.mobileInbox}>
                <div className={styles.mobileInboxHeader}>
                  <span className={styles.wordmark}>
                    quiet<span className={styles.wordmarkDot}>.</span>
                  </span>
                </div>
                {renderConvList()}
              </div>
            )
          )}

          {/* ── Portfolio ── */}
          {destination === 'portfolio' && (
            <div className={styles.mobileDestView}>
              <div className={styles.mobileDestHeader}>
                <span className={styles.mobileDestTitle}>portfolio</span>
              </div>
              {renderPortfolioMain()}
            </div>
          )}

          {/* ── Trade ── */}
          {destination === 'trade' && (
            <div className={styles.mobileDestView}>
              <div className={styles.mobileDestHeader}>
                <span className={styles.mobileDestTitle}>trade</span>
              </div>
              <div className={styles.tradePlaceholder}>
                <p className={styles.tradeName}>
                  trade<span className={styles.tradeDot}>·</span>coming soon
                </p>
                <p className={styles.tradeDesc}>
                  paste a 0x contract to view live token data, then snipe with one tap. shipping next.
                </p>
              </div>
            </div>
          )}

          {/* ── Settings ── */}
          {destination === 'settings' && (
            mobileSettingsSection !== null ? (
              <div className={styles.mobileDestView}>
                <div className={styles.mobileSubHeader}>
                  <button
                    className={styles.mobileBack}
                    onClick={() => setMobileSettingsSection(null)}
                    type="button"
                    aria-label="back to settings"
                  >
                    ←
                  </button>
                  <span className={styles.mobileSubTitle}>{mobileSettingsSection}</span>
                </div>
                <div className={styles.mobileSettingsContent}>
                  {renderSettingsSection(mobileSettingsSection)}
                </div>
              </div>
            ) : (
              <div className={styles.mobileDestView}>
                <div className={styles.mobileDestHeader}>
                  <span className={styles.mobileDestTitle}>settings</span>
                </div>
                <div className={styles.mobileSettingsList}>
                  {SETTINGS_SECTIONS.map((s) => (
                    <button
                      key={s.id}
                      className={styles.mobileSettingsRow}
                      onClick={() => setMobileSettingsSection(s.id)}
                      type="button"
                    >
                      <span className={styles.mobileSettingsRowLabel}>{s.label}</span>
                      <span className={styles.mobileSettingsRowChevron}>›</span>
                    </button>
                  ))}
                </div>
              </div>
            )
          )}

        </div>

        {/* ── Bottom tab bar ── */}
        <nav className={styles.tabBar}>
          {RAIL_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`${styles.tabItem} ${destination === item.id ? styles.tabItemActive : ''}`}
              onClick={() => {
                setDestination(item.id)
                if (item.id !== 'settings') setMobileSettingsSection(null)
              }}
              type="button"
            >
              <span className={styles.tabIcon}>{item.icon}</span>
              <span className={styles.tabLabel}>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* ── Modals ── */}
      <SendModal
        isOpen={showSend}
        onClose={() => setShowSend(false)}
        balances={tokenBalances}
        onEstimateGas={handleEstimateGas}
        onSend={handleSendToken}
      />
      {tagEditorAddress && (
        <TagEditorModal
          address={tagEditorAddress}
          onClose={() => setTagEditorAddress(null)}
          onTagsChange={refreshTags}
        />
      )}
      {showPasskeyPrompt && (
        <PasskeySetupModal onClose={handlePasskeyPromptClose} />
      )}
    </>
  )
}
