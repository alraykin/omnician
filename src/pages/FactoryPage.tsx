import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { factoryLogin, fetchFactorySession } from '@/lib/factory-store'

export function FactoryPage() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void fetchFactorySession().then((ok) => {
      if (ok) navigate('/drums', { replace: true })
    })
  }, [navigate])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const result = await factoryLogin(password)
    setBusy(false)
    if (result.ok) {
      navigate('/drums', { replace: true })
      return
    }
    setError(result.error)
  }

  return (
    <div className="relative min-h-svh overflow-x-hidden px-4 pb-12 pt-10 sm:px-6">
      <div className="stage-glow" aria-hidden />
      <main className="relative z-10 mx-auto w-full max-w-sm">
        <form
          data-factory-login
          onSubmit={(event) => void onSubmit(event)}
          className="space-y-4 rounded-2xl border border-white/10 bg-[#141A28]/80 px-4 py-6"
        >
          <h1 className="text-2xl font-bold tracking-tight text-white">Factory editor</h1>
          <p className="text-sm leading-6 text-slate-400">
            Sign in to edit the built-in Drums library. This page is not linked from the app.
          </p>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Password
            </span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 w-full rounded-xl border border-white/10 bg-[#0B0F1A] px-3 text-sm text-white outline-none ring-[#A855F7] focus:border-[#A855F7] focus:ring-2"
            />
          </label>
          {error ? (
            <p data-factory-login-error className="text-sm text-red-300">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={busy || !password}>
            {busy ? 'Checking…' : 'Sign in'}
          </Button>
        </form>
      </main>
    </div>
  )
}
