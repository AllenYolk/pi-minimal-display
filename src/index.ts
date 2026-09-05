import * as Pi from '@earendil-works/pi-coding-agent';
import * as Tui from '@earendil-works/pi-tui';
import { CERTIFIED_PI_VERSION, loadConfig } from './config.js';
import { installPresentation, type Presentation } from './presentation.js';

export default function minimalDisplay(pi: Pi.ExtensionAPI): void {
  let presentation: Presentation | undefined;
  let status = 'Native display (no interactive session)';

  pi.on('session_start', (_event, ctx) => {
    presentation?.dispose();
    presentation = undefined;
    if (!ctx.hasUI) return;
    const report = (message: string) => { status = message; ctx.ui.notify(`pi-minimal-display: ${message}`, 'warning'); };
    if (Pi.VERSION !== CERTIFIED_PI_VERSION) {
      report(`Pi ${Pi.VERSION} is not certified (expected ${CERTIFIED_PI_VERSION}); using native display`);
      return;
    }
    const conflict = pi.getAllTools().find(tool => /(?:^|[/@:])(?:pi-tool-display|pi-tool-compact-display|pi-compact-display)(?:[/@]|$)/.test(tool.sourceInfo?.source ?? '') || /\/(?:pi-tool-display|pi-tool-compact-display|pi-compact-display)\//.test(tool.sourceInfo?.path ?? ''));
    if (conflict) {
      report(`Conflicting renderer owns ${conflict.name}; disable the other display extension and restart Pi`);
      return;
    }
    const { config, diagnostic } = loadConfig(Pi.getAgentDir());
    if (!config) { report(diagnostic!); return; }
    try {
      presentation = installPresentation(config, Pi.VERSION, report, { pi: Pi, tui: Tui });
      if (presentation.enabled) status = `Active on Pi ${Pi.VERSION}; grouping=${config.grouping}; hideThinking=${config.hideThinking}`;
    } catch (error) {
      presentation?.dispose();
      presentation = undefined;
      report(`Cannot load presentation: ${String(error)}; using native display`);
    }
  });

  pi.on('session_shutdown', () => {
    presentation?.dispose();
    presentation = undefined;
    status = 'Native display (session stopped)';
  });

  pi.registerCommand('minimal-display', {
    description: 'Show compact display status and its configuration path',
    handler: async (_args, ctx) => {
      ctx.ui.notify(`${status}\nConfig: ${Pi.getAgentDir()}/extensions/pi-minimal-display/config.json`, 'info');
    },
  });
}
