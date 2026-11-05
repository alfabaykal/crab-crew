import { expect, mock, test } from 'claude-code/testing'

import type { Crew } from '../types'

const BAND = {
  plugin: 'crab-crew',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 30, bodyColumns: 100, scroll: { offset: 0, bodyRows: 30 }, view: {} },
} as const

const PANE = {
  plugin: 'crab-crew',
  component: 'Pane',
  requestId: 'crab-crew',
  props: { title: 'crew', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

const T0 = 1_000_000
const CREW: Crew = {
  now: T0 + 95_000,
  hidden: [],
  sessions: [
    { id: 'local_a', kind: 'session', title: 'SIS-802: байты фото снимаются один раз', short: 'байты фото снимаются', activity: 'code', isRunning: true, startedAt: T0, model: 'claude-opus-5-5', effort: 'high', context: 140_000, thought: 'Переношу снятие байтов в фасад', branch: 'claude/sis-802', worktree: 'sis-802-photo' },
    { id: 'local_b', kind: 'session', title: 'SIS-773: токен админки', short: 'токен админки', activity: 'ask', isRunning: false, startedAt: T0 + 5_000 },
  ],
  agents: [
    { id: 'ag1', kind: 'agent', title: 'Find deck filters', short: 'Find deck filters', activity: 'done', isRunning: false, startedAt: T0, endedAt: T0 + 42_000, agentType: 'Explore', tokens: 84_000, steps: 7 },
  ],
}

// A state store that versions its writes, as the engine's does, one value per key.
const RANK: Record<string, number> = { ask: 0, error: 1, done: 3 }
const castOf = (c: Crew) =>
  [...c.sessions, ...c.agents]
    .sort((a, b) => (RANK[a.activity] ?? 2) - (RANK[b.activity] ?? 2) || a.startedAt - b.startedAt)
    .map(m => ({ id: m.id, kind: m.kind, short: m.short, activity: m.activity, isRunning: m.isRunning }))
function store(on: any, initial: Crew, isParent = false) {
  const shapes: Record<string, string> = { crew: 'crew-3', cast: 'cast-1', clock: 'clock-1', doneOpen: 'done-open-1', parent: 'parent-1' }
  const values: Record<string, unknown> = { crew: initial, cast: castOf(initial), clock: initial.now, doneOpen: false, parent: isParent }
  const box = {
    version: 1,
    get value() {
      return values.crew as Crew
    },
  }
  on('state.get', (_: unknown, e: { key: string }) => ({ value: { value: { shape: shapes[e.key], value: values[e.key] }, version: box.version } }))
  on('state.set', (_: unknown, e: { key: string; value: { value: unknown } }) => {
    values[e.key] = e.value.value
    box.version += 1
    return { value: { isSet: true, version: box.version } }
  })
  return box
}

// The side pane as the engine keeps it: open, close, and the list of what is open.
function panes(on: any) {
  const open = new Set<string>()
  on('ui.open', (_: unknown, e: { id: string }) => (open.add(e.id), { value: { isPlaced: true } }))
  on('ui.close', (_: unknown, e: { id: string }) => (open.delete(e.id), { value: undefined }))
  on('ui.panes', () => ({ value: [...open].map(id => ({ id, title: id, isShown: true, isFocused: false, isPlaced: true })) }))
  return open
}

async function start($: any, on: any) {
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('clock.every', () => ({ value: undefined }))
  on('clock.now', () => ({ value: T0 + 95_000 }))
  on('env.get', () => ({ value: undefined }))
  on('settings.read', () => ({ value: {} }))
  on('ui.log', () => ({ value: undefined }))
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
}

test('the band is one line: the parade and a summary that opens and closes the side pane', { options: { language: 'ru' } }, async ($, on) => {
  store(on, CREW)
  const open = panes(on)
  await start($, on)

  for (const surface of ['terminal', 'desktop'] as const) {
    const band = await $.ui.mount({ ...BAND, surface })
    const summary = await band.find({ key: 'crew' })
    expect(summary?.text).toBe('2 исполнителя · 1 работает · 1 ждёт тебя · 1 подагент ›')
    if (surface === 'desktop') {
      // Urgent first: the one waiting on you leads the parade.
      const parade = (await band.findAll({ type: 'Svg' }))[0]
      expect(String(parade?.props.alt)).toMatch(/^токен админки: ждёт ответа, байты фото снимаются: пишет код, 1 подагент: готово$/)
    } else {
      expect(await band.find({ type: 'Text', text: /❓ ⌨ ✓/ })).toBeDefined()
    }
    await band.press({ key: 'crew' })
    expect(open.has('crab-crew')).toBe(true)
    await band.press({ key: 'crew' })
    expect(open.has('crab-crew')).toBe(false)
    await band.unmount()
  }
})

test('the side pane shows every card, the one waiting on you first, finished subagents folded last', { options: { language: 'ru' } }, async ($, on) => {
  store(on, CREW)
  await start($, on)

  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const cards = (await pane.findAll({ type: 'Svg' })).map(e => String(e.props.source))
  expect(cards).toHaveLength(2)
  expect(cards[0]).toContain('SIS-773')
  for (const fact of ['Переношу снятие байтов', 'Opus 5.5', 'высокое', 'пишет код · 1:35', '140k из 1M', 'claude/sis-802', 'sis-802-photo']) expect(cards[1]).toContain(fact)
  expect((await pane.find({ key: 'done' }))?.text).toBe('Готово: 1 ›')
  await pane.press({ key: 'done' })
  await pane.unmount()
  // The stub store does not redraw a mounted pane: mount it again to see the write.
  const open = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const opened = (await open.findAll({ type: 'Svg' })).map(e => String(e.props.source))
  expect(opened).toHaveLength(3)
  expect(opened[2]).toContain('Find deck filters')
  expect((await open.find({ key: 'done' }))?.text).toBe('Готово: 1 ⌄')
  await open.press({ key: 'done' })
  await open.unmount()
})

test('a card opens its session in the main pane, or its subagent\'s transcript', { options: { language: 'ru' } }, async ($, on) => {
  store(on, CREW)
  const calls: unknown[] = []
  on('mcp.call', (_: unknown, e: unknown) => (calls.push(e), { value: { isError: false, content: [{ type: 'text', text: 'ok' }] } }))
  on('ui.view', (_: unknown, e: unknown) => (calls.push(e), { value: {} }))
  await start($, on)
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await pane.find({ key: 'go:local_a' }))?.text).toBe('Открыть сессию ›')
  expect(String((await pane.findAll({ type: 'Svg' }))[1]?.props.alt)).toBe('SIS-802: байты фото снимаются один раз. пишет код · 1:35. Переношу снятие байтов в фасад. модель: Opus 5.5, высокое. контекст: 140k из 1M. ветка: claude/sis-802. worktree: sis-802-photo')
  await pane.press({ key: 'go:local_a' })
  expect(calls).toContainEqual(expect.objectContaining({ server: 'ccd_window', tool: 'open_session_in', args: { session_id: 'local_a', target: 'focus' } }))
  await pane.press({ key: 'done' })
  await pane.unmount()
  const open = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await open.find({ key: 'go:ag1' }))?.text).toBe('В задачах ›')
  await open.press({ key: 'go:ag1' })
  expect(calls).toContainEqual(expect.objectContaining({ server: 'ccd_view', tool: 'show_pane', args: { pane: 'tasks' } }))
  await open.unmount()
  const term = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await term.press({ key: 'go:ag1' })
  expect(calls).toContainEqual({ agentId: 'ag1' })
  await term.unmount()

  const text = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await text.find({ type: 'Text', text: /Opus 5\.5 ■■■□□ высокое/ })).toBeDefined()
  await text.unmount()
})

test('a pane with no one at work says so', { options: { language: 'en' } }, async ($, on) => {
  store(on, { ...CREW, sessions: [], agents: [] })
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await pane.find({ type: 'Text' }))?.text).toMatch(/No one is at work/)
  await pane.unmount()
})

test('with no one started the band is left to the engine', async ($, on) => {
  on('ui.render', ($e: any, e: any) => {
    const { Text } = $e.ui.resolve(e)
    return <Text>engine</Text>
  })
  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await ui.find({ type: 'Text' }))?.text).toBe('engine')
  await ui.unmount()
})

test('a spawned subagent joins the parade and turns done when its turn ends', async ($, on) => {
  on('agent.spawn', () => ({ model: 'claude-haiku-5-5', agentId: 'x1' }))
  on('clock.now', () => ({ value: T0 }))
  on('turn.complete', () => ({ text: '' }))
  await $.agent.spawn({ tool_use_id: 't', prompt: 'p', description: 'Find deck filters', subagentType: 'Explore', provider: 'anthropic', parentModel: 'claude-opus-5-5' } as never)
  let band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(String((await band.findAll({ type: 'Svg' }))[0]?.props.alt)).toMatch(/Find deck filters: researching/)
  await band.unmount()
  await $.turn.complete({ agentId: 'x1', reason: 'answer', answer: 'Found them in DeckFilters.tsx', text: '', turnId: 't' } as never)
  band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(String((await band.findAll({ type: 'Svg' }))[0]?.props.alt)).toBe('1 subagent: done')
  await band.unmount()
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await pane.press({ key: 'done' })
  expect((await pane.findAll({ type: 'Svg' })).some(e => String(e.props.source).includes('Found them in DeckFilters'))).toBe(true)
  await pane.unmount()
})

test('the finished fold by kind: one big crab with a count for sessions, one small for subagents', { options: { language: 'en' } }, async ($, on) => {
  const done = (id: string) => ({ ...CREW.agents[0]!, id, title: id, short: id })
  const doneSession = (id: string) => ({ ...CREW.sessions[0]!, id, short: id, activity: 'done' as const, isRunning: false })
  store(on, { ...CREW, sessions: [CREW.sessions[0]!, doneSession('s1'), doneSession('s2')], agents: [done('a1'), done('a2'), done('a3')] })
  await start($, on)
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const parade = (await band.findAll({ type: 'Svg' }))[0]
  expect(String(parade?.props.alt)).toBe('байты фото снимаются: writing code, 2 sessions: done, 3 subagents: done')
  const moving = String(parade?.props.source).split('<g class="still">')[0] ?? ''
  expect(moving).toContain('×2')
  expect(moving).toContain('×3')
  expect(moving.match(/<svg x=/g)).toHaveLength(3)
  // A session is a full-size crab, the subagents a small one drawn on its own grid.
  expect(moving).toMatch(/<svg x="44" y="0" width="48" height="32" viewBox="-1 -4 24 16".*<svg x="118" y="8" width="36" height="24" viewBox="-1 -4 18 12"/)
  await band.unmount()

  // The pane folds the finished of both kinds into one line.
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await pane.find({ key: 'done' }))?.text).toBe('Done: 5 ›')
  expect((await pane.findAll({ type: 'Svg' })).length).toBe(1)
  await pane.unmount()
})

test('a refused switch says what to do about it', { options: { language: 'ru' } }, async ($, on) => {
  store(on, CREW)
  const toasts: unknown[] = []
  on('ui.toast', (_: unknown, e: unknown) => (toasts.push(e), { value: undefined }))
  on('mcp.call', () => ({ value: { isError: true, content: [{ type: 'text', text: "Refused while the user's cursor is in a text field." }] } }))
  await start($, on)
  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await pane.press({ key: 'go:local_a' })
  expect(JSON.stringify(toasts)).toContain("Не открылось: Refused while the user's cursor is in a text field. Убери курсор из поля ввода и нажми ещё раз.")
  await pane.unmount()
})

// Every `$.mcp.call` runs the tool hooks of the whole setup, so the timer must never make one.
async function startWithClock($: any, on: any) {
  const clock = mock.clock(on, { now: T0 })
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('env.get', (_: unknown, e: { name: string }) => ({ value: e.name === 'HOME' ? '/home' : undefined }))
  on('settings.read', () => ({ value: {} }))
  on('ui.log', () => ({ value: undefined }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  return clock
}

const answer = (v: unknown) => ({ value: { isError: false, content: [{ type: 'text', text: JSON.stringify(v) }] } })

test('a session with no children asks the app once as it starts, then nothing, however long it runs', async ($, on) => {
  store(on, { ...CREW, sessions: [] })
  const calls: { tool: string }[] = []
  on('mcp.call', (_: unknown, e: { tool: string }) => (calls.push(e), answer(e.tool === 'list_sessions' ? [] : { sessionId: 'local_self' })))
  on('turn.complete', () => ({ text: '' }))
  const clock = await startWithClock($, on)
  await clock.settle()
  expect(calls.map(c => c.tool)).toEqual(['get_session', 'list_sessions'])
  calls.length = 0
  await clock.advance(10 * 60_000)
  await $.turn.complete({ reason: 'answer', answer: 'ok', text: '', turnId: 't' } as never)
  await clock.settle()
  expect(calls).toEqual([])
})

test('children started before this start (or this version) show up as the session starts', async ($, on) => {
  const box = store(on, { ...CREW, sessions: [], agents: [] })
  on('mcp.call', (_: unknown, e: { tool: string; args: { session_id?: string } }) =>
    answer(e.tool === 'list_sessions' ? [{ sessionId: 'local_c', title: 'SIS-1: child', startedBy: 'local_self', isRunning: true }] : e.args.session_id === 'self' ? { sessionId: 'local_self' } : { cwd: '/w' }))
  on('fs.list', () => ({ value: [] }))
  const clock = await startWithClock($, on)
  await clock.settle()
  expect(box.value.sessions.map(m => m.id)).toEqual(['local_c'])
})

test('a parent asks the app as its turn ends, then follows the child from its transcript alone', async ($, on) => {
  const box = store(on, { ...CREW, sessions: [], agents: [] }, true)
  const calls: { tool: string }[] = []
  const json = (v: unknown) => ({ value: { isError: false, content: [{ type: 'text', text: JSON.stringify(v) }] } })
  on('mcp.call', (_: unknown, e: { tool: string; args: { session_id?: string } }) => {
    calls.push(e)
    if (e.tool === 'list_sessions') return json([{ sessionId: 'local_c', title: 'SIS-1: child', startedBy: 'local_self', isRunning: true }])
    return json(e.args.session_id === 'self' ? { sessionId: 'local_self' } : { cwd: '/w' })
  })
  on('turn.complete', () => ({ text: '' }))
  on('fs.list', () => ({ value: [{ name: 't.jsonl', kind: 'file', mtimeMs: 5, isLink: false, size: 1 }] }))
  const tails: unknown[] = []
  const answer = JSON.stringify({ type: 'assistant', message: { model: 'claude-sonnet-5-5', content: [{ type: 'text', text: 'Done.' }] } })
  on('process.run', (_: unknown, e: { argv: readonly string[] }) => (e.argv[0] === 'tail' && tails.push(e), { value: { exitCode: 0, stdout: answer, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))
  const clock = await startWithClock($, on)

  // A parent already: it asked once as the session started.
  await clock.settle()
  expect(calls.map(c => c.tool)).toEqual(['get_session', 'list_sessions', 'get_session'])
  calls.length = 0
  await $.turn.complete({ reason: 'answer', answer: 'ok', text: '', turnId: 't' } as never)
  await clock.settle()
  expect(calls.map(c => c.tool)).toEqual(['list_sessions'])
  expect(box.value.sessions.map(m => m.id)).toEqual(['local_c'])

  await clock.advance(10 * 60_000)
  expect(calls).toHaveLength(1)
  // The transcript did not change after the first look: read once.
  expect(tails).toHaveLength(1)
  // Its last row is an answer with no tool waiting: the child is done.
  expect(box.value.sessions[0]?.activity).toBe('done')
})
