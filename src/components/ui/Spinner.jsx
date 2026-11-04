export function Spinner({ size = 'md', className = '' }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' }
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-2 border-pitch-600 border-t-gold-400 ${sizes[size]} ${className}`}
    />
  )
}

export function FullPageSpinner() {
  return (
    <div className="flex h-screen items-center justify-center bg-pitch-950">
      <Spinner size="lg" />
    </div>
  )
}
