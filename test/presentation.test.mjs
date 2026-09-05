import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Container, Text, visibleWidth } from '@earendil-works/pi-tui';
import { ToolExecutionComponent, UserMessageComponent, AssistantMessageComponent, SkillInvocationMessageComponent, createBashToolDefinition, initTheme } from '@earendil-works/pi-coding-agent';
import * as Pi from '@earendil-works/pi-coding-agent';
import * as Tui from '@earendil-works/pi-tui';
import { installPresentation as install } from '../dist/presentation.js';
import { loadConfig } from '../dist/config.js';

initTheme('dark');
const config = loadConfig('work/missing-profile').config;
const ui = { requestRender() {} };
const bash = createBashToolDefinition(process.cwd());
const installPresentation = (settings, version, report) => install(settings, version, report, { pi: Pi, tui: Tui });
function tool(name, id, text, definition = bash) {
  const component = new ToolExecutionComponent(name, id, { command: `echo ${id}` }, {}, definition, ui, process.cwd());
  component.updateResult({ content: [{ type: 'text', text }], isError: false });
  return component;
}

test('a turn groups mixed calls, native expansion retains details, disposal restores the host', () => {
  const before = Container.prototype.render;
  const patch = installPresentation(config, '0.85.0', () => {});
  assert.equal(patch.enabled, true);
  try {
    const transcript = new Container();
    transcript.addChild(new UserMessageComponent('hello'));
    const first = tool('bash', 'first', 'FIRST RESULT');
    const second = tool('read', 'second', 'SECOND RESULT');
    transcript.addChild(first);
    transcript.addChild(new Text('assistant commentary'));
    transcript.addChild(second);
    const originalChildren = [...transcript.children];
    const collapsed = transcript.render(80).join('\n');
    assert.match(collapsed, /bash ×1 read ×1/);
    assert.doesNotMatch(collapsed, /FIRST RESULT|SECOND RESULT|echo first/);
    assert.match(collapsed, /assistant commentary/);
    assert.deepEqual(transcript.children, originalChildren);
    first.setExpanded(true);
    second.setExpanded(true);
    const expanded = transcript.render(80).join('\n');
    assert.match(expanded, /FIRST RESULT/);
    assert.match(expanded, /SECOND RESULT/);
    patch.dispose();
    first.setExpanded(false);
    second.setExpanded(false);
    assert.match(transcript.render(80).join('\n'), /echo first/);
  } finally { patch.dispose(); }
  assert.equal(Container.prototype.render, before);
});

test('a rendering-adapter fault restores native content and reports only once', () => {
  const messages = [];
  const patch = install(config, '0.85.0', value => messages.push(value), { pi: { ...Pi, keyText() { throw new Error('changed key helper'); } }, tui: Tui });
  try {
    const transcript = new Container();
    transcript.addChild(tool('bash', 'safe', 'FALLBACK DETAIL'));
    assert.match(transcript.render(80).join('\n'), /FALLBACK DETAIL/);
    assert.match(transcript.render(80).join('\n'), /FALLBACK DETAIL/);
    assert.equal(messages.length, 1);
    assert.match(messages[0], /native/);
  } finally { patch.dispose(); }
});

test('a changed host shape is rejected before patching', () => {
  const before = Container.prototype.render;
  const messages = [];
  const patch = install(config, '0.85.0', value => messages.push(value), { pi: { ...Pi, ToolExecutionComponent: undefined }, tui: Tui });
  assert.equal(patch.enabled, false);
  assert.equal(Container.prototype.render, before);
  assert.equal(messages.length, 1);
});

test('direct transcript changes and user/skill boundaries preserve native cards and failures', () => {
  const patch = installPresentation(config, '0.85.0', () => {});
  try {
    const transcript = new Container();
    const first = tool('bash', 'failed', 'failure detail');
    first.updateResult({ content: [{ type: 'text', text: 'Command aborted' }], isError: true });
    const pending = tool('bash', 'pending', 'partial');
    pending.updateResult({ content: [{ type: 'text', text: 'partial' }], isError: false }, true);
    const unknown = tool('custom', 'native', 'NATIVE RESULT');
    transcript.children.push(first, unknown, pending);
    assert.match(transcript.render(80).join('\n'), /bash ×2.*failed: bash; 1 pending/);
    assert.match(transcript.render(80).join('\n'), /NATIVE RESULT/);
    transcript.children.splice(2, 0, new UserMessageComponent('next'));
    assert.equal((transcript.render(80).join('\n').match(/bash ×1/g) ?? []).length, 2);
    transcript.children.push(new SkillInvocationMessageComponent({ name: 'test', location: '/test', content: 'skill', userMessage: undefined }), tool('read', 'read-only', 'hidden'));
    assert.match(transcript.render(80).join('\n'), /read ×1/);
  } finally { patch.dispose(); }
});

test('unsupported hosts stay native and old disposal preserves a later owner', () => {
  const original = Container.prototype.render;
  const messages = [];
  for (const version of ['0.85.1', '0.86.0', 'garbage', undefined]) {
    assert.equal(installPresentation(config, version, message => messages.push(message)).enabled, false);
    assert.equal(Container.prototype.render, original);
  }
  assert.equal(messages.length, 4);
  const first = installPresentation(config, '0.85.0', () => {});
  assert.equal(installPresentation(config, '0.85.0', () => {}).enabled, false);
  first.dispose();
  const second = installPresentation(config, '0.85.0', () => {});
  const current = Container.prototype.render;
  first.dispose();
  assert.equal(Container.prototype.render, current);
  second.dispose();
  assert.equal(Container.prototype.render, original);
});

test('third-party wrapping remains intact and disposed closures become native', () => {
  const original = Container.prototype.render;
  const patch = installPresentation(config, '0.85.0', () => {});
  const installed = Container.prototype.render;
  function thirdParty(width) { return installed.call(this, width); }
  Container.prototype.render = thirdParty;
  try {
    patch.dispose();
    assert.equal(Container.prototype.render, thirdParty);
    const transcript = new Container();
    transcript.addChild(tool('bash', 'visible', 'NATIVE'));
    assert.match(transcript.render(80).join('\n'), /NATIVE/);
  } finally { Container.prototype.render = original; patch.dispose(); }
});

test('ungrouped lines mode previews only a short display command, expansion preserves full arguments', () => {
  const patch = installPresentation({ ...config, grouping: false }, '0.85.0', () => {});
  try {
    const command = '# check\nprintf "' + '中😀'.repeat(80) + '"\necho END_OF_COMMAND';
    const first = new ToolExecutionComponent('bash', 'long', { command }, {}, bash, ui, process.cwd());
    first.updateResult({ content: [{ type: 'text', text: 'OUTPUT_ONLY_ON_EXPAND' }], isError: false });
    const transcript = new Container();
    transcript.addChild(first);
    const collapsed = transcript.render(30);
    assert.match(collapsed.join('\n'), /check/);
    assert.doesNotMatch(collapsed.join('\n'), /END_OF_COMMAND|OUTPUT_ONLY_ON_EXPAND/);
    assert.ok(collapsed.every(line => visibleWidth(line) <= 30));
    assert.equal(first.args.command, command);
    first.setExpanded(true);
    const expanded = transcript.render(80).join('\n');
    assert.match(expanded, /END_OF_COMMAND/);
    assert.match(expanded, /OUTPUT_ONLY_ON_EXPAND/);
  } finally { patch.dispose(); }
});

test('click expansion uses the projected group layout even after resizing', () => {
  const patch = installPresentation(config, '0.85.0', () => {});
  try {
    const transcript = new Container();
    const first = tool('bash', 'one', 'ONE');
    const second = tool('bash', 'two', 'TWO');
    transcript.addChild(first);
    transcript.addChild(second);
    const lines = transcript.render(80);
    const event = { type: 'click', button: 'left', x: 1, y: 0, width: 40, height: lines.length, modifiers: { shift: false, alt: false, ctrl: false } };
    assert.equal(transcript.handleMouse(event)?.handled, true);
    assert.equal(first.expanded, true);
    assert.equal(second.expanded, true);
    assert.match(transcript.render(40).join('\n'), /ONE/);
  } finally { patch.dispose(); }
});

test('thinking visibility and streaming survive disable and repeated installation', () => {
  const message = { role: 'assistant', content: [{ type: 'thinking', thinking: 'PRIVATE THOUGHT' }, { type: 'text', text: 'PUBLIC TEXT' }], stopReason: 'stop' };
  const serialized = JSON.stringify(message);
  for (let index = 0; index < 10; index++) {
    const patch = installPresentation(config, '0.85.0', () => {});
    try {
      const component = new AssistantMessageComponent(message);
      component.updateContent(message, true);
      assert.equal(component.isStreaming, true);
      assert.equal(component.lastMessage, message);
      assert.doesNotMatch(component.render(80).join('\n'), /PRIVATE THOUGHT|Thinking/);
      assert.match(component.render(80).join('\n'), /PUBLIC TEXT/);
      patch.dispose();
      component.invalidate();
      assert.match(component.render(80).join('\n'), /PRIVATE THOUGHT/);
    } finally { patch.dispose(); }
  }
  assert.equal(JSON.stringify(message), serialized);
});
