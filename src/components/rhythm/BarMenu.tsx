import { AUTO_COMPLETE_ENABLED } from '@/lib/features'
import { cn } from '@/lib/utils'

export type BarMenuAction = 'copy' | 'paste' | 'duplicate' | 'clear' | 'delete' | 'auto' | 'retry-fill'

type Item = {
  action: BarMenuAction
  label: string
  disabled?: boolean
  hidden?: boolean
  danger?: boolean
}

export function BarMenu({
  x,
  y,
  canPaste,
  canDuplicate,
  canDelete,
  canAutoComplete,
  canRetryFill,
  onAction,
  onClose,
}: {
  x: number
  y: number
  canPaste: boolean
  canDuplicate: boolean
  canDelete: boolean
  canAutoComplete: boolean
  canRetryFill: boolean
  onAction: (action: BarMenuAction) => void
  onClose: () => void
}) {
  const items: Item[] = [
    { action: 'copy', label: 'Copy bar' },
    { action: 'paste', label: 'Paste here', disabled: !canPaste },
    { action: 'duplicate', label: 'Duplicate', disabled: !canDuplicate },
    { action: 'clear', label: 'Clear bar' },
    { action: 'delete', label: 'Delete bar', hidden: !canDelete, danger: true },
    { action: 'auto', label: 'Auto-complete', hidden: !AUTO_COMPLETE_ENABLED, disabled: !canAutoComplete },
    { action: 'retry-fill', label: 'Try another fill', hidden: !AUTO_COMPLETE_ENABLED || !canRetryFill },
  ]

  const width = 196
  const left = Math.min(Math.max(8, x), window.innerWidth - width - 8)
  const top = Math.min(Math.max(8, y), window.innerHeight - 8)

  return (
    <div className="fixed inset-0 z-50" data-bar-menu-layer>
      <button
        type="button"
        aria-label="Close bar menu"
        data-bar-menu-backdrop
        className="absolute inset-0 cursor-default bg-black/20"
        onClick={onClose}
      />
      <div
        role="menu"
        data-bar-menu
        style={{ left, top, width }}
        className="absolute overflow-hidden rounded-2xl border border-white/12 bg-[#141A28] py-1 shadow-2xl shadow-black/50"
      >
        {items.map((item) =>
          item.hidden ? null : (
            <button
              key={item.action}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              data-bar-menu-item={item.action}
              onClick={() => {
                if (item.disabled) return
                onAction(item.action)
              }}
              className={cn(
                'flex h-10 w-full items-center px-3 text-left text-sm font-semibold touch-manipulation',
                item.danger ? 'text-rose-300' : 'text-white',
                item.disabled ? 'opacity-35' : 'hover:bg-white/8',
              )}
            >
              {item.label}
            </button>
          ),
        )}
      </div>
    </div>
  )
}
