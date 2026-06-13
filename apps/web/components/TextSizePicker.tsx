'use client'

import { useState, useEffect } from 'react'
import styles from './TextSizePicker.module.css'

type TextScale = '0.9' | '1' | '1.15'

const OPTIONS: { value: TextScale; label: string }[] = [
  { value: '0.9',  label: 'S' },
  { value: '1',    label: 'M' },
  { value: '1.15', label: 'L' },
]

export function TextSizePicker() {
  const [current, setCurrent] = useState<TextScale>('1')

  useEffect(() => {
    const saved = localStorage.getItem('quiet-text-scale') as TextScale | null
    if (saved && OPTIONS.some(o => o.value === saved)) setCurrent(saved)
  }, [])

  function select(value: TextScale) {
    setCurrent(value)
    document.documentElement.style.setProperty('--text-scale', value)
    localStorage.setItem('quiet-text-scale', value)
  }

  return (
    <div className={styles.group}>
      {OPTIONS.map(opt => (
        <button
          key={opt.value}
          className={`${styles.btn} ${opt.value === current ? styles.btnActive : ''}`}
          onClick={() => select(opt.value)}
          type="button"
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
