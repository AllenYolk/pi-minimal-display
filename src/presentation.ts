import type { AssistantMessageComponent, ToolExecutionComponent } from '@earendil-works/pi-coding-agent';
import type { Container, Component, TuiMouseEvent } from '@earendil-works/pi-tui';
import type * as Pi from '@earendil-works/pi-coding-agent';
import type * as Tui from '@earendil-works/pi-tui';
import { stripVTControlCharacters } from 'node:util';
import { createHash } from 'node:crypto';
import { CERTIFIED_PI_VERSION, type Config } from './config.js';

// Pi 0.85.0 presentation state; all private host knowledge stays in this module.
type ToolState = {
  toolName: string;
  toolCallId: string;
  args: Record<string, unknown>;
  expanded: boolean;
  isPartial: boolean;
  result?: { isError: boolean; content: Array<{ type: string; text?: string }>; details?: unknown };
  ui: { requestRender(): void };
};
const stateOf = (tool: ToolExecutionComponent) => tool as unknown as ToolState;
const ownerKey = Symbol.for('@allenyolk/pi-minimal-display/owner');
// Published 0.85.0 SDK and bundled CLI methods: Container render/mouse, Assistant update/render.
const certifiedMethods = new Set([
  '3f8010cdede34c16dfa87b5544057cce2e38fe948c62b78998fd3630e2ad3311:702b6e2da7967989f0cf08e068f1405aede2ae529f48ec45f33402f83c3213d4:fd0c8ba64d8a398fce1ff73d93e43bc70b66ba50e06491ddeb4826c37992a302:b32d71cf32320dd71d4c6edc6a606da7340b6635bf05e2368ba5ef43bbdc6e50',
  '1bd938ca53360d12d6dcea0c955a5c4346f00eb2d6b67cec2dcf8a8911535b92:9316e9def7d88924b6e4f5c106d7dd9b54d217a4f59890b4ce3260ab3a571259:ac42dc0addeaf9fb23d004b1e7ea9fe41ed770a8c7077adbcb8c4af950d22a78:706329ba0e6e22acb726e6d444f23754f16fcce5cc021b7574a44b2480e2ec71',
]);

function displayText(value: unknown): string {
  return typeof value === 'string' ? stripVTControlCharacters(value).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '') : '';
}

export function installPresentation(config: Config, version: unknown, report: (message: string) => void, host: { pi: typeof Pi; tui: typeof Tui; session?: Pick<Pi.SessionManager, 'getBranch'> }): (() => void) | undefined {
  if (version !== CERTIFIED_PI_VERSION) {
    report(`Pi ${String(version)} is not certified (expected ${CERTIFIED_PI_VERSION}); using native display`);
    return;
  }
  const { AssistantMessageComponent, SkillInvocationMessageComponent, ToolExecutionComponent, UserMessageComponent, keyText } = host.pi;
  const { Container, Text, truncateToWidth } = host.tui;
  if ([AssistantMessageComponent, SkillInvocationMessageComponent, ToolExecutionComponent, UserMessageComponent, Container, Text, truncateToWidth, keyText].some(value => typeof value !== 'function')) {
    report('Pi presentation exports are incompatible; using native display');
    return;
  }
  const proto = Container.prototype as Container & { [ownerKey]?: () => void };
  if (proto[ownerKey]) {
    report('Another pi-minimal-display instance owns the presentation patch; using the existing instance');
    return;
  }
  const originalRender = proto.render;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'render');
  const originalMouse = proto.handleMouse;
  const mouseDescriptor = Object.getOwnPropertyDescriptor(proto, 'handleMouse');
  const assistantProto = AssistantMessageComponent.prototype;
  const thinkingDescriptor = Object.getOwnPropertyDescriptor(assistantProto, 'updateContent');
  const originalUpdate = assistantProto.updateContent;
  const assistantRenderDescriptor = Object.getOwnPropertyDescriptor(assistantProto, 'render');
  const originalAssistantRender = assistantProto.render;
  if (typeof originalRender !== 'function' || !descriptor?.writable || !mouseDescriptor?.writable || typeof originalMouse !== 'function' || !Object.isExtensible(proto) || typeof originalUpdate !== 'function' || !thinkingDescriptor?.writable || !assistantRenderDescriptor?.writable) {
    report('Pi container rendering is incompatible; using native display');
    return;
  }
  const signature = [originalRender, originalMouse, originalUpdate, originalAssistantRender].map(method => createHash('sha256').update(Function.prototype.toString.call(method)).digest('hex')).join(':');
  if (!certifiedMethods.has(signature)) {
    report('Pi presentation methods are modified or not certified; using native display');
    return;
  }
  let active: Config | undefined = config;
  let session = host.session;
  const thinkingComponents = new Set<WeakRef<AssistantMessageComponent>>();
  const seenThinking = new WeakSet<AssistantMessageComponent>();
  // Expanded-text layout dominated the measured rendering cost; invalidate by serialized content.
  let retainedViews = new WeakMap<ToolExecutionComponent, { source: string; component: Tui.Text }>();
  const modeFor = (tool: ToolExecutionComponent, settings: Config) => {
    const name = stateOf(tool).toolName;
    return Object.hasOwn(settings.tools, name) ? settings.tools[name]! : settings.default;
  };

  function updateContent(this: AssistantMessageComponent, ...args: Parameters<AssistantMessageComponent['updateContent']>) {
    const [message, streaming] = args;
    if (!active?.hideThinking) return originalUpdate.apply(this, args);
    if (!seenThinking.has(this)) {
      seenThinking.add(this);
      thinkingComponents.add(new WeakRef(this));
    }
    try {
      return originalUpdate.call(this, { ...message, content: message.content.filter(block => block.type !== 'thinking') }, streaming);
    } finally {
      // Keep the authoritative message for host invalidation and restoring visibility after disposal.
      (this as unknown as { lastMessage: unknown }).lastMessage = message;
    }
  }

  function renderAssistant(this: AssistantMessageComponent, width: number) {
    if (active?.hideThinking && !seenThinking.has(this) && (this as unknown as { lastMessage?: unknown }).lastMessage) this.invalidate();
    return originalAssistantRender.call(this, width);
  }

  function group(members: ToolExecutionComponent[]): Component {
    const nativeView = new Container();
    return {
      render(width) {
        if (!active || members.some(tool => stateOf(tool).expanded)) {
          nativeView.children = active ? members.flatMap(tool => {
            if (!stateOf(tool).expanded) tool.setExpanded(true);
            const state = stateOf(tool);
            // Native renderers may hide successful text even when expanded (notably write).
            const retained = { arguments: state.args, text: state.result?.content.filter(block => block.type === 'text').map(block => block.text), details: state.result?.details };
            const source = `Retained data\n${JSON.stringify(retained, null, 2)}`;
            let cached = retainedViews.get(tool);
            if (!cached || cached.source !== source) {
              cached = { source, component: new Text(source, 0, 0) };
              retainedViews.set(tool, cached);
            }
            return [tool, cached.component];
          }) : members;
          return originalRender.call(nativeView, width);
        }
        const counts = new Map<string, number>();
        for (const tool of members) {
          const name = displayText(stateOf(tool).toolName).replace(/\s+/g, ' ');
          counts.set(name, (counts.get(name) ?? 0) + 1);
        }
        const failed = [...new Set(members.filter(tool => stateOf(tool).result?.isError).map(tool => displayText(stateOf(tool).toolName)))];
        const pending = members.filter(tool => stateOf(tool).isPartial).length;
        const status = [failed.length ? `failed: ${failed.join(', ')}` : '', pending ? `${pending} pending` : '', !failed.length && !pending ? 'succeeded' : ''].filter(Boolean).join('; ');
        const lines = new Text(`⚡ ${[...counts].map(([name, count]) => `${name} ×${count}`).join(' ')} — ${status} · ${keyText('app.tools.expand') || 'click'} to expand`, 0, 0).render(width);
        const tool = members[0]!;
        const state = stateOf(tool);
        if (!active.grouping && modeFor(tool, active) === 'lines') {
          const value = state.toolName === 'bash' ? state.args.command : state.args.path;
          const command = Array.from(displayText(value).replace(/\s+/g, ' ').trim());
          const cap = active.bash.maxCommandChars;
          const preview = command.length > cap ? `${command.slice(0, cap - 1).join('')}…` : command.join('');
          if (preview) lines.push(truncateToWidth(`${state.toolName === 'bash' ? '$' : state.toolName} ${preview}`, width));
          if (state.toolName === 'bash' && active.bash.outputLines > 0) {
            const output = state.result?.content.filter(block => block.type === 'text').map(block => block.text ?? '').join('\n') ?? '';
            lines.push(...displayText(output).split(/\r?\n/).slice(0, active.bash.outputLines).map(line => truncateToWidth(line, width)));
          }
        }
        return lines;
      },
      invalidate() {},
      handleMouse(event: TuiMouseEvent) {
        if (!active || members.some(tool => stateOf(tool).expanded)) {
          const result = originalMouse.call(nativeView, event);
          if (active && members.some(tool => !stateOf(tool).expanded)) {
            for (const tool of members) tool.setExpanded(false);
          }
          return result;
        }
        if (event.type !== 'click' || event.button !== 'left') return undefined;
        for (const tool of members) tool.setExpanded(true);
        stateOf(members[0]!).ui.requestRender();
        return { handled: true };
      },
    };
  }

  function handleMouse(this: Container, event: TuiMouseEvent) {
    if (!active) return originalMouse.call(this, event);
    if (this.children.some(child => child instanceof ToolExecutionComponent)) {
      const height = render.call(this, event.width).length;
      return originalMouse.call(this, { ...event, height });
    }
    return originalMouse.call(this, event);
  }

  function render(this: Container, width: number): string[] {
    if (!active || !this.children.some(child => child instanceof ToolExecutionComponent)) return originalRender.call(this, width);
    const source = this.children;
    try {
      const turnIds = new Map<string, string>();
      let currentTurn = 'initial';
      for (const entry of session?.getBranch() ?? []) {
        if (entry.type !== 'message') continue;
        if (entry.message.role === 'user') currentTurn = entry.id;
        if (entry.message.role === 'assistant') {
          for (const block of entry.message.content) if (block.type === 'toolCall') turnIds.set(block.id, currentTurn);
        }
      }
      const projected: Component[] = [];
      let members: ToolExecutionComponent[] | undefined;
      let groupTurn: string | undefined;
      for (const child of source) {
        if (child instanceof UserMessageComponent || child instanceof SkillInvocationMessageComponent) members = undefined;
        if (!(child instanceof ToolExecutionComponent) || modeFor(child, active) === 'native') {
          projected.push(child);
        } else {
          const turn = turnIds.get(stateOf(child).toolCallId) ?? currentTurn;
          if (!members || !active.grouping || turn !== groupTurn) {
            members = [];
            groupTurn = turn;
            projected.push(group(members));
          }
          members.push(child);
        }
      }
      // Original rendering records the projected mouse layout; restore transcript ownership afterwards.
      this.children = projected;
      try { return originalRender.call(this, width); }
      finally { this.children = source; }
    } catch (error) {
      const notify = report;
      dispose();
      notify(`Presentation failed: ${String(error)}; using native display`);
      return originalRender.call(this, width);
    }
  }

  const dispose = () => {
    active = undefined;
    session = undefined;
    report = () => {};
    retainedViews = new WeakMap();
    if (proto.render === render) Object.defineProperty(proto, 'render', descriptor);
    if (proto.handleMouse === handleMouse) Object.defineProperty(proto, 'handleMouse', mouseDescriptor);
    if (assistantProto.updateContent === updateContent) Object.defineProperty(assistantProto, 'updateContent', thinkingDescriptor);
    if (assistantProto.render === renderAssistant) Object.defineProperty(assistantProto, 'render', assistantRenderDescriptor);
    if (proto[ownerKey] === dispose) delete proto[ownerKey];
    for (const reference of thinkingComponents) reference.deref()?.invalidate();
    thinkingComponents.clear();
  };
  try {
    Object.defineProperty(proto, ownerKey, { value: dispose, configurable: true });
    proto.render = render;
    proto.handleMouse = handleMouse;
    if (config.hideThinking) {
      assistantProto.updateContent = updateContent;
      assistantProto.render = renderAssistant;
    }
  } catch (error) {
    const notify = report;
    dispose();
    notify(`Cannot install presentation patch: ${String(error)}; using native display`);
    return;
  }
  return dispose;
}
