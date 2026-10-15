import type { Dist, Size } from './patterns'

// 追加の和柄：亀甲・籠目・矢絣・立涌。どれも線（pathLength="1"）で描き、--t で演出の開始をずらす

const n = (v: number) => Math.round(v * 10) / 10

function hexPath(cx: number, cy: number, r: number): string {
  const pts = [0, 1, 2, 3, 4, 5].map(i => {
    const a = (Math.PI / 3) * i
    return `${n(cx + r * Math.cos(a))} ${n(cy + r * Math.sin(a))}`
  })

  return `M${pts.join('L')}Z`
}

// 亀甲：二重の輪郭の六角形を、蜂の巣状に敷き詰める
export function kikko(size: Size, dist: Dist): string {
  const r = 26
  const dx = 1.5 * r
  const dy = Math.sqrt(3) * r
  const hexes: string[] = []
  for (let col = 0, x = 0; x <= size.w + r; col += 1, x += dx) {
    const offset = col % 2 === 0 ? 0 : dy / 2
    for (let y = -offset; y <= size.h + r; y += dy) {
      hexes.push(`<g class="m" style="--t:${dist(x, y)}"><path pathLength="1" d="${hexPath(x, y, r)}"/><path pathLength="1" d="${hexPath(x, y, r * 0.72)}"/></g>`)
    }
  }

  return hexes.join('')
}

// 籠目：水平・±60° の三方向の直線を、交点が三本重ならないようずらして引く（三角と六角の編み目）
export function kagome(size: Size, dist: Dist): string {
  const d = 40
  const h = (d * Math.sqrt(3)) / 2
  const reach = size.h / Math.sqrt(3)
  const lines: string[] = []
  const line = (x1: number, y1: number, x2: number, y2: number) =>
    lines.push(`<path class="m" pathLength="1" style="--t:${dist((x1 + x2) / 2, (y1 + y2) / 2)}" d="M${n(x1)} ${n(y1)}L${n(x2)} ${n(y2)}"/>`)
  for (let y = 0; y <= size.h; y += h) {
    line(0, y, size.w, y)
  }
  for (let x = -reach - d; x <= size.w + d; x += d) {
    line(x, 0, x + reach, size.h)
    line(x + d / 2 + reach, 0, x + d / 2, size.h)
  }

  return lines.join('')
}

// 矢絣：列ごとに向きと高さをずらした矢羽根（くの字）を縦に積む
export function yagasuri(size: Size, dist: Dist): string {
  const c = 40
  const step = 30
  const feathers: string[] = []
  for (let col = 0, x = 0; x <= size.w; col += 1, x += c) {
    const isDown = col % 2 === 0
    const offset = isDown ? 0 : step / 2
    for (let y = -step + offset; y <= size.h + step; y += step) {
      const tip = isDown ? y + step * 0.6 : y - step * 0.6
      feathers.push(`<path class="m" pathLength="1" style="--t:${dist(x + c / 2, y)}" d="M${x} ${n(y)}L${x + c / 2} ${n(tip)}L${x + c} ${n(y)}"/>`)
    }
    feathers.push(`<path pathLength="1" style="--t:${dist(x, size.h / 2)}" d="M${x} 0L${x} ${size.h}"/>`)
  }

  return feathers.join('')
}

// 立涌：向かい合う波線を、一波ごとに分けて描く（ふくらみとすぼみが立ち昇る）
export function tatewaku(size: Size, dist: Dist): string {
  const s = 52
  const a = 5
  const b = 11
  const wave = 84
  const parts: string[] = []
  for (let cx = s / 2; cx <= size.w + s; cx += s) {
    for (const side of [-1, 1]) {
      for (let y0 = 0; y0 <= size.h; y0 += wave) {
        const pts: string[] = []
        for (let y = y0; y <= y0 + wave; y += 7) {
          const x = cx + side * (a + b * (1 + Math.sin((2 * Math.PI * y) / wave)) / 2)
          pts.push(`${n(x)} ${n(Math.min(y, y0 + wave))}`)
        }
        parts.push(`<path class="m" pathLength="1" style="--t:${dist(cx, y0 + wave / 2)}" d="M${pts.join('L')}"/>`)
      }
    }
  }

  return parts.join('')
}
