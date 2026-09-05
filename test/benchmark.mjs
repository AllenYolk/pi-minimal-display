import { performance } from 'node:perf_hooks';
import { platform, arch } from 'node:os';
import * as Pi from '@earendil-works/pi-coding-agent';
import * as Tui from '@earendil-works/pi-tui';
import { loadConfig } from '../dist/config.js';
import { installPresentation } from '../dist/presentation.js';

Pi.initTheme('dark');
const transcript = new Tui.Container();
const session = Pi.SessionManager.inMemory(process.cwd());
const calls = [];
const definition = Pi.createBashToolDefinition(process.cwd());
for (let turn = 0; turn < 40; turn++) {
  transcript.addChild(new Pi.UserMessageComponent(`Synthetic user turn ${turn}`));
  session.appendMessage({ role: 'user', content: `Synthetic user turn ${turn}`, timestamp: turn });
  for (let call = 0; call < 8; call++) {
    session.appendMessage({ role: 'assistant', content: [{ type: 'toolCall', id: `${turn}-${call}`, name: 'bash', arguments: { command: `echo fixture-${call}` } }], timestamp: turn });
    const component = new Pi.ToolExecutionComponent('bash', `${turn}-${call}`, { command: `echo fixture-${call}` }, {}, definition, { requestRender() {} }, process.cwd());
    component.updateResult({ content: [{ type: 'text', text: Array.from({ length: 12 }, (_, line) => `fixture output line ${line}`).join('\n') }], isError: false });
    transcript.addChild(component);
    session.appendMessage({ role: 'toolResult', toolCallId: `${turn}-${call}`, toolName: 'bash', ...component.result, timestamp: turn });
    calls.push(component);
  }
}
function sample(expanded) {
  calls.forEach(call => call.setExpanded(expanded));
  const times = [];
  let lines;
  for (let iteration = 0; iteration < 9; iteration++) {
    const start = performance.now();
    lines = transcript.render(100);
    if (iteration >= 2) times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return { medianMs: Number(times[3].toFixed(3)), displayLines: lines.length };
}
const native = { collapsed: sample(false), expanded: sample(true) };
const patch = installPresentation(loadConfig('work/missing').config, Pi.VERSION, console.error, { pi: Pi, tui: Tui, session });
try {
  const compact = { collapsed: sample(false), expanded: sample(true) };
  console.log(JSON.stringify({ node: process.version, pi: Pi.VERSION, platform: `${platform()}-${arch()}`, workload: { turns: 40, sessionEntries: session.getBranch().length, callsPerTurn: 8, resultLines: 12, width: 100, samples: 7 }, native, compact }, null, 2));
} finally { patch.dispose(); }
