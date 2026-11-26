# dsh-event-fix

> **Step-level error and wasted-work analytics for DeepSeek Harness (DSH) sessions.**
>
> It does not change requests, tools, or models. It only reads the session event stream and answers: **which steps were wasted, and how much token budget and wall-clock time did they burn?**

`dsh-event-fix` is a read-only DSH plugin focused on a deliberately narrow branch of event sourcing. It interprets only events with explicit semantics: tool errors, model retries, interrupted turns, repeated calls, empty steps, and rejected approvals. It does not guess intent or pretend to score answer quality.

![Dashboard example](docs/dashboard-demo.png)

[中文 README](README.md) | English

## What it answers

1. **Which steps were invalid?**
   Tool errors, non-zero shell exits, model retries, aborted turns, repeated calls, empty steps, and rejected approvals are attributed to the exact step and source event.
2. **How much did they waste?**
   Invalid-step `usage` is summed across input, output, cache reads, and cache writes. Wall-clock time is reported separately. Both come with absolute values and ratios.
3. **How does waste change over time?**
   The settings page shows a daily invalid-step share and wasted-token trend across sessions. The chart has hover details for every day.
4. **What did the agent do after a failure?**
   Every failure starts a *failure episode*. The next call in the same turn is classified as `same`, `changed arguments`, `changed tool`, `abandoned`, or `unknown`, and its outcome is recorded. This turns "retry rate" into an actionable **action × outcome** table.

## Install

Requirements: a DSH version matching `>=0.2.0-rc.2 <0.2.1` and Node.js `^22.19.0 || >=24`.

```powershell
dsh plugin --profile web add dsh-event-fix@0.3.2
```

Restart DSH web. When the log contains `[event-fix] active`, open **Settings → Invalid action analytics**. A composer pill such as `无效 2/9 · 12.3k tok` will appear after the next turn.

See [QUICKSTART.md](docs/QUICKSTART.md) for a five-minute walkthrough and troubleshooting.

## CLI

```powershell
dsh-event-fix --version
dsh-event-fix scan
dsh-event-fix scan --since 7d --html .\reports\report.html
dsh-event-fix scan --json .\reports\report.json --quiet
```

The CLI replays the same session files and uses the same fold as the in-app panel. A test asserts that the replay and the live projection agree.

## Why it exists

Most agent dashboards stop at token counts and call totals. Those numbers say where cost went, but not whether the work was useful. This plugin keeps every invalid step traceable to an event and turns the result into a next action:

- `changed tool` succeeded more often than `changed arguments` in the reference corpus: **92% vs 74%**.
- Only **0.3%** of failures were byte-identical retries. A generic "retry rate" would have been almost constant and useless.
- Reading nested tool-result shapes and shell exit codes exposed failures that a simple `isError` check misses.

These numbers are observations from one local corpus, not universal benchmarks. The plugin shows its definitions so users can challenge them.

## Project status

- 53 tests and a syntax check run on every change through CI.
- The plugin is read-only with respect to DSH conversation state.
- Ledger persistence is optional and can be disabled.
- The HTTP stats route passes through DSH's connection and origin checks.
- Current compatibility target: DSH `0.2.0-rc.2`.

## Contribute

Real usage reports, bug reproductions, documentation fixes, and small PRs are welcome. Start with a [`good first issue`](https://github.com/SSHOOTING/dsh-event-fix/labels/good%20first%20issue), or read [CONTRIBUTING.md](CONTRIBUTING.md).

If the project is useful to you, a genuine star helps other DSH users find it. A fork is most useful when it becomes a focused bug fix or feature PR.

## License

[MIT](LICENSE) © 2026 dsh-event-fix contributors
