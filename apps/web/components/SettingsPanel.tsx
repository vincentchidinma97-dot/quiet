'use client'

import { useState } from 'react'
import { QRCodeSVG as QRCodeSVGBase } from 'qrcode.react'
import { ThemeSwitcher } from './ThemeSwitcher'
import { TOKENS } from '@/lib/tokens'
import type { TokenBalance } from '@/lib/hooks/useTokenBalances'
import styles from './SettingsPanel.module.css'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const QRCodeSVG = QRCodeSVGBase as any

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function getLoginMethod(user: any): string {
  const accounts = (user?.linkedAccounts as any[]) ?? []
  if (accounts.some((a: any) => a.type === 'apple_oauth')) return 'apple'
  if (accounts.some((a: any) => a.type === 'google_oauth')) return 'google'
  const email = accounts.find((a: any) => a.type === 'email')
  if (email?.address) return email.address
  return 'email'
}

interface Props {
  address: string | undefined
  tokenBalances: TokenBalance[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any
  onShowSend: () => void
  onLogout: () => Promise<void>
}

export function SettingsPanel({ address, tokenBalances, user, onShowSend, onLogout }: Props) {
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)

  function copyAddress() {
    if (!address) return
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    })
  }

  async function handleLogoutClick() {
    console.log('Logout button clicked')
    if (!window.confirm('are you sure you want to log out?')) return
    console.log('User confirmed logout')
    await onLogout()
    console.log('Logout complete, redirecting')
  }

  const ethBalance = tokenBalances.find((b) => b.token.symbol === 'ETH')?.balance ?? null

  return (
    <div className={styles.inner}>
      <h2 className={styles.title}>settings</h2>

      {/* ── Appearance ── */}
      <section className={styles.section}>
        <p className={styles.sectionLabel}>appearance</p>
        <div className={styles.card}>
          <div className={styles.themeRow}>
            <ThemeSwitcher />
          </div>
        </div>
      </section>

      {/* ── Identity ── */}
      <section className={styles.section}>
        <p className={styles.sectionLabel}>identity</p>
        <div className={styles.card}>
          {address && (
            <>
              <div className={styles.row}>
                <span className={styles.rowLabel}>address</span>
                <div className={styles.rowRight}>
                  <span className={styles.rowMono}>{truncate(address)}</span>
                  <button
                    className={`${styles.copyBtn} ${copied ? styles.copyBtnDone : ''}`}
                    onClick={copyAddress}
                  >
                    {copied ? '✓' : '⎘'}
                  </button>
                </div>
              </div>
              <div className={styles.divider} />
            </>
          )}
          <div className={styles.row}>
            <span className={styles.rowLabel}>login</span>
            <span className={styles.rowMono}>{getLoginMethod(user)}</span>
          </div>
          <div className={styles.divider} />
          <div className={styles.row}>
            <span className={styles.rowLabel}>encryption</span>
            <span className={styles.rowMono}>ECDH · on-device</span>
          </div>
        </div>
      </section>

      {/* ── Wallet ── */}
      <section className={styles.section}>
        <p className={styles.sectionLabel}>wallet</p>
        <div className={styles.card}>
          <div className={styles.row}>
            <span className={styles.rowLabel}>eth</span>
            <span className={styles.rowMono}>{ethBalance ?? '—'}</span>
          </div>
          <div className={styles.divider} />
          <div className={styles.row}>
            <span className={styles.rowLabel}>network</span>
            <span className={styles.rowMono}>ethereum sepolia</span>
          </div>
          <div className={styles.divider} />
          <div className={styles.walletActions}>
            <button
              className={`${styles.walletBtn} ${showQR ? styles.walletBtnActive : ''}`}
              onClick={() => setShowQR((v) => !v)}
            >
              {showQR ? 'hide qr' : 'receive'}
            </button>
            <button className={styles.walletBtn} onClick={onShowSend}>
              send
            </button>
          </div>
        </div>

        {showQR && address && (
          <div className={styles.qrWrap}>
            <p className={styles.qrAcceptsLabel}>this address accepts</p>
            <div className={styles.qrBadges}>
              {TOKENS.map((token) => (
                <div
                  key={token.symbol}
                  className={styles.qrBadge}
                  style={{ background: token.iconColor + '22', color: token.iconColor }}
                >
                  <span className={styles.badgeIcon}>{token.iconLetters}</span>
                  <span className={styles.badgeSymbol}>{token.symbol}</span>
                </div>
              ))}
            </div>
            <QRCodeSVG
              value={address}
              size={150}
              bgColor="transparent"
              fgColor="var(--text)"
              level="M"
            />
            <p className={styles.qrAddress}>{address}</p>
            <p className={styles.qrNote}>
              all on ethereum sepolia — sending other networks here will result in loss of funds
            </p>
          </div>
        )}
      </section>

      {/* ── Security ── */}
      <section className={styles.section}>
        <p className={styles.sectionLabel}>security</p>
        <div className={styles.card}>
          <p className={styles.securityText}>
            your keys are sharded across your device, Privy servers, and your login method
            — no single point of failure
          </p>
        </div>
      </section>

      {/* ── About ── */}
      <section className={styles.section}>
        <p className={styles.sectionLabel}>about</p>
        <div className={styles.card}>
          <div className={styles.row}>
            <span className={styles.rowLabel}>version</span>
            <span className={styles.rowMono}>0.1.0-alpha</span>
          </div>
          <div className={styles.divider} />
          <div className={styles.row}>
            <span className={styles.rowLabel}>protocol</span>
            <span className={styles.rowMono}>XMTP v2</span>
          </div>
          <div className={styles.divider} />
          <div className={styles.row}>
            <span className={styles.rowLabel}>license</span>
            <span className={styles.rowMono}>MIT</span>
          </div>
        </div>
      </section>

      {/* ── Logout ── */}
      <section className={styles.section}>
        <button className={styles.logoutBtn} onClick={handleLogoutClick}>
          log out
        </button>
      </section>
    </div>
  )
}
