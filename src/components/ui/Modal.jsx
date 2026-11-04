import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export function Modal({ open, onClose, title, children, size = 'md' }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [open])

  // Close on backdrop click
  function handleClick(e) {
    const rect = dialogRef.current?.getBoundingClientRect()
    if (rect && (
      e.clientX < rect.left || e.clientX > rect.right ||
      e.clientY < rect.top  || e.clientY > rect.bottom
    )) {
      onClose()
    }
  }

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleClick}
      onClose={onClose}
      className={`
        w-full ${sizes[size]} rounded-2xl border border-pitch-700/50
        bg-pitch-900 text-white shadow-2xl shadow-black/60
        backdrop:bg-black/70 backdrop:backdrop-blur-sm
        open:animate-slide-up p-0
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-pitch-700/50">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <button
          onClick={onClose}
          aria-label="Close modal"
          className="text-pitch-400 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      {/* Body */}
      <div className="px-6 py-5">{children}</div>
    </dialog>
  )
}
