'use client'

import { useState, useEffect, useRef } from 'react'
import styles from './ThemeSwitcher.module.css'

type Theme = 'paper' | 'eclipse' | 'white' | 'black'

const THEMES: { id: Theme; label: string; bg: string; dot: string }[] = [
  { id: 'paper',   label: 'PAPER',   bg: '#F7F5F0', dot: '#2D5A45' },
  { id: 'eclipse', label: 'ECLIPSE', bg: '#101412', dot: '#7DBA8C' },
  { id: 'white',   label: 'WHITE',   bg: '#FFFFFF', dot: '#2D5A45' },
  { id: 'black',   label: 'BLACK',   bg: '#000000', dot: '#7DBA8C' },
]

export function ThemeSwitcher() {
  const [current, setCurrent] = useState<Theme>('paper')
  const [open, setOpen]       = useState(false)
  const wrapRef               = useRef<HTMLDivElement>(null)

  // Sync with what ThemeScript already applied
  useEffect(() => {
    const saved = localStorage.getItem('quiet-theme') as Theme | null
    if (saved && THEMES.some(t => t.id === saved)) setCurrent(saved)
  }, [])

  // Close on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  function select(t: Theme) {
    setCurrent(t)
    document.documentElement.setAttribute('data-theme', t)
    localStorage.setItem('quiet-theme', t)
    setOpen(false)
  }

  const active = THEMES.find(t => t.id === current) ?? THEMES[0]

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        className={styles.trigger}
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span
          className={styles.triggerSwatch}
          style={{ background: active.bg }}
        />
        {active.label}
        <span className={styles.caret}>▾</span>
      </button>

      {open && (
        <div className={styles.menu} role="listbox">
          {THEMES.map(t => (
            <button
              key={t.id}
              className={`${styles.option} ${t.id === current ? styles.optionActive : ''}`}
              onClick={() => select(t.id)}
              role="option"
              aria-selected={t.id === current}
            >
              <span className={styles.swatch} style={{ background: t.bg }}>
                <span className={styles.swatchDot} style={{ background: t.dot }} />
              </span>
              {t.label}
              {t.id === current && <span className={styles.check}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
