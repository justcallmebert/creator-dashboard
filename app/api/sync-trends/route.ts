import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY!
const ADLEY_CHANNEL_ID = 'UCBJuxfqZuiibvcwSc8ViGsQ'
const BASE = 'https://www.googleapis.com/youtube/v3'

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

export async function GET() {
  try {
    // Get Adley channel metadata for topic categories and keywords
    const channelData = await ytFetch('channels', {
      part: 'topicDetails,brandingSettings',
      id: ADLEY_CHANNEL_ID,
    })

    const channel = channelData.items?.[0]
    const keywords: string[] = channel?.brandingSettings?.channel?.keywords
      ?.split(/\s+(?=(?:[^"]*"[^"]*")*[^"]*$)/)
      .map((k: string) => k.replace(/"/g, '').trim())
      .filter(Boolean)
      .slice(0, 5) ?? []

    // Build search queries: channel keywords + core niche terms
    const nicheTerms = ['kids youtube', 'family fun kids', 'for kids games', 'children activities']
    const queries = [
      ...keywords.map(k => `${k} kids`),
      ...nicheTerms,
    ].slice(0, 6) // cap to stay within quota

    // Search YouTube for top-performing videos across these queries
    const searchResults = await Promise.all(
      queries.map(q =>
        ytFetch('search', {
          part: 'id,snippet',
          q,
          type: 'video',
          order: 'viewCount',
          maxResults: '5',
          relevanceLanguage: 'en',
          safeSearch: 'strict',
        }).catch(() => ({ items: [] }))
      )
    )

    // Collect unique video IDs
    const seenIds = new Set<string>()
    const videoIds: string[] = []
    for (const result of searchResults) {
      for (const item of result.items ?? []) {
        const id = item.id?.videoId
        if (id && !seenIds.has(id)) {
          seenIds.add(id)
          videoIds.push(id)
        }
      }
    }

    if (videoIds.length === 0) {
      return NextResponse.json({ error: 'No videos found' }, { status: 404 })
    }

    // Fetch stats for all videos in one call
    const videoData = await ytFetch('videos', {
      part: 'statistics,snippet,topicDetails',
      id: videoIds.join(','),
    })

    const now = new Date().toISOString()

    const entries = (videoData.items ?? [])
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
        }
      })
      .sort((a: any, b: any) => {
        // Sort by raw view count descending
        const parseViews = (s: string) => {
          if (s.endsWith('M')) return parseFloat(s) * 1_000_000
          if (s.endsWith('K')) return parseFloat(s) * 1_000
          return parseFloat(s.replace(/,/g, '')) || 0
        }
        return parseViews(b.views) - parseViews(a.views)
      })
      .slice(0, 20)

    // Delete previous auto-synced entries (identified by youtube.com source_url)
    await supabase.from('niche_trends').delete().like('source_url', '%youtube.com%')

    const { error } = await supabase.from('niche_trends').insert(entries)
    if (error) return NextResponse.json({ error: 'Supabase write failed', details: error }, { status: 500 })

    return NextResponse.json({
      success: true,
      synced: entries.length,
      queries,
      top3: entries.slice(0, 3).map((e: any) => ({ title: e.title, creator: e.creator, views: e.views })),
    })
  } catch (error: any) {
    console.error('Trend sync error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
