import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const BASE = 'https://graph.facebook.com/v19.0'

export async function GET() {
  const ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN
  const IG_USER_ID = process.env.INSTAGRAM_USER_ID

  if (!ACCESS_TOKEN || !IG_USER_ID) {
    return NextResponse.json({ error: 'INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_USER_ID env vars required' }, { status: 500 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function igFetch(path: string, params: Record<string, string> = {}) {
    const url = new URL(`${BASE}${path}`)
    url.searchParams.set('access_token', ACCESS_TOKEN!)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    const res = await fetch(url.toString())
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Instagram API error ${res.status}: ${err}`)
    }
    return res.json()
  }

  try {
    const now = new Date().toISOString()

    // Profile stats (Instagram Graph API via Facebook Login)
    const profile = await igFetch(`/${IG_USER_ID}`, {
      fields: 'followers_count,media_count,username,name',
    })

    // Recent media
    const mediaRes = await igFetch(`/${IG_USER_ID}/media`, {
      fields: 'id,timestamp,media_type,like_count,comments_count,caption,permalink',
      limit: '50',
    })
    console.log('Instagram media response:', JSON.stringify(mediaRes).slice(0, 500))
    const media: any[] = mediaRes.data ?? []

    // Build video performance rows
    const videoPerformance = media.map((post: any) => {
      const likes = Number(post.like_count || 0)
      const comments = Number(post.comments_count || 0)
      const followers = Number(profile.followers_count || 1)
      const engagement = Math.round(((likes + comments) / followers) * 10000) / 100
      const isShort = post.media_type === 'VIDEO' || post.media_type === 'REEL'

      return {
        platform: 'Instagram',
        title: post.caption ? post.caption.slice(0, 100) : `${post.media_type} · ${post.id}`,
        views: likes, // Instagram Basic Display API doesn't expose impressions; use likes as proxy
        engagement_rate: engagement,
        watch_time_seconds: 0,
        ctr: 0,
        recorded_at: now,
        published_at: post.timestamp ?? null,
        is_short: isShort,
      }
    })

    // Clear old and write fresh
    await supabase.from('analytics_snapshots').delete().eq('platform', 'Instagram')
    await supabase.from('video_performance').delete().eq('platform', 'Instagram')

    const writes: any[] = [
      supabase.from('analytics_snapshots').insert([
        { platform: 'Instagram', metric_name: 'followers', metric_value: Number(profile.followers_count), recorded_at: now },
        { platform: 'Instagram', metric_name: 'total_posts', metric_value: Number(profile.media_count), recorded_at: now },
      ]),
    ]

    if (videoPerformance.length > 0) {
      writes.push(supabase.from('video_performance').insert(videoPerformance))
    }

    await Promise.all(writes)

    return NextResponse.json({
      success: true,
      username: profile.username,
      followers: Number(profile.followers_count).toLocaleString(),
      totalPosts: profile.media_count,
      mediaReturned: media.length,
      postsProcessed: videoPerformance.length,
      mediaDebug: mediaRes.error ?? null,
    })
  } catch (error: any) {
    console.error('Instagram sync error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
