import { useLocation } from 'react-router-dom'

import { SettingsChrome, settingsBackFrom } from '@/components/SettingsChrome'
import { APP_COPYRIGHT, APP_NAME } from '@/lib/app-info'

export type LegalPageId = 'privacy' | 'terms' | 'credits' | 'support'

const PAGES: Record<
  LegalPageId,
  { title: string; heading: string; body: string[] }
> = {
  privacy: {
    title: 'Privacy Policy',
    heading: 'Privacy Policy',
    body: [
      'Placeholder. Final text will replace this page.',
      `${APP_NAME} stores tuner and rhythm preferences on this device only. No account is required.`,
    ],
  },
  terms: {
    title: 'Terms of Use',
    heading: 'Terms of Use',
    body: [
      'Placeholder. Final text will replace this page.',
      `These terms will cover use of ${APP_NAME} as a practice tool from Raykin Music LLC.`,
    ],
  },
  credits: {
    title: 'Credits & Licenses',
    heading: 'Credits & Licenses',
    body: [
      'Placeholder. Final text will replace this page.',
      'Drums: CrocellKit by Lars Muldjord & Henry Järvinen, Creative Commons Attribution 4.0 (edited).',
      'Click: Wood, Clave, Digital, and Mechanical samples (CC0 / public domain).',
      'Speed Builder Announce: Kokoro-82M af_heart (Apache 2.0).',
      'UI type: Outfit (SIL Open Font License 1.1).',
    ],
  },
  support: {
    title: 'Support / Contact',
    heading: 'Support / Contact',
    body: [
      'Placeholder. Final text will replace this page.',
      'Contact details for Raykin Music LLC will appear here.',
    ],
  },
}

export function LegalPage({ id }: { id: LegalPageId }) {
  const page = PAGES[id]
  const location = useLocation()
  const from = settingsBackFrom((location.state as { from?: string } | null)?.from)
  return (
    <SettingsChrome title={page.title} backTo="/settings/about" backLabel="About" backState={{ from }}>
      <article className="space-y-4" data-legal-page={id}>
        <h2 className="text-2xl font-bold tracking-tight text-white">{page.heading}</h2>
        {page.body.map((para) => (
          <p key={para} className="text-sm leading-6 text-slate-400">
            {para}
          </p>
        ))}
        <p className="text-xs text-slate-600">{APP_COPYRIGHT}</p>
      </article>
    </SettingsChrome>
  )
}
