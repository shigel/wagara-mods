import type { ClientModule } from 'claude-code'

import type { Pattern } from '../types'
import { glyphRow } from './patterns'

type Props = { pattern: Pattern; isWorking: boolean }
type State = { offset: number; tick: number }

// ターミナルは SVG を描けないので、文字の文様をフレーム時計で流す
const TermObi: ClientModule<Props, State> = (props, surface) => {
  const { Box, Text } = surface.elements
  if (surface.state === undefined) {
    // 拍の数は閉包に持つ（state に書くと、見た目が変わらない拍でも描き直しになる）
    let tick = 0
    surface.every(160, () => {
      tick += 1
      // 待機中は8拍に1回だけ進め、ほぼ止まって見せる
      if (latest.isWorking || tick % 8 === 0) {
        surface.setState({ tick, offset: (surface.state?.offset ?? 0) + 1 })
      }
    })
    surface.setState({ offset: 0, tick: 0 })
  }
  latest = props
  const offset = surface.state?.offset ?? 0
  const columns = Math.max(1, surface.columns)
  const rows = Array.from({ length: Math.max(1, surface.rows) }, (_, i) => i)

  // 段ごとに流れる向きを逆にして、波が行き交うように見せる
  return (
    <Box flexDirection="column">
      {rows.map(i => (
        <Text key={`r${i}`} color="#DEB068" dimColor={!props.isWorking}>
          {glyphRow(props.pattern, i % 2 === 0 ? 0 : 1, columns, i % 2 === 0 ? offset : columns * 4 - offset)}
        </Text>
      ))}
    </Box>
  )
}

let latest: Props = { pattern: 'seigaiha', isWorking: false }

export default TermObi
