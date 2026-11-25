import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const CLI_PATH = fileURLToPath(new URL('../bin/dsh-event-fix.mjs', import.meta.url))

function runCli(args) {
  return spawnSync(process.execPath, [CLI_PATH, ...args], { encoding: 'utf8' })
}

test('CLI exits with code 2 and a concise diagnostic on invalid --since', () => {
  for (const args of [
    ['scan', '--since', 'not-a-date'],
    ['scan', '--since=bogus'],
    ['scan', '--since'],
  ]) {
    const res = runCli(args)
    assert.equal(res.status, 2)
    assert.equal(res.stdout, '')
    assert.match(res.stderr, /--since/)
    assert.doesNotMatch(res.stderr, /\n\s+at\s+/)
  }
})

test('CLI exits non-zero with path and reason on unreadable --root', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-event-fix-cli-'))
  try {
    const missingRoot = join(dir, 'missing-sessions')
    const missingRes = runCli(['scan', '--root', missingRoot])
    assert.notEqual(missingRes.status, 0)
    assert.equal(missingRes.stdout, '')
    assert.ok(missingRes.stderr.includes(missingRoot))
    assert.match(missingRes.stderr, /cannot read sessions root/)
    assert.doesNotMatch(missingRes.stderr, /\n\s+at\s+/)

    const fileRoot = join(dir, 'not-a-directory.txt')
    writeFileSync(fileRoot, 'hello', 'utf8')
    const fileRes = runCli(['scan', '--root', fileRoot])
    assert.notEqual(fileRes.status, 0)
    assert.equal(fileRes.stdout, '')
    assert.ok(fileRes.stderr.includes(fileRoot))
    assert.match(fileRes.stderr, /cannot read sessions root/)
    assert.doesNotMatch(fileRes.stderr, /\n\s+at\s+/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('CLI succeeds on an empty readable --root with valid --since', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-event-fix-cli-'))
  try {
    const res = runCli(['scan', '--root', dir, '--since', '7d', '--quiet'])
    assert.equal(res.status, 0)
    assert.equal(res.stderr, '')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
