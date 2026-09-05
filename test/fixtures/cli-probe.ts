import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Container } from '@earendil-works/pi-tui';
import { ToolExecutionComponent, UserMessageComponent, AssistantMessageComponent, createBashToolDefinition, getAgentDir, type ExtensionAPI } from '@earendil-works/pi-coding-agent';

export default function probe(pi: ExtensionAPI) {
  const baseline = Container.prototype.render;
  const fingerprints = [Container.prototype.render, Container.prototype.handleMouse, AssistantMessageComponent.prototype.updateContent, AssistantMessageComponent.prototype.render].map(method => createHash('sha256').update(Function.prototype.toString.call(method)).digest('hex'));
  const key = Symbol.for('pi-minimal-display/cli-probe');
  const store = globalThis as typeof globalThis & { [key]?: { round: number; baseline: typeof baseline } };
  const run = store[key] ??= { round: 0, baseline };
  const restored = baseline === run.baseline;
  pi.registerCommand('display-probe', {
    description: 'Isolated test harness; not included in the published package',
    handler: async (_args, ctx) => {
      const destination = process.env.PI_DISPLAY_PROBE_RESULT;
      if (!destination) throw new Error('PI_DISPLAY_PROBE_RESULT is required');
      try {
        assert.ok(ctx.hasUI);
        assert.ok(restored, 'previous runtime patch was not restored before reload');
        assert.notEqual(Container.prototype.render, baseline);
        const definition = createBashToolDefinition(ctx.cwd);
        const transcript = new Container();
        transcript.addChild(new UserMessageComponent('synthetic fixture input'));
        const result = await definition.execute('fixture', { command: 'printf "probe-output"' }, undefined, undefined, ctx);
        const calls = ['first', 'second'].map(id => {
          const call = new ToolExecutionComponent('bash', id, { command: 'printf "probe-output"' }, {}, definition, { requestRender() {} } as never, ctx.cwd);
          call.updateResult({ ...result, isError: false });
          transcript.addChild(call);
          return call;
        });
        const collapsed = transcript.render(80).join('\n');
        assert.match(collapsed, /bash ×2/);
        assert.doesNotMatch(collapsed, /probe-output/);
        for (const call of calls) call.setExpanded(true);
        assert.match(transcript.render(80).join('\n'), /probe-output/);
        const message = { role: 'assistant', content: [{ type: 'thinking', thinking: 'hidden thinking' }, { type: 'text', text: 'visible text' }], stopReason: 'stop' } as const;
        const component = new AssistantMessageComponent(message as never);
        if (run.round % 2 === 0) assert.doesNotMatch(component.render(80).join('\n'), /hidden thinking/);
        else assert.match(component.render(80).join('\n'), /hidden thinking/);
        const reloads = Number(process.env.PI_DISPLAY_PROBE_RELOADS ?? 0);
        if (run.round < reloads) {
          run.round++;
          const configDir = join(getAgentDir(), 'extensions/pi-minimal-display');
          mkdirSync(configDir, { recursive: true });
          writeFileSync(join(configDir, 'config.json'), JSON.stringify({ hideThinking: run.round % 2 === 0 }));
          await ctx.reload();
          process.stdout.write('\nPI_DISPLAY_PROBE_READY\n');
          return;
        }
        writeFileSync(destination, JSON.stringify({ passed: true, fingerprints, reloads: run.round, groupedCalls: calls.length, execution: result.content, collapsed }));
      } catch (error) {
        writeFileSync(destination, JSON.stringify({ passed: false, error: String(error) }));
      }
      ctx.shutdown();
    },
  });
}
