'use client'

import { useState } from 'react'
import type { Token } from '@/lib/tokens'
import type { TokenBalance } from '@/lib/hooks/useTokenBalances'
import styles from './SendModal.module.css'

type Step = 'asset' | 'amount' | 'review' | 'pending' | 'done'

interface Props {
  isOpen: boolean
  onClose: () => void
  balances: TokenBalance[]
  onEstimateGas: (token: Token, toAddress: string, amount: string) => Promise<string>
  onSend: (token: Token, toAddress: string, amount: string) => Promise<string>
}

export function SendModal({ isOpen, onClose, balances, onEstimateGas, onSend }: Props) {
  const [step, setStep] = useState<Step>('asset')
  const [selectedToken, setSelectedToken] = useState<Token | null>(null)
  const [toAddress, setToAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [addressError, setAddressError] = useState<string | null>(null)
  const [amountError, setAmountError] = useState<string | null>(null)
  const [gasEstimate, setGasEstimate] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [estimating, setEstimating] = useState(false)

  function reset() {
    setStep('asset')
    setSelectedToken(null)
    setToAddress('')
    setAmount('')
    setAddressError(null)
    setAmountError(null)
    setGasEstimate(null)
    setTxHash(null)
    setSendError(null)
    setEstimating(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function selectToken(token: Token) {
    setSelectedToken(token)
    setStep('amount')
  }

  function handleMax() {
    if (!selectedToken) return
    const tb = balances.find((b) => b.token.symbol === selectedToken.symbol)
    if (tb?.balance) setAmount(tb.balance)
  }

  function validateAddress(): boolean {
    if (!toAddress.startsWith('0x') || toAddress.length !== 42) {
      setAddressError('enter a valid 0x address')
      return false
    }
    setAddressError(null)
    return true
  }

  function validateAmount(): boolean {
    const n = parseFloat(amount)
    if (!amount || isNaN(n) || n <= 0) {
      setAmountError('enter a valid amount')
      return false
    }
    const tb = balances.find((b) => b.token.symbol === selectedToken?.symbol)
    if (tb?.balance && n > parseFloat(tb.balance)) {
      setAmountError('insufficient balance')
      return false
    }
    setAmountError(null)
    return true
  }

  async function handleReview(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedToken) return
    if (!validateAddress() || !validateAmount()) return
    setEstimating(true)
    try {
      const estimate = await onEstimateGas(selectedToken, toAddress, amount)
      setGasEstimate(estimate)
    } catch {
      setGasEstimate('unknown')
    } finally {
      setEstimating(false)
    }
    setStep('review')
  }

  async function handleConfirm() {
    if (!selectedToken) return
    setStep('pending')
    setSendError(null)
    try {
      const hash = await onSend(selectedToken, toAddress, amount)
      setTxHash(hash)
      setStep('done')
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'transaction failed')
      setStep('review')
    }
  }

  if (!isOpen) return null

  const selectedBalance = selectedToken
    ? (balances.find((b) => b.token.symbol === selectedToken.symbol)?.balance ?? '0.0000')
    : null

  const titleMap: Record<Step, string> = {
    asset: 'send',
    amount: `send ${selectedToken?.symbol ?? ''}`,
    review: 'review',
    pending: 'sending…',
    done: 'sent',
  }

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{titleMap[step]}</span>
          {step !== 'pending' && (
            <button className={styles.closeBtn} onClick={handleClose}>✕</button>
          )}
        </div>

        {/* ── Step 1: asset picker ── */}
        {step === 'asset' && (
          <div className={styles.assetList}>
            {balances.map(({ token, balance }) => {
              const isZero = !balance || parseFloat(balance) === 0
              return (
                <button
                  key={token.symbol}
                  className={`${styles.assetRow} ${isZero ? styles.assetRowMuted : ''}`}
                  onClick={() => selectToken(token)}
                >
                  <div
                    className={styles.tokenIcon}
                    style={{ background: token.iconColor + '22', color: token.iconColor }}
                  >
                    {token.iconLetters}
                  </div>
                  <div className={styles.tokenMeta}>
                    <span className={styles.tokenSymbol}>{token.symbol}</span>
                    <span className={styles.tokenName}>{token.name}</span>
                  </div>
                  <span className={styles.tokenBalance}>{balance ?? '—'}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* ── Step 2: amount + address ── */}
        {step === 'amount' && selectedToken && (
          <form className={styles.amountForm} onSubmit={handleReview}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>to</label>
              <input
                className={`${styles.formInput} ${addressError ? styles.inputError : ''}`}
                type="text"
                placeholder="0x address"
                value={toAddress}
                onChange={(e) => { setToAddress(e.target.value); setAddressError(null) }}
                spellCheck={false}
                autoComplete="off"
                autoFocus
              />
              {addressError && <span className={styles.fieldError}>{addressError}</span>}
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>amount</label>
              <div className={styles.amountRow}>
                <input
                  className={`${styles.formInput} ${styles.amountInput} ${amountError ? styles.inputError : ''}`}
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); setAmountError(null) }}
                  autoComplete="off"
                />
                <button type="button" className={styles.maxBtn} onClick={handleMax}>
                  max
                </button>
              </div>
              <span className={styles.balanceHint}>
                balance: {selectedBalance} {selectedToken.symbol}
              </span>
              {amountError && <span className={styles.fieldError}>{amountError}</span>}
            </div>

            <div className={styles.formActions}>
              <button type="button" className={styles.backBtn} onClick={() => setStep('asset')}>
                back
              </button>
              <button type="submit" className={styles.nextBtn} disabled={estimating}>
                {estimating ? 'estimating…' : 'review →'}
              </button>
            </div>
          </form>
        )}

        {/* ── Step 3: review ── */}
        {step === 'review' && selectedToken && (
          <div className={styles.reviewPane}>
            <div className={styles.reviewRow}>
              <span className={styles.reviewLabel}>sending</span>
              <span className={styles.reviewValue}>
                {amount} {selectedToken.symbol}
              </span>
            </div>
            <div className={styles.reviewRow}>
              <span className={styles.reviewLabel}>to</span>
              <span className={`${styles.reviewValue} ${styles.reviewAddr}`}>{toAddress}</span>
            </div>
            <div className={styles.reviewRow}>
              <span className={styles.reviewLabel}>network fee</span>
              <span className={styles.reviewValue}>{gasEstimate ?? '—'} ETH</span>
            </div>
            {sendError && <p className={styles.sendError}>{sendError}</p>}
            <div className={styles.formActions}>
              <button className={styles.backBtn} onClick={() => setStep('amount')}>
                back
              </button>
              <button className={styles.confirmBtn} onClick={handleConfirm}>
                confirm
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: pending ── */}
        {step === 'pending' && (
          <div className={styles.pendingPane}>
            <div className={styles.pendingDot} />
            <p className={styles.pendingText}>broadcasting transaction…</p>
          </div>
        )}

        {/* ── Step 5: done ── */}
        {step === 'done' && (
          <div className={styles.donePane}>
            <span className={styles.doneCheck}>✓</span>
            <p className={styles.doneText}>transaction sent</p>
            {txHash && (
              <p className={styles.doneHash}>
                {txHash.slice(0, 10)}…{txHash.slice(-8)}
              </p>
            )}
            <button className={styles.doneBtn} onClick={handleClose}>
              close
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
