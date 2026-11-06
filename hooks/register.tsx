import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Activity, Cast, Crew, Member } from '../types'
import { cardSvg, cardText } from './card'
import type { Theme } from './crabs'
import { lockToClock, paradeSvg } from './crabs'
import {
  classifyTool, contextWindow, EFFORTS, fmtDuration, fmtTokens, langOf, modelName, projectSlug, readTail,
  sessionActivity, shortName, STRINGS,
} from './activity'
import type { Lang, TailFacts } from './activity'

const crew = atom({ plugin: 'crab-crew', key: 'crew' } as const, { agents: [], sessions: [], hidden: [], now: 0 } as Crew, { shape: 'crew-3' })
// Seconds for the pane's timers. Kept apart from the crew so the band, which shows no time, never redraws on a tick:
// a redraw rebuilds the parade picture and restarts every crab's animation.
const clock = atom({ plugin: 'crab-crew', key: 'clock' } as const, 0, { shape: 'clock-1' })
// What the band draws and nothing more: who is there and what each is at. Tokens and context change on every
// step and live in the crew alone, so the band redraws only when the parade itself changes.
const cast = atom({ plugin: 'crab-crew', key: 'cast' } as const, [] as Cast, { shape: 'cast-1' })

// Whether the pane shows the finished subagents' cards or folds them into one line.
const doneOpen = atom({ plugin: 'crab-crew', key: 'doneOpen' } as const, false, { shape: 'done-open-1' })

// Whether this session has started a session of its own. Only such a session ever asks the app about sessions:
// every `$.mcp.call` runs through all the tool hooks, the user's included, so a session that started none pays nothing.
const parent = atom({ plugin: 'crab-crew', key: 'parent' } as const, false, { shape: 'parent-1' })

const SESSIONS = 'ccd_session_mgmt'
const WINDOW = 'ccd_window'
const VIEW = 'ccd_view'
// How often, in one-second ticks, the children's transcripts are looked at between syncs. Reading them asks no tool.
const LIVE_EVERY = 10
const STARTS = ['mcp__ccd_session__start_session', 'mcp__ccd_session__hand_off_to_session']
const KEEP_AGENTS = 20
const TAIL_BYTES = '65536'

// Module state: rebuilt after a reload, and the next sync fills it again.
let lang: Lang = 'en'
let theme: Theme = 'auto'
let selfId: string | undefined
let home = ''
let tick = 0
let childPending = false
let syncing = false
const meta = new Map<string, { model?: string; effort?: string; path?: string; createdAt?: number; worktree?: string }>()
const tails = new Map<string, { file: string; mtime: number; facts: ReturnType<typeof readTail> }>()

const t = () => STRINGS[lang]

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    lang = await detectLang($, options.language)
    theme = await detectTheme($)
    home = (await $.env.get('HOME').catch(() => undefined)) ?? ''
    selfId = undefined
    tick = 0
    $.clock.every(1000, () => void heartbeat($).catch(err => $.ui.log(`crab-crew: ${String(err)}`, { to: 'debug' })))
    // A reload keeps the state, so nothing the band reads changes and the host never draws the reloaded band:
    // write the cast once, as it stands, to draw it.
    await update($, cast, c => [...c]).catch(err => $.ui.log(`crab-crew: ${String(err)}`, { to: 'debug' }))
    // Once per start, every session asks: children started before this start (or before this version) are found here.
    void syncIfParent($, true)
    return next(e)
  })

  // A parent checks its children with the app as each of its own turns starts and ends: a child started from a
  // card the user clicked, or one archived since, shows up then.
  on('prompt.submit', async ($, e, next) => {
    void syncIfParent($)
    return next(e)
  })

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if (started.deny !== undefined) return started
    await (async () => {
      const at = await $.clock.now()
      const agent: Member = {
        id: started.agentId ?? e.tool_use_id,
        kind: 'agent',
        title: e.description || e.subagentType,
        short: shortName(e.description || e.subagentType),
        activity: 'research',
        isRunning: true,
        startedAt: at,
        seenAt: at,
        model: started.model,
        agentType: e.subagentType,
        steps: 0,
        tokens: 0,
      }
      await updateCrew($, c => ({ ...c, agents: [...c.agents.filter(a => a.id !== agent.id), agent].slice(-KEEP_AGENTS) }))
    })().catch(err => $.ui.log(`crab-crew: ${String(err)}`, { to: 'debug' }))
    return started
  })

  on('turn.step', async function* ($, e, next) {
    // The step after the one that started a session: the start has run, so the app lists the child now.
    if (!e.agentId && childPending) {
      childPending = false
      void syncIfParent($)
    }
    const result = yield* next(e)
    const agentId = e.agentId
    if (!agentId) {
      // A session this one starts: from now on it is a parent.
      if (result.toolUses.some(u => STARTS.includes(u.name))) {
        childPending = true
        await update($, parent, () => true).catch(err => $.ui.log(`crab-crew: ${String(err)}`, { to: 'debug' }))
      }
      return result
    }
    await (async () => {
      const usage = result.usage
      const lastTool = result.toolUses[result.toolUses.length - 1]
      const input = usage ? (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0) : 0
      const output = usage?.output_tokens || 0
      await updateCrew($, c => ({
        ...c,
        agents: c.agents.map(a =>
          a.id !== agentId
            ? a
            : {
                ...a,
                isRunning: true,
                endedAt: undefined,
                activity: lastTool ? classifyTool(lastTool.name, lastTool.input) : a.activity,
                model: usage?.model || e.model || a.model,
                effort: typeof e.effort === 'string' ? e.effort : a.effort,
                steps: (a.steps ?? 0) + 1,
                tokens: (a.tokens ?? 0) + input + output,
                context: usage ? input + output : a.context,
                thought: result.answer.trim() ? squashText(result.answer) : a.thought,
              },
        ),
      }))
    })().catch(err => $.ui.log(`crab-crew: ${String(err)}`, { to: 'debug' }))
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const agentId = e.agentId
    if (agentId) {
      await (async () => {
        const at = await $.clock.now()
        const activity: Activity = e.reason === 'error' ? 'error' : 'done'
        await updateCrew($, c => ({
          ...c,
          agents: c.agents.map(a =>
            a.id === agentId ? { ...a, isRunning: false, endedAt: at, activity, thought: finalText(e) ? squashText(finalText(e)) : a.thought } : a,
          ),
        }))
      })().catch(err => $.ui.log(`crab-crew: ${String(err)}`, { to: 'debug' }))
    } else {
      // Every session checks once as its own turn ends: a child started in that turn shows up even when the
      // step that started it went unseen. One app call per turn; nothing on the timer.
      void syncIfParent($, true)
    }
    return next(e)
  })

  // The band: one line, the crew's parade and a summary. The summary opens the side pane.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const ordered = await read($, cast)
    if (ordered.length === 0) return next(e)
    const ui = $.ui.resolve(e) as Record<string, any>
    const { Box, Text, Button } = ui
    // The terminal's table answers Svg with a stand-in that draws nothing: pictures only elsewhere.
    const Svg = e.surface === 'terminal' ? undefined : (ui.Svg as any)
    const wall = await $.clock.now()
    // The finished fold by kind: one big crab with the count for sessions, one small for subagents.
    const folds = (['session', 'agent'] as const)
      .map(kind => ({ kind, done: ordered.filter(m => isDone(m) && m.kind === kind) }))
      .filter(f => f.done.length > 0)
    const lineup = [
      ...ordered.filter(m => !isDone(m)),
      ...folds.map(f => ({ kind: f.kind, activity: 'done' as const, count: f.done.length, seenAt: f.done.length === 1 ? f.done[0]?.seenAt : undefined })),
    ]
    const picture = lockToClock(paradeSvg(lineup, wall, theme), wall)
    const width = Number(/width="(\d+)"/.exec(picture)?.[1] ?? 0)
    const alt = [
      ...ordered.filter(m => !isDone(m)).map(m => `${m.short}: ${t().activity[m.activity]}`),
      ...folds.map(f => `${(f.kind === 'session' ? t().summary.sessions : t().summary.agents)(f.done.length)}: ${t().activity.done}`),
    ]
    const parade = Svg
      ? <Svg key="parade" source={picture} alt={alt.join(', ')} width={width} height={34} />
      : <Text>{lineup.map(m => GLYPH[m.activity] + ('count' in m && m.count > 1 ? `×${m.count}` : '')).join(' ')}</Text>
    return (
      <Box flexDirection="row" alignItems="center" gap={1}>
        {parade}
        <Button key="crew" plain onPress={() => void act($, () => togglePane($))}>
          {summaryParts(ordered).flatMap((part, i) => [
            i > 0 ? ' · ' : '',
            // Counts that change in place keep their width: tabular figures.
            <Text tabular color={part.isAsk ? 'warning' : part.isFail ? 'error' : undefined} weight={part.isAsk ? 'semibold' : undefined}>{part.text}</Text>,
          ])}
          {' ›'}
        </Button>
      </Box>
    )
  })

  // The side pane: every card, the one waiting for you first. Acting on a session is the session's own business.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const c = await read($, crew)
    const ui = $.ui.resolve(e) as Record<string, any>
    const { Box, Text } = ui
    const Svg = e.surface === 'terminal' ? undefined : (ui.Svg as any)
    const s = t()
    const members = byUrgency(visible(c))
    if (members.length === 0) return <Text dimColor>{s.empty}</Text>
    const now = Math.max(await read($, clock), ...members.map(m => m.endedAt ?? m.startedAt))
    const wall = Svg ? await $.clock.now() : now
    // The finished go last, sessions and subagents alike, folded into one line that opens them.
    const done = members.filter(isDone)
    const isOpen = await read($, doneOpen)
    const { Button } = ui
    const fold = done.length === 0 ? [] : [
      <Button key="done" plain onPress={() => void update($, doneOpen, v => !v)}>
        <Text dimColor tabular>{s.doneGroup(done.length)} {isOpen ? '⌄' : '›'}</Text>
      </Button>,
    ]
    // The card's way out: a child session opens in the main pane, a subagent shows its transcript there.
    // No `label`: the desktop draws it in place of the children, so it would replace the dim text, not name it.
    const goButton = (m: Member) => (
      <Button key={`go:${m.id}`} plain onPress={() => void act($, () => goTo($, m, e.surface))}>
        <Text dimColor>{m.kind === 'session' ? s.openSession : e.surface === 'terminal' ? s.openTranscript : s.openTasks}</Text>
      </Button>
    )
    const order = (card: (m: Member) => unknown) => [...members.filter(m => !isDone(m)).map(card), ...fold, ...(isOpen ? done.map(card) : [])]

    if (Svg) {
      return (
        <Box flexDirection="column" gap={1}>
          {order(m => {
            const svg = lockToClock(cardSvg(m, now, lang, theme, wall), now)
            const height = Number(/height="([\d.]+)"/.exec(svg)?.[1] ?? 200)
            return (
              <Box key={`card:${m.id}`} flexDirection="column">
                <Svg source={svg} alt={cardText(m, now, lang)} width={460} height={height} />
                {goButton(m)}
              </Box>
            )
          })}
        </Box>
      )
    }

    // Terminal: no pictures there, so the same facts as text.
    const fact = (label: string, value: string) => (
      <Box flexDirection="row" gap={1}>
        <Box width={10}><Text dimColor>{label}</Text></Box>
        <Text>{value}</Text>
      </Box>
    )
    return (
      <Box flexDirection="column" gap={1}>
        {order(m => {
          const effortIdx = m.effort ? EFFORTS.indexOf(m.effort as (typeof EFFORTS)[number]) : -1
          const tone = m.activity === 'ask' ? 'warning' : m.activity === 'error' ? 'error' : undefined
          return (
            <Box key={`card:${m.id}`} flexDirection="column">
              <Text weight="semibold">{GLYPH[m.activity]} {m.kind === 'agent' ? `${s.subagent} ${m.agentType ?? ''}: ${m.title}` : m.title}</Text>
              <Text color={tone} dimColor={!tone} tabular>{s.activity[m.activity]} · {fmtDuration((m.endedAt ?? now) - m.startedAt)}</Text>
              {m.thought ? <Text italic dimColor>{m.thought}</Text> : null}
              {m.model ? fact(s.model, `${modelName(m.model)}${effortIdx >= 0 ? ` ${'■'.repeat(effortIdx + 1)}${'□'.repeat(EFFORTS.length - effortIdx - 1)} ${s.effort[m.effort ?? ''] ?? m.effort}` : ''}`) : null}
              {m.context ? fact(s.context, `${fmtTokens(m.context)} ${s.of} ${fmtTokens(contextWindow(m.model))}`) : null}
              {m.kind === 'agent' && m.tokens ? fact(s.tokens, `${fmtTokens(m.tokens)} · ${s.steps} ${m.steps}`) : null}
              {m.branch ? fact(s.branch, m.branch) : null}
              {m.worktree ? fact(s.worktree, m.worktree) : null}
              {goButton(m)}
            </Box>
          )
        })}
      </Box>
    )
  })
}

const PANE = 'crab-crew'

// Writes the crew, then the band's cast when, and only when, what the band shows changed.
async function updateCrew($: EngineInterface, fn: (c: Crew) => Crew): Promise<void> {
  await update($, crew, fn)
  const next: Cast = byUrgency(visible(await read($, crew))).map(m => ({ id: m.id, kind: m.kind, short: m.short, activity: m.activity, isRunning: m.isRunning, seenAt: m.seenAt }))
  if (JSON.stringify(next) !== JSON.stringify(await read($, cast))) await update($, cast, () => next)
}

const isDone = (m: { activity: Activity }) => m.activity === 'done'

const visible = (c: Crew) => [...c.sessions, ...c.agents].filter(m => !c.hidden.includes(m.id))

// Who needs you first, then who broke, then who works, then who is done; start order within each.
const RANK: Record<Activity, number> = { ask: 0, error: 1, research: 2, code: 2, tests: 2, build: 2, review: 2, wait: 2, done: 3 }
const byUrgency = <T extends { activity: Activity; startedAt: number }>(members: T[]) => [...members].sort((a, b) => RANK[a.activity] - RANK[b.activity] || a.startedAt - b.startedAt)

// Shows a member: a child session in the app's main pane, as its sidebar row does; a subagent's transcript in the
// terminal's main view, or, in the desktop app, which has no such view for a mod, the app's background tasks pane
// that lists it. Any of them can refuse (the cursor in a text field, the agent gone); the reason goes to a toast.
async function goTo($: EngineInterface, m: Member, surface: string): Promise<void> {
  if (m.kind === 'agent' && surface === 'terminal') {
    const shown = await $.ui.view({ agentId: m.id })
    if (shown.deny) refused($, shown.deny)
    return
  }
  const r = m.kind === 'agent'
    ? await $.mcp.call(VIEW, 'show_pane', { pane: 'tasks' })
    : await $.mcp.call(WINDOW, 'open_session_in', { session_id: m.id, target: 'focus' })
  const text = (r.content as { type?: string; text?: string }[] | undefined)?.find(b => b.type === 'text')?.text
  if (r.isError && text) refused($, text)
}

// A refusal says what to do about it: the app refuses to switch the main pane while the cursor is in a text field,
// and its own reason, in English, names the field; any other reason goes on as the app gave it.
function refused($: EngineInterface, reason: string): void {
  const s = t()
  $.ui.toast(`${s.cantOpen} ${reason}${/text field|terminal|typing|cursor/i.test(reason) ? ` ${s.cursorHint}` : ''}`)
}

// The summary opens the side pane, and closes it when it is open.
async function togglePane($: EngineInterface): Promise<void> {
  const isShown = (await $.ui.panes()).some(p => p.id === PANE)
  if (isShown) await $.ui.close({ id: PANE })
  else {
    await $.ui.open({ id: PANE, title: t().pane })
    await syncIfParent($)
  }
}

const GLYPH: Record<Activity, string> = { research: '🔍', code: '⌨', tests: '🧪', build: '🔨', review: '👓', ask: '❓', wait: '💤', done: '✓', error: '✗' }

type Part = { text: string; isAsk?: boolean; isFail?: boolean }
function summaryParts(members: Cast): Part[] {
  const s = t().summary
  const sessions = members.filter(m => m.kind === 'session').length
  const agents = members.filter(m => m.kind === 'agent').length
  const running = members.filter(m => m.isRunning && m.activity !== 'ask').length
  const asking = members.filter(m => m.activity === 'ask').length
  const failed = members.filter(m => m.activity === 'error').length
  const parts: Part[] = []
  if (sessions > 0) parts.push({ text: s.sessions(sessions) })
  if (running > 0) parts.push({ text: s.running(running) })
  if (asking > 0) parts.push({ text: s.asking(asking), isAsk: true })
  if (failed > 0) parts.push({ text: s.failed(failed), isFail: true })
  if (agents > 0) parts.push({ text: s.agents(agents) })
  return parts
}

const finalText = (e: object): string => ('answer' in e && typeof e.answer === 'string' ? e.answer : 'text' in e && typeof e.text === 'string' ? e.text : '').trim()

const squashText = (text: string) => {
  const one = text.replace(/[`*_#>]/g, '').replace(/\s+/g, ' ').trim()
  return one.length > 220 ? one.slice(0, 219) + '…' : one
}

async function act($: EngineInterface, call: () => Promise<unknown>): Promise<void> {
  await call().catch(err => $.ui.log(`crab-crew: ${String(err)}`, { to: 'debug' }))
}

// The timer asks no tool: it reads the children's transcripts and, while someone works, moves the pane's clock.
async function heartbeat($: EngineInterface): Promise<void> {
  tick += 1
  if (tick % LIVE_EVERY === 0) await liveTails($)
  const c = await read($, crew)
  if ([...c.agents, ...c.sessions].some(m => m.isRunning)) {
    const at = await $.clock.now()
    await update($, clock, () => at)
  }
}

type SessionRow = { sessionId: string; title?: string; branch?: string; cwd?: string; isArchived?: boolean; isRunning?: boolean; startedBy?: string }

async function callJson<T>($: EngineInterface, server: string, tool: string, args: Record<string, unknown>): Promise<T | undefined> {
  const r = await $.mcp.call(server, tool, args)
  if (r.isError) return undefined
  const block = (r.content as { type?: string; text?: string }[] | undefined)?.find(b => b.type === 'text')
  return block?.text ? (JSON.parse(block.text) as T) : undefined
}

// One sync at a time: a turn's start and end that land together ask the app once.
async function syncIfParent($: EngineInterface, isStart = false): Promise<void> {
  if (syncing) return
  syncing = true
  try {
    if (!isStart && !(await read($, parent)) && (await read($, crew)).sessions.length === 0) return
    await syncSessions($)
  } catch (err) {
    $.ui.log(`crab-crew: ${String(err)}`, { to: 'debug' })
  } finally {
    syncing = false
  }
}

// The children this session started, as the desktop app lists them, with what their transcripts say.
async function syncSessions($: EngineInterface): Promise<void> {
  if (!selfId) {
    try {
      selfId = (await callJson<{ sessionId: string }>($, SESSIONS, 'get_session', { session_id: 'self' }))?.sessionId
    } catch (err) {
      // No desktop app, or its tools not connected yet: try again at the next sync, never give up for good.
      return
    }
    if (!selfId) return
  }
  const rows = (await callJson<SessionRow[]>($, SESSIONS, 'list_sessions', { linked: true, limit: 100 })) ?? []
  const now = await $.clock.now()
  const children = rows.filter(r => r.startedBy === selfId && !r.isArchived)
  if (children.length > 0) await update($, parent, () => true)
  const before = await read($, crew)
  const sessions: Member[] = []
  for (const row of children) {
    let m = meta.get(row.sessionId)
    // Model, effort and worktree: asked once per child.
    if (!m) {
      const info = await callJson<{ model?: string; effort?: string; worktreePath?: string; worktreeName?: string; cwd?: string; createdAt?: string }>(
        $, SESSIONS, 'get_session', { session_id: row.sessionId },
      ).catch(() => undefined)
      m = {
        model: info?.model,
        effort: info?.effort,
        path: info?.worktreePath ?? info?.cwd ?? row.cwd,
        worktree: info?.worktreeName,
        createdAt: info?.createdAt ? Date.parse(info.createdAt) : undefined,
      }
      meta.set(row.sessionId, m)
    }
    const facts = await tailOf($, row.sessionId, m.path)
    const isRunning = row.isRunning === true
    sessions.push({
      id: row.sessionId,
      kind: 'session',
      title: row.title ?? row.sessionId,
      short: shortName(row.title ?? row.sessionId),
      activity: sessionActivity(isRunning, facts),
      isRunning,
      startedAt: m.createdAt ?? now,
      seenAt: before.sessions.find(s => s.id === row.sessionId)?.seenAt ?? now,
      model: facts.model ?? m.model,
      effort: m.effort,
      context: facts.context,
      thought: facts.thought,
      branch: row.branch,
      worktree: m.worktree,
      path: m.path,
    })
  }
  for (const id of [...meta.keys()]) if (!children.some(c => c.sessionId === id)) { meta.delete(id); tails.delete(id) }
  // Write only what changed: an unchanged list must not redraw the band.
  if (JSON.stringify(before.sessions) !== JSON.stringify(sessions)) await updateCrew($, c => ({ ...c, sessions }))
}

// Between syncs: what each child is at, as its transcript says. A finished child is looked at too, since a pause
// between two of its steps reads as finished; a file not changed since the last look is not read again.
async function liveTails($: EngineInterface): Promise<void> {
  const before = await read($, crew)
  if (before.sessions.length === 0) return
  const sessions: Member[] = []
  for (const s of before.sessions) {
    if (!s.path) {
      sessions.push(s)
      continue
    }
    const facts = await tailOf($, s.id, s.path)
    const isRunning = facts.isIdle === undefined ? s.isRunning : !facts.isIdle
    sessions.push({
      ...s,
      isRunning,
      activity: sessionActivity(isRunning, facts),
      model: facts.model ?? s.model,
      context: facts.context ?? s.context,
      thought: facts.thought ?? s.thought,
    })
  }
  if (JSON.stringify(before.sessions) !== JSON.stringify(sessions)) await updateCrew($, c => ({ ...c, sessions }))
}

// The newest transcript under the session's project folder, re-read only when it changed.
async function tailOf($: EngineInterface, id: string, path: string | undefined): Promise<TailFacts> {
  const empty: TailFacts = { hasPendingTool: false, isBlocked: false }
  if (!path || !home) return empty
  const dir = `${home}/.claude/projects/${projectSlug(path)}`
  const entries = await $.fs.list(dir).catch(() => [])
  const newest = entries.filter(e => e.kind === 'file' && e.name.endsWith('.jsonl')).sort((a, b) => b.mtimeMs - a.mtimeMs)[0]
  if (!newest) return empty
  const file = `${dir}/${newest.name}`
  const cached = tails.get(id)
  if (cached && cached.file === file && cached.mtime === newest.mtimeMs) return cached.facts
  const ran = await $.process.run(['tail', '-c', TAIL_BYTES, file]).catch(() => undefined)
  if (!ran) return cached?.facts ?? empty
  const facts = readTail(ran.stdout)
  tails.set(id, { file, mtime: newest.mtimeMs, facts })
  return facts
}

// Claude Code's theme as set; auto when it follows the system or is not set.
async function detectTheme($: EngineInterface): Promise<Theme> {
  try {
    const value = String(((await $.settings.read()) as Record<string, unknown>).theme ?? '')
    return /dark/i.test(value) ? 'dark' : /light/i.test(value) ? 'light' : 'auto'
  } catch {
    return 'auto'
  }
}

// The `language` option; else Claude Code's own language setting; else the process locale; else,
// on macOS, the first system language; English when nothing says Russian.
async function detectLang($: EngineInterface, option: unknown): Promise<Lang> {
  if (option === 'en' || option === 'ru') return option
  try {
    const fromSettings = langOf(((await $.settings.read()) as Record<string, unknown>).language)
    if (fromSettings) return fromSettings
  } catch {
    // No settings: the locale decides.
  }
  const locales = [
    await $.env.get('LC_ALL').catch(() => undefined),
    await $.env.get('LC_MESSAGES').catch(() => undefined),
    await $.env.get('LANG').catch(() => undefined),
  ]
  for (const v of locales) {
    const l = langOf(v)
    if (l && v && v !== 'C' && v !== 'POSIX') return l
  }
  const ran = await $.process.run(['defaults', 'read', '-g', 'AppleLanguages']).catch(() => undefined)
  const first = ran?.stdout.match(/"?([a-zA-Z]{2})[-_"]/)?.[1]
  return langOf(first) ?? 'en'
}
