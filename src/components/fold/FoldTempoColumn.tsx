import { Minus, Plus } from 'lucide-react'

import { BpmWheel } from '@/components/rhythm/BpmWheel'
import { Button } from '@/components/ui/button'
import { activateOnPointer, cn } from '@/lib/utils'

export function FoldTempoColumn({
  bpm,
  liveBpm,
  onBpm,
  onTap,
  className,
}: {
  bpm: number
  liveBpm?: number
  onBpm: (next: number, tick?: boolean) => void
  onTap: () => void
  className?: string
}) {
  return (
    <div
      data-fold-tempo
      data-tempo-wheel-stack
      className={cn('flex w-[200px] flex-col items-center gap-3 pt-3 sm:gap-4 sm:pt-4', className)}
    >
      <BpmWheel compact value={bpm} faceBpm={liveBpm} onChange={(next) => onBpm(next, true)} />
      <div className="grid w-full grid-cols-3 gap-1" data-tempo-taps>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Slower by 5"
          className="h-10 min-h-10 w-full min-w-0 px-1 text-[0.72rem] touch-manipulation"
          {...activateOnPointer(() => onBpm(bpm - 5, true))}
        >
          <Minus className="size-3.5" />
          5
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-tap
          className="h-10 min-h-10 w-full min-w-0 px-1 text-[0.72rem] touch-manipulation"
          {...activateOnPointer(onTap)}
        >
          Tap
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Faster by 5"
          className="h-10 min-h-10 w-full min-w-0 px-1 text-[0.72rem] touch-manipulation"
          {...activateOnPointer(() => onBpm(bpm + 5, true))}
        >
          <Plus className="size-3.5" />
          5
        </Button>
      </div>
    </div>
  )
}

export function FoldPlayButton({
  playing,
  onToggle,
  className,
}: {
  playing: boolean
  onToggle: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      data-transport="play"
      data-fold-play
      {...activateOnPointer(onToggle)}
      className={cn(
        'flex h-[52px] min-h-10 w-full items-center justify-center gap-2 rounded-full text-base font-semibold touch-manipulation',
        playing ? 'bg-[#FF4D6D] text-white' : 'bg-[#A855F7] text-white',
        className,
      )}
    >
      {playing ? 'Stop' : 'Play'}
    </button>
  )
}
