export type Activity = 'research' | 'code' | 'tests' | 'build' | 'review' | 'ask' | 'wait' | 'done' | 'error'

export type Member = {
  id: string
  kind: 'session' | 'agent'
  title: string
  short: string
  activity: Activity
  isRunning: boolean
  startedAt: number
  endedAt?: number
  model?: string
  effort?: string
  context?: number
  tokens?: number
  steps?: number
  thought?: string
  branch?: string
  worktree?: string
  agentType?: string
  seenAt?: number // when the crab first joined, for its one entrance
}

export type Cast = { id: string; kind: Member['kind']; short: string; activity: Activity; isRunning: boolean; seenAt?: number }[]

export type Crew = {
  agents: Member[]
  sessions: Member[]
  hidden: string[]
  now: number
}

declare module 'claude-code' {
  interface PluginState {
    'crab-crew': { crew: Shaped<Crew>; clock: Shaped<number>; cast: Shaped<Cast>; doneOpen: Shaped<boolean> }
  }
}
