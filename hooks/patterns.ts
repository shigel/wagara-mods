import type { Pattern, Phase, RippleOrigin } from '../types'
import { DOPA_SPARKLE, GLOW_FILTER, dopaCss } from './dopa'
import { kagome, kikko, tatewaku, yagasuri } from './more'

// 描画領域の大きさ（CSS px）。ペインの大きさに合わせて毎回決める。背景は透過
export type Size = { w: number; h: number }
export const DEFAULT_SIZE: Size = { w: 480, h: 720 }
export const CENTER: RippleOrigin = { x: 0.5, y: 0.6 }

const AME = '#DEB068' // 飴色：線
const SHU = '#EB6101' // 朱色：触れたところ・乱れ
const GLOW = '#FFE7B8' // 開花の光

export const PATTERNS: readonly Pattern[] = ['seigaiha', 'asanoha', 'shippo', 'kikko', 'kagome', 'yagasuri', 'tatewaku']

export const LABELS: Record<Pattern, { name: string; meaning: string }> = {
  seigaiha: { name: '青海波', meaning: '穏やかな波がどこまでも続く。未来永劫の平穏を願う文様' },
  asanoha: { name: '麻の葉', meaning: '真っ直ぐ早く育つ麻にあやかり、健やかな成長と魔除けを願う文様' },
  shippo: { name: '七宝', meaning: '円が途切れず連なる。円満と人の縁の広がりを願う文様' },
  kikko: { name: '亀甲', meaning: '亀の甲羅の六角形。長寿と吉兆を願う文様' },
  kagome: { name: '籠目', meaning: '竹籠の編み目。魔を見張る目として、魔除けを願う文様' },
  yagasuri: { name: '矢絣', meaning: '射た矢は戻らない。門出と一途な思いを託す文様' },
  tatewaku: { name: '立涌', meaning: '立ち昇る蒸気。運気の上昇を願う文様' },
}

export const PHASE_NAMES: Record<Phase, string> = {
  idle: '凪',
  thinking: '思索',
  tool: '波紋',
  error: '乱',
  done: '開花',
}

const n = (v: number) => Math.round(v * 100) / 100

// 波紋の起点からの距離を 0〜1 に正規化する。各状態の CSS がこれを開始のずれに使う
export type Dist = (x: number, y: number) => number

function distFrom(origin: RippleOrigin, { w, h }: Size): Dist {
  const ox = origin.x * w
  const oy = origin.y * h
  const max = Math.max(...[[0, 0], [w, 0], [0, h], [w, h]].map(([x, y]) => Math.hypot((x ?? 0) - ox, (y ?? 0) - oy)))

  return (x, y) => n(Math.min(1, Math.hypot(x - ox, y - oy) / max))
}

// 青海波：前の段の扇に隠れない部分だけを弧として描く
function seigaiha(size: Size, dist: Dist): string {
  const r = 32
  const front = [[r, r / 2], [-r, r / 2]] as const
  const isVisible = (x: number, y: number) => front.every(([fx, fy]) => Math.hypot(x - fx, y - fy) >= r - 0.01)
  const arcs = [1, 0.75, 0.5, 0.25].map(k => {
    const rho = r * k
    let alpha = 0
    while (alpha < Math.PI / 2 && !isVisible(rho * Math.cos(Math.PI + alpha), rho * Math.sin(Math.PI + alpha))) {
      alpha += 0.005
    }
    const [a1, a2] = [Math.PI + alpha, 2 * Math.PI - alpha]
    const p = (a: number) => `${n(rho * Math.cos(a))} ${n(rho * Math.sin(a))}`
    return `<path pathLength="1" d="M${p(a1)}A${rho} ${rho} 0 0 1 ${p(a2)}"/>`
  })
  const uses: string[] = []
  for (let row = 0, y = 0; y <= size.h + r; row += 1, y += r / 2) {
    const offset = row % 2 === 0 ? 0 : r
    for (let x = offset - 2 * r; x <= size.w + 2 * r; x += 2 * r) {
      uses.push(`<use class="m" href="#fan" x="${x}" y="${y}" style="--t:${dist(x, y)}"/>`)
    }
  }

  return `<defs><g id="fan"><circle class="hit" r="${r}"/>${arcs.join('')}</g></defs>${uses.join('')}`
}

// 麻の葉：三角格子の各三角形で、重心から3頂点へ伸びる「Y」を描く
function asanoha(size: Size, dist: Dist): string {
  const s = 48
  const h = (s * Math.sqrt(3)) / 2
  const motifs: string[] = []
  type Pt = readonly [number, number]
  const pt = ([x, y]: Pt) => `${Math.round(x)} ${Math.round(y)}`
  for (let row = 0, y0 = -h; y0 <= size.h + h; row += 1, y0 += h) {
    const shift = row % 2 === 0 ? 0 : s / 2
    for (let x0 = -s + shift; x0 <= size.w + s; x0 += s) {
      const up: readonly [Pt, Pt, Pt] = [[x0, y0 + h], [x0 + s / 2, y0], [x0 + s, y0 + h]]
      const down: readonly [Pt, Pt, Pt] = [[x0 + s / 2, y0], [x0 + s, y0 + h], [x0 + (3 * s) / 2, y0]]
      for (const [p, q, t] of [up, down]) {
        const c: Pt = [(p[0] + q[0] + t[0]) / 3, (p[1] + q[1] + t[1]) / 3]
        const tri = `M${pt(p)}L${pt(q)}L${pt(t)}Z`
        const ys = `M${pt(c)}L${pt(p)}M${pt(c)}L${pt(q)}M${pt(c)}L${pt(t)}`
        // 三角形の内側全体を当たり判定にする（pointer-events:all）ので、当たり判定用の図形は持たない
        motifs.push(`<path class="m" pathLength="1" style="--t:${dist(c[0], c[1])}" d="${tri}${ys}"/>`)
      }
    }
  }

  return motifs.join('')
}

// 七宝：半径 r の円を、間隔 2r の格子とその中心点に置く
function shippo(size: Size, dist: Dist): string {
  const r = 30
  const circles: string[] = []
  for (let row = 0, y = 0; y <= size.h + r; row += 1, y += r) {
    const offset = row % 2 === 0 ? 0 : r
    for (let x = offset; x <= size.w + r; x += 2 * r) {
      circles.push(`<g class="m" style="--t:${dist(x, y)}"><circle class="hit" cx="${x}" cy="${y}" r="${r * 0.7}"/><circle pathLength="1" cx="${x}" cy="${y}" r="${r}"/></g>`)
    }
  }

  return circles.join('')
}

const BODIES: Record<Pattern, (size: Size, dist: Dist) => string> = {
  seigaiha,
  asanoha,
  shippo,
  kikko,
  kagome,
  yagasuri,
  tatewaku,
}

// 状態ごとの線の動き。--t（起点からの距離 0〜1）で開始をずらし、波として見せる
export const PHASE_CSS: Record<Phase, string> = {
  // 凪：ゆっくり描かれては消える。中心から3重の波紋
  // 低いコントラストで、作業中の演出との差を際立たせる
  idle: `[pathLength]{stroke-dasharray:1 1;stroke-width:var(--w,1.1);animation:calm 20s ease-in-out infinite;animation-delay:calc(var(--t) * -40s)}
@keyframes calm{0%{stroke-dashoffset:.7;opacity:.08}50%{stroke-dashoffset:0;opacity:.42}100%{stroke-dashoffset:-.7;opacity:.08}}`,
  // 思索：線の上を光の粒が流れていく
  thinking: `[pathLength]{stroke-dasharray:.04 .16;stroke-width:var(--w,1.8);animation:flow 2.6s linear infinite;animation-delay:calc(var(--t) * -5.2s)}
@keyframes flow{from{stroke-dashoffset:0;opacity:.5}50%{opacity:1}to{stroke-dashoffset:-1;opacity:.5}}`,
  // 波紋：ツールを呼んだ場所から、速い波紋が4重に広がる
  tool: `[pathLength]{stroke-dasharray:1 1;animation:draw 2.4s cubic-bezier(.3,0,.2,1) infinite;animation-delay:calc(var(--t) * -9.6s)}`,
  // 乱：朱に変わり、細かく震えて明滅する
  error: `[pathLength]{--col:${SHU};stroke-dasharray:.3 .05 .1 .05;animation:jitter .14s steps(2) infinite,flick 1.2s ease-in-out infinite;animation-delay:0s,calc(var(--t) * -3.6s)}
@keyframes jitter{50%{transform:translate(.8px,-.6px)}}
@keyframes flick{0%,100%{opacity:.25}40%{opacity:1}60%{opacity:.55}}`,
  // 開花：中心から外へ、全体の線が一斉に描き上がって光る
  done: `[pathLength]{stroke-dasharray:1 1;stroke-dashoffset:1;animation:bloom 1.6s cubic-bezier(.2,.7,.2,1) forwards,shine 4s ease-out forwards;animation-delay:calc(var(--t) * 1.4s),calc(var(--t) * 1.4s)}
@keyframes bloom{from{stroke-dashoffset:1;opacity:.2}to{stroke-dashoffset:0;opacity:1}}
@keyframes shine{0%{stroke:${GLOW};stroke-width:2.4}100%{stroke:var(--col,${AME});stroke-width:1.4}}`,
}

// SVG の上限（131072 文字）に収まるよう、描く面積の上限を決めておく
const MAX_AREA = 900 * 1100
const SVG_LIMIT = 130000

export function fitSize(size: Size): Size {
  const w = Math.max(160, Math.round(size.w))
  const h = Math.max(160, Math.round(size.h))
  const k = Math.min(1, Math.sqrt(MAX_AREA / (w * h)))

  return { w: Math.round(w * k), h: Math.round(h * k) }
}

export type SvgOptions = { size?: Size; scale?: number; origin?: RippleOrigin; isDopa?: boolean }

// 上限を超える大きさを頼まれたら、収まるまで描く面積を縮める。
// scale < 1 は文様を縮小して描く（帯のように細い場所で、模様の単位を小さく見せる）
export function wagaraSvg(pattern: Pattern, phase: Phase, options: SvgOptions = {}): string {
  const requested = options.size ?? DEFAULT_SIZE
  const scale = options.scale ?? 1
  const origin = phase === 'tool' ? (options.origin ?? CENTER) : CENTER
  let size = fitSize({ w: requested.w / scale, h: requested.h / scale })
  const isDopa = options.isDopa ?? false
  let svg = renderSvg(pattern, phase, size, scale, origin, isDopa)
  while (svg.length > SVG_LIMIT && size.w * size.h > 160 * 160) {
    size = { w: Math.round(size.w * 0.9), h: Math.round(size.h * 0.9) }
    svg = renderSvg(pattern, phase, size, scale, origin, isDopa)
  }

  return svg
}

function renderSvg(pattern: Pattern, phase: Phase, size: Size, scale: number, origin: RippleOrigin, isDopa: boolean): string {
  const { name, meaning } = LABELS[pattern]
  const [w, h] = [Math.round(size.w * scale), Math.round(size.h * scale)]
  const body = BODIES[pattern](size, distFrom(origin, size))
  // ドパガキは状態ごとの演出の代わりに、虹色・ネオン・脈動の演出を重ねる
  const motion = isDopa ? dopaCss(phase) : PHASE_CSS[phase]
  const drawn = isDopa
    ? `<defs>${GLOW_FILTER}</defs><g filter="url(#glow)"><g class="sway"><g class="dopa">${body}</g></g></g>`
    : body

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${size.w} ${size.h}" preserveAspectRatio="xMinYMid slice">
<style>
svg{display:block;background:transparent}
path,circle{fill:none;stroke-linecap:round}
.hit{fill:#000;fill-opacity:0;stroke:none;pointer-events:all}
path.m,g.m>path{pointer-events:all}
[pathLength]{stroke:var(--col,${AME});stroke-width:var(--w,1.4);transform-box:fill-box;
  transition:stroke 1.6s ease-out,stroke-width 1.6s ease-out}
@keyframes draw{0%{stroke-dashoffset:1;opacity:.15}45%,55%{stroke-dashoffset:0;opacity:1}100%{stroke-dashoffset:-1;opacity:.15}}
${motion}
.m:hover{--col:${SHU};--w:2.6}
.m:hover[pathLength],.m:hover [pathLength]{transition-duration:.15s}
</style>
<title>${name}（${PHASE_NAMES[phase]}${isDopa ? '・ドパガキ' : ''}）：${meaning}</title>
${drawn}
</svg>`
}

// ステータスラインの回転記号。作業中はこれを順に送る
export const SPINNER: Record<Pattern, readonly string[]> = {
  seigaiha: ['◜', '◝', '◞', '◟'],
  asanoha: ['✶', '✷', '✸', '✹', '✸', '✷'],
  shippo: ['○', '◎', '◉', '◎'],
  kikko: ['⬡', '⬢'],
  kagome: ['△', '▽'],
  yagasuri: ['›', '»'],
  tatewaku: ['(', ')'],
}

const PHASE_GLYPH: Partial<Record<Phase, string>> = { idle: '〜', error: '✕', done: '❀' }

export function statusText(pattern: Pattern, phase: Phase, frame: number, isDopa = false): string {
  const glyphs = isDopa ? DOPA_SPARKLE : SPINNER[pattern]
  const glyph = (isDopa && phase !== 'error' ? undefined : PHASE_GLYPH[phase]) ?? glyphs[frame % glyphs.length] ?? '〜'
  const tail = isDopa ? '・ドパガキ' : ''

  return `${glyph} ${LABELS[pattern].name}・${PHASE_NAMES[phase]}${tail}`
}

// ターミナル向けの文字の文様（2段）
export const GLYPHS: Record<Pattern, readonly [string, string]> = {
  seigaiha: ['◠ ', ' ◠'],
  asanoha: ['╲╱', '╱╲'],
  shippo: ['()', ')('],
  kikko: ['/\\_', '\\_/'],
  kagome: ['/\\', '\\/'],
  yagasuri: ['>>', '<<'],
  tatewaku: ['( )', ') ('],
}

export function glyphRow(pattern: Pattern, row: 0 | 1, columns: number, offset: number): string {
  const unit = GLYPHS[pattern][row]
  const repeated = unit.repeat(Math.ceil((columns + unit.length) / unit.length) + 1)
  const start = offset % unit.length

  return repeated.slice(start, start + columns)
}
