import { useEffect, useState } from 'react'
import { Download, FolderOpen, LockKeyhole, Minus, Square, Upload, X } from 'lucide-react'
import { BrandLockup } from './Logo'

interface TopBarProps {
  importing: boolean
  canExport: boolean
  onImport: () => void
  onOpen: () => void
  onExport: () => void
  onShowCredits: () => void
}

export function TopBar({
  importing,
  canExport,
  onImport,
  onOpen,
  onExport,
  onShowCredits
}: TopBarProps) {
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    let active = true
    void window.doclab.isWindowMaximized().then((value) => {
      if (active) setMaximized(value)
    })
    const unsubscribe = window.doclab.onWindowMaximizedChange(setMaximized)
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  return (
    <header className="topbar">
      <div className="topbar-actions">
        <button className="pill pill-accent" onClick={onImport} disabled={importing}>
          <Upload size={16} strokeWidth={2.2} />
          {importing ? 'Import…' : 'Importer'}
        </button>
        <button className="pill pill-accent" onClick={onOpen} disabled={importing}>
          <FolderOpen size={16} strokeWidth={2.2} />
          Ouvrir
        </button>
        <button
          className="pill pill-accent"
          onClick={onExport}
          disabled={!canExport}
          title={canExport ? 'Exporter une copie du document ouvert' : 'Ouvrez un document pour l’exporter'}
        >
          <Download size={16} strokeWidth={2.2} />
          Exporter
        </button>
      </div>

      <div className="topbar-privacy">
        <LockKeyhole size={13} strokeWidth={2.2} />
        <span>Vos fichiers restent sur cet ordinateur</span>
      </div>

      <div className="topbar-right">
        <button
          className="brand-chip"
          onClick={onShowCredits}
          title="À propos et crédits"
          aria-label="À propos de DocumentsLab"
        >
          <BrandLockup />
        </button>

        <div className="window-controls">
          <button
            className="window-button"
            aria-label="Réduire la fenêtre"
            onClick={() => window.doclab.minimizeWindow()}
          >
            <Minus size={15} />
          </button>
          <button
            className="window-button"
            aria-label={maximized ? 'Restaurer la fenêtre' : 'Agrandir la fenêtre'}
            onClick={() => window.doclab.toggleMaximizeWindow()}
          >
            {maximized ? (
              <span className="restore-glyph" aria-hidden="true" />
            ) : (
              <Square size={12} strokeWidth={2} />
            )}
          </button>
          <button
            className="window-button window-button-close"
            aria-label="Fermer la fenêtre"
            onClick={() => window.doclab.closeWindow()}
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </header>
  )
}
