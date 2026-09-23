import { cn } from '@/lib/utils'

type OmnicianMarkProps = {
  className?: string
  title?: string
}

export function OmnicianMark({ className, title = 'Omnician' }: OmnicianMarkProps) {
  return (
    <img
      src="/brand/omnician-mark.png"
      alt={title}
      className={cn('shrink-0 bg-transparent object-contain', className)}
    />
  )
}

export function OmnicianWordmark({ className }: { className?: string }) {
  return (
    <img
      src="/brand/omnician-wordmark.png"
      alt="Omnician"
      className={cn('block h-auto w-auto max-w-full select-none bg-transparent', className)}
    />
  )
}
