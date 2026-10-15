import { X } from 'lucide-react'

import { activateOnPointer, cn } from '@/lib/utils'

export function SheetBackdrop({
  label,
  onClose,
}: {
  label: string
  onClose: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      data-sheet-dismiss
      className="absolute inset-0 cursor-default"
      {...activateOnPointer(onClose)}
    />
  )
}

export function SheetCloseX({
  label,
  onClose,
  className,
}: {
  label: string
  onClose: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      data-sheet-close
      {...activateOnPointer(onClose)}
      className={cn(
        'flex size-9 shrink-0 items-center justify-center rounded-full text-slate-300 hover:bg-white/8 hover:text-white',
        className,
      )}
    >
      <X className="size-4" />
    </button>
  )
}
