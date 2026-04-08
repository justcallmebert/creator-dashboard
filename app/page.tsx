'use client'

import { useState, useEffect } from 'react'
import { useAuth, useVideos, useIdeas, useEvents, useTrends } from '@/src/lib/hooks'
import { STAGES, supabase } from '@/src/lib/supabase'

const TABS = ['Analytics', 'Production', 'Brainstorm', 'Performance', 'Trends']

function LoginModal({ onLogin, onClose }: { onLogin: (e: string, p: string) => Promise<any>, onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const handleSubmit = async () => { const err = await onLogin(email, password); if (err) setError(err.message) }
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 w-full max-w-sm shadow-lg">
        <h2 className="text-lg font-medium mb-4">Sign in to edit</h2>
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
        <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)}
          className="w-full mb-3 px-3 py-2 border rounded-lg text-sm dark:bg-neutral-800 dark:border-neutral-700" />
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          className="w-full mb-4 px-3 py-2 border rounded-lg text-sm dark:bg-neutral-800 dark:border-neutral-700" />
        <div className="flex gap-2">
          <button onClick={handleSubmit} className="flex-1 bg-neutral-900 dark:bg-white text-white dark:text-black py-2 rounded-lg text-sm font-medium">Sign in</button>
          <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">Cancel</button>
        </div>
      </div>
    </div>
  )
}

function AnalyticsTab() {
  const [metrics, setMetrics] = useState<any>(null)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)

  useEffect(() => { loadMetrics() }, [])

  const loadMetrics = async () => {
    const { data: subs } = await supabase.from('analytics_snapshots')
      .select('*').eq('platform', 'YouTube').eq('metric_name', 'subscribers')
      .order('recorded_at', { ascending: false }).limit(1)
    const { data: views } = await supabase.from('analytics_snapshots')
      .select('*').eq('platform', 'YouTube').eq('metric_name', 'total_views')
      .order('recorded_at', { ascending: false }).limit(1)
    const { data: vidCount } = await supabase.from('analytics_snapshots')
      .select('*').eq('platform', 'YouTube').eq('metric_name', 'total_videos')
      .order('recorded_at', { ascending: false }).limit(1)
    const { data: perfData } = await supabase.from('video_performance')
      .select('*').eq('platform', 'YouTube').order('recorded_at', { ascending: false }).limit(50)

    const totalEngagement = perfData && perfData.length > 0
      ? perfData.reduce((sum: number, v: any) => sum + Number(v.engagement_rate || 0), 0) / perfData.length
      : 0

    setMetrics({
      subscribers: subs?.[0]?.metric_value ?? '—',
      totalViews: views?.[0]?.metric_value ?? '—',
      totalVideos: vidCount?.[0]?.metric_value ?? '—',
      avgEngagement: totalEngagement > 0 ? totalEngagement.toFixed(2) + '%' : '—',
      recentVideos: perfData?.length ?? 0,
      lastRecorded: subs?.[0]?.recorded_at ?? null,
    })
    if (subs?.[0]?.recorded_at) {
      setLastSync(new Date(subs[0].recorded_at).toLocaleString())
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch('/api/sync-youtube')
      if (res.ok) { await loadMetrics() }
    } catch (e) { console.error(e) }
    setSyncing(false)
  }

  const fmt = (n: any) => {
    if (n === '—' || n === null || n === undefined) return '—'
    const num = Number(n)
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toLocaleString()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2 flex-wrap">
          <span className="px-3 py-1.5 rounded-lg text-sm font-medium bg-neutral-900 dark:bg-white text-white dark:text-black">YouTube</span>
          <span className="px-3 py-1.5 rounded-lg text-sm border border-neutral-200 dark:border-neutral-700 text-neutral-400">TikTok</span>
          <span className="px-3 py-1.5 rounded-lg text-sm border border-neutral-200 dark:border-neutral-700 text-neutral-400">Instagram</span>
        </div>
        <button onClick={handleSync} disabled={syncing}
          className="px-3 py-1.5 rounded-lg text-sm border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50">
          {syncing ? 'Syncing...' : 'Sync now'}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-3">
          <div className="text-xs text-neutral-500 mb-1">Subscribers</div>
          <div className="text-xl font-medium">{fmt(metrics?.subscribers)}</div>
        </div>
        <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-3">
          <div className="text-xs text-neutral-500 mb-1">Total views</div>
          <div className="text-xl font-medium">{fmt(metrics?.totalViews)}</div>
        </div>
        <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-3">
          <div className="text-xs text-neutral-500 mb-1">Total videos</div>
          <div className="text-xl font-medium">{fmt(metrics?.totalVideos)}</div>
        </div>
        <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-3">
          <div className="text-xs text-neutral-500 mb-1">Avg engagement</div>
          <div className="text-xl font-medium">{metrics?.avgEngagement ?? '—'}</div>
        </div>
      </div>

      {lastSync && <div className="text-xs text-neutral-400 mb-4">Last synced: {lastSync}</div>}

      <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-4 text-sm text-neutral-500">
        TikTok and Instagram APIs coming soon. YouTube is live — click "Sync now" to pull the latest data.
      </div>
    </div>
  )
}

function PerformanceTab() {
  const [top5, setTop5] = useState<any[]>([])
  const [bottom5, setBottom5] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('video_performance')
        .select('*').eq('platform', 'YouTube').order('views', { ascending: false })

      if (data && data.length > 0) {
        setTop5(data.slice(0, 5))
        setBottom5(data.slice(-5).reverse())
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="text-sm text-neutral-400">Loading performance data...</div>
  if (top5.length === 0) return (
    <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-4 text-sm text-neutral-500">
      No performance data yet. Go to Analytics and click "Sync now" to pull your YouTube data.
    </div>
  )

  const fmt = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
    return n.toLocaleString()
  }

  return (
    <div>
      <div className="mb-6">
        <div className="text-sm font-medium mb-3">Top 5 performing</div>
        {top5.map((v, i) => (
          <div key={v.id} className="flex items-center gap-3 p-3 mb-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
            <span className="text-base font-medium text-green-600 dark:text-green-400 min-w-[28px]">#{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{v.title || 'YouTube video'}</div>
              <div className="text-xs text-neutral-500">{v.platform}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium">{fmt(v.views)}</div>
              <div className="text-xs text-green-600 dark:text-green-400">{v.engagement_rate}% eng.</div>
            </div>
          </div>
        ))}
      </div>
      <div>
        <div className="text-sm font-medium mb-3">Lowest 5 performing</div>
        {bottom5.map((v, i) => (
          <div key={v.id} className="flex items-center gap-3 p-3 mb-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
            <span className="text-sm text-red-600 dark:text-red-400 min-w-[28px]">#{top5.length + bottom5.length - i}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{v.title || 'YouTube video'}</div>
              <div className="text-xs text-neutral-500">{v.platform}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium">{fmt(v.views)}</div>
              <div className="text-xs text-red-600 dark:text-red-400">{v.engagement_rate}% eng.</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ProductionTab({ isEditor }: { isEditor: boolean }) {
  const { videos, updateStage, addVideo } = useVideos()
  const { events } = useEvents()
  const today = new Date().toISOString().split('T')[0]
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [selectedDate, setSelectedDate] = useState<number | null>(null)
  const [editingVideo, setEditingVideo] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDue, setNewDue] = useState('')

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const firstDay = new Date(currentYear, currentMonth, 1).getDay()
  const monthName = new Date(currentYear, currentMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  const prevMonth = () => { if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) } else setCurrentMonth(m => m - 1) }
  const nextMonth = () => { if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) } else setCurrentMonth(m => m + 1) }

  const stageMap: Record<string, typeof STAGES[number]> = {}
  STAGES.forEach(s => { stageMap[s.id] = s })

  const overdue = videos.filter(v => v.due_date && v.due_date < today && v.stage !== 'posted')
  const stageCounts: Record<string, number> = {}
  STAGES.forEach(s => { stageCounts[s.id] = videos.filter(v => v.stage === s.id).length })

  const pad = (n: number) => String(n).padStart(2, '0')
  const makeDateStr = (day: number) => `${currentYear}-${pad(currentMonth + 1)}-${pad(day)}`
  const getItems = (day: number) => ({
    vids: videos.filter(v => v.due_date === makeDateStr(day)),
    evts: events.filter(e => e.date === makeDateStr(day)),
  })

  const days: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) days.push(d)

  const sel = selectedDate ? getItems(selectedDate) : null
  const selStr = selectedDate ? makeDateStr(selectedDate) : null

  const eventColors: Record<string, { bg: string, text: string }> = {
    deadline: { bg: 'bg-red-50 dark:bg-red-950', text: 'text-red-700 dark:text-red-400' },
    post: { bg: 'bg-green-50 dark:bg-green-950', text: 'text-green-700 dark:text-green-400' },
    event: { bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-700 dark:text-amber-400' },
  }

  const handleAdd = async () => {
    if (!newTitle.trim() || !newDue) return
    await addVideo(newTitle, newDue)
    setNewTitle(''); setNewDue(''); setShowAddForm(false)
  }

  return (
    <div>
      {overdue.length > 0 && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
          <div className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">
            Overdue — {overdue.length} video{overdue.length > 1 ? 's' : ''} behind schedule
          </div>
          {overdue.map(v => (
            <div key={v.id} className="text-xs text-red-600 dark:text-red-400 py-0.5">
              <span className="font-medium">{v.title}</span>
              <span className="opacity-70"> — stuck in {stageMap[v.stage]?.label}, due {new Date(v.due_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 mb-4">
        {STAGES.map(s => (
          <div key={s.id} className="flex items-center gap-1.5 text-xs bg-neutral-100 dark:bg-neutral-800 rounded-full px-2.5 py-1">
            <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: s.color }} />
            <span className="text-neutral-500">{s.label}</span>
            <span className="font-medium">{stageCounts[s.id]}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="px-3 py-1 border rounded-lg text-sm">&larr;</button>
        <span className="text-base font-medium">{monthName}</span>
        <div className="flex gap-2">
          {isEditor && (
            <button onClick={() => setShowAddForm(!showAddForm)} className="px-3 py-1 border rounded-lg text-sm">+ Add video</button>
          )}
          <button onClick={nextMonth} className="px-3 py-1 border rounded-lg text-sm">&rarr;</button>
        </div>
      </div>

      {showAddForm && isEditor && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <input placeholder="Video title" value={newTitle} onChange={e => setNewTitle(e.target.value)}
            className="flex-1 min-w-[160px] px-3 py-1.5 border rounded-lg text-sm dark:bg-neutral-800 dark:border-neutral-700" />
          <input type="date" value={newDue} onChange={e => setNewDue(e.target.value)}
            className="px-3 py-1.5 border rounded-lg text-sm dark:bg-neutral-800 dark:border-neutral-700" />
          <button onClick={handleAdd} className="px-4 py-1.5 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium">Add</button>
        </div>
      )}

      <div className="grid grid-cols-7 gap-0.5 mb-4">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="text-center text-[11px] text-neutral-400 font-medium py-1">{d}</div>
        ))}
        {days.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />
          const { vids, evts } = getItems(day)
          const ds = makeDateStr(day)
          const isToday = ds === today
          const isSel = selectedDate === day
          const isPast = ds < today
          const hasOverdue = vids.some(v => v.due_date && v.due_date < today && v.stage !== 'posted')
          return (
            <div key={day} onClick={() => setSelectedDate(isSel ? null : day)}
              className={`min-h-[72px] p-1 rounded-lg cursor-pointer transition-colors
                ${isSel ? 'bg-blue-50 dark:bg-blue-950 ring-1 ring-blue-300 dark:ring-blue-700' : isToday ? 'bg-neutral-100 dark:bg-neutral-800 ring-1 ring-blue-300 dark:ring-blue-600' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'}
                ${hasOverdue ? 'ring-1 ring-red-400' : ''}
                ${isPast && !hasOverdue ? 'opacity-40' : ''}`}>
              <div className={`text-xs text-center mb-0.5 ${isToday ? 'font-medium text-blue-600 dark:text-blue-400' : ''}`}>{day}</div>
              <div className="flex flex-col gap-0.5">
                {vids.slice(0, 2).map(v => {
                  const isOD = v.due_date !== null && v.due_date < today && v.stage !== 'posted'
                  return (
                    <div key={v.id} className="text-[9px] leading-tight px-1 py-0.5 rounded truncate font-medium"
                      style={{
                        background: isOD ? 'rgb(254 226 226)' : stageMap[v.stage]?.color + '18',
                        color: isOD ? 'rgb(185 28 28)' : stageMap[v.stage]?.color,
                        borderLeft: `2px solid ${isOD ? 'rgb(185 28 28)' : stageMap[v.stage]?.color}`,
                      }}>
                      {v.title.length > 14 ? v.title.slice(0, 13) + '\u2026' : v.title}
                    </div>
                  )
                })}
                {evts.slice(0, vids.length > 1 ? 1 : 2).map((ev, j) => (
                  <div key={`ev-${j}`} className={`text-[9px] leading-tight px-1 py-0.5 rounded truncate ${eventColors[ev.type]?.bg} ${eventColors[ev.type]?.text}`}>
                    {ev.title.length > 14 ? ev.title.slice(0, 13) + '\u2026' : ev.title}
                  </div>
                ))}
                {(vids.length + evts.length) > 3 && <div className="text-[9px] text-neutral-400 text-center">+{vids.length + evts.length - 3}</div>}
              </div>
            </div>
          )
        })}
      </div>

      {selectedDate && sel && (
        <div className="bg-neutral-100 dark:bg-neutral-800 rounded-xl p-4">
          <div className="text-sm font-medium mb-3">
            {selStr && new Date(selStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          {sel.vids.length > 0 && (
            <div className="mb-3">
              <div className="text-[11px] text-neutral-400 uppercase tracking-wide mb-2">Videos</div>
              {sel.vids.map(v => {
                const stage = stageMap[v.stage]
                const isOD = v.due_date !== null && v.due_date < today && v.stage !== 'posted'
                return (
                  <div key={v.id} className={`flex items-center gap-3 p-3 mb-1.5 bg-white dark:bg-neutral-900 rounded-lg ${isOD ? 'ring-1 ring-red-400' : 'border border-neutral-200 dark:border-neutral-700'}`}>
                    <div className="w-1 h-9 rounded-sm flex-shrink-0" style={{ background: isOD ? '#A32D2D' : stage?.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{v.title}</div>
                      <div className={`text-xs ${isOD ? 'text-red-600 dark:text-red-400' : 'text-neutral-500'}`}>
                        <div className={`text-xs ${isOD ? 'text-red-600 dark:text-red-400' : 'text-neutral-500'}`}>
                        {isOD ? 'Overdue \u2014 ' : ''}{stage?.label}
                        {v.assigned_to && ` \u00b7 ${v.assigned_to}`}
                      </div>
                      {v.drive_link ? (
                        <a href={v.drive_link} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline mt-0.5 inline-block" onClick={e => e.stopPropagation()}>
                          Open in Drive
                        </a>
                      ) : isEditor ? (
                        <button className="text-xs text-neutral-400 hover:text-blue-500 mt-0.5"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const link = prompt('Paste Google Drive folder link:');
                            if (link) { await supabase.from('videos').update({ drive_link: link }).eq('id', v.id); window.location.reload(); }
                          }}>
                          + Add Drive link
                        </button>
                      ) : null}
                        {v.assigned_to && ` \u00b7 ${v.assigned_to}`}
                      </div>
                    </div>
                    {isEditor && editingVideo === v.id ? (
                      <div className="flex flex-wrap gap-1">
                        {STAGES.map(s => (
                          <button key={s.id} onClick={() => { updateStage(v.id, s.id); setEditingVideo(null) }}
                            className="px-2 py-0.5 text-[10px] rounded-full border transition"
                            style={{
                              background: v.stage === s.id ? s.color : 'transparent',
                              color: v.stage === s.id ? '#fff' : 'inherit',
                              borderColor: s.color + '66',
                            }}>
                            {s.label}
                          </button>
                        ))}
                      </div>
                    ) : isEditor ? (
                      <button onClick={() => setEditingVideo(v.id)}
                        className="px-2.5 py-1 text-xs rounded-full border"
                        style={{ borderColor: stage?.color + '44', color: stage?.color }}>
                        {stage?.label} &#9662;
                      </button>
                    ) : (
                      <span className="px-2.5 py-1 text-xs rounded-full" style={{ background: stage?.color + '18', color: stage?.color }}>
                        {stage?.label}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {sel.evts.length > 0 && (
            <div>
              <div className="text-[11px] text-neutral-400 uppercase tracking-wide mb-2">Events</div>
              {sel.evts.map(ev => (
                <div key={ev.id} className="flex items-center gap-3 p-2.5 mb-1 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${eventColors[ev.type]?.bg} ${eventColors[ev.type]?.text}`}>{ev.type}</span>
                  <span className="text-sm">{ev.title}</span>
                </div>
              ))}
            </div>
          )}
          {sel.vids.length === 0 && sel.evts.length === 0 && (
            <div className="text-sm text-neutral-400">Nothing scheduled</div>
          )}
        </div>
      )}
    </div>
  )
}

const CONTENT_TAGS = ['Challenge', 'Vlog', 'Adventure', 'Holiday', 'Pretend Play', 'Game', 'Skit']
const PLATFORMS = ['All', 'YouTube', 'Short', 'TikTok', 'Reel', 'Ideas']
const IDEA_PLATFORMS = ['YouTube', 'Short', 'TikTok', 'Reel']

const PLATFORM_STYLES: Record<string, { bg: string; text: string }> = {
  YouTube: { bg: 'bg-red-100 dark:bg-red-950', text: 'text-red-600 dark:text-red-400' },
  Short: { bg: 'bg-orange-100 dark:bg-orange-950', text: 'text-orange-600 dark:text-orange-400' },
  TikTok: { bg: 'bg-neutral-200 dark:bg-neutral-700', text: 'text-neutral-700 dark:text-neutral-200' },
  Reel: { bg: 'bg-purple-100 dark:bg-purple-950', text: 'text-purple-600 dark:text-purple-400' },
}

function detectPlatform(url: string): 'YouTube' | 'Short' | 'TikTok' | 'Reel' | null {
  if (!url) return null
  if (url.includes('youtube.com/shorts/')) return 'Short'
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'YouTube'
  if (url.includes('tiktok.com')) return 'TikTok'
  if (url.includes('instagram.com')) return 'Reel'
  return null
}

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:v=|youtu\.be\/|shorts\/)([a-zA-Z0-9_-]{11})/)
  return m?.[1] ?? null
}

function BrainstormTab({ isEditor }: { isEditor: boolean }) {
  const { ideas, addIdea, updateIdea, vote, deleteIdea } = useIdeas()
  const [platformFilter, setPlatformFilter] = useState('All')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [tagsOpen, setTagsOpen] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [newText, setNewText] = useState('')
  const [newUrl, setNewUrl] = useState('')
  const [newTags, setNewTags] = useState<string[]>([])
  const [newNotes, setNewNotes] = useState('')
  const [newPlatform, setNewPlatform] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<string | null>(null)
  const [editData, setEditData] = useState({ text: '', notes: '', tags: [] as string[], platform: '', url: '' })

  const detectedPlatform = detectPlatform(newUrl)

  const handleAdd = async () => {
    if (!newText.trim()) return
    const platformToSave = newUrl ? detectedPlatform : (newPlatform || null)
    await addIdea(newText, newTags, newUrl.trim() || null, newNotes.trim() || null, platformToSave)
    setNewText(''); setNewUrl(''); setNewTags([]); setNewNotes(''); setNewPlatform(''); setShowForm(false)
  }

  const startEdit = (idea: any) => {
    setEditing(idea.id)
    setEditData({ text: idea.text, notes: idea.notes ?? '', tags: idea.tags, platform: idea.platform ?? '', url: idea.url ?? '' })
  }

  const saveEdit = async (id: string) => {
    const urlPlatform = editData.url ? detectPlatform(editData.url) : null
    const platformToSave = editData.url ? urlPlatform : (editData.platform || null)
    await updateIdea(id, { text: editData.text, notes: editData.notes.trim() || null, tags: editData.tags, platform: platformToSave, url: editData.url.trim() || null })
    setEditing(null)
  }

  const toggleExpand = (id: string) => setExpanded(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  const toggleNewTag = (t: string) => setNewTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  const toggleEditTag = (t: string) => setEditData(prev => ({ ...prev, tags: prev.tags.includes(t) ? prev.tags.filter(x => x !== t) : [...prev.tags, t] }))

  const filtered = [...ideas]
    .filter(idea => {
      const urlPlatform = idea.url ? detectPlatform(idea.url) : null
      const platform = idea.platform ?? urlPlatform
      if (platformFilter === 'Ideas') return !platform
      if (platformFilter !== 'All') return platform === platformFilter
      return true
    })
    .filter(idea => !tagFilter || idea.tags.includes(tagFilter))
    .sort((a, b) => b.votes - a.votes)

  return (
    <div>
      {/* Platform filter */}
      <div className="flex gap-1 mb-3 flex-wrap">
        {PLATFORMS.map(p => (
          <button key={p} onClick={() => setPlatformFilter(p)}
            className={`px-3 py-1.5 rounded-lg text-sm transition ${platformFilter === p
              ? 'bg-neutral-900 dark:bg-white text-white dark:text-black font-medium'
              : 'border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}>
            {p}
          </button>
        ))}
      </div>

      {/* Tags collapsible filter */}
      <div className="mb-4">
        <button onClick={() => setTagsOpen(v => !v)}
          className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 mb-1.5">
          <span>Filter by tag</span>
          <span className="text-xs">{tagsOpen ? '▲' : '▼'}</span>
          {tagFilter && <span className="ml-1 text-xs px-2 py-0.5 bg-blue-600 text-white rounded-full">{tagFilter} ×</span>}
        </button>
        {tagsOpen && (
          <div className="flex gap-1.5 flex-wrap">
            {CONTENT_TAGS.map(t => (
              <button key={t} onClick={() => setTagFilter(tagFilter === t ? null : t)}
                className={`px-2.5 py-1 rounded-full text-xs transition ${tagFilter === t
                  ? 'bg-blue-600 text-white'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700'}`}>
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Add form */}
      {isEditor && (
        <div className="mb-5">
          {!showForm ? (
            <button onClick={() => setShowForm(true)}
              className="px-3 py-1.5 border rounded-lg text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">
              + Add idea
            </button>
          ) : (
            <div className="bg-neutral-100 dark:bg-neutral-800 rounded-xl p-4 flex flex-col gap-3">
              <input value={newText} onChange={e => setNewText(e.target.value)}
                placeholder="Idea title *"
                className="px-3 py-2 border rounded-lg text-sm dark:bg-neutral-900 dark:border-neutral-700 w-full" />
              <textarea value={newNotes} onChange={e => setNewNotes(e.target.value)}
                placeholder="Context / notes (optional)"
                rows={2}
                className="px-3 py-2 border rounded-lg text-sm dark:bg-neutral-900 dark:border-neutral-700 w-full resize-none" />
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-neutral-500">Platform:</span>
                {IDEA_PLATFORMS.map(p => (
                  <button key={p} type="button" onClick={() => setNewPlatform(newPlatform === p ? '' : p)}
                    className={`px-2.5 py-1 rounded-full text-xs transition ${newPlatform === p
                      ? `${PLATFORM_STYLES[p]?.bg} ${PLATFORM_STYLES[p]?.text} font-medium`
                      : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500 hover:bg-neutral-300 dark:hover:bg-neutral-600'}`}>
                    {p}
                  </button>
                ))}
              </div>
              <div className="relative">
                <input value={newUrl} onChange={e => setNewUrl(e.target.value)}
                  placeholder="Paste YouTube, TikTok, or Reels link (optional)"
                  className="px-3 py-2 border rounded-lg text-sm dark:bg-neutral-900 dark:border-neutral-700 w-full pr-24" />
                {detectedPlatform && (
                  <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[11px] px-2 py-0.5 rounded-full font-medium ${PLATFORM_STYLES[detectedPlatform]?.bg} ${PLATFORM_STYLES[detectedPlatform]?.text}`}>
                    {detectedPlatform}
                  </span>
                )}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {CONTENT_TAGS.map(t => (
                  <button key={t} onClick={() => toggleNewTag(t)}
                    className={`px-2.5 py-1 rounded-full text-xs transition ${newTags.includes(t)
                      ? 'bg-blue-600 text-white'
                      : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600'}`}>
                    {t}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={handleAdd}
                  className="px-4 py-1.5 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium">
                  Add
                </button>
                <button onClick={() => { setShowForm(false); setNewText(''); setNewUrl(''); setNewTags([]); setNewNotes(''); setNewPlatform('') }}
                  className="px-4 py-1.5 border rounded-lg text-sm">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ideas 3-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(idea => {
          const urlPlatform = idea.url ? detectPlatform(idea.url) : null
          const platform = idea.platform ?? urlPlatform
          const ytId = idea.url ? getYouTubeId(idea.url) : null
          const ps = platform ? PLATFORM_STYLES[platform] : null
          const isExpanded = expanded.has(idea.id)
          const isEditMode = editing === idea.id

          return (
            <div key={idea.id} className="flex flex-col p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
              {isEditMode ? (
                <div className="flex flex-col gap-2">
                  <input value={editData.text} onChange={e => setEditData(p => ({ ...p, text: e.target.value }))}
                    className="px-2 py-1.5 border rounded-lg text-sm dark:bg-neutral-900 dark:border-neutral-700 w-full" />
                  <textarea value={editData.notes} onChange={e => setEditData(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Notes / context"
                    rows={2}
                    className="px-2 py-1.5 border rounded-lg text-sm dark:bg-neutral-900 dark:border-neutral-700 w-full resize-none" />
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-neutral-500">Platform:</span>
                    {IDEA_PLATFORMS.map(p => (
                      <button key={p} type="button" onClick={() => setEditData(prev => ({ ...prev, platform: prev.platform === p ? '' : p }))}
                        className={`px-2 py-0.5 rounded-full text-xs transition ${editData.platform === p
                          ? `${PLATFORM_STYLES[p]?.bg} ${PLATFORM_STYLES[p]?.text} font-medium`
                          : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500'}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {CONTENT_TAGS.map(t => (
                      <button key={t} onClick={() => toggleEditTag(t)}
                        className={`px-2 py-0.5 rounded-full text-xs transition ${editData.tags.includes(t) ? 'bg-blue-600 text-white' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                  <input value={editData.url} onChange={e => setEditData(p => ({ ...p, url: e.target.value }))}
                    placeholder="URL (optional)"
                    className="px-2 py-1.5 border rounded-lg text-sm dark:bg-neutral-900 dark:border-neutral-700 w-full" />
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(idea.id)}
                      className="px-3 py-1 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-lg text-xs font-medium">
                      Save
                    </button>
                    <button onClick={() => setEditing(null)}
                      className="px-3 py-1 border rounded-lg text-xs">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Title row with vote button */}
                  <div className="flex gap-2.5 mb-2">
                    <button onClick={() => isEditor && vote(idea.id, idea.votes)} disabled={!isEditor}
                      className={`flex flex-col items-center justify-start min-w-[40px] pt-1 px-1.5 rounded-lg border text-center transition flex-shrink-0
                        ${isEditor ? 'cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700' : 'cursor-default'}`}>
                      <span className="text-sm leading-none">▲</span>
                      <span className="text-sm font-medium leading-tight mt-0.5">{idea.votes}</span>
                      <span className="text-[9px] text-neutral-400 leading-tight">votes</span>
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap mb-1">
                        {platform && ps && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ps.bg} ${ps.text}`}>{platform}</span>
                        )}
                        {idea.tags.slice(0, 2).map(t => (
                          <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">{t}</span>
                        ))}
                        {idea.tags.length > 2 && <span className="text-[10px] text-neutral-400">+{idea.tags.length - 2}</span>}
                      </div>
                      <div className="text-sm font-medium leading-snug">{idea.text}</div>
                    </div>
                  </div>

                  {/* YouTube thumbnail */}
                  {ytId && (
                    <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt=""
                      className="w-full h-28 object-cover rounded-lg mb-2 flex-shrink-0" />
                  )}

                  {/* Expanded: notes + URL */}
                  {isExpanded && (
                    <div className="mb-2 pt-2 border-t border-neutral-200 dark:border-neutral-700">
                      {idea.notes ? (
                        <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">{idea.notes}</p>
                      ) : (
                        <p className="text-xs text-neutral-400 italic">No notes added.</p>
                      )}
                      {idea.url && (
                        <a href={idea.url} target="_blank" rel="noopener noreferrer"
                          className="text-[11px] text-blue-500 hover:underline truncate block mt-1.5">
                          {idea.url}
                        </a>
                      )}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center gap-3 mt-auto pt-1">
                    <button onClick={() => toggleExpand(idea.id)}
                      className="text-[11px] text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">
                      {isExpanded ? '▲ Less' : '▼ More'}
                    </button>
                    {isEditor && (
                      <>
                        <button onClick={() => startEdit(idea)}
                          className="text-[11px] text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">
                          Edit
                        </button>
                        <button onClick={() => deleteIdea(idea.id)}
                          className="text-[11px] text-red-400 hover:text-red-600 ml-auto">
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-sm text-neutral-400 text-center py-8">No ideas yet for this filter.</div>
      )}
    </div>
  )
}

const BLANK_TREND = { title: '', creator: '', views: '', demographic: '', insight: '', source_url: '' }

type Period = '7d' | '30d' | '90d'
const PERIODS: { id: Period; label: string }[] = [
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
]

function TrendsTab({ isEditor }: { isEditor: boolean }) {
  const { trends, loading, addTrend, deleteTrend } = useTrends()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(BLANK_TREND)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('30d')

  const runSync = async (p: Period = period) => {
    setSyncing(true)
    setSyncError(null)
    try {
      const res = await fetch(`/api/sync-trends?period=${p}`)
      const json = await res.json()
      if (!res.ok) setSyncError(json.error ?? 'Sync failed')
    } catch (e: any) {
      setSyncError(e.message)
    }
    setSyncing(false)
  }

  useEffect(() => {
    if (!loading) runSync(period)
  }, [loading])

  const handlePeriodChange = (p: Period) => {
    setPeriod(p)
    runSync(p)
  }

  const set = (k: keyof typeof BLANK_TREND, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleAdd = async () => {
    if (!form.title.trim()) return
    await addTrend({
      title: form.title,
      creator: form.creator || null,
      views: form.views || null,
      demographic: form.demographic || null,
      insight: form.insight || null,
      source_url: form.source_url || null,
    })
    setForm(BLANK_TREND)
    setShowForm(false)
  }

  if (loading || (syncing && trends.length === 0)) return <div className="text-sm text-neutral-400">Loading trends...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button key={p.id} onClick={() => handlePeriodChange(p.id)} disabled={syncing}
              className={`px-3 py-1.5 rounded-lg text-sm transition disabled:opacity-50 ${period === p.id
                ? 'bg-neutral-900 dark:bg-white text-white dark:text-black font-medium'
                : 'border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => runSync(period)} disabled={syncing}
            className="px-3 py-1.5 border rounded-lg text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50">
            {syncing ? 'Syncing...' : 'Sync from YouTube'}
          </button>
          {isEditor && (
            <button onClick={() => setShowForm(!showForm)}
              className="px-3 py-1.5 border rounded-lg text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800">
              {showForm ? 'Cancel' : '+ Add trend'}
            </button>
          )}
        </div>
      </div>

      {showForm && isEditor && (
        <div className="bg-neutral-100 dark:bg-neutral-800 rounded-xl p-4 mb-5 flex flex-col gap-3">
          <div className="text-sm font-medium mb-1">New trend entry</div>
          <input placeholder="Title / topic *" value={form.title} onChange={e => set('title', e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm dark:bg-neutral-900 dark:border-neutral-700 w-full" />
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Creator / channel" value={form.creator} onChange={e => set('creator', e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm dark:bg-neutral-900 dark:border-neutral-700" />
            <input placeholder="View count (e.g. 2.4M)" value={form.views} onChange={e => set('views', e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm dark:bg-neutral-900 dark:border-neutral-700" />
          </div>
          <input placeholder="Target demographic" value={form.demographic} onChange={e => set('demographic', e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm dark:bg-neutral-900 dark:border-neutral-700 w-full" />
          <textarea placeholder="Tactical insight — what made this work?" value={form.insight} onChange={e => set('insight', e.target.value)}
            rows={3} className="px-3 py-2 border rounded-lg text-sm dark:bg-neutral-900 dark:border-neutral-700 w-full resize-none" />
          <input placeholder="Source URL (optional)" value={form.source_url} onChange={e => set('source_url', e.target.value)}
            className="px-3 py-2 border rounded-lg text-sm dark:bg-neutral-900 dark:border-neutral-700 w-full" />
          <button onClick={handleAdd}
            className="self-start px-4 py-2 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium">
            Save
          </button>
        </div>
      )}

      {syncError && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4 text-sm text-red-700 dark:text-red-400">
          Sync error: {syncError}
        </div>
      )}

      {trends.length === 0 && !showForm && !syncError && (
        <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-4 text-sm text-neutral-500">
          No trends yet.{isEditor ? ' Click "+ Add trend" to log niche research.' : ''}
        </div>
      )}

      {trends.map(t => {
        const isOpen = expanded === t.id
        return (
          <div key={t.id} className="mb-2 bg-neutral-100 dark:bg-neutral-800 rounded-xl overflow-hidden">
            <button className="w-full flex items-center gap-3 p-3 text-left" onClick={() => setExpanded(isOpen ? null : t.id)}>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{t.title}</div>
                <div className="flex gap-3 mt-0.5 flex-wrap">
                  {t.creator && <span className="text-xs text-neutral-500">{t.creator}</span>}
                  {t.views && <span className="text-xs text-neutral-500">{t.views} views</span>}
                  {t.demographic && <span className="text-xs text-blue-500 dark:text-blue-400">{t.demographic}</span>}
                </div>
              </div>
              <span className="text-neutral-400 text-xs">{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
              <div className="px-4 pb-4 border-t border-neutral-200 dark:border-neutral-700 pt-3">
                {t.insight && (
                  <div className="mb-3">
                    <div className="text-[11px] text-neutral-400 uppercase tracking-wide mb-1">Insight</div>
                    <div className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">{t.insight}</div>
                  </div>
                )}
                {t.source_url && (
                  <a href={t.source_url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline break-all">
                    {t.source_url}
                  </a>
                )}
                {isEditor && (
                  <button onClick={() => deleteTrend(t.id)}
                    className="mt-3 text-xs text-red-500 hover:underline block">
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function Dashboard() {
  const { user, loading, signIn, signOut, isEditor } = useAuth()
  const [tab, setTab] = useState('Production')

  useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (TABS.includes(hash)) setTab(hash)
  }, [])

  const switchTab = (t: string) => {
    setTab(t)
    window.location.hash = t
  }
  const [showLogin, setShowLogin] = useState(false)

  const renderTab = () => {
    switch (tab) {
      case 'Analytics': return <AnalyticsTab />
      case 'Production': return <ProductionTab isEditor={isEditor} />
      case 'Brainstorm': return <BrainstormTab isEditor={isEditor} />
      case 'Performance': return <PerformanceTab />
      case 'Trends': return <TrendsTab isEditor={isEditor} />
      default: return null
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-4 font-sans">
      <div className="sticky top-0 z-20 pt-6 w-full" style={{ background: 'var(--background)' }}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-medium">Creator command center</h1>
          <div className="flex items-center gap-2">
            {isEditor ? (
              <>
                <span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 px-2 py-0.5 rounded-full">Editor</span>
                <button onClick={signOut} className="text-xs text-neutral-500 hover:text-neutral-700">Sign out</button>
              </>
            ) : (
              <>
                <span className="text-xs text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">Viewing</span>
                <button onClick={() => setShowLogin(true)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Sign in to edit</button>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-1 mb-0 flex-wrap border-b border-neutral-200 dark:border-neutral-700 pb-2.5">
          {TABS.map(t => (
            <button key={t} onClick={() => switchTab(t)}
              className={`px-3 py-1.5 rounded-lg text-sm transition ${tab === t
                ? 'bg-neutral-900 dark:bg-white text-white dark:text-black font-medium'
                : 'text-neutral-500 hover:text-neutral-700'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="pt-5">
        {renderTab()}
      </div>
      {showLogin && <LoginModal onLogin={signIn} onClose={() => setShowLogin(false)} />}
    </div>
  )
}