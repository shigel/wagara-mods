import type { Phase } from '../types'

// 凪・思索・波紋・乱の動き。SVG の中の要素は一切動かさず、いちばん外側の svg だけを動かす。
// 中の線や円を動かすと、ブラウザは毎コマ SVG 全体（すべての線）を描き直し、画面が大きいほどコマ落ちしてちらつく。
// 外側の svg の opacity・transform・filter だけなら、描き直さずに重ね合わせ（合成）だけで動くので、軽く滑らか。
// 線を1本ずつずらさないので、短い線が1本ずつ現れるカタカタも起きない。
// 凪は静、思索と波紋は動。満ち引きの緩急で、間・拡散と収束を見せる
// 後光：線の色（飴色）のにじみ。外側の svg の filter なので、これも線を描き直さない
const halo = (blur: number, alpha: number) => `drop-shadow(0 0 ${blur}px rgba(222,176,104,${alpha}))`

export const VEIL_CSS: Record<Exclude<Phase, 'done'>, string> = {
  // 凪：動かない（静・間）。ごくかすかな後光だけを灯しておく
  idle: `svg{opacity:.72;filter:${halo(2, 0.35)}}`,
  // 思索：後光がゆっくり膨らんではしぼみ、明るさも満ち引きする（幽玄）
  thinking: `svg{animation:tide 7s ease-in-out infinite}
@keyframes tide{0%,100%{opacity:.68;filter:${halo(1.5, 0.3)}}50%{opacity:1;filter:${halo(7, 0.7)}}}`,
  // 波紋：一瞬ふわっと明るく広がり、長く引く2拍（拡散と収束）
  tool: `svg{animation:surge 3.2s cubic-bezier(.3,0,.2,1) infinite}
@keyframes surge{0%{opacity:.7;filter:${halo(2, 0.35)}}18%{opacity:1;filter:${halo(9, 0.8)}}100%{opacity:.7;filter:${halo(2, 0.35)}}}`,
  // 乱：柄全体がひとかたまりで小さく揺れ、明滅する
  error: `svg{animation:tremor 2.4s ease-in-out infinite,flick 4.8s ease-in-out infinite}
@keyframes tremor{0%,100%{transform:translate(0,0)}35%{transform:translate(.7px,-.4px)}70%{transform:translate(-.5px,.3px)}}
@keyframes flick{0%,100%{opacity:.6}50%{opacity:.95}}`,
}
