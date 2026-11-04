// Pixel crabs, one per kind of work. The grid is the CLI's own Clawd: body 13x8 at x=3..15,
// claws out to x=1 and x=17, legs at 3/5/13/15, eyes two pixels tall. The motion follows the
// CLI's cooking scene: a 2.6 s loop, a ±2° sway, two soft dips, one blink, props on their own beat.

import type { Activity } from '../types'

const C = '#D97757'
const E = '#1f1e1d'
const SPL = 'calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1"'
const SPL4 = 'calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1;.45 0 .55 1"'

const r = (x: number, y: number, w = 1, h = 1, f = C, extra = '') =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}"${extra}/>`
const body = () => r(3, 2, 13, 8)
const claws = () => r(1, 6, 17, 2)
const legs = () => [3, 5, 13, 15].map(x => r(x, 10, 1, 2)).join('')

function eyes(mode: 'blink' | 'closed' = 'blink', look?: string): string {
  if (mode === 'closed') return r(5.6, 5, 1.8, 0.5, E) + r(12.6, 5, 1.8, 0.5, E)
  const blink = '<animate attributeName="height" values="2;2;0;2;2" keyTimes="0;.55;.58;.62;1" dur="2.6s" repeatCount="indefinite"/>'
  const g = `<rect x="6" y="4" width="1" height="2" fill="${E}">${blink}</rect><rect x="13" y="4" width="1" height="2" fill="${E}">${blink}</rect>`
  return look
    ? `<g>${g}<animateTransform attributeName="transform" type="translate" values="${look}" dur="2.6s" repeatCount="indefinite" ${SPL4}/></g>`
    : g
}

type CrabOpts = { sway?: boolean; bob?: string; dur?: string; dress?: string }
function crab(eyesSvg: string, { sway = true, bob = '0 0;0 .25;0 0;0 .25;0 0', dur = '2.6s', dress = '' }: CrabOpts = {}): string {
  const core = body() + claws() + eyesSvg + dress
  let g = `<g>${core}<animateTransform attributeName="transform" type="translate" values="${bob}" dur="${dur}" repeatCount="indefinite" ${SPL4}/></g>`
  if (sway) g = `<g>${g}<animateTransform attributeName="transform" type="rotate" values="2 9 11;-2 9 11;2 9 11" dur="${dur}" repeatCount="indefinite" ${SPL}/></g>`
  return legs() + g
}

function puff(x: number, y: number, color: string, begin: string, dx = 1, rise = 7, size = 1, dur = '2.6s'): string {
  return (
    `<g><rect x="${x}" y="${y}" width="${size}" height="${size}" fill="${color}" opacity="0">` +
    `<animate attributeName="opacity" values="0;.9;.6;0" keyTimes="0;.2;.6;1" dur="${dur}" begin="${begin}" repeatCount="indefinite"/></rect>` +
    `<animateTransform attributeName="transform" type="translate" values="0 0;${dx} -${rise / 2};${-dx} -${rise}" dur="${dur}" begin="${begin}" repeatCount="indefinite" ${SPL}/></g>`
  )
}

const LIGHT = '#e8e6dc'

// Detective: deerstalker, sweeping magnifier, eyes following it.
const deerstalker = r(4, -1, 11, 3, '#8b6b4a') + r(2, 1, 15, 1, '#6f5338') + r(6, -1, 1, 3, '#a5835d') + r(10, -1, 1, 3, '#a5835d') + r(8.5, -2, 2, 1, '#6f5338')
const magnifier =
  `<g>${r(18, 1, 3, 0.6, LIGHT)}${r(18, 3.4, 3, 0.6, LIGHT)}${r(18, 1, 0.6, 3, LIGHT)}${r(20.4, 1, 0.6, 3, LIGHT)}${r(18.6, 1.6, 1.8, 1.8, '#9fc7f5')}${r(17.2, 4, 1, 1, LIGHT)}${r(16.6, 4.8, 1, 1, LIGHT)}` +
  `<animateTransform attributeName="transform" type="translate" values="0 0;-1 1;0 0;1 -1;0 0" dur="2.6s" repeatCount="indefinite" ${SPL4}/></g>`

// Programmer: headphones, laptop, claws typing.
const laptop = r(4, 12.2, 11, 0.8, '#9a988f') + r(5, 7.5, 9, 4.7, '#3a3a37') + r(6, 8.3, 7, 3, '#5b8def')
const headphones = r(4, 0, 11, 0.9, '#2b2b29') + r(3, 0, 1, 3, '#2b2b29') + r(15, 0, 1, 3, '#2b2b29') + r(2, 2.6, 2, 2.4, '#7d5ba6') + r(15, 2.6, 2, 2.4, '#7d5ba6')
const typing = (x: number, values: string) =>
  `<g>${r(x, 6, 2, 2)}<animateTransform attributeName="transform" type="translate" values="${values}" dur=".32s" repeatCount="indefinite"/></g>`
const coder =
  legs() +
  `<g>${body() + eyes() + headphones}<animateTransform attributeName="transform" type="translate" values="0 0;0 .25;0 0;0 .25;0 0" dur="1.3s" repeatCount="indefinite" ${SPL4}/></g>` +
  typing(1, '0 0;0 1;0 0') + typing(16, '0 1;0 0;0 1') + laptop

// Scientist: white lab coat, flask with rising bubbles.
const labCoat =
  r(3, 6, 13, 4, '#f4f2ea') + r(1, 6, 2, 2, '#f4f2ea') + r(16, 6, 2, 2, '#f4f2ea') + r(8, 6, 3, 2.2, C) +
  r(7, 6, 1, 1.2, '#d8d5ca') + r(11, 6, 1, 1.2, '#d8d5ca') + r(9.3, 8.6, 0.6, 0.6, '#9a988f') + r(9.3, 9.4, 0.6, 0.5, '#9a988f') +
  r(4.4, 8, 1.8, 1.4, '#e3e0d6') + r(4.9, 7.3, 0.5, 1.2, '#5b8def')
const flask =
  r(18.5, -1, 2, 0.8, LIGHT) + r(18.7, -0.2, 1.6, 2, '#cfd8c8') + r(17.8, 1.8, 3.4, 3, '#7fb069') +
  [0, 1, 2, 3].map(i => puff(19, 1.5, '#a8e0b0', `-${(i * 0.65).toFixed(2)}s`, 0.6, 6, 0.8)).join('')

// Builder: domed hard hat, swinging hammer, sparks.
const hardHat = r(7, -3, 5, 1, '#f5c518') + r(5, -2, 9, 1, '#f5c518') + r(4, -1, 11, 2, '#f5c518') + r(2, 1, 15, 1, '#e0a800') + r(9, -3, 1, 4, '#e0a800') + r(6, -1.8, 1.4, 0.6, '#fde68a') + r(5, -0.6, 1, 0.6, '#fde68a')
const hammer =
  `<g>${r(18.2, -1, 0.9, 6, '#b98a5a')}${r(16.8, -2.2, 3.6, 1.6, '#9a988f')}` +
  `<animateTransform attributeName="transform" type="rotate" values="30 18.6 5;-35 18.6 5;30 18.6 5" keyTimes="0;.35;1" dur=".8s" repeatCount="indefinite" calcMode="spline" keySplines=".6 0 .9 .4;.2 .8 .4 1"/></g>` +
  puff(21, 3, '#e0b45a', '-0.25s', 1, 3, 0.7, '.8s')

// Reviewer: glasses, eyes scanning, ticks appearing on a clipboard.
const glasses = r(4.6, 3.4, 3, 3, 'none', ' stroke="#e8e6dc" stroke-width=".5"') + r(11.6, 3.4, 3, 3, 'none', ' stroke="#e8e6dc" stroke-width=".5"') + r(7.6, 4.6, 4, 0.45, LIGHT)
const clipboard =
  r(17, 0, 4, 6, '#b98a5a') + r(17.5, 0.8, 3, 4.8, '#f4f2ea') + r(18.3, -0.4, 1.4, 1, '#9a988f') +
  [0, 1, 2]
    .map(i => `<rect x="18" y="${(1.6 + i * 1.3).toFixed(1)}" width="2" height=".5" fill="#7fb069" opacity="0"><animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;${(0.15 + i * 0.2).toFixed(2)};${(0.2 + i * 0.2).toFixed(2)};.95;1" dur="2.6s" repeatCount="indefinite"/></rect>`)
    .join('')

// Waiting on you: a bouncing question bubble and a shake every four seconds.
const bubble =
  `<g>${r(15, -4.6, 6, 4.2, LIGHT)}${r(16, -0.6, 1.2, 1.2, LIGHT)}<text x="18" y="-1.4" font-size="4" font-weight="700" text-anchor="middle" fill="${E}" font-family="monospace">?</text>` +
  `<animateTransform attributeName="transform" type="translate" values="0 0;0 -1;0 0" dur="1.3s" repeatCount="indefinite" ${SPL}/></g>`
const nudge = '<animateTransform attributeName="transform" type="translate" additive="sum" values="0 0;0 0;-.8 0;.8 0;-.8 0;.8 0;0 0" keyTimes="0;.86;.89;.92;.95;.98;1" dur="4s" repeatCount="indefinite"/>'

// Asleep: nightcap, closed eyes, z's drifting off.
const nightcap = r(3, 1, 13, 1.2, '#4a6fa5') + r(5, 0, 9, 1, '#5b80b8') + r(8, -1, 6, 1, '#5b80b8') + r(12, -2, 3, 1, '#5b80b8') + r(14.6, -2.4, 1.6, 1.6, '#f4f2ea')
const zees = [0, 1, 2]
  .map(
    i =>
      `<g opacity="0"><text x="16" y="1" font-size="${(3 - i * 0.6).toFixed(1)}" font-family="monospace" font-weight="700" fill="#9a988f">z</text>` +
      `<animate attributeName="opacity" values="0;1;0" dur="3.9s" begin="-${(i * 1.3).toFixed(1)}s" repeatCount="indefinite"/>` +
      `<animateTransform attributeName="transform" type="translate" values="0 0;2 -4;4 -8" dur="3.9s" begin="-${(i * 1.3).toFixed(1)}s" repeatCount="indefinite"/></g>`,
  )
  .join('')

// Done: content eyes shut in two little arcs, standing still, a green tick above: readable at any size.
const happyEyes = [5, 12].map(x => r(x, 5, 1, 1, E) + r(x + 1, 4, 1, 1, E) + r(x + 2, 5, 1, 1, E)).join('')
const tick =
  `<circle cx="18.6" cy="-0.9" r="2.8" fill="#4f9a3c"/>` +
  `<path d="M17.2 -0.9 L18.2 0.2 L20.1 -2.1" fill="none" stroke="#ffffff" stroke-width=".9" stroke-linecap="square"/>`
const party = legs() + body() + claws() + happyEyes + tick

// Failed: a plaster, a shiver, a red mark.
const plaster = r(3.5, 2.2, 3.4, 1, '#f4e1c1') + r(4.7, 1, 1, 3.2, '#f4e1c1')
const hurt =
  `<g>${legs() + body() + claws() + eyes() + plaster}<animateTransform attributeName="transform" type="translate" values="0 0;-.6 0;.6 0;-.6 0;0 0;0 0" keyTimes="0;.05;.1;.15;.2;1" dur="1.6s" repeatCount="indefinite"/></g>` +
  r(19, -4, 1.2, 3, '#e06c6c') + r(19, -0.4, 1.2, 1.2, '#e06c6c')

const SCENES: Record<Activity, string> = {
  research: crab(eyes('blink', '0 0;.5 0;0 0;-.3 0;0 0'), { dress: deerstalker }) + magnifier,
  code: coder,
  tests: crab(eyes(), { dress: labCoat }) + flask,
  build: crab(eyes(), { bob: '0 0;0 .4;0 0;0 .4;0 0', dur: '1.6s', dress: hardHat }) + hammer,
  review: crab(eyes('blink', '0 0;-1 0;0 0;1 0;0 0'), { dress: glasses }) + clipboard,
  ask: `<g>${crab(eyes(), { bob: '0 0;0 -.8;0 0;0 -.8;0 0', dur: '1.3s' })}${bubble}${nudge}</g>`,
  wait: crab(eyes('closed'), { sway: false, bob: '0 0;0 .3;0 0;0 .3;0 0', dur: '3.9s', dress: nightcap }) + zees,
  done: party,
  error: hurt,
}

// The small crab: a subagent's sprite, drawn on a grid of its own at the big crab's two screen pixels to a grid
// pixel, never scaled down. Body 9x6 at x=2..10, claws out to x=0 and x=12, legs at 2/4/8/10, eyes at x=4 and x=8.
// Every rect sits on whole grid pixels; motion moves in half pixels, one screen pixel. No sway: a turned sprite this
// small blurs.
const sBody = () => r(2, 1, 9, 6)
const sClaws = (f = C) => r(0, 4, 2, 1, f) + r(11, 4, 2, 1, f)
const sLegs = () => [2, 4, 8, 10].map(x => r(x, 7, 1, 1)).join('')
const sBlink = '<animate attributeName="height" values="2;2;0;2;2" keyTimes="0;.55;.58;.62;1" dur="2.6s" repeatCount="indefinite"/>'
const sEyes = (look?: string) => {
  const g = `<rect x="4" y="2" width="1" height="2" fill="${E}">${sBlink}</rect><rect x="8" y="2" width="1" height="2" fill="${E}">${sBlink}</rect>`
  return look ? `<g>${g}<animateTransform attributeName="transform" type="translate" values="${look}" dur="2.6s" repeatCount="indefinite" ${SPL4}/></g>` : g
}
const sBob = (inner: string, bob = '0 0;0 .5;0 0;0 .5;0 0', dur = '2.6s') =>
  `<g>${inner}<animateTransform attributeName="transform" type="translate" values="${bob}" dur="${dur}" repeatCount="indefinite" ${SPL4}/></g>`
const sCrab = (top: string, opts: { bob?: string; dur?: string; claws?: string } = {}) =>
  sLegs() + sBob(sBody() + (opts.claws ?? sClaws()) + top, opts.bob, opts.dur)

const sDeerstalker = r(3, -1, 7, 1, '#8b6b4a') + r(1, 0, 11, 1, '#6f5338') + r(4, -1, 1, 1, '#a5835d') + r(8, -1, 1, 1, '#a5835d') + r(6, -2, 1, 1, '#6f5338')
const sMagnifier =
  `<g>${r(13, -1, 3, 1, LIGHT)}${r(13, 1, 3, 1, LIGHT)}${r(13, 0, 1, 1, LIGHT)}${r(15, 0, 1, 1, LIGHT)}${r(14, 0, 1, 1, '#9fc7f5')}${r(12, 2, 1, 1, LIGHT)}` +
  `<animateTransform attributeName="transform" type="translate" values="0 0;-.5 .5;0 0;.5 -.5;0 0" dur="2.6s" repeatCount="indefinite" ${SPL4}/></g>`

const sHeadphones = r(2, 0, 9, 1, '#2b2b29') + r(1, 1, 1, 2, '#7d5ba6') + r(11, 1, 1, 2, '#7d5ba6')
// The lid starts a row below the eyes: dark on dark, they would merge.
const sLaptop = r(3, 5, 7, 2, '#3a3a37') + r(4, 5, 5, 1, '#5b8def') + r(2, 7, 9, 1, '#9a988f')
const sTyping = (x: number, values: string) =>
  `<g>${r(x, 4, 2, 1)}<animateTransform attributeName="transform" type="translate" values="${values}" dur=".32s" repeatCount="indefinite"/></g>`
const sCoder =
  sLegs() + sBob(sBody() + sEyes() + sHeadphones, undefined, '1.3s') + sTyping(0, '0 0;0 .5;0 0') + sTyping(11, '0 .5;0 0;0 .5') + sLaptop

const COAT = '#f4f2ea'
const sCoat = r(2, 4, 4, 3, COAT) + r(7, 4, 4, 3, COAT) + r(6, 6, 1, 1, '#9a988f')
const sFlask =
  r(14, -1, 1, 1, LIGHT) + r(13, 0, 3, 2, '#7fb069') +
  [0, 1, 2].map(i => puff(14, -1, '#a8e0b0', `-${(i * 0.87).toFixed(2)}s`, 0.5, 4, 1)).join('')

const sHardHat = r(4, -2, 5, 1, '#f5c518') + r(3, -1, 7, 1, '#f5c518') + r(1, 0, 11, 1, '#e0a800') + r(6, -2, 1, 2, '#e0a800')
const sHammer =
  `<g>${r(13, -1, 1, 4, '#b98a5a')}${r(12, -2, 3, 1, '#9a988f')}` +
  `<animateTransform attributeName="transform" type="rotate" values="30 13.5 3;-35 13.5 3;30 13.5 3" keyTimes="0;.35;1" dur=".8s" repeatCount="indefinite" calcMode="spline" keySplines=".6 0 .9 .4;.2 .8 .4 1"/></g>` +
  puff(15, 0, '#e0b45a', '-0.25s', 0.5, 2, 1, '.8s')

const sGlasses = r(3, 2, 3, 2, LIGHT) + r(7, 2, 3, 2, LIGHT) + r(6, 2, 1, 1, LIGHT)
const sClipboard =
  r(12, -1, 5, 5, '#b98a5a') + r(13, 0, 3, 3, '#f4f2ea') + r(14, -2, 1, 1, '#9a988f') +
  [0, 1, 2]
    .map(i => `<rect x="13" y="${i}" width="3" height="1" fill="#7fb069" opacity="0"><animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;${(0.15 + i * 0.2).toFixed(2)};${(0.2 + i * 0.2).toFixed(2)};.95;1" dur="2.6s" repeatCount="indefinite"/></rect>`)
    .join('')

// A question mark drawn in grid pixels: at this size a font is a blur.
const sBubble =
  `<g>${r(11, -4, 5, 7, LIGHT)}${r(12, -3, 3, 1, E)}${r(14, -2, 1, 1, E)}${r(13, -1, 1, 1, E)}${r(13, 1, 1, 1, E)}` +
  `<animateTransform attributeName="transform" type="translate" values="0 0;0 .5;0 0" dur="1.3s" repeatCount="indefinite" ${SPL}/></g>`

const sNightcap = r(2, 0, 9, 1, '#4a6fa5') + r(4, -1, 6, 1, '#5b80b8') + r(7, -2, 3, 1, '#5b80b8') + r(10, -2, 1, 1, COAT)
const sZees = [0, 1]
  .map(
    i =>
      `<g opacity="0">${r(12, -2, 4, 1, '#9a988f')}${r(14, -1, 1, 1, '#9a988f')}${r(13, 0, 1, 1, '#9a988f')}${r(12, 1, 4, 1, '#9a988f')}` +
      `<animate attributeName="opacity" values="0;1;0" dur="3.9s" begin="-${(i * 1.95).toFixed(2)}s" repeatCount="indefinite"/>` +
      `<animateTransform attributeName="transform" type="translate" values="0 0;1 -2;2 -4" dur="3.9s" begin="-${(i * 1.95).toFixed(2)}s" repeatCount="indefinite"/></g>`,
  )
  .join('')

const sHappyEyes = [4, 8].map(x => r(x - 1, 3, 1, 1, E) + r(x, 2, 1, 1, E) + r(x + 1, 3, 1, 1, E)).join('')
const sTick = `<circle cx="13.5" cy="-1.5" r="2.5" fill="#4f9a3c"/><path d="M12.3 -1.5 L13.2 -0.5 L14.8 -2.6" fill="none" stroke="#ffffff" stroke-width=".8" stroke-linecap="square"/>`

const sNudge = nudge.replace('-.8 0;.8 0;-.8 0;.8 0', '-.5 0;.5 0;-.5 0;.5 0')

const sPlaster = r(2, 1, 3, 1, '#f4e1c1') + r(3, 0, 1, 3, '#f4e1c1')

const SMALL: Record<Activity, string> = {
  research: sCrab(sEyes('0 0;.5 0;0 0;-.5 0;0 0') + sDeerstalker) + sMagnifier,
  code: sCoder,
  tests: sCrab(sEyes() + sCoat, { claws: sClaws(COAT) }) + sFlask,
  build: sCrab(sEyes() + sHardHat, { dur: '1.6s' }) + sHammer,
  review: sCrab(sGlasses + sEyes('0 0;-.5 0;0 0;.5 0;0 0')) + sClipboard,
  ask: `<g>${sCrab(sEyes(), { bob: '0 0;0 -.5;0 0;0 -.5;0 0', dur: '1.3s' })}${sBubble}${sNudge}</g>`,
  wait: sCrab(r(4, 3, 1, 1, E) + r(8, 3, 1, 1, E) + sNightcap, { dur: '3.9s' }) + sZees,
  done: sLegs() + sBody() + sClaws() + sHappyEyes + sTick,
  error: `<g>${sLegs() + sBody() + sClaws() + sEyes() + sPlaster}<animateTransform attributeName="transform" type="translate" values="0 0;-.5 0;.5 0;-.5 0;0 0;0 0" keyTimes="0;.05;.1;.15;.2;1" dur="1.6s" repeatCount="indefinite"/></g>` +
    r(14, -3, 1, 2, '#e06c6c') + r(14, 0, 1, 1, '#e06c6c'),
}
export const SMALL_SCENE = SMALL

// The scenes alone, for a frame of the caller's own (the card nests them).
export const SCENE = SCENES

// The band's one line: the whole crew side by side, each crab at its own work in place. No walking: the host
// rebuilds the picture on its own redraws, and a crab travelling across the line shows every rebuild as a jump.
// A child session is a full-size crab; a subagent, this session's own helper, a small one standing on the same line.
const PARADE_STEP = 44
type Slot = { kind?: 'session' | 'agent'; activity: Activity; seenAt?: number; count?: number }
export function paradeSvg(crew: readonly Slot[], nowMs = 0, theme: Theme = 'auto', max = 14): string {
  const shown = crew.slice(0, max)
  const ink = theme === 'dark' ? '#a3a197' : '#67655e'
  const dark = theme === 'auto' ? '<style>@media (prefers-color-scheme: dark){.more{fill:#a3a197}}</style>' : ''
  const label = (x: number, text: string) =>
    `<text class="more" x="${x}" y="22" font-size="13" font-family="-apple-system,BlinkMacSystemFont,sans-serif" fill="${ink}" style="-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums">${text}</text>`
  let x = 0
  const crabs = shown.map(m => {
    // Both sprites draw a grid pixel as two screen pixels; the small one is its own drawing, not the big one shrunk.
    const small = m.kind === 'agent'
    const [w, h, step] = small ? [36, 24, 32] : [48, 32, PARADE_STEP]
    const many = m.count && m.count > 1 ? label(x + step + 2, `×${m.count}`) : ''
    const slot = step + (many ? 30 : 0)
    const one = enter(`<svg x="${x}" y="${32 - h}" width="${w}" height="${h}" viewBox="${small ? '-1 -4 18 12' : '-1 -4 24 16'}" shape-rendering="crispEdges">${small ? SMALL[m.activity] : SCENES[m.activity]}</svg>`, m.seenAt, nowMs)
    x += slot
    return one + many
  })
  const rest = crew.length - shown.length
  const more = rest > 0 ? label(x + 4, `+${rest}`) : ''
  const width = x + 10 + (rest > 0 ? 36 : 0)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="34" viewBox="0 0 ${width} 34">${calm(crabs.join(''))}${dark}${more}</svg>`
}

export const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Reduced motion: the picture is drawn twice, moving and still, and the viewer's setting shows one. SMIL pays no
// heed to CSS, so a media query can only pick the copy; the still one keeps every costume and prop, so what a crab
// is at reads the same without the motion.
const STILL = '<style>.still{display:none}@media (prefers-reduced-motion: reduce){.moving{display:none}.still{display:inline}}</style>'
export const calm = (body: string) =>
  `${STILL}<g class="moving">${body}</g><g class="still">${body.replace(/<(animate|animateTransform)\b[^>]*\/>/g, '')}</g>`

export type Theme = 'light' | 'dark' | 'auto'

// A one-shot entrance (fade in, rise 4px, 200ms) timed from when the member joined, not from when the
// picture was built: a picture the host rebuilds later finds the entrance already over and frozen at rest.
export function enter(body: string, seenAt: number | undefined, nowMs: number): string {
  if (seenAt === undefined) return body
  const at = ((seenAt - nowMs) / 1000).toFixed(3)
  const once = `dur=".2s" begin="${at}s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines="0.2 0 0 1"`
  return (
    `<g><animate attributeName="opacity" values="0;1" ${once}/>` +
    `<g><animateTransform attributeName="transform" type="translate" values="0 4;0 0" ${once}/>${body}</g></g>`
  )
}

// The host may rebuild the band's picture on any redraw, and a rebuilt SVG starts its animations at zero.
// Locking every animation to the wall clock makes a rebuilt picture carry on from where the old one was.
export function lockToClock(svg: string, nowMs: number): string {
  return svg.replace(/<(animate|animateTransform)\b[^>]*>/g, tag => {
    const dur = /\bdur="([\d.]+)s"/.exec(tag)
    if (!dur || /\bfill="freeze"/.test(tag)) return tag // a one-shot keeps its own start
    const period = Number(dur[1])
    const begin = Number(/\bbegin="(-?[\d.]+)s"/.exec(tag)?.[1] ?? 0)
    const at = (begin - ((nowMs / 1000) % period)).toFixed(3)
    return /\bbegin="/.test(tag) ? tag.replace(/\bbegin="[^"]*"/, `begin="${at}s"`) : tag.replace(/^<(animate|animateTransform)\b/, m => `${m} begin="${at}s"`)
  })
}
