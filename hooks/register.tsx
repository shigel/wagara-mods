import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { Mode, Pattern, Phase, RippleOrigin, Show } from '../types'
import { CENTER, LABELS, PATTERNS, PHASE_NAMES, fitSize, statusText, wagaraSvg } from './patterns'

const PANE = 'wagara'
const BAND_HEIGHT = 26
const SPIN_MS = 220
const BLOOM_MS = 5000
const mode = atom({ plugin: 'wagara-obi', key: 'mode' } as const, 'auto')
const turns = atom({ plugin: 'wagara-obi', key: 'turns' } as const, 0)
const phase = atom({ plugin: 'wagara-obi', key: 'phase' } as const, 'idle')
const origin = atom({ plugin: 'wagara-obi', key: 'origin' } as const, CENTER)
const isDopa = atom({ plugin: 'wagara-obi', key: 'isDopa' } as const, false)
const show = atom({ plugin: 'wagara-obi', key: 'show' } as const, { pane: true, band: true, status: true })
const PLACES = ['pane', 'band', 'status'] as const
const DOPA_WORDS = ['dopagaki', 'dopa', 'ドパガキ']

const MODES: readonly Mode[] = [...PATTERNS, 'auto', 'off']
const PHASES: readonly Phase[] = ['idle', 'thinking', 'tool', 'error', 'done']
const ALIASES: Record<string, Mode> = {
  青海波: 'seigaiha',
  麻の葉: 'asanoha',
  七宝: 'shippo',
  亀甲: 'kikko',
  籠目: 'kagome',
  矢絣: 'yagasuri',
  立涌: 'tatewaku',
}

export function currentPattern(m: Mode, turnCount: number): Pattern | null {
  if (m === 'off') {
    return null
  }

  return m === 'auto' ? (PATTERNS[turnCount % PATTERNS.length] ?? 'seigaiha') : m
}

export function parseMode(args: string): Mode | null {
  const word = args.trim()
  if (word === '') {
    return null
  }

  return ALIASES[word] ?? MODES.find(m => m === word.toLowerCase()) ?? null
}

export type WagaraArgs = { mode?: Mode; phase?: Phase; isDopa?: boolean; show?: Partial<Show>; unknown: string[] }

// 空白区切りの語を左から読み、柄・状態・表示ごとに後の語を優先する
export function parseArgs(args: string): WagaraArgs {
  const result: WagaraArgs = { unknown: [] }
  for (const word of args.trim().split(/\s+/).filter(w => w !== '')) {
    const lower = word.toLowerCase()
    const asMode = parseMode(word)
    const asPhase = PHASES.find(p => p === lower)
    if (asMode !== null) {
      result.mode = asMode
    } else if (asPhase !== undefined) {
      result.phase = asPhase
    } else if (DOPA_WORDS.includes(lower)) {
      result.isDopa = true
    } else if (lower === 'normal' || word === 'ノーマル') {
      result.isDopa = false
    } else if (/^[+-](pane|band|status)$/.test(lower)) {
      // +status で出す、-status でしまう（pane・band も同じ）
      const place = lower.slice(1) as keyof Show
      result.show = { ...result.show, [place]: lower.startsWith('+') }
    } else {
      result.unknown = [...result.unknown, word]
    }
  }

  return result
}

// ツールを呼ぶたびに、波紋の起点を帯やペインの中のどこかへ散らす
export function randomOrigin(seed: number): RippleOrigin {
  const x = Math.abs(Math.sin(seed * 12.9898) * 43758.5453) % 1
  const y = Math.abs(Math.sin(seed * 78.233) * 12345.6789) % 1

  return { x: 0.15 + x * 0.7, y: 0.15 + y * 0.7 }
}

async function patternNow($: EngineInterface): Promise<Pattern | null> {
  return currentPattern(await read($, mode), await read($, turns))
}

function announce($: EngineInterface, pattern: Pattern, timeoutMs = 8000) {
  const { name, meaning } = LABELS[pattern]
  $.ui.toast(`${name} ─ ${meaning}`, { timeoutMs })
}

// ステータスライン。作業中（思索・波紋）だけ記号が回る（再読み込みで止まり、作り直される）
let spinner: Timer | undefined
let bloomTimer: Timer | undefined
let frame = 0
let toolCount = 0

function stopSpin() {
  spinner?.cancel()
  spinner = undefined
}

async function setPhase($: EngineInterface, next: Phase) {
  bloomTimer?.cancel()
  bloomTimer = undefined
  await update($, phase, () => next)
  stopSpin()
  const pattern = await patternNow($)
  if (pattern === null || !(await read($, show)).status) {
    $.ui.status(undefined)
    return
  }
  const dopa = await read($, isDopa)
  $.ui.status(statusText(pattern, next, frame, dopa))
  // ドパガキ中は待機中もきらめき続ける
  if (next === 'thinking' || next === 'tool' || (dopa && next !== 'error')) {
    spinner = $.clock.every(dopa ? SPIN_MS / 2 : SPIN_MS, () => {
      frame += 1
      $.ui.status(statusText(pattern, next, frame, dopa))
    })
  }
}

// デモ：柄・状態・ドパガキを、説明のトーストを添えて順に見せる
type DemoStep = { pattern: Pattern; phase: Phase; isDopa: boolean; text: string; ms: number }

export const DEMO_STEPS: readonly DemoStep[] = [
  { pattern: 'seigaiha', phase: 'idle', isDopa: false, ms: 7000, text: '凪 ── 待機中。線がゆっくり息をしています' },
  { pattern: 'seigaiha', phase: 'thinking', isDopa: false, ms: 7000, text: '思索 ── プロンプトを受けると、線の上を光が流れ始めます' },
  { pattern: 'seigaiha', phase: 'tool', isDopa: false, ms: 4000, text: '波紋 ── ツールを呼ぶたび、その場所から波紋が広がります' },
  { pattern: 'seigaiha', phase: 'tool', isDopa: false, ms: 4000, text: '波紋 ── 呼ぶたびに起点が変わります' },
  { pattern: 'asanoha', phase: 'error', isDopa: false, ms: 5000, text: '乱 ── エラーが出ると、朱に変わって震えます' },
  { pattern: 'asanoha', phase: 'done', isDopa: false, ms: 6000, text: '開花 ── ターンが終わると、中心から一斉に咲き上がります' },
  { pattern: 'shippo', phase: 'idle', isDopa: false, ms: 6000, text: '柄はターンごとに 青海波 → 麻の葉 → 七宝 と移ります。触れると朱に光ります' },
  { pattern: 'shippo', phase: 'thinking', isDopa: true, ms: 6000, text: 'ドパガキ ── /wagara dopagaki で、虹色のネオンが脈打ちます' },
  { pattern: 'asanoha', phase: 'tool', isDopa: true, ms: 5000, text: 'ドパガキの波紋 ── ツールのたびに光が弾けます' },
  { pattern: 'seigaiha', phase: 'done', isDopa: true, ms: 6000, text: 'ドパガキの開花 ── 白く光って咲き、虹色へほどけます' },
]

// デモ開始時に見せる場面の一覧（Markdown の表）
export function demoTable(): string {
  const rows = DEMO_STEPS.map((s, i) => {
    // 英語の状態名は /wagara <phase> でそのまま試せる
    const look = `${PHASE_NAMES[s.phase]} \`${s.phase}\`${s.isDopa ? '（ドパガキ）' : ''}`
    const desc = s.text.split(' ── ').pop() ?? s.text
    return `| ${i + 1} | ${LABELS[s.pattern].name} | ${look} | ${desc} | ${s.ms / 1000}秒 |`
  })

  return ['| # | 柄 | 演出（状態） | 説明 | 長さ |', '|---|---|---|---|---|', ...rows].join('\n')
}

let demoTimer: Timer | undefined
let demoRestore: { mode: Mode; isDopa: boolean } | undefined

async function playDemoStep($: EngineInterface, index: number) {
  const step = DEMO_STEPS[index]
  if (step === undefined) {
    await finishDemo($)
    return
  }
  await update($, mode, () => step.pattern)
  await update($, isDopa, () => step.isDopa)
  if (step.phase === 'tool') {
    await update($, origin, () => randomOrigin(index * 7 + 3))
  }
  await setPhase($, step.phase)
  $.ui.toast(`デモ ${index + 1}/${DEMO_STEPS.length}｜${step.text}`, { timeoutMs: step.ms })
  demoTimer = $.clock.after(step.ms, () => {
    void playDemoStep($, index + 1)
  })
}

async function finishDemo($: EngineInterface) {
  demoTimer?.cancel()
  demoTimer = undefined
  const saved = demoRestore
  demoRestore = undefined
  if (saved !== undefined) {
    await update($, mode, () => saved.mode)
    await update($, isDopa, () => saved.isDopa)
  }
  await setPhase($, 'idle')
  $.ui.toast('デモ終了 ── もとの設定に戻しました', { timeoutMs: 5000 })
}

// 開花のあと、しばらくして凪に戻す
function settleLater($: EngineInterface) {
  bloomTimer = $.clock.after(BLOOM_MS, () => {
    void setPhase($, 'idle')
  })
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'wagara',
      description: '和柄の柄・状態・表示・表示場所を替える（空白区切りで組み合わせ可）',
      argumentHint: '[柄] [状態] [dopagaki|normal] [+|-pane|band|status] / demo / toast / off',
    })
    if ((await read($, mode)) !== 'off' && (await read($, show)).pane) {
      void $.ui.open({ id: PANE, title: '和柄' })
    }
    await setPhase($, 'idle')

    return next(e)
  })

  on('command.run', { command: 'wagara' }, async ($, e) => {
    const arg = e.args.trim()
    // /wagara toast：トーストの見え方を試す（今の柄で10秒）
    if (arg === 'toast') {
      const pattern = (await patternNow($)) ?? 'seigaiha'
      announce($, pattern, 10000)

      return { text: `${LABELS[pattern].name}のトーストを10秒表示しました` }
    }
    // /wagara demo：全演出を説明付きで順に見せる。実行中にもう一度打つと止める
    if (arg === 'demo' || arg === 'デモ') {
      if (demoRestore !== undefined) {
        await finishDemo($)

        return { text: 'デモを止めました' }
      }
      demoRestore = { mode: await read($, mode), isDopa: await read($, isDopa) }
      await $.ui.open({ id: PANE, title: '和柄' })
      await playDemoStep($, 0)
      const total = Math.round(DEMO_STEPS.reduce((sum, s) => sum + s.ms, 0) / 1000)

      return { text: `デモを始めました（約${total}秒、全${DEMO_STEPS.length}場面）。止めるときはもう一度 /wagara demo\n\n${demoTable()}` }
    }
    // 柄・状態・表示は空白区切りで組み合わせられる（例: /wagara seigaiha thinking dopagaki）
    const wanted = parseArgs(arg)
    if (wanted.mode === 'off') {
      await update($, mode, () => 'off')
      await update($, isDopa, () => false)
      await $.ui.close({ id: PANE })
      await setPhase($, 'idle')

      return { text: '和柄をしまいました' }
    }
    const before = await patternNow($)
    const wasDopa = await read($, isDopa)
    if (wanted.mode !== undefined) {
      const next = wanted.mode
      await update($, mode, () => next)
    }
    if (wanted.isDopa !== undefined) {
      const next = wanted.isDopa
      await update($, isDopa, () => next)
    }
    const places = await update($, show, s => ({ ...s, ...wanted.show }))
    if (places.pane) {
      await $.ui.open({ id: PANE, title: '和柄' })
    } else {
      await $.ui.close({ id: PANE })
    }
    if (wanted.phase !== undefined) {
      await update($, origin, () => randomOrigin(Date.now()))
    }
    await setPhase($, wanted.phase ?? (await read($, phase)))
    if (wanted.phase === 'done') {
      settleLater($)
    }
    const pattern = (await patternNow($)) ?? 'seigaiha'
    const isDopaNow = await read($, isDopa)
    if (isDopaNow !== wasDopa) {
      $.ui.toast(isDopaNow ? 'ドパガキ全開 ── 和柄が光って脈打ちます' : 'ドパガキを鎮めました', { timeoutMs: 6000 })
    } else if (pattern !== before) {
      announce($, pattern)
    }

    const how = (await read($, mode)) === 'auto' ? `${LABELS[pattern].name}（ターンごとに移り変わる）` : LABELS[pattern].name
    const look = isDopaNow ? 'ドパガキ（/wagara normal で戻る）' : 'ノーマル'
    const where = PLACES.map(p => `${places[p] ? '+' : '-'}${p}`).join(' ')
    const state = PHASE_NAMES[await read($, phase)]
    const skipped = wanted.unknown.length > 0 ? `\n分からない語は無視しました: ${wanted.unknown.join(' ')}` : ''
    const usage = `使い方: /wagara [柄] [状態] [表示] [場所]（空白区切りで組み合わせ可）。柄: ${MODES.join(' | ')}、状態: ${PHASES.join(' | ')}、表示: dopagaki | normal、場所: +pane -pane +band -band +status -status、ほか: demo | toast`

    return { text: `柄: ${how}／状態: ${state}／表示: ${look}／場所: ${where}${skipped}\n${usage}` }
  })

  // 思索：プロンプトを受けたら線の上を光が流れ始める。飾りの失敗でプロンプトを止めない
  on('prompt.submit', async ($, e, next) => {
    await setPhase($, 'thinking')

    return next(e)
  }).catch(($, e, next) => (next.called ? undefined : next(e)))

  // 波紋：ツールを呼ぶたびに別の場所から波紋。失敗したら乱
  on('tool.call', async ($, e, next) => {
    toolCount += 1
    await update($, origin, () => randomOrigin(toolCount))
    await setPhase($, 'tool')
    const result = await next(e)
    if (result.deny === undefined && result.isError === true) {
      await setPhase($, 'error')
    }

    return result
  }).catch(($, e, next) => (next.called ? undefined : next(e)))

  // 開花：ターンが終わると全体が描き上がり、次の柄へ移ってトーストで意味を添える
  on('turn.complete', async ($, e, next) => {
    const before = await patternNow($)
    await update($, turns, t => t + 1)
    const after = await patternNow($)
    await setPhase($, 'done')
    settleLater($)
    if (after !== null && after !== before) {
      announce($, after)
    }

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    demoTimer?.cancel()
    stopSpin()
    bloomTimer?.cancel()

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const pattern = (await patternNow($)) ?? 'seigaiha'
    const now = await read($, phase)
    const { name, meaning } = LABELS[pattern]
    const rows = Math.max(2, e.props.scroll.bodyRows)
    if (e.surface === 'terminal') {
      const { Client } = $.ui.resolve(e)

      return <Client key="obi" module="./term.tsx" props={{ pattern, isWorking: now !== 'idle' }} height={rows} flexGrow={1} />
    }
    // 文字セルを px に見積もってペインいっぱいに描く（Desktop の 1 セルはおよそ 8.4 × 19 px）
    const size = fitSize({ w: e.props.bodyColumns * 8.4, h: rows * 19 })
    const { Svg } = $.ui.resolve(e)
    const svg = wagaraSvg(pattern, now, { size, origin: await read($, origin), isDopa: await read($, isDopa) })

    return <Svg source={svg} alt={`${name}：${meaning}`} width={size.w} height={size.h} isInteractive />
  })

  // プロンプトの上の細い帯。文様を半分の大きさで、同じ状態の演出を流す
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const pattern = await patternNow($)
    if (e.props.hasSurvey || pattern === null || !(await read($, show)).band) {
      return next(e)
    }
    const now = await read($, phase)
    if (e.surface === 'terminal') {
      const { Client } = $.ui.resolve(e)

      return <Client key="band" module="./term.tsx" props={{ pattern, isWorking: now !== 'idle' }} height={1} flexGrow={1} />
    }
    const w = Math.round(e.props.bodyColumns * 8.4)
    const { Svg } = $.ui.resolve(e)
    const { name, meaning } = LABELS[pattern]
    const svg = wagaraSvg(pattern, now, { size: { w, h: BAND_HEIGHT }, scale: 0.5, origin: await read($, origin), isDopa: await read($, isDopa) })

    return <Svg source={svg} alt={`${name}の帯：${meaning}`} width={w} height={BAND_HEIGHT} isInteractive />
  })
}
