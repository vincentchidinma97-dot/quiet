'use client'

import { useState, useEffect } from 'react'
import { useLoginWithOAuth, useLoginWithPasskey, useLoginWithEmail } from '@privy-io/react-auth'
import { useAppKit } from '@reown/appkit/react'
import { REOWN_PROJECT_ID } from '@/lib/reownConfig'
import styles from './LoginModal.module.css'

interface Props {
  onClose: () => void
}

type EmailStep = 'idle' | 'sending' | 'code' | 'verifying'

export function LoginModal({ onClose }: Props) {
  const { initOAuth } = useLoginWithOAuth()
  const { loginWithPasskey } = useLoginWithPasskey()
  const { sendCode, loginWithCode } = useLoginWithEmail()
  const { open: openAppKit } = useAppKit()

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [emailStep, setEmailStep] = useState<EmailStep>('idle')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passkeyError, setPasskeyError] = useState<string | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [passkeyLoading, setPasskeyLoading] = useState(false)

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function handleGoogle() {
    setGoogleLoading(true)
    try {
      await initOAuth({ provider: 'google' })
    } catch {
      setGoogleLoading(false)
    }
  }

  async function handlePasskey() {
    setPasskeyError(null)
    setPasskeyLoading(true)
    try {
      await loginWithPasskey()
    } catch (err) {
      setPasskeyError(err instanceof Error ? err.message : 'passkey unavailable on this device')
    } finally {
      setPasskeyLoading(false)
    }
  }

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setEmailError(null)
    setEmailStep('sending')
    try {
      await sendCode({ email: email.trim() })
      setEmailStep('code')
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'failed to send code')
      setEmailStep('idle')
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setEmailError(null)
    setEmailStep('verifying')
    try {
      await loginWithCode({ code: code.trim() })
      // Success — Privy state updates; parent useEffect will redirect to /app
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'invalid code')
      setEmailStep('code')
    }
  }

  function handleConnectWallet() {
    if (!REOWN_PROJECT_ID) {
      alert('WalletConnect project ID not configured — check NEXT_PUBLIC_REOWN_PROJECT_ID in .env.local')
      return
    }
    openAppKit()
    onClose()
  }

  return (
    <div className={styles.backdrop} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.wordmark}>quiet<span className={styles.dot}>.</span></span>
          <button className={styles.closeBtn} onClick={onClose} aria-label="close">×</button>
        </div>

        {/* ── Easy mode (Privy embedded wallet) ── */}
        <div className={styles.section}>
          <div className={styles.sectionMeta}>
            <p className={styles.sectionTitle}>new to crypto</p>
            <p className={styles.sectionSub}>we create a wallet for you</p>
          </div>

          <div className={styles.btnStack}>
            {/* Google */}
            <button
              className={styles.authBtn}
              onClick={handleGoogle}
              disabled={googleLoading || passkeyLoading}
            >
              <svg className={styles.btnIcon} viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {googleLoading ? 'redirecting…' : 'continue with Google'}
            </button>

            {/* Passkey */}
            <button
              className={styles.authBtn}
              onClick={handlePasskey}
              disabled={googleLoading || passkeyLoading}
            >
              <svg className={styles.btnIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.864 4.243A7.5 7.5 0 0 1 19.5 10.5c0 2.92-.556 5.709-1.568 8.268M5.742 6.364A7.459 7.459 0 0 0 4.5 10.5a7.464 7.464 0 0 1-1.15 3.993m1.989 3.559A11.209 11.209 0 0 0 8.25 10.5a3.75 3.75 0 1 1 7.5 0c0 .527-.021 1.049-.064 1.565M12 10.5a14.94 14.94 0 0 1-3.6 9.75m6.633-4.596a18.666 18.666 0 0 1-2.485 5.33" />
              </svg>
              {passkeyLoading ? 'authenticating…' : 'continue with passkey'}
              <span className={styles.hint}>Face ID · Touch ID</span>
            </button>
            {passkeyError && <p className={styles.errorMsg}>{passkeyError}</p>}

            {/* Email */}
            {emailStep === 'idle' || emailStep === 'sending' ? (
              <form className={styles.emailForm} onSubmit={handleSendCode}>
                <div className={styles.emailRow}>
                  <input
                    className={styles.emailInput}
                    type="email"
                    placeholder="email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    disabled={emailStep === 'sending'}
                  />
                  <button
                    className={styles.emailBtn}
                    type="submit"
                    disabled={emailStep === 'sending' || !email.trim()}
                  >
                    {emailStep === 'sending' ? '…' : '→'}
                  </button>
                </div>
                {emailError && <p className={styles.errorMsg}>{emailError}</p>}
              </form>
            ) : (
              <form className={styles.emailForm} onSubmit={handleVerifyCode}>
                <p className={styles.codeSentMsg}>code sent to {email}</p>
                <div className={styles.emailRow}>
                  <input
                    className={styles.emailInput}
                    type="text"
                    placeholder="6-digit code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                    autoFocus
                    inputMode="numeric"
                    maxLength={6}
                    disabled={emailStep === 'verifying'}
                  />
                  <button
                    className={styles.emailBtn}
                    type="submit"
                    disabled={emailStep === 'verifying' || !code.trim()}
                  >
                    {emailStep === 'verifying' ? '…' : '→'}
                  </button>
                </div>
                {emailError && <p className={styles.errorMsg}>{emailError}</p>}
                <button
                  type="button"
                  className={styles.resendBtn}
                  onClick={() => { setEmailStep('idle'); setCode(''); setEmailError(null) }}
                >
                  ← different email
                </button>
              </form>
            )}
          </div>
        </div>

        {/* ── Divider ── */}
        <div className={styles.divider}>
          <span className={styles.dividerLine} />
          <span className={styles.dividerText}>or</span>
          <span className={styles.dividerLine} />
        </div>

        {/* ── External wallet ── */}
        <div className={styles.section}>
          <div className={styles.sectionMeta}>
            <p className={styles.sectionTitle}>already have a wallet</p>
            <p className={styles.sectionSub}>MetaMask, Rabby, Phantom, Coinbase</p>
          </div>

          <button className={`${styles.authBtn} ${styles.walletBtn}`} onClick={handleConnectWallet}>
            <svg className={styles.btnIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3" />
            </svg>
            connect wallet
          </button>
        </div>

        <p className={styles.footer}>
          end-to-end encrypted · your keys, your data
        </p>
      </div>
    </div>
  )
}
