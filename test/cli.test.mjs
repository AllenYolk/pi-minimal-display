import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';

mkdirSync('work', { recursive: true });

test('the bundled Pi CLI loads, executes, groups and reloads ten times', { timeout: 30000 }, () => {
  const profile = resolve(mkdtempSync('work/cli-'));
  const resultFile = join(profile, 'result.json');
  const cli = resolve('node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js');
  const command = [process.execPath, cli, '--offline', '--no-session', '--no-context-files', '--no-skills', '--no-prompt-templates', '--no-extensions', '-e', resolve('src/index.ts'), '-e', resolve('test/fixtures/cli-probe.ts'), '/display-probe'];
  const result = spawnSync('uv', ['run', '--no-project', '--python', '3.12', 'python', resolve('test/pty.py'), ...command], {
    env: { ...process.env, PI_OFFLINE: '1', PI_CODING_AGENT_DIR: profile, PI_DISPLAY_PROBE_RESULT: resultFile, PI_DISPLAY_PROBE_RELOADS: '10' },
    stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', timeout: 25000, maxBuffer: 2 * 1024 * 1024,
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(readFileSync(resultFile, 'utf8'));
  assert.equal(report.passed, true, report.error);
  assert.equal(report.groupedCalls, 2);
  assert.equal(report.reloads, 10);
});
