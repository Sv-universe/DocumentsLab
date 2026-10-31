import { useEffect, useRef, useState } from 'react'
import type { DocumentMeta } from '@shared/types'
import { Modal } from './Modal'

interface RenameDialogProps {
  document: DocumentMeta
  onCancel: () => void
  onSave: (name: string) => Promise<void>
}

export function RenameDialog({ document, onCancel, onSave }: RenameDialogProps) {
  const [name, setName] = useState(document.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Le nom ne peut pas être vide.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onSave(trimmed)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de renommer ce document.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Renommer le document"
      subtitle={`Format ${document.ext.toUpperCase()}`}
      size="small"
      onClose={onCancel}
      footer={
        <>
          <button className="button button-ghost" onClick={onCancel} disabled={busy}>
            Annuler
          </button>
          <button className="button button-accent" onClick={() => void submit()} disabled={busy}>
            {busy ? 'Enregistrement…' : 'Renommer'}
          </button>
        </>
      }
    >
      <label className="field">
        <span>Nom du document</span>
        <input
          ref={inputRef}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submit()
          }}
          maxLength={140}
        />
      </label>
      {error ? <p className="field-error">{error}</p> : null}
    </Modal>
  )
}
