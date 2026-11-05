import type { Activity } from '../types'

// What kind of work a tool call is. Names only, plus the shell command for Bash: the band shows the
// kind, never the command itself.
const TEST_CMD = /\b(test|tests|vitest|jest|pytest|playwright|ci:gate|verify|spec)\b/i
const BUILD_CMD = /\b(mvn|gradle|gradlew|tsc|docker\s+build|xcodebuild|cargo\s+build|go\s+build|pnpm\s+(install|build)|npm\s+(ci|install|run\s+build)|make|git\s+(push|commit|rebase|cherry-pick|merge))\b/i
const WAIT_CMD = /^\s*(sleep|perl\s+-e\s+'select)|\bwait\b/i
// Reading, not writing: searches, listings and the read side of git.
const READ_CMD = /^\s*(cd\s+\S+\s*&&\s*)?(grep|rg|ag|find|fd|cat|head|tail|less|ls|tree|wc|sed\s+-n|awk|jq|git\s+(log|show|diff|status|blame|grep))\b/i

export function classifyTool(name: string, input: unknown): Activity {
  const n = name.toLowerCase()
  const args = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  if (n === 'askuserquestion' || n.endsWith('__wrap_up') && args.blocked === true) return 'ask'
  if (n === 'sendmessage') return 'ask'
  if (n === 'schedulewakeup' || n === 'monitor' || n === 'taskoutput') return 'wait'
  if (n === 'bash' || n.endsWith('__ctx_execute') || n.endsWith('__execute_terminal_command')) {
    const cmd = String(args.command ?? args.code ?? '')
    if (WAIT_CMD.test(cmd)) return 'wait'
    if (TEST_CMD.test(cmd)) return 'tests'
    if (BUILD_CMD.test(cmd)) return 'build'
    if (READ_CMD.test(cmd)) return 'research'
    return 'code'
  }
  if (n === 'edit' || n === 'write' || n === 'notebookedit' || n.endsWith('apply_patch') || n.endsWith('create_new_file')) return 'code'
  if (n === 'skill') {
    const skill = String(args.skill ?? '')
    return /review|audit/i.test(skill) ? 'review' : 'research'
  }
  if (n === 'reportfindings' || /review/.test(n)) return 'review'
  return 'research'
}

export type TailFacts = {
  lastTool?: { name: string; input: unknown }
  hasPendingTool: boolean
  thought?: string
  model?: string
  context?: number
  isBlocked: boolean
  // The last row is the session's answer with no tool left waiting: its turn is over. Undefined when nothing was read.
  isIdle?: boolean
}

type Block = { type?: string; name?: string; input?: unknown; text?: string; id?: string; tool_use_id?: string }
type Row = { type?: string; message?: { model?: string; content?: unknown; usage?: Record<string, number> } }

// Reads the tail of a session's transcript (JSON lines, the first possibly cut): the last tool call,
// whether it still waits for its result, the last thing the session said, its model and context.
export function readTail(text: string): TailFacts {
  const facts: TailFacts = { hasPendingTool: false, isBlocked: false }
  let pendingId: string | undefined
  for (const line of text.split('\n')) {
    if (!line.startsWith('{')) continue
    let row: Row
    try {
      row = JSON.parse(line) as Row
    } catch {
      continue
    }
    const content = Array.isArray(row.message?.content) ? (row.message?.content as Block[]) : []
    if (row.type === 'assistant') {
      if (row.message?.model && !row.message.model.startsWith('<')) facts.model = row.message.model
      const u = row.message?.usage
      if (u) facts.context = (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + (u.output_tokens ?? 0)
      facts.isIdle = !content.some(b => b.type === 'tool_use')
      for (const b of content) {
        if (b.type === 'text' && b.text?.trim()) facts.thought = squash(b.text)
        if (b.type === 'tool_use' && b.name) {
          facts.lastTool = { name: b.name, input: b.input }
          pendingId = b.id
          facts.isBlocked = b.name.endsWith('__wrap_up') && (b.input as Record<string, unknown> | undefined)?.blocked === true
        }
      }
    } else if (row.type === 'user') {
      facts.isIdle = false
      if (content.some(b => b.type === 'tool_result' && b.tool_use_id === pendingId)) pendingId = undefined
    }
  }
  facts.hasPendingTool = pendingId !== undefined
  return facts
}

const squash = (s: string) => {
  const one = s.replace(/[`*_#>]/g, '').replace(/\s+/g, ' ').trim()
  return one.length > 220 ? one.slice(0, 219) + '…' : one
}

// A stopped session that ended on a question waits for someone; any other stopped one is done.
export function sessionActivity(isRunning: boolean, facts: TailFacts): Activity {
  const askedLast = facts.lastTool && facts.lastTool.name === 'AskUserQuestion' && facts.hasPendingTool
  if (askedLast || facts.isBlocked) return 'ask'
  if (!isRunning) return 'done'
  return facts.lastTool ? classifyTool(facts.lastTool.name, facts.lastTool.input) : 'research'
}

// "SIS-1107: протухший initData в мини-аппе" → "протухший initData".
export function shortName(title: string): string {
  const rest = title.replace(/^\s*[A-Z][A-Z0-9]*-\d+\s*[:—-]\s*/, '').trim() || title.trim()
  const words = rest.split(/\s+/)
  let out = ''
  for (const w of words) {
    const next = out ? `${out} ${w}` : w
    if (next.length > 20 && out) break
    out = next
    if (out.split(' ').length >= 3) break
  }
  return out.length > 22 ? out.slice(0, 21) + '…' : out
}

// Claude Code keeps a project's transcripts under ~/.claude/projects/<path with every
// non-alphanumeric character turned into '-'>.
export const projectSlug = (path: string) => path.replace(/[^a-zA-Z0-9]/g, '-')

export function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return String(n)
}

// "claude-sonnet-5-5" → "Sonnet 5.5".
export function modelName(id?: string): string | undefined {
  if (!id) return undefined
  const m = /(fable|mythos|opus|sonnet|haiku)-(\d+)(?:-(\d{1,2}))?(?!\d)/i.exec(id)
  if (!m) return id.replace(/^claude-/, '')
  const fam = m[1] ?? ''
  return `${fam[0]?.toUpperCase()}${fam.slice(1)} ${m[2]}${m[3] ? '.' + m[3] : ''}`
}

export const contextWindow = (model?: string) => (model && /\[1m\]|opus|sonnet|fable|mythos/i.test(model) ? 1_000_000 : 200_000)

export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const

export type Lang = 'en' | 'ru'

export const STRINGS = {
  en: {
    activity: { research: 'researching', code: 'writing code', tests: 'running tests', build: 'building', review: 'reviewing', ask: 'waiting for an answer', wait: 'waiting', done: 'done', error: 'failed' },
    summary: { sessions: (n: number) => `${n} ${n === 1 ? 'session' : 'sessions'}`, running: (n: number) => `${n} running`, asking: (n: number) => `${n} waiting for you`, failed: (n: number) => `${n} failed`, agents: (n: number) => `${n} ${n === 1 ? 'subagent' : 'subagents'}` },
    model: 'model', context: 'context', tokens: 'tokens', steps: 'steps', branch: 'branch', worktree: 'worktree', of: 'of',
    subagent: 'Subagent',
    cantOpen: 'Couldn\'t open it:',
    cursorHint: 'Click outside the prompt box and press it again.',
    pane: 'Crew',
    doneGroup: (n: number) => `Done: ${n}`,
    openSession: 'Open session ›',
    openTranscript: 'Show transcript ›',
    openTasks: 'Show in tasks ›',
    empty: 'No one is at work for this session yet.',
    effort: { low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' } as Record<string, string>,
  },
  ru: {
    activity: { research: 'изучает код', code: 'пишет код', tests: 'гоняет тесты', build: 'собирает', review: 'ревьюит', ask: 'ждёт ответа', wait: 'ждёт', done: 'готово', error: 'упал' },
    summary: { sessions: (n: number) => `${n} ${plural(n, 'исполнитель', 'исполнителя', 'исполнителей')}`, running: (n: number) => `${n} ${plural(n, 'работает', 'работают', 'работают')}`, asking: (n: number) => `${n} ${plural(n, 'ждёт', 'ждут', 'ждут')} тебя`, failed: (n: number) => `${n} ${plural(n, 'упал', 'упали', 'упали')}`, agents: (n: number) => `${n} ${plural(n, 'подагент', 'подагента', 'подагентов')}` },
    model: 'модель', context: 'контекст', tokens: 'токены', steps: 'шаги', branch: 'ветка', worktree: 'worktree', of: 'из',
    subagent: 'Подагент',
    cantOpen: 'Не открылось:',
    cursorHint: 'Убери курсор из поля ввода и нажми ещё раз.',
    pane: 'Команда',
    doneGroup: (n: number) => `Готово: ${n}`,
    openSession: 'Открыть сессию ›',
    openTranscript: 'Показать транскрипт ›',
    openTasks: 'В задачах ›',
    empty: 'В этой сессии пока никто не работает.',
    effort: { low: 'низкое', medium: 'среднее', high: 'высокое', xhigh: 'очень высокое', max: 'максимум' } as Record<string, string>,
  },
} satisfies Record<Lang, unknown>

function plural(n: number, one: string, few: string, many: string): string {
  const d = n % 10
  const dd = n % 100
  if (d === 1 && dd !== 11) return one
  if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return few
  return many
}

export const langOf = (v: unknown): Lang | undefined =>
  typeof v !== 'string' || !v.trim() ? undefined : /^(ru|russian|рус)/i.test(v.trim()) ? 'ru' : 'en'
