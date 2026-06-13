'use client'

import styles from './TagPill.module.css'

interface Props {
  tag: string
  onRemove?: () => void
}

export function TagPill({ tag, onRemove }: Props) {
  return (
    <span className={styles.pill}>
      {tag}
      {onRemove && (
        <button
          className={styles.remove}
          onClick={(e) => { e.stopPropagation(); onRemove() }}
          type="button"
          aria-label={`remove ${tag}`}
        >
          ×
        </button>
      )}
    </span>
  )
}
