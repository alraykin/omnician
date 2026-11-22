import { handleFactoryRequest } from '../src/lib/factory-api.ts'
import { bundledFactoryLibrary } from '../src/lib/factory-store.ts'
import { applyNativeGetCors, isRhythmAssetPath } from '../src/lib/native-origin.ts'

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
    if (isRhythmAssetPath(url.pathname) && request.method.toUpperCase() === 'OPTIONS') {
      return applyNativeGetCors(request, new Response(null, { status: 204 }))
    }
    const response = await env.ASSETS.fetch(request)
    if (isRhythmAssetPath(url.pathname)) return applyNativeGetCors(request, response)
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html')) return response
    const headers = new Headers(response.headers)
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    headers.set('Pragma', 'no-cache')
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    })
  },
}
