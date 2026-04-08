import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY!
const BASE = 'https://www.googleapis.com/youtube/v3'

// Channels to exclude from trend results (their own channels)
const EXCLUDED_CHANNEL_NAMES = new Set([
  'A for Adley- Learning & Fun',
  'A for Adley',
  'Shonduras',
  'Spacestation Animation',
  'G for Gaming',
])

// Content that's too young for Adley at 11
const EXCLUDED_KEYWORDS = [
  'nursery rhyme', 'nursery rhymes', 'baby song', 'lullaby', 'lullabies',
  'toddler', 'baby learn', 'abc song', 'phonics', 'counting song',
]

// Search queries derived from their top-performing video tags
const SEARCH_QUERIES = [
  'floor is lava challenge kids',
  'family fun challenge pretend play',
  'hide and seek challenge kids',
  'cops and robbers kids adventure',
  'last to leave challenge family',
  'mystery cafe challenge kids',
  'trick or treat halloween kids challenge',
  'family game challenge leprechaun',
  'pirate adventure challenge kids',
  'roblox family challenge irl',
]

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
  const lower = title.toLowerCase()
  return EXCLUDED_KEYWORDS.some(kw => lower.includes(kw))
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') ?? '30d'
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
    const publishedAfter = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    const now = new Date().toISOString()

    // Run searches in parallel (cap at 8 to stay within quota)
    const searchResults = await Promise.all(
      SEARCH_QUERIES.slice(0, 8).map(q =>
        ytFetch('search', {
          part: 'id,snippet',
          q,
          type: 'video',
          order: 'viewCount',
          maxResults: '8',
          relevanceLanguage: 'en',
          safeSearch: 'strict',
          videoCategoryId: '22', // People & Blogs (family/kids content)
          publishedAfter,
        }).catch(() => ({ items: [] }))
      )
    )

    // Deduplicate and pre-filter by channel name
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

    if (videoIds.length === 0) {
      return NextResponse.json({ error: 'No videos found' }, { status: 404 })
    }

    // Fetch full stats in batches of 50
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

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const entries = allVideos
      .filter((video: any) => {
        if (isExcluded(video.snippet.title, video.snippet.channelTitle)) return false
        return new Date(video.snippet.publishedAt) >= cutoff
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
          insight: `${engagement}% engagement · ${fmtViews(likes)} likes · published ${new Date(video.snippet.publishedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`,
          source_url: `https://www.youtube.com/watch?v=${video.id}`,
          added_at: now,
          _views_raw: views,
        }
      })
      .sort((a: any, b: any) => b._views_raw - a._views_raw)
      .slice(0, 20)
      .map(({ _views_raw, ...e }: any) => e)

    // Replace previous auto-synced entries
    await supabase.from('niche_trends').delete().like('source_url', '%youtube.com%')

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
