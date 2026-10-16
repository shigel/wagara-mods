import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

// エンジンの代わりに、ペインの開閉とステータスラインの書き込みを記録する
const engineBeneath = (on: On) => {
  const calls = { opens: 0, closes: 0, statuses: [] as Array<string | undefined>, clock: mock.clock(on, { now: 1_000 }) }
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.open', () => {
    calls.opens += 1
    return { value: { isPlaced: true } } as never
  })
  on('ui.close', () => {
    calls.closes += 1
    return { value: undefined } as never
  })
  on('ui.status', (_$, e) => {
    calls.statuses.push(e.text)
    return { value: undefined }
  })
  on('ui.toast', () => ({ value: undefined }) as never)
  on('turn.complete', () => ({ text: '' }))

  return calls
}
const run = async ($: Engine, args: string) =>
  ((await $.command.run({ command: 'wagara', args, origin: { kind: 'bridge' } } as never)) as { text?: string }).text ?? ''
const showNow = async ($: Engine) => (await run($, '')).split('場所: ')[1]?.split('\n')[0] ?? ''

test('/wagara help は使い方を出すだけで、ペインもステータスラインも触らない', async ($, on) => {
  const calls = engineBeneath(on)
  for (const word of ['help', 'HELP', '?', 'ヘルプ']) {
    expect(await run($, word)).toContain('/wagara の使い方')
  }
  expect(calls.opens).toBe(0)
  expect(calls.closes).toBe(0)
  expect(calls.statuses).toEqual([])
})

test('既定は off：何も指定しなければ、ペインもステータスラインも出さない', async ($, on) => {
  const calls = engineBeneath(on)
  on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true } as never)
  expect(await run($, '')).toContain('しまっています')
  expect(calls.opens).toBe(0)
  expect(calls.statuses.every(s => s === undefined)).toBe(true)
})

test('ほかの指定ではペインを開かず、+pane のときだけ開く', async ($, on) => {
  const calls = engineBeneath(on)
  await run($, '籠目 thinking dopagaki')
  await run($, '')
  expect(calls.opens).toBe(0)
  await run($, '+pane')
  expect(calls.opens).toBe(1)
})

test('状態を続けて切り替えても、回る記号のタイマーは1本だけ残る', async ($, on) => {
  const calls = engineBeneath(on)
  // 並んで走らせる（ツールの並列呼び出しと同じ形）
  await run($, 'auto')
  await Promise.all([run($, 'thinking'), run($, 'tool'), run($, 'thinking')])
  calls.statuses.length = 0
  await calls.clock.advance(220 * 10)
  expect(calls.statuses.length).toBe(10)
})

test('開花は5秒で凪へ戻り、記号の回転も止まる', async ($, on) => {
  const calls = engineBeneath(on)
  await run($, 'tool')
  await run($, 'done')
  await calls.clock.advance(5_000)
  expect(await run($, '')).toContain('状態: 凪')
  calls.statuses.length = 0
  await calls.clock.advance(220 * 5)
  expect(calls.statuses).toEqual([])
})

test('off はペインを閉じて -pane として覚え、ステータスラインも消す', async ($, on) => {
  const calls = engineBeneath(on)
  await run($, 'auto +pane')
  expect(await run($, 'off')).toContain('しまいました')
  expect(calls.statuses.at(-1)).toBe(undefined)
  expect(await showNow($)).toContain('-pane')
  expect(calls.opens).toBe(1)
})

test('-status でステータスラインを消し、+status で戻す', async ($, on) => {
  const calls = engineBeneath(on)
  await run($, 'auto -status')
  expect(calls.statuses.at(-1)).toBe(undefined)
  await run($, '+status')
  expect(calls.statuses.at(-1)).toContain('・')
})

const turnEnd = ($: Engine, extra: Record<string, unknown>) =>
  $.turn.complete({ answer: '', durationMs: 10, isAborted: false, turnId: 't1', reason: 'answer', ...extra } as never)

test('サブエージェントのターン終了では開花せず、柄も進まない', async ($, on) => {
  engineBeneath(on)
  await run($, 'auto tool')
  await turnEnd($, { agentId: 'sub-1' })
  const reply = await run($, '')
  expect(reply).toContain('状態: 波紋')
  expect(reply).toContain('青海波')
})

test('メインのターンが答えて終わると開花して次の柄へ、エラーで終わると乱で柄は進まない', async ($, on) => {
  engineBeneath(on)
  await run($, 'auto')
  await turnEnd($, {})
  expect(await run($, '')).toContain('麻の葉')
  await turnEnd($, { reason: 'error' })
  const reply = await run($, '')
  expect(reply).toContain('状態: 乱')
  expect(reply).toContain('麻の葉')
})

test('デモを止めたら、その後に柄を書き換えない', async ($, on) => {
  const calls = engineBeneath(on)
  await run($, '籠目')
  await run($, 'demo')
  await calls.clock.advance(7_000)
  expect(await run($, 'demo')).toBe('デモを止めました')
  await calls.clock.advance(60_000)
  expect(await run($, '')).toContain('柄: 籠目')
})

test('デモ中に柄を指定すると、デモを止めて指定どおりになる', async ($, on) => {
  const calls = engineBeneath(on)
  await run($, 'demo')
  await run($, '矢絣')
  await calls.clock.advance(60_000)
  expect(await run($, '')).toContain('柄: 矢絣')
})

test('デモの途中で再読み込みされても、次の開始でデモ前の柄に戻す', async ($, on) => {
  const calls = engineBeneath(on)
  on('session.start', (_$, e) => ({ cwd: e.cwd }) as never)
  await run($, '立涌')
  await run($, 'demo')
  // 2場面目（思索）まで進めてから
  await calls.clock.advance(7_000)
  // 再読み込みと同じく、タイマーの続きが来ないまま session.start が来る
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true } as never)
  const reply = await run($, '')
  expect(reply).toContain('柄: 立涌')
  expect(reply).toContain('状態: 凪')
  expect(calls.closes).toBeGreaterThan(0)
})

test('off のまま +pane としてもペインを開かない', async ($, on) => {
  const calls = engineBeneath(on)
  await run($, 'off')
  const reply = await run($, '+pane thinking')
  expect(calls.opens).toBe(0)
  expect(reply).toContain('しまっています')
})

test('/wagara next は auto ならターンを、固定の柄なら次の柄へ1つ送る', async ($, on) => {
  engineBeneath(on)
  await run($, 'auto')
  expect(await run($, 'next')).toContain('麻の葉')
  await run($, '立涌')
  expect(await run($, 'next')).toContain('柄: 青海波')
  await run($, 'off')
  expect(await run($, 'next')).toContain('しまっています')
})
