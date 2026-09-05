import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
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

test('a third-party wrapper cannot keep a disposed session alive through its diagnostic callback', () => {
  const result = spawnSync(process.execPath, ['--expose-gc', '--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import * as Pi from '@earendil-works/pi-coding-agent';
    import * as Tui from '@earendil-works/pi-tui';
    import { installPresentation } from './dist/presentation.js';
    import { loadConfig } from './dist/config.js';
    function wrap(installed) { return function(width) { return installed.call(this, width); }; }
    function disposedSession() {
      const session = Pi.SessionManager.inMemory(process.cwd());
      const ctx = { sessionManager: session, ui: { notify() {} } };
      const reference = new WeakRef(session);
      const dispose = installPresentation(loadConfig('work/missing').config, Pi.VERSION, message => ctx.ui.notify(message), { pi: Pi, tui: Tui, session });
      assert.equal(typeof dispose, 'function');
      Tui.Container.prototype.render = wrap(Tui.Container.prototype.render);
      dispose();
      return reference;
    }
    const reference = disposedSession();
    for (let attempt = 0; attempt < 8; attempt++) { await new Promise(setImmediate); global.gc(); }
    assert.equal(reference.deref(), undefined, 'disposed wrapper retains the old session');
  `], { encoding: 'utf8', timeout: 15000 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
});
