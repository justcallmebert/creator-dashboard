'use client'

import { useState, useEffect } from 'react'
import { useAuth, useVideos, useIdeas, useEvents, useTrends, useWhiteboardSnapshots, useNotifications } from '@/src/lib/hooks'
import { STAGES, supabase } from '@/src/lib/supabase'

const TABS = ['Analytics', 'Production', 'Brainstorm', 'Performance', 'Trends', 'Whiteboard']

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
  const [platform, setPlatform] = useState<'YouTube' | 'Instagram' | 'TikTok'>('YouTube')
  const [snapshots, setSnapshots] = useState<Record<string, any>>({})
  const [perfData, setPerfData] = useState<any[]>([])
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)
  // TikTok manual entry
  const [ttFollowers, setTtFollowers] = useState('')
  const [ttLikes, setTtLikes] = useState('')
  const [ttVideoCount, setTtVideoCount] = useState('')
  const [ttAvgViews, setTtAvgViews] = useState('')
  const [ttAvgEngagement, setTtAvgEngagement] = useState('')
  const [ttSaving, setTtSaving] = useState(false)

  const fmt = (n: any) => {
    if (n === '—' || n === null || n === undefined) return '—'
    const num = Number(n)
    if (isNaN(num)) return '—'
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toLocaleString()
  }

  const loadData = async (p: string) => {
    const { data: snaps } = await supabase.from('analytics_snapshots').select('*').eq('platform', p).order('recorded_at', { ascending: false })
    const { data: perf } = await supabase.from('video_performance').select('*').eq('platform', p).order('published_at', { ascending: false })
    const snap: Record<string, any> = {}
    snaps?.forEach((s: any) => { if (!snap[s.metric_name]) snap[s.metric_name] = s })
    setSnapshots(snap)
    setPerfData(perf ?? [])
    const latest = snaps?.[0]?.recorded_at
    setLastSync(latest ? new Date(latest).toLocaleString() : null)
  }

  useEffect(() => { loadData(platform) }, [platform])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const endpoint = platform === 'YouTube' ? '/api/sync-youtube' : platform === 'Instagram' ? '/api/sync-instagram' : null
      if (endpoint) {
        const res = await fetch(endpoint)
        if (res.ok) await loadData(platform)
        else { const j = await res.json(); alert('Sync error: ' + (j.error ?? 'Unknown')) }
      }
    } catch (e: any) { alert('Sync error: ' + e.message) }
    setSyncing(false)
  }

  const saveTikTok = async () => {
    setTtSaving(true)
    await fetch('/api/sync-tiktok', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
      followers: Number(ttFollowers) || 0,
      totalLikes: Number(ttLikes) || 0,
      videoCount: Number(ttVideoCount) || 0,
      avgViews: Number(ttAvgViews) || 0,
      avgEngagement: Number(ttAvgEngagement) || 0,
    }) })
    await loadData('TikTok')
    setTtSaving(false)
  }

  // ── Monthly breakdown (YouTube + Instagram) ────────────────────────
  const monthlyData = (() => {
    const map: Record<string, any> = {}
    perfData.forEach(v => {
      if (!v.published_at) return
      const d = new Date(v.published_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
      if (!map[key]) map[key] = { month: label, total: 0, shorts: 0, longform: 0, views: 0, engagement: [] }
      map[key].total++
      if (v.is_short) map[key].shorts++; else map[key].longform++
      map[key].views += Number(v.views || 0)
      if (v.engagement_rate) map[key].engagement.push(Number(v.engagement_rate))
    })
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a)).slice(0, 6).map(([, v]) => ({
      ...v,
      avgEngagement: v.engagement.length > 0 ? (v.engagement.reduce((a: number, b: number) => a + b, 0) / v.engagement.length).toFixed(1) : '—',
    }))
  })()

  // ── Post timing ────────────────────────────────────────────────────
  const shorts = perfData.filter(v => v.is_short && v.published_at)
  const hourBuckets: Record<string, { label: string; count: number; views: number }> = {
    '0-6': { label: 'Midnight–6am', count: 0, views: 0 },
    '6-10': { label: '6am–10am', count: 0, views: 0 },
    '10-14': { label: '10am–2pm', count: 0, views: 0 },
    '14-18': { label: '2pm–6pm', count: 0, views: 0 },
    '18-24': { label: '6pm–Midnight', count: 0, views: 0 },
  }
  shorts.forEach(v => {
    const h = new Date(v.published_at).getHours()
    const bucket = h < 6 ? '0-6' : h < 10 ? '6-10' : h < 14 ? '10-14' : h < 18 ? '14-18' : '18-24'
    hourBuckets[bucket].count++
    hourBuckets[bucket].views += Number(v.views || 0)
  })
  const timingRows = Object.values(hourBuckets).filter(b => b.count > 0).sort((a, b) => (b.views / Math.max(b.count, 1)) - (a.views / Math.max(a.count, 1)))
  const maxBarViews = Math.max(...Object.values(hourBuckets).map(b => b.count > 0 ? b.views / b.count : 0), 1)

  // ── Platform-specific stat cards ──────────────────────────────────
  const statCards = (() => {
    if (platform === 'YouTube') return [
      { label: 'Subscribers', val: fmt(snapshots['subscribers']?.metric_value) },
      { label: 'Total views', val: fmt(snapshots['total_views']?.metric_value) },
      { label: 'Total videos', val: fmt(snapshots['total_videos']?.metric_value) },
      { label: 'Avg engagement', val: perfData.length > 0 ? (perfData.reduce((s, v) => s + Number(v.engagement_rate || 0), 0) / perfData.length).toFixed(2) + '%' : '—' },
    ]
    if (platform === 'Instagram') return [
      { label: 'Followers', val: fmt(snapshots['followers']?.metric_value) },
      { label: 'Total posts', val: fmt(snapshots['total_posts']?.metric_value) },
      { label: 'Posts tracked', val: perfData.length.toString() },
      { label: 'Avg engagement', val: perfData.length > 0 ? (perfData.reduce((s, v) => s + Number(v.engagement_rate || 0), 0) / perfData.length).toFixed(2) + '%' : '—' },
    ]
    return [
      { label: 'Followers', val: fmt(snapshots['followers']?.metric_value) },
      { label: 'Total impressions', val: fmt(snapshots['total_impressions']?.metric_value) },
      { label: 'Video count', val: fmt(snapshots['video_count']?.metric_value) },
      { label: 'Avg engagement', val: snapshots['avg_engagement'] ? snapshots['avg_engagement'].metric_value.toFixed(1) + '%' : '—' },
    ]
  })()

  return (
    <div>
      {/* Platform tabs */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2 flex-wrap">
          {(['YouTube', 'TikTok', 'Instagram'] as const).map(p => (
            <button key={p} onClick={() => setPlatform(p)}
              className={`px-3 py-1.5 rounded-lg text-sm transition ${platform === p
                ? 'bg-neutral-900 dark:bg-white text-white dark:text-black font-medium'
                : 'border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}>
              {p}
            </button>
          ))}
        </div>
        {platform !== 'TikTok' && (
          <button onClick={handleSync} disabled={syncing}
            className="px-3 py-1.5 rounded-lg text-sm border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50">
            {syncing ? 'Syncing...' : 'Sync now'}
          </button>
        )}
      </div>

      {/* TikTok manual entry */}
      {platform === 'TikTok' && (
        <div className="bg-neutral-100 dark:bg-neutral-800 rounded-xl p-4 mb-5">
          <div className="text-sm font-medium mb-1">Update TikTok stats</div>
          <div className="text-xs text-neutral-500 mb-3">Copy from your <a href="https://beacons.ai/justcallmebert/mediakit" target="_blank" className="underline">media kit</a> or TikTok Studio.</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500">Followers</label>
              <input value={ttFollowers} onChange={e => setTtFollowers(e.target.value)} placeholder="e.g. 125000"
                className="px-2 py-1.5 border rounded-lg text-sm dark:bg-neutral-900 dark:border-neutral-700 w-full" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500">Total impressions</label>
              <input value={ttLikes} onChange={e => setTtLikes(e.target.value)} placeholder="e.g. 21600"
                className="px-2 py-1.5 border rounded-lg text-sm dark:bg-neutral-900 dark:border-neutral-700 w-full" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500">Video count</label>
              <input value={ttVideoCount} onChange={e => setTtVideoCount(e.target.value)} placeholder="e.g. 84"
                className="px-2 py-1.5 border rounded-lg text-sm dark:bg-neutral-900 dark:border-neutral-700 w-full" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500">Avg views / video</label>
              <input value={ttAvgViews} onChange={e => setTtAvgViews(e.target.value)} placeholder="e.g. 15000"
                className="px-2 py-1.5 border rounded-lg text-sm dark:bg-neutral-900 dark:border-neutral-700 w-full" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-neutral-500">Avg engagement %</label>
              <input value={ttAvgEngagement} onChange={e => setTtAvgEngagement(e.target.value)} placeholder="e.g. 4.2"
                className="px-2 py-1.5 border rounded-lg text-sm dark:bg-neutral-900 dark:border-neutral-700 w-full" />
            </div>
          </div>
          <button onClick={saveTikTok} disabled={ttSaving}
            className="px-4 py-1.5 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-lg text-sm font-medium disabled:opacity-50">
            {ttSaving ? 'Saving...' : 'Save stats'}
          </button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
        {statCards.map(({ label, val }) => (
          <div key={label} className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-3">
            <div className="text-xs text-neutral-500 mb-1">{label}</div>
            <div className="text-xl font-medium">{val}</div>
          </div>
        ))}
      </div>
      {lastSync && <div className="text-xs text-neutral-400 mb-5">Last synced: {lastSync}</div>}

      {/* Charts — YouTube + Instagram */}
      {perfData.length > 0 && platform !== 'TikTok' && (
        <>
          <div className="mb-6">
            <div className="text-sm font-medium mb-3">Month-to-month</div>
            {monthlyData.length === 0 ? (
              <p className="text-xs text-neutral-400">No publish date data yet — sync to populate.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[11px] text-neutral-400 uppercase tracking-wide border-b border-neutral-200 dark:border-neutral-700">
                      <th className="text-left pb-2 font-medium">Month</th>
                      <th className="text-right pb-2 font-medium">Posts</th>
                      {platform === 'YouTube' && <><th className="text-right pb-2 font-medium">Shorts</th><th className="text-right pb-2 font-medium">Long-form</th></>}
                      <th className="text-right pb-2 font-medium">{platform === 'Instagram' ? 'Likes' : 'Views'}</th>
                      <th className="text-right pb-2 font-medium">Avg Eng.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map((row, i) => (
                      <tr key={row.month} className={`border-b border-neutral-100 dark:border-neutral-800 ${i === 0 ? 'font-medium' : ''}`}>
                        <td className="py-2 text-neutral-700 dark:text-neutral-300">{row.month}</td>
                        <td className="py-2 text-right">{row.total}</td>
                        {platform === 'YouTube' && <><td className="py-2 text-right text-orange-500">{row.shorts || '—'}</td><td className="py-2 text-right text-red-500">{row.longform || '—'}</td></>}
                        <td className="py-2 text-right">{fmt(row.views)}</td>
                        <td className="py-2 text-right text-neutral-500">{row.avgEngagement}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {platform === 'YouTube' && (
              <div className="bg-neutral-100 dark:bg-neutral-800 rounded-xl p-4">
                <div className="text-sm font-medium mb-1">Shorts frequency</div>
                <div className="text-xs text-neutral-500 mb-3">From last {perfData.length} videos</div>
                {monthlyData.map(row => (
                  <div key={row.month} className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-neutral-500 w-12 flex-shrink-0">{row.month}</span>
                    <div className="flex-1 bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                      <div className="bg-orange-400 h-2 rounded-full" style={{ width: `${Math.min(100, (row.shorts / Math.max(...monthlyData.map((r: any) => r.shorts), 1)) * 100)}%` }} />
                    </div>
                    <span className="text-xs font-medium w-4 text-right">{row.shorts}</span>
                  </div>
                ))}
                <div className="text-[11px] text-neutral-400 mt-2">
                  Avg {(monthlyData.reduce((s: number, r: any) => s + r.shorts, 0) / Math.max(monthlyData.length, 1)).toFixed(1)} shorts/month
                </div>
              </div>
            )}
            <div className="bg-neutral-100 dark:bg-neutral-800 rounded-xl p-4">
              <div className="text-sm font-medium mb-1">Best time to post</div>
              <div className="text-xs text-neutral-500 mb-3">Avg {platform === 'Instagram' ? 'likes' : 'views'} by time of day</div>
              {timingRows.length === 0 ? (
                <p className="text-xs text-neutral-400">No publish time data — sync to populate.</p>
              ) : timingRows.map(row => (
                <div key={row.label} className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-neutral-500 w-28 flex-shrink-0">{row.label}</span>
                  <div className="flex-1 bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                    <div className="bg-blue-400 h-2 rounded-full" style={{ width: `${Math.min(100, ((row.views / row.count) / maxBarViews) * 100)}%` }} />
                  </div>
                  <span className="text-xs text-neutral-500 w-16 text-right">{fmt(Math.round(row.views / row.count))}/post</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {perfData.length === 0 && platform !== 'TikTok' && (
        <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-4 text-sm text-neutral-500">
          Click "Sync now" to pull your {platform} data.
        </div>
      )}
    </div>
  )
}

const PERF_PLATFORMS = ['All', 'YouTube', 'Instagram', 'TikTok']
const PERF_TYPES = ['All', 'Short', 'Long-form']
const PERF_SORT = ['Views', 'Engagement', 'Newest', 'Oldest']

const PLATFORM_DOT: Record<string, string> = {
  YouTube: 'bg-red-500',
  Instagram: 'bg-pink-500',
  TikTok: 'bg-neutral-800 dark:bg-white',
}

function PerformanceTab() {
  const [videos, setVideos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [platform, setPlatform] = useState('All')
  const [type, setType] = useState('All')
  const [sort, setSort] = useState('Views')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('video_performance').select('*')
      setVideos(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const fmt = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M'
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
    return n?.toLocaleString() ?? '0'
  }

  const filtered = videos
    .filter(v => platform === 'All' || v.platform === platform)
    .filter(v => type === 'All' || (type === 'Short' ? v.is_short : !v.is_short))
    .filter(v => !search || (v.title ?? '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === 'Views') return b.views - a.views
      if (sort === 'Engagement') return b.engagement_rate - a.engagement_rate
      if (sort === 'Newest') return new Date(b.published_at ?? b.recorded_at).getTime() - new Date(a.published_at ?? a.recorded_at).getTime()
      return new Date(a.published_at ?? a.recorded_at).getTime() - new Date(b.published_at ?? b.recorded_at).getTime()
    })

  if (loading) return <div className="text-sm text-neutral-400">Loading...</div>
  if (videos.length === 0) return (
    <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-4 text-sm text-neutral-500">
      No data yet — go to Analytics and sync each platform first.
    </div>
  )

  return (
    <div>
      {/* Search + filters */}
      <div className="flex flex-col gap-2 mb-4">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search videos..."
          className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-neutral-800 dark:border-neutral-700" />
        <div className="flex gap-2 flex-wrap">
          {PERF_PLATFORMS.map(p => (
            <button key={p} onClick={() => setPlatform(p)}
              className={`px-2.5 py-1 rounded-lg text-xs transition ${platform === p ? 'bg-neutral-900 dark:bg-white text-white dark:text-black font-medium' : 'border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}>
              {p}
            </button>
          ))}
          <div className="w-px bg-neutral-200 dark:bg-neutral-700 mx-1" />
          {PERF_TYPES.map(t => (
            <button key={t} onClick={() => setType(t)}
              className={`px-2.5 py-1 rounded-lg text-xs transition ${type === t ? 'bg-neutral-900 dark:bg-white text-white dark:text-black font-medium' : 'border border-neutral-200 dark:border-neutral-700 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}>
              {t}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-xs text-neutral-400">Sort:</span>
            <select value={sort} onChange={e => setSort(e.target.value)}
              className="text-xs border rounded-lg px-2 py-1 dark:bg-neutral-800 dark:border-neutral-700">
              {PERF_SORT.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="text-xs text-neutral-400">{filtered.length} video{filtered.length !== 1 ? 's' : ''}</div>
      </div>

      {/* Video list */}
      <div className="flex flex-col gap-1.5">
        {filtered.map((v, i) => (
          <div key={v.id} className="flex items-center gap-3 p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
            <span className="text-xs text-neutral-400 min-w-[28px] text-right">{i + 1}</span>
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${PLATFORM_DOT[v.platform] ?? 'bg-neutral-400'}`} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{v.title || `${v.platform} video`}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-neutral-400">{v.platform}</span>
                {v.is_short && <span className="text-[11px] bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 px-1.5 rounded">Short</span>}
                {v.published_at && <span className="text-[11px] text-neutral-400">{new Date(v.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</span>}
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-sm font-medium">{fmt(v.views)}</div>
              <div className="text-xs text-neutral-500">{v.engagement_rate}% eng.</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const DRIVE_LINK_LABELS = ['Raw Footage', 'Rough Cut', '1st Edit', '2nd Edit', 'Final Cut', 'Thumbnail', 'Script', 'Other']

function getDriveEmbedUrl(url: string): string | null {
  const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  return m ? `https://drive.google.com/file/d/${m[1]}/preview` : null
}

function VideoModal({ video, isEditor, onClose, onUpdateLinks, onUpdateNotes, onUpdateStage }: {
  video: any; isEditor: boolean; onClose: () => void
  onUpdateLinks: (id: string, links: any[]) => void
  onUpdateNotes: (id: string, notes: string) => void
  onUpdateStage: (id: string, stage: string) => void
}) {
  const links: any[] = video.drive_links ?? []
  const [newLabel, setNewLabel] = useState(DRIVE_LINK_LABELS[0])
  const [newUrl, setNewUrl] = useState('')
  const [showAddLink, setShowAddLink] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesVal, setNotesVal] = useState(video.notes ?? '')

  const addLink = () => {
    if (!newUrl.trim()) return
    const updated = [...links, { label: newLabel, url: newUrl.trim() }]
    onUpdateLinks(video.id, updated)
    setNewUrl(''); setShowAddLink(false)
  }

  const removeLink = (i: number) => {
    onUpdateLinks(video.id, links.filter((_: any, idx: number) => idx !== i))
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-neutral-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Preview player */}
        {previewUrl ? (
          <div className="relative bg-black aspect-video">
            <iframe src={previewUrl} className="w-full h-full" allow="autoplay" allowFullScreen />
            <button onClick={() => setPreviewUrl(null)}
              className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm hover:bg-black/80">✕</button>
          </div>
        ) : (
          <div className="bg-neutral-100 dark:bg-neutral-800 aspect-video flex items-center justify-center">
            {links.some((l: any) => getDriveEmbedUrl(l.url)) ? (
              <button onClick={() => setPreviewUrl(getDriveEmbedUrl(links.find((l: any) => getDriveEmbedUrl(l.url))?.url ?? '') ?? null)}
                className="flex flex-col items-center gap-2 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition">
                <span className="text-4xl">▶</span>
                <span className="text-sm">Preview video</span>
              </button>
            ) : (
              <div className="text-sm text-neutral-400">No previewable Drive file linked yet</div>
            )}
          </div>
        )}

        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <h2 className="text-base font-semibold leading-snug">{video.title}</h2>
            <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 flex-shrink-0 text-lg leading-none">✕</button>
          </div>

          {/* Drive links */}
          <div className="mb-4">
            <div className="text-[11px] text-neutral-400 uppercase tracking-wide mb-2">Drive Links</div>
            {links.length === 0 && <p className="text-xs text-neutral-400 italic mb-2">No links added yet.</p>}
            <div className="flex flex-col gap-1.5 mb-2">
              {links.map((l: any, i: number) => {
                const embed = getDriveEmbedUrl(l.url)
                return (
                  <div key={i} className="flex items-center gap-2 bg-neutral-50 dark:bg-neutral-800 rounded-lg px-3 py-2">
                    <span className="text-[11px] font-medium text-neutral-500 w-24 flex-shrink-0">{l.label}</span>
                    <a href={l.url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline flex-1 truncate">Open in Drive</a>
                    {embed && (
                      <button onClick={() => setPreviewUrl(previewUrl === embed ? null : embed)}
                        className="text-[11px] text-neutral-400 hover:text-blue-500 flex-shrink-0">
                        {previewUrl === embed ? '■ Stop' : '▶ Play'}
                      </button>
                    )}
                    {isEditor && (
                      <button onClick={() => removeLink(i)} className="text-[11px] text-red-400 hover:text-red-600 flex-shrink-0">✕</button>
                    )}
                  </div>
                )
              })}
            </div>
            {isEditor && (
              showAddLink ? (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <select value={newLabel} onChange={e => setNewLabel(e.target.value)}
                      className="px-2 py-1.5 border rounded-lg text-xs dark:bg-neutral-800 dark:border-neutral-700 flex-shrink-0">
                      {DRIVE_LINK_LABELS.map(l => <option key={l}>{l}</option>)}
                    </select>
                    <input value={newUrl} onChange={e => setNewUrl(e.target.value)}
                      placeholder="Paste Drive link" onKeyDown={e => e.key === 'Enter' && addLink()}
                      className="flex-1 px-2 py-1.5 border rounded-lg text-xs dark:bg-neutral-800 dark:border-neutral-700" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addLink}
                      className="px-3 py-1 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-lg text-xs font-medium">Add</button>
                    <button onClick={() => { setShowAddLink(false); setNewUrl('') }}
                      className="px-3 py-1 border rounded-lg text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAddLink(true)}
                  className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">+ Add link</button>
              )
            )}
          </div>

          {/* Notes */}
          <div>
            <div className="text-[11px] text-neutral-400 uppercase tracking-wide mb-1.5">Notes</div>
            {editingNotes ? (
              <div className="flex flex-col gap-2">
                <textarea value={notesVal} onChange={e => setNotesVal(e.target.value)} rows={3}
                  className="px-2 py-1.5 border rounded-lg text-sm dark:bg-neutral-800 dark:border-neutral-700 resize-none w-full" />
                <div className="flex gap-2">
                  <button onClick={() => { onUpdateNotes(video.id, notesVal); setEditingNotes(false) }}
                    className="px-3 py-1 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-lg text-xs font-medium">Save</button>
                  <button onClick={() => setEditingNotes(false)} className="px-3 py-1 border rounded-lg text-xs">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2">
                <p className="text-sm text-neutral-600 dark:text-neutral-300 flex-1">{video.notes || <span className="italic text-neutral-400">No notes</span>}</p>
                {isEditor && <button onClick={() => setEditingNotes(true)} className="text-xs text-neutral-400 hover:text-neutral-700 flex-shrink-0">Edit</button>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function ProductionTab({ isEditor }: { isEditor: boolean }) {
  const { videos, updateStage, addVideo, updateDriveLinks, updateNotes } = useVideos()
  const { events } = useEvents()
  const today = new Date().toISOString().split('T')[0]
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [selectedDate, setSelectedDate] = useState<number | null>(null)
  const [editingVideo, setEditingVideo] = useState<string | null>(null)
  const [selectedVideo, setSelectedVideo] = useState<any | null>(null)
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
                  <div key={v.id} onClick={() => setSelectedVideo(v)}
                    className={`flex items-center gap-3 p-3 mb-1.5 bg-white dark:bg-neutral-900 rounded-lg cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-800 transition ${isOD ? 'ring-1 ring-red-400' : 'border border-neutral-200 dark:border-neutral-700'}`}>
                    <div className="w-1 h-9 rounded-sm flex-shrink-0" style={{ background: isOD ? '#A32D2D' : stage?.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{v.title}</div>
                      <div className={`text-xs ${isOD ? 'text-red-600 dark:text-red-400' : 'text-neutral-500'}`}>
                        {isOD ? 'Overdue — ' : ''}{stage?.label}
                        {v.assigned_to && ` · ${v.assigned_to}`}
                      </div>
                      {(v.drive_links?.length > 0 || v.drive_link) && (
                        <div className="text-[11px] text-blue-500 mt-0.5">
                          {v.drive_links?.length > 0 ? `${v.drive_links.length} link${v.drive_links.length > 1 ? 's' : ''}` : 'Drive link'}
                        </div>
                      )}
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
      {selectedVideo && (
        <VideoModal
          video={videos.find(v => v.id === selectedVideo.id) ?? selectedVideo}
          isEditor={isEditor}
          onClose={() => setSelectedVideo(null)}
          onUpdateLinks={(id, links) => { updateDriveLinks(id, links) }}
          onUpdateNotes={(id, notes) => { updateNotes(id, notes) }}
          onUpdateStage={(id, stage) => { updateStage(id, stage) }}
        />
      )}
    </div>
  )
}

const CONTENT_TAGS = ['Challenge', 'Vlog', 'Adventure', 'Holiday', 'Pretend Play', 'Game', 'Skit']
const PLATFORMS = ['All', 'YouTube', 'Short', 'TikTok', 'Reel']
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
  const [votedIds, setVotedIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try { return new Set(JSON.parse(localStorage.getItem('voted_ideas') ?? '[]')) } catch { return new Set() }
  })

  const handleVote = (id: string, currentVotes: number) => {
    if (votedIds.has(id)) return
    vote(id, currentVotes)
    const next = new Set(votedIds).add(id)
    setVotedIds(next)
    localStorage.setItem('voted_ideas', JSON.stringify([...next]))
  }

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
                    {(() => {
                      const hasVoted = votedIds.has(idea.id)
                      return (
                        <button onClick={() => !hasVoted && handleVote(idea.id, idea.votes)}
                          disabled={hasVoted}
                          title={hasVoted ? 'Already voted' : 'Vote'}
                          className={`flex flex-col items-center justify-start min-w-[40px] pt-1 px-1.5 rounded-lg border text-center transition flex-shrink-0
                            ${hasVoted
                              ? 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 cursor-default'
                              : 'cursor-pointer hover:bg-neutral-200 dark:hover:bg-neutral-700'}`}>
                          <span className={`text-sm leading-none ${hasVoted ? 'text-blue-500' : ''}`}>▲</span>
                          <span className={`text-sm font-medium leading-tight mt-0.5 ${hasVoted ? 'text-blue-500' : ''}`}>{idea.votes}</span>
                          <span className="text-[9px] text-neutral-400 leading-tight">votes</span>
                        </button>
                      )
                    })()}
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
  const { trends, loading, addTrend, deleteTrend, refetch } = useTrends()
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
      else await refetch()
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

function WhiteboardTab({ isEditor }: { isEditor: boolean }) {
  const { snapshots, loading, addSnapshot, updateSnapshot, deleteSnapshot } = useWhiteboardSnapshots()
  const [uploading, setUploading] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [capturedAt, setCapturedAt] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNotes, setEditNotes] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [statusMsg, setStatusMsg] = useState('')

  const handleUpload = async (file: File) => {
    if (!file) return
    setUploading(true)
    setStatusMsg('Uploading photo...')

    const ext = file.name.split('.').pop()
    const path = `${Date.now()}.${ext}`
    const { data: uploadData, error: uploadError } = await (await import('@/src/lib/supabase')).supabase
      .storage.from('whiteboard-photos').upload(path, file, { contentType: file.type })

    if (uploadError) {
      setStatusMsg('Upload failed: ' + uploadError.message)
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = (await import('@/src/lib/supabase')).supabase
      .storage.from('whiteboard-photos').getPublicUrl(path)

    setStatusMsg('Extracting text with AI...')
    setExtracting(true)
    let extracted: string | null = null
    try {
      const res = await fetch('/api/extract-whiteboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: publicUrl }),
      })
      const json = await res.json()
      extracted = json.extracted ?? null
    } catch (e) {
      // extraction optional — don't block save
    }
    setExtracting(false)

    await addSnapshot({ image_url: publicUrl, captured_at: capturedAt, extracted_text: extracted, notes: notes.trim() || null })
    setNotes('')
    setStatusMsg('')
    setUploading(false)
  }

  const fmt = (dateStr: string) => new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div>
      {isEditor && (
        <div className="mb-6 bg-neutral-100 dark:bg-neutral-800 rounded-xl p-4">
          <div className="text-sm font-medium mb-3">Upload whiteboard photo</div>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <label className="text-xs text-neutral-500">Date taken</label>
              <input type="date" value={capturedAt} onChange={e => setCapturedAt(e.target.value)}
                className="px-2 py-1 border rounded-lg text-sm dark:bg-neutral-900 dark:border-neutral-700" />
            </div>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              rows={2}
              className="px-3 py-2 border rounded-lg text-sm dark:bg-neutral-900 dark:border-neutral-700 resize-none" />
            <label className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed rounded-xl cursor-pointer transition
              ${uploading ? 'opacity-50 pointer-events-none' : 'hover:bg-neutral-200 dark:hover:bg-neutral-700 border-neutral-300 dark:border-neutral-600'}`}>
              <span className="text-sm">{uploading ? statusMsg : '📷 Choose photo or drag & drop'}</span>
              <input type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = '' }} />
            </label>
          </div>
        </div>
      )}

      {loading && <div className="text-sm text-neutral-400 py-6 text-center">Loading...</div>}

      <div className="flex flex-col gap-4">
        {snapshots.map(snap => {
          const isExpanded = expandedId === snap.id
          const isEditing = editingId === snap.id
          return (
            <div key={snap.id} className="bg-neutral-100 dark:bg-neutral-800 rounded-xl overflow-hidden">
              <img src={snap.image_url} alt={`Whiteboard ${snap.captured_at}`}
                className="w-full max-h-72 object-contain bg-neutral-200 dark:bg-neutral-700 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : snap.id)} />
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{fmt(snap.captured_at)}</span>
                  <div className="flex gap-3">
                    <button onClick={() => setExpandedId(isExpanded ? null : snap.id)}
                      className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">
                      {isExpanded ? '▲ Less' : '▼ More'}
                    </button>
                    {isEditor && (
                      <>
                        <button onClick={() => { setEditingId(snap.id); setEditNotes(snap.notes ?? '') }}
                          className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">Edit</button>
                        <button onClick={() => deleteSnapshot(snap.id, snap.image_url)}
                          className="text-xs text-red-400 hover:text-red-600">Delete</button>
                      </>
                    )}
                  </div>
                </div>

                {snap.notes && !isEditing && (
                  <p className="text-sm text-neutral-600 dark:text-neutral-300 mb-2">{snap.notes}</p>
                )}

                {isEditing && (
                  <div className="flex flex-col gap-2 mb-2">
                    <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)}
                      rows={2} placeholder="Notes"
                      className="px-2 py-1.5 border rounded-lg text-sm dark:bg-neutral-900 dark:border-neutral-700 resize-none" />
                    <div className="flex gap-2">
                      <button onClick={async () => { await updateSnapshot(snap.id, { notes: editNotes.trim() || undefined }); setEditingId(null) }}
                        className="px-3 py-1 bg-neutral-900 dark:bg-white text-white dark:text-black rounded-lg text-xs font-medium">Save</button>
                      <button onClick={() => setEditingId(null)}
                        className="px-3 py-1 border rounded-lg text-xs">Cancel</button>
                    </div>
                  </div>
                )}

                {isExpanded && snap.extracted_text && (
                  <div className="mt-2 pt-2 border-t border-neutral-200 dark:border-neutral-700">
                    <div className="text-[11px] text-neutral-400 uppercase tracking-wide mb-1.5">Extracted text</div>
                    <pre className="text-xs text-neutral-600 dark:text-neutral-300 whitespace-pre-wrap font-sans leading-relaxed">
                      {snap.extracted_text}
                    </pre>
                  </div>
                )}

                {isExpanded && !snap.extracted_text && (
                  <div className="mt-2 pt-2 border-t border-neutral-200 dark:border-neutral-700 text-xs text-neutral-400 italic">
                    No text was extracted from this photo.
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {!loading && snapshots.length === 0 && (
        <div className="text-sm text-neutral-400 text-center py-10">No whiteboard photos yet. Upload one above.</div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { user, loading, signIn, signOut, isEditor } = useAuth()
  const { notifications, unreadCount, markAllRead } = useNotifications()
  const [tab, setTab] = useState('Production')
  const [showNotifs, setShowNotifs] = useState(false)

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
      case 'Whiteboard': return <WhiteboardTab isEditor={isEditor} />
      default: return null
    }
  }

  const fmtTime = (ts: string) => {
    const d = new Date(ts)
    const now = new Date()
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-4 font-sans">
      <div className="sticky top-0 z-20 pt-6 w-full" style={{ background: 'var(--background)' }}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-medium">Creator command center</h1>
          <div className="flex items-center gap-3">
            {/* Notification bell */}
            <div className="relative">
              <button onClick={() => { setShowNotifs(v => !v); if (!showNotifs && unreadCount > 0) markAllRead() }}
                className="relative p-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-500">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {showNotifs && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-lg z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800">
                    <span className="text-sm font-medium">Notifications</span>
                    <button onClick={markAllRead} className="text-xs text-neutral-400 hover:text-neutral-600">Mark all read</button>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="text-sm text-neutral-400 text-center py-6">No notifications yet</div>
                    ) : notifications.map(n => (
                      <div key={n.id} className={`px-4 py-3 border-b border-neutral-50 dark:border-neutral-800 last:border-0 ${!n.read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}>
                        <p className="text-sm leading-snug">{n.message}</p>
                        <p className="text-[11px] text-neutral-400 mt-0.5">{fmtTime(n.created_at)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
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