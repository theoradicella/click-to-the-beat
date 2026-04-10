import { useEffect, useRef } from 'react'

const CELL = 20           // grid cell size in px (≈ 5 mm at 96 dpi)
const RADIUS = 150        // effect radius in px (≈ 4 cm at 96 dpi)

// Dark orange in RGB components
const ORANGE_R = 204
const ORANGE_G = 85
const ORANGE_B = 0

// Wave animation
const WAVE_SPEED      = 120   // px/s — ring expansion speed
const WAVE_THICKNESS  = RADIUS  // px — same width as the hover beam
const WAVE_MAX_RADIUS = 700   // px — wave expires when leading edge exceeds this

// Wave uses same orange as the hover beam
const WAVE_R = ORANGE_R
const WAVE_G = ORANGE_G
const WAVE_B = ORANGE_B

type Wave = { originX: number; originY: number; startTime: number }

export default function NotebookPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Latest mouse position — stored in a ref so the rAF callback
  // always reads the most recent value without needing re-renders.
  const mouseRef = useRef<{ x: number; y: number } | null>(null)
  const rafRef = useRef<number | null>(null)
  const wavesRef = useRef<Wave[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Keep canvas pixel dimensions in sync with the viewport
    const syncSize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    syncSize()

    const resizeObserver = new ResizeObserver(syncSize)
    resizeObserver.observe(document.documentElement)

    // Asymmetric ring profile: cosine falloff behind leading edge, tight
    // Gaussian ahead. Amplitude decays as 1/r (energy spreads over larger ring).
    const waveIntensity = (delta: number, r: number): number => {
      const halfThick = WAVE_THICKNESS / 2
      let profile: number
      if (delta <= 0) {
        // Behind leading edge: cosine falloff (smooth physical wake)
        profile = Math.cos((delta / halfThick) * (Math.PI / 2))
      } else {
        // Ahead of leading edge: tight Gaussian (crisp wave front)
        const sigma = halfThick * 0.3
        profile = Math.exp(-(delta * delta) / (2 * sigma * sigma))
      }
      // Decay relative to the beam radius (wave is full brightness at launch)
      const decay = Math.min(1, RADIUS / Math.max(r, RADIUS))
      return profile * decay * 0.9
    }

    const draw = () => {
      // Self-sustaining loop — schedule next frame immediately
      rafRef.current = requestAnimationFrame(draw)

      const now = performance.now()
      const mouse = mouseRef.current
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // --- Hover glow ---
      if (mouse) {
        const cellX = Math.floor(mouse.x / CELL) * CELL
        const cellY = Math.floor(mouse.y / CELL) * CELL
        const span = Math.ceil(RADIUS / CELL)
        for (let dy = -span; dy <= span + 1; dy++) {
          for (let dx = -span; dx <= span + 1; dx++) {
            const cx = cellX + dx * CELL
            const cy = cellY + dy * CELL
            const centerX = cx + CELL / 2
            const centerY = cy + CELL / 2
            const dist = Math.hypot(mouse.x - centerX, mouse.y - centerY)
            if (dist >= RADIUS) continue
            const intensity = 1 - dist / RADIUS
            ctx.fillStyle = `rgba(${ORANGE_R},${ORANGE_G},${ORANGE_B},${intensity.toFixed(3)})`
            ctx.fillRect(cx + 1, cy + 1, CELL - 1, CELL - 1)
          }
        }
      }

      // --- Wave rings ---
      for (const wave of wavesRef.current) {
        const elapsed = (now - wave.startTime) / 1000      // seconds
        const r = RADIUS + elapsed * WAVE_SPEED             // starts at beam edge, expands outward
        const span = Math.ceil((r + WAVE_THICKNESS) / CELL) + 1
        const originCellX = Math.floor(wave.originX / CELL) * CELL
        const originCellY = Math.floor(wave.originY / CELL) * CELL

        for (let dy = -span; dy <= span + 1; dy++) {
          for (let dx = -span; dx <= span + 1; dx++) {
            const cx = originCellX + dx * CELL
            const cy = originCellY + dy * CELL
            const centerX = cx + CELL / 2
            const centerY = cy + CELL / 2
            const dist = Math.hypot(wave.originX - centerX, wave.originY - centerY)
            const delta = dist - r  // signed dist from ring centerline
            if (Math.abs(delta) > WAVE_THICKNESS / 2) continue
            const intensity = waveIntensity(delta, r)
            if (intensity <= 0) continue
            ctx.fillStyle = `rgba(${WAVE_R},${WAVE_G},${WAVE_B},${intensity.toFixed(3)})`
            ctx.fillRect(cx + 1, cy + 1, CELL - 1, CELL - 1)
          }
        }
      }

      // Prune expired waves
      wavesRef.current = wavesRef.current.filter(
        w => RADIUS + (now - w.startTime) / 1000 * WAVE_SPEED < WAVE_MAX_RADIUS
      )

      // Stop the loop when there is nothing left to animate
      if (!mouse && wavesRef.current.length === 0) {
        cancelAnimationFrame(rafRef.current!)
        rafRef.current = null
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(draw)
      }
    }

    const onMouseLeave = () => {
      mouseRef.current = null
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(draw)
      }
    }

    const onClick = (e: MouseEvent) => {
      const cellX = Math.floor(e.clientX / CELL) * CELL
      const cellY = Math.floor(e.clientY / CELL) * CELL
      wavesRef.current.push({
        originX: cellX + CELL / 2,
        originY: cellY + CELL / 2,
        startTime: performance.now(),
      })
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(draw)
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return
      e.preventDefault()
      const mouse = mouseRef.current
      const x = mouse ? mouse.x : window.innerWidth / 2
      const y = mouse ? mouse.y : window.innerHeight / 2
      const cellX = Math.floor(x / CELL) * CELL
      const cellY = Math.floor(y / CELL) * CELL
      wavesRef.current.push({
        originX: cellX + CELL / 2,
        originY: cellY + CELL / 2,
        startTime: performance.now(),
      })
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(draw)
      }
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseleave', onMouseLeave)
    window.addEventListener('click', onClick)
    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseleave', onMouseLeave)
      window.removeEventListener('click', onClick)
      window.removeEventListener('keydown', onKeyDown)
      resizeObserver.disconnect()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        backgroundColor: '#f9f5e7',
        backgroundImage: `
          linear-gradient(rgba(140, 135, 100, 0.55) 1px, transparent 1px),
          linear-gradient(90deg, rgba(140, 135, 100, 0.55) 1px, transparent 1px)
        `,
        backgroundSize: `${CELL}px ${CELL}px`,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}
