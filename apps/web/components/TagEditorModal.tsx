'use client'

import { useState, useRef, useEffect } from 'react'
import { getTags, addTag, removeTag } from '@/lib/tags'
import { TagPill } from './TagPill'
import styles from './TagEditorModal.module.css'

interface Props {
  address: string
  onClose: () => void
  onTagsChange: () => void
}

export function TagEditorModal({ address, onClose, onTagsChange }: Props) {
  const [tags, setTags] = useState(() => getTags(address))
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleAdd() {
    const tag = inputValue.trim()
    if (!tag) return
    addTag(address, tag)
    setTags(getTags(address))
    setInputValue('')
    onTagsChange()
  }

  function handleRemove(tag: string) {
    removeTag(address, tag)
    setTags(getTags(address))
    onTagsChange()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd() }
    if (e.key === 'Escape') onClose()
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div>
            <p className={styles.headerLabel}>tags</p>
            <p className={styles.headerAddr}>{address}</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="close">×</button>
        </div>

        <div className={styles.body}>
          {tags.length > 0 && (
            <div className={styles.tagSection}>
              <p className={styles.sectionLabel}>your tags</p>
              <div className={styles.pillRow}>
                {tags.map((tag) => (
                  <TagPill key={tag} tag={tag} onRemove={() => handleRemove(tag)} />
                ))}
              </div>
            </div>
          )}

          <div className={styles.tagSection}>
            <p className={styles.sectionLabel}>add tag</p>
            <div className={styles.inputRow}>
              <input
                ref={inputRef}
                className={styles.tagInput}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="whale, degen, friend…"
                autoComplete="off"
                spellCheck={false}
                maxLength={40}
              />
              <button
                className={styles.addBtn}
                onClick={handleAdd}
                disabled={!inputValue.trim()}
                type="button"
              >
                add
              </button>
            </div>
          </div>
        </div>

        <p className={styles.footer}>
          private to you — tags are stored on your device, the other wallet never sees them
        </p>
      </div>
    </div>
  )
}
