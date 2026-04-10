import { useEffect, useRef, useState } from 'react'

// --- YouTube IFrame API types ---

declare global {
  interface Window {
    YT: { Player: new (el: HTMLElement, opts: object) => YTPlayer }
    onYouTubeIframeAPIReady: () => void
  }
}

interface YTPlayer {
  loadVideoById(id: string): void
  playVideo(): void
  pauseVideo(): void
  stopVideo(): void
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  destroy(): void
}

interface Track {
  id: string
  title: string
  channel: string
}

const RECOMMENDATIONS: Track[] = [
  { id: 'iXa844Xa_FQ', title: 'Live Is Life',  channel: 'Opus' },
  { id: '9uMtnH7cABg', title: 'Xanadu',        channel: 'Ummet Ozcan' },
  { id: 'DtE0ZWkYPRs', title: 'Boss Bitch',    channel: 'Doja Cat' },
]

function fmt(secs: number) {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <circle cx="6.5" cy="6.5" r="4.5" stroke="rgba(204,85,0,0.6)" strokeWidth="1.5" />
    <line x1="10" y1="10" x2="14" y2="14" stroke="rgba(204,85,0,0.6)" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

const PlayIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <polygon points="4,2 14,8 4,14" fill="rgba(204,85,0,0.9)" />
  </svg>
)

const PauseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
    <rect x="3" y="2" width="3.5" height="12" rx="1" fill="rgba(204,85,0,0.9)" />
    <rect x="9.5" y="2" width="3.5" height="12" rx="1" fill="rgba(204,85,0,0.9)" />
  </svg>
)

// --- Component ---

export default function MusicBar() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Track[]>([])
  const [open, setOpen] = useState(false)
  const [nowPlaying, setNowPlaying] = useState<Track | null>(null)
  const [progress, setProgress] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)

  const playerRef = useRef<YTPlayer | null>(null)
  const playerDivRef = useRef<HTMLDivElement>(null)
  const ytReadyRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const pendingVideoRef = useRef<string | null>(null)

  // Wait for the YouTube IFrame API to be ready
  useEffect(() => {
    if (window.YT?.Player) {
      ytReadyRef.current = true
    } else {
      const prev = window.onYouTubeIframeAPIReady
      window.onYouTubeIframeAPIReady = () => {
        ytReadyRef.current = true
        prev?.()
        if (pendingVideoRef.current) {
          createPlayer(pendingVideoRef.current)
          pendingVideoRef.current = null
        }
      }
    }
  }, [])

  // Auto-search with debounce; fall back to recommendations when query is cleared
  useEffect(() => {
    if (!query.trim()) {
      setResults(RECOMMENDATIONS)
      return
    }
    const t = setTimeout(search, 500)
    return () => clearTimeout(t)
  }, [query])

  // Countdown → then start player
  useEffect(() => {
    if (countdown === null) return
    if (countdown === 0) {
      const videoId = pendingVideoRef.current
      if (videoId) {
        setLoading(true)
        if (!ytReadyRef.current) {
          // will be picked up by onYouTubeIframeAPIReady
        } else if (playerRef.current) {
          playerRef.current.loadVideoById(videoId)
          setLoading(false)
        } else {
          createPlayer(videoId)
        }
        pendingVideoRef.current = null
      }
      setCountdown(null)
      return
    }
    const t = setTimeout(() => setCountdown(c => (c !== null ? c - 1 : null)), 1000)
    return () => clearTimeout(t)
  }, [countdown])

  // Progress animation loop
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return
    }
    const tick = () => {
      const p = playerRef.current
      if (p) {
        const dur = p.getDuration()
        const cur = p.getCurrentTime()
        if (dur > 0) {
          setProgress(cur / dur)
          setElapsed(cur)
          setDuration(dur)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [playing])

  // Cleanup on unmount
  useEffect(() => () => { playerRef.current?.destroy() }, [])

  const createPlayer = (videoId: string) => {
    if (!playerDivRef.current) return
    playerRef.current = new window.YT.Player(playerDivRef.current, {
      videoId,
      playerVars: { autoplay: 1, controls: 0, playsinline: 1 },
      events: {
        onReady: (e: any) => { e.target.playVideo(); setLoading(false); setPlaying(true) },
        onStateChange: (e: any) => {
          setPlaying(e.data === 1)
          if (e.data === 0) setProgress(1)
        },
      },
    })
  }

  const search = async () => {
    const q = query.trim()
    if (!q) return
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(
        (data.items ?? []).map((item: any) => ({
          id: item.id.videoId,
          title: item.snippet.title,
          channel: item.snippet.channelTitle,
        }))
      )
      setOpen(true)
    } catch {
      // silently fail
    }
  }

  const selectTrack = (track: Track) => {
    if (!track.id) return
    setOpen(false)
    setQuery('')
    setNowPlaying(track)
    setProgress(0)
    setElapsed(0)
    setDuration(0)
    setPlaying(false)
    // Queue the video and start countdown
    pendingVideoRef.current = track.id
    setCountdown(3)
  }

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!playerRef.current) return
    if (playing) playerRef.current.pauseVideo()
    else playerRef.current.playVideo()
  }

  const clearTrack = (e: React.MouseEvent) => {
    e.stopPropagation()
    playerRef.current?.stopVideo()
    setPlaying(false)
    setNowPlaying(null)
    setCountdown(null)
    setProgress(0)
    pendingVideoRef.current = null
  }

  return (
    <>
      {/* Hidden YouTube player iframe */}
      <div
        ref={playerDivRef}
        style={{ position: 'absolute', left: -9999, top: -9999, width: 1, height: 1 }}
      />

      <div style={{
        position: 'fixed',
        bottom: 32,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        pointerEvents: 'none',
      }}>
        {/* Dropdown results */}
        {open && results.length > 0 && (
          <div style={{
            background: '#ffffff',
            border: '1.5px solid rgba(0,0,0,0.1)',
            borderRadius: 12,
            overflow: 'hidden',
            width: 440,
            boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
            pointerEvents: 'auto',
          }}>
            {results.map((r, i) => (
              <div
                key={i}
                onClick={() => selectTrack(r)}
                style={{
                  padding: '11px 18px',
                  cursor: r.id ? 'pointer' : 'default',
                  borderBottom: i < results.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                  color: '#1a1a1a',
                  fontFamily: 'monospace',
                  fontSize: 13,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(204,85,0,0.07)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.title}
                </span>
                {r.channel && (
                  <span style={{ opacity: 0.4, fontSize: 11 }}>{r.channel}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Main bar */}
        <div style={{
          background: '#ffffff',
          border: '1.5px solid rgba(0,0,0,0.1)',
          borderRadius: 16,
          padding: nowPlaying ? '14px 20px' : '12px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: nowPlaying ? 10 : 0,
          minWidth: 440,
          boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
          pointerEvents: 'auto',
        }}>
          {nowPlaying ? (
            <>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                color: '#1a1a1a',
                fontFamily: 'monospace',
                fontSize: 14,
              }}>
                {/* Play / pause */}
                <button onClick={togglePlay} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  {countdown !== null
                    ? <span style={{ width: 16, textAlign: 'center', color: 'rgba(204,85,0,0.9)', fontWeight: 700, fontSize: 14 }}>{countdown}</span>
                    : loading
                    ? <span style={{ width: 16, textAlign: 'center', color: 'rgba(204,85,0,0.5)', fontSize: 14 }}>·</span>
                    : playing ? <PauseIcon /> : <PlayIcon />
                  }
                </button>

                {/* Title / countdown label */}
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', opacity: countdown !== null ? 0.4 : 1 }}>
                  {countdown !== null ? 'Click to the beat' : nowPlaying.title}
                </span>

                {/* Time */}
                {countdown === null && (
                  <span style={{ opacity: 0.35, flexShrink: 0, fontSize: 12 }}>
                    {fmt(elapsed)} / {fmt(duration)}
                  </span>
                )}

                {/* Clear */}
                <button
                  onClick={clearTrack}
                  style={{ background: 'none', border: 'none', color: 'rgba(0,0,0,0.25)', fontSize: 13, cursor: 'pointer', padding: 0, lineHeight: 1, flexShrink: 0 }}
                  title="Remove"
                >
                  ✕
                </button>
              </div>

              {/* Progress bar */}
              <div style={{ width: '100%', height: 3, background: 'rgba(0,0,0,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${progress * 100}%`, height: '100%', background: 'rgba(204,85,0,0.8)', borderRadius: 2 }} />
              </div>
            </>
          ) : (
            /* Search state */
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <SearchIcon />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') search() }}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                onFocus={() => {
                  if (!query.trim()) setResults(RECOMMENDATIONS)
                  setOpen(true)
                }}
                placeholder="Search a song"
                style={{
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  color: '#1a1a1a',
                  fontFamily: 'monospace',
                  fontSize: 14,
                  flex: 1,
                  caretColor: 'rgba(204,85,0,0.8)',
                }}
              />
            </div>
          )}
        </div>
      </div>
    </>
  )
}
