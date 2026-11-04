export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      {Icon && (
        <div className="mb-4 rounded-full bg-pitch-800 p-5">
          <Icon className="h-10 w-10 text-pitch-400" aria-hidden />
        </div>
      )}
      <h3 className="text-lg font-semibold text-pitch-100 mb-1">{title}</h3>
      {description && <p className="text-pitch-400 text-sm max-w-xs">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
