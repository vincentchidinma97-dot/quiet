'use client'

import { useState, useEffect } from 'react'
import { useRouter }           from 'next/navigation'
import { usePrivy }            from '@privy-io/react-auth'
import { motion, AnimatePresence } from 'framer-motion'
import styles from './page.module.css'

const ease = [0.22, 1, 0.36, 1] as const

const fadeUp = {
  hidden:  { opacity: 0, y: 28 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.11, duration: 0.65, ease },
  }),
}

export default function LandingPage() {
  const router = useRouter()
  const { ready, authenticated, login } = usePrivy()
  const [email, setEmail]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Auto-redirect already-logged-in users
  useEffect(() => {
    if (ready && authenticated) router.push('/app')
  }, [ready, authenticated, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || loading || submitted) return
    setLoading(true)
    await new Promise((r) => setTimeout(r, 700))
    console.log('[quiet] waitlist signup:', email)
    setSubmitted(true)
    setLoading(false)
  }

  return (
    <div className={styles.page}>
      {/* ── Nav ── */}
      <nav className={styles.nav}>
        <span className={styles.wordmark}>
          quiet<span className={styles.wordmarkDot}>.</span>
        </span>

        <button
          className={styles.enterBtn}
          onClick={async () => { await login(); router.push('/app') }}
          disabled={!ready}
        >
          enter quiet
        </button>
      </nav>

      {/* ── Hero ── */}
      <main className={styles.hero}>
        <motion.p
          className={styles.eyebrow}
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
        >
          correspondence protocol
        </motion.p>

        <motion.h1
          className={styles.headline}
          custom={1}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
        >
          the market is loud.
          <span className={styles.headlineAccent}>your edge isn't.</span>
        </motion.h1>

        <motion.p
          className={styles.subtext}
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
        >
          encrypted correspondence between wallets. live token intelligence in
          every thread. no accounts, no email, no noise.
        </motion.p>

        <motion.div
          className={styles.formWrap}
          custom={3}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
        >
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <input
              className={styles.emailInput}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your email"
              disabled={submitted}
              autoComplete="email"
              required
            />
            <button
              className={styles.submitBtn}
              type="submit"
              disabled={loading || submitted}
            >
              {loading ? 'sending…' : submitted ? "you're in ✓" : 'request access'}
            </button>
          </form>

          <AnimatePresence>
            {submitted && (
              <motion.p
                className={styles.successMsg}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease }}
              >
                you're on the list — we'll be in touch.
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      </main>

      {/* ── Footer stats ── */}
      <motion.footer
        className={styles.footer}
        custom={4}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
      >
        <span className={styles.stat}>
          <span className={styles.statValue}>2,847</span>
          &nbsp;on the list
        </span>
        <span className={styles.divider} aria-hidden="true" />
        <span className={styles.stat}>
          <span className={styles.statValue}>zero</span>
          &nbsp;data kept
        </span>
        <span className={styles.divider} aria-hidden="true" />
        <span className={styles.stat}>
          <span className={styles.statValue}>e2e</span>
          &nbsp;encrypted
        </span>
      </motion.footer>
    </div>
  )
}
