import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY!
const CHANNEL_ID = 'UC2rE8iHcrmv5x6QE1X33KyQ'
const BASE = 'https://www.googleapis.com/youtube/v3'

async function ytFetch(endpoint: string, params: Record<string, string>) {
  const url = new URL(`${BASE}/${endpoint}`)
  url.searchParams.set('key', YOUTUBE_API_KEY)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`YouTube API error: ${res.status}`)
  return res.json()
}

export async function GET() {
  try {
    const now = new Date().toISOString()

    // Fetch up to 50 recent videos across two pages for better historical coverage
    const [channelData, searchData1, searchData2] = await Promise.all([
      ytFetch('channels', { part: 'statistics,snippet', id: CHANNEL_ID }),
      ytFetch('search', { part: 'id', channelId: CHANNEL_ID, order: 'date', type: 'video', maxResults: '50' }),
      ytFetch('search', { part: 'id', channelId: CHANNEL_ID, order: 'date', type: 'video', maxResults: '50', pageToken: '' }),
    ])

    const channel = channelData.items?.[0]
    if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 })

    const stats = channel.statistics
    const allIds = [
      ...(searchData1.items?.map((item: any) => item.id.videoId).filter(Boolean) || []),
      ...(searchData2.items?.map((item: any) => item.id.videoId).filter(Boolean) || []),
    ]
    const videoIds = [...new Set(allIds)].slice(0, 50)

    let videoPerformance: any[] = []
    if (videoIds.length > 0) {
      // Fetch in batches of 50 (API limit)
      const batches = []
      for (let i = 0; i < videoIds.length; i += 50) {
        batches.push(videoIds.slice(i, i + 50))
      }
      const batchResults = await Promise.all(batches.map(batch =>
        ytFetch('videos', { part: 'statistics,snippet,contentDetails', id: batch.join(',') })
      ))

      videoPerformance = batchResults.flatMap(videoData =>
        videoData.items?.map((video: any) => {
          const s = video.statistics
          const views = Number(s.viewCount || 0)
          const likes = Number(s.likeCount || 0)
          const comments = Number(s.commentCount || 0)
          const engagement = views > 0 ? Math.round(((likes + comments) / views) * 10000) / 100 : 0
          const dur = video.contentDetails?.duration || 'PT0S'
          const match = dur.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
          const seconds = (Number(match?.[1] || 0) * 3600) + (Number(match?.[2] || 0) * 60) + Number(match?.[3] || 0)
          const isShort = seconds > 0 && seconds <= 60
          const publishedAt = video.snippet.publishedAt ?? null

          return {
            platform: 'YouTube',
            views,
            engagement_rate: engagement,
            watch_time_seconds: seconds,
            ctr: 0,
            recorded_at: now,
            title: video.snippet.title,
            published_at: publishedAt,
            is_short: isShort,
          }
        }) || []
      )
    }

    // Clear old data and write fresh
    await supabase.from('analytics_snapshots').delete().eq('platform', 'YouTube')
    await supabase.from('video_performance').delete().eq('platform', 'YouTube')

    const writes = [
      supabase.from('analytics_snapshots').insert([
        { platform: 'YouTube', metric_name: 'subscribers', metric_value: Number(stats.subscriberCount), recorded_at: now },
        { platform: 'YouTube', metric_name: 'total_views', metric_value: Number(stats.viewCount), recorded_at: now },
        { platform: 'YouTube', metric_name: 'total_videos', metric_value: Number(stats.videoCount), recorded_at: now },
      ]),
    ]

    if (videoPerformance.length > 0) {
      writes.push(supabase.from('video_performance').insert(videoPerformance))
    }

    const results = await Promise.all(writes)
    const errors = results.filter((r: any) => r.error).map((r: any) => r.error)
    if (errors.length > 0) {
      return NextResponse.json({ error: 'Supabase write failed', details: errors }, { status: 500 })
    }

    const sorted = [...videoPerformance].sort((a, b) => b.views - a.views)

    return NextResponse.json({
      success: true,
      channel: {
        name: channel.snippet.title,
        subscribers: Number(stats.subscriberCount).toLocaleString(),
        totalViews: Number(stats.viewCount).toLocaleString(),
        totalVideos: stats.videoCount,
      },
      videosProcessed: videoPerformance.length,
      top5: sorted.slice(0, 5).map(v => ({ title: v.title, views: v.views, engagement: v.engagement_rate + '%' })),
      bottom5: sorted.slice(-5).reverse().map(v => ({ title: v.title, views: v.views, engagement: v.engagement_rate + '%' })),
    })

  } catch (error: any) {
    console.error('YouTube sync error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
