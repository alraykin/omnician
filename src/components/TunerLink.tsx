import { type MouseEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { beginTunerFromTap } from '@/lib/tuner-session'

type TunerLinkProps = {
  className?: string
  children: ReactNode
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void
  'aria-current'?: 'page'
  'data-tab'?: string
  'data-home-tool'?: string
}

function modifiedClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  )
}

export function TunerLink({
  className,
  children,
  onClick,
  ...rest
}: TunerLinkProps) {
  const navigate = useNavigate()

  return (
    <Link
      to="/tuner"
      className={className}
      {...rest}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented || modifiedClick(event)) return
        event.preventDefault()
        navigate('/tuner')
        beginTunerFromTap()
      }}
    >
      {children}
    </Link>
  )
}
