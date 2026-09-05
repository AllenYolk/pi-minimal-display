import type { AssistantMessageComponent, ToolExecutionComponent } from '@earendil-works/pi-coding-agent';
import type { Container, Component, TuiMouseEvent } from '@earendil-works/pi-tui';
import type * as Pi from '@earendil-works/pi-coding-agent';
import type * as Tui from '@earendil-works/pi-tui';
import { stripVTControlCharacters } from 'node:util';
import { CERTIFIED_PI_VERSION, type Config } from './config.js';

// Pi 0.85.0 presentation state; all private host knowledge stays in this module.
type ToolState = {
  toolName: string;
  args: Record<string, unknown>;
  expanded: boolean;
  isPartial: boolean;
  result?: { isError: boolean; content: Array<{ type: string; text?: string }> };
  ui: { requestRender(): void };
};
const stateOf = (tool: ToolExecutionComponent) => tool as unknown as ToolState;
const ownerKey = Symbol.for('@allenyolk/pi-minimal-display/owner');

function displayText(value: unknown): string {
  return typeof value === 'string' ? stripVTControlCharacters(value).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '') : '';
}

export interface Presentation {
  enabled: boolean;
  dispose(): void;
}

export function installPresentation(config: Config, version: unknown, report: (message: string) => void, host: { pi: typeof Pi; tui: typeof Tui }): Presentation {
  const disabled: Presentation = { enabled: false, dispose() {} };
  if (version !== CERTIFIED_PI_VERSION) {
    report(`Pi ${String(version)} is not certified (expected ${CERTIFIED_PI_VERSION}); using native display`);
    return disabled;
  }
  const { AssistantMessageComponent, SkillInvocationMessageComponent, ToolExecutionComponent, UserMessageComponent, keyText } = host.pi;
  const { Container, Text, truncateToWidth } = host.tui;
  if ([AssistantMessageComponent, SkillInvocationMessageComponent, ToolExecutionComponent, UserMessageComponent, Container, Text, truncateToWidth, keyText].some(value => typeof value !== 'function')) {
    report('Pi presentation exports are incompatible; using native display');
    return disabled;
  }
  const proto = Container.prototype as Container & { [ownerKey]?: object };
  if (proto[ownerKey]) {
    report('Another pi-minimal-display instance owns the presentation patch; using the existing instance');
    return disabled;
  }
  const originalRender = proto.render;
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'render');
  const originalMouse = proto.handleMouse;
  const mouseDescriptor = Object.getOwnPropertyDescriptor(proto, 'handleMouse');
  const assistantProto = AssistantMessageComponent.prototype;
  const thinkingDescriptor = Object.getOwnPropertyDescriptor(assistantProto, 'updateContent');
  const originalUpdate = assistantProto.updateContent;
  if (typeof originalRender !== 'function' || !descriptor?.writable || !mouseDescriptor?.writable || typeof originalMouse !== 'function' || !Object.isExtensible(proto) || typeof originalUpdate !== 'function' || !thinkingDescriptor?.writable) {
    report('Pi container rendering is incompatible; using native display');
    return disabled;
  }
  let active: Config | undefined = config;
  const token = {};
  const modeFor = (tool: ToolExecutionComponent, settings: Config) => {
    const name = stateOf(tool).toolName;
    return Object.hasOwn(settings.tools, name) ? settings.tools[name]! : settings.default;
  };

  function updateContent(this: AssistantMessageComponent, ...args: Parameters<AssistantMessageComponent['updateContent']>) {
    const [message, streaming] = args;
    if (!active?.hideThinking) return originalUpdate.apply(this, args);
    try {
      return originalUpdate.call(this, { ...message, content: message.content.filter(block => block.type !== 'thinking') }, streaming);
    } finally {
      // Keep the authoritative message for host invalidation and restoring visibility after disposal.
      (this as unknown as { lastMessage: unknown }).lastMessage = message;
    }
  }

  function group(members: ToolExecutionComponent[]): Component {
    return {
      render(width) {
        if (!active || members.some(tool => stateOf(tool).expanded)) {
          return members.flatMap(tool => tool.render(width));
        }
        const counts = new Map<string, number>();
        for (const tool of members) {
          const name = displayText(stateOf(tool).toolName).replace(/\s+/g, ' ');
          counts.set(name, (counts.get(name) ?? 0) + 1);
        }
        const failed = [...new Set(members.filter(tool => stateOf(tool).result?.isError).map(tool => displayText(stateOf(tool).toolName)))];
        const pending = members.filter(tool => stateOf(tool).isPartial).length;
        const status = [failed.length ? `failed: ${failed.join(', ')}` : '', pending ? `${pending} pending` : '', !failed.length && !pending ? 'succeeded' : ''].filter(Boolean).join('; ');
        const lines = new Text(`⚡ ${[...counts].map(([name, count]) => `${name} ×${count}`).join(' ')} — ${status} · ${keyText('app.tools.expand')} to expand`, 0, 0).render(width);
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
        if (!active || event.type !== 'click' || event.button !== 'left') return undefined;
        const expanded = !members.some(tool => stateOf(tool).expanded);
        for (const tool of members) tool.setExpanded(expanded);
        stateOf(members[0]!).ui.requestRender();
        return { handled: true };
      },
    };
  }

  function handleMouse(this: Container, event: TuiMouseEvent) {
    if (this.children.some(child => child instanceof ToolExecutionComponent)) {
      const height = render.call(this, event.width).length;
      return originalMouse.call(this, { ...event, height });
    }
    return originalMouse.call(this, event);
  }

  function render(this: Container, width: number): string[] {
    if (!active || !this.children.some(child => child instanceof ToolExecutionComponent)) return originalRender.call(this, width);
    const source = this.children;
    const projected: Component[] = [];
    let members: ToolExecutionComponent[] | undefined;
    for (const child of source) {
      if (child instanceof UserMessageComponent || child instanceof SkillInvocationMessageComponent) members = undefined;
      if (!(child instanceof ToolExecutionComponent) || modeFor(child, active) === 'native') {
        projected.push(child);
      } else {
        if (!members || !active.grouping) {
          members = [];
          projected.push(group(members));
        }
        members.push(child);
      }
    }
    // Original rendering records the projected mouse layout; restore transcript ownership afterwards.
    try {
      this.children = projected;
      try { return originalRender.call(this, width); }
      finally { this.children = source; }
    } catch (error) {
      patch.dispose();
      report(`Presentation failed: ${String(error)}; using native display`);
      return originalRender.call(this, width);
    }
  }

  const patch: Presentation = {
    enabled: true,
    dispose() {
      active = undefined;
      if (proto.render === render) Object.defineProperty(proto, 'render', descriptor);
      if (proto.handleMouse === handleMouse) Object.defineProperty(proto, 'handleMouse', mouseDescriptor);
      if (assistantProto.updateContent === updateContent) Object.defineProperty(assistantProto, 'updateContent', thinkingDescriptor);
      if (proto[ownerKey] === token) delete proto[ownerKey];
    },
  };
  try {
    Object.defineProperty(proto, ownerKey, { value: token, configurable: true });
    proto.render = render;
    proto.handleMouse = handleMouse;
    if (config.hideThinking) assistantProto.updateContent = updateContent;
  } catch (error) {
    patch.dispose();
    report(`Cannot install presentation patch: ${String(error)}; using native display`);
    return disabled;
  }
  return patch;
}
