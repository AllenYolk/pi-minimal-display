import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Container } from '@earendil-works/pi-tui';
import minimalDisplay from '../dist/index.js';

test('RPC/json/print contexts never activate patches even when they offer UI methods', async () => {
  const original = Container.prototype.render;
  const events = new Map();
  minimalDisplay({ on: (name, callback) => events.set(name, callback), registerCommand() {}, getAllTools() { throw new Error('non-TUI initialization must not inspect tools'); } });
  for (const mode of ['rpc', 'json', 'print']) {
    await events.get('session_start')({}, { mode, hasUI: true });
    assert.equal(Container.prototype.render, original);
    await events.get('session_shutdown')();
  }
});
