/** App-bundle (Vite public/) URL. Same files the live site serves from dist/. */
export function bundledAssetUrl(path: string): string {
  const base = import.meta.env?.BASE_URL ?? '/'
  const prefix = base.endsWith('/') ? base : `${base}/`
  return `${prefix}${path.replace(/^\//, '')}`
}
