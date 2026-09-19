import { OmnicianWordmark } from '@/components/OmnicianMark'
import { ToolButton } from '@/components/ToolButton'
import { practiceTools } from '@/data/tools'

export function HomePage() {
  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden px-5 py-8 sm:px-8 sm:py-12">
      <div className="stage-glow" aria-hidden />
      <div className="sound-rings" aria-hidden />

      <header className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center text-center">
        <p className="mb-5 text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-[#C084FC]/80 sm:text-xs">
          Practice companion
        </p>
        <OmnicianWordmark className="text-[2.55rem] leading-none sm:text-6xl md:text-7xl" />
        <p className="mt-4 max-w-md text-base text-slate-400 sm:text-lg">
          You&apos;re becoming an Omnician.
        </p>
      </header>

      <main className="relative z-10 mx-auto mt-10 flex w-full max-w-5xl flex-1 flex-col sm:mt-14">
        <h1 className="text-center text-[1.65rem] font-semibold tracking-tight text-white sm:text-4xl md:text-[2.6rem] md:leading-tight">
          Hello — are you ready to rock?
        </h1>
        <p className="mx-auto mt-3 max-w-lg text-center text-sm leading-6 text-slate-400 sm:text-base">
          Pick a tool and step into the practice room. These three are first.
        </p>

        <nav
          aria-label="Practice tools"
          className="mt-8 grid gap-3 sm:mt-10 sm:grid-cols-3 sm:gap-4"
        >
          {practiceTools.map((tool) => (
            <ToolButton key={tool.slug} tool={tool} />
          ))}
        </nav>
      </main>

      <footer className="relative z-10 mx-auto mt-10 w-full max-w-5xl text-center sm:mt-14">
        <p className="text-xs leading-5 text-slate-500 sm:text-sm">
          More tools unlock with a subscription later. Nothing to pay today —
          this first version is just the home stage.
        </p>
      </footer>
    </div>
  )
}
