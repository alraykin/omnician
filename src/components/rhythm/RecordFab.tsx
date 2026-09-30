import { useEffect, useState } from 'react'

import { dismissRecordTip, loadRecordTipDismissed } from '@/lib/drum-recorder'
import { activateOnPointer } from '@/lib/utils'

export function RecordFab({
  onOpen,
  showTip,
}: {
  onOpen: () => void
  showTip?: boolean
}) {
  const [tip, setTip] = useState(() => showTip ?? !loadRecordTipDismissed())

  useEffect(() => {
    if (showTip) setTip(true)
  }, [showTip])

  const hideTip = () => {
    setTip(false)
    dismissRecordTip()
  }

  const open = () => {
    hideTip()
    onOpen()
  }

  return (
    <div className="relative shrink-0 p-[3px]" data-record-fab>
      {tip ? (
        <button
          type="button"
          data-record-tip
          onClick={hideTip}
          className="absolute bottom-[calc(100%+0.55rem)] right-0 z-20 w-[13.5rem] rounded-2xl border border-[#A855F7]/45 bg-[#1A1030] px-3 py-2.5 text-left shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
        >
          <span className="absolute -bottom-1.5 right-6 size-3 rotate-45 border-b border-r border-[#A855F7]/45 bg-[#1A1030]" />
          <span className="flex items-start gap-1.5 text-xs font-semibold leading-4 text-white">
            <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-[#FF4D6D]" />
            New · Record your own beat
          </span>
          <span className="mt-1 block text-[0.7rem] leading-4 text-slate-400">
            Tap to open the pads and play into the grid
          </span>
        </button>
      ) : null}
      <button
        type="button"
        data-record-open
        aria-label="Record your own beat"
        {...activateOnPointer(open)}
        className="flex size-14 shrink-0 items-center justify-center rounded-full bg-[#141A28] ring-[3px] ring-[#FF4D6D] touch-manipulation shadow-[0_0_10px_rgba(255,77,109,0.55)]"
      >
        <span className="size-3.5 rounded-full bg-[#FF4D6D] shadow-[0_0_10px_rgba(255,77,109,0.95)]" />
      </button>
    </div>
  )
}
