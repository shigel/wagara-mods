import { describe, expect, test } from 'claude-code/testing'

import { PHASE_CSS, glyphRow, statusText, wagaraSvg } from './patterns'
import { DEMO_STEPS, currentPattern, demoTable, parseMode, randomOrigin } from './register'

const PHASES = ['idle', 'thinking', 'tool', 'error', 'done'] as const
const PATTERNS = ['seigaiha', 'asanoha', 'shippo'] as const

describe('柄の選び方', () => {
  test('auto はターンごとに青海波→麻の葉→七宝と巡る', async () => {
    expect([0, 1, 2, 3].map(t => currentPattern('auto', t))).toEqual(['seigaiha', 'asanoha', 'shippo', 'seigaiha'])
    expect(currentPattern('off', 5)).toBe(null)
  })

  test('/wagara は和名でも英名でも受け付ける', async () => {
    expect(parseMode('麻の葉')).toBe('asanoha')
    expect(parseMode(' SHIPPO ')).toBe('shippo')
    expect(parseMode('')).toBe(null)
    expect(parseMode('唐草')).toBe(null)
  })

  test('デモは5つの状態・3つの柄・ドパガキをすべて通る', async () => {
    expect(new Set(DEMO_STEPS.map(s => s.phase)).size).toBe(5)
    expect(new Set(DEMO_STEPS.map(s => s.pattern)).size).toBe(3)
    expect(DEMO_STEPS.some(s => s.isDopa) && DEMO_STEPS.some(s => !s.isDopa)).toBe(true)
    expect(DEMO_STEPS.every(s => s.text.length > 0 && s.ms >= 3000)).toBe(true)
    const table = demoTable().split('\n')
    expect(table.length).toBe(DEMO_STEPS.length + 2)
    expect(table[2]).toBe('| 1 | 青海波 | 凪 `idle` | 待機中。線がゆっくり息をしています | 7秒 |')
    for (const ph of PHASES) {
      expect(table.some(row => row.includes(`\`${ph}\``))).toBe(true)
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
  test('5つの状態と3つの柄のすべてで、上限内・スクリプトなし・背景透過の SVG になる', async () => {
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

  test('状態ごとに線の動きがちがう', async () => {
    expect(PHASE_CSS.thinking).toContain('flow')
    expect(PHASE_CSS.error).toContain('jitter')
    expect(PHASE_CSS.done).toContain('bloom')
    expect(new Set(Object.values(PHASE_CSS)).size).toBe(5)
  })

  test('ステータスラインは状態名を添え、作業中だけ記号が回る', async () => {
    expect(statusText('seigaiha', 'idle', 3)).toBe('〜 青海波・凪')
    expect(statusText('seigaiha', 'error', 0)).toBe('✕ 青海波・乱')
    expect([0, 1, 2, 3].map(f => statusText('seigaiha', 'thinking', f).slice(0, 1)).join('')).toBe('◜◝◞◟')
  })

  test('帯は細い Svg（Desktop）と1行の Client（terminal）で描く', async $ => {
    const BAND = {
      plugin: 'wagara-obi',
      component: 'AbovePrompt',
      props: { hasSurvey: false, isWorking: true, maxRows: 10, bodyColumns: 80, scroll: { offset: 0, bodyRows: 10 }, view: {} },
    } as const
    const desk = await $.ui.mount({ ...BAND, surface: 'desktop' })
    const svg = await desk.find({ type: 'Svg' })
    expect(svg?.props.height).toBe(26)
    expect(String(svg?.props.source).length).toBeLessThan(131072)
    await desk.unmount()
    const term = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect((await term.find({ type: 'Client' }))?.props.height).toBe(1)
    await term.unmount()
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
