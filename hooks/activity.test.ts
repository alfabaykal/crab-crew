import { expect, test } from 'claude-code/testing'

import { classifyTool, modelName, projectSlug, readTail, sessionActivity, shortName, STRINGS } from './activity'

test('tool calls map to a kind of work, never to the command itself', () => {
  expect(classifyTool('Read', { file_path: '/x' })).toBe('research')
  expect(classifyTool('Grep', {})).toBe('research')
  expect(classifyTool('Edit', {})).toBe('code')
  expect(classifyTool('Bash', { command: 'pnpm vitest run src/a.test.ts' })).toBe('tests')
  expect(classifyTool('Bash', { command: 'mvn -q clean verify -pl apps/chat -am' })).toBe('tests')
  expect(classifyTool('Bash', { command: 'mvn -q package -DskipTests' })).toBe('build')
  expect(classifyTool('Bash', { command: 'git push origin HEAD:main' })).toBe('build')
  expect(classifyTool('Bash', { command: "perl -e 'select(undef,undef,undef,240)'; echo waited" })).toBe('wait')
  expect(classifyTool('Bash', { command: 'ls -la' })).toBe('research')
  expect(classifyTool('Bash', { command: 'grep -rn "export" hooks' })).toBe('research')
  expect(classifyTool('Bash', { command: 'cd /x && git log --oneline -5' })).toBe('research')
  expect(classifyTool('Bash', { command: 'python3 scripts/fix.py' })).toBe('code')
  expect(classifyTool('Skill', { skill: 'code-review' })).toBe('review')
  expect(classifyTool('AskUserQuestion', {})).toBe('ask')
  expect(classifyTool('mcp__ccd_turn__wrap_up', { blocked: true })).toBe('ask')
  expect(classifyTool('mcp__ccd_turn__wrap_up', { recap: 'x' })).toBe('research')
  expect(classifyTool('ScheduleWakeup', {})).toBe('wait')
})

const line = (o: unknown) => JSON.stringify(o)
const assistant = (content: unknown[], usage?: Record<string, number>) =>
  line({ type: 'assistant', message: { model: 'claude-sonnet-5-5', content, usage } })
const result = (id: string) => line({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id }] } })

test('the tail of a transcript gives the last call, the last words and the context', () => {
  const text = [
    '{"cut off half a line',
    assistant([{ type: 'text', text: 'Зависимости **установлены**; запускаю тесты' }, { type: 'tool_use', id: 't1', name: 'Bash', input: { command: 'pnpm vitest run' } }], {
      input_tokens: 10, cache_read_input_tokens: 90_000, cache_creation_input_tokens: 5_000, output_tokens: 1_000,
    }),
  ].join('\n')
  const facts = readTail(text)
  expect(facts.thought).toBe('Зависимости установлены; запускаю тесты')
  expect(facts.lastTool?.name).toBe('Bash')
  expect(facts.hasPendingTool).toBe(true)
  expect(facts.context).toBe(96_010)
  expect(facts.model).toBe('claude-sonnet-5-5')
  expect(sessionActivity(true, facts)).toBe('tests')
  expect(readTail(text + '\n' + result('t1')).hasPendingTool).toBe(false)
})

test('a stopped session is done, unless it stopped on a question', () => {
  const asked = readTail(assistant([{ type: 'tool_use', id: 'q', name: 'AskUserQuestion', input: {} }]))
  expect(sessionActivity(false, asked)).toBe('ask')
  const blocked = readTail(assistant([{ type: 'tool_use', id: 'w', name: 'mcp__ccd_turn__wrap_up', input: { blocked: true } }]) + '\n' + result('w'))
  expect(sessionActivity(false, blocked)).toBe('ask')
  const finished = readTail(assistant([{ type: 'text', text: 'Готово' }]))
  expect(sessionActivity(false, finished)).toBe('done')
})

test('names, paths and models read short', () => {
  expect(shortName('SIS-1107: протухший initData в мини-аппе')).toBe('протухший initData в')
  expect(shortName('SIS-802: байты фото снимаются один раз')).toBe('байты фото снимаются')
  expect(shortName('Explore deck filters')).toBe('Explore deck filters')
  expect(projectSlug('/Users/a/IdeaProjects/sisterra/.claude/worktrees/x-1')).toBe('-Users-a-IdeaProjects-sisterra--claude-worktrees-x-1')
  expect(modelName('claude-sonnet-5-5')).toBe('Sonnet 5.5')
  expect(modelName('claude-opus-5-5[1m]')).toBe('Opus 5.5')
  expect(modelName('claude-haiku-4-5-20251001')).toBe('Haiku 4.5')
})

test('russian counts agree with their numbers', () => {
  const s = STRINGS.ru.summary
  expect(s.sessions(1)).toBe('1 исполнитель')
  expect(s.sessions(3)).toBe('3 исполнителя')
  expect(s.sessions(11)).toBe('11 исполнителей')
  expect(s.asking(2)).toBe('2 ждут тебя')
  expect(STRINGS.en.summary.agents(1)).toBe('1 subagent')
})
