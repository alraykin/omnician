import { handleFactoryRequest } from '../src/lib/factory-api.ts'
import { bundledFactoryLibrary } from '../src/lib/factory-store.ts'

type WorkerKv = {
  get(key: string): Promise<string | null>
  put(key: string, value: string): Promise<void>
}

type WorkerAssets = {
  fetch(request: Request): Promise<Response>
}

export type FactoryEnv = {
  FACTORY: WorkerKv
  FACTORY_ADMIN_PASSWORD?: string
  ASSETS: WorkerAssets
}

export default {
  async fetch(request: Request, env: FactoryEnv): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/factory')) {
      return handleFactoryRequest(request, {
        kv: env.FACTORY,
        password: env.FACTORY_ADMIN_PASSWORD,
        seed: bundledFactoryLibrary,
        secure: url.protocol === 'https:',
      })
    }
    return env.ASSETS.fetch(request)
  },
}
