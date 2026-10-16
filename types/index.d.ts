export type Pattern = 'seigaiha' | 'asanoha' | 'shippo' | 'kikko' | 'kagome' | 'yagasuri' | 'tatewaku'
export type Mode = Pattern | 'auto' | 'off'
// 凪（待機）・思索（考え中）・波紋（ツール実行）・乱（エラー）・開花（完了）
export type Phase = 'idle' | 'thinking' | 'tool' | 'error' | 'done'
// 波紋の起点（描画領域に対する 0〜1 の位置）。claude-code の Origin と名前を分ける
export type RippleOrigin = { x: number; y: number }
// 和柄を出す場所ごとの出し入れ
export type Show = { pane: boolean; band: boolean; status: boolean; toast: boolean }

// デモの前の柄と表示（デモ中だけ値があり、途中で再読み込みされても戻せるように預ける）
export type DemoSaved = { mode: Mode; isDopa: boolean } | null

// 描画が読む値をひとまとめにしたもの（書き換えのたびに描き直さないため）
export type Scene = { pattern: Pattern | null; phase: Phase; origin: RippleOrigin; isDopa: boolean; band: boolean }

declare module 'claude-code' {
  interface PluginState {
    'wagara-obi': { mode: Mode; turns: number; phase: Phase; origin: RippleOrigin; isDopa: boolean; show: Show; scene: Scene; demoSaved: DemoSaved }
  }
}
