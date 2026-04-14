import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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