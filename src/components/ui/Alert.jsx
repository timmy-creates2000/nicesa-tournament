import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useState } from 'react'

const variants = {
  success: {
    wrapper: 'bg-pitch-800/80 border-pitch-600/60 text-pitch-100',
    icon: <CheckCircle className="h-5 w-5 text-green-400 shrink-0" aria-hidden />,
  },
  error: {
    wrapper: 'bg-red-950/60 border-red-800/60 text-red-100',
    icon: <XCircle className="h-5 w-5 text-red-400 shrink-0" aria-hidden />,
  },
  warning: {
    wrapper: 'bg-yellow-950/60 border-yellow-800/60 text-yellow-100',
    icon: <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0" aria-hidden />,
  },
  info: {
    wrapper: 'bg-blue-950/60 border-blue-800/60 text-blue-100',
    icon: <Info className="h-5 w-5 text-blue-400 shrink-0" aria-hidden />,
  },
}

export function Alert({ variant = 'info', title, children, dismissible = false, className = '' }) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  const v = variants[variant]

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-xl border p-4 ${v.wrapper} ${className}`}
    >
      {v.icon}
      <div className="flex-1 text-sm">
        {title && <p className="font-semibold mb-0.5">{title}</p>}
        <div>{children}</div>
      </div>
      {dismissible && (
        <button
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="text-current opacity-60 hover:opacity-100 transition-opacity"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
