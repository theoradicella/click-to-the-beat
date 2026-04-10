export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')?.trim()

  if (!q) return Response.json({ error: 'missing query' }, { status: 400 })

  const key = process.env.YT_API_KEY
  if (!key) return Response.json({ error: 'server misconfigured' }, { status: 500 })

  const url = new URL('https://www.googleapis.com/youtube/v3/search')
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('type', 'video')
  url.searchParams.set('videoCategoryId', '10')
  url.searchParams.set('maxResults', '5')
  url.searchParams.set('q', q)
  url.searchParams.set('key', key)

  const data = await fetch(url).then(r => r.json())
  return Response.json(data)
}
