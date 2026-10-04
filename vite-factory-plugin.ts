import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import type { Plugin } from 'vite'

const rootDir = dirname(fileURLToPath(import.meta.url))
const storePath = resolve(rootDir, '.wrangler/factory-local.json')

type LocalStore = Record<string, string>
type FactoryKv = {
  get(key: string): Promise<string | null>
  put(key: string, value: string): Promise<void>
}

function loadDevVars(): Record<string, string> {
  const file = resolve(rootDir, '.dev.vars')
  if (!existsSync(file)) return {}
  const out: Record<string, string> = {}
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1)
  }
  return out
}

function fileKv(): FactoryKv {
  const read = (): LocalStore => {
    if (!existsSync(storePath)) return {}
    try {
      const parsed = JSON.parse(readFileSync(storePath, 'utf8')) as unknown
      return parsed && typeof parsed === 'object' ? (parsed as LocalStore) : {}
    } catch {
      return {}
    }
  }
  const write = (store: LocalStore) => {
    mkdirSync(dirname(storePath), { recursive: true })
    writeFileSync(storePath, JSON.stringify(store, null, 2))
  }
  return {
    async get(key) {
      return read()[key] ?? null
    },
    async put(key, value) {
      const store = read()
      store[key] = value
      write(store)
    },
  }
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8')
}

function toRequest(req: IncomingMessage, body: string): Request {
  const host = req.headers.host ?? '127.0.0.1'
  const url = `http://${host}${req.url ?? '/'}`
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value)
    else if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item)
    }
  }
  const method = req.method ?? 'GET'
  return new Request(url, {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : body,
  })
}

async function writeResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') res.appendHeader('set-cookie', value)
    else res.setHeader(key, value)
  })
  res.end(Buffer.from(await response.arrayBuffer()))
}

async function loadFactoryModules(): Promise<{
  handleFactoryRequest: (
    request: Request,
    env: { kv: FactoryKv; password?: string; seed: () => unknown; secure: boolean },
  ) => Promise<Response>
  bundledFactoryLibrary: () => unknown
}> {
  const apiHref = pathToFileURL(resolve(rootDir, 'src/lib/factory-api.ts')).href
  const storeHref = pathToFileURL(resolve(rootDir, 'src/lib/factory-store.ts')).href
  const api = (await import(apiHref)) as {
    handleFactoryRequest: (
      request: Request,
      env: { kv: FactoryKv; password?: string; seed: () => unknown; secure: boolean },
    ) => Promise<Response>
  }
  const store = (await import(storeHref)) as { bundledFactoryLibrary: () => unknown }
  return { handleFactoryRequest: api.handleFactoryRequest, bundledFactoryLibrary: store.bundledFactoryLibrary }
}

function attachFactoryApi(server: { middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void } }) {
  const kv = fileKv()
  const vars = loadDevVars()
  server.middlewares.use((req, res, next) => {
    if (!req.url?.startsWith('/api/factory')) {
      next()
      return
    }
    void (async () => {
      const { handleFactoryRequest, bundledFactoryLibrary } = await loadFactoryModules()
      const body = await readBody(req)
      const request = toRequest(req, body)
      const response = await handleFactoryRequest(request, {
        kv,
        password: process.env.FACTORY_ADMIN_PASSWORD ?? vars.FACTORY_ADMIN_PASSWORD,
        seed: bundledFactoryLibrary,
        secure: false,
      })
      await writeResponse(res, response)
    })().catch((error: unknown) => {
      res.statusCode = 500
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Factory API failed.' }))
    })
  })
}

export function factoryApiPlugin(): Plugin {
  return {
    name: 'omnician-factory-api',
    configureServer(server) {
      attachFactoryApi(server)
    },
    configurePreviewServer(server) {
      attachFactoryApi(server)
    },
  }
}
