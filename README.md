# crab-crew

A Claude Code mod that shows who your session has put to work. Every subagent it spawns and every child session it starts joins a parade of pixel crabs on one line above the prompt. Each crab dresses for the job: a detective's hat while it reads code, a lab coat while tests run, a hard hat during a build, a nightcap while it waits. A crab waiting for your answer leads the parade and gives a shake every few seconds. A finished session stands under a green tick until you archive it in the app. A child session is a full-size crab, a subagent a small one. Finished subagents fold into one small crab with a count. Each crab moves at its own work in place, and stands still when the system asks for reduced motion.

Next to the parade sits a one-line summary. Click it to open the side pane with every card: the full task, what each one said last, its model and effort, how much context it has used, branch and worktree, and for a subagent its tokens and steps. The one waiting on you comes first. Finished subagents go last, folded into one line that opens them. Under each card a link opens that session in the app's main pane. For a subagent it shows the transcript in a terminal, and the app's background tasks pane in the desktop app. A screen reader reads the card's facts in place of the picture.

## Install

```
/plugin install crab-crew --marketplace alfabaykal/crab-crew
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `alfabaykal/crab-crew`, then Add plugin.

## What it reads

- **Subagents.** The session's own events: when a subagent starts, each of its model steps, and how its turn ends.
- **Child sessions.** In the Claude desktop app only. The app's session tools list the sessions this one started, with model, effort and branch. The tail of each one's transcript says what it is doing now and what it said last. Nothing is sent anywhere, and no model call is made for the band.

In a terminal the parade is a row of glyphs and the cards are plain text.

## Settings

`language`: `auto` (default), `en` or `ru`. `auto` follows Claude Code's own language setting, then the system language.

The cards follow Claude Code's theme as set when the session starts, light or dark, and the system's otherwise.

## Credits

The crab is drawn on the pixel grid of Clawd, the Claude Code mascot, and moves to the timing of the CLI's own animations. It is a fan tribute and not affiliated with Anthropic.

## License

MIT
