import { OmnicianWordmark } from '@/components/OmnicianMark'
import { AppTabBar } from '@/components/AppTabBar'
import { ToolButton } from '@/components/ToolButton'
import { practiceTools } from '@/data/tools'

export function HomePage() {
  return (
    <div
      data-app-frame
      className="relative flex min-h-svh w-full max-w-full flex-col overflow-x-hidden overflow-y-auto overscroll-x-none px-5 pb-[calc(2.25rem+var(--tabbar-clearance))] pt-8 [touch-action:pan-y] sm:px-8 sm:pt-12 lg:px-12 lg:pt-16"
    >
      <div className="stage-glow" aria-hidden />
      <div className="sound-rings" aria-hidden />

      <header className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center text-center lg:max-w-6xl">
        <p className="mb-5 max-w-sm text-[0.65rem] font-semibold uppercase leading-4 tracking-[0.16em] text-[#C084FC]/80 sm:text-xs sm:tracking-[0.22em]">
          The ultimate practice companion
        </p>
        <OmnicianWordmark className="h-[5.5rem] w-auto sm:h-28 md:h-36" />
        <p className="mt-4 max-w-md text-base text-slate-400 sm:text-lg">
          You&apos;re becoming an Omnician.
        </p>
      </header>

      <main className="relative z-10 mx-auto mt-10 flex w-full max-w-5xl flex-1 flex-col sm:mt-14 lg:max-w-6xl">
        <h1 className="text-center text-[1.65rem] font-semibold tracking-tight text-white sm:text-4xl md:text-[2.6rem] md:leading-tight">
          Hello — are you ready to rock?
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-center text-sm leading-6 text-slate-400 sm:text-base">
          Pick a tool and step into the practice room. Tuner, Click, and Drums are ready.
        </p>

        <nav
          aria-label="Practice tools"
          className="mx-auto mt-8 grid w-full max-w-3xl gap-3 sm:mt-10 sm:grid-cols-2 sm:gap-4 lg:max-w-4xl lg:gap-5"
        >
          {practiceTools.map((tool) => (
            <ToolButton key={tool.slug} tool={tool} />
          ))}
        </nav>
      </main>

      <footer className="relative z-10 mx-auto mt-10 w-full max-w-5xl text-center sm:mt-14 lg:max-w-6xl">
        <p className="text-xs leading-5 text-slate-500 sm:text-sm">
          More tools unlock with a subscription later. Nothing to pay today —
          this first version is just the home stage.
        </p>
      </footer>
      <AppTabBar />
    </div>
  )
}
