import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Fire on pointerdown so sound/action is not waiting for click or a 300ms tap delay. */
export function activateOnPointer(handler: () => void) {
  return {
    onPointerDown: (event: { button: number; preventDefault: () => void }) => {
      if (event.button !== 0) return
      event.preventDefault()
      handler()
    },
    onClick: (event: { detail: number; preventDefault: () => void }) => {
      if (event.detail === 0) handler()
      else event.preventDefault()
    },
  }
}
