import { useState, useEffect } from 'react'
import { supabase, Video, Idea, CalendarEvent, NicheTrend, WhiteboardSnapshot } from './supabase'

async function slackNotify(payload: Record<string, any>) {
  try {
    await fetch('/api/notify-slack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (e) {
    // notifications are best-effort, never block the UI
  }
}

export function useAuth() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return error
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return { user, loading, signIn, signOut, isEditor: !!user }
}

export function useVideos() {
  const [videos, setVideos] = useState<Video[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('videos').select('*').order('due_date').then(({ data }) => {
      if (data) setVideos(data)
      setLoading(false)
    })

    const channel = supabase
      .channel('videos-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'videos' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setVideos(prev => [...prev, payload.new as Video].sort((a, b) =>
            (a.due_date ?? '').localeCompare(b.due_date ?? '')))
        } else if (payload.eventType === 'UPDATE') {
          setVideos(prev => prev.map(v => v.id === (payload.new as Video).id ? payload.new as Video : v))
        } else if (payload.eventType === 'DELETE') {
          setVideos(prev => prev.filter(v => v.id !== (payload.old as Video).id))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const updateStage = async (id: string, stage: string) => {
    await supabase.from('videos').update({ stage, updated_at: new Date().toISOString() }).eq('id', id)
    const video = videos.find(v => v.id === id)
    if (video) slackNotify({ type: 'stage_change', title: video.title, stage, assignedTo: video.assigned_to })
  }

  const addVideo = async (title: string, dueDate: string, stage = 'ideation') => {
    await supabase.from('videos').insert({ title, due_date: dueDate, stage })
    slackNotify({ type: 'video_added', title, dueDate })
  }

  const deleteVideo = async (id: string) => {
    await supabase.from('videos').delete().eq('id', id)
  }

  return { videos, loading, updateStage, addVideo, deleteVideo }
}

export function useIdeas() {
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('ideas').select('*').order('votes', { ascending: false }).then(({ data }) => {
      if (data) setIdeas(data)
      setLoading(false)
    })

    const channel = supabase
      .channel('ideas-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ideas' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setIdeas(prev => [payload.new as Idea, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setIdeas(prev => prev.map(i => i.id === (payload.new as Idea).id ? payload.new as Idea : i))
        } else if (payload.eventType === 'DELETE') {
          setIdeas(prev => prev.filter(i => i.id !== (payload.old as Idea).id))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const addIdea = async (text: string, tags: string[] = [], url: string | null = null, notes: string | null = null, platform: string | null = null) => {
    await supabase.from('ideas').insert({ text, tags, url, notes, platform })
  }

  const updateIdea = async (id: string, updates: { text?: string; tags?: string[]; url?: string | null; notes?: string | null; platform?: string | null }) => {
    await supabase.from('ideas').update(updates).eq('id', id)
  }

  const vote = async (id: string, currentVotes: number) => {
    await supabase.from('ideas').update({ votes: currentVotes + 1 }).eq('id', id)
  }

  const deleteIdea = async (id: string) => {
    await supabase.from('ideas').delete().eq('id', id)
  }

  return { ideas, loading, addIdea, updateIdea, vote, deleteIdea }
}

export function useEvents() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('events').select('*').order('date').then(({ data }) => {
      if (data) setEvents(data)
      setLoading(false)
    })

    const channel = supabase
      .channel('events-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setEvents(prev => [...prev, payload.new as CalendarEvent].sort((a, b) => a.date.localeCompare(b.date)))
        } else if (payload.eventType === 'UPDATE') {
          setEvents(prev => prev.map(e => e.id === (payload.new as CalendarEvent).id ? payload.new as CalendarEvent : e))
        } else if (payload.eventType === 'DELETE') {
          setEvents(prev => prev.filter(e => e.id !== (payload.old as CalendarEvent).id))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const addEvent = async (title: string, date: string, type = 'event') => {
    await supabase.from('events').insert({ title, date, type })
  }

  const deleteEvent = async (id: string) => {
    await supabase.from('events').delete().eq('id', id)
  }

  return { events, loading, addEvent, deleteEvent }
}

export function useTrends() {
  const [trends, setTrends] = useState<NicheTrend[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('niche_trends').select('*').order('added_at', { ascending: false }).then(({ data }) => {
      if (data) setTrends(data)
      setLoading(false)
    })

    const channel = supabase
      .channel('trends-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'niche_trends' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setTrends(prev => [payload.new as NicheTrend, ...prev])
        } else if (payload.eventType === 'DELETE') {
          setTrends(prev => prev.filter(t => t.id !== (payload.old as NicheTrend).id))
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const addTrend = async (trend: Omit<NicheTrend, 'id' | 'added_at'>) => {
    await supabase.from('niche_trends').insert(trend)
  }

  const deleteTrend = async (id: string) => {
    await supabase.from('niche_trends').delete().eq('id', id)
  }

  return { trends, loading, addTrend, deleteTrend }
}

export function useWhiteboardSnapshots() {
  const [snapshots, setSnapshots] = useState<WhiteboardSnapshot[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('whiteboard_snapshots').select('*').order('captured_at', { ascending: false }).then(({ data }) => {
      if (data) setSnapshots(data)
      setLoading(false)
    })
  }, [])

  const addSnapshot = async (snapshot: Omit<WhiteboardSnapshot, 'id' | 'created_at'>) => {
    const { data, error } = await supabase.from('whiteboard_snapshots').insert(snapshot).select().single()
    if (data) setSnapshots(prev => [data, ...prev])
    return { data, error }
  }

  const updateSnapshot = async (id: string, updates: { notes?: string; extracted_text?: string }) => {
    await supabase.from('whiteboard_snapshots').update(updates).eq('id', id)
    setSnapshots(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s))
  }

  const deleteSnapshot = async (id: string, imageUrl: string) => {
    const path = imageUrl.split('/whiteboard-photos/')[1]
    if (path) await supabase.storage.from('whiteboard-photos').remove([path])
    await supabase.from('whiteboard_snapshots').delete().eq('id', id)
    setSnapshots(prev => prev.filter(s => s.id !== id))
  }

  return { snapshots, loading, addSnapshot, updateSnapshot, deleteSnapshot }
}