#!/usr/bin/env node
/**
 * dsh-event-fix CLI — scan local DSH session logs for step-level waste.
 *
 *   dsh-event-fix scan                        # 全部会话，打印摘要
 *   dsh-event-fix scan --since 7d             # 最近 7 天
 *   dsh-event-fix scan --html out.html        # 生成离线面板
 *   dsh-event-fix scan --json out.json        # 导出机器可读结果
 *   dsh-event-fix scan --session <id>         # 只看一个会话
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { sessionView, summarizeRecords } from '../src/analyzer.js'
import { buildReport, renderHtmlReport, renderTextReport } from '../src/report.js'
import { listSessionFiles, parseSince, readSessionRecords, resolveSessionsRoot } from '../src/session-store.js'

const USAGE = `dsh-event-fix — DSH step 级无效动作统计

用法:
  dsh-event-fix scan [选项]

选项:
  --root <dir>      会话日志根目录（默认 $DSH_HOME/sessions）
  --since <7d|24h|2026-11-01>   只看该时间之后修改的会话
  --session <id>    只分析指定会话 id
  --limit <n>       最多分析 n 个会话（按修改时间倒序）
  --html <path>     生成离线 HTML 面板
  --json <path>     导出 JSON 结果
  --quiet           只输出结果路径，不打印摘要
  -h, --help        显示帮助
`

class CliError extends Error {
  constructor(message, exitCode = 1) {
    super(message)
    this.exitCode = exitCode
  }
}

function parseArgs(argv) {
  const args = { command: 'scan', root: null, since: null, session: null, limit: null, html: null, json: null, quiet: false }
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (token === '-h' || token === '--help') return { help: true }
    if (!token.startsWith('--')) {
      args.command = token
      continue
    }
    const [flag, inline] = token.includes('=') ? token.split(/=(.*)/su, 2) : [token, undefined]
    if (flag === '--quiet') {
      args.quiet = true
      continue
    }
    if (!['--root', '--since', '--session', '--limit', '--html', '--json'].includes(flag)) {
      throw new Error(`未知参数 ${flag}`)
    }
    const value = inline ?? argv[++index]
    if (value === undefined || value.trim() === '') {
      throw new Error(`dsh-event-fix: ${flag} requires a value`)
    }
    switch (flag) {
      case '--root': args.root = value; break
      case '--since': args.since = value; break
      case '--session': args.session = value; break
      case '--limit': args.limit = Number(value); break
      case '--html': args.html = value; break
      case '--json': args.json = value; break
    }
  }
  return args
}

function scan(options) {
  const root = resolveSessionsRoot(options.root)
  let since
  try {
    since = parseSince(options.since)
  } catch (error) {
    throw new CliError(error.message, 2)
  }
  let files
  try {
    files = listSessionFiles(root)
  } catch (error) {
    throw new CliError(error.message, 1)
  }
  if (since !== null) files = files.filter(file => file.mtime >= since)
  if (options.session !== null) files = files.filter(file => file.sessionId === options.session)
  if (Number.isSafeInteger(options.limit) && options.limit > 0) files = files.slice(0, options.limit)

  const sessions = []
  const failures = []
  for (const file of files) {
    try {
      const records = readSessionRecords(file.file)
      const header = records.find(record => record.type === 'session') ?? {}
      const state = summarizeRecords(records, {
        id: header.id ?? file.sessionId,
        cwd: header.cwd,
        origin: header.origin,
        createdAt: header.createdAt,
      })
      sessions.push({ sessionId: file.sessionId, cwd: header.cwd ?? '', view: sessionView(state) })
    } catch (error) {
      failures.push({ file: file.file, message: error.message })
    }
  }

  const report = buildReport(sessions, { root, since, now: Date.now() })
  for (const failure of failures) {
    process.stderr.write(`跳过 ${failure.file}: ${failure.message}\n`)
  }
  return { report, root, scanned: files.length, failures }
}

function writeOut(path, content) {
  const target = resolve(path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, content, 'utf8')
  return target
}

function main() {
  let args
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (error) {
    process.stderr.write(`${error.message}\n\n${USAGE}`)
    process.exitCode = 2
    return
  }
  if (args.help === true || args.command === 'help') {
    process.stdout.write(USAGE)
    return
  }
  if (args.command !== 'scan') {
    process.stderr.write(`未知命令 ${args.command}\n\n${USAGE}`)
    process.exitCode = 2
    return
  }

  let result
  try {
    result = scan(args)
  } catch (error) {
    if (error instanceof CliError) {
      process.stderr.write(`${error.message}\n`)
      process.exitCode = error.exitCode
      return
    }
    throw error
  }
  const { report, root, scanned } = result
  if (!args.quiet) {
    process.stdout.write(`${renderTextReport(report)}\n`)
    process.stdout.write(`\n扫描 ${scanned} 个会话文件 · 根目录 ${root}\n`)
  }
  if (args.json !== null) {
    const path = writeOut(args.json, JSON.stringify(report, null, 2))
    process.stdout.write(`JSON: ${path}\n`)
  }
  if (args.html !== null) {
    const path = writeOut(args.html, renderHtmlReport(report))
    process.stdout.write(`HTML: ${path}\n`)
  }
}

main()
