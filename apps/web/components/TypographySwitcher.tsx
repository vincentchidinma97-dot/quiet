'use client'

import { useState, useEffect } from 'react'
import styles from './TypographySwitcher.module.css'

type Typography = 'editorial' | 'modern' | 'humanist'

const OPTIONS: { id: Typography; label: string; fontVar: string; desc: string }[] = [
  { id: 'editorial', label: 'EDITORIAL', fontVar: 'var(--font-fraunces)', desc: 'Fraunces' },
  { id: 'modern',    label: 'MODERN',    fontVar: 'var(--font-geist)',    desc: 'Geist' },
  { id: 'humanist',  label: 'HUMANIST',  fontVar: 'var(--font-manrope)',  desc: 'Manrope' },
]

export function TypographySwitcher() {
  const [current, setCurrent] = useState<Typography>('editorial')

  useEffect(() => {
    const saved = localStorage.getItem('quiet-typography') as Typography | null
    if (saved && OPTIONS.some(o => o.id === saved)) setCurrent(saved)
  }, [])

  function select(id: Typography) {
    setCurrent(id)
    document.documentElement.setAttribute('data-typography', id)
    localStorage.setItem('quiet-typography', id)
  }

  return (
    <div className={styles.grid}>
      {OPTIONS.map(opt => (
        <button
          key={opt.id}
          className={`${styles.option} ${opt.id === current ? styles.optionActive : ''}`}
          onClick={() => select(opt.id)}
          type="button"
        >
          <span className={styles.optionLabel}>{opt.label}</span>
          <span className={styles.optionPreview} style={{ fontFamily: opt.fontVar }}>
            quiet.
          </span>
          <span className={styles.optionDesc}>{opt.desc}</span>
        </button>
      ))}
    </div>
  )
}
