import { cn } from '@/lib/utils'

type OmnicianMarkProps = {
  className?: string
  title?: string
}

export function OmnicianMark({ className, title }: OmnicianMarkProps) {
  return (
    <svg
      viewBox="0 0 80 80"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {title ? <title>{title}</title> : null}
      <circle
        cx="40"
        cy="40"
        r="30"
        stroke="currentColor"
        strokeWidth="8.5"
      />
      <g transform="rotate(-22 40 42)">
        <path
          d="M40 16.5C49.2 16.5 56.2 24.2 56.2 33.6C56.2 41.4 50.4 50.2 42.3 61.1C41.4 62.3 39.6 62.3 38.7 61.1C30.6 50.2 24.8 41.4 24.8 33.6C24.8 24.2 31.8 16.5 40 16.5Z"
          fill="currentColor"
        />
        <path
          d="M40 31.2L46.4 43.2H33.6L40 31.2Z"
          fill="#0B0F1A"
        />
      </g>
    </svg>
  )
}

export function OmnicianWordmark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center gap-0 text-white',
        className,
      )}
    >
      <OmnicianMark className="size-[1.15em] text-white" />
      <span className="-ml-[0.08em] font-extrabold tracking-[-0.045em]">
        mni
        <span className="text-[#A855F7]">cian</span>
      </span>
    </div>
  )
}
