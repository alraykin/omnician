import { useLocation } from 'react-router-dom'

import { LegalDoc } from '@/components/LegalDoc'
import { SettingsChrome, settingsBackFrom } from '@/components/SettingsChrome'
import privacyMd from '@/legal/privacy.md?raw'

export type LegalPageId = 'privacy' | 'terms' | 'credits' | 'support'

const DOCS: Partial<Record<LegalPageId, string>> = {
  privacy: privacyMd,
}

const TITLES: Record<LegalPageId, string> = {
  privacy: 'Privacy Policy',
  terms: 'Terms of Use',
  credits: 'Credits & Licenses',
  support: 'Support / Contact',
}

export function LegalPage({ id }: { id: LegalPageId }) {
  const markdown = DOCS[id]
  const location = useLocation()
  const from = settingsBackFrom((location.state as { from?: string } | null)?.from)
  return (
    <SettingsChrome
      title={TITLES[id]}
      titleAs="p"
      backTo="/settings/about"
      backLabel="About"
      backState={{ from }}
    >
      {markdown ? (
        <LegalDoc markdown={markdown} />
      ) : (
        <article className="space-y-4" data-legal-page={id} data-legal-coming-soon>
          <h2 className="text-2xl font-bold tracking-tight text-white">{TITLES[id]}</h2>
          <p className="text-sm leading-6 text-slate-400">Coming soon</p>
        </article>
      )}
    </SettingsChrome>
  )
}
