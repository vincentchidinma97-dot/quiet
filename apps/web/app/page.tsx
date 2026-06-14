'use client'

import { useState, useEffect } from 'react'
import { useRouter }           from 'next/navigation'
import { usePrivy }            from '@privy-io/react-auth'
import { useAccount }          from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import { LoginModal }          from '@/components/LoginModal'
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
  const { ready, authenticated } = usePrivy()
  const { isConnected: wcConnected } = useAccount()
  const [showLogin, setShowLogin] = useState(false)

  useEffect(() => {
    if ((ready && authenticated) || wcConnected) router.push('/app')
  }, [ready, authenticated, wcConnected, router])

  return (
    <>
      <div className={styles.page}>
        {/* ── Nav ── */}
        <nav className={styles.nav}>
          <span className={styles.wordmark}>
            quiet<span className={styles.wordmarkDot}>.</span>
          </span>

          <button
            className={styles.enterBtn}
            onClick={() => setShowLogin(true)}
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
            custom={3}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
          >
            <button
              className={styles.primaryCta}
              onClick={() => setShowLogin(true)}
              disabled={!ready}
            >
              enter quiet
            </button>
          </motion.div>
        </main>

        {/* ── Footer ── */}
        <motion.footer
          className={styles.footer}
          custom={4}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
        >
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

      {/* ── Login modal ── */}
      <AnimatePresence>
        {showLogin && (
          <LoginModal onClose={() => setShowLogin(false)} />
        )}
      </AnimatePresence>
    </>
  )
}
