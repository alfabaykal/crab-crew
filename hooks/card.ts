// The card as one picture: what the band's own elements cannot draw (rounded corners, shadow,
// plates, scales) drawn the way the design has it. Its buttons stay outside, as real buttons.

import type { Member } from '../types'
import { calm, enter, esc, SCENE } from './crabs'
import type { Theme } from './crabs'
import { contextWindow, EFFORTS, fmtDuration, fmtTokens, modelName } from './activity'
import type { Lang } from './activity'
import { STRINGS } from './activity'

const W = 460
const PAD = 8 // room for the shadow
const X = PAD + 16 // content left
const VAL = PAD + 96 // value column
// Model plate and context figures share one fixed column; the effort scale and context bar start after it,
// so they line up from card to card and stay put while the numbers grow.
const COL = 84
const GFX = VAL + COL + 12

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s)

// Up to `lines` lines of at most `width` characters, broken between words.
function wrap(text: string, width: number, lines: number): string[] {
  const out: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (next.length <= width) {
      line = next
      continue
    }
    if (line) out.push(line)
    line = word
    if (out.length === lines) break
  }
  if (out.length < lines && line) out.push(line)
  if (out.length === lines && out.join(' ').length < text.length) out[lines - 1] = cut(out[lines - 1] ?? '', width - 1) + (out[lines - 1]?.endsWith('…') ? '' : '…')
  return out.slice(0, lines)
}

const family = (model?: string) => /fable|mythos/i.test(model ?? '') ? 'fable' : /opus/i.test(model ?? '') ? 'opus' : /haiku/i.test(model ?? '') ? 'haiku' : 'sonnet'

const LIGHT = `
.bg{fill:#ffffff;stroke:rgba(0,0,0,.08)} .tile{fill:#f3f1ec} .tx{fill:#1f1e1d} .mu{fill:#6f6d66} .di{fill:#77756b}
.rule{stroke:rgba(0,0,0,.07)} .plate{fill:#efede7} .track{fill:#e6e3dc} .fill{fill:#D97757} .on{fill:#D97757} .off{fill:#e2dfd8}
.opus{fill:#7d4cb8} .sonnet{fill:#2d6baf} .haiku{fill:#297740} .fable{fill:#a2541e}
.run{fill:#d99a22} .ask{fill:#9e680d} .ok{fill:#5f9e4a} .err{fill:#cc483e}`
const DARK = `.bg{fill:#1f1f1d;stroke:rgba(255,255,255,.08)} .tile{fill:#2b2b29} .tx{fill:#e8e6dc} .mu{fill:#a3a197} .di{fill:#8a8881}
.rule{stroke:rgba(255,255,255,.07)} .plate{fill:#2e2e2b} .track{fill:#3a3a37} .off{fill:#3a3a37}
.opus{fill:#d9b8f0} .sonnet{fill:#9fc7f5} .haiku{fill:#a8e0b0} .fable{fill:#f5c59f}
.ask{fill:#e0b45a} .err{fill:#d4665e}`
const FONTS = `text{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Segoe UI",sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
.mono{font-family:"SF Mono",ui-monospace,Menlo,monospace}`

export type { Theme }
// Text colours by class, for the contrast check.
export const PALETTE = { LIGHT, DARK }
// auto follows the system, as the image is drawn; an app theme set by hand wins.
const styleFor = (theme: Theme) =>
  LIGHT + (theme === 'dark' ? DARK : theme === 'auto' ? `@media (prefers-color-scheme: dark){${DARK}}` : '') + FONTS

// `wallNow` is the real clock: it times the card's entrance, which `now` (the pane's last tick) may lag.
export function cardSvg(m: Member, now: number, lang: Lang, theme: Theme = 'auto', wallNow = now): string {
  const s = STRINGS[lang]
  const title = m.kind === 'agent' ? `${s.subagent} ${m.agentType ?? ''}: ${m.title}` : m.title
  const tone = m.activity === 'ask' ? 'ask' : m.activity === 'error' ? 'err' : m.isRunning ? 'run' : 'ok'
  const status = `${s.activity[m.activity]} · ${fmtDuration((m.endedAt ?? now) - m.startedAt)}`
  const thought = m.thought ? wrap(m.thought, 66, 2) : []

  const parts: string[] = []
  let y = PAD + 16

  // Header: the crab in its tile, the title and the status beside it.
  parts.push(`<rect class="tile" x="${X}" y="${y}" width="56" height="52" rx="12"/>`)
  parts.push(`<svg x="${X + 4}" y="${y + 6}" width="48" height="42" viewBox="-1 -9 24 21" shape-rendering="crispEdges">${SCENE[m.activity]}</svg>`)
  const tx = X + 70
  const titleLines = wrap(title, 50, 2)
  titleLines.forEach((line, i) => parts.push(`<text class="tx" x="${tx}" y="${y + 18 + i * 17}" font-size="13.5" font-weight="600">${esc(line)}</text>`))
  const sy = y + 18 + titleLines.length * 17 + 2
  parts.push(`<circle class="${tone}" cx="${tx + 4}" cy="${sy - 4}" r="3.5"/>`)
  parts.push(`<text class="${tone === 'ask' || tone === 'err' ? tone : 'mu'}" x="${tx + 13}" y="${sy}" font-size="12" style="font-variant-numeric:tabular-nums">${esc(status)}</text>`)
  y = Math.max(y + 52, sy + 6) + 12

  // What it last said, as it said it.
  if (thought.length > 0) {
    thought.forEach((line, i) => parts.push(`<text class="mu" x="${X}" y="${y + 12 + i * 17}" font-size="12.5" font-style="italic">${esc(line)}</text>`))
    y += thought.length * 17 + 8
  }

  parts.push(`<line class="rule" x1="${X}" y1="${y}" x2="${W - PAD - 16}" y2="${y}"/>`)
  y += 8

  const row = (label: string, value: string) => {
    parts.push(`<text class="di" x="${X}" y="${y + 14}" font-size="12">${esc(label)}</text>`)
    parts.push(value.replaceAll('{y}', String(y)))
    y += 24
  }

  if (m.model) {
    const name = modelName(m.model) ?? m.model
    const idx = m.effort ? EFFORTS.indexOf(m.effort as (typeof EFFORTS)[number]) : -1
    let v = `<rect class="plate" x="${VAL}" y="{y}" width="${COL}" height="20" rx="6"/><text class="${family(m.model)}" x="${VAL + COL / 2}" y="${y + 14}" font-size="11.5" font-weight="600" text-anchor="middle">${esc(name)}</text>`
    if (idx >= 0) {
      v += EFFORTS.map((_, i) => `<rect class="${i <= idx ? 'on' : 'off'}" x="${GFX + i * 13}" y="${y + 8}" width="10" height="4" rx="2"/>`).join('')
      v += `<text class="mu" x="${GFX + 5 * 13 + 4}" y="${y + 14}" font-size="12">${esc(s.effort[m.effort ?? ''] ?? m.effort ?? '')}</text>`
    }
    row(s.model, v)
  }
  if (m.context) {
    const max = contextWindow(m.model)
    const pct = Math.min(1, m.context / max)
    // Right-aligned in the first column: the digits grow leftwards and the bar stays put.
    row(s.context,
      `<text class="tx" x="${VAL + COL}" y="${y + 14}" font-size="12" text-anchor="end" style="font-variant-numeric:tabular-nums">${esc(`${fmtTokens(m.context)} ${s.of} ${fmtTokens(max)}`)}</text>` +
      `<rect class="track" x="${GFX}" y="${y + 8}" width="120" height="4" rx="2"/><rect class="fill" x="${GFX}" y="${y + 8}" width="${Math.max(2, 120 * pct)}" height="4" rx="2"/>`)
  }
  if (m.kind === 'agent' && m.tokens) row(s.tokens, `<text class="tx" x="${VAL}" y="${y + 14}" font-size="12" style="font-variant-numeric:tabular-nums">${esc(`${fmtTokens(m.tokens)} · ${s.steps} ${m.steps ?? 0}`)}</text>`)
  if (m.branch) row(s.branch, `<text class="mu mono" x="${VAL}" y="${y + 14}" font-size="11.5">${esc(cut(m.branch, 48))}</text>`)
  if (m.worktree) row(s.worktree, `<text class="mu mono" x="${VAL}" y="${y + 14}" font-size="11.5">${esc(cut(m.worktree, 48))}</text>`)

  const H = y + 6 + PAD
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<style>${styleFor(theme)}</style>` +
    `<defs><filter id="sh" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity=".08"/><feDropShadow dx="0" dy="6" stdDeviation="8" flood-opacity=".10"/></filter></defs>` +
    calm(enter(`<rect class="bg" x="${PAD}" y="${PAD}" width="${W - PAD * 2}" height="${H - PAD * 2}" rx="14" filter="url(#sh)"/>` + parts.join(''), m.seenAt, wallNow)) +
    `</svg>`
  )
}

// The card's facts as one line of text: what a screen reader reads in place of the picture.
export function cardText(m: Member, now: number, lang: Lang): string {
  const s = STRINGS[lang]
  const effort = m.effort ? s.effort[m.effort] ?? m.effort : ''
  return [
    m.kind === 'agent' ? `${s.subagent} ${m.agentType ?? ''}: ${m.title}` : m.title,
    `${s.activity[m.activity]} · ${fmtDuration((m.endedAt ?? now) - m.startedAt)}`,
    m.thought,
    m.model && `${s.model}: ${modelName(m.model)}${effort ? `, ${effort}` : ''}`,
    m.context && `${s.context}: ${fmtTokens(m.context)} ${s.of} ${fmtTokens(contextWindow(m.model))}`,
    m.kind === 'agent' && m.tokens && `${s.tokens}: ${fmtTokens(m.tokens)} · ${s.steps} ${m.steps ?? 0}`,
    m.branch && `${s.branch}: ${m.branch}`,
    m.worktree && `${s.worktree}: ${m.worktree}`,
  ].filter(Boolean).join('. ')
}
