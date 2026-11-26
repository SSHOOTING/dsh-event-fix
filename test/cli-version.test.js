import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import manifest from '../package.json' with { type: 'json' }

const cli = fileURLToPath(new URL('../bin/dsh-event-fix.mjs', import.meta.url))

test('the CLI prints the installed package version', () => {
  assert.equal(execFileSync(process.execPath, [cli, '--version'], { encoding: 'utf8' }), `${manifest.version}\n`)
})

test('the help lists the version flag', () => {
  assert.match(execFileSync(process.execPath, [cli, '--help'], { encoding: 'utf8' }), /--version/)
})
