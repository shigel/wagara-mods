export type Pattern = 'seigaiha' | 'asanoha' | 'shippo'
export type Mode = Pattern | 'auto' | 'off'
// 凪（待機）・思索（考え中）・波紋（ツール実行）・乱（エラー）・開花（完了）
export type Phase = 'idle' | 'thinking' | 'tool' | 'error' | 'done'
// 波紋の起点（描画領域に対する 0〜1 の位置）。claude-code の Origin と名前を分ける
export type RippleOrigin = { x: number; y: number }

declare module 'claude-code' {
  interface PluginState {
    'wagara-obi': { mode: Mode; turns: number; phase: Phase; origin: RippleOrigin; isDopa: boolean }
  }
}
