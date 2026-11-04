import { expect, test } from 'claude-code/testing'

import { calm, enter, lockToClock, SMALL_SCENE } from './crabs'

test('a rebuilt picture carries on: every animation starts as far in as the clock says', () => {
  const svg = '<svg><animate attributeName="x" dur="2s" begin="-0.5s"/><animateTransform type="rotate" dur="1.6s"/><rect/></svg>'
  const locked = lockToClock(svg, 3_300)
  expect(locked).toContain('dur="2s" begin="-1.800s"')
  expect(locked).toContain('<animateTransform begin="-0.100s" type="rotate" dur="1.6s"/>')
  expect(locked).toContain('<rect/>')
})

test('a crab enters once, timed from when it joined, and the clock lock leaves the entrance alone', () => {
  const svg = lockToClock(`<svg>${enter('<rect/>', 10_000, 10_150)}<animate attributeName="x" dur="2s"/></svg>`, 10_150)
  expect(svg).toContain('values="0;1" dur=".2s" begin="-0.150s" fill="freeze"')
  expect(svg).toContain('values="0 4;0 0" dur=".2s" begin="-0.150s" fill="freeze"')
  expect(svg).toContain('<animate begin="-0.150s" attributeName="x" dur="2s"/>')
  expect(enter('<rect/>', undefined, 10_150)).toBe('<rect/>')
})

test('with reduced motion asked for, a still copy shows: the same crab with no animation in it', () => {
  const picture = calm('<g><rect/><animate attributeName="x" dur="1s"/><animateTransform attributeName="transform" dur="2s"/></g>')
  expect(picture).toContain('@media (prefers-reduced-motion: reduce){.moving{display:none}.still{display:inline}}')
  const [moving, still] = picture.split('<g class="still">')
  expect(moving).toContain('<animate ')
  expect(still).toBe('<g><rect/></g></g>')
})

test('the small crab is drawn on its own grid: every pixel on whole grid cells, so it stays crisp at any density', () => {
  for (const [activity, scene] of Object.entries(SMALL_SCENE)) {
    for (const rect of scene.match(/<rect [^>]*>/g) ?? []) {
      for (const attr of ['x', 'y', 'width', 'height']) {
        const v = /\b(x|y|width|height)="/.test(rect) ? new RegExp(`\\b${attr}="(-?[\\d.]+)"`).exec(rect)?.[1] : undefined
        expect(`${activity} ${attr}=${v}`).toBe(`${activity} ${attr}=${v === undefined ? v : String(Math.round(Number(v)))}`)
      }
    }
  }
})
