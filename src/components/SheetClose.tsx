import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
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
      data-sheet-close-side="left"
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

/** Close control is always the first header item so it never sits under a Duo camera/status cutout. */
export function SheetHeader({
  titleId,
  title,
  description,
  onClose,
  closeLabel,
  trailing,
  className,
  titleClassName,
}: {
  titleId?: string
  title: ReactNode
  description?: ReactNode
  onClose?: () => void
  closeLabel?: string
  trailing?: ReactNode
  className?: string
  titleClassName?: string
}) {
  return (
    <div data-sheet-header className={cn('flex shrink-0 items-start gap-2', className)}>
      {onClose ? <SheetCloseX label={closeLabel ?? 'Close'} onClose={onClose} className="mt-0.5" /> : null}
      <div className="min-w-0 flex-1">
        <h2
          id={titleId}
          className={cn(
            'text-wrap break-words font-bold tracking-tight text-white',
            titleClassName ?? 'text-xl',
          )}
        >
          {title}
        </h2>
        {description}
      </div>
      {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
    </div>
  )
}

type OverlayHostProps = HTMLAttributes<HTMLDivElement> & {
  stretch?: boolean
  flush?: boolean
}

/**
 * Full-screen overlay root. CSS pins it to the laptop top half and pads Duo
 * camera / status-cluster safe areas. Portals to `document.body` stay in this box.
 */
export const OverlayHost = forwardRef<HTMLDivElement, OverlayHostProps>(function OverlayHost(
  { children, className, stretch = false, flush = false, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      data-overlay-host="1"
      data-overlay-stretch={stretch ? '1' : undefined}
      data-overlay-flush={flush ? '1' : undefined}
      className={cn(
        'fixed inset-0 flex min-h-0 justify-center',
        flush ? 'p-0' : 'overlay-host',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
})
