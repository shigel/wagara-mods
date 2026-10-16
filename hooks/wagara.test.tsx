import { describe, expect, test } from 'claude-code/testing'

import { PHASE_CSS, glyphRow, statusText, wagaraSvg } from './patterns'
import { DEMO_STEPS, currentPattern, demoTable, helpText, parseArgs, parseMode, randomOrigin } from './register'

const PHASES = ['idle', 'thinking', 'tool', 'error', 'done'] as const
const PATTERNS = ['seigaiha', 'asanoha', 'shippo', 'kikko', 'kagome', 'yagasuri', 'tatewaku'] as const

describe('柄の選び方', () => {
  test('auto はターンごとに7つの柄を巡る', async () => {
    expect([0, 1, 2, 3, 6, 7].map(t => currentPattern('auto', t))).toEqual(['seigaiha', 'asanoha', 'shippo', 'kikko', 'tatewaku', 'seigaiha'])
    expect(currentPattern('off', 5)).toBe(null)
  })

  test('/wagara は和名でも英名でも受け付ける', async () => {
    expect(parseMode('麻の葉')).toBe('asanoha')
    expect(parseMode(' SHIPPO ')).toBe('shippo')
    expect(parseMode('')).toBe(null)
    expect(parseMode('唐草')).toBe(null)
  })

  test('デモは5つの状態・7つの柄・ドパガキをすべて通る', async () => {
    expect(new Set(DEMO_STEPS.map(s => s.phase)).size).toBe(5)
    expect([...new Set(DEMO_STEPS.map(s => s.pattern))].sort()).toEqual([...PATTERNS].sort())
    expect(DEMO_STEPS.some(s => s.isDopa) && DEMO_STEPS.some(s => !s.isDopa)).toBe(true)
    expect(DEMO_STEPS.every(s => s.text.length > 0 && s.ms >= 3000)).toBe(true)
    const table = demoTable().split('\n')
    expect(table.length).toBe(DEMO_STEPS.length + 2)
    expect(table[2]).toBe('| 1 | 青海波 | 凪 `idle` | 待機中。線がゆっくり息をしています | 7秒 |')
    for (const ph of PHASES) {
      expect(table.some(row => row.includes(`\`${ph}\``))).toBe(true)
    }
  })

  test('/wagara は柄・状態・表示を空白区切りで組み合わせられる', async () => {
    expect(parseArgs('seigaiha thinking dopagaki')).toEqual({ mode: 'seigaiha', phase: 'thinking', isDopa: true, unknown: [] })
    expect(parseArgs('麻の葉 error normal')).toEqual({ mode: 'asanoha', phase: 'error', isDopa: false, unknown: [] })
    expect(parseArgs('shippo  唐草 done')).toEqual({ mode: 'shippo', phase: 'done', unknown: ['唐草'] })
    expect(parseArgs('seigaiha shippo')).toEqual({ mode: 'shippo', unknown: [] })
    expect(parseArgs('')).toEqual({ unknown: [] })
    expect(parseArgs('籠目 -status +band')).toEqual({ mode: 'kagome', show: { status: false, band: true }, unknown: [] })
    expect(parseArgs('-pane 矢絣 立涌')).toEqual({ mode: 'tatewaku', show: { pane: false }, unknown: [] })
    expect(parseArgs('auto normal +status +pane +toast')).toEqual({ mode: 'auto', isDopa: false, show: { status: true, pane: true, toast: true }, unknown: [] })
    expect(parseArgs('矢絣 +all')).toEqual({ mode: 'yagasuri', show: { pane: true, band: true, status: true, toast: true }, unknown: [] })
    expect(parseArgs('+ALL -band')).toEqual({ show: { pane: true, band: false, status: true, toast: true }, unknown: [] })
    expect(parseArgs('-all')).toEqual({ show: { pane: false, band: false, status: false, toast: false }, unknown: [] })
  })

  test('help は柄・状態・表示・場所の指定をすべて載せる', async () => {
    const help = helpText()
    for (const word of [...PATTERNS, ...PHASES, 'dopagaki', 'normal', '+status', '-toast', '+all', 'demo', 'next']) {
      expect(help).toContain(`\`${word}\``)
    }
  })

  test('ツールの波紋の起点は毎回ちがい、端に寄りすぎない', async () => {
    const points = [1, 2, 3].map(randomOrigin)
    expect(new Set(points.map(p => `${p.x},${p.y}`)).size).toBe(3)
    for (const { x, y } of points) {
      expect(x >= 0.15 && x <= 0.85 && y >= 0.15 && y <= 0.85).toBe(true)
    }
  })
})

describe('描画', () => {
  test('5つの状態と7つの柄のすべてで、上限内・スクリプトなし・背景透過の SVG になる', async () => {
    for (const p of PATTERNS) {
      for (const ph of PHASES) {
        const svg = wagaraSvg(p, ph, { size: { w: 600, h: 1000 } })
        expect(svg.length).toBeLessThan(131072)
        expect(svg.includes('<script')).toBe(false)
        expect(svg).toContain('pathLength="1"')
        expect(svg).toContain(PHASE_CSS[ph].slice(0, 40))
      }
    }
  })

  test('ドパガキは全状態・全柄で上限内に収まり、光と虹色をまとう', async () => {
    for (const p of PATTERNS) {
      for (const ph of PHASES) {
        const svg = wagaraSvg(p, ph, { size: { w: 600, h: 1000 }, isDopa: true })
        expect(svg.length).toBeLessThan(131072)
        expect(svg).toContain('url(#glow)')
        expect(svg).toContain(ph === 'error' ? 'flash' : 'hue-rotate')
      }
    }
    expect(statusText('shippo', 'idle', 0, true)).toBe('✦ 七宝・凪・ドパガキ')
  })

  test('ちらつかない：細かい階段状の明滅を使わず、どの状態も線が見えた状態から始まる', async () => {
    for (const css of Object.values(PHASE_CSS)) {
      expect(css.includes('steps(')).toBe(false)
      expect(/stroke-dashoffset:1[;}]/.test(css)).toBe(false)
    }
  })

  test('カクカクしない：開花は線ごとに時間をずらさず、太さも動かさず、円のマスクで広げる', async () => {
    for (const isDopa of [false, true]) {
      const svg = wagaraSvg('kagome', 'done', { size: { w: 600, h: 1000 }, isDopa })
      // 最後に効く線の規則（ドパガキは基本の規則を animation の一括指定で上書きし、ずらしも消える）
      const rules = svg.slice(0, svg.indexOf('</style>')).split('[pathLength]{')
      expect(rules.at(-1)?.split('}')[0]?.includes('animation-delay')).toBe(false)
      expect(/@keyframes (bloom|burst|shine|cool)\{[^@]*stroke-width/.test(svg)).toBe(false)
      expect(svg).toContain('mask="url(#bloomMask)"')
    }
    expect(wagaraSvg('kagome', 'tool', { size: { w: 600, h: 1000 } })).not.toContain('bloomMask')
  })

  test('軽く滑らか：凪は動かず、思索・波紋・乱は外側の svg だけを動かす', async () => {
    const look = (ph: (typeof PHASES)[number]) => wagaraSvg('asanoha', ph, { size: { w: 600, h: 1000 }, origin: { x: 0.2, y: 0.3 } })
    expect(look('idle').includes('animation')).toBe(false)
    expect(look('thinking')).toContain('svg{animation:tide')
    expect(look('tool')).toContain('svg{animation:surge')
    expect(look('error')).toContain('svg{animation:tremor')
    for (const ph of ['idle', 'thinking', 'tool', 'error'] as const) {
      // 中の線や円にはアニメーションを付けない（毎コマ全体を描き直さない）
      expect(PHASE_CSS[ph].includes('animation')).toBe(false)
      expect(look(ph)).not.toContain('mask=')
    }
    // 波紋は起点が変わっても同じ SVG（ツールのたびに作り直さない）
    expect(look('tool')).toBe(wagaraSvg('asanoha', 'tool', { size: { w: 600, h: 1000 }, origin: { x: 0.8, y: 0.7 } }))
  })


  test('ステータスラインは状態名を添え、作業中だけ記号が回る', async () => {
    expect(statusText('seigaiha', 'idle', 3)).toBe('〜 青海波・凪')
    expect(statusText('seigaiha', 'error', 0)).toBe('✕ 青海波・乱')
    expect([0, 1, 2, 3].map(f => statusText('seigaiha', 'thinking', f).slice(0, 1)).join('')).toBe('◜◝◞◟')
  })

  test('帯の大きさ（高さ26・半分の縮尺）でも7つの柄が上限内に描ける', async () => {
    for (const p of PATTERNS) {
      const svg = wagaraSvg(p, 'tool', { size: { w: 1200, h: 26 }, scale: 0.5 })
      expect(svg).toContain('height="26"')
      expect(svg.length).toBeLessThan(131072)
    }
  })

  test('ターミナルの文字列は幅ぴったりで、ずらすと流れる', async () => {
    expect(glyphRow('asanoha', 0, 7, 0)).toBe('╲╱╲╱╲╱╲')
    expect(glyphRow('asanoha', 0, 7, 1)).toBe('╱╲╱╲╱╲╱')
  })

  test('desktop のペインは操作できる Svg、terminal は Client で描く', async $ => {
    const PANE = {
      plugin: 'wagara-obi',
      component: 'Pane',
      requestId: 'wagara',
      props: { title: '和柄', isFocused: false, bodyColumns: 40, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} },
    } as const
    const desk = await $.ui.mount({ ...PANE, surface: 'desktop' })
    const svg = await desk.find({ type: 'Svg' })
    expect(svg?.props.isInteractive).toBe(true)
    expect(String(svg?.props.alt)).toContain('青海波')
    await desk.unmount()

    const term = await $.ui.mount({ ...PANE, surface: 'terminal' })
    expect(String((await term.find({ type: 'Client' }))?.props.module)).toContain('term.tsx')
    await term.unmount()
  })
})
