import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { MouseEvent, PointerEvent } from 'react'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Finger travel that still counts as a tap, not a scroll or drag. */
export const TAP_SLOP_PX = 10
export const DRAG_DEADZONE_PX = 12
export const HOLD_TO_DRAG_MS = 160

/** True on phones/tablets (and any other coarse pointing device). */
export function isCoarsePointer(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
}

/** Mid-screen fader zoom + fine relative throw — touch or coarse pointer, never mouse on desktop. */
export function usesFaderZoom(pointerType: string): boolean {
  return pointerType === 'touch' || isCoarsePointer()
}

export function accumulatedScroll(node: EventTarget | null): number {
  let total = typeof window === 'undefined' ? 0 : window.scrollY
  let el: Element | null = node instanceof Element ? node : null
  while (el) {
    total += el.scrollTop
    el = el.parentElement
  }
  return total
}

/** Click beat / accent circles wrap into rows of this many so 9 sits under 1. */
export const CLICK_BEATS_PER_ROW = 8

export function chunkRows<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = []
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size) as T[])
  return rows
}

/**
 * Fire only on a genuine tap: pointerup with little movement and no page scroll.
 * Keyboard (click detail 0) still works. Does not hijack vertical swipes.
 */
export function activateOnPointer(handler: () => void) {
  return {
    onPointerDown: (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      const target = event.currentTarget
      if ('disabled' in target && (target as HTMLButtonElement).disabled) return
      const pointerId = event.pointerId
      const startX = event.clientX
      const startY = event.clientY
      const startScroll = accumulatedScroll(target)
      let cancelled = false

      const tooFar = (x: number, y: number) =>
        Math.hypot(x - startX, y - startY) > TAP_SLOP_PX ||
        Math.abs(accumulatedScroll(target) - startScroll) > 1

      const onMove = (next: globalThis.PointerEvent) => {
        if (next.pointerId !== pointerId) return
        if (tooFar(next.clientX, next.clientY)) cancelled = true
      }
      const finish = (next: globalThis.PointerEvent) => {
        if (next.pointerId !== pointerId) return
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onCancel)
        if (next.type === 'pointerup' && !cancelled && !tooFar(next.clientX, next.clientY)) {
          handler()
        }
      }
      const onUp = finish
      const onCancel = finish
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onCancel)
    },
    onClick: (event: MouseEvent<HTMLElement>) => {
      if (event.detail === 0) handler()
      else event.preventDefault()
    },
  }
}
