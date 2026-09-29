import { AppChrome } from '@/components/AppChrome'
import { ToolButton } from '@/components/ToolButton'
import { practiceTools } from '@/data/tools'

export function HomePage() {
  return (
    <AppChrome align="fill">
      <div className="sound-rings" aria-hidden />
      <div className="relative z-10 flex flex-col items-center text-center">
        <p className="max-w-sm text-[0.65rem] font-semibold uppercase leading-4 tracking-[0.16em] text-[#C084FC]/80 sm:text-xs sm:tracking-[0.22em]">
          The ultimate practice companion
        </p>
        <p className="mt-3 max-w-md text-base text-slate-400 sm:text-lg">
          You&apos;re becoming an Omnician.
        </p>
        <h2 className="mt-8 text-[1.65rem] font-semibold tracking-tight text-white sm:mt-10 sm:text-4xl md:text-[2.6rem] md:leading-tight">
          Hello — are you ready to rock?
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-400 sm:text-base">
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

        <p className="mt-10 max-w-lg text-xs leading-5 text-slate-500 sm:mt-14 sm:text-sm">
          More tools unlock with a subscription later. Nothing to pay today —
          this first version is just the home stage.
        </p>
      </div>
    </AppChrome>
  )
}
