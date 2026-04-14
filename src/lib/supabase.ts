import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_supabase) {
      _supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    }
    const val = (_supabase as any)[prop]
    return typeof val === 'function' ? val.bind(_supabase) : val
  },
})

export type DriveLink = { label: string; url: string }

export type Video = {
  id: string
  title: string
  stage: string
  due_date: string | null
  notes: string | null
  assigned_to: string | null
  created_at: string
  updated_at: string
  drive_link: string | null
  drive_links: DriveLink[]
}

export type Idea = {
  id: string
  text: string
  tags: string[]
  votes: number
  created_by: string | null
  created_at: string
  url: string | null
  notes: string | null
  platform: string | null
}

export type CalendarEvent = {
  id: string
  title: string
  date: string
  type: string
  notes: string | null
  created_at: string
}

export type AnalyticsSnapshot = {
  id: string
  platform: string
  metric_name: string
  metric_value: number
  recorded_at: string
}

export type VideoPerformance = {
  id: string
  video_id: string
  platform: string
  views: number
  engagement_rate: number
  watch_time_seconds: number
  ctr: number
  recorded_at: string
}

export type NicheTrend = {
  id: string
  title: string
  creator: string | null
  views: string | null
  demographic: string | null
  insight: string | null
  source_url: string | null
  added_at: string
}

export type AppNotification = {
  id: string
  type: string
  message: string
  read: boolean
  created_at: string
}

export type WhiteboardSnapshot = {
  id: string
  image_url: string
  captured_at: string
  extracted_text: string | null
  notes: string | null
  created_at: string
}

export const STAGES = [
  { id: 'ideation', label: 'Ideation', color: '#7F77DD' },
  { id: 'recorded', label: 'Recorded', color: '#1D9E75' },
  { id: 'edit1', label: '1st edit', color: '#378ADD' },
  { id: 'edit2', label: '2nd edit', color: '#D85A30' },
  { id: 'edit3', label: 'Final edit', color: '#D4537E' },
  { id: 'captions', label: 'Captions', color: '#639922' },
  { id: 'posted', label: 'Posted', color: '#888780' },
] as const

export type Stage = typeof STAGES[number]['id']