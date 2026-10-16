import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, Timer } from 'claude-code'

import type { DemoSaved, Mode, Pattern, Phase, RippleOrigin, Scene, Show } from '../types'
import { CENTER, LABELS, PATTERNS, PHASE_NAMES, fitSize, statusText, wagaraSvg } from './patterns'

const PANE = 'wagara'
const BAND_HEIGHT = 26
const SPIN_MS = 220
const BLOOM_MS = 5000
const mode = atom({ plugin: 'wagara-obi', key: 'mode' } as const, 'off')
const turns = atom({ plugin: 'wagara-obi', key: 'turns' } as const, 0)
const phase = atom({ plugin: 'wagara-obi', key: 'phase' } as const, 'idle')
const origin = atom({ plugin: 'wagara-obi', key: 'origin' } as const, CENTER)
const isDopa = atom({ plugin: 'wagara-obi', key: 'isDopa' } as const, false)
// デモ中だけ、始める前の柄と表示を預ける（null はデモなし）
const demoSaved = atom({ plugin: 'wagara-obi', key: 'demoSaved' } as const, null as DemoSaved)
const scene = atom({ plugin: 'wagara-obi', key: 'scene' } as const, {
  pattern: 'seigaiha',
  phase: 'idle',
  origin: CENTER,
  isDopa: false,
  band: false,
} as Scene)
// 既定はステータスラインだけ。ペイン・帯・トーストは +pane などで出す
const show = atom({ plugin: 'wagara-obi', key: 'show' } as const, { pane: false, band: false, status: true, toast: false })
const PLACES = ['pane', 'band', 'status', 'toast'] as const
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

const HELP_WORDS = ['help', '?', 'ヘルプ']

// /wagara help の表示（Markdown）
export function helpText(): string {
  const patterns = PATTERNS.map(p => `\`${p}\`（${LABELS[p].name}）`).join('・')
  const phases = PHASES.map(p => `\`${p}\`（${PHASE_NAMES[p]}）`).join('・')

  return [
    '**/wagara の使い方** ── 語を空白で区切って組み合わせられます（同じ種類は後ろが優先）',
    '',
    '| 種類 | 指定 |',
    '|---|---|',
    `| 柄 | ${patterns}・\`auto\`（ターンごとに巡る）・\`off\`（しまう） |`,
    `| 状態 | ${phases} |`,
    '| 表示 | `dopagaki`（虹色ネオン）・`normal`（ふだん） |',
    '| 場所 | `+pane` `-pane`・`+band` `-band`・`+status` `-status`・`+toast` `-toast`・`+all` `-all`（4か所まとめて） |',
    '| その他 | `demo`（全演出を約1分で見せる）・`next`（柄を1つ送る）・`toast`（トーストを試す）・`help`（この表示） |',
    '',
    '例: `/wagara 籠目 thinking dopagaki -status`',
  ].join('\n')
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
    } else if (/^[+-](pane|band|status|toast)$/.test(lower)) {
      // +status で出す、-status でしまう（pane・band も同じ）
      const place = lower.slice(1) as keyof Show
      result.show = { ...result.show, [place]: lower.startsWith('+') }
    } else if (lower === '+all' || lower === '-all') {
      // +all で4か所すべて出す、-all ですべてしまう（後ろの語で個別に上書きできる）
      const isOn = lower === '+all'
      result.show = { ...result.show, pane: isOn, band: isOn, status: isOn, toast: isOn }
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

// 柄が替わったときのトースト。-toast（既定）のときは出さない
async function announce($: EngineInterface, pattern: Pattern) {
  if ((await read($, show)).toast !== true) {
    return
  }
  const { name, meaning } = LABELS[pattern]
  $.ui.toast(`${name} ─ ${meaning}`, { timeoutMs: 8000 })
}

// ステータスライン。作業中（思索・波紋）だけ記号が回る（再読み込みで止まり、作り直される）
let spinner: Timer | undefined
let bloomTimer: Timer | undefined
let frame = 0
let toolCount = 0
// setPhase の呼び出しごとに増やす。並んで走ったとき、最後の呼び出しだけがタイマーと表示を持つ
let generation = 0
// 今の状態を await なしで読むための写し（並列のツール呼び出しが、そろって「波紋に入った」と思わないため）
let phaseNow: Phase = 'idle'

function stopSpin() {
  spinner?.cancel()
  spinner = undefined
}

async function setPhase($: EngineInterface, next: Phase) {
  generation += 1
  const mine = generation
  // await の前に止める。後から作るのは最新の呼び出しだけなので、回る記号が二重にならない
  bloomTimer?.cancel()
  bloomTimer = undefined
  stopSpin()
  phaseNow = next
  await update($, phase, () => next)
  await publishScene($, mine, next)
  const pattern = await patternNow($)
  const isShown = (await read($, show)).status
  const dopa = await read($, isDopa)
  if (mine !== generation) {
    return
  }
  // 開花は描き上がると止まる演出なので、必ず凪へ戻す（再読み込みでタイマーが消えても、次の setPhase で張り直す）
  if (next === 'done' && !isDemoRunning) {
    settleLater($)
  }
  if (pattern === null || !isShown) {
    $.ui.status(undefined)
    return
  }
  $.ui.status(statusText(pattern, next, frame, dopa))
  // ドパガキ中は待機中もきらめき続ける
  if (next === 'thinking' || next === 'tool' || (dopa && next !== 'error')) {
    spinner = $.clock.every(dopa ? SPIN_MS / 2 : SPIN_MS, () => {
      frame += 1
      $.ui.status(statusText(pattern, next, frame, dopa))
    })
  }
}

// 描画が読むのはこの「場面」だけ。値を個別に書き換えるたびに描き直す（画面がちらつく）のを避け、
// 変化ごとに1回だけまとめて書く。中身が同じなら書かない
async function publishScene($: EngineInterface, mine: number, ph: Phase) {
  const next: Scene = {
    pattern: await patternNow($),
    phase: ph,
    origin: await read($, origin),
    isDopa: await read($, isDopa),
    band: (await read($, show)).band,
  }
  const prev = await read($, scene)
  // 後から始まった setPhase がいれば、古い場面で上書きしない
  if (mine === generation && JSON.stringify(prev) !== JSON.stringify(next)) {
    await update($, scene, () => next)
  }
}

// デモ：柄・状態・ドパガキを、説明のトーストを添えて順に見せる
type DemoStep = { pattern: Pattern; phase: Phase; isDopa: boolean; text: string; ms: number }

export const DEMO_STEPS: readonly DemoStep[] = [
  { pattern: 'seigaiha', phase: 'idle', isDopa: false, ms: 7000, text: '凪 ── 待機中。線がゆっくり息をしています' },
  { pattern: 'seigaiha', phase: 'thinking', isDopa: false, ms: 7000, text: '思索 ── プロンプトを受けると、線の上を光が流れ始めます' },
  { pattern: 'asanoha', phase: 'tool', isDopa: false, ms: 4000, text: '波紋 ── ツールを呼ぶたび、その場所から波紋が広がります' },
  { pattern: 'asanoha', phase: 'tool', isDopa: false, ms: 4000, text: '波紋 ── 呼ぶたびに起点が変わります' },
  { pattern: 'kikko', phase: 'error', isDopa: false, ms: 5000, text: '乱 ── エラーが出ると、朱に変わって震えます' },
  { pattern: 'kagome', phase: 'done', isDopa: false, ms: 6000, text: '開花 ── ターンが終わると、中心から一斉に咲き上がります' },
  {
    pattern: 'yagasuri',
    phase: 'idle',
    isDopa: false,
    ms: 6000,
    text: '柄はターンごとに 青海波 → 麻の葉 → 七宝 → 亀甲 → 籠目 → 矢絣 → 立涌 と移ります。触れると朱に光ります',
  },
  { pattern: 'tatewaku', phase: 'thinking', isDopa: true, ms: 6000, text: 'ドパガキ ── /wagara dopagaki で、虹色のネオンが脈打ちます' },
  { pattern: 'shippo', phase: 'tool', isDopa: true, ms: 5000, text: 'ドパガキの波紋 ── ツールのたびに光が弾けます' },
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
// デモを始め直したり止めたりするたびに増やす。古いデモの続きが、止めたあとに柄を書き換えないように
let demoGen = 0
let isDemoRunning = false

async function playDemoStep($: EngineInterface, index: number, gen: number) {
  const step = DEMO_STEPS[index]
  if (gen !== demoGen) {
    return
  }
  if (step === undefined) {
    await finishDemo($)
    return
  }
  // 書くたびに世代を確かめる（途中で止められたら、それ以上デモの値を書かない）
  const steps: Array<() => Promise<unknown>> = [
    () => update($, mode, () => step.pattern),
    () => update($, isDopa, () => step.isDopa),
    ...(step.phase === 'tool' ? [() => update($, origin, () => randomOrigin(index * 7 + 3))] : []),
    () => setPhase($, step.phase),
  ]
  for (const write of steps) {
    if (gen !== demoGen) {
      return
    }
    await write()
  }
  if (gen !== demoGen) {
    return
  }
  $.ui.toast(`デモ ${index + 1}/${DEMO_STEPS.length}｜${step.text}`, { timeoutMs: step.ms })
  demoTimer = $.clock.after(step.ms, () => {
    void playDemoStep($, index + 1, gen)
  })
}

// デモを止める。元の柄・表示は $.state に預けてあるので、途中で再読み込みされても戻せる
function stopDemo() {
  demoGen += 1
  isDemoRunning = false
  demoTimer?.cancel()
  demoTimer = undefined
}

async function restoreDemo($: EngineInterface): Promise<boolean> {
  // 読むと消すを1回の update で行い、戻すのは値を受け取った呼び出しだけにする（二重に戻さない）
  let saved: DemoSaved = null
  await update($, demoSaved, s => {
    saved = s
    return null
  })
  if (saved === null) {
    return false
  }
  const { mode: savedMode, isDopa: savedDopa } = saved as NonNullable<DemoSaved>
  await update($, mode, () => savedMode)
  await update($, isDopa, () => savedDopa)
  // デモのために開いたペインは、-pane（既定）なら閉じて元に戻す
  if (!(await read($, show)).pane) {
    await $.ui.close({ id: PANE })
  }

  return true
}

async function finishDemo($: EngineInterface, isQuiet = false) {
  stopDemo()
  // ほかの呼び出しがすでに戻していたら、後から凪やトーストで上書きしない
  if (!(await restoreDemo($))) {
    return
  }
  await setPhase($, 'idle')
  if (!isQuiet) {
    $.ui.toast('デモ終了 ── もとの設定に戻しました', { timeoutMs: 5000 })
  }
}

// /wagara demo：全演出を説明付きで順に見せる。実行中にもう一度打つと止める
async function toggleDemo($: EngineInterface): Promise<string> {
  if (isDemoRunning) {
    await finishDemo($)

    return 'デモを止めました'
  }
  stopDemo()
  isDemoRunning = true
  const gen = demoGen
  const savedMode = await read($, mode)
  const savedDopa = await read($, isDopa)
  await update($, demoSaved, () => ({ mode: savedMode, isDopa: savedDopa }))
  await $.ui.open({ id: PANE, title: '和柄' })
  await playDemoStep($, 0, gen)
  const total = Math.round(DEMO_STEPS.reduce((sum, s) => sum + s.ms, 0) / 1000)

  return `デモを始めました（約${total}秒、全${DEMO_STEPS.length}場面）。止めるときはもう一度 /wagara demo\n\n${demoTable()}`
}

// /wagara off：デモも止めてしまう。閉じたペインを「+pane」のまま残さない（次に柄を出したとき勝手に開かないように）
async function turnOff($: EngineInterface) {
  stopDemo()
  await update($, demoSaved, () => null)
  await update($, mode, () => 'off')
  await update($, isDopa, () => false)
  await update($, show, s => ({ ...s, pane: false }))
  await $.ui.close({ id: PANE })
  await setPhase($, 'idle')
}

async function nextPattern($: EngineInterface): Promise<string> {
  const now = await read($, mode)
  if (now === 'off') {
    return '和柄はしまっています。/wagara auto で出してから送ってください'
  }
  if (now === 'auto') {
    await update($, turns, t => t + 1)
  } else {
    const i = PATTERNS.indexOf(now)
    const following = PATTERNS[(i + 1) % PATTERNS.length] ?? 'seigaiha'
    await update($, mode, () => following)
  }
  await setPhase($, await read($, phase))
  const pattern = await patternNow($)
  if (pattern !== null) {
    await announce($, pattern)
  }

  return `${await describeNow($, await read($, show))}\n使い方は /wagara help`
}

// 指定を反映したあとの、今の柄・状態・表示・場所の一行
async function describeNow($: EngineInterface, places: Show): Promise<string> {
  const pattern = await patternNow($)
  const how =
    pattern === null
      ? 'しまっています（/wagara auto で出す）'
      : (await read($, mode)) === 'auto'
        ? `${LABELS[pattern].name}（ターンごとに移り変わる）`
        : LABELS[pattern].name
  const look = (await read($, isDopa)) ? 'ドパガキ（/wagara normal で戻る）' : 'ノーマル'
  const where = PLACES.map(p => `${places[p] ? '+' : '-'}${p}`).join(' ')

  return `柄: ${how}／状態: ${PHASE_NAMES[await read($, phase)]}／表示: ${look}／場所: ${where}`
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
      argumentHint: '[柄] [状態] [dopagaki|normal] [+|-pane|band|status|toast|all] / next / demo / toast / help / off',
    })
    // デモの途中で再読み込みされたら、デモ前の設定に戻す（タイマーは再読み込みで消えている）
    const wasDemo = await restoreDemo($)
    if ((await read($, mode)) !== 'off' && (await read($, show)).pane) {
      void $.ui.open({ id: PANE, title: '和柄' })
    }
    // 作業の途中で再読み込みされても、今の状態のまま続ける
    await setPhase($, wasDemo ? 'idle' : await read($, phase))

    return next(e)
  })

  on('command.run', { command: 'wagara' }, async ($, e) => {
    const arg = e.args.trim()
    // /wagara help：何も変えずに使い方だけを出す
    if (HELP_WORDS.includes(arg.toLowerCase())) {
      return { text: helpText() }
    }
    // /wagara next：柄を1つ送る（auto はターンを1つ進め、固定の柄は次の柄に替える）
    if (arg.toLowerCase() === 'next' || arg === '次') {
      return { text: await nextPattern($) }
    }
    // /wagara toast：トーストの見え方を試す（今の柄で10秒）
    if (arg.toLowerCase() === 'toast') {
      // 試すためのコマンドなので、-toast のときも出す
      const pattern = (await patternNow($)) ?? 'seigaiha'
      const { name, meaning } = LABELS[pattern]
      $.ui.toast(`${name} ─ ${meaning}`, { timeoutMs: 10000 })

      return { text: `${LABELS[pattern].name}のトーストを10秒表示しました` }
    }
    if (arg.toLowerCase() === 'demo' || arg === 'デモ') {
      return { text: await toggleDemo($) }
    }
    // 柄・状態・表示は空白区切りで組み合わせられる（例: /wagara seigaiha thinking dopagaki）
    const wanted = parseArgs(arg)
    const skipped = wanted.unknown.length > 0 ? `\n分からない語は無視しました: ${wanted.unknown.join(' ')}` : ''
    if (wanted.mode === 'off') {
      await turnOff($)

      return { text: `和柄をしまいました（off のときは柄以外の指定を使いません。出すときは /wagara auto）${skipped}` }
    }
    // デモ中に柄・状態・表示を指定されたら、デモを止めてから指定どおりにする（デモ終わりに打ち消さない）
    if (isDemoRunning && (wanted.mode !== undefined || wanted.isDopa !== undefined || wanted.phase !== undefined)) {
      await finishDemo($, true)
    }
    const before = await patternNow($)
    if (wanted.mode !== undefined) {
      const next = wanted.mode
      await update($, mode, () => next)
    }
    if (wanted.isDopa !== undefined) {
      const next = wanted.isDopa
      await update($, isDopa, () => next)
    }
    const places = await update($, show, s => ({ ...s, ...wanted.show }))
    // ペインは +pane / -pane を指定したときだけ開け閉めする（✕ で閉じたペインを、ほかの指定で開き直さない）
    if (wanted.show?.pane === true && (await patternNow($)) !== null) {
      await $.ui.open({ id: PANE, title: '和柄' })
    } else if (wanted.show?.pane === false) {
      await $.ui.close({ id: PANE })
    }
    if (wanted.phase !== undefined) {
      await update($, origin, () => randomOrigin(Date.now()))
    }
    await setPhase($, wanted.phase ?? (await read($, phase)))
    const pattern = await patternNow($)
    if (pattern !== null && pattern !== before) {
      await announce($, pattern)
    }

    return { text: `${await describeNow($, places)}${skipped}\n使い方は /wagara help` }
  })

  // 思索：プロンプトを受けたら線の上を光が流れ始める。飾りの失敗でプロンプトを止めない
  on('prompt.submit', async ($, e, next) => {
    await setPhase($, 'thinking')

    return next(e)
  }).catch(($, e, next) => (next.called ? undefined : next(e)))

  // 波紋：ツール実行に入ったときだけ起点を変える（呼ぶたびに描き直すと画面がちらつくため）。失敗したら乱
  on('tool.call', async ($, e, next) => {
    if (phaseNow !== 'tool') {
      phaseNow = 'tool'
      toolCount += 1
      await update($, origin, () => randomOrigin(toolCount))
      await setPhase($, 'tool')
    }
    const result = await next(e)
    if (result.deny === undefined && result.isError === true) {
      await setPhase($, 'error')
    }

    return result
  }).catch(($, e, next) => (next.called ? undefined : next(e)))

  // 開花：ターンが終わると全体が描き上がり、次の柄へ移ってトーストで意味を添える
  on('turn.complete', async ($, e, next) => {
    // サブエージェントのターンはメインの作業の途中なので、開花させない
    if (e.agentId !== undefined) {
      return next(e)
    }
    // 中断は凪へ、エラーや拒否で終わったら乱へ。どちらも柄は進めない
    if (e.reason === 'aborted' || e.reason === 'error' || e.reason === 'refusal') {
      await setPhase($, e.reason === 'aborted' ? 'idle' : 'error')

      return next(e)
    }
    const before = await patternNow($)
    await update($, turns, t => t + 1)
    const after = await patternNow($)
    await setPhase($, 'done')
    if (after !== null && after !== before) {
      await announce($, after)
    }

    return next(e)
  }).catch(($, e, next) => (next.called ? undefined : next(e)))

  // ✕ で閉じたら -pane として覚える（ほかの指定や再読み込みで勝手に開き直さない）
  on('ui.close', async ($, e, next) => {
    if (e.id === PANE && e.origin.kind === 'person') {
      await update($, show, s => ({ ...s, pane: false }))
    }

    return next(e)
  }).catch(($, e, next) => (next.called ? undefined : next(e)))

  on('session.end', async ($, e, next) => {
    stopDemo()
    stopSpin()
    bloomTimer?.cancel()

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const view = await read($, scene)
    const pattern = view.pattern ?? 'seigaiha'
    const now = view.phase
    const { name, meaning } = LABELS[pattern]
    const rows = Math.max(2, e.props.scroll.bodyRows)
    if (e.surface === 'terminal') {
      const { Client } = $.ui.resolve(e)

      return <Client key="obi" module="./term.tsx" props={{ pattern, isWorking: now !== 'idle' }} height={rows} flexGrow={1} />
    }
    // 文字セルを px に見積もってペインいっぱいに描く（Desktop の 1 セルはおよそ 8.4 × 19 px）
    const size = fitSize({ w: e.props.bodyColumns * 8.4, h: rows * 19 })
    const { Svg } = $.ui.resolve(e)
    const svg = wagaraSvg(pattern, now, { size, origin: view.origin, isDopa: view.isDopa })

    return <Svg source={svg} alt={`${name}：${meaning}`} width={size.w} height={size.h} isInteractive />
  })

  // プロンプトの上の細い帯。文様を半分の大きさで、同じ状態の演出を流す
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const view = await read($, scene)
    const pattern = view.pattern
    if (e.props.hasSurvey || pattern === null || !view.band) {
      return next(e)
    }
    const now = view.phase
    if (e.surface === 'terminal') {
      const { Client } = $.ui.resolve(e)

      return <Client key="band" module="./term.tsx" props={{ pattern, isWorking: now !== 'idle' }} height={1} flexGrow={1} />
    }
    const w = Math.round(e.props.bodyColumns * 8.4)
    const { Svg } = $.ui.resolve(e)
    const { name, meaning } = LABELS[pattern]
    const svg = wagaraSvg(pattern, now, { size: { w, h: BAND_HEIGHT }, scale: 0.5, origin: view.origin, isDopa: view.isDopa })

    return <Svg source={svg} alt={`${name}の帯：${meaning}`} width={w} height={BAND_HEIGHT} isInteractive />
  })
}
