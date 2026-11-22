import { type MouseEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { beginTunerFromTap } from '@/lib/tuner-session'

type TunerLinkProps = {
  to?: string
  className?: string
  children: ReactNode
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void
  'aria-current'?: 'page'
  'data-tab'?: string
  'data-duo-rail-tab'?: string
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
  to,
  className,
  children,
  onClick,
  ...rest
}: TunerLinkProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const href = to ?? `/tuner${location.search}`

  return (
    <Link
      to={href}
      className={className}
      {...rest}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented || modifiedClick(event)) return
        event.preventDefault()
        navigate(href)
        beginTunerFromTap()
      }}
    >
      {children}
    </Link>
  )
}
