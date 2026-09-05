# Validation

Candidate: 0.1.0-rc.1. Report date: 2026-09-05. The baseline candidate review covers `3b482e1...bc3c8b2`, with runtime source from `065216d`. Both review axes and the four-job CI matrix passed for that baseline. Publication and daily-profile activation require owner approval.

## Ponytail follow-up

[Issue #8](https://github.com/AllenYolk/pi-minimal-display/issues/8) replaces the internal installation result object/flag/no-op implementation and separate owner token with one optional disposer. It removes dead startup cleanup and a redundant collapsed-click condition. Public behavior and necessary boundary checks remain unchanged; production source shrinks by 13 lines without new dependencies.

All 24 checks pass. Against `a65066a`, five alternating before/after trials of the public recorded fixture produced byte-identical folded/expanded output (1,996/24,802 lines). Median-of-medians: folded 0.478 → 0.581 ms, expanded 4.713 → 5.047 ms. These timings do not establish a speedup; this change targets simpler ownership. Follow-up independent review and CI evidence are tracked in issue #8; the reviews below refer to the baseline, not automatically to later commits.

## Standards

No remaining release blockers or actionable heuristic smells. The independent reviewer reran all 24 checks and the public recorded-session benchmark. Prior gaps in real-host integration and recorded-transcript evidence are closed. The adapter's private host access remains confined to the explicitly approved presentation boundary.

## Spec

No remaining release-blocking findings against issue #1. Earlier thinking restoration, native controls, retained data, streaming expansion, image-only boundaries, RPC/conflict, disposal and host-evidence findings are closed with regressions. This reviewer independently inspected pinned CI and reran the recorded benchmark; local file-writing host/package probes were not rerun by that reviewer.

Summary: Standards 0 unresolved findings; Spec 0 unresolved findings. Independent reviews are evidence, not a guarantee that every environment is covered.

## Local evidence

On macOS arm64, Node 24.12.0 and Pi 0.85.0, 24 checks passed after building/type checking:

- Profile defaults, exact overrides, malformed configuration and native fallback.
- Real Pi component rendering, user/skill boundaries, direct transcript-array edits, pending+failed summaries, native recovery, narrow commands and mouse expansion.
- Repeated install/dispose with thinking restoration and preservation of original streaming/message data.
- Real bundled Pi CLI in a PTY executing a fixed `printf` fixture, rendering a group and reloading ten times while alternating thinking configuration.
- Actual npm tarball inspection and isolated installation with peer auto-install disabled, followed by real CLI loading and two reloads.
- Review regressions: image-only user turns, existing thinking restoration, newly arriving expanded members, native-hidden result text, RPC inactivity, prior prototype conflicts, and native renderer buttons.
- Disposed sessions are garbage-collectible even when another extension retains a wrapper; stale mouse wrappers are inert, and session-projection faults report once and recover native rendering.
- Real InteractiveMode with an isolated runtime: saved JSONL reopening and replay, branch/fork persistence and transcript rebuilding, editor Ctrl+O dispatch, mouse group expansion/collapse, follow-up queue presentation and non-consumption, synthetic streaming/partial/failure/abort events, and byte-identical native/expanded iTerm2 PNG payloads. Rendering and expansion preserve session/model snapshots.

The loader test initially failed with a built ESM entry inside the development tree, which resolved a different host class instance. The shipped source entry runs through Pi's extension loader; the adapter receives the host module objects from that entry.

These probes do not use an LLM. The InteractiveMode probe invokes real host methods without starting its terminal/provider loop; its streaming events are deterministic fixtures. The separate PTY probe exercises actual terminal startup and reload. Together they do not certify provider-driven queue delivery, the interactive `/fork` selector, physical terminal image display, or every terminal/image protocol.

## Synthetic rendering measurement

Same process/host, 40 user turns, 8 bash calls per turn, 12 retained output lines per call, width 100. The populated SessionManager has 680 branch entries, so the extension measurement includes the production branch traversal and tool-to-turn mapping. Two warmups and seven measured renders; medians below. The fixture contains no user session data.

| View | Native lines | Compact lines | Native median | Compact median |
| --- | ---: | ---: | ---: | ---: |
| Collapsed | 3,640 | 160 | 4.455 ms | 0.787 ms |
| Expanded | 5,560 | 9,080 | 1.463 ms | 1.794 ms |

Expanded output includes an additional retained-data appendix so that successful result blocks hidden by native renderers remain inspectable. Its first implementation rebuilt text layout every frame (15.873 ms median); caching by serialized content reduced that cost. The cache is weakly keyed by tool component, detects in-place content changes, and is discarded on disposal.

These numbers describe this synthetic workload only. Reproduce with `npm run benchmark`; do not infer tool-execution, model-latency or real-session performance from them.

## Public recorded-session measurement

Source: Pi's [large-session.jsonl at v0.85.0](https://github.com/earendil-works/pi/blob/v0.85.0/packages/coding-agent/test/fixtures/large-session.jsonl), a public recorded session dated 2025-11-20. SHA-256: `f029e59c3aec82fd6227eae51fc8839862a92b5e2426731ea9715eaf968a0ba4`. No private owner session was read. The fixture is downloaded into ignored work space, not redistributed in the package.

The benchmark imports its 914 message entries into an in-memory session and constructs real user/assistant/tool components, without executing recorded commands or migrating the source file. It includes 88 user messages and 391 tool calls (bash/read/edit/write). This is a component-level rendering benchmark, distinct from the InteractiveMode replay check above. Same Node/Pi/platform, width, warmups and samples as the synthetic measurement; extension defaults include hiding thinking.

| View | Native lines | Compact lines | Native median | Compact median |
| --- | ---: | ---: | ---: | ---: |
| Collapsed | 7,502 | 1,996 | 2.326 ms | 0.623 ms |
| Expanded | 14,892 | 24,802 | 3.546 ms | 4.655 ms |

Expanded rendering is slower and longer because the appendix exposes retained arguments/text/details in addition to native output. The benchmark does not establish a universal speedup.

To reproduce after `npm ci --ignore-scripts`:

```sh
mkdir -p work
curl --fail --location https://raw.githubusercontent.com/earendil-works/pi/v0.85.0/packages/coding-agent/test/fixtures/large-session.jsonl --output work/upstream-large-session.jsonl
shasum -a 256 work/upstream-large-session.jsonl
npm run benchmark -- work/upstream-large-session.jsonl
```

## Certification limits

Only exact Pi 0.85.0 is accepted by the runtime gate. A future Pi version is not certified merely because npm resolves its peers. The [four-job CI matrix](https://github.com/AllenYolk/pi-minimal-display/actions/runs/33959587401) passed on Linux/macOS with Node 22.19.0/24.12.0 at reviewed commit `bc3c8b2`, including packed-artifact loading. Windows and alternative Pi runtimes are not certified by this candidate.
