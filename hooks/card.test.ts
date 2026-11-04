import { expect, test } from 'claude-code/testing'

import { cardSvg, PALETTE } from './card'

const colours = (css: string) => Object.fromEntries([...css.matchAll(/\.(\w+)\{fill:(#[0-9a-f]{6})/gi)].map(m => [m[1], m[2]]))
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
}
const contrast = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)

test('every text colour on the card meets AA in both themes', () => {
  const light = colours(PALETTE.LIGHT)
  const dark = { ...light, ...colours(PALETTE.DARK) }
  for (const p of [light, dark]) {
    for (const ink of ['tx', 'mu', 'di', 'ask', 'err']) expect(contrast(p[ink]!, p.bg!)).toBeGreaterThanOrEqual(4.5)
    for (const ink of ['opus', 'sonnet', 'haiku', 'fable']) expect(contrast(p[ink]!, p.plate!)).toBeGreaterThanOrEqual(4.5)
  }
})

test('the effort scale and the context bar sit in the same column whatever the numbers', () => {
  const base = { id: 'a', kind: 'session' as const, title: 't', short: 't', activity: 'code' as const, isRunning: true, startedAt: 0 }
  const xs = (svg: string) => [...svg.matchAll(/<rect class="(?:on|off|track)" x="([\d.]+)"/g)].map(m => m[1])
  const a = cardSvg({ ...base, model: 'claude-haiku-4-5', effort: 'low', context: 9_000 }, 1000, 'en', 'light')
  const b = cardSvg({ ...base, model: 'claude-sonnet-5-5', effort: 'max', context: 140_000 }, 1000, 'en', 'light')
  expect(xs(a)[0]).toBe(xs(b)[0])
  expect(xs(a).at(-1)).toBe(xs(b).at(-1))
})
