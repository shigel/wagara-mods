# wagara-mods

Claude Code の mod「**wagara-obi**」。青海波・麻の葉・七宝の線そのものが、Claude の作業に合わせて描かれ、流れ、咲く和柄アニメーションです。

Claude Build Night Tokyo（2026-10-15）で作りました。

## インストール

ターミナルの Claude Code で次を入力します。

```
/plugin install wagara-obi --marketplace shigel/wagara-mods
```

`Add marketplace?` に `y`、スコープは user を選びます。user スコープで入れると、Claude Code Desktop のセッションでも読み込まれます（Desktop の Code タブでは `/plugin install` 自体は使えません）。

## 表示される場所

| 場所 | 内容 |
|---|---|
| サイドペイン「和柄」 | 背景透過の和柄。線が描かれては消える。触れると朱に光る |
| プロンプト上の帯 | 同じ演出を細く流す |
| ステータスライン | 柄名と状態。作業中は記号が回る |
| トースト | 柄が替わったとき、その意味を一言 |

## 状態ごとの演出

| 状態 | 名前 | 線の動き |
|---|---|---|
| `idle` | 凪 | 低いコントラストで、ゆっくり息をする |
| `thinking` | 思索 | プロンプトを受けると、線の上を光が流れる |
| `tool` | 波紋 | ツールを呼ぶたび、その場所から波紋が広がる |
| `error` | 乱 | 朱に変わって震える |
| `done` | 開花 | ターンが終わると、中心から一斉に咲き上がる |

柄は `auto` のとき、ターンごとに 青海波 → 麻の葉 → 七宝 と移ります。

## コマンド

| コマンド | 内容 |
|---|---|
| `/wagara` | ペインを開き、使い方を表示 |
| `/wagara seigaiha` `asanoha` `shippo`（`青海波` `麻の葉` `七宝` でも可） | 柄を固定 |
| `/wagara auto` | ターンごとに柄を移す |
| `/wagara off` | しまう |
| `/wagara demo` | 全演出を説明付きで約1分で見せる。もう一度で止める |
| `/wagara dopagaki` | ドパガキ向けの虹色ネオンが脈打つモードにする |
| `/wagara normal` | ドパガキを解除 |
| `/wagara idle` `thinking` `tool` `error` `done` | 各状態の演出を試す |
| `/wagara toast` | トーストの見え方を試す |

柄・状態・表示は、空白で区切って組み合わせられます。同じ種類の語が並んだときは後ろの語が優先されます。

```
/wagara seigaiha thinking dopagaki
/wagara 麻の葉 error normal
```

## 対応している画面

| 画面 | 表示 |
|---|---|
| Claude Code Desktop（macOS） | ペイン・帯・ステータスライン・トースト（動作確認済み） |
| CLI（ターミナル） | 文字の和柄 |
| スマホアプリ / Web（Remote Control） | コマンドの返答のみ（mod の描画は表示されない） |

## 開発

```
claude plugin validate .
claude plugin test .
```

開発中はリポジトリのフォルダを `claude --plugin-dir <このフォルダ>` で読み込むと、保存のたびに再読み込みされます。

## ライセンス

MIT
