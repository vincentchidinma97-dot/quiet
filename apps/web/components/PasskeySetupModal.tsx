'use client'

import { useState } from 'react'
import { useLinkWithPasskey } from '@privy-io/react-auth'
import styles from './PasskeySetupModal.module.css'

interface Props {
  onClose: () => void
}

export function PasskeySetupModal({ onClose }: Props) {
  const { linkWithPasskey } = useLinkWithPasskey()
  const [status, setStatus] = useState<'idle' | 'linking' | 'success'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function handleSetup() {
    setError(null)
    setStatus('linking')
    try {
      await linkWithPasskey()
      setStatus('success')
      setTimeout(onClose, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'passkey setup failed — try again')
      setStatus('idle')
    }
  }

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={styles.modal}>
        {status === 'success' ? (
          <div className={styles.successState}>
            <span className={styles.successCheck}>✓</span>
            <p className={styles.successText}>passkey saved</p>
          </div>
        ) : (
          <>
            <h2 className={styles.header}>save a passkey?</h2>
            <p className={styles.body}>
              skip the login dance next time. use Face ID or Touch ID to sign in
              instantly. takes 5 seconds to set up.
            </p>
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.actions}>
              <button
                className={styles.primaryBtn}
                onClick={handleSetup}
                disabled={status === 'linking'}
              >
                {status === 'linking' ? 'setting up…' : 'set up passkey'}
              </button>
              <button
                className={styles.secondaryBtn}
                onClick={onClose}
                disabled={status === 'linking'}
              >
                skip for now
              </button>
            </div>
            <p className={styles.footer}>you can always add this later from settings.</p>
          </>
        )}
      </div>
    </div>
  )
}
