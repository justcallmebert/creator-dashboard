import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY!
const BASE = 'https://www.googleapis.com/youtube/v3'

const EXCLUDED_CHANNEL_NAMES = new Set([
  'A for Adley- Learning & Fun',
  'A for Adley',
  'Shonduras',
  'Spacestation Animation',
  'G for Gaming',
])

const EXCLUDED_KEYWORDS = [
  'nursery rhyme', 'nursery rhymes', 'baby song', 'lullaby', 'lullabies',
  'toddler', 'baby learn', 'abc song', 'phonics', 'counting song',
]

const SEARCH_QUERIES = [
  'kids challenge family fun',
  'pretend play kids adventure',
  'hide and seek challenge',
  'floor is lava kids',
  'family challenge last to leave',
  'cops and robbers kids',
  'mystery challenge family',
  'kids game challenge',
]

const MIN_VIEWS: Record<string, number> = {
  '7d': 500,
  '30d': 2_000,
  '90d': 5_000,
}

// Only compare actual letters, ignoring emojis/numbers/punctuation
function isEnglish(title: string) {
  const allLetters = (title.match(/\p{L}/gu) ?? []).length
  const latinLetters = (title.match(/[a-zA-Z]/g) ?? []).length
  return allLetters === 0 || latinLetters / allLetters > 0.5
}

async function ytFetch(endpoint: string, params: Record<string, string>) {
  const url = new URL(`${BASE}/${endpoint}`)
  url.searchParams.set('key', YOUTUBE_API_KEY)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`YouTube API error: ${res.status}`)
  return res.json()
}

function fmtViews(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString()
}

function isExcluded(title: string, channelTitle: string) {
  if (EXCLUDED_CHANNEL_NAMES.has(channelTitle)) return true
  if (!isEnglish(title)) return true
  const lower = title.toLowerCase()
  return EXCLUDED_KEYWORDS.some(kw => lower.includes(kw))
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const period = (searchParams.get('period') ?? '30d') as '7d' | '30d' | '90d'
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
    const minViews = MIN_VIEWS[period] ?? 5_000
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    const now = new Date().toISOString()

    // Use order=date + publishedAfter to get recent videos, then sort by views ourselves
    const searchResults = await Promise.all(
      SEARCH_QUERIES.map(q =>
        ytFetch('search', {
          part: 'id,snippet',
          q,
          type: 'video',
          order: 'date',
          maxResults: '25',
          relevanceLanguage: 'en',
          publishedAfter,
        }).catch(() => ({ items: [] }))
      )
    )

    const seenIds = new Set<string>()
    const videoIds: string[] = []
    for (const result of searchResults) {
      for (const item of result.items ?? []) {
        const id = item.id?.videoId
        const channelTitle = item.snippet?.channelTitle ?? ''
        if (id && !seenIds.has(id) && !EXCLUDED_CHANNEL_NAMES.has(channelTitle)) {
          seenIds.add(id)
          videoIds.push(id)
        }
      }
    }

    await supabase.from('niche_trends').delete().like('source_url', '%youtube.com%')

    if (videoIds.length === 0) {
      return NextResponse.json({ error: 'No videos found for this period' }, { status: 404 })
    }

    const batches = []
    for (let i = 0; i < videoIds.length; i += 50) {
      batches.push(videoIds.slice(i, i + 50))
    }
    const videoResponses = await Promise.all(
      batches.map(batch =>
        ytFetch('videos', {
          part: 'statistics,snippet,topicDetails',
          id: batch.join(','),
        })
      )
    )
    const allVideos = videoResponses.flatMap(r => r.items ?? [])

    const entries = allVideos
      .filter((video: any) => {
        if (isExcluded(video.snippet.title, video.snippet.channelTitle)) return false
        if (new Date(video.snippet.publishedAt) < cutoff) return false
        return Number(video.statistics?.viewCount ?? 0) >= minViews
      })
      .map((video: any) => {
        const views = Number(video.statistics?.viewCount ?? 0)
        const likes = Number(video.statistics?.likeCount ?? 0)
        const comments = Number(video.statistics?.commentCount ?? 0)
        const engagement = views > 0
          ? Math.round(((likes + comments) / views) * 10000) / 100
          : 0
        const categories: string[] = video.topicDetails?.topicCategories
          ?.map((url: string) => url.split('/').pop()?.replace(/_/g, ' '))
          .filter(Boolean) ?? []

        return {
          title: video.snippet.title,
          creator: video.snippet.channelTitle,
          views: fmtViews(views),
          demographic: categories.slice(0, 2).join(', ') || 'Kids & Family',
          insight: `${engagement}% engagement · ${fmtViews(likes)} likes · published ${new Date(video.snippet.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`,
          source_url: `https://www.youtube.com/watch?v=${video.id}`,
          added_at: now,
          _views_raw: views,
        }
      })
      .sort((a: any, b: any) => b._views_raw - a._views_raw)
      .slice(0, 20)
      .map(({ _views_raw, ...e }: any) => e)

    if (entries.length === 0) {
      return NextResponse.json({ error: `No videos found with enough views in this period (min ${fmtViews(minViews)})` }, { status: 404 })
    }

    const { error } = await supabase.from('niche_trends').insert(entries)
    if (error) return NextResponse.json({ error: 'Supabase write failed', details: error }, { status: 500 })

    return NextResponse.json({
      success: true,
      synced: entries.length,
      top3: entries.slice(0, 3).map((e: any) => ({ title: e.title, creator: e.creator, views: e.views })),
    })
  } catch (error: any) {
    console.error('Trend sync error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
