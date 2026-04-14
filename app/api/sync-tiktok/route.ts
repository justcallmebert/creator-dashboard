import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Manual TikTok stats entry — POST a snapshot of current stats
// Body: { followers, totalLikes, videos: [{ title, views, likes, comments, publishedAt }] }
export async function POST(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  try {
    const body = await request.json()
    const { followers, totalLikes, videos = [] } = body
    const now = new Date().toISOString()

    await supabase.from('analytics_snapshots').delete().eq('platform', 'TikTok')
    await supabase.from('video_performance').delete().eq('platform', 'TikTok')

    const writes: any[] = [
      supabase.from('analytics_snapshots').insert([
        { platform: 'TikTok', metric_name: 'followers', metric_value: Number(followers || 0), recorded_at: now },
        { platform: 'TikTok', metric_name: 'total_likes', metric_value: Number(totalLikes || 0), recorded_at: now },
      ]),
    ]

    if (videos.length > 0) {
      const rows = videos.map((v: any) => {
        const views = Number(v.views || 0)
        const likes = Number(v.likes || 0)
        const comments = Number(v.comments || 0)
        const engagement = views > 0 ? Math.round(((likes + comments) / views) * 10000) / 100 : 0
        return {
          platform: 'TikTok',
          title: v.title || 'Untitled',
          views,
          engagement_rate: engagement,
          watch_time_seconds: 0,
          ctr: 0,
          recorded_at: now,
          published_at: v.publishedAt ?? null,
          is_short: true,
        }
      })
      writes.push(supabase.from('video_performance').insert(rows))
    }

    await Promise.all(writes)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
