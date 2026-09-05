# Pi Minimal Display

Compact, expandable tool activity for Pi. A user turn containing many calls becomes a summary such as:

```text
⚡ bash ×3 read ×4 edit ×1 — succeeded · ctrl+o to expand
```

Failed tools are named in the summary, even while other calls are pending. Click a group or use Pi's configured tool-expansion shortcut to inspect its retained native details. Execution, tool definitions, model context, and saved conversation data are unchanged.

Status: release candidate under review; not published to npm. The runtime adapter accepts **Pi 0.85.0 only**. Unknown versions stay native and display a diagnostic. Compatibility results and limitations live in [validation](docs/validation.md).

## Try in an isolated profile

From this repository, using your existing Pi installation:

```sh
PI_CODING_AGENT_DIR="$(mktemp -d)" pi -e ./src/index.ts
```

This profile is separate from your normal configuration and credentials. To test normal conversations you will need to configure that profile's provider separately. There is no installation hook or runtime dependency to install for this extension. Pi loads the TypeScript entry directly.

For a local package installation into a profile you have chosen:

```sh
pi install /absolute/path/to/pi-minimal-display
```

The repository and the packed npm artifact both point to `src/index.ts`. No generated `dist/` is required for Pi loading. An npm install command will be added after publication; the package name is `@allenyolk/pi-minimal-display`.

## Configuration

Create `extensions/pi-minimal-display/config.json` under Pi's actual agent directory (normally `~/.pi/agent`). `PI_CODING_AGENT_DIR` is respected. No file means these defaults:

```json
{
  "grouping": true,
  "hideThinking": true,
  "default": "native",
  "tools": {
    "read": "count_only",
    "grep": "count_only",
    "find": "count_only",
    "ls": "count_only",
    "bash": "lines",
    "edit": "lines",
    "write": "lines"
  },
  "bash": { "maxCommandChars": 120, "outputLines": 0 }
}
```

- `native`: preserve Pi's existing tool presentation. Unknown tools use this by default.
- `count_only`: compact count/status, with retained native details on expansion.
- `lines`: joins the same group as count-only tools. When `grouping` is false, also shows a short command/path preview. Bash can show up to `outputLines` text lines.
- Tool overrides use exact names; defaults for other built-ins remain in effect. There is no MCP discovery or gateway-name guessing.
- `maxCommandChars` accepts integers 8–500, measured in Unicode code points; the preview also fits the terminal width. `outputLines` accepts integers 0–50. Neither changes actual arguments or results.
- `hideThinking` suppresses the visual thinking block. Original message content and streaming flags are retained.

Changes take effect after `/reload` or restart. `/minimal-display` shows status and the configuration path. Unknown keys, invalid types, malformed JSON, or unreadable configuration disable compact display for that runtime and report the file path.

Groups end at user messages or skill invocations, not assistant commentary. The session branch also identifies image-only user turns that have no visible user card. Native tools remain independent. Expanded groups keep native renderers and controls, and append retained arguments/text/details because some native renderers suppress successful output even when expanded. Images retain their native rendering. Output already truncated by Pi cannot be recovered, but retained truncation notices and full-output-file references remain available.

## Runtime patches and recovery

This extension temporarily patches Pi's in-memory container rendering/mouse routing and assistant thinking presentation. It never edits installed Pi files and never registers replacement tools. All private host assumptions are kept in [presentation.ts](src/presentation.ts).

Installation checks the exact version, required exports/descriptors, and fingerprints of the host methods it patches. Shutdown and reload dispose owned patches and restore existing thinking views; a runtime presentation failure disables the adapter and reports the fallback. Do not run it alongside `pi-tool-display`, `pi-tool-compact-display`, or `pi-compact-display`. Known tool-owner conflicts and prior modifications to the patched methods are rejected. Arbitrary third-party prototype patch combinations are not supported.

To recover, restart Pi without this extension. For a local package registered with `pi install`, remove that same source with `pi remove /absolute/path/to/pi-minimal-display`, then restart. The configuration file can be kept. Running `pi --no-extensions` provides a diagnostic session with all auto-discovered extensions disabled.

## Development

Prerequisites: Node >=22.19.0, npm, and [uv](https://docs.astral.sh/uv/) for the standard-library Python PTY test harness on macOS/Linux.

```sh
npm ci --ignore-scripts
uv python install 3.12
npm run check
npm run benchmark
npm pack --ignore-scripts
```

`npm run check` includes type checking, configuration/component regressions, a real bundled Pi CLI probe with ten reloads, and an actual packed-artifact load. Tests use disposable directories under ignored `work/` and never alter the daily Pi profile. `@earendil-works/pi-server` is a development-only workaround for the 0.85.0 SDK's import of an undeclared server package; it is not shipped or needed by the extension.

See [CONTRIBUTING.md](CONTRIBUTING.md) for issue, review, and release gates. The authoritative contract is [issue #1](https://github.com/AllenYolk/pi-minimal-display/issues/1).

## License and provenance

MIT, copyright AllenYolk. This is an original implementation, informed by the behavior of [pi-compact-display](https://github.com/Masterisk-F/pi-compact-display) and Pi's documented extension interfaces. No compact-display source was copied. Pi and its dependencies retain their respective licenses.
