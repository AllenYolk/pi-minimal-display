import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '../dist/config.js';

mkdirSync('work', { recursive: true });

test('missing profile config uses compact defaults and preserves unknown tools', () => {
  const agentDir = mkdtempSync('work/config-');
  const result = loadConfig(agentDir);
  assert.equal(result.diagnostic, undefined);
  assert.equal(result.config.grouping, true);
  assert.equal(result.config.tools.read, 'count_only');
  assert.equal(result.config.tools.bash, 'lines');
  assert.equal(result.config.default, 'native');
  assert.equal(result.config.bash.maxCommandChars, 120);
});

test('config file follows the supplied profile and supports exact tool overrides', () => {
  const agentDir = mkdtempSync('work/config-');
  const dir = join(agentDir, 'extensions/pi-minimal-display');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'config.json'), JSON.stringify({ tools: { read: 'native', web_search: 'count_only' }, hideThinking: false }));
  const { config, diagnostic } = loadConfig(agentDir);
  assert.equal(diagnostic, undefined);
  assert.equal(config.tools.read, 'native');
  assert.equal(config.tools.web_search, 'count_only');
  assert.equal(config.tools.bash, 'lines');
  assert.equal(config.hideThinking, false);
});

test('invalid configuration falls back entirely with an actionable path', () => {
  for (const raw of ['{', 'null', '[]', 'true', '{"grouping":"false"}', '{"hideThnking":true}', '{"tools":{"bash":"invisible"}}', '{"tools":null}', '{"bash":{"outputLines":-1}}', '{"bash":{"maxCommandChars":0}}', '{"bash":{"outputLines":1.5}}']) {
    const agentDir = mkdtempSync('work/config-');
    const dir = join(agentDir, 'extensions/pi-minimal-display');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'config.json'), raw);
    const result = loadConfig(agentDir);
    assert.equal(result.config, undefined, raw);
    assert.match(result.diagnostic, /config\.json.*native display/s, raw);
  }
});
