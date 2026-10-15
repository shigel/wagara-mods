import type { Phase } from '../types'

// ドパガキ：虹色・ネオンの光・脈打つ線で、和柄を全開に光らせる演出。
// 状態ごとに速さ（s が小さいほど速い）と味付けを変える。
// 青海波は <use> の複製なので、線のセレクタに祖先（.dopa など）を含めない（複製の中に届かない）
const SPEED: Record<Phase, number> = { idle: 1.6, thinking: 1, tool: 0.55, error: 0.5, done: 1 }

export const GLOW_FILTER = `<filter id="glow" x="-5%" y="-5%" width="110%" height="110%">
<feGaussianBlur stdDeviation="2.4" result="b"/>
<feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`

export function dopaCss(phase: Phase): string {
  const s = SPEED[phase]
  const sec = (v: number) => `${Math.round(v * s * 100) / 100}s`
  const base = `.dopa{animation:hue ${sec(6)} linear infinite}
.sway{transform-box:view-box;transform-origin:50% 60%;animation:sway ${sec(14)} ease-in-out infinite}
@keyframes hue{to{filter:hue-rotate(360deg)}}
@keyframes sway{0%,100%{transform:scale(1) rotate(0deg)}50%{transform:scale(1.06) rotate(1.8deg)}}
[pathLength]{stroke:var(--col,hsl(calc(var(--t) * 900deg) 92% 62%));stroke-dasharray:1 1;
  animation:zap ${sec(1.8)} cubic-bezier(.7,0,.3,1) infinite,pulse ${sec(0.9)} ease-in-out infinite;
  animation-delay:calc(var(--t) * -${sec(7.2)}),calc(var(--t) * -${sec(2.7)})}
@keyframes zap{0%{stroke-dashoffset:1;opacity:0}35%{opacity:1}55%{stroke-dashoffset:0}100%{stroke-dashoffset:-1;opacity:.15}}
@keyframes pulse{0%,100%{stroke-width:1.2}50%{stroke-width:3.2}}
.m:hover{--col:#fff}`

  if (phase === 'error') {
    // 乱：色の回転を止め、紅と朱で激しく明滅しながら震える
    return `${base}
.dopa{animation:none}
[pathLength]{--col:#E9546B;animation:zap ${sec(1.2)} linear infinite,flash .16s steps(2) infinite,jitter .1s steps(2) infinite;
  animation-delay:calc(var(--t) * -${sec(4.8)}),0s,0s;transform-box:fill-box}
@keyframes flash{50%{stroke:#EB6101}}
@keyframes jitter{50%{transform:translate(1.2px,-1px)}}`
  }
  if (phase === 'done') {
    // 開花：中心から一斉に白く光って描き上がり、虹色へほどけていく
    return `${base}
[pathLength]{stroke-dashoffset:1;animation:burst 1.4s cubic-bezier(.1,.8,.2,1) forwards,cool 3.6s ease-out forwards;
  animation-delay:calc(var(--t) * 1.1s),calc(var(--t) * 1.1s)}
@keyframes burst{from{stroke-dashoffset:1;stroke-width:5;opacity:0}to{stroke-dashoffset:0;stroke-width:1.6;opacity:1}}
@keyframes cool{0%{stroke:#fff}100%{stroke:var(--col,hsl(calc(var(--t) * 900deg) 92% 62%))}}`
  }

  return base
}

// ステータスラインのきらめき
export const DOPA_SPARKLE: readonly string[] = ['✦', '✧', '✶', '✷', '✸', '✹', '✺', '✹', '✸', '✷']
