import { AppChrome } from '@/components/AppChrome'
import { OmnicianWordmark } from '@/components/OmnicianMark'
import { HOME_TOOLS, ToolButton } from '@/components/ToolButton'

export function HomePage() {
  return (
    <AppChrome align="center" hideTabs>
      <div className="sound-rings" aria-hidden />
      <div
        data-home-hero
        className="relative z-10 flex w-full max-w-md flex-col items-center text-center sm:max-w-4xl"
      >
        <OmnicianWordmark
          className="h-auto w-[min(76vw,32rem)]"
        />
        <p className="mt-2.5 max-w-sm text-[0.65rem] font-semibold uppercase leading-4 tracking-[0.16em] text-[#C084FC]/80 sm:text-xs sm:tracking-[0.22em]">
          The ultimate practice companion
        </p>

        <nav
          aria-label="Practice tools"
          className="mx-auto mt-8 grid w-full gap-3 sm:mt-10 sm:grid-cols-3 sm:gap-4"
        >
          {HOME_TOOLS.map((tool) => (
            <ToolButton key={tool.id} tool={tool} />
          ))}
        </nav>
      </div>
    </AppChrome>
  )
}
