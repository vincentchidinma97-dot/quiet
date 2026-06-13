'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { ThemeSwitcher } from '@/components/ThemeSwitcher'
import { SendModal } from '@/components/SendModal'
import { SettingsPanel } from '@/components/SettingsPanel'
import { sendEth, sendToken, estimateTxFee } from '@/lib/blockchain'
import type { Token } from '@/lib/tokens'
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

// ─── Loading screen shown while XMTP initialises ────────────────────────────
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

// ─── Main component ──────────────────────────────────────────────────────────
export default function AppPage() {
  const router = useRouter()
  const { ready, authenticated, user, logout } = usePrivy()
  const { wallets } = useWallets()
  const { xmtpClient, isInitializing, error: xmtpError } = useXmtp()

  // ── Wallet state
  const [showSend, setShowSend] = useState(false)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const walletAccount = (user?.linkedAccounts as any[])?.find(
    (a: any) => a.address && (a.type === 'wallet' || a.walletClient === 'privy'),
  )
  const address: string | undefined =
    walletAccount?.address ?? (user as any)?.wallet?.address
  const { balances: tokenBalances } = useTokenBalances(address)

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

  // ── Composer
  const [composerText, setComposerText] = useState('')
  const [isSending, setIsSending] = useState(false)

  // ── Search filter
  const [search, setSearch] = useState('')

  // ── Inbox tabs
  const [tab, setTab] = useState<'messages' | 'requests'>('messages')

  // ── Tag map — mirrors localStorage, refreshed after every modal save
  const [tagMap, setTagMap] = useState<Record<string, string[]>>({})
  const [tagEditorAddress, setTagEditorAddress] = useState<string | null>(null)
  useEffect(() => { setTagMap(getAllTags()) }, [])

  // ── Declined request IDs (soft-decline: local only, no XMTP/on-chain block)
  const [declinedIds, setDeclinedIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = localStorage.getItem('quiet-declined')
      return stored ? new Set<string>(JSON.parse(stored)) : new Set()
    } catch {
      return new Set()
    }
  })

  // Auth guard
  useEffect(() => {
    if (ready && !authenticated) router.replace('/')
  }, [ready, authenticated, router])

  // Load conversations
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
            lastMsg && typeof lastMsg.content === 'string'
              ? (lastMsg.content as string)
              : null
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

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  // Re-sync conversations and balances when the tab regains focus
  useEffect(() => {
    window.addEventListener('focus', loadConversations)
    return () => window.removeEventListener('focus', loadConversations)
  }, [loadConversations])

  // Auto-scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      streamCleanupRef.current?.()
    }
  }, [])

  // Select a conversation
  const selectConversation = useCallback(
    async (entry: ConvEntry) => {
      if (selectedConvId === entry.id) return
      setSelectedConvId(entry.id)
      setMessages([])
      setMsgLoading(true)

      // Stop previous stream
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
                    lastMsgText:
                      typeof msg.content === 'string'
                        ? (msg.content as string)
                        : c.lastMsgText,
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
    },
    [selectedConvId],
  )

  // Start a new conversation
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
        setNewMsgError('this wallet isn\'t registered on XMTP yet')
        setNewMsgLoading(false)
        return
      }
      const dm = await getOrCreateConversation(xmtpClient, addr)
      const existing = convEntries.find((c) => c.id === dm.id)
      if (existing) {
        selectConversation(existing)
      } else {
        const newEntry: ConvEntry = {
          id: dm.id,
          peerAddress: addr,
          dm,
          lastMsgText: null,
          lastMsgTime: null,
          status: 'accepted', // we initiated this conversation
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

  // Soft-decline a request: hide locally only.
  // Does NOT block the sender on XMTP or on-chain — that's a future feature.
  function handleDecline(id: string) {
    setDeclinedIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      localStorage.setItem('quiet-declined', JSON.stringify([...next]))
      return next
    })
    if (selectedConvId === id) setSelectedConvId(null)
  }

  // Send a message
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
      // Reclassify as accepted after first reply (stream delivers the message itself)
      setConvEntries((prev) =>
        prev.map((c) => (c.id === entry.id ? { ...c, status: 'accepted' as const } : c)),
      )
    } catch (err) {
      console.error('[quiet] send error:', err)
      setComposerText(text) // restore on failure
    } finally {
      setIsSending(false)
    }
  }

  async function handleEstimateGas(token: Token, toAddr: string, amount: string): Promise<string> {
    if (!address) return 'unknown'
    return estimateTxFee(
      address as `0x${string}`,
      toAddr as `0x${string}`,
      token.address,
      token.decimals,
      amount,
    )
  }

  async function handleSendToken(token: Token, toAddr: string, amount: string): Promise<string> {
    const embeddedWallet = wallets.find((w) => w.walletClientType === 'privy')
    if (!embeddedWallet || !address) throw new Error('wallet not ready')
    const provider = await embeddedWallet.getEthereumProvider()
    if (token.address === null) {
      return sendEth(provider, address as `0x${string}`, toAddr as `0x${string}`, amount)
    }
    return sendToken(
      provider,
      address as `0x${string}`,
      token.address,
      toAddr as `0x${string}`,
      amount,
      token.decimals,
    )
  }

  async function handleLogout() {
    streamCleanupRef.current?.()
    await logout()
    router.push('/')
  }

  function refreshTags() {
    setTagMap(getAllTags())
  }

  // ── Auth loading screen
  if (!ready || !authenticated) {
    return (
      <div className={styles.loading}>
        <span className={styles.loadingMark}>
          quiet<span className={styles.loadingDot}>.</span>
        </span>
      </div>
    )
  }

  // ── XMTP initializing screen
  if (isInitializing) {
    return (
      <XmtpInitScreen message="setting up your encrypted identity…" />
    )
  }

  // ── XMTP error screen
  if (xmtpError) {
    return (
      <XmtpInitScreen message={`messaging unavailable: ${xmtpError}`} />
    )
  }

  const selectedEntry = convEntries.find((c) => c.id === selectedConvId)
  const visibleConvs = convEntries.filter((c) => !declinedIds.has(c.id))
  const acceptedConvs = visibleConvs.filter((c) => c.status === 'accepted')
  const pendingConvs  = visibleConvs.filter((c) => c.status === 'pending')
  const requestCount  = pendingConvs.length
  const baseList = tab === 'messages' ? acceptedConvs : pendingConvs
  const filteredConvs = search.trim()
    ? baseList.filter((c) => c.peerAddress.toLowerCase().includes(search.toLowerCase()))
    : baseList

  return (
    <>
    <div className={styles.shell}>
      {/* ── Left sidebar ──────────────────────────────── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <span className={styles.wordmark}>
            quiet<span className={styles.wordmarkDot}>.</span>
          </span>
          <ThemeSwitcher />
        </div>

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

        {/* ── Tab switcher ── */}
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
            {requestCount > 0 && (
              <span className={styles.tabBadge}>{requestCount}</span>
            )}
          </button>
        </div>

        <div className={styles.convList}>
          {convLoading ? (
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
                    <span className={styles.convPeer}>
                      {truncateAddress(entry.peerAddress)}
                    </span>
                    {(tagMap[entry.peerAddress.toLowerCase()] ?? []).slice(0, 2).map((tag) => (
                      <TagPill key={tag} tag={tag} />
                    ))}
                    {(tagMap[entry.peerAddress.toLowerCase()] ?? []).length > 2 && (
                      <TagPill tag={`+${(tagMap[entry.peerAddress.toLowerCase()] ?? []).length - 2}`} />
                    )}
                  </div>
                  {entry.lastMsgTime && (
                    <span className={styles.convTime}>
                      {formatRelativeTime(entry.lastMsgTime)}
                    </span>
                  )}
                </div>
                {entry.lastMsgText && (
                  <span className={styles.convPreview}>
                    {entry.lastMsgText.slice(0, 30)}
                    {entry.lastMsgText.length > 30 ? '…' : ''}
                  </span>
                )}
              </button>
            ))
          ) : (
            filteredConvs.map((entry) => (
              <div key={entry.id} className={styles.requestCard}>
                <div className={styles.reqCardTop}>
                  <div className={styles.reqCardLeft}>
                    <span className={styles.reqCardPeer}>
                      {truncateAddress(entry.peerAddress)}
                    </span>
                    {(tagMap[entry.peerAddress.toLowerCase()] ?? []).map((tag) => (
                      <TagPill key={tag} tag={tag} />
                    ))}
                  </div>
                  {entry.lastMsgTime && (
                    <span className={styles.convTime}>
                      {formatRelativeTime(entry.lastMsgTime)}
                    </span>
                  )}
                </div>
                {entry.lastMsgText && (
                  <p className={styles.reqCardQuote}>
                    &ldquo;{entry.lastMsgText.slice(0, 80)}
                    {entry.lastMsgText.length > 80 ? '…' : ''}&rdquo;
                  </p>
                )}
                <div className={styles.reqCardActions}>
                  <button
                    className={styles.reqAcceptBtn}
                    onClick={() => selectConversation(entry)}
                  >
                    accept
                  </button>
                  <button
                    className={styles.reqDeclineBtn}
                    onClick={() => handleDecline(entry.id)}
                  >
                    decline
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* New message */}
        <div className={styles.newMsgWrap}>
          {showNewMsg ? (
            <form className={styles.newMsgForm} onSubmit={handleNewConversation}>
              <input
                className={styles.newMsgInput}
                type="text"
                value={newMsgAddr}
                onChange={(e) => {
                  setNewMsgAddr(e.target.value)
                  setNewMsgError(null)
                }}
                placeholder="0x wallet address"
                spellCheck={false}
                autoComplete="off"
                autoFocus
              />
              {newMsgError && (
                <span className={styles.newMsgError}>{newMsgError}</span>
              )}
              <div className={styles.newMsgActions}>
                <button
                  type="submit"
                  className={styles.newMsgSubmit}
                  disabled={newMsgLoading}
                >
                  {newMsgLoading ? '…' : 'open'}
                </button>
                <button
                  type="button"
                  className={styles.newMsgCancel}
                  onClick={() => {
                    setShowNewMsg(false)
                    setNewMsgAddr('')
                    setNewMsgError(null)
                  }}
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
      </aside>

      {/* ── Middle pane ────────────────────────────────── */}
      <main className={styles.middle}>
        {!selectedEntry ? (
          <div className={styles.middleEmpty}>
            <p className={styles.middleHint}>
              select a conversation or paste a wallet to begin
            </p>
          </div>
        ) : (
          <div className={styles.conversation}>
            {/* Conversation header */}
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

            {/* Message list */}
            <div className={styles.messageList}>
              {msgLoading ? (
                <div className={styles.msgLoading}>
                  <span className={styles.msgLoadingText}>loading…</span>
                </div>
              ) : messages.length === 0 ? (
                <div className={styles.msgEmpty}>
                  <span className={styles.msgEmptyText}>
                    no messages yet — say something
                  </span>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMe = msg.senderInboxId === xmtpClient?.inboxId
                  return (
                    <div
                      key={msg.id}
                      className={`${styles.msgRow} ${isMe ? styles.msgRowMe : styles.msgRowThem}`}
                    >
                      <div
                        className={`${styles.msgBubble} ${isMe ? styles.msgBubbleMe : styles.msgBubbleThem}`}
                      >
                        <span className={styles.msgText}>
                          {typeof msg.content === 'string' ? msg.content : ''}
                        </span>
                        <span className={styles.msgTime}>
                          {msg.sentAt.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Composer */}
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
          </div>
        )}
      </main>

      {/* ── Right panel (settings) ───────────────────────── */}
      <aside className={styles.panel}>
        <SettingsPanel
          address={address}
          tokenBalances={tokenBalances}
          user={user}
          onShowSend={() => setShowSend(true)}
          onLogout={handleLogout}
        />
      </aside>
    </div>

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
    </>
  )
}
