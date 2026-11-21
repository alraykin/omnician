import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/lib/utils'
import type { FoldLayout } from '@/lib/fold-mode'

export function FoldShell({
  layout,
  children,
}: {
  layout: Exclude<FoldLayout, 'off'>
  children: ReactNode
}) {
  useEffect(() => {
    const html = document.documentElement
    html.classList.add('fold-overlay')
    html.dataset.foldOverlay = layout
    return () => {
      html.classList.remove('fold-overlay')
      delete html.dataset.foldOverlay
    }
  }, [layout])

  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      data-fold-shell
      data-fold-layout={layout}
      className="fixed inset-0 z-[82] h-[100dvh] w-[100dvw] max-h-[100dvh] max-w-[100dvw] overflow-hidden bg-[#0B0F1A] text-white"
    >
      {children}
    </div>,
    document.body,
  )
}

export function FoldHalf({
  side,
  children,
  className,
  style,
}: {
  side: 'top' | 'bottom' | 'left' | 'right'
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  const box =
    side === 'top'
      ? 'absolute inset-x-0 top-0 bottom-[calc(50%+16px)]'
      : side === 'bottom'
        ? 'absolute inset-x-0 top-[calc(50%+16px)] bottom-0'
        : side === 'left'
          ? 'absolute inset-y-0 left-0 right-[calc(50%+16px)]'
          : 'absolute inset-y-0 left-[calc(50%+16px)] right-0'
  return (
    <div data-fold-half={side} className={cn(box, 'overflow-hidden', className)} style={style}>
      {children}
    </div>
  )
}

export function FoldCrease({ axis }: { axis: 'horizontal' | 'vertical' }) {
  return (
    <div
      data-fold-crease={axis}
      aria-hidden
      className={
        axis === 'horizontal'
          ? 'pointer-events-none absolute inset-x-0 top-1/2 z-20 h-8 -translate-y-1/2 bg-[#0B0F1A]'
          : 'pointer-events-none absolute inset-y-0 left-1/2 z-20 w-8 -translate-x-1/2 bg-[#0B0F1A]'
      }
    />
  )
}
