import { useEffect, useState } from 'react'

import { listAudioInputs } from '@/lib/mic-capture'
import { getTunerInputDeviceId, setTunerInputDevice } from '@/lib/tuner-session'
import { cn } from '@/lib/utils'

export function InputPicker({
  alwaysShow = false,
  className,
}: {
  alwaysShow?: boolean
  className?: string
}) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selected, setSelected] = useState<string>(getTunerInputDeviceId() ?? '')

  useEffect(() => {
    let alive = true
    const refresh = async () => {
      const next = await listAudioInputs()
      if (!alive) return
      setDevices(next)
    }
    void refresh()
    navigator.mediaDevices?.addEventListener?.('devicechange', refresh)
    return () => {
      alive = false
      navigator.mediaDevices?.removeEventListener?.('devicechange', refresh)
    }
  }, [])

  if (!alwaysShow && devices.length <= 1) return null

  return (
    <label className={cn('mt-3 flex w-full items-center gap-2 text-left text-xs text-slate-400', className)}>
      <span className="shrink-0 font-semibold uppercase tracking-[0.14em] text-slate-500">
        Input
      </span>
      <select
        data-tuner-input
        value={selected}
        onChange={(event) => {
          const id = event.target.value
          setSelected(id)
          void setTunerInputDevice(id || null)
        }}
        className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#141A28] px-2 py-1.5 text-sm text-white"
      >
        <option value="">Default input</option>
        {devices.map((device, index) => (
          <option key={device.deviceId || index} value={device.deviceId}>
            {device.label || `Input ${index + 1}`}
          </option>
        ))}
      </select>
    </label>
  )
}
