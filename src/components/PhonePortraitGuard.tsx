import { useEffect } from 'react'
import { createPortal } from 'react-dom'

import { useDrumEditorOpen, usePhoneDrumsSurface, usePhoneViewport, usePortraitViewport } from '@/hooks/usePhoneViewport'
import { tryLockPortrait } from '@/lib/phone-viewport'

/** Phones stay portrait except the landscape drum editor. Desktop and tablets are left alone. */
export function PhonePortraitGuard() {
  const phone = usePhoneViewport()
  const portrait = usePortraitViewport()
  const editorOpen = useDrumEditorOpen()
  const drumsPage = usePhoneDrumsSurface()
  const blockLandscape = phone && !portrait && !editorOpen && !drumsPage

  useEffect(() => {
    if (!phone || editorOpen || drumsPage) return
    void tryLockPortrait()
  }, [phone, editorOpen, drumsPage])

  useEffect(() => {
    const html = document.documentElement
    if (!blockLandscape) {
      html.classList.remove('phone-rotate-back')
      return
    }
    html.classList.add('phone-rotate-back')
    return () => html.classList.remove('phone-rotate-back')
  }, [blockLandscape])

  if (!blockLandscape || typeof document === 'undefined') return null

  return createPortal(
    <div
      data-rotate-back
      data-phone-portrait-guard
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-[#0B0F1A] px-6 text-center text-white"
      style={{
        paddingTop: 'max(1rem, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <RotateBackArt />
      <h1 className="mt-6 text-[1.65rem] font-bold tracking-tight">Rotate your phone back</h1>
      <p className="mt-2 max-w-[22rem] text-[0.92rem] leading-6 text-slate-400">
        Home, Tuner, Click, and Settings stay in portrait. Turn the phone upright to keep going.
      </p>
    </div>,
    document.body,
  )
}

function RotateBackArt() {
  return (
    <svg data-rotate-back-art viewBox="0 0 180 120" className="h-24 w-40" aria-hidden>
      <rect x="72" y="18" width="36" height="68" rx="8" fill="none" stroke="#A855F7" strokeWidth="3" />
      <rect x="84" y="24" width="12" height="4" rx="1.5" fill="#C084FC" />
      <circle cx="90" cy="76" r="2.4" fill="#C084FC" />
      <path d="M48 70c-4-16 6-34 24-40" fill="none" stroke="#E9D5FF" strokeWidth="2" strokeLinecap="round" />
      <path d="M70 28l4 12-12-2" fill="#E9D5FF" />
    </svg>
  )
}
